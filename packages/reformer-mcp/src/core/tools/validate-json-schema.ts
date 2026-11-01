/**
 * Tool `validate_json_schema` — программная проверка form-DSL JSON-схемы
 * (`@reformer/renderer-json`) до рендера. Обёртка над `validateFormSchema`
 * из subpath `@reformer/renderer-json/validate` (там изолирован ajv).
 *
 * Даёт агенту objective-обратную связь: структура узлов + синтаксис операторов
 * (`$model/$component/$dataSource`) + неизвестные имена компонентов/data-source.
 */

/**
 * Тип модуля `@reformer/renderer-json/validate` из источника истины (`typeof import`).
 * `import type`/`typeof import` не грузят рантайм (ajv остаётся ленивым), но дрейф контракта
 * теперь ловится компилятором, а не в рантайме.
 */
type ValidateMod = typeof import('@reformer/renderer-json/validate');

/**
 * Форма модуля `@reformer/ui-kit/meta` (React-free): карта дефолтных props-схем + слияние с враппером.
 * Опциональная зависимость — грузится лениво, при отсутствии пакета фаза props-валидации пропускается.
 */
interface UiKitMetaMod {
  defaultPropSchemas?: Record<string, Record<string, unknown>>;
  mergeFieldPropsSchema?: (schema: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Ленивая подгрузка карты `componentProps`-схем из `@reformer/ui-kit/meta` (optional dependency).
 * Каждая дефолтная схема варианта сливается с контрактом враппера через `mergeFieldPropsSchema`
 * (иначе `label`/`required`/`testId` в реальном `componentProps` дали бы ложные срабатывания).
 * Нет пакета / не собран → `undefined` (props не проверяем, graceful fallback).
 */
async function loadComponentPropSchemas(): Promise<
  Record<string, Record<string, unknown>> | undefined
> {
  try {
    const meta = (await import('@reformer/ui-kit/meta')) as UiKitMetaMod;
    const defaults = meta.defaultPropSchemas;
    if (!defaults || typeof defaults !== 'object') return undefined;
    const merge = meta.mergeFieldPropsSchema;
    const out: Record<string, Record<string, unknown>> = {};
    for (const [name, schema] of Object.entries(defaults)) {
      out[name] = typeof merge === 'function' ? merge(schema) : schema;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

export const validateJsonSchemaToolDefinition = {
  name: 'validate_json_schema',
  description:
    'Validate a @reformer/renderer-json form-DSL JSON schema before rendering. The schema MUST be wrapped in a top-level `root` node — `{ "root": <node> }` — not a bare node or a `{ children: [...] }` object (a schema-like object without `root` fails with "must have required property \'root\'"). A node is `{ component, children? }` or a field leaf `{ value: "$model(path)", component, componentProps? }`. Minimal valid example: `{ "root": { "component": "$component(Box)", "children": [ { "value": "$model(email)", "component": "$component(Input)" } ] } }`. Checks node structure, operator syntax ($model/$component/$dataSource/$fn/$locale), and — when the matching name/key lists are supplied — that every $component(...)/$dataSource(...)/$fn(...) name and every $locale(...) key is known. Returns { valid, errors }. Call it on the JSON schema you generated (target renderer-json) before handing it off. Pass componentNames/dataSourceNames/fnNames/localeKeys matching the registry you will build.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      schema: {
        description:
          'The form-DSL JSON schema to validate — a JSON object (or JSON string) with a REQUIRED top-level `root` node: `{ "root": { "component": "$component(Box)", "children": [...] } }`. A bare node or `{ children: [...] }` without `root` is rejected.',
      },
      componentNames: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Names registered as components in your registry (e.g. ["Input","Select","Box","FormField"]). Enables unknown-$component(...) detection. Omit to skip name checks.',
      },
      dataSourceNames: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Names registered as data sources (e.g. ["LOAN_TYPES","GENDERS"]). Enables unknown-$dataSource(...) detection. Omit to skip name checks.',
      },
      fnNames: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Names registered as functions via reg.fn (e.g. ["formatCurrency","propertyItemLabel"]). Enables unknown-$fn(...) detection. Omit to skip $fn name checks.',
      },
      localeKeys: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Known localization keys from your reg.locale catalog (e.g. ["fields.email.label"]). Enables unknown-$locale(...) key detection. Omit to skip $locale key checks.',
      },
    },
    required: ['schema'],
  },
};

export interface ValidateJsonSchemaArgs {
  schema: unknown;
  componentNames?: string[];
  dataSourceNames?: string[];
  fnNames?: string[];
  localeKeys?: string[];
}

export async function validateJsonSchemaTool(
  args: ValidateJsonSchemaArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Accept a JSON string as well as a parsed object.
  let schema = args.schema;
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
    } catch (e) {
      return text(
        `# JSON schema — parse error\n\nThe \`schema\` argument was a string but is not valid JSON: ${(e as Error).message}`
      );
    }
  }

  // Lazily load the validator; ajv lives behind this subpath and the package
  // must be built. Fail gracefully rather than crashing the server.
  let validateFormSchema: ValidateMod['validateFormSchema'];
  try {
    const mod = (await import('@reformer/renderer-json/validate')) as ValidateMod;
    validateFormSchema = mod.validateFormSchema;
  } catch (e) {
    return text(
      '# validate_json_schema unavailable\n\n' +
        'Could not load `@reformer/renderer-json/validate`. Ensure `@reformer/renderer-json` ' +
        'is installed and built (`npm run build -w @reformer/renderer-json`).\n\n' +
        `Underlying error: ${(e as Error).message}`
    );
  }

  // Optionally load componentProps schemas from `@reformer/ui-kit/meta` (optional dep). Present →
  // phase (d) checks each node's `componentProps` (typos, wrong types). Absent → skipped gracefully.
  const propSchemas = await loadComponentPropSchemas();

  const { valid, errors } = validateFormSchema(schema, {
    componentNames: args.componentNames,
    dataSourceNames: args.dataSourceNames,
    fnNames: args.fnNames,
    localeKeys: args.localeKeys,
    propSchemas,
  });

  // Незнакомый проп в `componentProps` — замечание, а не ошибка формата: компоненты кита
  // передают незнакомые свойства дальше в DOM (`title`, `data-testid`), и рабочие схемы —
  // эталон регистрации, наборы кодогенерации конструктора — объявлялись invalid (калибровка,
  // трек T5). Опечатка остаётся видна предупреждением; `data-*` — штатный атрибут, не замечание.
  const unknownProp = (e: string) => /\.?componentProps has unknown property "/.test(e);
  // Шаг, вынесенный в свой файл (`{ "$ref": "steps/<slug>" }`), — раскладка, а не ошибка схемы:
  // корень собирают с шагами `composeJsonFormSchema` в коде. Проверка одного корня объявляла
  // рабочие наборы кодогенерации invalid (калибровка, `__golden__/wizard-split*`).
  const stepRef = (e: string) => /step reference "[^"]*" is not resolved/.test(e);
  const blocking = valid ? [] : errors.filter((e) => !unknownProp(e) && !stepRef(e));
  const propWarnings = errors.filter((e) => unknownProp(e) && !/unknown property "data-/.test(e));
  const stepWarnings = errors.filter(stepRef);
  const warningsBlock =
    (propWarnings.length > 0
      ? '\n\n## Warnings\n' +
        propWarnings.map((e) => `- ${e}`).join('\n') +
        '\n\n_Проп не объявлен в контракте компонента ui-kit: опечатку исправьте; свойство, которое ' +
        'компонент передаёт в DOM, можно оставить._'
      : '') +
    (stepWarnings.length > 0
      ? `\n\n## Не проверено: шаги в отдельных файлах (${stepWarnings.length})\n` +
        stepWarnings.map((e) => `- ${e}`).join('\n') +
        '\n\n_Проверен корень без шагов. Схему каждого шага проверьте отдельно (`kind="json-schema"`), ' +
        'а целиком — после `composeJsonFormSchema(schema, stepSchemas)`._'
      : '');

  if (blocking.length === 0) {
    return text(
      '# JSON schema — ✅ valid\n\nNo structural, operator-syntax, or unknown-name errors.' +
        warningsBlock
    );
  }
  return text(
    `# JSON schema — ❌ invalid (${blocking.length} error${blocking.length === 1 ? '' : 's'})\n\n` +
      blocking.map((e) => `- ${e}`).join('\n') +
      warningsBlock
  );
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}

/**
 * Проверка JSON-схемы формы (`@reformer/renderer-json`) до рендера — то, что делает
 * `validate_form kind="json-schema"`. Обёртка над `validateFormSchema` из subpath
 * `@reformer/renderer-json/validate` (там изолирован ajv). Отдельного инструмента
 * `validate_json_schema` с 7.0 нет.
 *
 * Даёт агенту objective-обратную связь: структура узлов + синтаксис операторов
 * (`$model/$component/$dataSource`) + неизвестные имена компонентов/data-source.
 */

import { catalogsOf } from '../generate/catalogs.js';
import type { Knowledge } from '../knowledge.js';

/**
 * Тип модуля `@reformer/renderer-json/validate` из источника истины (`typeof import`).
 * `import type`/`typeof import` не грузят рантайм (ajv остаётся ленивым), но дрейф контракта
 * теперь ловится компилятором, а не в рантайме.
 */
type ValidateMod = typeof import('@reformer/renderer-json/validate');

/**
 * Карта `componentProps`-схем кита из его каталога — того же, по которому генератор сверяет имена
 * компонентов. Схемы полей в каталоге уже слиты с контрактом обёртки (иначе `label`/`required`/
 * `testId` дали бы ложные срабатывания). Нет каталога → `undefined` (props не проверяются).
 */
async function loadComponentPropSchemas(
  k: Knowledge | undefined
): Promise<Record<string, Record<string, unknown>> | undefined> {
  if (!k) return undefined;
  return (await catalogsOf(k)).uiKitProps?.defaults as
    | Record<string, Record<string, unknown>>
    | undefined;
}

export interface ValidateJsonSchemaArgs {
  schema: unknown;
  componentNames?: string[];
  dataSourceNames?: string[];
  fnNames?: string[];
  localeKeys?: string[];
}

export interface ValidateJsonSchemaOptions {
  /** Есть ли у сервера `form_build` (под Node — да, в воркере билдера — нет): советовать ли его. */
  formBuild?: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Объект без `format` и без корня `root` — не документ формы: JSON Schema данных, FormIntent, конфиг.
 *
 * Проверка своя, а не текст библиотеки: `@reformer/renderer-json` проекта может быть старше и назвал
 * бы такой объект «прежним форматом» с советом `migrateJsonSchema`. Переводить там нечего, и модель
 * переписывала документ под ложный совет раз за разом (ReFormer-11oe.21). Документ прежнего формата
 * (`root` без `format`) идёт в библиотеку: его она называет верно.
 */
function notAFormDocument(schema: unknown, formBuild: boolean): string | null {
  if (!isObject(schema) || 'format' in schema || isObject(schema.root)) return null;
  const meta = schema.$schema;
  const intent = ['fields', 'formName', 'layoutRoot', 'steps'].some((key) => key in schema);
  const data =
    'properties' in schema ||
    'type' in schema ||
    (typeof meta === 'string' && meta.includes('json-schema.org'));
  const what = intent
    ? 'This is a FormIntent, not a form document.'
    : data
      ? 'This is a JSON Schema of the data ("properties", "type"), not a form document: the layout ' +
        'of a form is a separate document, the shape of the data comes from the form model.'
      : 'This is not a form document.';
  const next = [
    ...(formBuild
      ? [
          '- form_build writes the form document itself: write <dir>/form.intent.json and call ' +
            'form_build {"dir":"<dir>"}; the intent format — form_build {"grammar":"base"}.',
        ]
      : []),
    ...(intent ? ['- a FormIntent is checked by validate_form {"kind":"bundle","intent":…}.'] : []),
    '- migrateJsonSchema will not help: it converts a form document of the previous format, and ' +
      'this one has no tree of nodes.',
  ];
  return (
    '# JSON schema — ❌ not a form document\n\n' +
    `- /: no "format": 2 and no "root". ${what}\n` +
    '- A form document is { "format": 2, "root": { … } }: a tree of nodes with "component" and ' +
    '"children", fields bound by "$model(path)".\n\n' +
    `## Next\n${next.join('\n')}`
  );
}

export async function validateJsonSchemaTool(
  args: ValidateJsonSchemaArgs,
  k?: Knowledge,
  options: ValidateJsonSchemaOptions = {}
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

  const notAForm = notAFormDocument(schema, options.formBuild !== false);
  if (notAForm) return text(notAForm);

  // Lazily load the validator; ajv lives behind this subpath and the package
  // must be built. Fail gracefully rather than crashing the server.
  let validateFormSchema: ValidateMod['validateFormSchema'];
  try {
    const mod = (await import('@reformer/renderer-json/validate')) as ValidateMod;
    validateFormSchema = mod.validateFormSchema;
  } catch (e) {
    return text(
      '# validate_form kind="json-schema" unavailable\n\n' +
        'Could not load `@reformer/renderer-json/validate`. Ensure `@reformer/renderer-json` ' +
        'is installed and built (`npm run build -w @reformer/renderer-json`).\n\n' +
        `Underlying error: ${(e as Error).message}`
    );
  }

  // componentProps-схемы из каталога кита. Есть → фаза (d) проверяет `componentProps` каждого узла
  // (опечатки, типы). Нет каталога → проверка пропускается.
  const propSchemas = await loadComponentPropSchemas(k);

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

/**
 * Валидация form-DSL JSON-схемы (ajv) — отдельная точка входа `@reformer/renderer-json/validate`,
 * чтобы `ajv` не попадал в основной render-бандл (грузится только при явном импорте/динамически).
 *
 * Проверяется только документ формата 2 (`format: 2`). Документ прежнего формата не проверяется
 * по существу: результат — одна ошибка с отсылкой к `migrateJsonSchema`.
 *
 * Две основные проверки:
 *  (a) ajv против {@link formSchemaMetaSchema} — структура узлов + синтаксис операторов;
 *  (b) рекурсивный обход — ИМЕНА `$component(...)` и `$dataSource(...)` против реестра.
 *
 * Почему имена проверяет обход, а не enum в JSON Schema: формы вкладывают узлы в произвольный
 * `componentProps` (напр. `header` карточки), который JSON Schema видит как opaque `object` —
 * enum достал бы только имена на структурных позициях верхних уровней. Обход же
 * доходит до любого оператора. (Enum-вариант — {@link buildFormSchemaMetaSchema} — нужен для IDE
 * `$schema`, где squiggle на структурных `component` полезен сам по себе.) `$model(...)` — только
 * синтаксис (пути динамичны, в каждой форме свои).
 *
 * @module reformer/renderer-json/validate
 */

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import {
  formSchemaMetaSchema,
  getComponentNames,
  getDataSourceNames,
  getFnNames,
  getLocaleKeys,
  toComponentPropsValidatorSchema,
  type ComponentPropsSchema,
} from './schema';
import { parseOperator, isModelOp } from './operators';
import { isAllowedHtmlTag } from './html/html-tags';
import { isJsonStepRef } from './compose';
import type { ComponentRegistry } from './registry/types';
import { renamedComponentOf } from './registry/renamed-components';

/** Результат валидации схемы. */
export interface FormSchemaValidationResult {
  valid: boolean;
  /** Человекочитаемые ошибки (путь + сообщение). Пусто, если валидно. */
  errors: string[];
}

/** Опции: реестр (имена извлекаются автоматически) либо явные списки имён/ключей. */
export interface ValidateFormSchemaOptions {
  registry?: ComponentRegistry;
  componentNames?: string[];
  dataSourceNames?: string[];
  /** Имена функций `reg.fn` для проверки `$fn(...)`. Не заданы → проверка `$fn`-имён пропускается. */
  fnNames?: string[];
  /** Ключи каталога локализации для проверки `$locale(...)`. Не заданы → проверка ключей пропускается. */
  localeKeys?: readonly string[];
  /**
   * Карта регистр-имя → полная схема `componentProps` компонента (враппер + вариант, уже прошедшая
   * `mergeFieldPropsSchema` у поставщика). Не задана → фаза (d) не запускается (мягкий пропуск, полная
   * обратная совместимость). Компонент есть в дереве, но НЕ в карте → его props пропускаются
   * индивидуально. Обычно берётся из `@reformer/ui-kit/meta` (`defaultPropSchemas`).
   */
  propSchemas?: Record<string, ComponentPropsSchema>;
}

/** Известные имена/ключи по видам операторов; `undefined` для вида → его проверка пропускается. */
interface OperatorNameChecks {
  componentNames?: string[];
  dataSourceNames?: string[];
  fnNames?: string[];
  localeKeys?: readonly string[];
  /** Имена частей документа (ключи `parts`) — то, что валидно в `$part(...)`. */
  partNames?: string[];
}

/**
 * Известно ли имя компонента: само либо как прежнее имя переименованного — реестр разрешает его
 * в запись под новым именем, поэтому документ со старым именем проверку проходит.
 */
function isKnownComponent(name: string, componentNames: readonly string[]): boolean {
  if (componentNames.includes(name)) return true;
  const renamedTo = renamedComponentOf(name);
  return renamedTo !== undefined && componentNames.includes(renamedTo);
}

/** Рекурсивно собирает ошибки неизвестных `$component/$dataSource/$fn`-имён и `$locale`-ключей по дереву. */
function walkOperatorNames(
  node: unknown,
  path: string,
  checks: OperatorNameChecks,
  errors: string[]
): void {
  if (typeof node === 'string') {
    const op = parseOperator(node);
    const { componentNames, dataSourceNames, fnNames, localeKeys, partNames } = checks;
    if (op?.op === 'part' && partNames && !partNames.includes(op.arg)) {
      errors.push(
        `${path || '/'}: unknown part "${op.arg}" — declare it in the document "parts" map`
      );
    } else if (
      op?.op === 'component' &&
      componentNames &&
      !isKnownComponent(op.arg, componentNames)
    ) {
      errors.push(`${path || '/'}: unknown component "${op.arg}"`);
    } else if (op?.op === 'html' && !isAllowedHtmlTag(op.arg)) {
      // Whitelist статичен (не зависит от реестра), поэтому проверяется всегда — в отличие от
      // имён компонентов, которые без реестра пропускаются.
      errors.push(
        `${path || '/'}: HTML tag "${op.arg}" is not allowed in $html(...) — presentational tags only`
      );
    } else if (op?.op === 'dataSource' && dataSourceNames && !dataSourceNames.includes(op.arg)) {
      errors.push(`${path || '/'}: unknown dataSource "${op.arg}"`);
    } else if (op?.op === 'fn' && fnNames && !fnNames.includes(op.arg)) {
      errors.push(`${path || '/'}: unknown fn "${op.arg}"`);
    } else if (op?.op === 'locale' && localeKeys && !localeKeys.includes(op.arg)) {
      errors.push(`${path || '/'}: unknown locale key "${op.arg}"`);
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkOperatorNames(v, `${path}[${i}]`, checks, errors));
    return;
  }
  if (node !== null && typeof node === 'object') {
    // Структурная форма `$locale` с параметрами: `{ $locale: 'key', params?: {…} }`. Ключ здесь —
    // голая строка (не оператор `$locale(...)`), поэтому проверяем его отдельно от строковой ветви.
    const n = node as Record<string, unknown>;
    if (
      typeof n.$locale === 'string' &&
      checks.localeKeys &&
      !checks.localeKeys.includes(n.$locale)
    ) {
      errors.push(`${path ? `${path}.` : ''}$locale: unknown locale key "${n.$locale}"`);
    }
    for (const [k, v] of Object.entries(node)) {
      walkOperatorNames(v, path ? `${path}.${k}` : k, checks, errors);
    }
  }
}

/**
 * Единый шейпер ajv-ошибок → человекочитаемые строки. Используется и фазой (a) (структура/операторы),
 * и фазой (d) (componentProps). Глушит мета-шум и НАЗЫВАЕТ виновника опечатки:
 *  - `keyword === 'if'` — мета-ошибка дискриминации нод (if/then/else): настоящая причина всплывает
 *    в ветке, а «must match then/else» её лишь погребает.
 *  - `keyword === 'anyOf'` — мета-ошибка escape-hatch'а операторов (`anyOf:[тип, operatorOp]`).
 *  - ветка `operatorOp` — при провале честного типа ajv ещё жалуется, что значение не оператор-строка;
 *    это шум, реальную причину несёт честная ветка.
 *  - `additionalProperties` — вместо «must NOT have additional properties» называет опечатанный проп
 *    (главная ценность строгих схем: сказать, ЧТО опечатано).
 *
 * @param ajvErrors - `errors` скомпилированной ajv-функции.
 * @param basePath - Префикс пути (для (a) — пусто; для (d) — путь ноды + `.componentProps`).
 * @returns Отфильтрованные и оформленные сообщения.
 */
function formatAjvErrors(
  ajvErrors: readonly ErrorObject[] | null | undefined,
  basePath: string
): string[] {
  const out: string[] = [];
  for (const e of ajvErrors ?? []) {
    if (e.keyword === 'if') continue;
    if (e.keyword === 'anyOf') continue;
    if (e.schemaPath.includes('operatorOp')) continue;
    if (e.keyword === 'additionalProperties') {
      const prop = (e.params as { additionalProperty?: string }).additionalProperty;
      const loc = joinInstancePath(basePath, e.instancePath);
      out.push(`${loc || '/'} has unknown property "${prop ?? '?'}"`.trim());
      continue;
    }
    const loc = joinInstancePath(basePath, e.instancePath);
    out.push(`${loc || '/'} ${e.message ?? 'invalid'}`.trim());
  }
  return out;
}

/** Склеивает префикс пути с ajv `instancePath` (JSON-pointer вида `/clearable`). */
function joinInstancePath(basePath: string, instancePath: string): string {
  if (!basePath) return instancePath;
  return instancePath ? `${basePath}${instancePath}` : basePath;
}

/**
 * Компилирует (с кэшем) ajv-валидатор componentProps для компонента. Компиляция обёрнута в try/catch:
 * кривая схема не должна ронять весь `validateFormSchema` — на ошибке кэшируем `null` (пропуск).
 */
function getComponentPropsValidator(
  name: string,
  schema: ComponentPropsSchema,
  ajv: Ajv,
  cache: Map<string, ValidateFunction | null>
): ValidateFunction | null {
  if (cache.has(name)) return cache.get(name) ?? null;
  let validate: ValidateFunction | null = null;
  try {
    validate = ajv.compile(toComponentPropsValidatorSchema(schema));
  } catch {
    validate = null;
  }
  cache.set(name, validate);
  return validate;
}

/**
 * Фаза (d): рекурсивно находит ноды с оператором `component` и валидирует их `componentProps` по
 * карте `propSchemas`. По образцу {@link walkOperatorNames} — обход доходит до нод, вложенных в
 * произвольный `componentProps`, которые JSON Schema видит как opaque. Мягкий пропуск: компонента
 * нет в карте → пропускается индивидуально.
 */
function walkComponentProps(
  node: unknown,
  path: string,
  propSchemas: Record<string, ComponentPropsSchema>,
  ajv: Ajv,
  cache: Map<string, ValidateFunction | null>,
  errors: string[]
): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkComponentProps(v, `${path}[${i}]`, propSchemas, ajv, cache, errors));
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  const op = parseOperator(n.component);
  if (
    op?.op === 'component' &&
    n.componentProps !== null &&
    typeof n.componentProps === 'object' &&
    !Array.isArray(n.componentProps)
  ) {
    // Прежнее имя переименованного компонента проверяется по схеме пропсов нынешнего.
    const name =
      propSchemas[op.arg] !== undefined ? op.arg : (renamedComponentOf(op.arg) ?? op.arg);
    const schema = propSchemas[name];
    if (schema) {
      const validate = getComponentPropsValidator(name, schema, ajv, cache);
      if (validate && !validate(n.componentProps)) {
        const base = `${path ? `${path}.` : ''}componentProps`;
        for (const msg of formatAjvErrors(validate.errors, base)) errors.push(msg);
      }
    }
  }
  for (const [k, v] of Object.entries(n)) {
    walkComponentProps(v, path ? `${path}.${k}` : k, propSchemas, ajv, cache, errors);
  }
}

/**
 * Фаза (e): ссылки на файлы шагов (`{ "$ref" }` в `children` визарда). Конвертер их не понимает —
 * схему с шагами в отдельных файлах собирают до проверки и до сборки формы.
 */
function walkStepRefs(node: unknown, path: string, errors: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkStepRefs(v, `${path}[${i}]`, errors));
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  if (Array.isArray(n.children)) {
    n.children.forEach((step, i) => {
      if (isJsonStepRef(step)) {
        errors.push(
          `${path ? `${path}.` : ''}children[${i}]: step reference "${step.$ref}" is not resolved — assemble the schema with composeJsonFormSchema(schema, stepSchemas) before rendering or validating.`
        );
      }
    });
  }
  for (const [k, v] of Object.entries(n)) {
    walkStepRefs(v, path ? `${path}.${k}` : k, errors);
  }
}

/**
 * Собирает ключи элемента массива — первый сегмент каждого `$model(...)`-биндинга шаблона
 * (привязка `model` у поля, подформы и вложенного массива). Во вложенный `item` НЕ спускается:
 * его поля — ключи вложенного элемента, а не текущего. Используется для проверки полноты
 * `initialValue` (§8).
 */
function collectTemplateModelKeys(node: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((v) => collectTemplateModelKeys(v, keys));
    return keys;
  }
  if (node !== null && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    if (isModelOp(n.model)) {
      const key = (parseOperator(n.model)?.arg ?? '').split('.')[0].split('[')[0];
      if (key) keys.add(key);
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === 'item') continue; // не спускаемся в шаблон вложенного массива
      collectTemplateModelKeys(v, keys);
    }
  }
  return keys;
}

/**
 * Фаза (c): `initialValue` узла-массива необязателен (шаблон нового элемента живёт в модели —
 * `arrayOf`), но если он задан, то обязан нести все ключи строки. Шаблон строки — вписанный узел
 * либо именованная часть документа.
 */
function walkArrayInitialValue(
  node: unknown,
  path: string,
  parts: Record<string, unknown>,
  errors: string[]
): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkArrayInitialValue(v, `${path}[${i}]`, parts, errors));
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  const initial = n.initialValue;
  if (
    isModelOp(n.model) &&
    n.item !== undefined &&
    initial !== null &&
    typeof initial === 'object' &&
    !Array.isArray(initial)
  ) {
    const partName = parseOperator(n.item)?.op === 'part' ? parseOperator(n.item)!.arg : undefined;
    const template =
      partName !== undefined ? parts[partName] : (n.item as { $template?: unknown }).$template;
    const required = collectTemplateModelKeys(template);
    const have = new Set(Object.keys(initial as Record<string, unknown>));
    const missing = [...required].filter((k) => !have.has(k));
    if (missing.length) {
      errors.push(
        `${path || '/'}: array node "initialValue" is missing element keys [${missing.join(', ')}] required by the item template — those "$model(...)" leaves would have no signal and render nothing.`
      );
    }
  }
  for (const [k, v] of Object.entries(n)) {
    walkArrayInitialValue(v, path ? `${path}.${k}` : k, parts, errors);
  }
}

/**
 * Ошибка для документа прежнего формата: объект без поля `format`. Не-объект и объект с чужим
 * значением `format` доходят до мета-схемы — она назовёт ошибку сама.
 */
function previousFormatError(schema: unknown): string | undefined {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return undefined;
  if ('format' in schema) return undefined;
  return (
    '/: the document is in the previous JSON schema format (no "format": 2) — the runtime reads ' +
    'format 2 only. Convert it with migrateJsonSchema(document) and validate the result.'
  );
}

/**
 * Валидирует документ JSON-схемы формы формата 2. Если передан `registry`, имена компонентов/source
 * берутся из него (иначе можно задать `componentNames`/`dataSourceNames` явно). Тянет `ajv` — живёт
 * в subpath `@reformer/renderer-json/validate`, чтобы не попадать в основной render-бандл.
 *
 * Документ прежнего формата (без `format: 2`) по существу не проверяется: результат — одна ошибка
 * с отсылкой к `migrateJsonSchema`.
 *
 * Если задан `opts.propSchemas` (карта регистр-имя → схема componentProps), дополнительно запускается
 * фаза (d): рекурсивный обход валидирует `componentProps` каждой компонент-ноды по её схеме (ловит
 * опечатки в именах пропов и неверные типы). Не задан → фаза не запускается (обратная совместимость).
 *
 * @param schema - Проверяемая JSON-схема (обычно {@link JsonFormSchema}, но принимает `unknown`).
 * @param opts - {@link ValidateFormSchemaOptions}: `registry` либо явные списки имён; опц. `propSchemas`.
 * @returns {@link FormSchemaValidationResult} — `{ valid, errors }` (ошибки — путь + сообщение).
 *
 * @example
 * ```ts
 * const { valid, errors } = validateFormSchema(jsonSchema, { registry });
 * if (!valid) console.error(errors);
 * ```
 */
export function validateFormSchema(
  schema: unknown,
  opts: ValidateFormSchemaOptions = {}
): FormSchemaValidationResult {
  const componentNames =
    opts.componentNames ?? (opts.registry ? getComponentNames(opts.registry) : undefined);
  const dataSourceNames =
    opts.dataSourceNames ?? (opts.registry ? getDataSourceNames(opts.registry) : undefined);
  const fnNames = opts.fnNames ?? (opts.registry ? getFnNames(opts.registry) : undefined);
  const localeKeys = opts.localeKeys ?? (opts.registry ? getLocaleKeys(opts.registry) : undefined);

  // Документ прежнего формата рантайм не читает: проверять его узлы по мета-схеме формата 2 —
  // значит выдать стену ошибок на каждый ключ `value` / `array`. Одна ошибка с выходом короче.
  const previous = previousFormatError(schema);
  if (previous) return { valid: false, errors: [previous] };

  const errors: string[] = [];

  const rawParts = (schema as { parts?: unknown } | null)?.parts;
  const parts =
    rawParts !== null && typeof rawParts === 'object' && !Array.isArray(rawParts)
      ? (rawParts as Record<string, unknown>)
      : {};
  const partNames = Object.keys(parts);

  // (a) Структура узлов + синтаксис операторов (имена НЕ enum-чекаются здесь — см. (b))
  const ajv = new Ajv({ allErrors: true });
  const validateFn = ajv.compile(formSchemaMetaSchema);
  if (!validateFn(schema)) {
    for (const msg of formatAjvErrors(validateFn.errors, '')) errors.push(msg);
  }

  // (b) Имена $component/$dataSource/$fn, ключи $locale и имена $part по всему дереву (включая
  // вложенные в opaque componentProps)
  walkOperatorNames(
    schema,
    '',
    { componentNames, dataSourceNames, fnNames, localeKeys, partNames },
    errors
  );

  // (c) Шаблон нового элемента массива живёт в модели, поэтому проверяется только полнота
  // заданного в документе запасного `initialValue`.
  walkArrayInitialValue(schema, '', parts, errors);

  // (e) Несобранная схема: ссылка на файл шага дошла бы до мастера объектом вместо шага.
  walkStepRefs(schema, '', errors);

  // (d) componentProps каждой компонент-ноды против карты propSchemas (если задана). По образцу (b):
  // рекурсивный обход достаёт ноды, вложенные в opaque componentProps. Нет propSchemas → пропуск.
  if (opts.propSchemas) {
    const propsAjv = new Ajv({ allErrors: true, allowUnionTypes: true });
    const validatorCache = new Map<string, ValidateFunction | null>();
    walkComponentProps(schema, '', opts.propSchemas, propsAjv, validatorCache, errors);
  }

  return { valid: errors.length === 0, errors };
}

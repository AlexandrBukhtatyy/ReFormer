/**
 * Валидация form-DSL JSON-схемы (ajv) — отдельная точка входа `@reformer/renderer-json/validate`,
 * чтобы `ajv` не попадал в основной render-бандл (грузится только при явном импорте/динамически).
 *
 * Две проверки:
 *  (a) ajv против {@link formSchemaMetaSchema} — структура узлов + синтаксис операторов;
 *  (b) рекурсивный обход — ИМЕНА `$component(...)` и `$dataSource(...)` против реестра.
 *
 * Почему имена проверяет обход, а не enum в JSON Schema: реальные формы вкладывают дерево узлов
 * в произвольный `componentProps` (напр. `RendererFormWizard.steps`), который JSON Schema видит как
 * opaque `object` — enum достал бы только имена на структурных позициях верхних уровней. Обход же
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
import type { ComponentRegistry } from './registry/types';

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
    const { componentNames, dataSourceNames, fnNames, localeKeys } = checks;
    if (op?.op === 'component' && componentNames && !componentNames.includes(op.arg)) {
      errors.push(`${path || '/'}: unknown component "${op.arg}"`);
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
 * произвольный `componentProps` (напр. `componentProps.steps[…]` у мастера), которые JSON Schema
 * видит как opaque. Мягкий пропуск: компонента нет в карте → пропускается индивидуально.
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
    const schema = propSchemas[op.arg];
    if (schema) {
      const validate = getComponentPropsValidator(op.arg, schema, ajv, cache);
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

/** Похож ли объект на array-узел (`array: '$model(...)'` + `item.$template`)? */
function looksLikeArrayNode(n: Record<string, unknown>): boolean {
  return (
    isModelOp(n.array) &&
    typeof n.item === 'object' &&
    n.item !== null &&
    '$template' in (n.item as Record<string, unknown>)
  );
}

/**
 * Рекурсивно флагает array-узлы без `initialValue`. Листья шаблона несут `value: '$model(...)'`
 * (под-пути элемента-объекта), поэтому без литерал-`initialValue` кнопка «Добавить» кладёт `{}` —
 * core строит GroupNode без детей, `$model(...)`-листья резолвятся в undefined-сигналы и ничего
 * не рендерят (карточка только с кнопками). Схема при этом структурно валидна (initialValue
 * опционален), так что молчаливую поломку ловим здесь.
 */
function walkArrayInitialValue(node: unknown, path: string, errors: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkArrayInitialValue(v, `${path}[${i}]`, errors));
    return;
  }
  if (node !== null && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    if (looksLikeArrayNode(n) && n.initialValue === undefined) {
      errors.push(
        `${path || '/'}: array node is missing "initialValue" — the "Add" button would create an empty element and its "$model(...)" template leaves would render nothing. Provide an "initialValue" literal with the element's keys.`
      );
    }
    for (const [k, v] of Object.entries(n)) {
      walkArrayInitialValue(v, path ? `${path}.${k}` : k, errors);
    }
  }
}

/**
 * Валидирует form-DSL JSON-схему. Если передан `registry`, имена компонентов/source берутся из него
 * (иначе можно задать `componentNames`/`dataSourceNames` явно). Тянет `ajv` — живёт в subpath
 * `@reformer/renderer-json/validate`, чтобы не попадать в основной render-бандл.
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

  const errors: string[] = [];

  // (a) Структура узлов + синтаксис операторов (имена НЕ enum-чекаются здесь — см. (b))
  const ajv = new Ajv({ allErrors: true });
  const validateFn = ajv.compile(formSchemaMetaSchema);
  if (!validateFn(schema)) {
    for (const msg of formatAjvErrors(validateFn.errors, '')) errors.push(msg);
  }

  // (b) Имена $component/$dataSource/$fn и ключи $locale по всему дереву (включая вложенные в opaque componentProps)
  walkOperatorNames(schema, '', { componentNames, dataSourceNames, fnNames, localeKeys }, errors);

  // (c) Array-узлы без initialValue → молчаливо ломающиеся элементы (см. walkArrayInitialValue)
  walkArrayInitialValue(schema, '', errors);

  // (d) componentProps каждой компонент-ноды против карты propSchemas (если задана). По образцу (b):
  // рекурсивный обход достаёт ноды, вложенные в opaque componentProps. Нет propSchemas → пропуск.
  if (opts.propSchemas) {
    const propsAjv = new Ajv({ allErrors: true, allowUnionTypes: true });
    const validatorCache = new Map<string, ValidateFunction | null>();
    walkComponentProps(schema, '', opts.propSchemas, propsAjv, validatorCache, errors);
  }

  return { valid: errors.length === 0, errors };
}

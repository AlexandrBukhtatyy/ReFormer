/**
 * Валидация схем мета-схемой (ajv) — отдельный subpath.
 *
 * Изоляция не косметическая: ajv весит больше, чем всё ядро реестра вместе взятое. Пока он лежит
 * в собственной точке входа, приложение, которому валидация в рантайме не нужна (все схемы из
 * бандла и проверены в CI), его просто не загрузит. Инвариант закреплён проверкой
 * `scripts/check-ajv-isolation.mjs`.
 *
 * Стратегия комбинированная:
 * - **до релиза** — все `inline`/`module` схемы прогоняются полным ajv в тесте; рантайм-стоимость нулевая;
 * - **в релизе** — валидируются только схемы, приехавшие по сети, потому что только они могут
 *   разойтись с кодом после сборки.
 *
 * @module reformer/form-registry/manifest
 */

// Импорт ИМЕННО из subpath `/validate`: в основной точке входа `renderer-json` валидатора нет
// специально — ajv не должен попадать в render-бандл. Тянуть его отсюда — то же решение этажом выше.
import { validateFormSchema } from '@reformer/renderer-json/validate';
import type { ComponentRegistry, JsonFormSchema } from '@reformer/renderer-json';

export interface ValidateOptions {
  registry?: ComponentRegistry;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

/**
 * Результаты валидации по ССЫЛКЕ на схему.
 *
 * `validateFormSchema` создаёт `new Ajv()` и компилирует мета-схему на КАЖДЫЙ вызов. При слоте
 * с пятью формами это пять компиляций одной и той же мета-схемы. Схема — иммутабельные данные,
 * поэтому повторная проверка того же объекта не может дать другой результат; кэшируем по ссылке
 * через `WeakMap`, чтобы не удерживать схемы от сборки мусора.
 *
 * Ключ второго уровня — реестр: одна и та же схема против разных реестров валидна по-разному
 * (имена `$component` сверяются с реестром).
 */
const cache = new WeakMap<
  object,
  WeakMap<object, ValidateResult> & { noRegistry?: ValidateResult }
>();

const NO_REGISTRY = {} as ComponentRegistry;

/**
 * Проверяет схему мета-схемой, переиспользуя результат для той же пары (схема, реестр).
 *
 * @param schema - Схема формы. Сравнивается ПО ССЫЛКЕ — новый объект даст новую компиляцию.
 * @param opts - Реестр для сверки имён операторов.
 */
export function validateSchemaCached(
  schema: JsonFormSchema,
  opts: ValidateOptions = {}
): ValidateResult {
  const registryKey = (opts.registry ?? NO_REGISTRY) as unknown as object;
  let bySchema = cache.get(schema as unknown as object);
  if (!bySchema) {
    bySchema = new WeakMap();
    cache.set(schema as unknown as object, bySchema);
  }
  const hit = bySchema.get(registryKey);
  if (hit) return hit;

  const { valid, errors } = validateFormSchema(
    schema,
    opts.registry ? { registry: opts.registry } : {}
  );
  const result: ValidateResult = { valid, errors: errors ?? [] };
  bySchema.set(registryKey, result);
  return result;
}

/** Ошибка валидации схемы — отдельный тип, чтобы отличать её от сетевых и preflight-отказов. */
export class SchemaInvalidError extends Error {
  constructor(
    readonly entryKey: string,
    readonly errors: string[]
  ) {
    super(`[form-registry] ${entryKey}: схема не прошла валидацию:\n  ${errors.join('\n  ')}`);
    this.name = 'SchemaInvalidError';
  }
}

/**
 * Валидирует и бросает при неудаче. Удобно как `onSchemaLoaded`-хук загрузчика.
 *
 * @throws {SchemaInvalidError}
 */
export function assertSchemaValid(
  entryKey: string,
  schema: JsonFormSchema,
  opts: ValidateOptions = {}
): void {
  const { valid, errors } = validateSchemaCached(schema, opts);
  if (!valid) throw new SchemaInvalidError(entryKey, errors);
}

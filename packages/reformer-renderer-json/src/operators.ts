/**
 * Операторы JSON-схемы (M1) — СТРОКОВЫЕ ссылки на модель/реестр.
 *
 * JSON нельзя «вызвать функцию», поэтому привязки кодируются СТРОКАМИ функц-стиля с дискриминатором:
 *
 * - `"$model(path)"`        — путь к полю/массиву модели: лист → `model.signalAt(path)`, массив → `model.<path>`.
 * - `"$component(Name)"`    — имя компонента в реестре (`reg.field`/`reg.container`).
 * - `"$dataSource(NAME)"`   — имя registry-source (`reg.source`): options/itemLabel/константы/loading-компоненты.
 *
 * Схема остаётся чистым JSON (копируется в `.json`, приходит строкой с сервера). Типобезопасность
 * на этапе компиляции даётся template-literal типами ({@link ModelOp} и т.д.) — литерал
 * `'$model(loanType)'` проверяется без вызова функций. Голые строки (не-`$`, напр. `label`) не резолвятся.
 *
 * @module reformer/renderer-json/operators
 */

/** Строка-оператор привязки к полю/массиву модели: `` `$model(${path})` ``. */
export type ModelOp = `$model(${string})`;

/** Строка-оператор ссылки на компонент реестра: `` `$component(${name})` ``. */
export type ComponentOp = `$component(${string})`;

/** Строка-оператор ссылки на registry-source: `` `$dataSource(${name})` ``. */
export type DataSourceOp = `$dataSource(${string})`;

/** Любой строковый оператор JSON-схемы. */
export type JsonOperator = ModelOp | ComponentOp | DataSourceOp;

/** Разобранный оператор: тип + аргумент (путь/имя). */
export interface ParsedOperator {
  op: 'model' | 'component' | 'dataSource';
  arg: string;
}

const OPERATOR_RE = /^\$(model|component|dataSource)\((.+)\)$/;

/**
 * Разбор строки-оператора `"$op(arg)"`. Возвращает `null` для не-операторов (обычных строк),
 * чтобы вызывающий оставил значение как есть.
 *
 * @param value - Проверяемое значение (не-строки сразу дают `null`).
 * @returns {@link ParsedOperator} (`{ op, arg }`) либо `null`, если строка — не оператор.
 *
 * @example
 * ```ts
 * parseOperator('$model(loanType)');   // { op: 'model', arg: 'loanType' }
 * parseOperator('$dataSource(LOAN_TYPES)'); // { op: 'dataSource', arg: 'LOAN_TYPES' }
 * parseOperator('Введите сумму');       // null  (обычная строка)
 * ```
 */
export function parseOperator(value: unknown): ParsedOperator | null {
  if (typeof value !== 'string') return null;
  const m = OPERATOR_RE.exec(value);
  return m ? { op: m[1] as ParsedOperator['op'], arg: m[2] } : null;
}

/**
 * Type-guard: строка — оператор `"$model(...)"` (привязка к полю/массиву модели).
 *
 * @param v - Проверяемое значение.
 * @returns `true`, если `v` — {@link ModelOp}.
 *
 * @example Сузить тип значения prop до ModelOp
 * ```ts
 * if (isModelOp(value)) {
 *   const path = parseOperator(value)!.arg; // 'loanType'
 * }
 * ```
 */
export const isModelOp = (v: unknown): v is ModelOp => parseOperator(v)?.op === 'model';

/**
 * Type-guard: строка — оператор `"$component(...)"` (ссылка на компонент реестра).
 *
 * @param v - Проверяемое значение.
 * @returns `true`, если `v` — {@link ComponentOp}.
 *
 * @example
 * ```ts
 * if (isComponentOp(node.component)) {
 *   const name = parseOperator(node.component)!.arg; // 'Select'
 * }
 * ```
 */
export const isComponentOp = (v: unknown): v is ComponentOp => parseOperator(v)?.op === 'component';

/**
 * Type-guard: строка — оператор `"$dataSource(...)"` (ссылка на registry-source).
 *
 * @param v - Проверяемое значение.
 * @returns `true`, если `v` — {@link DataSourceOp}.
 *
 * @example
 * ```ts
 * if (isDataSourceOp(props.options)) {
 *   const name = parseOperator(props.options)!.arg; // 'LOAN_TYPES'
 * }
 * ```
 */
export const isDataSourceOp = (v: unknown): v is DataSourceOp =>
  parseOperator(v)?.op === 'dataSource';

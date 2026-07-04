/**
 * Чистая логика буферизации ввода для числового `<input>` ({@link Input} c `type="number"`).
 *
 * Проблема, которую решает буфер: контролируемый числовой input, чьё
 * отображение выводится напрямую из `number.toString()`, теряет промежуточные
 * и неканонические состояния ввода. Пока пользователь набирает, `Number(...)`
 * канонизирует строку, а `toString()` схлопывает хвостовые нули и точку:
 *
 * - `"1.50"` → `Number` `1.5` → `toString()` `"1.5"` (хвостовой ноль пропал);
 * - `"1."`  → `Number` `1`   → `toString()` `"1"`   (точку не удержать);
 * - `"0.05"`→ промежуточные `"0."`, `"0.0"` схлопываются в `"0"`;
 * - `"-"`   → `Number` `NaN` → эмита нет, поле «прыгает» назад.
 *
 * Модуль хранит сырую строку и отдаёт её на отображение, пока она согласована
 * с текущим `props.value`, а во `onChange` эмитит только распарсенное число.
 * Логика вынесена отдельно от React-компонента, чтобы её можно было покрыть
 * unit-тестами без DOM.
 */

/** Результат разбора сырой строки числового поля. */
export type NumberParse =
  /** Пустая строка — во `onChange` уходит `null`. */
  | { kind: 'empty' }
  /** Незавершённый ввод (`"-"`, `"."`, `"1e"`) — `NaN`, эмитить нельзя. */
  | { kind: 'partial' }
  /** Валидное число. */
  | { kind: 'number'; value: number };

/**
 * Разбирает сырую строку из числового `<input>` так же, как её увидел бы
 * `onChange`: пустая строка → `empty`, `NaN` (частичный ввод) → `partial`,
 * иначе → `number`.
 */
export function parseNumberInput(raw: string): NumberParse {
  if (raw === '') return { kind: 'empty' };
  const num = Number(raw);
  if (Number.isNaN(num)) return { kind: 'partial' };
  return { kind: 'number', value: num };
}

/** Результат {@link resolveEmittedNumber}: эмитить ли значение и какое. */
export type NumberEmit = { emit: true; value: number | null } | { emit: false };

/**
 * Вычисляет, что нужно передать во `onChange` для сырой строки, с учётом
 * зажима отрицательных к `0` при `min >= 0`. Частичный ввод не эмитится
 * (`emit: false`), так что поле не откатывается на каждой промежуточной клавише.
 *
 * @param raw Текущее строковое значение `<input>`.
 * @param min Значение атрибута `min` (число) или `undefined`, если не задан.
 */
export function resolveEmittedNumber(raw: string, min: number | undefined): NumberEmit {
  const parsed = parseNumberInput(raw);
  if (parsed.kind === 'empty') return { emit: true, value: null };
  if (parsed.kind === 'partial') return { emit: false };
  let value = parsed.value;
  if (min !== undefined && min >= 0 && value < 0) value = 0;
  return { emit: true, value };
}

/**
 * Вычисляет строку для отображения в контролируемом числовом `<input>`.
 *
 * Если локальный сырой буфер согласован с текущим `value` — возвращает буфер,
 * сохраняя неканоническое форматирование (`"1.50"`, `"1."`, ведущие нули) и
 * промежуточный частичный ввод (`"-"`, `"."`, `"1e"`). Иначе возвращает
 * каноническое `value.toString()`, чтобы внешнее изменение `value` (reset,
 * пересчёт другого поля) всегда выигрывало у устаревшего буфера.
 *
 * @param rawBuffer Последняя сырая строка из `onChange`, или `null`, если поле
 *   ещё не редактировалось локально.
 * @param value Текущее контролируемое значение (уже зажатое к `0`, если был `min`).
 */
export function deriveNumberDisplay(
  rawBuffer: string | null,
  value: number | null | undefined
): string {
  if (rawBuffer !== null) {
    if (rawBuffer === '') {
      // Пустой буфер согласован только с пустым значением; иначе показываем
      // пришедшее извне значение.
      if (value === null || value === undefined) return '';
    } else {
      const parsed = parseNumberInput(rawBuffer);
      // Частичный ввод («-», «.», «1e») держим как есть — его нельзя выразить
      // числом, и внешнее value его не «канонизирует».
      if (parsed.kind === 'partial') return rawBuffer;
      // Полное число: показываем сырой буфер, только если он парсится ровно в
      // текущее value (тогда «1.50» переживает round-trip через value 1.5).
      if (
        parsed.kind === 'number' &&
        typeof value === 'number' &&
        !Number.isNaN(value) &&
        parsed.value === value
      ) {
        return rawBuffer;
      }
    }
  }

  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isNaN(value)) return '';
  return value.toString();
}

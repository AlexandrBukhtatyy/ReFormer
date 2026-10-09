/**
 * Единая точка владения реактивным рантаймом @preact/signals-core.
 *
 * Другие @reformer/* пакеты (например renderer-react) импортируют Signal и примитивы
 * ОТСЮДА (`@reformer/core/signals`), а НЕ напрямую из `@preact/signals-core`. Так
 * гарантируется одна копия рантайма: эффекты, `batch` и граф зависимостей общие для всех пакетов.
 *
 * Сигнал узнают по метке ({@link isSignal}), а не по классу: проверка `value instanceof Signal`
 * зависит от того, какая копия рантайма создала значение.
 *
 * @module signals
 */

import type { ReadonlySignal } from '@preact/signals-core';

export { signal, computed, effect, batch, untracked, Signal } from '@preact/signals-core';
export type { ReadonlySignal } from '@preact/signals-core';

/** Метка, которую `@preact/signals-core` ставит на прототип сигнала. */
const SIGNAL_BRAND = Symbol.for('preact-signals');

/**
 * Значение — сигнал: результат `signal()` или `computed()`, в том числе созданный другой копией
 * рантайма.
 *
 * Контейнерные узлы дерева `model.$` (группа, массив) тоже проходят проверку: это сигналы
 * агрегированного значения. Лист от контейнера отличает `isModelContainerSignal`, а ручку, к
 * которой можно привязать поле, — `isValueSignal` (оба — из `@reformer/core`).
 *
 * @example
 * ```typescript
 * isSignal(signal(1)); // true
 * isSignal(computed(() => 1)); // true
 * isSignal({ value: 1 }); // false
 * ```
 */
export function isSignal(value: unknown): value is ReadonlySignal<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { brand?: unknown }).brand === SIGNAL_BRAND
  );
}

/**
 * Единая точка владения реактивным рантаймом @preact/signals-core.
 *
 * Другие @reformer/* пакеты (например renderer-react) импортируют Signal и примитивы
 * ОТСЮДА (`@reformer/core/signals`), а НЕ напрямую из `@preact/signals-core`. Так
 * гарантируется одна копия рантайма и единая идентичность класса `Signal` через границы
 * пакетов — это критично для проверок вида `value instanceof Signal` над сигналами,
 * созданными внутри @reformer/core.
 *
 * @module reformer/signals
 */

export { signal, computed, effect, batch, untracked, Signal } from '@preact/signals-core';
export type { ReadonlySignal } from '@preact/signals-core';

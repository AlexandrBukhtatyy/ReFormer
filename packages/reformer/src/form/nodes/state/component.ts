/**
 * Состояние компонента поля: пропсы из узла схемы и правки поверх них.
 *
 * Пропс-сигнал вне модели отдаётся значением, и реактивно: справочник, загруженный один раз
 * (`signal<Option[]>`), кладут в `componentProps` шаблона строки массива — каждая строка, в том
 * числе добавленная позже, читает тот же сигнал, а его смена доходит до всех. Ручка модели
 * (`model.$.x`, `model.$.group`) — привязка, а не значение: она доходит до компонента как есть.
 *
 * @internal
 * @module form/nodes/state/component
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';
import { isSignal } from '../../../signals';
import { leafOfSignal } from '../../../model/model-nodes';
import { isModelContainerSignal } from '../../../model/model-signals-proxy';

export interface ComponentState {
  readonly props: ReadonlySignal<Readonly<Record<string, unknown>>>;
  update(patch: Record<string, unknown>): void;
}

/** Сигнал вне модели: ручка `model.$` — привязка, её компонент получает как есть. */
const isOuterSignal = (value: unknown): value is ReadonlySignal<unknown> =>
  isSignal(value) && !isModelContainerSignal(value) && leafOfSignal(value) === undefined;

/** Пропсы со значениями сигналов на месте самих сигналов; без сигналов — тот же объект. */
function unwrapSignals(raw: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  let out: Record<string, unknown> | undefined;
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (!isOuterSignal(value)) continue;
    out ??= { ...raw };
    out[key] = value.value;
  }
  return out ?? raw;
}

export function createComponentState(initial: Record<string, unknown> = {}): ComponentState {
  const props = signal<Readonly<Record<string, unknown>>>(initial);
  return {
    props: computed(() => unwrapSignals(props.value)),
    update: (patch) => {
      props.value = { ...props.peek(), ...patch };
    },
  };
}

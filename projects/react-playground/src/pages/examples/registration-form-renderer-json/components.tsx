/**
 * Реактивные компоненты примера — то, что нельзя выразить ни JSON-узлом, ни render-behavior'ом.
 *
 * `PendingButton` — кнопка, которая сама подписана на сигнал «идёт отправка» и блокируется на его
 * время (как `disabled={pending}` в исходной форме). Через JSON так не сделать: `Button` не читает
 * сигналы, а `renderEffect` + `patchProps` для disabled даёт «Cycle detected» — эффект пишет в
 * версионный сигнал ноды, который сам же читает при мерже пропсов. Поэтому реактивность инкапсулируем
 * в компоненте, а в схеме он выглядит обычным `$component(Button)`.
 *
 * Важно: `pending` — сигнал ОТПРАВКИ формы, а не загрузки префилла. Статус `AsyncBoundary`
 * (`prefill-boundary`) отражает загрузку данных приглашения и к моменту показа кнопок уже `ready`,
 * поэтому для этой блокировки он не годится — это разные асинхронные процессы.
 */

import { useSyncExternalStore, type ComponentProps, type ReactElement } from 'react';
import type { Signal } from '@reformer/core/signals';
import { Button } from '@reformer/ui-kit';

/** Подписка React-компонента на одиночный сигнал (preact `signal.subscribe` → `useSyncExternalStore`). */
function useSignalValue<T>(sig: Signal<T>): T {
  return useSyncExternalStore(
    (onChange) => sig.subscribe(() => onChange()),
    () => sig.value,
    () => sig.value
  );
}

/**
 * Фабрика кнопки, блокирующейся на время `pending`. Замыкает сигнал при сборке реестра — как и
 * обработчики: реестр строится до формы, а `pending` создаётся вместе с ним ({@link createFormUiState}).
 */
export function createPendingButton(
  pending: Signal<boolean>
): (props: ComponentProps<typeof Button>) => ReactElement {
  return function PendingButton({ disabled, ...props }: ComponentProps<typeof Button>) {
    const isPending = useSignalValue(pending);
    // Собственный disabled узла (если появится) остаётся в силе — pending лишь добавляет блокировку.
    return <Button {...props} disabled={isPending || disabled} />;
  };
}

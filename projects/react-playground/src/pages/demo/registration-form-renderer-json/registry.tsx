/**
 * Реестр формы регистрации: только то, что JSON выразить не может.
 *
 * Реестр — чистый словарь «что рендерить»: компоненты полей, контейнер состояний загрузки, панель
 * состояния формы, кнопка `PendingButton` и один источник данных (живой текст статуса). Вёрстка
 * (заголовки, колонки, сетки, подсказки) описана `$html(...)`-узлами в схеме. Обработчики событий
 * (submit/reset/load/onSuccess) — это поведение, они висят через `onComponentEvent` в render-behavior
 * (form-setup.ts), а не регистрируются здесь: ни одного `reg.fn`.
 */

import { useSyncExternalStore, type ComponentProps, type ReactElement } from 'react';
import { computed, type Signal } from '@reformer/core/signals';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import {
  InputField,
  InputPasswordField,
  InputMaskField,
  CheckboxField,
  FormField,
  Button,
  AsyncBoundary,
} from '@reformer/ui-kit';
import { FormStateDisplay } from '../registration-form/FormSateDisplay';

/**
 * UI-состояние отправки. Живёт в сигналах, а не в `useState` и не в модели данных:
 * из useState его не достать в JSON-схему, а поле модели уехало бы в тело запроса
 * и обнулялось бы вместе с формой на `model.reset()`.
 */
export interface FormUiState {
  status: Signal<string | null>;
  pending: Signal<boolean>;
}

/** Подписка React-компонента на одиночный сигнал (preact `signal.subscribe` → `useSyncExternalStore`). */
function useSignalValue<T>(sig: Signal<T>): T {
  return useSyncExternalStore(
    (onChange) => sig.subscribe(() => onChange()),
    () => sig.value,
    () => sig.value
  );
}

/**
 * Кнопка, блокирующаяся на время отправки. Реактивность инкапсулирована здесь: `Button` сигналы
 * не читает, а `renderEffect` + `patchProps` для disabled даёт «Cycle detected» (эффект пишет в
 * версионный сигнал ноды, который сам же читает при мерже). В схеме выглядит обычным
 * `$component(Button)`. `pending` — сигнал ОТПРАВКИ формы, не загрузки префилла (та к моменту
 * показа кнопок уже завершена).
 */
function createPendingButton(
  pending: Signal<boolean>
): (props: ComponentProps<typeof Button>) => ReactElement {
  return function PendingButton({ disabled, ...props }: ComponentProps<typeof Button>) {
    const isPending = useSignalValue(pending);
    // Собственный disabled узла (если появится) остаётся в силе — pending лишь добавляет блокировку.
    return <Button {...props} disabled={isPending || disabled} />;
  };
}

export function createRegistrationRegistry(ui: FormUiState): ComponentRegistry {
  // computed — тоже Signal, поэтому текстовый узел схемы подписывается на него как на обычный
  // сигнал модели и перерисовывает только сам текст.
  const statusText = computed(() => (ui.pending.value ? 'Проверка…' : (ui.status.value ?? '')));

  return defineRegistry((reg) => {
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
    reg.component('InputPassword', InputPasswordField);
    reg.component('InputMask', InputMaskField);
    reg.component('Checkbox', CheckboxField);
    // Кнопки формы блокируются на время отправки (см. createPendingButton).
    reg.component('Button', createPendingButton(ui.pending));

    // Контейнер состояний загрузки. Регистрируется ССЫЛКОЙ на импорт: инлайн-обёртка
    // (`(p) => <AsyncBoundary {...p} />`) давала бы новый тип компонента на каждый рендер —
    // React ремонтировал бы его, загрузка стартовала бы заново по кругу.
    reg.component('AsyncBoundary', AsyncBoundary);

    // Панель состояния: `form` приходит не отсюда, а из render-behavior (patchProps) —
    // JSON рантайм-сущности не выражает.
    reg.component('FormStateDisplay', FormStateDisplay);

    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);

    // Живой текст статуса отправки. Обработчики (submit/reset/loadPrefill/applyPrefill) в реестре
    // НЕ регистрируются: события — это поведение, они висят через onComponentEvent в render-behavior
    // (form-setup.ts). Реестр остаётся чистым словарём: компоненты + этот источник данных.
    reg.dataSource('SUBMIT_STATUS', statusText);
  });
}

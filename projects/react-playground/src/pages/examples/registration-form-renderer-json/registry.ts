/**
 * Реестр формы регистрации: только то, что JSON выразить не может.
 *
 * Вёрстка (заголовки, колонки, сетки, блок подсказок) в реестр НЕ попадает — она описана
 * `$html(...)`-узлами прямо в схеме. Здесь остаются компоненты полей, контейнер состояний
 * загрузки, панель состояния формы, обработчики и UI-сигналы.
 */

import { signal, computed, type Signal, type ReadonlySignal } from '@reformer/core/signals';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import {
  InputField,
  InputPasswordField,
  InputMaskField,
  CheckboxField,
  FormField,
  AsyncBoundary,
} from '@reformer/ui-kit';
import { FormStateDisplay } from '../registration-form/FormSateDisplay';
import { createPendingButton } from './components';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';

// Код приглашения, по которому грузится префилл. Локальный: mock (mocks/data/users.ts) держит
// свой список приглашений независимо — это разные слои (клиент знает свой код, сервер — свои
// записи), поэтому общей константы между ними намеренно нет. Любой код кроме 'RF-2026' даст
// 404 → в примере видно состояние ошибки AsyncBoundary с кнопкой «Повторить».
const INVITE_CODE = 'RF-2026';

/**
 * Обработчики и эффекты, которых нет в JSON. Отдельный объект нужен из-за порядка построения:
 * реестр требуется для `convertJsonToM1Tree`, а форма создаётся уже ПОСЛЕ него. Реестр замыкает
 * сам объект (`() => actions.submit()`), поэтому поля дозаполняются позже — иначе реестр
 * пришлось бы строить дважды.
 */
export interface FormActions {
  submit: () => void;
  reset: () => void;
  applyPrefill: (data: Partial<RegistrationFormData>) => void;
}

/**
 * UI-состояние отправки. Живёт в сигналах, а не в `useState` и не в модели данных:
 * из useState его не достать в JSON-схему, а поле модели уехало бы в тело запроса
 * и обнулялось бы вместе с формой на `model.reset()`.
 */
export interface FormUiState {
  status: Signal<string | null>;
  pending: Signal<boolean>;
}

export function createFormUiState(): FormUiState {
  return { status: signal<string | null>(null), pending: signal(false) };
}

export function createRegistrationRegistry(
  actions: FormActions,
  ui: FormUiState
): ComponentRegistry {
  // computed — тоже Signal, поэтому текстовый узел схемы подписывается на него как на обычный
  // сигнал модели и перерисовывает только сам текст.
  const statusText: ReadonlySignal<string> = computed(() =>
    ui.pending.value ? 'Проверка…' : (ui.status.value ?? '')
  );

  return defineRegistry((reg) => {
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
    reg.component('InputPassword', InputPasswordField);
    reg.component('InputMask', InputMaskField);
    reg.component('Checkbox', CheckboxField);
    // Кнопки формы блокируются на время отправки — реактивность инкапсулирована в компоненте
    // (Button сигналы не читает, а renderEffect+patchProps для disabled даёт цикл).
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

    // Загрузка префилла: AsyncBoundary в self-managed режиме сам ведёт статус и повтор.
    // `signal` из пропса прокидывается в fetch, чтобы отменённый запрос не висел в сети.
    reg.fn('loadPrefill', async (abortSignal: AbortSignal) => {
      const response = await fetch(
        `/api/v1/auth/registration-prefill?invite=${encodeURIComponent(INVITE_CODE)}`,
        { signal: abortSignal }
      );
      // 404 приходит с пустым телом — без этой проверки `.json()` упал бы SyntaxError,
      // и в блоке ошибки вместо человеческого текста оказался бы разбор JSON.
      if (!response.ok) throw new Error('Приглашение не найдено или больше не действует');
      return (await response.json()) as Partial<RegistrationFormData>;
    });
    reg.fn('applyPrefill', (data: Partial<RegistrationFormData>) => actions.applyPrefill(data));

    // Кнопки формы.
    reg.fn('submit', () => actions.submit());
    reg.fn('reset', () => actions.reset());

    // Живой текст статуса отправки.
    reg.dataSource('SUBMIT_STATUS', statusText);
  });
}

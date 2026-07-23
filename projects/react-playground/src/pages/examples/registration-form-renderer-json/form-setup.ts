/**
 * Сборка формы: модель, форма из JSON-схемы, реестр, обработчики, поведение, render-behavior.
 *
 * Вынесено из компонента, чтобы в TSX остались только `JsonRendererProvider` и
 * `JsonFormRenderer`. Здесь нет ни одного React-хука — это чистая функция сборки,
 * которую компонент вызывает один раз в `useMemo`.
 */

import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';
import { signal } from '@reformer/core/signals';
import { convertJsonToM1Tree, type JsonFormSchema } from '@reformer/renderer-json';
import { onInit, onComponentEvent, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { makeRegistrationValidator } from './validation';
import { createRegistrationRegistry, type FormUiState } from './registry';
import rawJsonSchema from './json-schema.json';

// Операторы в чистом JSON типизируются как `string`, поэтому приведение — это и есть
// сценарий «схема пришла строкой с сервера».
export const registrationJsonSchema = rawJsonSchema as unknown as JsonFormSchema;

// Код приглашения, по которому грузится префилл. Локальный: mock (mocks/data/users.ts) держит свой
// список приглашений независимо — разные слои (клиент знает свой код, сервер — свои записи). Любой
// код кроме 'RF-2026' даст 404 → в примере видно состояние ошибки AsyncBoundary с «Повторить».
const INVITE_CODE = 'RF-2026';

const INITIAL: RegistrationFormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  phone: '',
  captcha: '',
  acceptTerms: false,
};

/**
 * Реактивность ДАННЫХ (`createForm({ behavior })`): реагирует на изменения модели немедленно,
 * в отличие от валидации (только на submit). Здесь один сценарий — снятие устаревшей ошибки
 * «Пароли не совпадают»: `passwordsMatch` роутит её в ноду `confirmPassword` на submit, а правка
 * первого пароля делает вердикт неактуальным, поэтому ошибку убираем сразу.
 */
const registrationBehavior = defineFormBehavior<RegistrationFormData>(({ model, form }) => {
  onChange(model.$.password, () => {
    form.confirmPassword.clearErrors();
  });
});

/**
 * Собирает всё, что нужно рендереру. Вызывается один раз (в `useMemo`) — повторный вызов создал бы
 * новый реестр и новый тип компонента `AsyncBoundary`, из-за чего загрузка префилла стартовала бы
 * заново.
 *
 * Сборка линейна: реестр больше НЕ замыкает обработчики (события висят через `onComponentEvent`),
 * поэтому цикла `registry → actions → form` нет, и `submit`/`reset`/`loadPrefill`/`applyPrefill`
 * определяются обычными `const` уже после `form`. Обработчики реализуют канонический submit-флоу:
 * валидация → снимок → запрос → `reset` только после успеха (ошибки валидации сами доезжают до нод,
 * UI подсвечивает поля).
 */
export function createRegistrationSetup() {
  const ui: FormUiState = { status: signal<string | null>(null), pending: signal(false) };
  const registry = createRegistrationRegistry(ui);
  const model = createModel<RegistrationFormData>({ ...INITIAL });
  const form = createForm<RegistrationFormData>({
    model,
    schema: convertJsonToM1Tree(registrationJsonSchema, registry, model),
    behavior: registrationBehavior,
  });
  const validate = makeRegistrationValidator(model);

  const submit = async (): Promise<void> => {
    if (ui.pending.value) return; // повторный клик во время запроса игнорируем
    form.markAsTouched();
    ui.status.value = null;
    ui.pending.value = true;
    try {
      const valid = await validate();
      if (!valid) {
        ui.status.value = 'Проверьте выделенные поля';
        return;
      }
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model.get()),
      });
      const json = (await response.json()) as {
        success: boolean;
        userId?: string;
        message: string;
      };
      if (json.success) {
        ui.status.value = `Регистрация успешна. User ID: ${json.userId}`;
        model.reset();
      } else {
        ui.status.value = `Ошибка: ${json.message}`;
      }
    } catch (error) {
      ui.status.value = `Ошибка сети: ${String(error)}`;
    } finally {
      ui.pending.value = false;
    }
  };

  const reset = (): void => {
    // Тот же guard, что у submit: пока POST /register в полёте, «Очистить» — no-op. Иначе хвост
    // submit'а (ui.status = «успешно» + повторный model.reset) перетёр бы результат сброса.
    if (ui.pending.value) return;
    // Значения принадлежат модели, форма держит UI-состояние — чистим их порознь. `form.reset()`
    // здесь неверен: он вернул бы НОДЫ к пустому initial и затёр восстановленный моделью префилл.
    model.reset();
    form.clearErrors();
    form.markAsUntouched();
    ui.status.value = null;
  };

  // Загрузка префилла (self-managed AsyncBoundary сам ведёт статус и повтор). `signal` из пропса
  // прокидывается в fetch, чтобы отменённый запрос не висел в сети.
  const loadPrefill = async (abortSignal: AbortSignal): Promise<Partial<RegistrationFormData>> => {
    const response = await fetch(
      `/api/v1/auth/registration-prefill?invite=${encodeURIComponent(INVITE_CODE)}`,
      { signal: abortSignal }
    );
    // 404 приходит с пустым телом — без этой проверки `.json()` упал бы SyntaxError, и в блоке
    // ошибки вместо человеческого текста оказался бы разбор JSON.
    if (!response.ok) throw new Error('Приглашение не найдено или больше не действует');
    return (await response.json()) as Partial<RegistrationFormData>;
  };

  const applyPrefill = (data: Partial<RegistrationFormData>): void => {
    model.patch(data);
    // Загруженные данные становятся новой точкой отсчёта, иначе «Очистить» (model.reset()) вернул бы
    // форму к пустому initial-снимку и стёр префилл, которого пользователь не вводил.
    model.captureInitial();
  };

  /**
   * Render-behavior: инъекция рантайм-сущностей и обработчиков в узлы схемы. JSON выразить их не
   * может, поэтому:
   * - `onInit` + `patchProps` доносит `FormProxy` до панели состояния (build-time, до первого рендера;
   *   узел `form-state` — контейнер с `selector`, без `value`);
   * - `onComponentEvent` вешает обработчики на события компонентов по `selector` — вместо `$fn` в
   *   componentProps. `load`/`onSuccess` долетают до AsyncBoundary с первого рендера (render-behavior
   *   применяется до построения дерева), поэтому self-managed режим включается сразу.
   */
  const renderBehavior: RenderBehaviorFn<RegistrationFormData> = (schema) => {
    onInit(schema.node('form-state'), () => {
      schema.node('form-state').patchProps({ form });
    });
    onComponentEvent(schema.node('submit-button'), 'onClick', submit);
    onComponentEvent(schema.node('reset-button'), 'onClick', reset);
    onComponentEvent(schema.node('prefill-boundary'), 'load', loadPrefill);
    onComponentEvent(schema.node('prefill-boundary'), 'onSuccess', applyPrefill);
  };

  return { model, registry, renderBehavior };
}

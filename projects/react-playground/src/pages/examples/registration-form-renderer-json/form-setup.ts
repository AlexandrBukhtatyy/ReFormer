/**
 * Сборка формы: модель, форма из JSON-схемы, реестр, обработчики, render-behavior.
 *
 * Вынесено из компонента, чтобы в TSX остались только `JsonRendererProvider` и
 * `JsonFormRenderer`. Здесь нет ни одного React-хука — это чистая функция сборки,
 * которую компонент вызывает один раз в `useMemo`.
 */

import { createModel, createForm, validateFormModel, type FormProxy } from '@reformer/core';
import {
  convertJsonToM1Tree,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { RenderBehaviorFn } from '@reformer/renderer-react';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { buildValidationSchema } from './validation';
import {
  createFormUiState,
  createRegistrationRegistry,
  type FormActions,
  type FormUiState,
} from './registry';
import { createRegistrationRenderBehavior } from './render-behavior';
import { registrationBehavior } from './behavior';
import rawJsonSchema from './json-schema.json';

// Операторы в чистом JSON типизируются как `string`, поэтому приведение — это и есть
// сценарий «схема пришла строкой с сервера».
export const registrationJsonSchema = rawJsonSchema as unknown as JsonFormSchema;

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

export interface RegistrationSetup {
  model: ReturnType<typeof createModel<RegistrationFormData>>;
  form: FormProxy<RegistrationFormData>;
  registry: ComponentRegistry;
  renderBehavior: RenderBehaviorFn<RegistrationFormData>;
  ui: FormUiState;
}

/**
 * Канонический submit-флоу: полная валидация данных → снимок → запрос → `reset` только
 * после успеха. Ошибки валидации сами доезжают до нод формы, поэтому UI подсвечивает поля
 * без единой строчки здесь.
 */
function bindActions(
  actions: FormActions,
  setup: Pick<RegistrationSetup, 'model' | 'form' | 'ui'>
): void {
  const { model, form, ui } = setup;
  const validationSchema = buildValidationSchema(model);

  actions.submit = async () => {
    if (ui.pending.value) return; // повторный клик во время запроса игнорируем
    form.markAsTouched();
    ui.status.value = null;
    ui.pending.value = true;
    try {
      const result = await validateFormModel(model, validationSchema);
      if (!result.valid) {
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

  actions.reset = () => {
    // Тот же guard, что у submit: пока POST /register в полёте, «Очистить» — no-op. Иначе хвост
    // submit'а (ui.status = «успешно» + повторный model.reset) перетёр бы результат сброса, и
    // пользователь увидел бы баннер успеха вместо очищенной формы.
    if (ui.pending.value) return;
    // Значения принадлежат модели, форма держит UI-состояние — поэтому чистим их порознь.
    // `form.reset()` здесь был бы неверен: он возвращает НОДЫ к их собственному initial
    // (пустому, снятому при createForm) и затирает восстановленный моделью префилл.
    model.reset();
    form.clearErrors();
    form.markAsUntouched();
    ui.status.value = null;
  };

  // Префилл по приглашению: AsyncBoundary отдаёт загруженные данные в `onSuccess`.
  actions.applyPrefill = (data) => {
    model.patch(data);
    // Загруженные данные становятся новой точкой отсчёта, иначе «Очистить» (model.reset())
    // вернул бы форму к пустому initial-снимку и стёр префилл, которого пользователь не вводил.
    model.captureInitial();
  };
}

/**
 * Собирает всё, что нужно рендереру. Вызывается один раз (в `useMemo`) — повторный вызов
 * создал бы новый реестр и новый тип компонента `AsyncBoundary`, из-за чего загрузка
 * префилла стартовала бы заново.
 */
export function createRegistrationSetup(): RegistrationSetup {
  // Пустые заглушки: реестр замыкает объект, поля дозаполняются после createForm — см. FormActions.
  const actions: FormActions = {
    submit: () => {},
    reset: () => {},
    applyPrefill: () => {},
  };
  const ui = createFormUiState();
  const registry = createRegistrationRegistry(actions, ui);
  const model = createModel<RegistrationFormData>({ ...INITIAL });
  // M1: форма строится из ТОЙ ЖЕ JSON-схемы, что рендерится. `behavior` — реактивность данных
  // (снимает устаревшую ошибку подтверждения пароля), исполняется внутри createForm.
  const form = createForm<RegistrationFormData>({
    model,
    schema: convertJsonToM1Tree(registrationJsonSchema, registry, model),
    behavior: registrationBehavior,
  });

  bindActions(actions, { model, form, ui });

  return {
    model,
    form,
    registry,
    renderBehavior: createRegistrationRenderBehavior(form),
    ui,
  };
}

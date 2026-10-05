/**
 * Поведение формы регистрации — единственное: реактивность данных, обработчики и инъекция
 * рантайм-сущностей в узлы схемы стоят в одном `defineFormBehavior`.
 *
 * Это фабрика от UI-состояния отправки, а не готовое поведение: у прямой сборки (`form-setup.ts`)
 * и у записи реестра форм (`form-entry.ts`) сигналы `ui` свои, а правила — одни.
 *
 * @module react-playground/examples/registration-form-renderer-json/form.behavior
 */

import {
  defineFormBehavior,
  onChange,
  onComponentEvent,
  onInit,
  type FormBehavior,
} from '@reformer/core/behaviors';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { makeRegistrationValidator } from './validation';
import type { FormUiState } from './registry';

// Код приглашения, по которому грузится префилл. Локальный: mock (mocks/data/users.ts) держит свой
// список приглашений независимо — разные слои (клиент знает свой код, сервер — свои записи). Любой
// код кроме 'RF-2026' даст 404 → в примере видно состояние ошибки AsyncBoundary с «Повторить».
const INVITE_CODE = 'RF-2026';

/**
 * Собирает правила формы и вешает обработчики на узлы схемы.
 *
 * **Сбрасывает `ui` первым делом**, и это не перестраховка. У записи реестра `ui` живёт на уровне
 * модуля (реестр компонентов — один экземпляр, а `createPendingButton` порождает ТИП компонента,
 * который нельзя пересоздавать на каждый монтаж). Без сброса «Регистрация успешна…» переезжала бы
 * на свежесмонтированную форму, а размонтаж во время POST оставлял бы `pending: true` — и форма,
 * у которой `submit`/`reset` начинаются с `if (ui.pending.value) return`, залипла бы навсегда.
 *
 * Сброс стоит в теле поведения, а не в `onInit`: сборка `createForm` запускает поведение ровно
 * один раз на конструкцию формы, синхронно, до первого рендера, тогда как `onInit` привязан к
 * жизненному циклу узла и может отработать позже и не единожды.
 *
 * Обработчики реализуют канонический submit-флоу: валидация → снимок → запрос → `reset` только
 * после успеха (ошибки валидации сами доезжают до нод, UI подсвечивает поля).
 */
export function createRegistrationBehavior(ui: FormUiState): FormBehavior<RegistrationFormData> {
  return defineFormBehavior<RegistrationFormData>(({ model, form, schema }) => {
    ui.status.value = null;
    ui.pending.value = false;

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
    const loadPrefill = async (
      abortSignal: AbortSignal
    ): Promise<Partial<RegistrationFormData>> => {
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
      // Загруженные данные становятся новой точкой отсчёта, иначе «Очистить» (model.reset()) вернул
      // бы форму к пустому initial-снимку и стёр префилл, которого пользователь не вводил.
      model.captureInitial();
    };

    // --- Связи над моделью ---------------------------------------------------------------------
    // Реагируют на изменения модели немедленно, в отличие от валидации (только на submit). Здесь
    // один сценарий — снятие устаревшей ошибки «Пароли не совпадают»: `passwordsMatch` роутит её в
    // ноду `confirmPassword` на submit, а правка первого пароля делает вердикт неактуальным.
    onChange(model.$.password, () => {
      form.confirmPassword.clearErrors();
    });

    // --- Правила узлов схемы -------------------------------------------------------------------
    // JSON выразить рантайм-сущности и обработчики не может, поэтому:
    // - `onInit` + `patchProps` доносит `FormProxy` до панели состояния (до первого рендера; узел
    //   `form-state` — контейнер с `selector`, без привязки к модели);
    // - `onComponentEvent` вешает обработчики на события компонентов по `selector` — вместо `$fn` в
    //   componentProps. `load`/`onSuccess` долетают до AsyncBoundary с первого рендера (правила узлов
    //   записаны до построения дерева), поэтому self-managed режим включается сразу.
    onInit(schema.node('form-state'), () => {
      schema.node('form-state').patchProps({ form });
    });
    onComponentEvent(schema.node('submit-button'), 'onClick', submit);
    onComponentEvent(schema.node('reset-button'), 'onClick', reset);
    onComponentEvent(schema.node('prefill-boundary'), 'load', loadPrefill);
    onComponentEvent(schema.node('prefill-boundary'), 'onSuccess', applyPrefill);
  });
}

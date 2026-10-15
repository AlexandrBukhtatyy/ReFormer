/**
 * Отправка формы — `FormSubmission`: проверка перед действием, обработчик со значениями, которые
 * видели правила, и итог объектом со статусом.
 *
 * Модуль не знает ни модели, ни нод, ни реестра «ручка → нода»: проверку и значения он получает
 * зависимостями ({@link SubmissionDependencies}). Сборка формы (`createForm`) отдаёт отправку как
 * `bundle.submission`; визард без сборки строит свою — без проверки.
 *
 * @group Form
 * @module form/submission
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationResult } from './validation/types';

/**
 * Итог отправки: `submitted` — обработчик отработал, `invalid` / `error` / `cancelled` —
 * проверка не пропустила (обработчик не вызывался), `failed` — обработчик бросил исключение.
 *
 * `cancelled` — проверку отправки сменила следующая (вторая отправка, живой прогон) либо модель
 * изменилась, пока проверка шла: правила видели прежние значения, и отправлять новые нельзя.
 * Замечаний такой итог не несёт — отправку повторяют.
 *
 * @group Form
 */
export type SubmitResult<TResult> =
  | { readonly status: 'submitted'; readonly result: TResult }
  | { readonly status: 'invalid' | 'error' | 'cancelled'; readonly validation: ValidationResult }
  | { readonly status: 'failed'; readonly error: unknown };

/**
 * Итог проверки для действия по её результату (отправка, переход шага).
 *
 * @group Form
 */
export interface ActionCheck<T> {
  /** Результат проверки. */
  readonly result: ValidationResult;
  /** Значения модели после проверки; при `stale === false` — ровно те, что видели правила. */
  readonly values: T;
  /** Проверка успешна, но модель с тех пор изменилась: её успех относится к прежним значениям. */
  readonly stale: boolean;
}

/**
 * Зависимости отправки. Явные, чтобы модуль не тянул ни модель, ни ноды формы.
 *
 * @group Form
 */
export interface SubmissionDependencies<T> {
  /**
   * Проверка перед отправкой — попытка отправки: замечания раскрыты, при необходимости вся форма
   * тронута. `undefined` — правил нет: обработчик получает {@link SubmissionDependencies.values}.
   */
  readonly check: (() => Promise<ActionCheck<T>>) | undefined;
  /** Значения без проверки. */
  readonly values: () => T;
}

/**
 * Отправка формы.
 *
 * @group Form
 */
export interface FormSubmission<T> {
  /** Идёт ли отправка: работает обработчик. Пока идёт проверка, — `false`. */
  readonly submitting: ReadonlySignal<boolean>;
  /**
   * Отправить: один прогон всех правил; при успехе — обработчик со значениями модели.
   *
   * Обработчик получает ровно те значения, которые видели правила. Пока идёт async-правило,
   * форма не заперта (`submitting` ещё `false`); если модель за это время изменилась — правкой
   * пользователя, загрузкой, записью поведения после таймера или запроса, — итог `cancelled`,
   * обработчик не вызывается.
   *
   * Значения — модель целиком, с выключенными полями: их правила не считаются, но данные
   * принадлежат модели. Убрать их из отправки — забота обработчика либо
   * `enableWhen(…, { resetOnDisable: true })`.
   *
   * Исключение обработчика наружу не выходит: итог `failed` с этим исключением.
   */
  submit<TResult>(
    handler: (values: T) => TResult | Promise<TResult>
  ): Promise<SubmitResult<TResult>>;
}

/**
 * Создать отправку формы.
 *
 * Обычно её создаёт сборка (`createForm` → `bundle.submission`). Прямой вызов нужен там, где
 * сборки нет: визард в разметке без `createForm` отправляет значения формы без проверки.
 *
 * @typeParam T - Форма данных.
 * @param dependencies - {@link SubmissionDependencies}: проверка перед действием и значения.
 * @returns {@link FormSubmission}.
 *
 * @example Без проверки — значения формы как есть
 * ```typescript
 * const submission = createSubmission<Profile>({ check: undefined, values: () => form.getValue() });
 * const outcome = await submission.submit(api.save);
 * if (outcome.status === 'failed') showToast('Не удалось сохранить');
 * ```
 *
 * @group Form
 */
export function createSubmission<T>(dependencies: SubmissionDependencies<T>): FormSubmission<T> {
  const running = signal(0);

  return {
    submitting: computed(() => running.value > 0),

    async submit(handler) {
      // Без проверки `await` всё равно уступает микротаск: правка в том же тике, что и вызов,
      // попадает в значения обработчика.
      const checked = await dependencies.check?.();
      if (checked) {
        const { result } = checked;
        if (result.status !== 'valid') return { status: result.status, validation: result };
        // Модель изменилась, пока шла проверка: эти значения правила не видели — не отправлять.
        if (checked.stale) {
          return { status: 'cancelled', validation: { ...result, status: 'cancelled' } };
        }
      }
      const values = checked ? checked.values : dependencies.values();
      running.value++;
      try {
        return { status: 'submitted', result: await handler(values) };
      } catch (error) {
        return { status: 'failed', error };
      } finally {
        running.value--;
      }
    },
  };
}

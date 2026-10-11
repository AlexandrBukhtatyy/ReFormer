/**
 * Управляемое async-правило валидации: ответы в руках теста, журнал вызовов — значения и
 * `AbortSignal`.
 *
 * Каждый вызов правила ждёт ручного ответа (`deferred` из `test-utils/async`): тест сам решает,
 * когда и чем вызов завершится — замечанием, `null` или отклонением, — и так воспроизводит
 * медленный сервер, сбой и гонки прогонов. Сигнал каждого вызова остаётся в журнале: по нему видно,
 * что раннер отменил устаревший прогон, а не просто проигнорировал его ответ.
 *
 * @module test-utils/async-rules
 */

import type { ValidationIssue } from '../../src/form/types/contracts';
import type { AsyncRule } from '../../src/form/validation/types';
import { deferred, type Deferred } from './async';

/** Управляемое async-правило и журнал его вызовов (по порядку вызовов). */
export interface ControlledAsyncRule<V> {
  /** Правило для `validateAsync`: каждый вызов ждёт ответа теста. */
  readonly rule: AsyncRule<V>;
  /** Ответы вызовов: `resolve(замечание | null)` или `reject(ошибка)`. */
  readonly answers: readonly Deferred<ValidationIssue | null>[];
  /** Сигналы отмены, с которыми раннер вызвал правило. */
  readonly signals: readonly AbortSignal[];
  /** Значения поля, с которыми раннер вызвал правило. */
  readonly values: readonly V[];
}

/**
 * Создать управляемое async-правило.
 *
 * @example
 * ```ts
 * const check = controlledAsyncRule<string>();
 * const rules = defineValidation<Login>(({ model }) => validateAsync(model.$.login, [check.rule]));
 * const first = runValidation(model, rules);
 * const second = runValidation(model, rules);
 * expect(check.signals[0].aborted).toBe(true); // первый прогон устарел
 * check.answers[1].resolve(null);
 * ```
 */
export function controlledAsyncRule<V = unknown>(): ControlledAsyncRule<V> {
  const answers: Deferred<ValidationIssue | null>[] = [];
  const signals: AbortSignal[] = [];
  const values: V[] = [];
  return {
    rule: (value, { signal }) => {
      const answer = deferred<ValidationIssue | null>();
      answers.push(answer);
      signals.push(signal);
      values.push(value);
      return answer.promise;
    },
    answers,
    signals,
    values,
  };
}

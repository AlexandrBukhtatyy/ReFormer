/**
 * Форма «сумма и телефон» для тестов уровня формы и отправки: два шага с правилами и шаг
 * подтверждения без правил, плюс async-правило суммы с ответами, которые выдаёт сам тест.
 */

import { deferred, type Deferred } from '../../test-utils/async';
import { createForm } from '../../../src/form/form-bundle';
import { defineValidation, validate, validateAsync } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';

export interface Shape {
  amount: string;
  phone: string;
}

export const loanRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});
export const contactsRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.phone, [required()]);
});

/** Сборка с потоком: `loan` (сумма обязательна), `contacts` (телефон обязателен), `confirm`. */
export const createShape = (initial: Shape = { amount: '', phone: '' }) =>
  createForm<Shape>({
    initial,
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'contacts', rules: contactsRules },
        { id: 'confirm' },
      ],
    },
  });

/** Правила суммы с async-правилом: ответы тест выдаёт сам, по порядку вызовов. */
export function controlledAmountRules() {
  const answers: Deferred<ValidationIssue | null>[] = [];
  const rules = defineValidation<Shape>(({ model }) => {
    validateAsync(model.$.amount, [
      () => {
        const answer = deferred<ValidationIssue | null>();
        answers.push(answer);
        return answer.promise;
      },
    ]);
  });
  return { answers, rules };
}

/**
 * Формы для тестов китов: документы `@reformer/renderer-json` на именах каталога компонентов
 * (`Input`, `Select`, `FieldArray`, `FormWizard`, …) вместе с моделью, правилами, поведением и
 * потоком шагов. Кит, чей каталог называет компоненты этими именами, обязан нарисовать каждую
 * форму целиком.
 *
 * Файлы форм лежат в `forms/<форма>/` в том виде, в каком их раскладывает форма на JSON-рендерере:
 * `form.schema.json`, `model.ts`, `form.validation.ts`, `form.behavior.ts`, `form.flow.ts`,
 * `form.messages.ts`, `data-sources.ts`.
 */

import * as creditSources from '../forms/credit/data-sources';
import { formBehavior as creditBehavior } from '../forms/credit/form.behavior';
import { formFlow as creditFlow } from '../forms/credit/form.flow';
import { formMessages as creditMessages } from '../forms/credit/form.messages';
import creditDocument from '../forms/credit/form.schema.json';
import { formValidation as creditValidation } from '../forms/credit/form.validation';
import { createFormModel as createCreditModel } from '../forms/credit/model';
import { formBehavior as loanBehavior } from '../forms/loan/form.behavior';
import { formFlow as loanFlow } from '../forms/loan/form.flow';
import loanDocument from '../forms/loan/form.schema.json';
import { formValidation as loanValidation } from '../forms/loan/form.validation';
import { createFormModel as createLoanModel } from '../forms/loan/model';
import { formBehavior as registrationBehavior } from '../forms/registration/form.behavior';
import { formMessages as registrationMessages } from '../forms/registration/form.messages';
import registrationDocument from '../forms/registration/form.schema.json';
import { formValidation as registrationValidation } from '../forms/registration/form.validation';
import { createFormModel as createRegistrationModel } from '../forms/registration/model';

/** Регистрация: плоская форма, поля, флажок, сообщения об ошибках. */
export const registration = {
  document: registrationDocument,
  createModel: createRegistrationModel,
  validation: registrationValidation,
  behavior: registrationBehavior,
  messages: registrationMessages,
} as const;

/** Сокращённая заявка на заём: визард из двух шагов и массив созаёмщиков. */
export const loan = {
  document: loanDocument,
  createModel: createLoanModel,
  validation: loanValidation,
  behavior: loanBehavior,
  flow: loanFlow,
} as const;

/** Кредитная заявка: визард, списки, радиокнопки, массивы, условные поля, источники данных. */
export const credit = {
  document: creditDocument,
  createModel: createCreditModel,
  validation: creditValidation,
  behavior: creditBehavior,
  flow: creditFlow,
  messages: creditMessages,
  sources: creditSources,
} as const;

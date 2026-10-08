/**
 * Правила валидации кредитной заявки как данные — поле `validation` сборки `createForm`.
 *
 * Правила шагов берутся из потока заявки: ключ — `selector` шага, порядок — порядок шагов.
 * Ссылка стабильна на уровне модуля: отмена устаревших прогонов ключуется по паре (модель, схема).
 */

import type { FormValidation } from '@reformer/core';
import { creditApplicationFlow } from '../flow/credit-application-flow';
import type { CreditApplicationForm } from '../types/credit-application';
import { crossStepRules } from './cross-step';

export const creditApplicationValidation: FormValidation<CreditApplicationForm> = {
  steps: Object.fromEntries(creditApplicationFlow.map((step) => [step.selector, step.rules])),
  extras: crossStepRules,
};

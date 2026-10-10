/**
 * Правила валидации кредитной заявки как данные — поле `validation` сборки `createForm`.
 *
 * Здесь — только правила вне шагов (`extras`): они проверяются целиком, при отправке. Правила
 * шагов живут в потоке заявки (`flow/credit-application-flow.ts`) и уходят в сборку полем `flow`.
 * Ссылка стабильна на уровне модуля: отмена устаревших прогонов ключуется по паре (модель, правила).
 */

import type { FormValidation } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { crossStepRules } from './cross-step';

export const creditApplicationValidation: FormValidation<CreditApplicationForm> = {
  extras: crossStepRules,
};

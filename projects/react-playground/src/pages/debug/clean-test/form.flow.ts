/**
 * Поток шагов: идентификатор шага — selector узла шага в схеме, правила — из form.validation.ts.
 */
import type { FormFlowConfig } from '@reformer/core';
import {
  confirmationStepRules,
  historyStepRules,
  insuranceStepRules,
  insuredStepRules,
  objectStepRules,
  peopleStepRules,
} from './form.validation';
import type { InsuranceApplicationForm } from './types';

export const CONFIRMATION_STEP = 'confirmation';

export const formFlow: FormFlowConfig<InsuranceApplicationForm> = {
  steps: [
    { id: 'insurance', rules: insuranceStepRules },
    { id: 'insured', rules: insuredStepRules },
    { id: 'object', rules: objectStepRules },
    { id: 'people', rules: peopleStepRules },
    { id: 'history', rules: historyStepRules },
    { id: CONFIRMATION_STEP, rules: confirmationStepRules },
  ],
};

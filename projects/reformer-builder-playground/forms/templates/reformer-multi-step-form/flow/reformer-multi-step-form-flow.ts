// @reformer-generated 84d37aa57e15
// flow/reformer-multi-step-form-flow.ts — поток шагов визарда: порядок шагов и их правила.
// Регенерируется билдером (шаги берутся из схемы); правки будут перезаписаны.

import type { FormFlowConfig } from '@reformer/core';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';
import { stepRules as dannyeRules } from '../validation/dannye';
import { stepRules as kontaktyRules } from '../validation/kontakty';
import { stepRules as dopolnitelnoRules } from '../validation/dopolnitelno';

/** Поток шагов: `id` — `selector` узла шага в схеме; `next()` проверяет правила текущего шага. */
export const formFlow: FormFlowConfig<ReformerMultiStepForm> = {
  steps: [
    { id: 'personal-step', rules: dannyeRules },
    { id: 'contacts-step', rules: kontaktyRules },
    { id: 'extra-step', rules: dopolnitelnoRules },
  ],
};

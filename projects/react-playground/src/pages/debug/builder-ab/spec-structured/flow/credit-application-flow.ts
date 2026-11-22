// @reformer-generated faa3720c1927
// flow/credit-application-flow.ts — поток шагов визарда: порядок шагов и их правила.
// Регенерируется билдером (шаги берутся из схемы); правки будут перезаписаны.

import type { FormFlowConfig } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { stepRules as osnovnayaInformatsiyaOKrediteRules } from '../validation/osnovnaya-informatsiya-o-kredite';
import { stepRules as personalnyeDannyeRules } from '../validation/personalnye-dannye';
import { stepRules as kontaktnayaInformatsiyaRules } from '../validation/kontaktnaya-informatsiya';
import { stepRules as informatsiyaOZanyatostiRules } from '../validation/informatsiya-o-zanyatosti';
import { stepRules as dopolnitelnayaInformatsiyaRules } from '../validation/dopolnitelnaya-informatsiya';
import { stepRules as podtverzhdenieISoglasiyaRules } from '../validation/podtverzhdenie-i-soglasiya';

/** Поток шагов: `id` — `selector` узла шага в схеме; `next()` проверяет правила текущего шага. */
export const formFlow: FormFlowConfig<CreditApplicationForm> = {
  steps: [
    { id: 'osnovnaya-informatsiya-o-kredite-section', rules: osnovnayaInformatsiyaOKrediteRules },
    { id: 'personalnye-dannye-section', rules: personalnyeDannyeRules },
    { id: 'kontaktnaya-informatsiya-section', rules: kontaktnayaInformatsiyaRules },
    { id: 'informatsiya-o-zanyatosti-section', rules: informatsiyaOZanyatostiRules },
    { id: 'dopolnitelnaya-informatsiya-section', rules: dopolnitelnayaInformatsiyaRules },
    { id: 'podtverzhdenie-i-soglasiya-section', rules: podtverzhdenieISoglasiyaRules },
  ],
};

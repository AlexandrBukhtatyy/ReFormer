/**
 * Поток кредитной заявки — упорядоченный список шагов.
 *
 * Шаг объявлен один раз: идентификатор, заголовок, значок, разметка и правила. Из списка строятся
 * узлы шагов дерева схемы (`schema/form.ts`), правила по шагам (`validation/form.ts`) и шаги
 * визарда в варианте «React руками». Связать разметку одного шага с правилами другого негде.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import type { ValidationSchema } from '@reformer/core/validation';
import type { CreditApplicationForm } from '../types/credit-application';
import { loanStep } from '../schema/steps/loan';
import { applicantStep } from '../schema/steps/applicant';
import { contactsStep } from '../schema/steps/contacts';
import { employmentStep } from '../schema/steps/employment';
import { additionalStep } from '../schema/steps/additional';
import { confirmationStep } from '../schema/steps/confirmation';
import { loanRules } from '../validation/loan';
import { applicantRules } from '../validation/applicant';
import { contactsRules } from '../validation/contacts';
import { employmentRules } from '../validation/employment';
import { additionalRules } from '../validation/additional';
import { confirmationRules } from '../validation/confirmation';

interface FlowStep {
  /** Идентификатор шага: `selector` узла шага в схеме и ключ его правил. */
  selector: string;
  title: string;
  icon: string;
  /** Разметка шага — содержимое узла шага. */
  content: (model: FormModel<CreditApplicationForm>) => FormSchemaNode[];
  /** Правила шага; `null` — шаг без правил. */
  rules: ValidationSchema<CreditApplicationForm> | null;
}

export const creditApplicationFlow = [
  { selector: 'loan', title: 'Кредит', icon: '💰', content: loanStep, rules: loanRules },
  {
    selector: 'applicant',
    title: 'Данные',
    icon: '👤',
    content: applicantStep,
    rules: applicantRules,
  },
  {
    selector: 'contacts',
    title: 'Контакты',
    icon: '📞',
    content: contactsStep,
    rules: contactsRules,
  },
  {
    selector: 'employment',
    title: 'Работа',
    icon: '💼',
    content: employmentStep,
    rules: employmentRules,
  },
  {
    selector: 'additional',
    title: 'Доп. инфо',
    icon: '📋',
    content: additionalStep,
    rules: additionalRules,
  },
  {
    selector: 'confirmation',
    title: 'Подтверждение',
    icon: '✓',
    content: confirmationStep,
    rules: confirmationRules,
  },
] as const satisfies readonly FlowStep[];

/** Идентификатор шага заявки. */
export type StepSelector = (typeof creditApplicationFlow)[number]['selector'];

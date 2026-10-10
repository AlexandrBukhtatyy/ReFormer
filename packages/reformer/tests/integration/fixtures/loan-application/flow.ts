/**
 * Поток шагов заявки на кредит.
 *
 * Шаг объявлен один раз: идентификатор (он же `selector` узла шага в схеме) и заголовок. Из этого
 * списка схема строит узлы шагов визарда, а {@link createLoanFlow} — поток для сборки. Последний
 * шаг — проверка заявки перед отправкой: он только показывает данные, поэтому правил у него нет
 * (`rules: null`), а переход дальше с него упирается в край потока.
 */

import type { FormFlowConfig } from '../../../../src/index';
import type { ValidationDefinition } from '../../../../src/form/validation/index';
import type { LoanApplication } from './model';
import type { LoanRules } from './validation';

/** Шаги заявки по порядку. */
export const LOAN_STEPS = [
  { id: 'loan', title: 'Кредит' },
  { id: 'applicant', title: 'Заёмщик' },
  { id: 'contacts', title: 'Контакты' },
  { id: 'employment', title: 'Работа' },
  { id: 'co-borrowers', title: 'Семья и созаёмщики' },
  { id: 'documents', title: 'Документы и согласия' },
  { id: 'review', title: 'Проверка заявки' },
] as const;

/** Идентификатор шага заявки. */
export type LoanStepId = (typeof LOAN_STEPS)[number]['id'];

/** Идентификаторы шагов по порядку. */
export const LOAN_STEP_IDS: readonly LoanStepId[] = LOAN_STEPS.map((step) => step.id);

/**
 * Поток шагов для сборки — поле `flow` в `createForm`: `next()` проверяет правила текущего шага.
 *
 * @param rules - Правила заявки ({@link LoanRules}) той же сборки.
 */
export function createLoanFlow(rules: LoanRules): FormFlowConfig<LoanApplication> {
  const byStep: Record<LoanStepId, ValidationDefinition<LoanApplication> | null> = {
    loan: rules.loan,
    applicant: rules.applicant,
    contacts: rules.contacts,
    employment: rules.employment,
    'co-borrowers': rules.coBorrowers,
    documents: rules.documents,
    // Проверка заявки — только просмотр: проверять на этом шаге нечего.
    review: null,
  };
  return { steps: LOAN_STEP_IDS.map((id) => ({ id, rules: byStep[id] })) };
}

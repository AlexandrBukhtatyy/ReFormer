/**
 * Поведение схемы рендера кредитной заявки
 *
 * Условия видимости нод вынесены отдельно от layout-схемы (render-schema.ts).
 * Каждая нода идентифицируется через selector.
 */

import type { RenderBehaviorFn } from '@reformer/renderer-react';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { creditApplicationRenderSchema as schema } from './render-schema';

export const creditApplicationRenderBehavior: RenderBehaviorFn<CreditApplicationForm> = (b) => {
  // ── Реактивный эффект: навигация wizard через ref ────────────────────────
  // При смене типа кредита на "ипотека" — переходим на первый шаг,
  // чтобы пользователь увидел появившуюся секцию с данными о недвижимости.
  b.effect((form) => {
    const wizardRef = schema.node('wizard').getRef<FormWizardHandle<CreditApplicationForm>>();
    const loanType = form.loanType.value.value;
    if (loanType === 'mortgage') {
      wizardRef.current?.goToStep(1);
    }
  });

  // ── Шаг 1: тип кредита ──────────────────────────────────────────────────
  b.hideWhen('mortgage-section', (form) => form.loanType.value.value !== 'mortgage');
  b.hideWhen('car-section', (form) => form.loanType.value.value !== 'car');

  // ── Шаг 3: адреса ───────────────────────────────────────────────────────
  b.hideWhen('residence-address-section', (form) => form.sameAsRegistration.value.value === true);

  // ── Шаг 4: занятость ────────────────────────────────────────────────────
  b.hideWhen('employer-section', (form) => form.employmentStatus.value.value !== 'employed');
  b.hideWhen('business-section', (form) => form.employmentStatus.value.value !== 'selfEmployed');
  b.hideWhen('income-section', (form) => form.employmentStatus.value.value === 'unemployed');
  b.hideWhen('unemployed-warning', (form) => form.employmentStatus.value.value !== 'unemployed');

  // ── Шаг 5: дополнительные секции ────────────────────────────────────────
  b.hideWhen('properties-array', (form) => !form.hasProperty.value.value);
  b.hideWhen('existing-loans-array', (form) => !form.hasExistingLoans.value.value);
  b.hideWhen('co-borrowers-array', (form) => !form.hasCoBorrower.value.value);
};

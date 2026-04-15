/**
 * Реестр компонентов и source-значений для JSON-схемы кредитной заявки.
 *
 * Содержит:
 * - App-specific контейнеры (RendererFormWizard, Step, RendererFormArraySection
 *   и UI-блоки шага подтверждения).
 * - Алиасы базовых layout-компонентов (Box, Section).
 * - Source-функции (itemLabel-и, validation-фабрики).
 * - Константы options (LOAN_TYPES, GENDERS и т.д.).
 *
 * Форма в реестр НЕ регистрируется — она живёт в closure behavior-а и попадает
 * в componentProps wizard-а через `onInit(schema.node('wizard'), () => ({ form }))`.
 */

import type { FormProxy } from '@reformer/core';
import { createDefaultRegistry, type ComponentRegistry } from '@reformer/renderer-json';
import { Box, Section } from '@reformer/ui-kit';
import { Step } from '@reformer/cdk/form-wizard';
import { RendererFormWizard } from '../complex-multy-step-form/components/ui/FormWizzard/RendererFormWizard';
import { RendererFormArraySection } from '../complex-multy-step-form/components/ui/FormArray/RendererFormArraySection';
import { ResidenceAddressSection } from '../complex-multy-step-form/components/ui/ResidenceAddressSection';
import { UnemployedWarning } from '../complex-multy-step-form/components/ui/UnemployedWarning';
import {
  ConfirmationInfoBlock,
  HighPaymentWarning,
  LoanSummarySection,
  SubmitWarning,
  NextStepsInfo,
  ElectronicSignatureHint,
} from '../complex-multy-step-form/components/ui/ConfirmationComponents';
import {
  LOAN_TYPES,
  EMPLOYMENT_STATUSES,
  MARITAL_STATUSES,
  EDUCATIONS,
  GENDERS,
  EXISTING_LOAN_TYPES,
  RELATIONSHIPS,
} from '../complex-multy-step-form/constants/credit-application';
import type { Property } from '../complex-multy-step-form/components/nested-forms/Property/types';
import type { ExistingLoan } from '../complex-multy-step-form/components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../complex-multy-step-form/components/nested-forms/CoBorrower/types';

export function createCreditApplicationRegistry(): ComponentRegistry {
  return (
    createDefaultRegistry()
      // App-specific контейнеры
      .register('RendererFormWizard', { component: RendererFormWizard, type: 'container' })
      .register('Step', { component: Step, type: 'container' })
      .register('RendererFormArraySection', {
        component: RendererFormArraySection,
        type: 'container',
      })
      .register('ResidenceAddressSection', {
        component: ResidenceAddressSection,
        type: 'container',
      })
      .register('UnemployedWarning', { component: UnemployedWarning, type: 'container' })
      .register('ConfirmationInfoBlock', { component: ConfirmationInfoBlock, type: 'container' })
      .register('HighPaymentWarning', { component: HighPaymentWarning, type: 'container' })
      .register('LoanSummarySection', { component: LoanSummarySection, type: 'container' })
      .register('SubmitWarning', { component: SubmitWarning, type: 'container' })
      .register('NextStepsInfo', { component: NextStepsInfo, type: 'container' })
      .register('ElectronicSignatureHint', {
        component: ElectronicSignatureHint,
        type: 'container',
      })
      // Base layout уже есть в defaultRegistry — регистрируем алиасы на всякий случай.
      .register('Box', { component: Box, type: 'container' })
      .register('Section', { component: Section, type: 'container' })
      // Source-функции: подставляются конвертером в componentProps по имени.
      .registerSource(
        'PROPERTY_ITEM_LABEL_SOURCE_FN',
        (_: FormProxy<Property>, index: number) => `Имущество #${index + 1}`
      )
      .registerSource(
        'EXISTING_LOAN_ITEM_LABEL_SOURCE_FN',
        (_: FormProxy<ExistingLoan>, index: number) => `Кредит #${index + 1}`
      )
      .registerSource(
        'CO_BORROWER_ITEM_LABEL_SOURCE_FN',
        (_: FormProxy<CoBorrower>, index: number) => `Созаемщик #${index + 1}`
      )
      // Константы options — инжектятся в componentProps.options по имени из JSON-схемы.
      .registerSource('LOAN_TYPES', LOAN_TYPES)
      .registerSource('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES)
      .registerSource('MARITAL_STATUSES', MARITAL_STATUSES)
      .registerSource('EDUCATIONS', EDUCATIONS)
      .registerSource('GENDERS', GENDERS)
      .registerSource('EXISTING_LOAN_TYPES', EXISTING_LOAN_TYPES)
      .registerSource('RELATIONSHIPS', RELATIONSHIPS)
      // Computed source: текущий год + 1 (используется в ограничении carYear)
      .registerSource('CURRENT_YEAR_PLUS_ONE', new Date().getFullYear() + 1)
  );
}

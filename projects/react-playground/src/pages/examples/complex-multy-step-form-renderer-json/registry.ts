/**
 * Реестр компонентов и source-значений для JSON-схемы кредитной заявки.
 *
 * Содержит:
 * - Базовые ui-kit компоненты (Input, Select, Box, Section и т.д.).
 * - App-specific контейнеры (RendererFormWizard, Step, RendererFormArraySection
 *   и UI-блоки шага подтверждения).
 * - Source-функции (itemLabel-и, validation-фабрики).
 * - Константы options (LOAN_TYPES, GENDERS и т.д.).
 *
 * Форма в реестр НЕ регистрируется — она живёт в closure behavior-а и попадает
 * в componentProps wizard-а через `onInit` + `schema.node('wizard').patchProps({ form })`.
 */

import { createElement } from 'react';
import type { FormProxy } from '@reformer/core';
import { defineRegistry, type ComponentRegistry } from '@reformer/renderer-json';
import {
  Input,
  InputPassword,
  InputMask,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  Box,
  Section,
  Collapsible,
  FormField,
  Button,
  AsyncBoundary,
} from '@reformer/ui-kit';
import { Step } from '@reformer/cdk/form-wizard';
import { RendererFormWizard } from '../complex-multy-step-form/components/ui/FormWizzard/RendererFormWizard';
import { RendererFormArraySection } from '../complex-multy-step-form/components/ui/FormArray/RendererFormArraySection';
import { ResidenceAddressSection } from '../complex-multy-step-form/components/ui/ResidenceAddressSection';
import { UnemployedWarning } from '../complex-multy-step-form/components/ui/UnemployedWarning';
import { LoadingState } from '../complex-multy-step-form/components/ui/LoadingState';
import { ErrorState } from '../complex-multy-step-form/components/ui/ErrorState';
import {
  ConfirmationInfoBlock,
  HighPaymentWarning,
  LoanSummarySection,
  ApplicantSummarySection,
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
  return defineRegistry((reg) => {
    // ui-kit base
    reg.field('Input', Input);
    reg.field('InputPassword', InputPassword);
    reg.field('InputMask', InputMask);
    reg.field('Textarea', Textarea);
    reg.field('Select', Select);
    reg.field('Checkbox', Checkbox);
    reg.field('RadioGroup', RadioGroup);

    reg.container('Box', Box);
    reg.container('Section', Section);
    reg.container('Collapsible', Collapsible);
    reg.container('AsyncBoundary', AsyncBoundary);
    reg.container('FormField', FormField);
    reg.container('Button', Button);

    // App-specific контейнеры
    reg.container('RendererFormWizard', RendererFormWizard);
    reg.container('Step', Step);
    reg.container('RendererFormArraySection', RendererFormArraySection);
    reg.container('ResidenceAddressSection', ResidenceAddressSection);
    reg.container('UnemployedWarning', UnemployedWarning);
    reg.container('ConfirmationInfoBlock', ConfirmationInfoBlock);
    reg.container('HighPaymentWarning', HighPaymentWarning);
    reg.container('LoanSummarySection', LoanSummarySection);
    reg.container('ApplicantSummarySection', ApplicantSummarySection);
    reg.container('SubmitWarning', SubmitWarning);
    reg.container('NextStepsInfo', NextStepsInfo);
    reg.container('ElectronicSignatureHint', ElectronicSignatureHint);

    // Source-компоненты (ComponentType для AsyncBoundary)
    reg.source('LoadingState', LoadingState);
    reg.source('ErrorStateDefault', () =>
      createElement(ErrorState, { error: 'Не удалось загрузить заявку' })
    );

    // Source-функции: itemLabel
    reg.source(
      'PROPERTY_ITEM_LABEL_SOURCE_FN',
      (_: FormProxy<Property>, index: number) => `Имущество #${index + 1}`
    );
    reg.source(
      'EXISTING_LOAN_ITEM_LABEL_SOURCE_FN',
      (_: FormProxy<ExistingLoan>, index: number) => `Кредит #${index + 1}`
    );
    reg.source(
      'CO_BORROWER_ITEM_LABEL_SOURCE_FN',
      (_: FormProxy<CoBorrower>, index: number) => `Созаемщик #${index + 1}`
    );

    // Константы options
    reg.source('LOAN_TYPES', LOAN_TYPES);
    reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.source('EDUCATIONS', EDUCATIONS);
    reg.source('GENDERS', GENDERS);
    reg.source('EXISTING_LOAN_TYPES', EXISTING_LOAN_TYPES);
    reg.source('RELATIONSHIPS', RELATIONSHIPS);
    reg.source('CURRENT_YEAR_PLUS_ONE', new Date().getFullYear() + 1);
  });
}

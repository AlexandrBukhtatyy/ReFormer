/**
 * Реестр компонентов и source-значений для JSON-схемы кредитной заявки.
 *
 * Содержит:
 * - Базовые ui-kit компоненты (Input, Select, Box, Section и т.д.).
 * - App-specific контейнеры (RendererFormWizard, Step и UI-блоки шага подтверждения).
 *   Массивы под M1 рендерятся native-веткой конвертера (`{ array, item }`), без shim.
 * - dataSource-функции (itemLabel-и, validation-фабрики).
 * - Константы options (LOAN_TYPES, GENDERS и т.д.).
 *
 * Форма в реестр НЕ регистрируется — она живёт в closure behavior-а и попадает
 * в componentProps wizard-а через `onInit` + `schema.node('wizard').patchProps({ form })`.
 */

import { createElement } from 'react';
import type { FormProxy } from '@reformer/core';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
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
import { RendererFormWizard } from '../../../components/RendererFormWizard';
import { ResidenceAddressSection } from '../complex-multy-step-form/components/ui/ResidenceAddressSection';
import { UnemployedWarning } from '../complex-multy-step-form/components/ui/UnemployedWarning';
import { LoadingState, ErrorState } from '@reformer/ui-kit';
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
    reg.component('Input', Input);
    reg.component('InputPassword', InputPassword);
    reg.component('InputMask', InputMask);
    reg.component('Textarea', Textarea);
    reg.component('Select', Select);
    reg.component('Checkbox', Checkbox);
    reg.component('RadioGroup', RadioGroup);

    reg.component('Box', Box);
    reg.component('Section', Section);
    reg.component('Collapsible', Collapsible);
    reg.component('AsyncBoundary', AsyncBoundary);
    reg.component('FormField', FormField);
    reg.component('Button', Button);

    // App-specific контейнеры
    reg.component('RendererFormWizard', RendererFormWizard);
    reg.component('Step', Step);
    reg.component('ResidenceAddressSection', ResidenceAddressSection);
    reg.component('UnemployedWarning', UnemployedWarning);
    reg.component('ConfirmationInfoBlock', ConfirmationInfoBlock);
    reg.component('HighPaymentWarning', HighPaymentWarning);
    reg.component('LoanSummarySection', LoanSummarySection);
    reg.component('ApplicantSummarySection', ApplicantSummarySection);
    reg.component('SubmitWarning', SubmitWarning);
    reg.component('NextStepsInfo', NextStepsInfo);
    reg.component('ElectronicSignatureHint', ElectronicSignatureHint);

    // Системный компонент
    reg.component(FIELD_WRAPPER, FormField);

    // dataSource-компоненты (ComponentType для AsyncBoundary)
    reg.dataSource('LoadingState', LoadingState);
    reg.dataSource('ErrorStateDefault', () =>
      createElement(ErrorState, { error: 'Не удалось загрузить заявку' })
    );

    // dataSource-функции: itemLabel
    reg.dataSource(
      'PROPERTY_ITEM_LABEL_SOURCE_FN',
      (_: FormProxy<Property>, index: number) => `Имущество #${index + 1}`
    );
    reg.dataSource(
      'EXISTING_LOAN_ITEM_LABEL_SOURCE_FN',
      (_: FormProxy<ExistingLoan>, index: number) => `Кредит #${index + 1}`
    );
    reg.dataSource(
      'CO_BORROWER_ITEM_LABEL_SOURCE_FN',
      (_: FormProxy<CoBorrower>, index: number) => `Созаемщик #${index + 1}`
    );

    // Константы options
    reg.dataSource('LOAN_TYPES', LOAN_TYPES);
    reg.dataSource('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.dataSource('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.dataSource('EDUCATIONS', EDUCATIONS);
    reg.dataSource('GENDERS', GENDERS);
    reg.dataSource('EXISTING_LOAN_TYPES', EXISTING_LOAN_TYPES);
    reg.dataSource('RELATIONSHIPS', RELATIONSHIPS);
    reg.dataSource('CURRENT_YEAR_PLUS_ONE', new Date().getFullYear() + 1);
  });
}

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
    reg.container('ResidenceAddressSection', ResidenceAddressSection);
    reg.container('UnemployedWarning', UnemployedWarning);
    reg.container('ConfirmationInfoBlock', ConfirmationInfoBlock);
    reg.container('HighPaymentWarning', HighPaymentWarning);
    reg.container('LoanSummarySection', LoanSummarySection);
    reg.container('ApplicantSummarySection', ApplicantSummarySection);
    reg.container('SubmitWarning', SubmitWarning);
    reg.container('NextStepsInfo', NextStepsInfo);
    reg.container('ElectronicSignatureHint', ElectronicSignatureHint);

    // Системный компонент
    reg.container(FIELD_WRAPPER, FormField);

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

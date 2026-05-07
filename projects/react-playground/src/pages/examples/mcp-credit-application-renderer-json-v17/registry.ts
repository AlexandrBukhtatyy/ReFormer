import {
  Input,
  InputMask,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
  Button,
  FormField,
  Box,
  Section,
} from '@reformer/ui-kit';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { FIELD_WRAPPER, type RegistryBuilder } from '@reformer/renderer-json';

import { RendererFormArraySection } from './RendererFormArraySection';
import type {
  CreditApplicationForm,
  PropertyItem,
  ExistingLoan,
  CoBorrower,
} from './types';

// Plain-leaf templates for AddButton initialValue
const propertyTemplate = (): Partial<PropertyItem> => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});
const existingLoanTemplate = (): Partial<ExistingLoan> => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});
const coBorrowerTemplate = (): Partial<CoBorrower> => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

export const PROPERTY_ITEM_LABEL = (_form: unknown, index: number) => `Имущество #${index + 1}`;
export const EXISTING_LOAN_ITEM_LABEL = (_form: unknown, index: number) =>
  `Кредит #${index + 1}`;
export const CO_BORROWER_ITEM_LABEL = (_form: unknown, index: number) =>
  `Созаемщик #${index + 1}`;

export const buildRegistry = (reg: RegistryBuilder): void => {
  // Field components
  reg.field('Input', Input);
  reg.field('InputMask', InputMask);
  reg.field('Select', Select);
  reg.field('Textarea', Textarea);
  reg.field('Checkbox', Checkbox);
  reg.field('RadioGroup', RadioGroup);

  // Container components
  reg.container('Box', Box);
  reg.container('Section', Section);
  reg.container('FormArraySection', RendererFormArraySection);
  reg.container('FormWizard', FormWizard);
  reg.container('Button', Button as never);

  // Field wrapper (label + error + pending)
  reg.container(FIELD_WRAPPER, FormField);

  // Initial-value templates (sources)
  reg.source('PROPERTY_TEMPLATE', propertyTemplate());
  reg.source('EXISTING_LOAN_TEMPLATE', existingLoanTemplate());
  reg.source('CO_BORROWER_TEMPLATE', coBorrowerTemplate());

  // Item label functions
  reg.source('PROPERTY_ITEM_LABEL', PROPERTY_ITEM_LABEL);
  reg.source('EXISTING_LOAN_ITEM_LABEL', EXISTING_LOAN_ITEM_LABEL);
  reg.source('CO_BORROWER_ITEM_LABEL', CO_BORROWER_ITEM_LABEL);
};

export type { CreditApplicationForm };

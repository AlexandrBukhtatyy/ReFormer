/**
 * RenderSchema — MCP Credit Application Renderer v10 (target=renderer-react)
 *
 * Builds a `RenderSchemaProxy<CreditApplicationForm>` whose root is the ui-kit
 * FormWizard (A1) with `RenderNode` step bodies (B2). Each conditional sub-section
 * has a `selector` so that index.tsx can use `schema.node('selector').setHidden(...)`
 * driven by `useFormControlValue` + per-condition `useEffect` (Patch L).
 *
 * Patch J (CRITICAL): inside this callback we build nodes with `component: path.X`
 * (FieldPathNode), NEVER `form.X` (FieldNode). FieldNode passed as `component` is
 * silently ignored by the renderer — Patch J specifically guards against it.
 *
 * Patch M (defensive): a few `hideWhen` calls on the proxy use `form.X.value.value`
 * (DOUBLE `.value`) to read the current value out of the Preact Signal. Single
 * `.value` returns the Signal object → comparison with literal always falsy/truthy.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FC } from 'react';
import {
  createRenderSchema,
  type RenderNode,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import { FormField, Box, Section } from '@reformer/ui-kit';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FieldPath, FormProxy } from '@reformer/core';

import type {
  CreditApplicationForm,
  PropertyItem,
  ExistingLoanItem,
  CoBorrowerItem,
} from './types';
import {
  STEP_VALIDATIONS,
  fullValidation,
  createPropertyItem,
  createExistingLoanItem,
  createCoBorrowerItem,
} from './schema';

// ============================================================================
// Item components for FormArraySection (FC shape — Path C unified API)
// ============================================================================

const PropertyItemForm: FC<{ control: FormProxy<PropertyItem> }> = ({ control }) => (
  <Box className="space-y-3">
    <FormField control={control.type} testId="step5.property.type" />
    <FormField control={control.description} testId="step5.property.description" />
    <FormField control={control.estimatedValue} testId="step5.property.estimatedValue" />
    <FormField control={control.hasEncumbrance} testId="step5.property.hasEncumbrance" />
  </Box>
);

const ExistingLoanItemForm: FC<{ control: FormProxy<ExistingLoanItem> }> = ({ control }) => (
  <Box className="space-y-3">
    <FormField control={control.bank} testId="step5.existingLoan.bank" />
    <FormField control={control.type} testId="step5.existingLoan.type" />
    <Box className="grid grid-cols-2 gap-3">
      <FormField control={control.amount} testId="step5.existingLoan.amount" />
      <FormField control={control.remainingAmount} testId="step5.existingLoan.remainingAmount" />
    </Box>
    <Box className="grid grid-cols-2 gap-3">
      <FormField control={control.monthlyPayment} testId="step5.existingLoan.monthlyPayment" />
      <FormField control={control.maturityDate} testId="step5.existingLoan.maturityDate" />
    </Box>
  </Box>
);

const CoBorrowerItemForm: FC<{ control: FormProxy<CoBorrowerItem> }> = ({ control }) => (
  <Box className="space-y-3">
    <Box className="grid grid-cols-3 gap-3">
      <FormField control={control.personalData.lastName} testId="step5.coBorrower.lastName" />
      <FormField control={control.personalData.firstName} testId="step5.coBorrower.firstName" />
      <FormField control={control.personalData.middleName} testId="step5.coBorrower.middleName" />
    </Box>
    <FormField control={control.personalData.birthDate} testId="step5.coBorrower.birthDate" />
    <Box className="grid grid-cols-2 gap-3">
      <FormField control={control.phone} testId="step5.coBorrower.phone" />
      <FormField control={control.email} testId="step5.coBorrower.email" />
    </Box>
    <Box className="grid grid-cols-2 gap-3">
      <FormField control={control.relationship} testId="step5.coBorrower.relationship" />
      <FormField control={control.monthlyIncome} testId="step5.coBorrower.monthlyIncome" />
    </Box>
  </Box>
);

// ============================================================================
// Step builders — each returns a RenderNode<CreditApplicationForm> sub-tree
// using `path.X` (FieldPathNode), per Patch J.
//
// Use `any` for path-helper inputs to dodge TS2589 on deeply-nested form types
// (the 4+ level access through `path.passportData.series` etc.).
// ============================================================================

function buildStep1Body(path: any): RenderNode<CreditApplicationForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      { component: path.loanType, componentProps: { testId: 'step1.loanType' } },
      {
        component: Box,
        componentProps: { className: 'grid grid-cols-2 gap-4' },
        children: [
          { component: path.loanAmount, componentProps: { testId: 'step1.loanAmount' } },
          { component: path.loanTerm, componentProps: { testId: 'step1.loanTerm' } },
        ],
      },
      {
        selector: 'step1.loanPurpose-section',
        component: Box,
        children: [
          {
            component: path.loanPurpose,
            componentProps: { testId: 'step1.loanPurpose' },
          },
        ],
      },
      // Mortgage-only block
      {
        selector: 'step1.mortgage-section',
        component: Section,
        componentProps: {
          title: 'Параметры ипотеки',
          titleClassName: 'text-sm font-semibold text-blue-900',
          className: 'space-y-3 border-l-4 border-blue-200 pl-4',
        },
        children: [
          {
            component: path.propertyValue,
            componentProps: { testId: 'step1.propertyValue' },
          },
          {
            component: path.initialPayment,
            componentProps: { testId: 'step1.initialPayment' },
          },
        ],
      },
      // Car-only block
      {
        selector: 'step1.car-section',
        component: Section,
        componentProps: {
          title: 'Параметры автокредита',
          titleClassName: 'text-sm font-semibold text-emerald-900',
          className: 'space-y-3 border-l-4 border-emerald-200 pl-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.carBrand, componentProps: { testId: 'step1.carBrand' } },
              { component: path.carModel, componentProps: { testId: 'step1.carModel' } },
            ],
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.carYear, componentProps: { testId: 'step1.carYear' } },
              { component: path.carPrice, componentProps: { testId: 'step1.carPrice' } },
            ],
          },
        ],
      },
      // Computed fields (read-only)
      {
        component: Box,
        componentProps: { className: 'grid grid-cols-2 gap-4 pt-3 border-t border-gray-200' },
        children: [
          {
            component: path.interestRate,
            componentProps: { testId: 'step1.interestRate' },
          },
          {
            component: path.monthlyPayment,
            componentProps: { testId: 'step1.monthlyPayment' },
          },
        ],
      },
    ],
  };
}

function buildStep2Body(path: any): RenderNode<CreditApplicationForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Личные данные',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-3 gap-4' },
            children: [
              {
                component: path.personalData.lastName,
                componentProps: { testId: 'step2.personalData.lastName' },
              },
              {
                component: path.personalData.firstName,
                componentProps: { testId: 'step2.personalData.firstName' },
              },
              {
                component: path.personalData.middleName,
                componentProps: { testId: 'step2.personalData.middleName' },
              },
            ],
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.personalData.birthDate,
                componentProps: { testId: 'step2.personalData.birthDate' },
              },
              {
                component: path.personalData.gender,
                componentProps: { testId: 'step2.personalData.gender' },
              },
            ],
          },
          {
            component: path.personalData.birthPlace,
            componentProps: { testId: 'step2.personalData.birthPlace' },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4 pt-2' },
            children: [
              { component: path.fullName, componentProps: { testId: 'step2.fullName' } },
              { component: path.age, componentProps: { testId: 'step2.age' } },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: {
          title: 'Паспортные данные',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.passportData.series,
                componentProps: { testId: 'step2.passportData.series' },
              },
              {
                component: path.passportData.number,
                componentProps: { testId: 'step2.passportData.number' },
              },
            ],
          },
          {
            component: path.passportData.issuedBy,
            componentProps: { testId: 'step2.passportData.issuedBy' },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.passportData.issueDate,
                componentProps: { testId: 'step2.passportData.issueDate' },
              },
              {
                component: path.passportData.departmentCode,
                componentProps: { testId: 'step2.passportData.departmentCode' },
              },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: {
          title: 'Документы',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.inn, componentProps: { testId: 'step2.inn' } },
              { component: path.snils, componentProps: { testId: 'step2.snils' } },
            ],
          },
        ],
      },
    ],
  };
}

function buildStep3Body(path: any): RenderNode<CreditApplicationForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Контакты',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.phoneMain, componentProps: { testId: 'step3.phoneMain' } },
              {
                component: path.phoneAdditional,
                componentProps: { testId: 'step3.phoneAdditional' },
              },
            ],
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.email, componentProps: { testId: 'step3.email' } },
              {
                component: path.emailAdditional,
                componentProps: { testId: 'step3.emailAdditional' },
              },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: {
          title: 'Адрес регистрации',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.registrationAddress.region,
                componentProps: { testId: 'step3.registrationAddress.region' },
              },
              {
                component: path.registrationAddress.city,
                componentProps: { testId: 'step3.registrationAddress.city' },
              },
            ],
          },
          {
            component: path.registrationAddress.street,
            componentProps: { testId: 'step3.registrationAddress.street' },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-3 gap-4' },
            children: [
              {
                component: path.registrationAddress.house,
                componentProps: { testId: 'step3.registrationAddress.house' },
              },
              {
                component: path.registrationAddress.apartment,
                componentProps: { testId: 'step3.registrationAddress.apartment' },
              },
              {
                component: path.registrationAddress.postalCode,
                componentProps: { testId: 'step3.registrationAddress.postalCode' },
              },
            ],
          },
        ],
      },
      {
        component: path.sameAsRegistration,
        componentProps: { testId: 'step3.sameAsRegistration' },
      },
      // Residence-only block (visible when sameAsRegistration === false)
      {
        selector: 'step3.residence-section',
        component: Section,
        componentProps: {
          title: 'Адрес проживания',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4 border-l-4 border-orange-200 pl-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.residenceAddress.region,
                componentProps: { testId: 'step3.residenceAddress.region' },
              },
              {
                component: path.residenceAddress.city,
                componentProps: { testId: 'step3.residenceAddress.city' },
              },
            ],
          },
          {
            component: path.residenceAddress.street,
            componentProps: { testId: 'step3.residenceAddress.street' },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-3 gap-4' },
            children: [
              {
                component: path.residenceAddress.house,
                componentProps: { testId: 'step3.residenceAddress.house' },
              },
              {
                component: path.residenceAddress.apartment,
                componentProps: { testId: 'step3.residenceAddress.apartment' },
              },
              {
                component: path.residenceAddress.postalCode,
                componentProps: { testId: 'step3.residenceAddress.postalCode' },
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildStep4Body(path: any): RenderNode<CreditApplicationForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: path.employmentStatus,
        componentProps: { testId: 'step4.employmentStatus' },
      },
      // Employed-only
      {
        selector: 'step4.employed-section',
        component: Section,
        componentProps: {
          title: 'Работа по найму',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4 border-l-4 border-blue-200 pl-4',
        },
        children: [
          { component: path.companyName, componentProps: { testId: 'step4.companyName' } },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.companyInn, componentProps: { testId: 'step4.companyInn' } },
              {
                component: path.companyPhone,
                componentProps: { testId: 'step4.companyPhone' },
              },
            ],
          },
          {
            component: path.companyAddress,
            componentProps: { testId: 'step4.companyAddress' },
          },
          { component: path.position, componentProps: { testId: 'step4.position' } },
        ],
      },
      // Self-employed-only
      {
        selector: 'step4.selfEmployed-section',
        component: Section,
        componentProps: {
          title: 'Индивидуальный предприниматель',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4 border-l-4 border-emerald-200 pl-4',
        },
        children: [
          { component: path.businessType, componentProps: { testId: 'step4.businessType' } },
          { component: path.businessInn, componentProps: { testId: 'step4.businessInn' } },
          {
            component: path.businessActivity,
            componentProps: { testId: 'step4.businessActivity' },
          },
        ],
      },
      // Common — work experience + income
      {
        component: Section,
        componentProps: {
          title: 'Стаж',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.workExperienceTotal,
                componentProps: { testId: 'step4.workExperienceTotal' },
              },
              {
                component: path.workExperienceCurrent,
                componentProps: { testId: 'step4.workExperienceCurrent' },
              },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: {
          title: 'Доходы',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.monthlyIncome,
                componentProps: { testId: 'step4.monthlyIncome' },
              },
              {
                component: path.additionalIncome,
                componentProps: { testId: 'step4.additionalIncome' },
              },
            ],
          },
          {
            component: path.additionalIncomeSource,
            componentProps: { testId: 'step4.additionalIncomeSource' },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4 pt-2' },
            children: [
              {
                component: path.totalIncome,
                componentProps: { testId: 'step4.totalIncome' },
              },
              {
                component: path.paymentToIncomeRatio,
                componentProps: { testId: 'step4.paymentToIncomeRatio' },
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildStep5Body(path: any): RenderNode<CreditApplicationForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Личное',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: path.maritalStatus,
            componentProps: { testId: 'step5.maritalStatus' },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.dependents, componentProps: { testId: 'step5.dependents' } },
              { component: path.education, componentProps: { testId: 'step5.education' } },
            ],
          },
        ],
      },
      // Property toggle + array
      {
        component: Box,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            component: path.hasProperty,
            componentProps: { testId: 'step5.hasProperty' },
          },
          {
            selector: 'step5.properties-array',
            component: FormArraySection,
            componentProps: {
              title: 'Имущество',
              control: path.properties,
              itemComponent: PropertyItemForm,
              itemLabel: 'Имущество',
              addButtonLabel: '+ Добавить имущество',
              emptyMessage: 'Нажмите "Добавить имущество" для добавления записи',
              initialValue: createPropertyItem(),
            },
          },
        ],
      },
      // Existing-loans toggle + array
      {
        component: Box,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            component: path.hasExistingLoans,
            componentProps: { testId: 'step5.hasExistingLoans' },
          },
          {
            selector: 'step5.existingLoans-array',
            component: FormArraySection,
            componentProps: {
              title: 'Существующие кредиты',
              control: path.existingLoans,
              itemComponent: ExistingLoanItemForm,
              itemLabel: 'Кредит',
              addButtonLabel: '+ Добавить кредит',
              emptyMessage: 'Нажмите "Добавить кредит" для добавления записи',
              initialValue: createExistingLoanItem(),
            },
          },
        ],
      },
      // CoBorrower toggle + array
      {
        component: Box,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            component: path.hasCoBorrower,
            componentProps: { testId: 'step5.hasCoBorrower' },
          },
          {
            selector: 'step5.coBorrowers-array',
            component: FormArraySection,
            componentProps: {
              title: 'Созаемщики',
              control: path.coBorrowers,
              itemComponent: CoBorrowerItemForm,
              itemLabel: 'Созаемщик',
              addButtonLabel: '+ Добавить созаемщика',
              emptyMessage: 'Нажмите "Добавить созаемщика" для добавления записи',
              initialValue: createCoBorrowerItem(),
            },
          },
          {
            component: path.coBorrowersIncome,
            componentProps: { testId: 'step5.coBorrowersIncome' },
          },
        ],
      },
    ],
  };
}

function buildStep6Body(path: any): RenderNode<CreditApplicationForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: path.agreePersonalData,
        componentProps: { testId: 'step6.agreePersonalData' },
      },
      {
        component: path.agreeCreditHistory,
        componentProps: { testId: 'step6.agreeCreditHistory' },
      },
      {
        component: path.agreeMarketing,
        componentProps: { testId: 'step6.agreeMarketing' },
      },
      { component: path.agreeTerms, componentProps: { testId: 'step6.agreeTerms' } },
      {
        component: path.confirmAccuracy,
        componentProps: { testId: 'step6.confirmAccuracy' },
      },
      {
        component: Box,
        componentProps: { className: 'pt-3 border-t border-gray-200' },
        children: [
          {
            component: path.electronicSignature,
            componentProps: { testId: 'step6.electronicSignature' },
          },
        ],
      },
    ],
  };
}

// ============================================================================
// Top-level RenderSchema factory
// ============================================================================

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  onSubmit: (values: CreditApplicationForm) => Promise<unknown> | unknown
): RenderSchemaProxy<CreditApplicationForm> {
  const schema = createRenderSchema<CreditApplicationForm>(
    (path: FieldPath<CreditApplicationForm>) => {
      // Build step bodies as RenderNode<T> sub-trees using `path.X` (FieldPathNode).
      // These are passed into ui-kit FormWizard which wraps them in <RenderNodeComponent>.
      const steps: FormWizardStep<CreditApplicationForm>[] = [
        { number: 1, title: 'Кредит', icon: '💰', body: buildStep1Body(path) },
        { number: 2, title: 'Данные', icon: '👤', body: buildStep2Body(path) },
        { number: 3, title: 'Контакты', icon: '📞', body: buildStep3Body(path) },
        { number: 4, title: 'Работа', icon: '💼', body: buildStep4Body(path) },
        { number: 5, title: 'Доп. инфо', icon: '📋', body: buildStep5Body(path) },
        { number: 6, title: 'Подтверждение', icon: '✓', body: buildStep6Body(path) },
      ];

      return {
        selector: 'wizard-root',
        component: FormWizard,
        componentProps: {
          form,
          config: { stepValidations: STEP_VALIDATIONS, fullValidation },
          steps,
          onSubmit,
        },
      } as unknown as RenderNode<CreditApplicationForm>;
    }
  );

  return schema;
}

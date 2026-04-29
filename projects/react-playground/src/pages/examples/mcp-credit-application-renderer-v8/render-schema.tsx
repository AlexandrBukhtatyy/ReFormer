/**
 * Iter-8 — credit-application form (target=renderer-react)
 *
 * RenderSchema using ui-kit `FormWizard` (Patch G — A1 default for ui-kit stacks).
 *
 * Wizard pair: A=A1, B=B2.
 *  - A1 ui-kit FormWizard handles step switching internally; no manual setHidden.
 *  - step.body uses Variant 3 (`RenderNode<T>`) — RenderSchema subtree wrapped
 *    by `<RenderNodeComponent>` inside FormWizard.
 *  - Conditional sub-sections (mortgage/car/employer/business/residence/array
 *    visibility) use `selector` + top-level `hideWhen(...)` after
 *    `createRenderSchema(...)`.
 */

import type { FC } from 'react';
import type { FieldPath, FormProxy } from '@reformer/core';
import {
  createRenderSchema,
  hideWhen,
  RenderNodeComponent,
  type RenderNode,
} from '@reformer/renderer-react';
import { Box, FormArraySection, Section } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

import { STEP_VALIDATIONS, creditApplicationValidation } from './schema';
import type { CoBorrower, CreditApplicationForm, ExistingLoan, Property } from './types';

// ============================================================================
// Item FCs for FormArraySection (Path C — single FC `itemComponent` shape)
//
// Each FC receives `control: FormProxy<ItemT>` and renders item fields by
// passing nodes through `<RenderNodeComponent node={...} form={control} />`.
// `form={control}` is mandatory — without it FieldRenderNodes warn
// "Field node rendered without form".
// ============================================================================

function ItemNodes<T>({ control, nodes }: { control: FormProxy<T>; nodes: RenderNode<T>[] }) {
  return (
    <div className="space-y-3">
      {nodes.map((n, i) => (
        <RenderNodeComponent key={i} node={n} form={control} />
      ))}
    </div>
  );
}

const PropertyItem: FC<{ control: FormProxy<Property> }> = ({ control }) => (
  <ItemNodes<Property>
    control={control}
    nodes={[
      { component: control.type, componentProps: { testId: 'property.type' } },
      { component: control.description, componentProps: { testId: 'property.description' } },
      {
        component: control.estimatedValue,
        componentProps: { testId: 'property.estimatedValue' },
      },
      {
        component: control.hasEncumbrance,
        componentProps: { testId: 'property.hasEncumbrance' },
      },
    ]}
  />
);

const ExistingLoanItem: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <ItemNodes<ExistingLoan>
    control={control}
    nodes={[
      { component: control.bank, componentProps: { testId: 'existingLoan.bank' } },
      { component: control.type, componentProps: { testId: 'existingLoan.type' } },
      {
        component: Box,
        componentProps: { className: 'grid grid-cols-2 gap-4' },
        children: [
          {
            component: control.amount,
            componentProps: { testId: 'existingLoan.amount' },
          },
          {
            component: control.remainingAmount,
            componentProps: { testId: 'existingLoan.remainingAmount' },
          },
        ],
      },
      {
        component: Box,
        componentProps: { className: 'grid grid-cols-2 gap-4' },
        children: [
          {
            component: control.monthlyPayment,
            componentProps: { testId: 'existingLoan.monthlyPayment' },
          },
          {
            component: control.maturityDate,
            componentProps: { testId: 'existingLoan.maturityDate' },
          },
        ],
      },
    ]}
  />
);

const CoBorrowerItem: FC<{ control: FormProxy<CoBorrower> }> = ({ control }) => (
  <ItemNodes<CoBorrower>
    control={control}
    nodes={[
      {
        component: Box,
        componentProps: { className: 'grid grid-cols-3 gap-4' },
        children: [
          {
            component: control.personalData.lastName,
            componentProps: { testId: 'coBorrower.lastName' },
          },
          {
            component: control.personalData.firstName,
            componentProps: { testId: 'coBorrower.firstName' },
          },
          {
            component: control.personalData.middleName,
            componentProps: { testId: 'coBorrower.middleName' },
          },
        ],
      },
      {
        component: control.personalData.birthDate,
        componentProps: { testId: 'coBorrower.birthDate' },
      },
      {
        component: Box,
        componentProps: { className: 'grid grid-cols-2 gap-4' },
        children: [
          { component: control.phone, componentProps: { testId: 'coBorrower.phone' } },
          { component: control.email, componentProps: { testId: 'coBorrower.email' } },
        ],
      },
      {
        component: Box,
        componentProps: { className: 'grid grid-cols-2 gap-4' },
        children: [
          {
            component: control.relationship,
            componentProps: { testId: 'coBorrower.relationship' },
          },
          {
            component: control.monthlyIncome,
            componentProps: { testId: 'coBorrower.monthlyIncome' },
          },
        ],
      },
    ]}
  />
);

// ============================================================================
// Step bodies as RenderNode subtrees (Variant 3 of FormWizardStepBody)
// ============================================================================

function step1Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Основная информация о кредите',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold',
          className: 'space-y-4',
        },
        children: [
          { component: path.loanType, componentProps: { testId: 'step1.loanType' } },
          { component: path.loanAmount, componentProps: { testId: 'step1.loanAmount' } },
          { component: path.loanTerm, componentProps: { testId: 'step1.loanTerm' } },
          { component: path.loanPurpose, componentProps: { testId: 'step1.loanPurpose' } },
        ],
      },
      // Mortgage sub-section — hidden via hideWhen('mortgage-section') below.
      {
        selector: 'mortgage-section',
        component: Section,
        componentProps: {
          title: 'Информация о недвижимости',
          titleClassName: 'text-lg font-semibold mt-4',
          className: 'space-y-4',
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
      // Car sub-section
      {
        selector: 'car-section',
        component: Section,
        componentProps: {
          title: 'Информация об автомобиле',
          titleClassName: 'text-lg font-semibold mt-4',
          className: 'space-y-4',
        },
        children: [
          { component: path.carBrand, componentProps: { testId: 'step1.carBrand' } },
          { component: path.carModel, componentProps: { testId: 'step1.carModel' } },
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
    ],
  };
}

function step2Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    component: Section,
    componentProps: {
      title: 'Персональные данные',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
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
          title: 'Дополнительные документы',
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

function step3Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    component: Section,
    componentProps: {
      title: 'Контактная информация',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
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
              {
                component: path.phoneMain,
                componentProps: { testId: 'step3.phoneMain' },
              },
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
      // Residence address — hidden via hideWhen('residence-address-section')
      {
        selector: 'residence-address-section',
        component: Section,
        componentProps: {
          title: 'Адрес проживания',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
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

function step4Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    component: Section,
    componentProps: {
      title: 'Информация о занятости',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
    children: [
      {
        component: path.employmentStatus,
        componentProps: { testId: 'step4.employmentStatus' },
      },
      // Employer section
      {
        selector: 'employer-section',
        component: Section,
        componentProps: {
          title: 'Информация о работодателе',
          titleClassName: 'text-lg font-semibold mt-6',
          className: 'space-y-4',
        },
        children: [
          { component: path.companyName, componentProps: { testId: 'step4.companyName' } },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.companyInn,
                componentProps: { testId: 'step4.companyInn' },
              },
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
      // Business section
      {
        selector: 'business-section',
        component: Section,
        componentProps: {
          title: 'Информация о бизнесе',
          titleClassName: 'text-lg font-semibold mt-6',
          className: 'space-y-4',
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
      // Income
      {
        selector: 'income-section',
        component: Section,
        componentProps: {
          title: 'Доход',
          titleClassName: 'text-lg font-semibold mt-6',
          className: 'space-y-4',
        },
        children: [
          {
            component: path.monthlyIncome,
            componentProps: { testId: 'step4.monthlyIncome' },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.additionalIncome,
                componentProps: { testId: 'step4.additionalIncome' },
              },
              {
                component: path.additionalIncomeSource,
                componentProps: { testId: 'step4.additionalIncomeSource' },
              },
            ],
          },
        ],
      },
    ],
  };
}

function step5Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    component: Section,
    componentProps: {
      title: 'Дополнительная информация',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Общая информация',
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
              {
                component: path.dependents,
                componentProps: { testId: 'step5.dependents' },
              },
              { component: path.education, componentProps: { testId: 'step5.education' } },
            ],
          },
        ],
      },
      // hasProperty + properties[]
      {
        component: Section,
        componentProps: { className: 'space-y-4' },
        children: [
          { component: path.hasProperty, componentProps: { testId: 'step5.hasProperty' } },
          {
            selector: 'properties-array',
            component: FormArraySection,
            // D3: initialValue PLAIN leaves only — never FieldConfig.
            componentProps: {
              control: path.properties,
              itemComponent: PropertyItem,
              title: 'Имущество',
              addButtonLabel: '+ Добавить имущество',
              emptyMessage: 'Нажмите "Добавить имущество" для добавления информации',
              initialValue: {
                type: 'apartment',
                description: '',
                estimatedValue: 0,
                hasEncumbrance: false,
              },
            },
          },
        ],
      },
      // hasExistingLoans + existingLoans[]
      {
        component: Section,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            component: path.hasExistingLoans,
            componentProps: { testId: 'step5.hasExistingLoans' },
          },
          {
            selector: 'existing-loans-array',
            component: FormArraySection,
            componentProps: {
              control: path.existingLoans,
              itemComponent: ExistingLoanItem,
              title: 'Существующие кредиты',
              addButtonLabel: '+ Добавить кредит',
              emptyMessage: 'Нажмите "Добавить кредит" для добавления информации',
              initialValue: {
                bank: '',
                type: '',
                amount: 0,
                remainingAmount: 0,
                monthlyPayment: 0,
                maturityDate: '',
              },
            },
          },
        ],
      },
      // hasCoBorrower + coBorrowers[]
      {
        component: Section,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            component: path.hasCoBorrower,
            componentProps: { testId: 'step5.hasCoBorrower' },
          },
          {
            selector: 'co-borrowers-array',
            component: FormArraySection,
            componentProps: {
              control: path.coBorrowers,
              itemComponent: CoBorrowerItem,
              title: 'Созаемщики',
              addButtonLabel: '+ Добавить созаемщика',
              emptyMessage: 'Нажмите "Добавить созаемщика" для добавления информации',
              initialValue: {
                personalData: {
                  lastName: '',
                  firstName: '',
                  middleName: '',
                  birthDate: '',
                },
                phone: '',
                email: '',
                relationship: '',
                monthlyIncome: 0,
              },
            },
          },
        ],
      },
    ],
  };
}

function step6Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    component: Section,
    componentProps: {
      title: 'Подтверждение и согласия',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
    children: [
      // Computed summary
      {
        component: Section,
        componentProps: {
          title: 'Итого по заявке',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                component: path.interestRate,
                componentProps: { testId: 'step6.interestRate' },
              },
              {
                component: path.monthlyPayment,
                componentProps: { testId: 'step6.monthlyPayment' },
              },
            ],
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.totalIncome, componentProps: { testId: 'step6.totalIncome' } },
              {
                component: path.paymentToIncomeRatio,
                componentProps: { testId: 'step6.paymentToIncomeRatio' },
              },
            ],
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.fullName, componentProps: { testId: 'step6.fullName' } },
              { component: path.age, componentProps: { testId: 'step6.age' } },
            ],
          },
        ],
      },
      // Required consents
      {
        component: Section,
        componentProps: {
          title: 'Обязательные согласия',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-3',
        },
        children: [
          {
            component: path.agreePersonalData,
            componentProps: { testId: 'step6.agreePersonalData' },
          },
          {
            component: path.agreeCreditHistory,
            componentProps: { testId: 'step6.agreeCreditHistory' },
          },
          { component: path.agreeTerms, componentProps: { testId: 'step6.agreeTerms' } },
          {
            component: path.confirmAccuracy,
            componentProps: { testId: 'step6.confirmAccuracy' },
          },
        ],
      },
      // Optional
      {
        component: Section,
        componentProps: {
          title: 'Опциональные согласия',
          titleClassName: 'text-lg font-semibold mt-6',
        },
        children: [
          {
            component: path.agreeMarketing,
            componentProps: { testId: 'step6.agreeMarketing' },
          },
        ],
      },
      // Electronic signature
      {
        component: Section,
        componentProps: {
          title: 'Электронная подпись',
          titleClassName: 'text-lg font-semibold mt-6',
          className: 'space-y-4',
        },
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
// createCreditApplicationRenderSchema(form)
// ============================================================================

export interface CreateRenderSchemaOptions {
  onSubmit?: (values: CreditApplicationForm) => void | Promise<void>;
}

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  options: CreateRenderSchemaOptions = {}
) {
  const handleSubmit = async (values: CreditApplicationForm) => {
    if (options.onSubmit) {
      await options.onSubmit(values);
      return;
    }
    // Default: log to console

    console.log('[mcp-credit-application-renderer-v8] submit', values);
    alert('Заявка успешно отправлена!');
  };

  // Patch G — A=A1: ui-kit FormWizard handles step switching internally.
  // No manual setHidden('stepN') loop needed.
  // step bodies subscribe to FieldPath<T> (path.X) — renderer-react resolves to FieldNode at render time.
  const schema = createRenderSchema<CreditApplicationForm>((path) => ({
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      form,
      config: {
        stepValidations: STEP_VALIDATIONS,
        fullValidation: creditApplicationValidation,
      },
      steps: [
        { number: 1, title: 'Кредит', icon: '💰', body: step1Body(path) },
        { number: 2, title: 'Данные', icon: '👤', body: step2Body(path) },
        { number: 3, title: 'Контакты', icon: '📞', body: step3Body(path) },
        { number: 4, title: 'Работа', icon: '💼', body: step4Body(path) },
        { number: 5, title: 'Доп. инфо', icon: '📋', body: step5Body(path) },
        { number: 6, title: 'Подтверждение', icon: '✓', body: step6Body(path) },
      ] satisfies FormWizardStep<CreditApplicationForm>[],
      onSubmit: handleSubmit,
    },
  }));

  // -------------------------------------------------------------------------
  // Conditional sub-sections — top-level hideWhen AFTER createRenderSchema.
  // form.<field>.value.value reads are tracked by Preact computed.
  // -------------------------------------------------------------------------
  hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
  hideWhen(schema.node('car-section'), () => form.loanType.value.value !== 'car');

  hideWhen(
    schema.node('residence-address-section'),
    () => form.sameAsRegistration.value.value === true
  );

  hideWhen(schema.node('employer-section'), () => form.employmentStatus.value.value !== 'employed');
  hideWhen(
    schema.node('business-section'),
    () => form.employmentStatus.value.value !== 'selfEmployed'
  );
  hideWhen(schema.node('income-section'), () => form.employmentStatus.value.value === 'unemployed');

  hideWhen(schema.node('properties-array'), () => !form.hasProperty.value.value);
  hideWhen(schema.node('existing-loans-array'), () => !form.hasExistingLoans.value.value);
  hideWhen(schema.node('co-borrowers-array'), () => !form.hasCoBorrower.value.value);

  return schema;
}

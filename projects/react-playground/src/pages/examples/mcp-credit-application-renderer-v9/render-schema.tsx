/**
 * RenderSchema for the iter-9 credit-application form (renderer-react target).
 *
 * Wizard pair: A=A1 (FormWizard from `@reformer/ui-kit/form-wizard`),
 *              B=B2 (renderer-react via `step.body: RenderNode<T>`).
 *
 * Patch J — inside the `createRenderSchema((path) => ...)` callback we ONLY
 * use `path.X` (FieldPathNode). NEVER `form.X` (FieldNode) — the renderer's
 * `isFieldRenderNode` looks for `__path`, which only `path.X` carries.
 *
 * Step containers carry `selector: 'stepN'`. ui-kit FormWizard handles step
 * switching internally (no `setHidden('stepN')` loop required for B2 with A1).
 * Conditional sub-sections (mortgage, residence-address, employer, …) get
 * their own selectors and are wired via top-level `hideWhen(proxy.node(...), …)`
 * AFTER `createRenderSchema(...)`.
 */

import type { FieldPath, FormProxy } from '@reformer/core';
import {
  createRenderSchema,
  hideWhen,
  type RenderNode,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import { Box, Section } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import { RendererFormArraySection } from '../../../components/RendererFormArraySection';
import { STEP_VALIDATIONS, creditApplicationValidation } from './schema';
import type {
  CoBorrower,
  CreditApplicationForm,
  ExistingLoan,
  Property,
} from './types';

// ============================================================================
// Step bodies — each receives `path: FieldPath<CreditApplicationForm>`
// (Patch J — never `form: FormProxy<...>`).
// ============================================================================

function step1Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    selector: 'step1',
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Основная информация о кредите',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4',
          className: 'space-y-4',
        },
        children: [
          { component: path.loanType, componentProps: { testId: 'step1.loanType' } },
          { component: path.loanAmount, componentProps: { testId: 'step1.loanAmount' } },
          { component: path.loanTerm, componentProps: { testId: 'step1.loanTerm' } },
          { component: path.loanPurpose, componentProps: { testId: 'step1.loanPurpose' } },
        ],
      },
      {
        selector: 'mortgage-section',
        component: Section,
        componentProps: {
          title: 'Информация о недвижимости',
          titleClassName: 'text-lg font-semibold mt-4',
          className: 'space-y-4',
        },
        children: [
          { component: path.propertyValue, componentProps: { testId: 'step1.propertyValue' } },
          { component: path.initialPayment, componentProps: { testId: 'step1.initialPayment' } },
        ],
      },
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
    selector: 'step2',
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Личные данные',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4',
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
    selector: 'step3',
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Контакты',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4',
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
    selector: 'step4',
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: path.employmentStatus,
        componentProps: { testId: 'step4.employmentStatus' },
      },
      {
        selector: 'employer-section',
        component: Section,
        componentProps: {
          title: 'Информация о работодателе',
          titleClassName: 'text-lg font-semibold mt-2',
          className: 'space-y-4',
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
      {
        selector: 'business-section',
        component: Section,
        componentProps: {
          title: 'Информация о бизнесе',
          titleClassName: 'text-lg font-semibold mt-2',
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
      {
        component: Section,
        componentProps: {
          title: 'Стаж',
          titleClassName: 'text-lg font-semibold mt-2',
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
        selector: 'income-section',
        component: Section,
        componentProps: {
          title: 'Доход',
          titleClassName: 'text-lg font-semibold mt-2',
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
                selector: 'additional-income-source-section',
                component: Box,
                children: [
                  {
                    component: path.additionalIncomeSource,
                    componentProps: { testId: 'step4.additionalIncomeSource' },
                  },
                ],
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
    selector: 'step5',
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Общая информация',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4',
          className: 'space-y-4',
        },
        children: [
          { component: path.maritalStatus, componentProps: { testId: 'step5.maritalStatus' } },
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
      {
        component: Section,
        componentProps: { className: 'space-y-4' },
        children: [
          { component: path.hasProperty, componentProps: { testId: 'step5.hasProperty' } },
          {
            selector: 'properties-array',
            component: RendererFormArraySection,
            componentProps: {
              title: 'Имущество',
              control: path.properties,
              itemLabel: (
                _: FormProxy<CreditApplicationForm['properties'][0]>,
                index: number,
              ) => `Имущество #${index + 1}`,
              addButtonLabel: '+ Добавить имущество',
              emptyMessage: 'Нажмите «Добавить имущество» для добавления',
              // Patch G/D3 — initialValue is plain leaves only.
              initialValue: {
                type: 'apartment',
                description: '',
                estimatedValue: 0,
                hasEncumbrance: false,
              },
              itemComponent: (itemPath: FieldPath<Property>) => ({
                component: Box,
                componentProps: { className: 'space-y-3' },
                children: [
                  { component: itemPath.type, componentProps: { testId: 'property-type' } },
                  {
                    component: itemPath.description,
                    componentProps: { testId: 'property-description' },
                  },
                  {
                    component: itemPath.estimatedValue,
                    componentProps: { testId: 'property-estimatedValue' },
                  },
                  {
                    component: itemPath.hasEncumbrance,
                    componentProps: { testId: 'property-hasEncumbrance' },
                  },
                ],
              }),
            },
          },
        ],
      },
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
            component: RendererFormArraySection,
            componentProps: {
              title: 'Существующие кредиты',
              control: path.existingLoans,
              itemLabel: (
                _: FormProxy<CreditApplicationForm['existingLoans'][0]>,
                index: number,
              ) => `Кредит #${index + 1}`,
              addButtonLabel: '+ Добавить кредит',
              emptyMessage: 'Нажмите «Добавить кредит» для добавления',
              initialValue: {
                bank: '',
                type: '',
                amount: 0,
                remainingAmount: 0,
                monthlyPayment: 0,
                maturityDate: '',
              },
              itemComponent: (itemPath: FieldPath<ExistingLoan>) => ({
                component: Box,
                componentProps: { className: 'space-y-3' },
                children: [
                  { component: itemPath.bank, componentProps: { testId: 'existingLoan-bank' } },
                  { component: itemPath.type, componentProps: { testId: 'existingLoan-type' } },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        component: itemPath.amount,
                        componentProps: { testId: 'existingLoan-amount' },
                      },
                      {
                        component: itemPath.remainingAmount,
                        componentProps: { testId: 'existingLoan-remainingAmount' },
                      },
                    ],
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        component: itemPath.monthlyPayment,
                        componentProps: { testId: 'existingLoan-monthlyPayment' },
                      },
                      {
                        component: itemPath.maturityDate,
                        componentProps: { testId: 'existingLoan-maturityDate' },
                      },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      },
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
            component: RendererFormArraySection,
            componentProps: {
              title: 'Созаемщики',
              control: path.coBorrowers,
              itemLabel: (
                _: FormProxy<CreditApplicationForm['coBorrowers'][0]>,
                index: number,
              ) => `Созаемщик #${index + 1}`,
              addButtonLabel: '+ Добавить созаемщика',
              emptyMessage: 'Нажмите «Добавить созаемщика» для добавления',
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
              itemComponent: (itemPath: FieldPath<CoBorrower>) => ({
                component: Box,
                componentProps: { className: 'space-y-3' },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      {
                        component: itemPath.personalData.lastName,
                        componentProps: { testId: 'coBorrower-lastName' },
                      },
                      {
                        component: itemPath.personalData.firstName,
                        componentProps: { testId: 'coBorrower-firstName' },
                      },
                      {
                        component: itemPath.personalData.middleName,
                        componentProps: { testId: 'coBorrower-middleName' },
                      },
                    ],
                  },
                  {
                    component: itemPath.personalData.birthDate,
                    componentProps: { testId: 'coBorrower-birthDate' },
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        component: itemPath.phone,
                        componentProps: { testId: 'coBorrower-phone' },
                      },
                      {
                        component: itemPath.email,
                        componentProps: { testId: 'coBorrower-email' },
                      },
                    ],
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        component: itemPath.relationship,
                        componentProps: { testId: 'coBorrower-relationship' },
                      },
                      {
                        component: itemPath.monthlyIncome,
                        componentProps: { testId: 'coBorrower-monthlyIncome' },
                      },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      },
    ],
  };
}

function step6Body(path: FieldPath<CreditApplicationForm>): RenderNode<CreditApplicationForm> {
  return {
    selector: 'step6',
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Сводка по заёмщику',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4',
          className: 'space-y-4',
        },
        children: [
          { component: path.fullName, componentProps: { testId: 'step6.fullName' } },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              { component: path.age, componentProps: { testId: 'step6.age' } },
              { component: path.totalIncome, componentProps: { testId: 'step6.totalIncome' } },
            ],
          },
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
            component: path.paymentToIncomeRatio,
            componentProps: { testId: 'step6.paymentToIncomeRatio' },
          },
        ],
      },
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
      {
        component: Section,
        componentProps: {
          title: 'Опциональные согласия',
          titleClassName: 'text-lg font-semibold mt-4',
        },
        children: [
          {
            component: path.agreeMarketing,
            componentProps: { testId: 'step6.agreeMarketing' },
          },
        ],
      },
      {
        component: Section,
        componentProps: {
          title: 'Электронная подпись',
          titleClassName: 'text-lg font-semibold mt-4',
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
// Public factory — `createCreditApplicationRenderSchema(form)`
// ============================================================================

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  onSubmit: (values: CreditApplicationForm) => Promise<void> | void,
): RenderSchemaProxy<CreditApplicationForm> {
  const proxy = createRenderSchema<CreditApplicationForm>((path) => {
    const steps: FormWizardStep<CreditApplicationForm>[] = [
      { number: 1, title: 'Кредит', icon: '💰', body: step1Body(path) },
      { number: 2, title: 'Данные', icon: '👤', body: step2Body(path) },
      { number: 3, title: 'Контакты', icon: '📞', body: step3Body(path) },
      { number: 4, title: 'Работа', icon: '💼', body: step4Body(path) },
      { number: 5, title: 'Доп. инфо', icon: '📋', body: step5Body(path) },
      { number: 6, title: 'Подтверждение', icon: '✓', body: step6Body(path) },
    ];

    return {
      selector: 'wizard',
      component: FormWizard,
      componentProps: {
        form,
        config: {
          stepValidations: STEP_VALIDATIONS,
          fullValidation: creditApplicationValidation,
        },
        steps,
        onSubmit,
      },
    };
  });

  // ==========================================================================
  // Conditional sub-section visibility — top-level `hideWhen` AFTER createRenderSchema(...)
  // ==========================================================================

  hideWhen(proxy.node('mortgage-section'), () => form.loanType.value !== 'mortgage');
  hideWhen(proxy.node('car-section'), () => form.loanType.value !== 'car');
  hideWhen(
    proxy.node('residence-address-section'),
    () => form.sameAsRegistration.value === true,
  );
  hideWhen(
    proxy.node('employer-section'),
    () => form.employmentStatus.value !== 'employed',
  );
  hideWhen(
    proxy.node('business-section'),
    () => form.employmentStatus.value !== 'selfEmployed',
  );
  hideWhen(
    proxy.node('income-section'),
    () => form.employmentStatus.value === 'unemployed',
  );
  hideWhen(proxy.node('properties-array'), () => form.hasProperty.value !== true);
  hideWhen(
    proxy.node('existing-loans-array'),
    () => form.hasExistingLoans.value !== true,
  );
  hideWhen(proxy.node('co-borrowers-array'), () => form.hasCoBorrower.value !== true);
  hideWhen(
    proxy.node('additional-income-source-section'),
    () => (form.additionalIncome.value ?? 0) <= 0,
  );

  return proxy;
}

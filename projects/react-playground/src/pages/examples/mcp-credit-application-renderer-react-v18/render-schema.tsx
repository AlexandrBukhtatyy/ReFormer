// Render schema — iter-18 / renderer-react.
// FormWizard как root render-node, body каждого шага = container subtree
// (component=Box) с children=field-узлы. Closure-pattern: form захватывается
// в componentProps FormWizard'а.
/* eslint-disable react-refresh/only-export-components */

import type { FormProxy } from '@reformer/core';
import { createRenderSchema, type RenderNode } from '@reformer/renderer-react';
import { Box, FormArraySection, FormField, FormWizard, Section } from '@reformer/ui-kit';
import type { FormWizardStep } from '@reformer/ui-kit/form-wizard';

import {
  STEP_VALIDATIONS,
  createCoBorrower,
  createExistingLoan,
  createPropertyItem,
} from './schema';
import type {
  CoBorrower,
  CreditApplicationForm,
  ExistingLoan,
  PropertyItem,
} from './types';

function PropertyItemForm({ control }: { control: FormProxy<PropertyItem> }) {
  return (
    <Section className="space-y-3">
      <FormField control={control.type} />
      <FormField control={control.description} />
      <FormField control={control.estimatedValue} />
      <FormField control={control.hasEncumbrance} />
    </Section>
  );
}

function ExistingLoanForm({ control }: { control: FormProxy<ExistingLoan> }) {
  return (
    <Section className="space-y-3">
      <FormField control={control.bank} />
      <FormField control={control.type} />
      <FormField control={control.amount} />
      <FormField control={control.remainingAmount} />
      <FormField control={control.monthlyPayment} />
      <FormField control={control.maturityDate} />
    </Section>
  );
}

function CoBorrowerForm({ control }: { control: FormProxy<CoBorrower> }) {
  return (
    <Section className="space-y-3">
      <FormField control={control.personalData.lastName} />
      <FormField control={control.personalData.firstName} />
      <FormField control={control.personalData.middleName} />
      <FormField control={control.personalData.birthDate} />
      <FormField control={control.personalData.gender} />
      <FormField control={control.personalData.birthPlace} />
      <FormField control={control.phone} />
      <FormField control={control.email} />
      <FormField control={control.relationship} />
      <FormField control={control.monthlyIncome} />
    </Section>
  );
}

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  onSubmit: () => void | Promise<void>
) {
  return createRenderSchema<CreditApplicationForm>((path) => {
    const step1Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        { component: path.loanType },
        { component: path.loanAmount },
        { component: path.loanTerm },
        { component: path.loanPurpose },
        { component: path.propertyValue },
        { component: path.initialPayment },
        { component: path.carBrand },
        { component: path.carModel },
        { component: path.carYear },
        { component: path.carPrice },
        { component: path.interestRate },
        { component: path.monthlyPayment },
      ],
    };

    const step2Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Личные данные', className: 'space-y-3' },
          children: [
            { component: path.personalData.lastName },
            { component: path.personalData.firstName },
            { component: path.personalData.middleName },
            { component: path.personalData.birthDate },
            { component: path.personalData.gender },
            { component: path.personalData.birthPlace },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Паспортные данные', className: 'space-y-3' },
          children: [
            { component: path.passportData.series },
            { component: path.passportData.number },
            { component: path.passportData.issueDate },
            { component: path.passportData.issuedBy },
            { component: path.passportData.departmentCode },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Документы', className: 'space-y-3' },
          children: [
            { component: path.inn },
            { component: path.snils },
            { component: path.fullName },
            { component: path.age },
          ],
        },
      ],
    };

    const step3Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Контакты', className: 'space-y-3' },
          children: [
            { component: path.phoneMain },
            { component: path.phoneAdditional },
            { component: path.email },
            { component: path.sameEmail },
            { component: path.emailAdditional },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Адрес регистрации', className: 'space-y-3' },
          children: [
            { component: path.registrationAddress.region },
            { component: path.registrationAddress.city },
            { component: path.registrationAddress.street },
            { component: path.registrationAddress.house },
            { component: path.registrationAddress.apartment },
            { component: path.registrationAddress.postalCode },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Адрес проживания', className: 'space-y-3' },
          children: [
            { component: path.sameAsRegistration },
            { component: path.residenceAddress.region },
            { component: path.residenceAddress.city },
            { component: path.residenceAddress.street },
            { component: path.residenceAddress.house },
            { component: path.residenceAddress.apartment },
            { component: path.residenceAddress.postalCode },
          ],
        },
      ],
    };

    const step4Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        { component: path.employmentStatus },
        {
          component: Section,
          componentProps: { title: 'Работа по найму', className: 'space-y-3' },
          children: [
            { component: path.companyName },
            { component: path.companyInn },
            { component: path.companyPhone },
            { component: path.companyAddress },
            { component: path.position },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Стаж и доход', className: 'space-y-3' },
          children: [
            { component: path.workExperienceTotal },
            { component: path.workExperienceCurrent },
            { component: path.monthlyIncome },
            { component: path.additionalIncome },
            { component: path.additionalIncomeSource },
            { component: path.totalIncome },
            { component: path.paymentToIncomeRatio },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Самозанятость / ИП', className: 'space-y-3' },
          children: [
            { component: path.businessType },
            { component: path.businessInn },
            { component: path.businessActivity },
          ],
        },
      ],
    };

    const step5Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        { component: path.maritalStatus },
        { component: path.dependents },
        { component: path.education },
        {
          component: Section,
          componentProps: { title: 'Имущество', className: 'space-y-3' },
          children: [
            { component: path.hasProperty },
            {
              component: FormArraySection,
              componentProps: {
                control: path.properties,
                itemComponent: PropertyItemForm,
                title: 'Имущество',
                addButtonLabel: '+ Добавить имущество',
                emptyMessage: 'Нет имущества',
                initialValue: createPropertyItem(),
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Существующие кредиты', className: 'space-y-3' },
          children: [
            { component: path.hasExistingLoans },
            {
              component: FormArraySection,
              componentProps: {
                control: path.existingLoans,
                itemComponent: ExistingLoanForm,
                title: 'Кредиты',
                addButtonLabel: '+ Добавить кредит',
                emptyMessage: 'Нет существующих кредитов',
                initialValue: createExistingLoan(),
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Созаёмщики', className: 'space-y-3' },
          children: [
            { component: path.hasCoBorrower },
            {
              component: FormArraySection,
              componentProps: {
                control: path.coBorrowers,
                itemComponent: CoBorrowerForm,
                title: 'Созаёмщики',
                addButtonLabel: '+ Добавить созаёмщика',
                emptyMessage: 'Нет созаёмщиков',
                initialValue: createCoBorrower(),
              },
            },
            { component: path.coBorrowersIncome },
          ],
        },
      ],
    };

    const step6Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        { component: path.agreePersonalData },
        { component: path.agreeCreditHistory },
        { component: path.agreeMarketing },
        { component: path.agreeTerms },
        { component: path.confirmAccuracy },
        { component: path.electronicSignature },
      ],
    };

    const steps: FormWizardStep<CreditApplicationForm>[] = [
      { number: 1, title: 'Кредит', icon: '💰', body: step1Body },
      { number: 2, title: 'Личные данные', icon: '👤', body: step2Body },
      { number: 3, title: 'Контакты', icon: '📞', body: step3Body },
      { number: 4, title: 'Работа', icon: '💼', body: step4Body },
      { number: 5, title: 'Доп. информация', icon: '📋', body: step5Body },
      { number: 6, title: 'Подтверждение', icon: '✅', body: step6Body },
    ];

    return {
      selector: 'wizard',
      component: FormWizard,
      componentProps: {
        form,
        config: {
          stepValidations: STEP_VALIDATIONS,
          fullValidation: (p: Parameters<(typeof STEP_VALIDATIONS)[1]>[0]) => {
            STEP_VALIDATIONS[1](p);
            STEP_VALIDATIONS[2](p);
            STEP_VALIDATIONS[3](p);
            STEP_VALIDATIONS[4](p);
            STEP_VALIDATIONS[5](p);
            STEP_VALIDATIONS[6](p);
          },
        },
        steps,
        onSubmit,
      },
    };
  });
}

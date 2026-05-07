// Render schema for credit application form (renderer-react v16)
// MCP-only sandbox iter-16, target=renderer-react.
//
// Pattern: FormWizard as the root render-node — FormRenderer auto-provides
// RenderContextProvider; FormWizard receives `form` via componentProps; each
// step's `body` is a RenderNode<T> (Box+children) which is rendered by ui-kit
// FormWizard via RenderNodeComponent.

import type { FC } from 'react';
import { createRenderSchema } from '@reformer/renderer-react';
import { Box, Section, FormField } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import type { FormProxy, ValidationSchemaFn } from '@reformer/core';

import type {
  CreditApplicationForm,
  CoBorrower,
  ExistingLoan,
  PropertyItem,
} from './types';
import {
  STEP_VALIDATIONS,
  fullValidation,
  createPropertyItem,
  createExistingLoan,
  createCoBorrower,
} from './schema';

// ----------------------------------------------------------------------------
// Item components for FormArraySection (FC props: { control: FormProxy<Item> })
// ----------------------------------------------------------------------------

/* eslint-disable react-refresh/only-export-components */

const PropertyItemForm: FC<{ control: FormProxy<PropertyItem> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.type} testId="property-type" />
    <FormField control={control.description} testId="property-description" />
    <FormField control={control.estimatedValue} testId="property-estimatedValue" />
    <FormField control={control.hasEncumbrance} testId="property-hasEncumbrance" />
  </div>
);

const ExistingLoanItemForm: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.bank} testId="loan-bank" />
    <FormField control={control.type} testId="loan-type" />
    <FormField control={control.amount} testId="loan-amount" />
    <FormField control={control.remainingAmount} testId="loan-remainingAmount" />
    <FormField control={control.monthlyPayment} testId="loan-monthlyPayment" />
    <FormField control={control.maturityDate} testId="loan-maturityDate" />
  </div>
);

const CoBorrowerItemForm: FC<{ control: FormProxy<CoBorrower> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.personalData.lastName} testId="coBorrower-lastName" />
    <FormField control={control.personalData.firstName} testId="coBorrower-firstName" />
    <FormField control={control.personalData.middleName} testId="coBorrower-middleName" />
    <FormField control={control.phone} testId="coBorrower-phone" />
    <FormField control={control.email} testId="coBorrower-email" />
    <FormField control={control.relationship} testId="coBorrower-relationship" />
    <FormField control={control.monthlyIncome} testId="coBorrower-monthlyIncome" />
  </div>
);

// ----------------------------------------------------------------------------
// Schema factory — closure pattern (recipe: renderer-react/overview)
// ----------------------------------------------------------------------------

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  onSubmit: () => void | Promise<void>
) {
  return createRenderSchema<CreditApplicationForm>((path) => {
    // Each step body: Box with children = RenderNode[]. RenderNodeComponent
    // resolves field-paths via `component: path.<field>`.

    const step1Body = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Основные параметры кредита', className: 'space-y-3' },
          children: [
            { component: path.loanType, componentProps: { testId: 'loanType' } },
            { component: path.loanAmount, componentProps: { testId: 'loanAmount' } },
            { component: path.loanTerm, componentProps: { testId: 'loanTerm' } },
            { component: path.loanPurpose, componentProps: { testId: 'loanPurpose' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Ипотека', className: 'space-y-3' },
          children: [
            { component: path.propertyValue, componentProps: { testId: 'propertyValue' } },
            { component: path.initialPayment, componentProps: { testId: 'initialPayment' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Автокредит', className: 'space-y-3' },
          children: [
            { component: path.carBrand, componentProps: { testId: 'carBrand' } },
            { component: path.carModel, componentProps: { testId: 'carModel' } },
            { component: path.carYear, componentProps: { testId: 'carYear' } },
            { component: path.carPrice, componentProps: { testId: 'carPrice' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Расчётные значения', className: 'space-y-3' },
          children: [
            { component: path.interestRate, componentProps: { testId: 'interestRate' } },
            { component: path.monthlyPayment, componentProps: { testId: 'monthlyPayment' } },
          ],
        },
      ],
    };

    const step2Body = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Личные данные', className: 'space-y-3' },
          children: [
            { component: path.personalData.lastName, componentProps: { testId: 'lastName' } },
            { component: path.personalData.firstName, componentProps: { testId: 'firstName' } },
            { component: path.personalData.middleName, componentProps: { testId: 'middleName' } },
            { component: path.personalData.birthDate, componentProps: { testId: 'birthDate' } },
            { component: path.personalData.gender, componentProps: { testId: 'gender' } },
            { component: path.personalData.birthPlace, componentProps: { testId: 'birthPlace' } },
            { component: path.fullName, componentProps: { testId: 'fullName' } },
            { component: path.age, componentProps: { testId: 'age' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Паспортные данные', className: 'space-y-3' },
          children: [
            { component: path.passportData.series, componentProps: { testId: 'passportSeries' } },
            { component: path.passportData.number, componentProps: { testId: 'passportNumber' } },
            { component: path.passportData.issueDate, componentProps: { testId: 'passportIssueDate' } },
            { component: path.passportData.issuedBy, componentProps: { testId: 'passportIssuedBy' } },
            { component: path.passportData.departmentCode, componentProps: { testId: 'passportDepartmentCode' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Документы', className: 'space-y-3' },
          children: [
            { component: path.inn, componentProps: { testId: 'inn' } },
            { component: path.snils, componentProps: { testId: 'snils' } },
          ],
        },
      ],
    };

    const step3Body = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Контакты', className: 'space-y-3' },
          children: [
            { component: path.phoneMain, componentProps: { testId: 'phoneMain' } },
            { component: path.phoneAdditional, componentProps: { testId: 'phoneAdditional' } },
            { component: path.email, componentProps: { testId: 'email' } },
            { component: path.sameEmail, componentProps: { testId: 'sameEmail' } },
            { component: path.emailAdditional, componentProps: { testId: 'emailAdditional' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Адрес регистрации', className: 'space-y-3' },
          children: [
            { component: path.registrationAddress.region, componentProps: { testId: 'regAddr-region' } },
            { component: path.registrationAddress.city, componentProps: { testId: 'regAddr-city' } },
            { component: path.registrationAddress.street, componentProps: { testId: 'regAddr-street' } },
            { component: path.registrationAddress.house, componentProps: { testId: 'regAddr-house' } },
            { component: path.registrationAddress.apartment, componentProps: { testId: 'regAddr-apartment' } },
            { component: path.registrationAddress.postalCode, componentProps: { testId: 'regAddr-postalCode' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Адрес проживания', className: 'space-y-3' },
          children: [
            { component: path.sameAsRegistration, componentProps: { testId: 'sameAsRegistration' } },
            { component: path.residenceAddress.region, componentProps: { testId: 'resAddr-region' } },
            { component: path.residenceAddress.city, componentProps: { testId: 'resAddr-city' } },
            { component: path.residenceAddress.street, componentProps: { testId: 'resAddr-street' } },
            { component: path.residenceAddress.house, componentProps: { testId: 'resAddr-house' } },
            { component: path.residenceAddress.apartment, componentProps: { testId: 'resAddr-apartment' } },
            { component: path.residenceAddress.postalCode, componentProps: { testId: 'resAddr-postalCode' } },
          ],
        },
      ],
    };

    const step4Body = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Занятость', className: 'space-y-3' },
          children: [
            { component: path.employmentStatus, componentProps: { testId: 'employmentStatus' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Работа по найму', className: 'space-y-3' },
          children: [
            { component: path.companyName, componentProps: { testId: 'companyName' } },
            { component: path.companyInn, componentProps: { testId: 'companyInn' } },
            { component: path.companyPhone, componentProps: { testId: 'companyPhone' } },
            { component: path.companyAddress, componentProps: { testId: 'companyAddress' } },
            { component: path.position, componentProps: { testId: 'position' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'ИП / самозанятость', className: 'space-y-3' },
          children: [
            { component: path.businessType, componentProps: { testId: 'businessType' } },
            { component: path.businessInn, componentProps: { testId: 'businessInn' } },
            { component: path.businessActivity, componentProps: { testId: 'businessActivity' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Стаж', className: 'space-y-3' },
          children: [
            { component: path.workExperienceTotal, componentProps: { testId: 'workExperienceTotal' } },
            { component: path.workExperienceCurrent, componentProps: { testId: 'workExperienceCurrent' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Доход', className: 'space-y-3' },
          children: [
            { component: path.monthlyIncome, componentProps: { testId: 'monthlyIncome' } },
            { component: path.additionalIncome, componentProps: { testId: 'additionalIncome' } },
            { component: path.additionalIncomeSource, componentProps: { testId: 'additionalIncomeSource' } },
            { component: path.totalIncome, componentProps: { testId: 'totalIncome' } },
            { component: path.paymentToIncomeRatio, componentProps: { testId: 'paymentToIncomeRatio' } },
          ],
        },
      ],
    };

    const step5Body = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Семья и образование', className: 'space-y-3' },
          children: [
            { component: path.maritalStatus, componentProps: { testId: 'maritalStatus' } },
            { component: path.dependents, componentProps: { testId: 'dependents' } },
            { component: path.education, componentProps: { testId: 'education' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Имущество', className: 'space-y-3' },
          children: [
            { component: path.hasProperty, componentProps: { testId: 'hasProperty' } },
            {
              selector: 'properties-section',
              component: FormArraySection,
              componentProps: {
                control: path.properties,
                itemComponent: PropertyItemForm,
                title: 'Имущество',
                addButtonLabel: '+ Добавить имущество',
                emptyMessage: 'Нажмите «Добавить» для добавления записи',
                initialValue: createPropertyItem(),
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Существующие кредиты', className: 'space-y-3' },
          children: [
            { component: path.hasExistingLoans, componentProps: { testId: 'hasExistingLoans' } },
            {
              selector: 'existingLoans-section',
              component: FormArraySection,
              componentProps: {
                control: path.existingLoans,
                itemComponent: ExistingLoanItemForm,
                title: 'Кредиты',
                addButtonLabel: '+ Добавить кредит',
                emptyMessage: 'Нажмите «Добавить» для добавления записи',
                initialValue: createExistingLoan(),
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Созаемщики', className: 'space-y-3' },
          children: [
            { component: path.hasCoBorrower, componentProps: { testId: 'hasCoBorrower' } },
            {
              selector: 'coBorrowers-section',
              component: FormArraySection,
              componentProps: {
                control: path.coBorrowers,
                itemComponent: CoBorrowerItemForm,
                title: 'Созаемщики',
                addButtonLabel: '+ Добавить созаемщика',
                emptyMessage: 'Нажмите «Добавить» для добавления записи',
                initialValue: createCoBorrower(),
              },
            },
            { component: path.coBorrowersIncome, componentProps: { testId: 'coBorrowersIncome' } },
          ],
        },
      ],
    };

    const step6Body = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Согласия', className: 'space-y-3' },
          children: [
            { component: path.agreePersonalData, componentProps: { testId: 'agreePersonalData' } },
            { component: path.agreeCreditHistory, componentProps: { testId: 'agreeCreditHistory' } },
            { component: path.agreeMarketing, componentProps: { testId: 'agreeMarketing' } },
            { component: path.agreeTerms, componentProps: { testId: 'agreeTerms' } },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Подтверждение', className: 'space-y-3' },
          children: [
            { component: path.confirmAccuracy, componentProps: { testId: 'confirmAccuracy' } },
            { component: path.electronicSignature, componentProps: { testId: 'electronicSignature' } },
          ],
        },
      ],
    };

    const steps: FormWizardStep<CreditApplicationForm>[] = [
      { number: 1, title: 'Кредит', icon: '💰', body: step1Body },
      { number: 2, title: 'Личные', icon: '👤', body: step2Body },
      { number: 3, title: 'Контакты', icon: '📞', body: step3Body },
      { number: 4, title: 'Работа', icon: '💼', body: step4Body },
      { number: 5, title: 'Доп. инфо', icon: '📋', body: step5Body },
      { number: 6, title: 'Подтверждение', icon: '✅', body: step6Body },
    ];

    const wizardConfig = {
      stepValidations: STEP_VALIDATIONS as Record<number, ValidationSchemaFn<CreditApplicationForm>>,
      fullValidation,
    };

    return {
      selector: 'wizard',
      component: FormWizard,
      componentProps: {
        form,
        config: wizardConfig,
        onSubmit,
        steps,
      },
    };
  });
}

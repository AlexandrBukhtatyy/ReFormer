/**
 * Render schema for the credit-application form (renderer-react v2 — page 2).
 *
 * Layout uses ui-kit `Section` + `Box`. Steps are wrapped in named `Section`s
 * so subsequent stages (5) can call `schema.node('step1').setHidden(...)` for
 * wizard navigation without touching this file.
 *
 * Stage 4 will replace the array placeholders with full FormArray UI; for now
 * we only render the `hasProperty / hasExistingLoans / hasCoBorrower` toggles.
 */
import { type FormProxy } from '@reformer/core';
import {
  createRenderSchema,
  RenderNodeComponent,
  type RenderNode,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import { Box, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';

/* -----------------------------------------------------------------
 * FormRoot — minimal user-defined root that propagates `form` down
 * (see renderer-react Quick Start). Without this, FieldRenderNodes
 * silently render to null.
 * ----------------------------------------------------------------- */
function FormRoot<T>({
  form,
  children,
}: {
  form: FormProxy<T>;
  children: RenderNode<T>[];
}) {
  return (
    <>
      {children.map((child, i) => (
        <RenderNodeComponent key={i} node={child} form={form} />
      ))}
    </>
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(FormRoot as any).__selfManagedChildren = true;

/* -----------------------------------------------------------------
 * Layout helpers.
 * ----------------------------------------------------------------- */

const rowGrid2 = 'grid grid-cols-1 md:grid-cols-2 gap-4';
const rowGrid3 = 'grid grid-cols-1 md:grid-cols-3 gap-4';
const sectionTitle = 'text-xl font-bold mb-4 text-gray-900';
const sectionShell = 'space-y-4 bg-white border rounded-lg p-6 shadow-sm';

/* -----------------------------------------------------------------
 * createCreditApplicationRenderSchema — closure factory.
 * ----------------------------------------------------------------- */
export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
): RenderSchemaProxy<CreditApplicationForm> {
  return createRenderSchema<CreditApplicationForm>((path) => ({
    component: FormRoot,
    componentProps: { form },
    children: [
      /* ============================== Step 1 ============================== */
      {
        selector: 'step1',
        component: Section,
        componentProps: {
          title: 'Шаг 1. Параметры кредита',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          { component: path.step1.loanType },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step1.loanAmount },
              { component: path.step1.loanTerm },
            ],
          },
          { component: path.step1.loanPurpose },
          {
            selector: 'step1-mortgage-row',
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step1.propertyValue },
              { component: path.step1.initialPayment },
            ],
          },
          {
            selector: 'step1-car-row',
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step1.carBrand },
              { component: path.step1.carModel },
              { component: path.step1.carYear },
              { component: path.step1.carPrice },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step1.interestRate },
              { component: path.step1.monthlyPayment },
            ],
          },
        ],
      },

      /* ============================== Step 2 ============================== */
      {
        selector: 'step2',
        component: Section,
        componentProps: {
          title: 'Шаг 2. Личные данные',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          {
            component: Box,
            componentProps: { className: rowGrid3 },
            children: [
              { component: path.step2.personalData.lastName },
              { component: path.step2.personalData.firstName },
              { component: path.step2.personalData.middleName },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid3 },
            children: [
              { component: path.step2.personalData.birthDate },
              { component: path.step2.personalData.gender },
              { component: path.step2.personalData.birthPlace },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step2.fullName },
              { component: path.step2.age },
            ],
          },
          {
            component: Section,
            componentProps: {
              title: 'Паспортные данные',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid3 },
                children: [
                  { component: path.step2.passportData.series },
                  { component: path.step2.passportData.number },
                  { component: path.step2.passportData.departmentCode },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step2.passportData.issueDate },
                  { component: path.step2.passportData.issuedBy },
                ],
              },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step2.inn },
              { component: path.step2.snils },
            ],
          },
        ],
      },

      /* ============================== Step 3 ============================== */
      {
        selector: 'step3',
        component: Section,
        componentProps: {
          title: 'Шаг 3. Контактная информация',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step3.phoneMain },
              { component: path.step3.phoneAdditional },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step3.email },
              { component: path.step3.emailAdditional },
            ],
          },
          {
            component: Section,
            componentProps: {
              title: 'Адрес регистрации',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step3.registrationAddress.region },
                  { component: path.step3.registrationAddress.city },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid3 },
                children: [
                  { component: path.step3.registrationAddress.street },
                  { component: path.step3.registrationAddress.house },
                  { component: path.step3.registrationAddress.apartment },
                ],
              },
              { component: path.step3.registrationAddress.postalCode },
            ],
          },
          { component: path.step3.sameAsRegistration },
          {
            selector: 'step3-residence',
            component: Section,
            componentProps: {
              title: 'Адрес проживания',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step3.residenceAddress.region },
                  { component: path.step3.residenceAddress.city },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid3 },
                children: [
                  { component: path.step3.residenceAddress.street },
                  { component: path.step3.residenceAddress.house },
                  { component: path.step3.residenceAddress.apartment },
                ],
              },
              { component: path.step3.residenceAddress.postalCode },
            ],
          },
        ],
      },

      /* ============================== Step 4 ============================== */
      {
        selector: 'step4',
        component: Section,
        componentProps: {
          title: 'Шаг 4. Информация о занятости',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          { component: path.step4.employmentStatus },
          {
            selector: 'step4-employed',
            component: Section,
            componentProps: {
              title: 'Работа по найму',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step4.companyName },
                  { component: path.step4.companyInn },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step4.companyPhone },
                  { component: path.step4.companyAddress },
                ],
              },
              { component: path.step4.position },
            ],
          },
          {
            selector: 'step4-self-employed',
            component: Section,
            componentProps: {
              title: 'ИП / Самозанятый',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step4.businessType },
                  { component: path.step4.businessInn },
                ],
              },
              { component: path.step4.businessActivity },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step4.workExperienceTotal },
              { component: path.step4.workExperienceCurrent },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step4.monthlyIncome },
              { component: path.step4.additionalIncome },
            ],
          },
          { component: path.step4.additionalIncomeSource },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step4.totalIncome },
              { component: path.step4.paymentToIncomeRatio },
            ],
          },
        ],
      },

      /* ============================== Step 5 ============================== */
      {
        selector: 'step5',
        component: Section,
        componentProps: {
          title: 'Шаг 5. Дополнительная информация',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          {
            component: Box,
            componentProps: { className: rowGrid3 },
            children: [
              { component: path.step5.maritalStatus },
              { component: path.step5.dependents },
              { component: path.step5.education },
            ],
          },
          { component: path.step5.hasProperty },
          { component: path.step5.hasExistingLoans },
          { component: path.step5.hasCoBorrower },
          { component: path.step5.coBorrowersIncome },
        ],
      },

      /* ============================== Step 6 ============================== */
      {
        selector: 'step6',
        component: Section,
        componentProps: {
          title: 'Шаг 6. Подтверждение и согласия',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          { component: path.step6.agreePersonalData },
          { component: path.step6.agreeCreditHistory },
          { component: path.step6.agreeMarketing },
          { component: path.step6.agreeTerms },
          { component: path.step6.confirmAccuracy },
          { component: path.step6.electronicSignature },
        ],
      },
    ],
  }));
}

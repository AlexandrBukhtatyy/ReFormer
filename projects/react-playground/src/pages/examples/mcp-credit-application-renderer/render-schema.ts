import { createRenderSchema, hideWhen, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormProxy } from '@reformer/core';
import { Box, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';
import { FormRoot } from './form-root.tsx';

// ─── Closure-pattern render schema ──────────────────────────────────────────
// IMPORTANT: ContainerRenderNode's `children` is a TOP-LEVEL property on the
// node object, NOT inside `componentProps`. The JSDoc example in
// reformer-renderer-react/src/core/types.ts (line ~140) wrongly nests children
// inside componentProps; the actual destructuring at render-node.tsx:204 reads
// `const { component, children } = node;`. Using componentProps.children leaves
// node.children undefined and the renderer produces nothing.

export function createCreditApplicationRenderSchema(form: FormProxy<CreditApplicationForm>) {
  // ── Render behavior: hide FormArray sections when their gating checkbox is off ──
  // Selectors match the three Section nodes inside Step 5 below.
  const arrayGating: RenderBehaviorFn<CreditApplicationForm> = (proxy) => {
    hideWhen(proxy.node('properties-section'), () => !form.step5.hasProperty.value.value);
    hideWhen(proxy.node('existing-loans-section'), () => !form.step5.hasExistingLoans.value.value);
    hideWhen(proxy.node('co-borrowers-section'), () => !form.step5.hasCoBorrower.value.value);
  };

  const schema = createRenderSchema<CreditApplicationForm>((path) => ({
    component: FormRoot,
    componentProps: { form },
    children: [
      // ── Сводка: computed fields (stage 3b) ───────────────────────────
      {
        component: Section,
        componentProps: { title: 'Сводка' },
        children: [
          {
            component: Box,
            children: [
              { component: path.interestRate },
              { component: path.monthlyPayment },
              { component: path.totalIncome },
              { component: path.paymentToIncomeRatio },
              { component: path.age },
              { component: path.fullName },
            ],
          },
        ],
      },

      // ── Step 1: Loan info ────────────────────────────────────────────
      {
        selector: 'step1',
        component: Section,
        componentProps: { title: 'Шаг 1: Основная информация о кредите' },
        children: [
          {
            component: Box,
            children: [
              { component: path.step1.loanType },
              { component: path.step1.loanAmount },
              { component: path.step1.loanTerm },
              { component: path.step1.loanPurpose },
              { component: path.step1.propertyValue },
              { component: path.step1.initialPayment },
              { component: path.step1.carBrand },
              { component: path.step1.carModel },
              { component: path.step1.carYear },
              { component: path.step1.carPrice },
            ],
          },
        ],
      },

      // ── Step 2: Personal data ────────────────────────────────────────
      {
        selector: 'step2',
        component: Section,
        componentProps: { title: 'Шаг 2: Персональные данные' },
        children: [
          {
            component: Box,
            children: [
              { component: path.step2.personalData.lastName },
              { component: path.step2.personalData.firstName },
              { component: path.step2.personalData.middleName },
              { component: path.step2.personalData.birthDate },
              { component: path.step2.personalData.gender },
              { component: path.step2.personalData.birthPlace },
              { component: path.step2.passportData.series },
              { component: path.step2.passportData.number },
              { component: path.step2.passportData.issueDate },
              { component: path.step2.passportData.issuedBy },
              { component: path.step2.passportData.departmentCode },
              { component: path.step2.inn },
              { component: path.step2.snils },
            ],
          },
        ],
      },

      // ── Step 3: Contact info ─────────────────────────────────────────
      {
        selector: 'step3',
        component: Section,
        componentProps: { title: 'Шаг 3: Контактная информация' },
        children: [
          {
            component: Box,
            children: [
              { component: path.step3.phoneMain },
              { component: path.step3.phoneAdditional },
              { component: path.step3.email },
              { component: path.step3.emailAdditional },
              { component: path.step3.registrationAddress.region },
              { component: path.step3.registrationAddress.city },
              { component: path.step3.registrationAddress.street },
              { component: path.step3.registrationAddress.house },
              { component: path.step3.registrationAddress.apartment },
              { component: path.step3.registrationAddress.postalCode },
              { component: path.step3.sameAsRegistration },
              { component: path.step3.residenceAddress.region },
              { component: path.step3.residenceAddress.city },
              { component: path.step3.residenceAddress.street },
              { component: path.step3.residenceAddress.house },
              { component: path.step3.residenceAddress.apartment },
              { component: path.step3.residenceAddress.postalCode },
            ],
          },
        ],
      },

      // ── Step 4: Employment ───────────────────────────────────────────
      {
        selector: 'step4',
        component: Section,
        componentProps: { title: 'Шаг 4: Информация о занятости' },
        children: [
          {
            component: Box,
            children: [
              { component: path.step4.employmentStatus },
              { component: path.step4.companyName },
              { component: path.step4.companyInn },
              { component: path.step4.companyPhone },
              { component: path.step4.companyAddress },
              { component: path.step4.position },
              { component: path.step4.workExperienceTotal },
              { component: path.step4.workExperienceCurrent },
              { component: path.step4.monthlyIncome },
              { component: path.step4.additionalIncome },
              { component: path.step4.additionalIncomeSource },
              { component: path.step4.businessType },
              { component: path.step4.businessInn },
              { component: path.step4.businessActivity },
            ],
          },
        ],
      },

      // ── Step 5: Additional info ──────────────────────────────────────
      {
        selector: 'step5',
        component: Section,
        componentProps: { title: 'Шаг 5: Дополнительная информация' },
        children: [
          {
            component: Box,
            children: [
              { component: path.step5.maritalStatus },
              { component: path.step5.dependents },
              { component: path.step5.education },
              { component: path.step5.hasProperty },
              { component: path.step5.hasExistingLoans },
              { component: path.step5.hasCoBorrower },
            ],
          },
          // FormArray sections — gated via hideWhen in arrayGating below.
          // NOTE: renderer-react has no canonical pattern for declarative
          // FormArray rendering — { component: path.arrayNode } crashes
          // FormField at runtime ('Cannot read properties of undefined
          // (reading "label")'). Idiomatic path is a custom user-side
          // ArrayList component, see RendererFormArraySection in the
          // complex-multy-step-form-renderer baseline. Out of scope for
          // the MCP-only test — we keep the section headers (so the
          // hideWhen gating is still demonstrable) but drop the items.
          {
            selector: 'properties-section',
            component: Section,
            componentProps: {
              title: 'Имущество (items not rendered — renderer-react gap)',
            },
            children: [],
          },
          {
            selector: 'existing-loans-section',
            component: Section,
            componentProps: {
              title: 'Действующие кредиты (items not rendered — renderer-react gap)',
            },
            children: [],
          },
          {
            selector: 'co-borrowers-section',
            component: Section,
            componentProps: {
              title: 'Созаемщики (items not rendered — renderer-react gap)',
            },
            children: [],
          },
        ],
      },

      // ── Step 6: Confirmation ─────────────────────────────────────────
      {
        selector: 'step6',
        component: Section,
        componentProps: { title: 'Шаг 6: Подтверждение и согласия' },
        children: [
          {
            component: Box,
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
      },
    ],
  }));

  // Apply render-level gating behavior to the schema proxy.
  arrayGating(schema);

  return schema;
}

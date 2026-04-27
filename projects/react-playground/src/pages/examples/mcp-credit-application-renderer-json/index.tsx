import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { FormField, Input, Textarea, Select, Checkbox } from '@reformer/ui-kit';
import { FormRenderer } from '@reformer/renderer-react';
import { createCreditApplicationRenderSchema } from './render-schema';
import type { CreditApplicationForm } from './types';

// ── Noop placeholder (same as in schema.ts) ───────────────────────────────────
const Noop = Input;

// ── Address sub-schema factory ────────────────────────────────────────────────
const addressSchema = () => ({
  region: { value: '', component: Input },
  city: { value: '', component: Input },
  street: { value: '', component: Input },
  house: { value: '', component: Input },
  apartment: { value: '', component: Input },
  postalCode: { value: '', component: Input },
});

const personalDataSchema = () => ({
  lastName: { value: '', component: Input },
  firstName: { value: '', component: Input },
  middleName: { value: '', component: Input },
  birthDate: { value: '', component: Input },
  gender: { value: 'male', component: Select },
  birthPlace: { value: '', component: Input },
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function McpCreditApplicationRendererJson() {
  const form = useMemo(
    () =>
      (
        createForm as (config: {
          form: unknown;
        }) => ReturnType<typeof createForm<CreditApplicationForm>>
      )({
        form: {
          step1: {
            loanType: { value: 'consumer', component: Select },
            loanAmount: { value: null, component: Input },
            loanTerm: { value: 12, component: Input },
            loanPurpose: { value: '', component: Textarea },
            propertyValue: { value: null, component: Input },
            initialPayment: { value: null, component: Noop, disabled: true },
            carBrand: { value: null, component: Input },
            carModel: { value: null, component: Input },
            carYear: { value: null, component: Input },
            carPrice: { value: null, component: Input },
            interestRate: { value: null, component: Noop, disabled: true },
            monthlyPayment: { value: null, component: Noop, disabled: true },
          },
          step2: {
            personalData: personalDataSchema(),
            passportData: {
              series: { value: '', component: Input },
              number: { value: '', component: Input },
              issueDate: { value: '', component: Input },
              issuedBy: { value: '', component: Input },
              departmentCode: { value: '', component: Input },
            },
            inn: { value: '', component: Input },
            snils: { value: '', component: Input },
            fullName: { value: '', component: Noop, disabled: true },
            age: { value: null, component: Noop, disabled: true },
          },
          step3: {
            phoneMain: { value: '', component: Input },
            phoneAdditional: { value: null, component: Input },
            email: { value: '', component: Input },
            emailAdditional: { value: null, component: Input },
            registrationAddress: addressSchema(),
            sameAsRegistration: { value: true, component: Checkbox },
            residenceAddress: addressSchema(),
          },
          step4: {
            employmentStatus: { value: 'employed', component: Select },
            companyName: { value: null, component: Input },
            companyInn: { value: null, component: Input },
            companyPhone: { value: null, component: Input },
            companyAddress: { value: null, component: Input },
            position: { value: null, component: Input },
            workExperienceTotal: { value: null, component: Input },
            workExperienceCurrent: { value: null, component: Input },
            monthlyIncome: { value: null, component: Input },
            additionalIncome: { value: null, component: Input },
            additionalIncomeSource: { value: null, component: Input },
            businessType: { value: null, component: Input },
            businessInn: { value: null, component: Input },
            businessActivity: { value: null, component: Textarea },
            totalIncome: { value: null, component: Noop, disabled: true },
            paymentToIncomeRatio: { value: null, component: Noop, disabled: true },
          },
          step5: {
            maritalStatus: { value: 'single', component: Select },
            dependents: { value: 0, component: Input },
            education: { value: 'higher', component: Select },
            hasProperty: { value: false, component: Checkbox },
            properties: [
              {
                type: { value: 'apartment', component: Select },
                description: { value: '', component: Textarea },
                estimatedValue: { value: 0, component: Input },
                hasEncumbrance: { value: false, component: Checkbox },
              },
            ],
            hasExistingLoans: { value: false, component: Checkbox },
            existingLoans: [
              {
                bank: { value: '', component: Input },
                type: { value: '', component: Input },
                amount: { value: 0, component: Input },
                remainingAmount: { value: 0, component: Input },
                monthlyPayment: { value: 0, component: Input },
                maturityDate: { value: '', component: Input },
              },
            ],
            hasCoBorrower: { value: false, component: Checkbox },
            coBorrowers: [
              {
                personalData: personalDataSchema(),
                phone: { value: '', component: Input },
                email: { value: '', component: Input },
                relationship: { value: '', component: Input },
                monthlyIncome: { value: 0, component: Input },
              },
            ],
            coBorrowersIncome: { value: null, component: Noop, disabled: true },
          },
          step6: {
            agreePersonalData: { value: false, component: Checkbox },
            agreeCreditHistory: { value: false, component: Checkbox },
            agreeMarketing: { value: false, component: Checkbox },
            agreeTerms: { value: false, component: Checkbox },
            confirmAccuracy: { value: false, component: Checkbox },
            electronicSignature: { value: '', component: Input },
          },
        },
      }),
    []
  );

  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит</h1>
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

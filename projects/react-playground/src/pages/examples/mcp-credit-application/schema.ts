import { createForm } from '@reformer/core';
import type { FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from './types';

// Stage-1 scaffold: use a no-op component placeholder so we don't need
// to import @reformer/ui-kit. Real component wiring happens in later stages.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Noop = (_props: any) => null;
Noop.displayName = 'Noop';

// ─── Reusable field-group schemas ───────────────────────────────────────────

const personalDataSchema = {
  lastName:   { value: '',     component: Noop },
  firstName:  { value: '',     component: Noop },
  middleName: { value: '',     component: Noop },
  birthDate:  { value: '',     component: Noop },
  gender:     { value: 'male', component: Noop },
  birthPlace: { value: '',     component: Noop },
};

const passportDataSchema = {
  series:         { value: '', component: Noop },
  number:         { value: '', component: Noop },
  issueDate:      { value: '', component: Noop },
  issuedBy:       { value: '', component: Noop },
  departmentCode: { value: '', component: Noop },
};

const addressSchema = {
  region:     { value: '', component: Noop },
  city:       { value: '', component: Noop },
  street:     { value: '', component: Noop },
  house:      { value: '', component: Noop },
  apartment:  { value: '', component: Noop },
  postalCode: { value: '', component: Noop },
};

// ─── FormArray item templates ───────────────────────────────────────────────

const propertyItemSchema = {
  type:           { value: 'apartment', component: Noop },
  description:    { value: '',          component: Noop },
  estimatedValue: { value: 0,           component: Noop },
  hasEncumbrance: { value: false,       component: Noop },
};

const existingLoanItemSchema = {
  bank:            { value: '', component: Noop },
  type:            { value: '', component: Noop },
  amount:          { value: 0,  component: Noop },
  remainingAmount: { value: 0,  component: Noop },
  monthlyPayment:  { value: 0,  component: Noop },
  maturityDate:    { value: '', component: Noop },
};

const coBorrowerItemSchema = {
  personalData:  personalDataSchema,
  phone:         { value: '', component: Noop },
  email:         { value: '', component: Noop },
  relationship:  { value: '', component: Noop },
  monthlyIncome: { value: 0,  component: Noop },
};

// ─── Root FormSchema ────────────────────────────────────────────────────────
// TS2589 ("type instantiation excessively deep") can occur when createForm<T>
// infers a very large recursive mapped type. The `as unknown as ...` cast
// breaks the deep inference chain while keeping the return type correct.

export const creditApplicationForm: FormProxy<CreditApplicationForm> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (createForm as (config: { form: unknown }) => FormProxy<CreditApplicationForm>)({
    form: {
      // ── Step 1: Основная информация о кредите ──────────────────────────
      step1: {
        loanType:       { value: 'consumer', component: Noop },
        loanAmount:     { value: null,       component: Noop },
        loanTerm:       { value: 12,         component: Noop },
        loanPurpose:    { value: '',         component: Noop },
        propertyValue:  { value: null,       component: Noop },
        initialPayment: { value: null,       component: Noop },
        carBrand:       { value: null,       component: Noop },
        carModel:       { value: null,       component: Noop },
        carYear:        { value: null,       component: Noop },
        carPrice:       { value: null,       component: Noop },
      },

      // ── Step 2: Персональные данные ────────────────────────────────────
      step2: {
        personalData: personalDataSchema,
        passportData: passportDataSchema,
        inn:   { value: '', component: Noop },
        snils: { value: '', component: Noop },
      },

      // ── Step 3: Контактная информация ──────────────────────────────────
      step3: {
        phoneMain:           { value: '',    component: Noop },
        phoneAdditional:     { value: null,  component: Noop },
        email:               { value: '',    component: Noop },
        emailAdditional:     { value: null,  component: Noop },
        registrationAddress: addressSchema,
        sameAsRegistration:  { value: true,  component: Noop },
        residenceAddress:    addressSchema,
      },

      // ── Step 4: Информация о занятости ─────────────────────────────────
      step4: {
        employmentStatus:       { value: 'employed', component: Noop },
        companyName:            { value: null, component: Noop },
        companyInn:             { value: null, component: Noop },
        companyPhone:           { value: null, component: Noop },
        companyAddress:         { value: null, component: Noop },
        position:               { value: null, component: Noop },
        workExperienceTotal:    { value: null, component: Noop },
        workExperienceCurrent:  { value: null, component: Noop },
        monthlyIncome:          { value: null, component: Noop },
        additionalIncome:       { value: null, component: Noop },
        additionalIncomeSource: { value: null, component: Noop },
        businessType:           { value: null, component: Noop },
        businessInn:            { value: null, component: Noop },
        businessActivity:       { value: null, component: Noop },
      },

      // ── Step 5: Дополнительная информация ─────────────────────────────
      step5: {
        maritalStatus:    { value: 'single', component: Noop },
        dependents:       { value: 0,        component: Noop },
        education:        { value: 'higher', component: Noop },
        hasProperty:      { value: false,    component: Noop },
        properties:       [propertyItemSchema],
        hasExistingLoans: { value: false,    component: Noop },
        existingLoans:    [existingLoanItemSchema],
        hasCoBorrower:    { value: false,    component: Noop },
        coBorrowers:      [coBorrowerItemSchema],
      },

      // ── Step 6: Подтверждение и согласия ──────────────────────────────
      step6: {
        agreePersonalData:   { value: false, component: Noop },
        agreeCreditHistory:  { value: false, component: Noop },
        agreeMarketing:      { value: false, component: Noop },
        agreeTerms:          { value: false, component: Noop },
        confirmAccuracy:     { value: false, component: Noop },
        electronicSignature: { value: '',    component: Noop },
      },
    },
  });

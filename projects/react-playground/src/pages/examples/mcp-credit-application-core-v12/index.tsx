// MCP-only sandbox iter-12 / target=core
// Page: multi-step credit application form via FormWizard.
import { useMemo, useRef, useState, type FC } from 'react';
import type { FormProxy } from '@reformer/core';
import { FormField, FormArraySection, FormWizard, Section } from '@reformer/ui-kit';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  createCreditForm,
  STEP_VALIDATIONS,
  fullValidation,
  propertyTemplate,
  existingLoanTemplate,
  coBorrowerTemplate,
  type CreditForm,
  type PropertyItem,
  type ExistingLoan,
  type CoBorrower,
} from './schema';

// ---------- Step body components ----------

const Step1Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const loanType = control.loanType.value.value;
  return (
    <Section className="space-y-3">
      <h3 className="text-lg font-semibold">Шаг 1. Основная информация о кредите</h3>
      <FormField control={control.loanType} testId="loanType" />
      <FormField control={control.loanAmount} testId="loanAmount" />
      <FormField control={control.loanTerm} testId="loanTerm" />
      <FormField control={control.loanPurpose} testId="loanPurpose" />
      {loanType === 'mortgage' && (
        <FormField control={control.propertyValue} testId="propertyValue" />
      )}
      {loanType === 'car' && (
        <>
          <FormField control={control.carBrand} testId="carBrand" />
          <FormField control={control.carModel} testId="carModel" />
          <FormField control={control.carYear} testId="carYear" />
          <FormField control={control.carPrice} testId="carPrice" />
        </>
      )}
      <FormField control={control.interestRate} testId="interestRate" />
      <FormField control={control.monthlyPayment} testId="monthlyPayment" />
    </Section>
  );
};

const Step2Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => (
  <Section className="space-y-3">
    <h3 className="text-lg font-semibold">Шаг 2. Личные данные</h3>
    <FormField control={control.personalData.lastName} testId="lastName" />
    <FormField control={control.personalData.firstName} testId="firstName" />
    <FormField control={control.personalData.middleName} testId="middleName" />
    <FormField control={control.personalData.birthDate} testId="birthDate" />
    <FormField control={control.personalData.gender} testId="gender" />
    <FormField control={control.personalData.birthPlace} testId="birthPlace" />
    <FormField control={control.fullName} testId="fullName" />
    <FormField control={control.passportData.series} testId="passportSeries" />
    <FormField control={control.passportData.number} testId="passportNumber" />
    <FormField control={control.passportData.issueDate} testId="passportIssueDate" />
    <FormField control={control.passportData.issuedBy} testId="passportIssuedBy" />
    <FormField control={control.passportData.departmentCode} testId="passportDepartmentCode" />
    <FormField control={control.inn} testId="inn" />
    <FormField control={control.snils} testId="snils" />
  </Section>
);

const Step3Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const sameAsRegistration = control.sameAsRegistration.value.value;
  return (
    <Section className="space-y-3">
      <h3 className="text-lg font-semibold">Шаг 3. Контактная информация</h3>
      <FormField control={control.phoneMain} testId="phoneMain" />
      <FormField control={control.phoneAdditional} testId="phoneAdditional" />
      <FormField control={control.email} testId="email" />
      <FormField control={control.emailAdditional} testId="emailAdditional" />
      <h4 className="font-medium pt-2">Адрес регистрации</h4>
      <FormField control={control.registrationAddress.region} testId="regRegion" />
      <FormField control={control.registrationAddress.city} testId="regCity" />
      <FormField control={control.registrationAddress.street} testId="regStreet" />
      <FormField control={control.registrationAddress.house} testId="regHouse" />
      <FormField control={control.registrationAddress.apartment} testId="regApartment" />
      <FormField control={control.registrationAddress.postalCode} testId="regPostalCode" />
      <FormField control={control.sameAsRegistration} testId="sameAsRegistration" />
      {!sameAsRegistration && (
        <>
          <h4 className="font-medium pt-2">Адрес проживания</h4>
          <FormField control={control.residenceAddress.region} testId="resRegion" />
          <FormField control={control.residenceAddress.city} testId="resCity" />
          <FormField control={control.residenceAddress.street} testId="resStreet" />
          <FormField control={control.residenceAddress.house} testId="resHouse" />
          <FormField control={control.residenceAddress.apartment} testId="resApartment" />
          <FormField control={control.residenceAddress.postalCode} testId="resPostalCode" />
        </>
      )}
    </Section>
  );
};

const Step4Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const status = control.employmentStatus.value.value;
  return (
    <Section className="space-y-3">
      <h3 className="text-lg font-semibold">Шаг 4. Работа и доходы</h3>
      <FormField control={control.employmentStatus} testId="employmentStatus" />
      {status === 'employed' && (
        <>
          <FormField control={control.companyName} testId="companyName" />
          <FormField control={control.companyInn} testId="companyInn" />
          <FormField control={control.companyPhone} testId="companyPhone" />
          <FormField control={control.companyAddress} testId="companyAddress" />
          <FormField control={control.position} testId="position" />
        </>
      )}
      {status === 'selfEmployed' && (
        <>
          <FormField control={control.businessType} testId="businessType" />
          <FormField control={control.businessInn} testId="businessInn" />
          <FormField control={control.businessActivity} testId="businessActivity" />
        </>
      )}
      <FormField control={control.workExperienceTotal} testId="workExperienceTotal" />
      <FormField control={control.workExperienceCurrent} testId="workExperienceCurrent" />
      <FormField control={control.monthlyIncome} testId="monthlyIncome" />
      <FormField control={control.additionalIncome} testId="additionalIncome" />
      <FormField control={control.additionalIncomeSource} testId="additionalIncomeSource" />
      <FormField control={control.totalIncome} testId="totalIncome" />
    </Section>
  );
};

// Sub-form FCs for arrays
const PropertyForm: FC<{ control: FormProxy<PropertyItem> }> = ({ control }) => (
  <div className="space-y-2">
    <FormField control={control.type} testId="property-type" />
    <FormField control={control.description} testId="property-description" />
    <FormField control={control.estimatedValue} testId="property-estimatedValue" />
    <FormField control={control.hasEncumbrance} testId="property-hasEncumbrance" />
  </div>
);

const ExistingLoanForm: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <div className="space-y-2">
    <FormField control={control.bank} testId="loan-bank" />
    <FormField control={control.type} testId="loan-type" />
    <FormField control={control.amount} testId="loan-amount" />
    <FormField control={control.remainingAmount} testId="loan-remainingAmount" />
    <FormField control={control.monthlyPayment} testId="loan-monthlyPayment" />
    <FormField control={control.maturityDate} testId="loan-maturityDate" />
  </div>
);

const CoBorrowerForm: FC<{ control: FormProxy<CoBorrower> }> = ({ control }) => (
  <div className="space-y-2">
    <FormField control={control.fullName} testId="coBorrower-fullName" />
    <FormField control={control.phone} testId="coBorrower-phone" />
    <FormField control={control.email} testId="coBorrower-email" />
    <FormField control={control.relationship} testId="coBorrower-relationship" />
    <FormField control={control.monthlyIncome} testId="coBorrower-monthlyIncome" />
  </div>
);

const Step5Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const hasProperty = control.hasProperty.value.value;
  const hasExistingLoans = control.hasExistingLoans.value.value;
  const hasCoBorrower = control.hasCoBorrower.value.value;
  return (
    <Section className="space-y-3">
      <h3 className="text-lg font-semibold">Шаг 5. Дополнительная информация</h3>
      <FormField control={control.maritalStatus} testId="maritalStatus" />
      <FormField control={control.dependents} testId="dependents" />
      <FormField control={control.education} testId="education" />
      <FormField control={control.hasProperty} testId="hasProperty" />
      {hasProperty && (
        <FormArraySection<PropertyItem>
          control={control.properties}
          itemComponent={PropertyForm}
          title="Имущество"
          addButtonLabel="+ Добавить имущество"
          emptyMessage="Нажмите, чтобы добавить имущество"
          initialValue={propertyTemplate()}
        />
      )}
      <FormField control={control.hasExistingLoans} testId="hasExistingLoans" />
      {hasExistingLoans && (
        <FormArraySection<ExistingLoan>
          control={control.existingLoans}
          itemComponent={ExistingLoanForm}
          title="Существующие кредиты"
          addButtonLabel="+ Добавить кредит"
          emptyMessage="Нажмите, чтобы добавить кредит"
          initialValue={existingLoanTemplate()}
        />
      )}
      <FormField control={control.hasCoBorrower} testId="hasCoBorrower" />
      {hasCoBorrower && (
        <FormArraySection<CoBorrower>
          control={control.coBorrowers}
          itemComponent={CoBorrowerForm}
          title="Созаемщики"
          addButtonLabel="+ Добавить созаемщика"
          emptyMessage="Нажмите, чтобы добавить созаемщика"
          initialValue={coBorrowerTemplate()}
        />
      )}
    </Section>
  );
};

const Step6Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => (
  <Section className="space-y-3">
    <h3 className="text-lg font-semibold">Шаг 6. Подтверждение и согласия</h3>
    <FormField control={control.agreePersonalData} testId="agreePersonalData" />
    <FormField control={control.agreeCreditHistory} testId="agreeCreditHistory" />
    <FormField control={control.agreeMarketing} testId="agreeMarketing" />
    <FormField control={control.agreeTerms} testId="agreeTerms" />
    <FormField control={control.confirmAccuracy} testId="confirmAccuracy" />
    <FormField control={control.electronicSignature} testId="electronicSignature" />
  </Section>
);

// ---------- Page ----------

export default function MccaCoreV12Page() {
  const form = useMemo(() => createCreditForm(), []);
  const navRef = useRef<FormWizardHandle<CreditForm>>(null);
  const [submittedJson, setSubmittedJson] = useState<string | null>(null);

  const steps = useMemo(
    () => [
      { number: 1, title: 'Кредит', icon: '💰', body: Step1Body },
      { number: 2, title: 'Личные данные', icon: '👤', body: Step2Body },
      { number: 3, title: 'Контакты', icon: '📞', body: Step3Body },
      { number: 4, title: 'Работа', icon: '💼', body: Step4Body },
      { number: 5, title: 'Дополнительно', icon: '➕', body: Step5Body },
      { number: 6, title: 'Подтверждение', icon: '✓', body: Step6Body },
    ],
    [],
  );

  const handleSubmit = async () => {
    const values = form.getValue();
    setSubmittedJson(JSON.stringify(values, null, 2));
  };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Заявка на кредит — core/v12</h1>
        <p className="text-sm text-gray-500">
          MCP-only sandbox: @reformer/core + @reformer/ui-kit (FormField, FormWizard,
          FormArraySection)
        </p>
      </header>
      <FormWizard
        ref={navRef}
        form={form}
        config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}
        steps={steps}
        onSubmit={handleSubmit}
      />
      {submittedJson && (
        <pre
          data-testid="submitted-payload"
          className="bg-gray-100 p-3 text-xs rounded overflow-auto max-h-96"
        >
          {submittedJson}
        </pre>
      )}
    </div>
  );
}

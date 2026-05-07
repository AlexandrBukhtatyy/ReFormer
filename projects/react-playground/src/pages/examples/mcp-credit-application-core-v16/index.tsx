/**
 * Credit application form — iter-16 / target=core (page entry).
 *
 * Generated through MCP-only sandbox.
 */

import { useMemo, useRef } from 'react';
import { useFormControlValue, type FormProxy } from '@reformer/core';
import {
  Box,
  Button,
  FormArraySection,
  FormField,
  Section,
} from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  createCreditApplicationFormV16,
  createEmptyCoBorrower,
  createEmptyExistingLoan,
  createEmptyPropertyItem,
  STEP_VALIDATIONS,
  fullValidation,
  type CoBorrowerItem,
  type CreditApplicationForm,
  type ExistingLoanItem,
  type PropertyItem,
} from './schema';

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

type StepProps = { control: FormProxy<CreditApplicationForm> };

function Step1Loan({ control }: StepProps) {
  const loanType = useFormControlValue(control.loanType);

  return (
    <Section title="Шаг 1. Параметры кредита" className="space-y-4">
      <FormField control={control.loanType} testId="loanType" />
      <FormField control={control.loanAmount} testId="loanAmount" />
      <FormField control={control.loanTerm} testId="loanTerm" />
      <FormField control={control.loanPurpose} testId="loanPurpose" />

      {loanType === 'mortgage' && (
        <Box className="border-l-4 border-blue-500 pl-4 space-y-4">
          <FormField control={control.propertyValue} testId="propertyValue" />
          <FormField control={control.initialPayment} testId="initialPayment" />
        </Box>
      )}

      {loanType === 'car' && (
        <Box className="border-l-4 border-green-500 pl-4 space-y-4">
          <FormField control={control.carBrand} testId="carBrand" />
          <FormField control={control.carModel} testId="carModel" />
          <FormField control={control.carYear} testId="carYear" />
          <FormField control={control.carPrice} testId="carPrice" />
        </Box>
      )}

      <Box className="border-l-4 border-gray-300 pl-4 mt-4 space-y-2">
        <FormField control={control.interestRate} testId="interestRate" />
        <FormField control={control.monthlyPayment} testId="monthlyPayment" />
      </Box>
    </Section>
  );
}

function Step2Personal({ control }: StepProps) {
  return (
    <Section title="Шаг 2. Личные данные" className="space-y-4">
      <Box className="space-y-3">
        <FormField control={control.personalData.lastName} testId="lastName" />
        <FormField control={control.personalData.firstName} testId="firstName" />
        <FormField control={control.personalData.middleName} testId="middleName" />
        <FormField control={control.personalData.birthDate} testId="birthDate" />
        <FormField control={control.personalData.gender} testId="gender" />
        <FormField control={control.personalData.birthPlace} testId="birthPlace" />
      </Box>

      <Box className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">Паспортные данные</h3>
        <FormField control={control.passportData.series} testId="passportSeries" />
        <FormField control={control.passportData.number} testId="passportNumber" />
        <FormField control={control.passportData.issueDate} testId="passportIssueDate" />
        <FormField control={control.passportData.issuedBy} testId="passportIssuedBy" />
        <FormField control={control.passportData.departmentCode} testId="passportDepartmentCode" />
      </Box>

      <Box className="border-t pt-4 space-y-3">
        <FormField control={control.inn} testId="inn" />
        <FormField control={control.snils} testId="snils" />
      </Box>

      <Box className="border-t pt-4 space-y-2 text-sm text-gray-600">
        <FormField control={control.fullName} testId="fullName" />
        <FormField control={control.age} testId="age" />
      </Box>
    </Section>
  );
}

function Step3Contacts({ control }: StepProps) {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration);

  return (
    <Section title="Шаг 3. Контакты" className="space-y-4">
      <FormField control={control.phoneMain} testId="phoneMain" />
      <FormField control={control.phoneAdditional} testId="phoneAdditional" />
      <FormField control={control.email} testId="email" />
      <FormField control={control.emailAdditional} testId="emailAdditional" />

      <Box className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">Адрес регистрации</h3>
        <FormField control={control.registrationAddress.region} testId="regAddrRegion" />
        <FormField control={control.registrationAddress.city} testId="regAddrCity" />
        <FormField control={control.registrationAddress.street} testId="regAddrStreet" />
        <FormField control={control.registrationAddress.house} testId="regAddrHouse" />
        <FormField control={control.registrationAddress.apartment} testId="regAddrApartment" />
        <FormField control={control.registrationAddress.postalCode} testId="regAddrPostalCode" />
      </Box>

      <Box className="border-t pt-4">
        <FormField control={control.sameAsRegistration} testId="sameAsRegistration" />
      </Box>

      {sameAsRegistration === false && (
        <Box className="border-l-4 border-orange-500 pl-4 space-y-3">
          <h3 className="font-semibold">Адрес проживания</h3>
          <FormField control={control.residenceAddress.region} testId="resAddrRegion" />
          <FormField control={control.residenceAddress.city} testId="resAddrCity" />
          <FormField control={control.residenceAddress.street} testId="resAddrStreet" />
          <FormField control={control.residenceAddress.house} testId="resAddrHouse" />
          <FormField control={control.residenceAddress.apartment} testId="resAddrApartment" />
          <FormField control={control.residenceAddress.postalCode} testId="resAddrPostalCode" />
        </Box>
      )}
    </Section>
  );
}

function Step4Employment({ control }: StepProps) {
  const employmentStatus = useFormControlValue(control.employmentStatus);

  return (
    <Section title="Шаг 4. Занятость" className="space-y-4">
      <FormField control={control.employmentStatus} testId="employmentStatus" />

      {employmentStatus === 'employed' && (
        <Box className="border-l-4 border-blue-500 pl-4 space-y-3">
          <h3 className="font-semibold">Работа по найму</h3>
          <FormField control={control.companyName} testId="companyName" />
          <FormField control={control.companyInn} testId="companyInn" />
          <FormField control={control.companyPhone} testId="companyPhone" />
          <FormField control={control.companyAddress} testId="companyAddress" />
          <FormField control={control.position} testId="position" />
        </Box>
      )}

      {employmentStatus === 'selfEmployed' && (
        <Box className="border-l-4 border-purple-500 pl-4 space-y-3">
          <h3 className="font-semibold">ИП / самозанятость</h3>
          <FormField control={control.businessType} testId="businessType" />
          <FormField control={control.businessInn} testId="businessInn" />
          <FormField control={control.businessActivity} testId="businessActivity" />
        </Box>
      )}

      <Box className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">Стаж</h3>
        <FormField control={control.workExperienceTotal} testId="workExperienceTotal" />
        <FormField control={control.workExperienceCurrent} testId="workExperienceCurrent" />
      </Box>

      <Box className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">Доходы</h3>
        <FormField control={control.monthlyIncome} testId="monthlyIncome" />
        <FormField control={control.additionalIncome} testId="additionalIncome" />
        <FormField control={control.additionalIncomeSource} testId="additionalIncomeSource" />
      </Box>

      <Box className="border-t pt-4 space-y-2 text-sm text-gray-600">
        <FormField control={control.totalIncome} testId="totalIncome" />
        <FormField control={control.paymentToIncomeRatio} testId="paymentToIncomeRatio" />
      </Box>
    </Section>
  );
}

// Item components for FormArraySection

function PropertyItemForm({
  control,
}: {
  control: FormProxy<PropertyItem>;
}) {
  return (
    <Box className="space-y-2">
      <FormField control={control.type} testId="property-type" />
      <FormField control={control.description} testId="property-description" />
      <FormField control={control.estimatedValue} testId="property-estimatedValue" />
      <FormField control={control.hasEncumbrance} testId="property-hasEncumbrance" />
    </Box>
  );
}

function ExistingLoanItemForm({
  control,
}: {
  control: FormProxy<ExistingLoanItem>;
}) {
  return (
    <Box className="space-y-2">
      <FormField control={control.bank} testId="loan-bank" />
      <FormField control={control.type} testId="loan-type" />
      <FormField control={control.amount} testId="loan-amount" />
      <FormField control={control.remainingAmount} testId="loan-remainingAmount" />
      <FormField control={control.monthlyPayment} testId="loan-monthlyPayment" />
      <FormField control={control.maturityDate} testId="loan-maturityDate" />
    </Box>
  );
}

function CoBorrowerItemForm({
  control,
}: {
  control: FormProxy<CoBorrowerItem>;
}) {
  return (
    <Box className="space-y-2">
      <FormField control={control.personalData.lastName} testId="cob-lastName" />
      <FormField control={control.personalData.firstName} testId="cob-firstName" />
      <FormField control={control.personalData.middleName} testId="cob-middleName" />
      <FormField control={control.personalData.birthDate} testId="cob-birthDate" />
      <FormField control={control.phone} testId="cob-phone" />
      <FormField control={control.email} testId="cob-email" />
      <FormField control={control.relationship} testId="cob-relationship" />
      <FormField control={control.monthlyIncome} testId="cob-monthlyIncome" />
    </Box>
  );
}

function Step5Additional({ control }: StepProps) {
  const hasProperty = useFormControlValue(control.hasProperty);
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower);

  return (
    <Section title="Шаг 5. Дополнительно" className="space-y-4">
      <Box className="space-y-3">
        <FormField control={control.maritalStatus} testId="maritalStatus" />
        <FormField control={control.dependents} testId="dependents" />
        <FormField control={control.education} testId="education" />
      </Box>

      <Box className="border-t pt-4 space-y-3">
        <FormField control={control.hasProperty} testId="hasProperty" />
        {hasProperty === true && (
          <FormArraySection<PropertyItem>
            control={control.properties}
            itemComponent={PropertyItemForm}
            title="Имущество"
            itemLabel="Объект"
            addButtonLabel="+ Добавить имущество"
            removeButtonLabel="Удалить"
            initialValue={createEmptyPropertyItem()}
          />
        )}
      </Box>

      <Box className="border-t pt-4 space-y-3">
        <FormField control={control.hasExistingLoans} testId="hasExistingLoans" />
        {hasExistingLoans === true && (
          <FormArraySection<ExistingLoanItem>
            control={control.existingLoans}
            itemComponent={ExistingLoanItemForm}
            title="Существующие кредиты"
            itemLabel="Кредит"
            addButtonLabel="+ Добавить кредит"
            removeButtonLabel="Удалить"
            initialValue={createEmptyExistingLoan()}
          />
        )}
      </Box>

      <Box className="border-t pt-4 space-y-3">
        <FormField control={control.hasCoBorrower} testId="hasCoBorrower" />
        {hasCoBorrower === true && (
          <FormArraySection<CoBorrowerItem>
            control={control.coBorrowers}
            itemComponent={CoBorrowerItemForm}
            title="Созаемщики"
            itemLabel="Созаемщик"
            addButtonLabel="+ Добавить созаемщика"
            removeButtonLabel="Удалить"
            initialValue={createEmptyCoBorrower()}
          />
        )}
      </Box>

      <Box className="border-t pt-4">
        <FormField control={control.coBorrowersIncome} testId="coBorrowersIncome" />
      </Box>
    </Section>
  );
}

function Step6Confirmation({ control }: StepProps) {
  return (
    <Section title="Шаг 6. Подтверждение" className="space-y-4">
      <Box className="space-y-3">
        <FormField control={control.agreePersonalData} testId="agreePersonalData" />
        <FormField control={control.agreeCreditHistory} testId="agreeCreditHistory" />
        <FormField control={control.agreeMarketing} testId="agreeMarketing" />
        <FormField control={control.agreeTerms} testId="agreeTerms" />
        <FormField control={control.confirmAccuracy} testId="confirmAccuracy" />
      </Box>
      <Box className="border-t pt-4 space-y-3">
        <FormField control={control.electronicSignature} testId="electronicSignature" />
      </Box>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function McpCreditApplicationCoreV16Page() {
  const form = useMemo(() => createCreditApplicationFormV16(), []);
  const wizardRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const steps: FormWizardStep<CreditApplicationForm>[] = useMemo(
    () => [
      { number: 1, title: 'Кредит', icon: '💰', body: Step1Loan },
      { number: 2, title: 'Личные данные', icon: '👤', body: Step2Personal },
      { number: 3, title: 'Контакты', icon: '📞', body: Step3Contacts },
      { number: 4, title: 'Работа', icon: '💼', body: Step4Employment },
      { number: 5, title: 'Доп. инфо', icon: '🏠', body: Step5Additional },
      { number: 6, title: 'Подтверждение', icon: '✅', body: Step6Confirmation },
    ],
    [],
  );

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('[mcp-credit-core-v16] submitted values', values);
    window.alert('Заявка отправлена. См. console.');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Заявка на кредит — MCP core v16</h1>
        <p className="text-sm text-gray-500">
          Сгенерировано через MCP-only sandbox; реализована полная спека (6 шагов, 8 computed,
          3 FormArray секции, async validators, async options, маски).
        </p>
      </header>

      <FormWizard
        ref={wizardRef}
        form={form}
        config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}
        steps={steps}
        onSubmit={handleSubmit}
      />

      <div className="text-xs text-gray-400 pt-6 border-t" data-testid="footer">
        target: core / iter: 16
      </div>
    </div>
  );
}

// Re-export to keep symbol for App routing
export { McpCreditApplicationCoreV16Page as McpCreditApplicationCoreV16 };

// Helper for tests — we don't actually use Button here but keep import valid
void Button;

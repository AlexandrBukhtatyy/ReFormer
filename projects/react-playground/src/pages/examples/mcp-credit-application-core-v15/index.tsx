// MCP-only sandbox — iter-15, target=core
// Page composes FormWizard from schema.ts. Steps render thin <FormField control={form.x} />.

import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import type { FormProxy } from '@reformer/core';
import { FormField, Button } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { FormArray } from '@reformer/cdk/form-array';
import { useFormControlValue } from '@reformer/core';

import {
  createCreditApplicationFormCoreV15,
  STEP_VALIDATIONS,
  fullValidation,
  type CreditApplicationForm,
  type PropertyItem,
  type ExistingLoan,
  type CoBorrower,
} from './schema';

type StepProps = { control: FormProxy<CreditApplicationForm> };

// =============================================================================
// Step 1 — Loan
// =============================================================================

const Step1Loan: FC<StepProps> = ({ control }) => {
  const loanType = useFormControlValue(control.loanType);
  return (
    <div className="space-y-4">
      <FormField control={control.loanType} testId="loanType" />
      <FormField control={control.loanAmount} testId="loanAmount" />
      <FormField control={control.loanTerm} testId="loanTerm" />
      <FormField control={control.loanPurpose} testId="loanPurpose" />
      {loanType === 'mortgage' && (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm text-blue-700">
            Поля, специфичные для ипотеки. Не забудьте подготовить документы на недвижимость.
          </div>
          <FormField control={control.propertyValue} testId="propertyValue" />
          <FormField control={control.initialPayment} testId="initialPayment" />
        </div>
      )}
      {loanType === 'car' && (
        <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm text-emerald-700">Поля, специфичные для автокредита.</div>
          <FormField control={control.carBrand} testId="carBrand" />
          <FormField control={control.carModel} testId="carModel" />
          <FormField control={control.carYear} testId="carYear" />
          <FormField control={control.carPrice} testId="carPrice" />
        </div>
      )}
      <div className="rounded bg-gray-100 p-3 text-sm">
        <div>
          Процентная ставка: <FormField control={control.interestRate} testId="interestRate" />
        </div>
        <div className="mt-2">
          Ежемесячный платёж: <FormField control={control.monthlyPayment} testId="monthlyPayment" />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Step 2 — Personal data
// =============================================================================

const Step2Personal: FC<StepProps> = ({ control }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Личные данные</h3>
    <FormField control={control.personalData.lastName} testId="personalData-lastName" />
    <FormField control={control.personalData.firstName} testId="personalData-firstName" />
    <FormField control={control.personalData.middleName} testId="personalData-middleName" />
    <FormField control={control.personalData.birthDate} testId="personalData-birthDate" />
    <FormField control={control.personalData.gender} testId="personalData-gender" />
    <FormField control={control.personalData.birthPlace} testId="personalData-birthPlace" />

    <div className="rounded bg-gray-100 p-3 text-sm">
      <FormField control={control.fullName} testId="fullName" />
      <FormField control={control.age} testId="age" />
    </div>

    <h3 className="text-lg font-semibold">Паспортные данные</h3>
    <FormField control={control.passportData.series} testId="passport-series" />
    <FormField control={control.passportData.number} testId="passport-number" />
    <FormField control={control.passportData.issueDate} testId="passport-issueDate" />
    <FormField control={control.passportData.issuedBy} testId="passport-issuedBy" />
    <FormField control={control.passportData.departmentCode} testId="passport-departmentCode" />

    <h3 className="text-lg font-semibold">Документы</h3>
    <FormField control={control.inn} testId="inn" />
    <FormField control={control.snils} testId="snils" />
  </div>
);

// =============================================================================
// Step 3 — Contacts
// =============================================================================

const Step3Contacts: FC<StepProps> = ({ control }) => {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration);
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Телефоны</h3>
      <FormField control={control.phoneMain} testId="phoneMain" />
      <FormField control={control.phoneAdditional} testId="phoneAdditional" />

      <h3 className="text-lg font-semibold">Email</h3>
      <FormField control={control.email} testId="email" />
      <FormField control={control.sameEmail} testId="sameEmail" />
      <FormField control={control.emailAdditional} testId="emailAdditional" />

      <h3 className="text-lg font-semibold">Адрес регистрации</h3>
      <FormField control={control.registrationAddress.region} testId="reg-region" />
      <FormField control={control.registrationAddress.city} testId="reg-city" />
      <FormField control={control.registrationAddress.street} testId="reg-street" />
      <FormField control={control.registrationAddress.house} testId="reg-house" />
      <FormField control={control.registrationAddress.apartment} testId="reg-apartment" />
      <FormField control={control.registrationAddress.postalCode} testId="reg-postalCode" />

      <h3 className="text-lg font-semibold">Адрес проживания</h3>
      <FormField control={control.sameAsRegistration} testId="sameAsRegistration" />
      {!sameAsRegistration && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <FormField control={control.residenceAddress.region} testId="res-region" />
          <FormField control={control.residenceAddress.city} testId="res-city" />
          <FormField control={control.residenceAddress.street} testId="res-street" />
          <FormField control={control.residenceAddress.house} testId="res-house" />
          <FormField control={control.residenceAddress.apartment} testId="res-apartment" />
          <FormField control={control.residenceAddress.postalCode} testId="res-postalCode" />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Step 4 — Employment
// =============================================================================

const Step4Employment: FC<StepProps> = ({ control }) => {
  const status = useFormControlValue(control.employmentStatus);
  return (
    <div className="space-y-4">
      <FormField control={control.employmentStatus} testId="employmentStatus" />

      {status === 'employed' && (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold">Работа по найму</h3>
          <FormField control={control.companyName} testId="companyName" />
          <FormField control={control.companyInn} testId="companyInn" />
          <FormField control={control.companyPhone} testId="companyPhone" />
          <FormField control={control.companyAddress} testId="companyAddress" />
          <FormField control={control.position} testId="position" />
        </div>
      )}

      {status === 'selfEmployed' && (
        <div className="space-y-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <h3 className="font-semibold">ИП / самозанятый</h3>
          <div className="text-sm text-purple-700">
            Для ИП потребуется подтверждение дохода (выписка, налоговая декларация).
          </div>
          <FormField control={control.businessType} testId="businessType" />
          <FormField control={control.businessInn} testId="businessInn" />
          <FormField control={control.businessActivity} testId="businessActivity" />
        </div>
      )}

      <h3 className="font-semibold">Стаж</h3>
      <FormField control={control.workExperienceTotal} testId="workExperienceTotal" />
      <FormField control={control.workExperienceCurrent} testId="workExperienceCurrent" />

      <h3 className="font-semibold">Доход</h3>
      <FormField control={control.monthlyIncome} testId="monthlyIncome" />
      <FormField control={control.additionalIncome} testId="additionalIncome" />
      <FormField control={control.additionalIncomeSource} testId="additionalIncomeSource" />

      <div className="rounded bg-gray-100 p-3 text-sm">
        <FormField control={control.totalIncome} testId="totalIncome" />
      </div>
    </div>
  );
};

// =============================================================================
// Step 5 — Additional info (arrays)
// =============================================================================

const PropertyItemForm: FC<{ control: FormProxy<PropertyItem>; index: number; remove: () => void }> = ({
  control,
  index,
  remove,
}) => (
  <div className="space-y-3 rounded border border-gray-200 p-3">
    <div className="flex items-center justify-between">
      <span className="font-medium">Имущество #{index + 1}</span>
      <Button type="button" onClick={remove} className="!bg-red-500">
        Удалить
      </Button>
    </div>
    <FormField control={control.type} testId={`property-${index}-type`} />
    <FormField control={control.description} testId={`property-${index}-description`} />
    <FormField control={control.estimatedValue} testId={`property-${index}-estimatedValue`} />
    <FormField control={control.hasEncumbrance} testId={`property-${index}-hasEncumbrance`} />
  </div>
);

const ExistingLoanForm: FC<{ control: FormProxy<ExistingLoan>; index: number; remove: () => void }> = ({
  control,
  index,
  remove,
}) => (
  <div className="space-y-3 rounded border border-gray-200 p-3">
    <div className="flex items-center justify-between">
      <span className="font-medium">Кредит #{index + 1}</span>
      <Button type="button" onClick={remove} className="!bg-red-500">
        Удалить
      </Button>
    </div>
    <FormField control={control.bank} testId={`loan-${index}-bank`} />
    <FormField control={control.type} testId={`loan-${index}-type`} />
    <FormField control={control.amount} testId={`loan-${index}-amount`} />
    <FormField control={control.remainingAmount} testId={`loan-${index}-remainingAmount`} />
    <FormField control={control.monthlyPayment} testId={`loan-${index}-monthlyPayment`} />
    <FormField control={control.maturityDate} testId={`loan-${index}-maturityDate`} />
  </div>
);

const CoBorrowerForm: FC<{ control: FormProxy<CoBorrower>; index: number; remove: () => void }> = ({
  control,
  index,
  remove,
}) => (
  <div className="space-y-3 rounded border border-gray-200 p-3">
    <div className="flex items-center justify-between">
      <span className="font-medium">Созаёмщик #{index + 1}</span>
      <Button type="button" onClick={remove} className="!bg-red-500">
        Удалить
      </Button>
    </div>
    <FormField control={control.personalData.lastName} testId={`cb-${index}-lastName`} />
    <FormField control={control.personalData.firstName} testId={`cb-${index}-firstName`} />
    <FormField control={control.personalData.middleName} testId={`cb-${index}-middleName`} />
    <FormField control={control.phone} testId={`cb-${index}-phone`} />
    <FormField control={control.email} testId={`cb-${index}-email`} />
    <FormField control={control.relationship} testId={`cb-${index}-relationship`} />
    <FormField control={control.monthlyIncome} testId={`cb-${index}-monthlyIncome`} />
  </div>
);

const Step5Additional: FC<StepProps> = ({ control }) => {
  const hasProperty = useFormControlValue(control.hasProperty);
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower);

  return (
    <div className="space-y-4">
      <FormField control={control.maritalStatus} testId="maritalStatus" />
      <FormField control={control.dependents} testId="dependents" />
      <FormField control={control.education} testId="education" />

      <h3 className="font-semibold">Имущество</h3>
      <FormField control={control.hasProperty} testId="hasProperty" />
      {hasProperty && (
        <FormArray.Root control={control.properties}>
          <FormArray.Empty>
            <p className="text-sm text-gray-500">Нет добавленного имущества</p>
          </FormArray.Empty>
          <FormArray.List>
            {({ control: itemControl, index, remove }) => (
              <PropertyItemForm control={itemControl} index={index} remove={remove} />
            )}
          </FormArray.List>
          <FormArray.AddButton>+ Добавить имущество</FormArray.AddButton>
        </FormArray.Root>
      )}

      <h3 className="font-semibold">Существующие кредиты</h3>
      <FormField control={control.hasExistingLoans} testId="hasExistingLoans" />
      {hasExistingLoans && (
        <FormArray.Root control={control.existingLoans}>
          <FormArray.Empty>
            <p className="text-sm text-gray-500">Нет добавленных кредитов</p>
          </FormArray.Empty>
          <FormArray.List>
            {({ control: itemControl, index, remove }) => (
              <ExistingLoanForm control={itemControl} index={index} remove={remove} />
            )}
          </FormArray.List>
          <FormArray.AddButton>+ Добавить кредит</FormArray.AddButton>
        </FormArray.Root>
      )}

      <h3 className="font-semibold">Созаёмщики</h3>
      <FormField control={control.hasCoBorrower} testId="hasCoBorrower" />
      {hasCoBorrower && (
        <>
          <FormArray.Root control={control.coBorrowers}>
            <FormArray.Empty>
              <p className="text-sm text-gray-500">Нет добавленных созаемщиков</p>
            </FormArray.Empty>
            <FormArray.List>
              {({ control: itemControl, index, remove }) => (
                <CoBorrowerForm control={itemControl} index={index} remove={remove} />
              )}
            </FormArray.List>
            <FormArray.AddButton>+ Добавить созаемщика</FormArray.AddButton>
          </FormArray.Root>
          <div className="rounded bg-gray-100 p-3 text-sm">
            <FormField control={control.coBorrowersIncome} testId="coBorrowersIncome" />
          </div>
        </>
      )}
    </div>
  );
};

// =============================================================================
// Step 6 — Confirmation
// =============================================================================

const Step6Confirm: FC<StepProps> = ({ control }) => (
  <div className="space-y-4">
    <h3 className="font-semibold">Согласия</h3>
    <FormField control={control.agreePersonalData} testId="agreePersonalData" />
    <FormField control={control.agreeCreditHistory} testId="agreeCreditHistory" />
    <FormField control={control.agreeMarketing} testId="agreeMarketing" />
    <FormField control={control.agreeTerms} testId="agreeTerms" />

    <h3 className="font-semibold">Подтверждение</h3>
    <FormField control={control.confirmAccuracy} testId="confirmAccuracy" />
    <FormField control={control.electronicSignature} testId="electronicSignature" />

    <div className="rounded bg-gray-100 p-3 text-sm space-y-1">
      <FormField control={control.fullName} testId="confirm-fullName" />
      <FormField control={control.age} testId="confirm-age" />
      <FormField control={control.totalIncome} testId="confirm-totalIncome" />
      <FormField control={control.monthlyPayment} testId="confirm-monthlyPayment" />
      <FormField control={control.paymentToIncomeRatio} testId="confirm-pti" />
    </div>
  </div>
);

// =============================================================================
// Page
// =============================================================================

export default function CreditApplicationCoreV15Page() {
  const form = useMemo(() => createCreditApplicationFormCoreV15(), []);
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const steps: FormWizardStep<CreditApplicationForm>[] = useMemo(
    () => [
      { number: 1, title: 'Кредит', icon: '💰', body: Step1Loan },
      { number: 2, title: 'Личные данные', icon: '👤', body: Step2Personal },
      { number: 3, title: 'Контакты', icon: '📞', body: Step3Contacts },
      { number: 4, title: 'Работа', icon: '💼', body: Step4Employment },
      { number: 5, title: 'Доп. инфо', icon: '📋', body: Step5Additional },
      { number: 6, title: 'Подтверждение', icon: '✓', body: Step6Confirm },
    ],
    []
  );

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('[mcp-credit-core-v15] submit', values);
    alert('Заявка успешно отправлена');
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Заявка на кредит (MCP core v15)</h1>
      <FormWizard
        ref={navRef}
        form={form}
        config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}
        steps={steps}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

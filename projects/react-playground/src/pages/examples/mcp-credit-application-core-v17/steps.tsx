import type { FC } from 'react';
import { FormField } from '@reformer/ui-kit';
import { FormArraySection } from '@reformer/ui-kit';
import type { FormProxy } from '@reformer/core';

import type {
  CoBorrower,
  CreditApplicationForm,
  ExistingLoan,
  PropertyItem,
} from './types';

type StepProps = { control: FormProxy<CreditApplicationForm> };

// ─── Step 1 — Loan ───────────────────────────────────────────────────────────

export const Step1: FC<StepProps> = ({ control }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Шаг 1. Основная информация о кредите</h3>
      <FormField control={control.loanType} testId="loanType" />
      <FormField control={control.loanAmount} testId="loanAmount" />
      <FormField control={control.loanTerm} testId="loanTerm" />
      <FormField control={control.loanPurpose} testId="loanPurpose" />

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Ипотека (если выбрана)</legend>
        <FormField control={control.propertyValue} testId="propertyValue" />
        <FormField control={control.initialPayment} testId="initialPayment" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Автокредит (если выбран)</legend>
        <FormField control={control.carBrand} testId="carBrand" />
        <FormField control={control.carModel} testId="carModel" />
        <FormField control={control.carYear} testId="carYear" />
        <FormField control={control.carPrice} testId="carPrice" />
      </fieldset>

      <fieldset className="rounded border border-blue-200 bg-blue-50 p-4 space-y-3">
        <legend className="text-sm text-blue-700 px-2">Расчёт (вычисляемые)</legend>
        <FormField control={control.interestRate} testId="interestRate" />
        <FormField control={control.monthlyPayment} testId="monthlyPayment" />
      </fieldset>
    </div>
  );
};

// ─── Step 2 — Personal data ──────────────────────────────────────────────────

export const Step2: FC<StepProps> = ({ control }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Шаг 2. Персональные данные</h3>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">ФИО и базовое</legend>
        <FormField control={control.personalData.lastName} testId="lastName" />
        <FormField control={control.personalData.firstName} testId="firstName" />
        <FormField control={control.personalData.middleName} testId="middleName" />
        <FormField control={control.personalData.birthDate} testId="birthDate" />
        <FormField control={control.personalData.gender} testId="gender" />
        <FormField control={control.personalData.birthPlace} testId="birthPlace" />
        <FormField control={control.fullName} testId="fullName" />
        <FormField control={control.age} testId="age" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Паспортные данные</legend>
        <FormField control={control.passportData.series} testId="series" />
        <FormField control={control.passportData.number} testId="number" />
        <FormField control={control.passportData.issueDate} testId="issueDate" />
        <FormField control={control.passportData.issuedBy} testId="issuedBy" />
        <FormField control={control.passportData.departmentCode} testId="departmentCode" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Документы</legend>
        <FormField control={control.inn} testId="inn" />
        <FormField control={control.snils} testId="snils" />
      </fieldset>
    </div>
  );
};

// ─── Step 3 — Contacts ───────────────────────────────────────────────────────

export const Step3: FC<StepProps> = ({ control }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Шаг 3. Контактная информация</h3>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Телефоны и email</legend>
        <FormField control={control.phoneMain} testId="phoneMain" />
        <FormField control={control.phoneAdditional} testId="phoneAdditional" />
        <FormField control={control.email} testId="email" />
        <FormField control={control.sameEmail} testId="sameEmail" />
        <FormField control={control.emailAdditional} testId="emailAdditional" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Адрес регистрации</legend>
        <FormField control={control.registrationAddress.region} testId="region" />
        <FormField control={control.registrationAddress.city} testId="city" />
        <FormField control={control.registrationAddress.street} testId="street" />
        <FormField control={control.registrationAddress.house} testId="house" />
        <FormField control={control.registrationAddress.apartment} testId="apartment" />
        <FormField control={control.registrationAddress.postalCode} testId="postalCode" />
      </fieldset>

      <FormField control={control.sameAsRegistration} testId="sameAsRegistration" />

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Адрес проживания</legend>
        <FormField control={control.residenceAddress.region} testId="region" />
        <FormField control={control.residenceAddress.city} testId="city" />
        <FormField control={control.residenceAddress.street} testId="street" />
        <FormField control={control.residenceAddress.house} testId="house" />
        <FormField control={control.residenceAddress.apartment} testId="apartment" />
        <FormField control={control.residenceAddress.postalCode} testId="postalCode" />
      </fieldset>
    </div>
  );
};

// ─── Step 4 — Employment ─────────────────────────────────────────────────────

export const Step4: FC<StepProps> = ({ control }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Шаг 4. Информация о занятости</h3>

      <FormField control={control.employmentStatus} testId="employmentStatus" />

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Работа по найму</legend>
        <FormField control={control.companyName} testId="companyName" />
        <FormField control={control.companyInn} testId="companyInn" />
        <FormField control={control.companyPhone} testId="companyPhone" />
        <FormField control={control.companyAddress} testId="companyAddress" />
        <FormField control={control.position} testId="position" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Стаж</legend>
        <FormField control={control.workExperienceTotal} testId="workExperienceTotal" />
        <FormField control={control.workExperienceCurrent} testId="workExperienceCurrent" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Доходы</legend>
        <FormField control={control.monthlyIncome} testId="monthlyIncome" />
        <FormField control={control.additionalIncome} testId="additionalIncome" />
        <FormField control={control.additionalIncomeSource} testId="additionalIncomeSource" />
        <FormField control={control.totalIncome} testId="totalIncome" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">ИП / Самозанятый</legend>
        <FormField control={control.businessType} testId="businessType" />
        <FormField control={control.businessInn} testId="businessInn" />
        <FormField control={control.businessActivity} testId="businessActivity" />
      </fieldset>
    </div>
  );
};

// ─── Step 5 — Additional ─────────────────────────────────────────────────────

const PropertyItemForm: FC<{ control: FormProxy<PropertyItem> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.type} testId="type" />
    <FormField control={control.description} testId="description" />
    <FormField control={control.estimatedValue} testId="estimatedValue" />
    <FormField control={control.hasEncumbrance} testId="hasEncumbrance" />
  </div>
);

const ExistingLoanForm: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.bank} testId="bank" />
    <FormField control={control.type} testId="type" />
    <FormField control={control.amount} testId="amount" />
    <FormField control={control.remainingAmount} testId="remainingAmount" />
    <FormField control={control.monthlyPayment} testId="monthlyPayment" />
    <FormField control={control.maturityDate} testId="maturityDate" />
  </div>
);

const CoBorrowerForm: FC<{ control: FormProxy<CoBorrower> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.personalData.lastName} testId="lastName" />
    <FormField control={control.personalData.firstName} testId="firstName" />
    <FormField control={control.personalData.middleName} testId="middleName" />
    <FormField control={control.phone} testId="phone" />
    <FormField control={control.email} testId="email" />
    <FormField control={control.relationship} testId="relationship" />
    <FormField control={control.monthlyIncome} testId="monthlyIncome" />
  </div>
);

export const Step5: FC<StepProps> = ({ control }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Шаг 5. Дополнительная информация</h3>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Личное</legend>
        <FormField control={control.maritalStatus} testId="maritalStatus" />
        <FormField control={control.dependents} testId="dependents" />
        <FormField control={control.education} testId="education" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Имущество</legend>
        <FormField control={control.hasProperty} testId="hasProperty" />
        <FormArraySection<PropertyItem>
          control={control.properties}
          itemComponent={PropertyItemForm}
          title="Объекты имущества"
          itemLabel="Объект"
          addButtonLabel="+ Добавить имущество"
          removeButtonLabel="Удалить"
          emptyMessage="Имущество не добавлено"
          hasItems={control.hasProperty.value.value === true}
          initialValue={{
            type: 'apartment',
            description: '',
            estimatedValue: 0,
            hasEncumbrance: false,
          }}
        />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Существующие кредиты</legend>
        <FormField control={control.hasExistingLoans} testId="hasExistingLoans" />
        <FormArraySection<ExistingLoan>
          control={control.existingLoans}
          itemComponent={ExistingLoanForm}
          title="Кредиты"
          itemLabel="Кредит"
          addButtonLabel="+ Добавить кредит"
          removeButtonLabel="Удалить"
          emptyMessage="Кредиты не добавлены"
          hasItems={control.hasExistingLoans.value.value === true}
          initialValue={{
            bank: '',
            type: '',
            amount: 0,
            remainingAmount: 0,
            monthlyPayment: 0,
            maturityDate: '',
          }}
        />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Созаемщики</legend>
        <FormField control={control.hasCoBorrower} testId="hasCoBorrower" />
        <FormArraySection<CoBorrower>
          control={control.coBorrowers}
          itemComponent={CoBorrowerForm}
          title="Созаемщики"
          itemLabel="Созаемщик"
          addButtonLabel="+ Добавить созаемщика"
          removeButtonLabel="Удалить"
          emptyMessage="Созаемщики не добавлены"
          hasItems={control.hasCoBorrower.value.value === true}
          initialValue={{
            personalData: { lastName: '', firstName: '', middleName: '' },
            phone: '',
            email: '',
            relationship: '',
            monthlyIncome: 0,
          }}
        />
        <FormField control={control.coBorrowersIncome} testId="coBorrowersIncome" />
      </fieldset>

      <fieldset className="rounded border border-blue-200 bg-blue-50 p-4 space-y-3">
        <legend className="text-sm text-blue-700 px-2">Платёжеспособность</legend>
        <FormField control={control.paymentToIncomeRatio} testId="paymentToIncomeRatio" />
      </fieldset>
    </div>
  );
};

// ─── Step 6 — Confirmation ───────────────────────────────────────────────────

export const Step6: FC<StepProps> = ({ control }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Шаг 6. Подтверждение и согласия</h3>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Согласия</legend>
        <FormField control={control.agreePersonalData} testId="agreePersonalData" />
        <FormField control={control.agreeCreditHistory} testId="agreeCreditHistory" />
        <FormField control={control.agreeMarketing} testId="agreeMarketing" />
        <FormField control={control.agreeTerms} testId="agreeTerms" />
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4 space-y-3">
        <legend className="text-sm text-gray-500 px-2">Подтверждение</legend>
        <FormField control={control.confirmAccuracy} testId="confirmAccuracy" />
        <FormField control={control.electronicSignature} testId="electronicSignature" />
      </fieldset>
    </div>
  );
};

import { useMemo, useRef, type FC } from 'react';
import type { FormProxy } from '@reformer/core';
import { FormField, FormArraySection } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  createCreditApplicationForm,
  STEP_VALIDATIONS,
  fullValidation,
  type CreditApplicationForm,
  type ExistingLoan,
} from './schema';

// ---------------- Step components ----------------

const Step1Loan: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <FormField control={control.loanType} testId="loanType" />
    <FormField control={control.loanAmount} testId="loanAmount" />
    <FormField control={control.loanTerm} testId="loanTerm" />
    <FormField control={control.loanPurpose} testId="loanPurpose" />
    <FormField control={control.propertyValue} testId="propertyValue" />
    <FormField control={control.monthlyPayment} testId="monthlyPayment" />
  </div>
);

const Step2Personal: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <FormField control={control.lastName} testId="lastName" />
    <FormField control={control.firstName} testId="firstName" />
    <FormField control={control.middleName} testId="middleName" />
    <FormField control={control.birthDate} testId="birthDate" />
    <FormField control={control.gender} testId="gender" />
    <FormField control={control.fullName} testId="fullName" />
  </div>
);

const Step3Contacts: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <FormField control={control.email} testId="email" />
    <FormField control={control.phoneMain} testId="phoneMain" />
    <FormField control={control.city} testId="city" />
    <FormField control={control.street} testId="street" />
  </div>
);

const Step4Employment: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <FormField control={control.employmentStatus} testId="employmentStatus" />
    <FormField control={control.companyName} testId="companyName" />
    <FormField control={control.monthlyIncome} testId="monthlyIncome" />
  </div>
);

const ExistingLoanItem: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.bank} testId="existingLoan-bank" />
    <FormField control={control.amount} testId="existingLoan-amount" />
    <FormField control={control.remainingAmount} testId="existingLoan-remainingAmount" />
  </div>
);

const Step5Additional: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <FormField control={control.maritalStatus} testId="maritalStatus" />
    <FormField control={control.education} testId="education" />
    <FormField control={control.hasExistingLoans} testId="hasExistingLoans" />
    <FormArraySection<ExistingLoan>
      control={control.existingLoans}
      itemComponent={ExistingLoanItem}
      title="Существующие кредиты"
      addButtonLabel="+ Добавить кредит"
      removeButtonLabel="Удалить"
      emptyMessage="Кредиты не добавлены"
      initialValue={{ bank: '', amount: null, remainingAmount: null }}
    />
  </div>
);

const Step6Confirmation: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <FormField control={control.agreePersonalData} testId="agreePersonalData" />
    <FormField control={control.agreeTerms} testId="agreeTerms" />
    <FormField control={control.confirmAccuracy} testId="confirmAccuracy" />
    <FormField control={control.smsCode} testId="smsCode" />
  </div>
);

// ---------------- Page ----------------

export default function McpCreditApplicationCoreV14Page() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const steps: FormWizardStep<CreditApplicationForm>[] = useMemo(
    () => [
      { number: 1, title: 'Кредит', icon: '💰', body: Step1Loan },
      { number: 2, title: 'Личные данные', icon: '👤', body: Step2Personal },
      { number: 3, title: 'Контакты', icon: '📞', body: Step3Contacts },
      { number: 4, title: 'Работа', icon: '💼', body: Step4Employment },
      { number: 5, title: 'Дополнительно', icon: '📋', body: Step5Additional },
      { number: 6, title: 'Подтверждение', icon: '✅', body: Step6Confirmation },
    ],
    []
  );

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('[mcp-core-v14] submitted', values);
    alert('Заявка отправлена!');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Заявка на кредит (MCP iter-14, target=core)</h1>
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

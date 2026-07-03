// index.tsx — Заявка на кредит (core target, iter-20).
// createModel → buildCreditSchema → createForm({ model, schema, behavior }) → FormWizard.
// Все 6 шагов inline (FC-bodies), массивы inline через FormArraySection. Schema-driven UI.
import { useEffect, useMemo, type FC } from 'react';
import { createForm, useFormControlValue, type FormProxy } from '@reformer/core';
import { FormField, Section } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import { FormArraySection } from '@reformer/ui-kit/form-array';

import { creditBehavior } from './form.behavior';
import { buildCreditSchema } from './form.schema';
import { makeValidationConfig } from './validation';
import { blankCoBorrower, blankExistingLoan, blankProperty, createCreditModel } from './model';
import { loadApplication, submitApplication } from './api';
import type { CoBorrower, CreditForm, ExistingLoan, FormMode, Property } from './types';

// ============================================================================
// Array item forms
// ============================================================================

const PropertyItemForm: FC<{ control: FormProxy<Property> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.type} />
    <FormField control={control.description} />
    <FormField control={control.estimatedValue} />
    <FormField control={control.hasEncumbrance} />
  </div>
);

const ExistingLoanItemForm: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.bank} />
    <FormField control={control.type} />
    <FormField control={control.amount} />
    <FormField control={control.remainingAmount} />
    <FormField control={control.monthlyPayment} />
    <FormField control={control.maturityDate} />
  </div>
);

const CoBorrowerItemForm: FC<{ control: FormProxy<CoBorrower> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.personalData.lastName} />
    <FormField control={control.personalData.firstName} />
    <FormField control={control.personalData.middleName} />
    <FormField control={control.personalData.birthDate} />
    <FormField control={control.personalData.gender} />
    <FormField control={control.personalData.birthPlace} />
    <FormField control={control.phone} />
    <FormField control={control.email} />
    <FormField control={control.relationship} />
    <FormField control={control.monthlyIncome} />
  </div>
);

// ============================================================================
// Step bodies (inline)
// ============================================================================

const Step1Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const loanType = useFormControlValue(control.loanType);
  return (
    <Section title="Основная информация о кредите" className="space-y-4">
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      <FormField control={control.loanTerm} />
      <FormField control={control.loanPurpose} />
      {loanType === 'mortgage' && (
        <>
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </>
      )}
      {loanType === 'car' && (
        <>
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <FormField control={control.carYear} />
          <FormField control={control.carPrice} />
        </>
      )}
      <FormField control={control.interestRate} />
      <FormField control={control.monthlyPayment} />
    </Section>
  );
};

const Step2Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => (
  <Section title="Персональные данные" className="space-y-4">
    <FormField control={control.personalData.lastName} />
    <FormField control={control.personalData.firstName} />
    <FormField control={control.personalData.middleName} />
    <FormField control={control.personalData.birthDate} />
    <FormField control={control.personalData.gender} />
    <FormField control={control.personalData.birthPlace} />
    <FormField control={control.passportData.series} />
    <FormField control={control.passportData.number} />
    <FormField control={control.passportData.issueDate} />
    <FormField control={control.passportData.issuedBy} />
    <FormField control={control.passportData.departmentCode} />
    <FormField control={control.inn} />
    <FormField control={control.snils} />
    <FormField control={control.fullName} />
    <FormField control={control.age} />
  </Section>
);

const Step3Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration);
  return (
    <Section title="Контактная информация" className="space-y-4">
      <FormField control={control.phoneMain} />
      <FormField control={control.phoneAdditional} />
      <FormField control={control.email} />
      <FormField control={control.emailAdditional} />
      <FormField control={control.sameEmail} />

      <h4 className="font-medium">Адрес регистрации</h4>
      <FormField control={control.registrationAddress.region} />
      <FormField control={control.registrationAddress.city} />
      <FormField control={control.registrationAddress.street} />
      <FormField control={control.registrationAddress.house} />
      <FormField control={control.registrationAddress.apartment} />
      <FormField control={control.registrationAddress.postalCode} />

      <FormField control={control.sameAsRegistration} />
      {!sameAsRegistration && (
        <>
          <h4 className="font-medium">Адрес проживания</h4>
          <FormField control={control.residenceAddress.region} />
          <FormField control={control.residenceAddress.city} />
          <FormField control={control.residenceAddress.street} />
          <FormField control={control.residenceAddress.house} />
          <FormField control={control.residenceAddress.apartment} />
          <FormField control={control.residenceAddress.postalCode} />
        </>
      )}
    </Section>
  );
};

const Step4Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const employmentStatus = useFormControlValue(control.employmentStatus);
  return (
    <Section title="Информация о занятости" className="space-y-4">
      <FormField control={control.employmentStatus} />
      {employmentStatus === 'employed' && (
        <>
          <FormField control={control.companyName} />
          <FormField control={control.companyInn} />
          <FormField control={control.companyPhone} />
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
        </>
      )}
      {employmentStatus === 'selfEmployed' && (
        <>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </>
      )}
      <FormField control={control.workExperienceTotal} />
      <FormField control={control.workExperienceCurrent} />
      <FormField control={control.monthlyIncome} />
      <FormField control={control.additionalIncome} />
      <FormField control={control.additionalIncomeSource} />
      <FormField control={control.totalIncome} />
      <FormField control={control.paymentToIncomeRatio} />
    </Section>
  );
};

const Step5Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => {
  const hasProperty = useFormControlValue(control.hasProperty);
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower);
  return (
    <Section title="Дополнительная информация" className="space-y-4">
      <FormField control={control.maritalStatus} />
      <FormField control={control.dependents} />
      <FormField control={control.education} />

      <FormField control={control.hasProperty} />
      {hasProperty && (
        <FormArraySection
          control={control.properties}
          itemComponent={PropertyItemForm}
          title="Имущество"
          addButtonLabel="+ Добавить имущество"
          emptyMessage="Нажмите «Добавить имущество» для добавления записи"
          initialValue={blankProperty()}
        />
      )}

      <FormField control={control.hasExistingLoans} />
      {hasExistingLoans && (
        <FormArraySection
          control={control.existingLoans}
          itemComponent={ExistingLoanItemForm}
          title="Существующие кредиты"
          addButtonLabel="+ Добавить кредит"
          emptyMessage="Нажмите «Добавить кредит» для добавления записи"
          initialValue={blankExistingLoan()}
        />
      )}

      <FormField control={control.hasCoBorrower} />
      {hasCoBorrower && (
        <>
          <FormArraySection
            control={control.coBorrowers}
            itemComponent={CoBorrowerItemForm}
            title="Созаёмщики"
            addButtonLabel="+ Добавить созаёмщика"
            emptyMessage="Нажмите «Добавить созаёмщика» для добавления записи"
            initialValue={blankCoBorrower()}
          />
          <FormField control={control.coBorrowersIncome} />
        </>
      )}
    </Section>
  );
};

const Step6Body: FC<{ control: FormProxy<CreditForm> }> = ({ control }) => (
  <Section title="Подтверждение и согласия" className="space-y-4">
    <FormField control={control.agreePersonalData} />
    <FormField control={control.agreeCreditHistory} />
    <FormField control={control.agreeMarketing} />
    <FormField control={control.agreeTerms} />
    <FormField control={control.confirmAccuracy} />
    <FormField control={control.electronicSignature} />

    <h4 className="font-medium">Итоговая информация</h4>
    <FormField control={control.fullName} />
    <FormField control={control.interestRate} />
    <FormField control={control.monthlyPayment} />
    <FormField control={control.totalIncome} />
    <FormField control={control.paymentToIncomeRatio} />
  </Section>
);

// ============================================================================
// Page
// ============================================================================

type PageProps = {
  applicationId?: string | null;
  mode?: FormMode;
};

const STEPS: FormWizardStep<CreditForm>[] = [
  { number: 1, title: 'Кредит', icon: '💰', body: Step1Body },
  { number: 2, title: 'Личные данные', icon: '👤', body: Step2Body },
  { number: 3, title: 'Контакты', icon: '📞', body: Step3Body },
  { number: 4, title: 'Работа', icon: '💼', body: Step4Body },
  { number: 5, title: 'Дополнительно', icon: '📋', body: Step5Body },
  { number: 6, title: 'Подтверждение', icon: '✅', body: Step6Body },
];

export default function McpCreditApplicationCoreV20({
  applicationId = null,
  mode = 'create',
}: PageProps) {
  const { form, model, config } = useMemo(() => {
    const model = createCreditModel();
    const schema = buildCreditSchema(model, mode === 'view');
    const form = createForm<CreditForm>({ model, schema, behavior: creditBehavior });
    const config = makeValidationConfig(model);
    return { form, model, config };
  }, [mode]);

  useEffect(() => {
    if (!applicationId) return;
    let active = true;
    void loadApplication(applicationId).then((res) => {
      if (active && res.success) model.patch(res.data);
    });
    return () => {
      active = false;
    };
  }, [applicationId, model]);

  const handleSubmit = async () => {
    const res = await submitApplication(model.get());
    if (res.success) {
      alert(res.data.message);
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6" data-testid="credit-application-core-v20">
      <h1 className="mb-6 text-2xl font-bold">Заявка на кредит</h1>
      <FormWizard form={form} steps={STEPS} config={config} onSubmit={handleSubmit} />
    </div>
  );
}

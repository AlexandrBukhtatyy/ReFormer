/**
 * MCP Credit Application v9 — target=core (plain React + @reformer/core + @reformer/ui-kit)
 *
 * Iter-9 regression page. Verifies:
 * - Patch G — FormWizard hierarchy A1: ui-kit FormWizard (default for projects with @reformer/ui-kit dep).
 * - Pair B1 — JSX-conditional sub-sections inside step bodies (loanType-, employmentStatus-,
 *   sameAsRegistration-, hasProperty-, hasExistingLoans-, hasCoBorrower-driven hide/show).
 * - Patch H — `readOnly: true` (camelCase) on computed fields + `maxLength` (camelCase)
 *   on textarea, in schema.ts.
 * - Patch I — computeFrom subscribes to group node `[path.personalData]` for fullName/age,
 *   no `as never` cast.
 * - Patches J/K — N/A for target=core (use `form.X` directly; `model`/`selector` semantics
 *   are JSON-renderer specific). Verified by absence of regressions.
 * - D1 — Select/RadioGroup carry `options` in createForm schema.
 * - D3 — FormArray.AddButton initialValue = plain primitive item factory.
 *
 * Dev-only fixture button: `data-testid="fill-fake-data"` calls form.setValue(happyPathFixture).
 */

import { memo, useMemo, useRef, type FC } from 'react';
import type { FormProxy } from '@reformer/core';
import { useFormControlValue } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { FormArraySection } from '@reformer/ui-kit/form-array';

import {
  createCreditApplicationForm,
  createPropertyItem,
  createExistingLoanItem,
  createCoBorrowerItem,
  STEP_VALIDATIONS,
  fullValidation,
} from './schema';
import type {
  CreditApplicationForm,
  PropertyItem,
  ExistingLoanItem,
  CoBorrowerItem,
} from './types';
import { happyPathFixture } from './data-fixture';

// ============================================================================
// Step 1 — основная информация о кредите
// ============================================================================

const Step1Body: FC<{ control: FormProxy<CreditApplicationForm> }> = memo(({ control }) => {
  const loanType = useFormControlValue(control.loanType) as string;
  const isMortgage = loanType === 'mortgage';
  const isCar = loanType === 'car';
  const showLoanPurpose = loanType !== 'mortgage' && loanType !== 'car';

  return (
    <div className="space-y-4" data-testid="step-1">
      <FormField control={control.loanType} testId="step1.loanType" />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.loanAmount} testId="step1.loanAmount" />
        <FormField control={control.loanTerm} testId="step1.loanTerm" />
      </div>
      {showLoanPurpose && <FormField control={control.loanPurpose} testId="step1.loanPurpose" />}
      {isMortgage && (
        <div className="space-y-3 border-l-4 border-blue-200 pl-4" data-testid="step1.mortgage">
          <h4 className="text-sm font-semibold text-blue-900">Параметры ипотеки</h4>
          <FormField control={control.propertyValue} testId="step1.propertyValue" />
          <FormField control={control.initialPayment} testId="step1.initialPayment" />
        </div>
      )}
      {isCar && (
        <div className="space-y-3 border-l-4 border-emerald-200 pl-4" data-testid="step1.car">
          <h4 className="text-sm font-semibold text-emerald-900">Параметры автокредита</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carBrand} testId="step1.carBrand" />
            <FormField control={control.carModel} testId="step1.carModel" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} testId="step1.carYear" />
            <FormField control={control.carPrice} testId="step1.carPrice" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
        <FormField control={control.interestRate} testId="step1.interestRate" />
        <FormField control={control.monthlyPayment} testId="step1.monthlyPayment" />
      </div>
    </div>
  );
});
Step1Body.displayName = 'Step1Body';

// ============================================================================
// Step 2 — персональные данные + паспорт
// ============================================================================

const Step2Body: FC<{ control: FormProxy<CreditApplicationForm> }> = memo(({ control }) => {
  return (
    <div className="space-y-6" data-testid="step-2">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Личные данные</h3>
        <div className="grid grid-cols-3 gap-4">
          <FormField control={control.personalData.lastName} testId="step2.personalData.lastName" />
          <FormField
            control={control.personalData.firstName}
            testId="step2.personalData.firstName"
          />
          <FormField
            control={control.personalData.middleName}
            testId="step2.personalData.middleName"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control.personalData.birthDate}
            testId="step2.personalData.birthDate"
          />
          <FormField control={control.personalData.gender} testId="step2.personalData.gender" />
        </div>
        <FormField
          control={control.personalData.birthPlace}
          testId="step2.personalData.birthPlace"
        />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <FormField control={control.fullName} testId="step2.fullName" />
          <FormField control={control.age} testId="step2.age" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Паспортные данные</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.passportData.series} testId="step2.passportData.series" />
          <FormField control={control.passportData.number} testId="step2.passportData.number" />
        </div>
        <FormField control={control.passportData.issuedBy} testId="step2.passportData.issuedBy" />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control.passportData.issueDate}
            testId="step2.passportData.issueDate"
          />
          <FormField
            control={control.passportData.departmentCode}
            testId="step2.passportData.departmentCode"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Документы</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.inn} testId="step2.inn" />
          <FormField control={control.snils} testId="step2.snils" />
        </div>
      </section>
    </div>
  );
});
Step2Body.displayName = 'Step2Body';

// ============================================================================
// Step 3 — контактная информация
// ============================================================================

const Step3Body: FC<{ control: FormProxy<CreditApplicationForm> }> = memo(({ control }) => {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration) as boolean;

  return (
    <div className="space-y-6" data-testid="step-3">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Контакты</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.phoneMain} testId="step3.phoneMain" />
          <FormField control={control.phoneAdditional} testId="step3.phoneAdditional" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.email} testId="step3.email" />
          <FormField control={control.emailAdditional} testId="step3.emailAdditional" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Адрес регистрации</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control.registrationAddress.region}
            testId="step3.registrationAddress.region"
          />
          <FormField
            control={control.registrationAddress.city}
            testId="step3.registrationAddress.city"
          />
        </div>
        <FormField
          control={control.registrationAddress.street}
          testId="step3.registrationAddress.street"
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={control.registrationAddress.house}
            testId="step3.registrationAddress.house"
          />
          <FormField
            control={control.registrationAddress.apartment}
            testId="step3.registrationAddress.apartment"
          />
          <FormField
            control={control.registrationAddress.postalCode}
            testId="step3.registrationAddress.postalCode"
          />
        </div>
      </section>

      <section className="space-y-4">
        <FormField control={control.sameAsRegistration} testId="step3.sameAsRegistration" />
        {!sameAsRegistration && (
          <div className="space-y-4 border-l-4 border-orange-200 pl-4">
            <h3 className="text-lg font-semibold">Адрес проживания</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={control.residenceAddress.region}
                testId="step3.residenceAddress.region"
              />
              <FormField
                control={control.residenceAddress.city}
                testId="step3.residenceAddress.city"
              />
            </div>
            <FormField
              control={control.residenceAddress.street}
              testId="step3.residenceAddress.street"
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={control.residenceAddress.house}
                testId="step3.residenceAddress.house"
              />
              <FormField
                control={control.residenceAddress.apartment}
                testId="step3.residenceAddress.apartment"
              />
              <FormField
                control={control.residenceAddress.postalCode}
                testId="step3.residenceAddress.postalCode"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
});
Step3Body.displayName = 'Step3Body';

// ============================================================================
// Step 4 — занятость
// ============================================================================

const Step4Body: FC<{ control: FormProxy<CreditApplicationForm> }> = memo(({ control }) => {
  const employmentStatus = useFormControlValue(control.employmentStatus) as string;
  const isEmployed = employmentStatus === 'employed';
  const isSelfEmployed = employmentStatus === 'selfEmployed';

  return (
    <div className="space-y-6" data-testid="step-4">
      <FormField control={control.employmentStatus} testId="step4.employmentStatus" />

      {isEmployed && (
        <section className="space-y-4 border-l-4 border-blue-200 pl-4" data-testid="step4.employed">
          <h3 className="text-lg font-semibold">Работа по найму</h3>
          <FormField control={control.companyName} testId="step4.companyName" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.companyInn} testId="step4.companyInn" />
            <FormField control={control.companyPhone} testId="step4.companyPhone" />
          </div>
          <FormField control={control.companyAddress} testId="step4.companyAddress" />
          <FormField control={control.position} testId="step4.position" />
        </section>
      )}

      {isSelfEmployed && (
        <section
          className="space-y-4 border-l-4 border-emerald-200 pl-4"
          data-testid="step4.selfEmployed"
        >
          <h3 className="text-lg font-semibold">Индивидуальный предприниматель</h3>
          <FormField control={control.businessType} testId="step4.businessType" />
          <FormField control={control.businessInn} testId="step4.businessInn" />
          <FormField control={control.businessActivity} testId="step4.businessActivity" />
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Стаж</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.workExperienceTotal} testId="step4.workExperienceTotal" />
          <FormField control={control.workExperienceCurrent} testId="step4.workExperienceCurrent" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Доходы</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.monthlyIncome} testId="step4.monthlyIncome" />
          <FormField control={control.additionalIncome} testId="step4.additionalIncome" />
        </div>
        <FormField control={control.additionalIncomeSource} testId="step4.additionalIncomeSource" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <FormField control={control.totalIncome} testId="step4.totalIncome" />
          <FormField control={control.paymentToIncomeRatio} testId="step4.paymentToIncomeRatio" />
        </div>
      </section>
    </div>
  );
});
Step4Body.displayName = 'Step4Body';

// ============================================================================
// Step 5 — дополнительная информация (FormArrays!)
// ============================================================================

const PropertyItemForm: FC<{ control: FormProxy<PropertyItem> }> = memo(({ control }) => {
  return (
    <div className="space-y-3">
      <FormField control={control.type} testId="step5.property.type" />
      <FormField control={control.description} testId="step5.property.description" />
      <FormField control={control.estimatedValue} testId="step5.property.estimatedValue" />
      <FormField control={control.hasEncumbrance} testId="step5.property.hasEncumbrance" />
    </div>
  );
});
PropertyItemForm.displayName = 'PropertyItemForm';

const ExistingLoanItemForm: FC<{ control: FormProxy<ExistingLoanItem> }> = memo(({ control }) => {
  return (
    <div className="space-y-3">
      <FormField control={control.bank} testId="step5.existingLoan.bank" />
      <FormField control={control.type} testId="step5.existingLoan.type" />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={control.amount} testId="step5.existingLoan.amount" />
        <FormField control={control.remainingAmount} testId="step5.existingLoan.remainingAmount" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={control.monthlyPayment} testId="step5.existingLoan.monthlyPayment" />
        <FormField control={control.maturityDate} testId="step5.existingLoan.maturityDate" />
      </div>
    </div>
  );
});
ExistingLoanItemForm.displayName = 'ExistingLoanItemForm';

const CoBorrowerItemForm: FC<{ control: FormProxy<CoBorrowerItem> }> = memo(({ control }) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <FormField control={control.personalData.lastName} testId="step5.coBorrower.lastName" />
        <FormField control={control.personalData.firstName} testId="step5.coBorrower.firstName" />
        <FormField control={control.personalData.middleName} testId="step5.coBorrower.middleName" />
      </div>
      <FormField control={control.personalData.birthDate} testId="step5.coBorrower.birthDate" />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={control.phone} testId="step5.coBorrower.phone" />
        <FormField control={control.email} testId="step5.coBorrower.email" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={control.relationship} testId="step5.coBorrower.relationship" />
        <FormField control={control.monthlyIncome} testId="step5.coBorrower.monthlyIncome" />
      </div>
    </div>
  );
});
CoBorrowerItemForm.displayName = 'CoBorrowerItemForm';

const Step5Body: FC<{ control: FormProxy<CreditApplicationForm> }> = memo(({ control }) => {
  const hasProperty = useFormControlValue(control.hasProperty) as boolean;
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans) as boolean;
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower) as boolean;

  return (
    <div className="space-y-6" data-testid="step-5">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Личное</h3>
        <FormField control={control.maritalStatus} testId="step5.maritalStatus" />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.dependents} testId="step5.dependents" />
          <FormField control={control.education} testId="step5.education" />
        </div>
      </section>

      <section className="space-y-4">
        <FormField control={control.hasProperty} testId="step5.hasProperty" />
        <FormArraySection
          title="Имущество"
          control={control.properties}
          itemComponent={PropertyItemForm}
          itemLabel="Имущество"
          addButtonLabel="+ Добавить имущество"
          emptyMessage='Нажмите "Добавить имущество" для добавления записи'
          hasItems={hasProperty}
          initialValue={createPropertyItem()}
        />
      </section>

      <section className="space-y-4">
        <FormField control={control.hasExistingLoans} testId="step5.hasExistingLoans" />
        <FormArraySection
          title="Существующие кредиты"
          control={control.existingLoans}
          itemComponent={ExistingLoanItemForm}
          itemLabel="Кредит"
          addButtonLabel="+ Добавить кредит"
          emptyMessage='Нажмите "Добавить кредит" для добавления записи'
          hasItems={hasExistingLoans}
          initialValue={createExistingLoanItem()}
        />
      </section>

      <section className="space-y-4">
        <FormField control={control.hasCoBorrower} testId="step5.hasCoBorrower" />
        <FormArraySection
          title="Созаемщики"
          control={control.coBorrowers}
          itemComponent={CoBorrowerItemForm}
          itemLabel="Созаемщик"
          addButtonLabel="+ Добавить созаемщика"
          emptyMessage='Нажмите "Добавить созаемщика" для добавления записи'
          hasItems={hasCoBorrower}
          initialValue={createCoBorrowerItem()}
        />
        <FormField control={control.coBorrowersIncome} testId="step5.coBorrowersIncome" />
      </section>
    </div>
  );
});
Step5Body.displayName = 'Step5Body';

// ============================================================================
// Step 6 — подтверждение
// ============================================================================

const Step6Body: FC<{ control: FormProxy<CreditApplicationForm> }> = memo(({ control }) => {
  return (
    <div className="space-y-4" data-testid="step-6">
      <h3 className="text-lg font-semibold">Согласия</h3>
      <FormField control={control.agreePersonalData} testId="step6.agreePersonalData" />
      <FormField control={control.agreeCreditHistory} testId="step6.agreeCreditHistory" />
      <FormField control={control.agreeMarketing} testId="step6.agreeMarketing" />
      <FormField control={control.agreeTerms} testId="step6.agreeTerms" />
      <FormField control={control.confirmAccuracy} testId="step6.confirmAccuracy" />
      <div className="pt-3 border-t border-gray-200">
        <FormField control={control.electronicSignature} testId="step6.electronicSignature" />
      </div>
    </div>
  );
});
Step6Body.displayName = 'Step6Body';

// ============================================================================
// Steps configuration
// ============================================================================

const STEPS: FormWizardStep<CreditApplicationForm>[] = [
  { number: 1, title: 'Кредит', icon: '💰', body: Step1Body },
  { number: 2, title: 'Данные', icon: '👤', body: Step2Body },
  { number: 3, title: 'Контакты', icon: '📞', body: Step3Body },
  { number: 4, title: 'Работа', icon: '💼', body: Step4Body },
  { number: 5, title: 'Доп. инфо', icon: '📋', body: Step5Body },
  { number: 6, title: 'Подтверждение', icon: '✓', body: Step6Body },
];

// ============================================================================
// Page component
// ============================================================================

export default function McpCreditApplicationV9() {
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navConfig = useMemo(() => ({ stepValidations: STEP_VALIDATIONS, fullValidation }), []);

  const submitApplication = async () => {
    const result = await navRef.current?.submit(async (values: CreditApplicationForm) => {
      // Mock submission per spec — no real API.
      console.log('[mcp-credit-v9] submit:', values);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { id: `mock-${Date.now()}`, ok: true };
    });

    if (result) {
      alert(`Заявка успешно отправлена! ID: ${result.id}`);
    } else {
      alert('Пожалуйста, исправьте ошибки в форме');
    }
  };

  const fillFakeData = () => {
    form.setValue(happyPathFixture);
  };

  return (
    <div className="w-full">
      {import.meta.env.DEV && (
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={fillFakeData}
            data-testid="fill-fake-data"
            className="px-3 py-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300"
          >
            🎭 Заполнить тестовыми данными
          </button>
          <span className="text-xs text-gray-500">
            target=core · Iter-9 · A1 (ui-kit FormWizard) · B1 (JSX-conditional)
          </span>
        </div>
      )}
      <FormWizard
        ref={navRef}
        form={form}
        config={navConfig}
        steps={STEPS}
        onSubmit={submitApplication}
      />
    </div>
  );
}

// =============================================================================
// index.tsx — page component for `/examples/mcp-credit-v10`
// =============================================================================
//
// Iter-10 MCP regression test, target = `core`.
// Uses A1 (FormWizard from @reformer/ui-kit/form-wizard) and B1 (target=core,
// no setHidden) per add-wizard prompt's hierarchy.
//
// Per orchestrator's UX/test contract, every input gets `data-testid` of the
// form `input-step{N}.{field}` (FormField wraps `testId` → renders
// `data-testid="input-{testId}"`). Wizard nav uses `btn-prev`/`btn-next`/
// `btn-submit`. Step indicator: `step-indicator-{N}` (provided by ui-kit
// StepIndicator). Fill button: `fill-fake-data`.
//
// Conditional fields (mortgage / car / employment / address) are realized via
// JSX-conditional inside step-body components — Hide-not-Disable per
// add-behavior prompt §"Hide vs Disable".
// =============================================================================

import { useMemo, useRef } from 'react';
import type { FC, ReactNode } from 'react';
import { type FormProxy, useFormControlValue } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';

import { createCreditApplicationForm, fullValidation, STEP_VALIDATIONS } from './schema';
import { happyPathFixture } from './data-fixture';
import type {
  CoBorrower,
  CreditApplicationFormV10,
  EmploymentStatus,
  ExistingLoan,
  LoanType,
  Property,
} from './types';

// =============================================================================
// Inline hint / warning helpers
// =============================================================================

const Hint: FC<{ children: ReactNode; testId?: string }> = ({ children, testId }) => (
  <div
    role="note"
    data-testid={testId}
    className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
  >
    {children}
  </div>
);

const Warning: FC<{ children: ReactNode; testId?: string }> = ({ children, testId }) => (
  <div
    role="alert"
    data-testid={testId}
    className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
  >
    ⚠ {children}
  </div>
);

// =============================================================================
// Step body components
// =============================================================================

const Step1Loan: FC<{ control: FormProxy<CreditApplicationFormV10> }> = ({ control }) => {
  const loanType = useFormControlValue(control.loanType) as LoanType;
  const dtiRatio = useFormControlValue(control.paymentToIncomeRatio) as number;

  return (
    <div className="space-y-4" data-testid="step-1-body">
      <h2 className="text-xl font-bold text-gray-900">Шаг 1. Параметры кредита</h2>
      <FormField control={control.loanType} testId="step1.loanType" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.loanAmount} testId="step1.loanAmount" />
        <FormField control={control.loanTerm} testId="step1.loanTerm" />
      </div>
      <FormField control={control.loanPurpose} testId="step1.loanPurpose" />

      {loanType === 'mortgage' && (
        <div className="space-y-4 pt-2">
          <h3 className="text-lg font-semibold text-gray-900">Информация о недвижимости</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.propertyValue} testId="step1.propertyValue" />
            <FormField control={control.initialPayment} testId="step1.initialPayment" />
          </div>
          <Hint testId="hint-mortgage-docs">
            Для ипотеки потребуются: документы на недвижимость, оценка (не старше 6 мес.), отчёт об
            оценке, выписка ЕГРН.
          </Hint>
        </div>
      )}

      {loanType === 'car' && (
        <div className="space-y-4 pt-2">
          <h3 className="text-lg font-semibold text-gray-900">Информация об автомобиле</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.carBrand} testId="step1.carBrand" />
            <FormField control={control.carModel} testId="step1.carModel" />
            <FormField control={control.carYear} testId="step1.carYear" />
            <FormField control={control.carPrice} testId="step1.carPrice" />
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t">
        <h3 className="text-sm font-semibold text-gray-700">Расчёт</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control.interestRate} testId="step1.interestRate" />
          <FormField control={control.monthlyPayment} testId="step1.monthlyPayment" />
        </div>
      </div>

      {dtiRatio > 40 && (
        <Warning testId="warn-high-dti">
          Высокая долговая нагрузка: платёж составляет {dtiRatio}% от дохода. Шансы на одобрение
          снижаются. Рассмотрите меньшую сумму или больший срок.
        </Warning>
      )}
    </div>
  );
};

const Step2Personal: FC<{ control: FormProxy<CreditApplicationFormV10> }> = ({ control }) => {
  const age = useFormControlValue(control.age) as number | null;

  return (
    <div className="space-y-4" data-testid="step-2-body">
      <h2 className="text-xl font-bold text-gray-900">Шаг 2. Персональные данные</h2>
      {age != null && age > 60 && (
        <Warning testId="warn-senior-age">
          Возраст заёмщика старше 60 лет — могут потребоваться дополнительные гарантии: поручитель,
          залог имущества или страхование жизни.
        </Warning>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField control={control.personalData.lastName} testId="step2.personalData.lastName" />
        <FormField control={control.personalData.firstName} testId="step2.personalData.firstName" />
        <FormField
          control={control.personalData.middleName}
          testId="step2.personalData.middleName"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.personalData.birthDate} testId="step2.personalData.birthDate" />
        <FormField control={control.personalData.gender} testId="step2.personalData.gender" />
      </div>
      <FormField control={control.personalData.birthPlace} testId="step2.personalData.birthPlace" />

      <h3 className="text-lg font-semibold text-gray-900 pt-2">Паспортные данные</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.passportData.series} testId="step2.passportData.series" />
        <FormField control={control.passportData.number} testId="step2.passportData.number" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.passportData.issueDate} testId="step2.passportData.issueDate" />
        <FormField
          control={control.passportData.departmentCode}
          testId="step2.passportData.departmentCode"
        />
      </div>
      <FormField control={control.passportData.issuedBy} testId="step2.passportData.issuedBy" />

      <h3 className="text-lg font-semibold text-gray-900 pt-2">Документы</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.inn} testId="step2.inn" />
        <FormField control={control.snils} testId="step2.snils" />
      </div>

      <div className="space-y-2 pt-2 border-t">
        <h3 className="text-sm font-semibold text-gray-700">Расчёт</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control.fullName} testId="step2.fullName" />
          <FormField control={control.age} testId="step2.age" />
        </div>
      </div>
    </div>
  );
};

const Step3Contacts: FC<{ control: FormProxy<CreditApplicationFormV10> }> = ({ control }) => {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration) as boolean;

  return (
    <div className="space-y-4" data-testid="step-3-body">
      <h2 className="text-xl font-bold text-gray-900">Шаг 3. Контактная информация</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.phoneMain} testId="step3.phoneMain" />
        <FormField control={control.phoneAdditional} testId="step3.phoneAdditional" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.email} testId="step3.email" />
        <FormField control={control.emailAdditional} testId="step3.emailAdditional" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 pt-2">Адрес регистрации</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      <FormField control={control.sameAsRegistration} testId="step3.sameAsRegistration" />

      {!sameAsRegistration && (
        <>
          <h3 className="text-lg font-semibold text-gray-900 pt-2">Адрес проживания</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </>
      )}
    </div>
  );
};

const Step4Employment: FC<{ control: FormProxy<CreditApplicationFormV10> }> = ({ control }) => {
  const employmentStatus = useFormControlValue(control.employmentStatus) as EmploymentStatus;
  const workCurrent = useFormControlValue(control.workExperienceCurrent) as number | null;

  return (
    <div className="space-y-4" data-testid="step-4-body">
      <h2 className="text-xl font-bold text-gray-900">Шаг 4. Информация о занятости</h2>
      <FormField control={control.employmentStatus} testId="step4.employmentStatus" />

      {employmentStatus === 'selfEmployed' && (
        <Hint testId="hint-self-employed">
          ИП требуется подтверждение дохода: налоговая декларация за последний отчётный период,
          выписка по расчётному счёту за 6 месяцев, справка об отсутствии задолженности.
        </Hint>
      )}

      {employmentStatus === 'employed' && (
        <div className="space-y-4 pt-2">
          <h3 className="text-lg font-semibold text-gray-900">Место работы</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.companyName} testId="step4.companyName" />
            <FormField control={control.companyInn} testId="step4.companyInn" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.companyPhone} testId="step4.companyPhone" />
            <FormField control={control.position} testId="step4.position" />
          </div>
          <FormField control={control.companyAddress} testId="step4.companyAddress" />
        </div>
      )}

      {employmentStatus === 'selfEmployed' && (
        <div className="space-y-4 pt-2">
          <h3 className="text-lg font-semibold text-gray-900">Индивидуальный предприниматель</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.businessType} testId="step4.businessType" />
            <FormField control={control.businessInn} testId="step4.businessInn" />
          </div>
          <FormField control={control.businessActivity} testId="step4.businessActivity" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 pt-2">Стаж и доход</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.workExperienceTotal} testId="step4.workExperienceTotal" />
        <FormField control={control.workExperienceCurrent} testId="step4.workExperienceCurrent" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.monthlyIncome} testId="step4.monthlyIncome" />
        <FormField control={control.additionalIncome} testId="step4.additionalIncome" />
      </div>
      <FormField control={control.additionalIncomeSource} testId="step4.additionalIncomeSource" />

      <div className="space-y-2 pt-2 border-t">
        <h3 className="text-sm font-semibold text-gray-700">Расчёт</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control.totalIncome} testId="step4.totalIncome" />
          <FormField control={control.paymentToIncomeRatio} testId="step4.paymentToIncomeRatio" />
        </div>
      </div>

      {workCurrent != null && workCurrent < 3 && (
        <Warning testId="warn-low-experience">
          Малый стаж на текущем месте работы (менее 3 месяцев) — банк может запросить подтверждение
          от предыдущего работодателя.
        </Warning>
      )}
    </div>
  );
};

// FormArray item bodies — required for FormArraySection.itemComponent.
const PropertyItem: FC<{ control: FormProxy<Property> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.type} testId="step5.properties.type" />
    <FormField control={control.description} testId="step5.properties.description" />
    <FormField control={control.estimatedValue} testId="step5.properties.estimatedValue" />
    <FormField control={control.hasEncumbrance} testId="step5.properties.hasEncumbrance" />
  </div>
);

const ExistingLoanItem: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField control={control.bank} testId="step5.existingLoans.bank" />
      <FormField control={control.type} testId="step5.existingLoans.type" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <FormField control={control.amount} testId="step5.existingLoans.amount" />
      <FormField control={control.remainingAmount} testId="step5.existingLoans.remainingAmount" />
      <FormField control={control.monthlyPayment} testId="step5.existingLoans.monthlyPayment" />
    </div>
    <FormField control={control.maturityDate} testId="step5.existingLoans.maturityDate" />
  </div>
);

const CoBorrowerItem: FC<{ control: FormProxy<CoBorrower> }> = ({ control }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <FormField
        control={control.personalData.lastName}
        testId="step5.coBorrowers.personalData.lastName"
      />
      <FormField
        control={control.personalData.firstName}
        testId="step5.coBorrowers.personalData.firstName"
      />
      <FormField
        control={control.personalData.middleName}
        testId="step5.coBorrowers.personalData.middleName"
      />
    </div>
    <FormField
      control={control.personalData.birthDate}
      testId="step5.coBorrowers.personalData.birthDate"
    />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField control={control.phone} testId="step5.coBorrowers.phone" />
      <FormField control={control.email} testId="step5.coBorrowers.email" />
    </div>
    <FormField control={control.relationship} testId="step5.coBorrowers.relationship" />
    <FormField control={control.monthlyIncome} testId="step5.coBorrowers.monthlyIncome" />
  </div>
);

const Step5Additional: FC<{ control: FormProxy<CreditApplicationFormV10> }> = ({ control }) => {
  const hasProperty = useFormControlValue(control.hasProperty) as boolean;
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans) as boolean;
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower) as boolean;

  return (
    <div className="space-y-4" data-testid="step-5-body">
      <h2 className="text-xl font-bold text-gray-900">Шаг 5. Дополнительная информация</h2>
      <FormField control={control.maritalStatus} testId="step5.maritalStatus" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.dependents} testId="step5.dependents" />
        <FormField control={control.education} testId="step5.education" />
      </div>

      <div className="space-y-2 pt-2">
        <FormField control={control.hasProperty} testId="step5.hasProperty" />
        <FormArraySection
          title="Имущество"
          control={control.properties}
          itemComponent={PropertyItem}
          itemLabel="Имущество"
          addButtonLabel="+ Добавить имущество"
          emptyMessage='Нажмите "Добавить имущество" для добавления информации'
          hasItems={hasProperty}
        />
      </div>

      <div className="space-y-2 pt-2">
        <FormField control={control.hasExistingLoans} testId="step5.hasExistingLoans" />
        {hasExistingLoans && (
          <Hint testId="hint-existing-loans-impact">
            Существующие кредиты учитываются при расчёте долговой нагрузки. Совокупный платёж по
            всем кредитам (включая новый) не должен превышать 50% дохода — иначе высокая вероятность
            отказа.
          </Hint>
        )}
        <FormArraySection
          title="Существующие кредиты"
          control={control.existingLoans}
          itemComponent={ExistingLoanItem}
          itemLabel="Кредит"
          addButtonLabel="+ Добавить кредит"
          emptyMessage='Нажмите "Добавить кредит" для добавления информации'
          hasItems={hasExistingLoans}
        />
      </div>

      <div className="space-y-2 pt-2">
        <FormField control={control.hasCoBorrower} testId="step5.hasCoBorrower" />
        <FormArraySection
          title="Созаемщики"
          control={control.coBorrowers}
          itemComponent={CoBorrowerItem}
          itemLabel="Созаемщик"
          addButtonLabel="+ Добавить созаемщика"
          emptyMessage='Нажмите "Добавить созаемщика" для добавления информации'
          hasItems={hasCoBorrower}
        />
      </div>

      <div className="space-y-2 pt-2 border-t">
        <h3 className="text-sm font-semibold text-gray-700">Расчёт</h3>
        <FormField control={control.coBorrowersIncome} testId="step5.coBorrowersIncome" />
      </div>
    </div>
  );
};

const Step6Confirmation: FC<{ control: FormProxy<CreditApplicationFormV10> }> = ({ control }) => (
  <div className="space-y-4" data-testid="step-6-body">
    <h2 className="text-xl font-bold text-gray-900">Шаг 6. Подтверждение и согласия</h2>
    <FormField control={control.agreePersonalData} testId="step6.agreePersonalData" />
    <FormField control={control.agreeCreditHistory} testId="step6.agreeCreditHistory" />
    <FormField control={control.agreeMarketing} testId="step6.agreeMarketing" />
    <FormField control={control.agreeTerms} testId="step6.agreeTerms" />
    <FormField control={control.confirmAccuracy} testId="step6.confirmAccuracy" />
    <FormField control={control.electronicSignature} testId="step6.electronicSignature" />
  </div>
);

// =============================================================================
// Page component
// =============================================================================

const STEPS = [
  { number: 1, title: 'Кредит', icon: '💰', body: Step1Loan },
  { number: 2, title: 'Данные', icon: '👤', body: Step2Personal },
  { number: 3, title: 'Контакты', icon: '📞', body: Step3Contacts },
  { number: 4, title: 'Работа', icon: '💼', body: Step4Employment },
  { number: 5, title: 'Доп. инфо', icon: '📋', body: Step5Additional },
  { number: 6, title: 'Подтверждение', icon: '✅', body: Step6Confirmation },
];

export default function McpCreditApplicationV10() {
  const navRef = useRef<FormWizardHandle<CreditApplicationFormV10>>(null);

  const form = useMemo(() => createCreditApplicationForm(), []);

  const navConfig = useMemo(() => ({ stepValidations: STEP_VALIDATIONS, fullValidation }), []);

  const handleSubmit = async () => {
    const result = await navRef.current?.submit(async (values: CreditApplicationFormV10) => {
      console.log('[mcp-credit-application-v10] submit', values);
      window.alert('Заявка отправлена (mock)');
      return values;
    });
    if (!result) {
      // Поднять touched на всю форму — поля с ошибками подсветятся.
      (form as unknown as { markAsTouched?: () => void }).markAsTouched?.();
      // Скролл к первому invalid input'у.
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector<HTMLElement>(
          '[data-testid^="input-"][aria-invalid="true"], [aria-invalid="true"][data-testid^="input-"]'
        );
        firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid?.focus?.();
      });
      window.alert('Пожалуйста, исправьте ошибки в форме');
    }
  };

  const fillFakeData = () => {
    form.setValue(happyPathFixture);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          MCP Credit Application v10 (target=core)
        </h1>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={fillFakeData}
            data-testid="fill-fake-data"
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Заполнить тестовыми данными
          </button>
        )}
      </div>

      <FormWizard
        ref={navRef as never}
        form={form as never}
        config={navConfig as never}
        steps={STEPS as never}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

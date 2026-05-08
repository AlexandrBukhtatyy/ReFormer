/**
 * iter-18 / target=core — Credit application form (FormWizard + FormField).
 * Generated MCP-only.
 */
import { useMemo, useRef, type FC } from 'react';
import { FormField, Button } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { FormArray } from '@reformer/cdk/form-array';
import { useFormControlValue } from '@reformer/core';
import type { FormProxy } from '@reformer/core';

import {
  createCreditApplicationForm,
  STEP_VALIDATIONS,
  fullValidation,
  type CreditApplicationForm,
} from './schema';

// ============================================================================
// Step body components — schema-driven (FormField only, no extra props)
// ============================================================================

const Step1Loan: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => {
  const loanType = useFormControlValue(control.loanType);
  return (
    <div className="space-y-4">
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
      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        Расчётные показатели
      </div>
      <FormField control={control.interestRate} />
      <FormField control={control.monthlyPayment} />
      {loanType === 'mortgage' && (
        <p className="text-xs text-gray-600">
          Подсказка: для ипотеки потребуется подтверждение права собственности
          и оценочного отчёта.
        </p>
      )}
    </div>
  );
};

const Step2Personal: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-semibold uppercase text-gray-500">Личные данные</h3>
    <FormField control={control.personalData.lastName} />
    <FormField control={control.personalData.firstName} />
    <FormField control={control.personalData.middleName} />
    <FormField control={control.personalData.birthDate} />
    <FormField control={control.personalData.gender} />
    <FormField control={control.personalData.birthPlace} />
    <FormField control={control.fullName} />
    <FormField control={control.age} />

    <h3 className="text-sm font-semibold uppercase text-gray-500">Паспортные данные</h3>
    <FormField control={control.passportData.series} />
    <FormField control={control.passportData.number} />
    <FormField control={control.passportData.issueDate} />
    <FormField control={control.passportData.issuedBy} />
    <FormField control={control.passportData.departmentCode} />

    <h3 className="text-sm font-semibold uppercase text-gray-500">Документы</h3>
    <FormField control={control.inn} />
    <FormField control={control.snils} />
  </div>
);

const Step3Contacts: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => {
  const same = useFormControlValue(control.sameAsRegistration);
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase text-gray-500">Телефоны</h3>
      <FormField control={control.phoneMain} />
      <FormField control={control.phoneAdditional} />

      <h3 className="text-sm font-semibold uppercase text-gray-500">Email</h3>
      <FormField control={control.email} />
      <FormField control={control.emailAdditional} />

      <h3 className="text-sm font-semibold uppercase text-gray-500">Адрес регистрации</h3>
      <FormField control={control.registrationAddress.region} />
      <FormField control={control.registrationAddress.city} />
      <FormField control={control.registrationAddress.street} />
      <FormField control={control.registrationAddress.house} />
      <FormField control={control.registrationAddress.apartment} />
      <FormField control={control.registrationAddress.postalCode} />

      <h3 className="text-sm font-semibold uppercase text-gray-500">Адрес проживания</h3>
      <FormField control={control.sameAsRegistration} />
      {!same && (
        <>
          <FormField control={control.residenceAddress.region} />
          <FormField control={control.residenceAddress.city} />
          <FormField control={control.residenceAddress.street} />
          <FormField control={control.residenceAddress.house} />
          <FormField control={control.residenceAddress.apartment} />
          <FormField control={control.residenceAddress.postalCode} />
        </>
      )}
    </div>
  );
};

const Step4Employment: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => {
  const status = useFormControlValue(control.employmentStatus);
  return (
    <div className="space-y-4">
      <FormField control={control.employmentStatus} />
      {status === 'employed' && (
        <div className="space-y-4 rounded border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-600">Работа по найму</h4>
          <FormField control={control.companyName} />
          <FormField control={control.companyInn} />
          <FormField control={control.companyPhone} />
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
        </div>
      )}
      {status === 'selfEmployed' && (
        <div className="space-y-4 rounded border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-600">ИП / самозанятый</h4>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
          <p className="text-xs text-gray-600">
            Для ИП требуется подтверждение дохода (3-НДФЛ или выписка по счёту).
          </p>
        </div>
      )}

      <h3 className="text-sm font-semibold uppercase text-gray-500">Стаж</h3>
      <FormField control={control.workExperienceTotal} />
      <FormField control={control.workExperienceCurrent} />

      <h3 className="text-sm font-semibold uppercase text-gray-500">Доход</h3>
      <FormField control={control.monthlyIncome} />
      <FormField control={control.additionalIncome} />
      <FormField control={control.additionalIncomeSource} />
      <FormField control={control.totalIncome} />
      <FormField control={control.paymentToIncomeRatio} />
    </div>
  );
};

const Step5Additional: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => {
  const hasProperty = useFormControlValue(control.hasProperty);
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower);
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Личное</h3>
        <FormField control={control.maritalStatus} />
        <FormField control={control.dependents} />
        <FormField control={control.education} />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Имущество</h3>
        <FormField control={control.hasProperty} />
        {hasProperty && (
          <FormArray.Root control={control.properties}>
            <FormArray.Empty>
              <p className="text-xs text-gray-500" data-testid="properties-empty">
                Список имущества пуст. Добавьте элементы.
              </p>
            </FormArray.Empty>
            <FormArray.List>
              {({ control: itemCtl, index, remove }) => (
                <div
                  key={index}
                  className="space-y-2 rounded border border-gray-200 p-3"
                  data-testid={`properties-item-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">
                      Объект #{index + 1}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={remove}
                      data-testid={`properties-${index}-remove`}
                    >
                      Удалить
                    </button>
                  </div>
                  <FormField control={itemCtl.type} />
                  <FormField control={itemCtl.description} />
                  <FormField control={itemCtl.estimatedValue} />
                  <FormField control={itemCtl.hasEncumbrance} />
                </div>
              )}
            </FormArray.List>
            <FormArray.AddButton>+ Добавить имущество</FormArray.AddButton>
          </FormArray.Root>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Кредиты</h3>
        <FormField control={control.hasExistingLoans} />
        {hasExistingLoans && (
          <FormArray.Root control={control.existingLoans}>
            <FormArray.Empty>
              <p className="text-xs text-gray-500" data-testid="existingLoans-empty">
                Существующих кредитов нет. Добавьте при необходимости.
              </p>
            </FormArray.Empty>
            <FormArray.List>
              {({ control: itemCtl, index, remove }) => (
                <div
                  key={index}
                  className="space-y-2 rounded border border-gray-200 p-3"
                  data-testid={`existingLoans-item-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">
                      Кредит #{index + 1}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={remove}
                      data-testid={`existingLoans-${index}-remove`}
                    >
                      Удалить
                    </button>
                  </div>
                  <FormField control={itemCtl.bank} />
                  <FormField control={itemCtl.type} />
                  <FormField control={itemCtl.amount} />
                  <FormField control={itemCtl.remainingAmount} />
                  <FormField control={itemCtl.monthlyPayment} />
                  <FormField control={itemCtl.maturityDate} />
                </div>
              )}
            </FormArray.List>
            <FormArray.AddButton>+ Добавить кредит</FormArray.AddButton>
          </FormArray.Root>
        )}
        {hasExistingLoans && (
          <p className="text-xs text-gray-600">
            Существующие кредиты влияют на оценку кредитоспособности.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Созаёмщики</h3>
        <FormField control={control.hasCoBorrower} />
        {hasCoBorrower && (
          <FormArray.Root control={control.coBorrowers}>
            <FormArray.Empty>
              <p className="text-xs text-gray-500" data-testid="coBorrowers-empty">
                Созаёмщиков нет. Добавьте при необходимости.
              </p>
            </FormArray.Empty>
            <FormArray.List>
              {({ control: itemCtl, index, remove }) => (
                <div
                  key={index}
                  className="space-y-2 rounded border border-gray-200 p-3"
                  data-testid={`coBorrowers-item-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">
                      Созаёмщик #{index + 1}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={remove}
                      data-testid={`coBorrowers-${index}-remove`}
                    >
                      Удалить
                    </button>
                  </div>
                  <FormField control={itemCtl.personalData.lastName} />
                  <FormField control={itemCtl.personalData.firstName} />
                  <FormField control={itemCtl.personalData.middleName} />
                  <FormField control={itemCtl.personalData.birthDate} />
                  <FormField control={itemCtl.phone} />
                  <FormField control={itemCtl.email} />
                  <FormField control={itemCtl.relationship} />
                  <FormField control={itemCtl.monthlyIncome} />
                </div>
              )}
            </FormArray.List>
            <FormArray.AddButton>+ Добавить созаёмщика</FormArray.AddButton>
          </FormArray.Root>
        )}
        <FormField control={control.coBorrowersIncome} />
      </div>
    </div>
  );
};

const Step6Confirm: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-semibold uppercase text-gray-500">Согласия</h3>
    <FormField control={control.agreePersonalData} />
    <FormField control={control.agreeCreditHistory} />
    <FormField control={control.agreeMarketing} />
    <FormField control={control.agreeTerms} />

    <h3 className="text-sm font-semibold uppercase text-gray-500">Подтверждение</h3>
    <FormField control={control.confirmAccuracy} />
    <FormField control={control.electronicSignature} />
  </div>
);

// ============================================================================
// Page
// ============================================================================

export default function MccaCoreV18Page() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const wizardRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const steps: FormWizardStep<CreditApplicationForm>[] = useMemo(
    () => [
      { number: 1, title: 'Кредит', icon: '💰', body: Step1Loan },
      { number: 2, title: 'Личные данные', icon: '👤', body: Step2Personal },
      { number: 3, title: 'Контакты', icon: '📞', body: Step3Contacts },
      { number: 4, title: 'Работа', icon: '💼', body: Step4Employment },
      { number: 5, title: 'Доп. инфо', icon: '🏠', body: Step5Additional },
      { number: 6, title: 'Подтверждение', icon: '✅', body: Step6Confirm },
    ],
    []
  );

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('Submit credit application:', values);
    await new Promise((r) => setTimeout(r, 500));
    alert('Заявка отправлена');
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Заявка на кредит</h1>
        <p className="text-sm text-gray-600">
          iter-18 · target=core · MCP-only sub-agent
        </p>
      </header>
      <FormWizard
        ref={wizardRef}
        form={form}
        config={{
          stepValidations: STEP_VALIDATIONS,
          fullValidation,
        }}
        steps={steps}
        onSubmit={handleSubmit}
      />
      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const v = form.getValue();
            console.log('Snapshot:', v);
          }}
        >
          Снимок данных (debug)
        </Button>
      </div>
    </div>
  );
}

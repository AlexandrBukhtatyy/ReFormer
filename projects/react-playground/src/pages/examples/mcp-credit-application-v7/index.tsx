/**
 * mcp-credit-application-v7 — page 1 (target=core)
 *
 * Wizard pair: A=A3 (CDK FormWizard compound) + B=B1 (target=core, JSX-conditional sub-sections)
 *
 * - `<FormWizard>` from `@reformer/cdk/form-wizard` (compound)
 *   - `Indicator` (render-props) — custom chip strip with lucide-icons + en-dashes
 *   - `Step` (children-based) — each step body is a card-wrapped section
 *   - `Actions` (render-props) — Назад / Далее / Отправить with arrows
 *   - `Progress` (render-props) — `Шаг X из 6 • XX% завершено`
 * - JSX-conditional подсекции внутри Step bodies (mortgage / car / employed / selfEmployed / property / loans / co-borrower)
 * - FormArray.Root + List + AddButton (PLAIN-leaves initialValue) + RemoveButton + Empty
 * - testId convention: dotted path (`step1.loanAmount`, `step2.passportData.series`, ...)
 */

import { useMemo, useRef, type ComponentType } from 'react';
import {
  useFormControlValue,
  type FormProxy,
  type ArrayNode,
  type FormFields,
} from '@reformer/core';
import { FormWizard } from '@reformer/cdk/form-wizard';
import type {
  FormWizardHandle,
  FormWizardIndicatorStep,
  FormWizardActionsRenderProps,
  FormWizardProgressRenderProps,
  FormWizardIndicatorRenderProps,
} from '@reformer/cdk/form-wizard';
import { FormArray } from '@reformer/cdk/form-array';
import { Button, FormField } from '@reformer/ui-kit';
import { Coins, User, Phone, Briefcase, FileText, CheckSquare, Plus, Trash2 } from 'lucide-react';

import {
  createCreditForm,
  STEP_VALIDATIONS,
  fullValidation,
  propertyItemFactory,
  existingLoanItemFactory,
  coBorrowerItemFactory,
} from './schema';
import type {
  CreditApplicationForm,
  LoanType,
  EmploymentStatus,
  Property,
  ExistingLoan,
  CoBorrower,
} from './types';

// ============================================================================
// Step bodies (JSX-conditional sub-sections inside)
// ============================================================================

function Step1({ control }: { control: FormProxy<CreditApplicationForm> }) {
  const loanType = useFormControlValue(control.loanType) as LoanType;

  return (
    <section
      className="bg-white border rounded-xl shadow-sm p-6 space-y-4"
      data-testid="step-1-section"
    >
      <h2 className="text-xl font-bold text-gray-900" data-testid="step-heading">
        Шаг 1. Параметры кредита
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.loanType} testId="step1.loanType" />
        <FormField control={control.loanTerm} testId="step1.loanTerm" />
      </div>
      <FormField control={control.loanAmount} testId="step1.loanAmount" />
      <FormField control={control.loanPurpose} testId="step1.loanPurpose" />

      {loanType === 'mortgage' && (
        <div className="pt-4 border-t space-y-3" data-testid="step1.mortgage-section">
          <h3 className="text-base font-semibold text-gray-800">Информация о недвижимости</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.propertyValue} testId="step1.propertyValue" />
            <FormField control={control.initialPayment} testId="step1.initialPayment" />
          </div>
        </div>
      )}

      {loanType === 'car' && (
        <div className="pt-4 border-t space-y-3" data-testid="step1.car-section">
          <h3 className="text-base font-semibold text-gray-800">Информация об автомобиле</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.carBrand} testId="step1.carBrand" />
            <FormField control={control.carModel} testId="step1.carModel" />
            <FormField control={control.carYear} testId="step1.carYear" />
            <FormField control={control.carPrice} testId="step1.carPrice" />
          </div>
        </div>
      )}

      <div className="pt-4 border-t space-y-3">
        <h3 className="text-base font-semibold text-gray-800">Расчет</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control.interestRate} testId="step1.interestRate" />
          <FormField control={control.monthlyPayment} testId="step1.monthlyPayment" />
        </div>
      </div>
    </section>
  );
}

function Step2({ control }: { control: FormProxy<CreditApplicationForm> }) {
  return (
    <section
      className="bg-white border rounded-xl shadow-sm p-6 space-y-4"
      data-testid="step-2-section"
    >
      <h2 className="text-xl font-bold text-gray-900" data-testid="step-heading">
        Шаг 2. Персональные данные
      </h2>

      <h3 className="text-base font-semibold text-gray-800">Личные данные</h3>
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
        <FormField
          control={control.personalData.birthPlace}
          testId="step2.personalData.birthPlace"
        />
      </div>
      <FormField control={control.personalData.gender} testId="step2.personalData.gender" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.fullName} testId="step2.fullName" />
        <FormField control={control.age} testId="step2.age" />
      </div>

      <h3 className="text-base font-semibold text-gray-800 pt-4 border-t">Паспортные данные</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.passportData.series} testId="step2.passportData.series" />
        <FormField control={control.passportData.number} testId="step2.passportData.number" />
        <FormField control={control.passportData.issueDate} testId="step2.passportData.issueDate" />
        <FormField
          control={control.passportData.departmentCode}
          testId="step2.passportData.departmentCode"
        />
      </div>
      <FormField control={control.passportData.issuedBy} testId="step2.passportData.issuedBy" />

      <h3 className="text-base font-semibold text-gray-800 pt-4 border-t">Документы</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.inn} testId="step2.inn" />
        <FormField control={control.snils} testId="step2.snils" />
      </div>
    </section>
  );
}

function Step3({ control }: { control: FormProxy<CreditApplicationForm> }) {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration) as boolean;

  return (
    <section
      className="bg-white border rounded-xl shadow-sm p-6 space-y-4"
      data-testid="step-3-section"
    >
      <h2 className="text-xl font-bold text-gray-900" data-testid="step-heading">
        Шаг 3. Контактная информация
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.phoneMain} testId="step3.phoneMain" />
        <FormField control={control.phoneAdditional} testId="step3.phoneAdditional" />
        <FormField control={control.email} testId="step3.email" />
        <FormField control={control.emailAdditional} testId="step3.emailAdditional" />
      </div>

      <h3 className="text-base font-semibold text-gray-800 pt-4 border-t">Адрес регистрации</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control.registrationAddress.region}
          testId="step3.registrationAddress.region"
        />
        <FormField
          control={control.registrationAddress.city}
          testId="step3.registrationAddress.city"
        />
        <FormField
          control={control.registrationAddress.street}
          testId="step3.registrationAddress.street"
        />
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
        <div className="pt-4 border-t space-y-3" data-testid="step3.residence-section">
          <h3 className="text-base font-semibold text-gray-800">Адрес проживания</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control.residenceAddress.region}
              testId="step3.residenceAddress.region"
            />
            <FormField
              control={control.residenceAddress.city}
              testId="step3.residenceAddress.city"
            />
            <FormField
              control={control.residenceAddress.street}
              testId="step3.residenceAddress.street"
            />
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
  );
}

function Step4({ control }: { control: FormProxy<CreditApplicationForm> }) {
  const employmentStatus = useFormControlValue(control.employmentStatus) as EmploymentStatus;

  return (
    <section
      className="bg-white border rounded-xl shadow-sm p-6 space-y-4"
      data-testid="step-4-section"
    >
      <h2 className="text-xl font-bold text-gray-900" data-testid="step-heading">
        Шаг 4. Информация о занятости
      </h2>

      <FormField control={control.employmentStatus} testId="step4.employmentStatus" />

      {employmentStatus === 'employed' && (
        <div className="pt-4 border-t space-y-3" data-testid="step4.employed-section">
          <h3 className="text-base font-semibold text-gray-800">Работа по найму</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.companyName} testId="step4.companyName" />
            <FormField control={control.companyInn} testId="step4.companyInn" />
            <FormField control={control.companyPhone} testId="step4.companyPhone" />
            <FormField control={control.position} testId="step4.position" />
          </div>
          <FormField control={control.companyAddress} testId="step4.companyAddress" />
        </div>
      )}

      {employmentStatus === 'selfEmployed' && (
        <div className="pt-4 border-t space-y-3" data-testid="step4.selfEmployed-section">
          <h3 className="text-base font-semibold text-gray-800">Индивидуальный предприниматель</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control.businessType} testId="step4.businessType" />
            <FormField control={control.businessInn} testId="step4.businessInn" />
          </div>
          <FormField control={control.businessActivity} testId="step4.businessActivity" />
        </div>
      )}

      <h3 className="text-base font-semibold text-gray-800 pt-4 border-t">Стаж</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.workExperienceTotal} testId="step4.workExperienceTotal" />
        <FormField control={control.workExperienceCurrent} testId="step4.workExperienceCurrent" />
      </div>

      <h3 className="text-base font-semibold text-gray-800 pt-4 border-t">Доход</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.monthlyIncome} testId="step4.monthlyIncome" />
        <FormField control={control.additionalIncome} testId="step4.additionalIncome" />
      </div>
      <FormField control={control.additionalIncomeSource} testId="step4.additionalIncomeSource" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        <FormField control={control.totalIncome} testId="step4.totalIncome" />
        <FormField control={control.paymentToIncomeRatio} testId="step4.paymentToIncomeRatio" />
      </div>
    </section>
  );
}

interface ArraySectionProps<T extends object> {
  title: string;
  control: ArrayNode<FormFields>;
  itemFactory: () => T;
  itemLabel: string;
  emptyText: string;
  itemBody: ComponentType<{ control: FormProxy<T>; testIdPrefix: string }>;
  testIdPrefix: string;
}

function ArraySection<T extends object>({
  title,
  control,
  itemFactory,
  itemLabel,
  emptyText,
  itemBody: ItemBody,
  testIdPrefix,
}: ArraySectionProps<T>) {
  return (
    <FormArray.Root control={control}>
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-base font-semibold text-gray-800">{title}</h4>
          <FormArray.AddButton
            initialValue={itemFactory() as unknown as Partial<Record<string, unknown>>}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
            data-testid={`${testIdPrefix}.add`}
          >
            <Plus size={14} /> Добавить
          </FormArray.AddButton>
        </div>

        <FormArray.List>
          {({ control: itemControl, index }) => (
            <div
              className="p-4 bg-white rounded border space-y-2"
              data-testid={`${testIdPrefix}.item-${index}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {itemLabel} #{index + 1}
                </span>
                <FormArray.RemoveButton
                  className="inline-flex items-center gap-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 text-xs"
                  data-testid={`${testIdPrefix}.remove-${index}`}
                >
                  <Trash2 size={12} /> Удалить
                </FormArray.RemoveButton>
              </div>
              <ItemBody
                control={itemControl as unknown as FormProxy<T>}
                testIdPrefix={`${testIdPrefix}.${index}`}
              />
            </div>
          )}
        </FormArray.List>

        <FormArray.Empty>
          <div className="p-4 bg-white border border-dashed rounded text-center text-sm text-gray-500">
            {emptyText}
          </div>
        </FormArray.Empty>
      </div>
    </FormArray.Root>
  );
}

function PropertyItem({
  control,
  testIdPrefix,
}: {
  control: FormProxy<Property>;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField control={control.type} testId={`${testIdPrefix}.type`} />
        <FormField control={control.estimatedValue} testId={`${testIdPrefix}.estimatedValue`} />
      </div>
      <FormField control={control.description} testId={`${testIdPrefix}.description`} />
      <FormField control={control.hasEncumbrance} testId={`${testIdPrefix}.hasEncumbrance`} />
    </div>
  );
}

function ExistingLoanItem({
  control,
  testIdPrefix,
}: {
  control: FormProxy<ExistingLoan>;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField control={control.bank} testId={`${testIdPrefix}.bank`} />
        <FormField control={control.type} testId={`${testIdPrefix}.type`} />
        <FormField control={control.amount} testId={`${testIdPrefix}.amount`} />
        <FormField control={control.remainingAmount} testId={`${testIdPrefix}.remainingAmount`} />
        <FormField control={control.monthlyPayment} testId={`${testIdPrefix}.monthlyPayment`} />
        <FormField control={control.maturityDate} testId={`${testIdPrefix}.maturityDate`} />
      </div>
    </div>
  );
}

function CoBorrowerItem({
  control,
  testIdPrefix,
}: {
  control: FormProxy<CoBorrower>;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FormField
          control={control.personalData.lastName}
          testId={`${testIdPrefix}.personalData.lastName`}
        />
        <FormField
          control={control.personalData.firstName}
          testId={`${testIdPrefix}.personalData.firstName`}
        />
        <FormField
          control={control.personalData.middleName}
          testId={`${testIdPrefix}.personalData.middleName`}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField
          control={control.personalData.birthDate}
          testId={`${testIdPrefix}.personalData.birthDate`}
        />
        <FormField control={control.relationship} testId={`${testIdPrefix}.relationship`} />
        <FormField control={control.phone} testId={`${testIdPrefix}.phone`} />
        <FormField control={control.email} testId={`${testIdPrefix}.email`} />
      </div>
      <FormField control={control.monthlyIncome} testId={`${testIdPrefix}.monthlyIncome`} />
    </div>
  );
}

function Step5({ control }: { control: FormProxy<CreditApplicationForm> }) {
  const hasProperty = useFormControlValue(control.hasProperty) as boolean;
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans) as boolean;
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower) as boolean;

  return (
    <section
      className="bg-white border rounded-xl shadow-sm p-6 space-y-4"
      data-testid="step-5-section"
    >
      <h2 className="text-xl font-bold text-gray-900" data-testid="step-heading">
        Шаг 5. Дополнительная информация
      </h2>

      <FormField control={control.maritalStatus} testId="step5.maritalStatus" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control.dependents} testId="step5.dependents" />
        <FormField control={control.education} testId="step5.education" />
      </div>

      <div className="pt-4 border-t space-y-3">
        <FormField control={control.hasProperty} testId="step5.hasProperty" />
        {hasProperty && (
          <ArraySection<Property>
            title="Имущество"
            control={control.properties as unknown as ArrayNode<FormFields>}
            itemFactory={propertyItemFactory}
            itemLabel="Объект"
            emptyText="Нажмите «Добавить», чтобы добавить объект имущества"
            itemBody={PropertyItem}
            testIdPrefix="step5.properties"
          />
        )}
      </div>

      <div className="pt-4 border-t space-y-3">
        <FormField control={control.hasExistingLoans} testId="step5.hasExistingLoans" />
        {hasExistingLoans && (
          <ArraySection<ExistingLoan>
            title="Существующие кредиты"
            control={control.existingLoans as unknown as ArrayNode<FormFields>}
            itemFactory={existingLoanItemFactory}
            itemLabel="Кредит"
            emptyText="Нажмите «Добавить», чтобы добавить информацию о кредите"
            itemBody={ExistingLoanItem}
            testIdPrefix="step5.existingLoans"
          />
        )}
      </div>

      <div className="pt-4 border-t space-y-3">
        <FormField control={control.hasCoBorrower} testId="step5.hasCoBorrower" />
        {hasCoBorrower && (
          <ArraySection<CoBorrower>
            title="Созаемщики"
            control={control.coBorrowers as unknown as ArrayNode<FormFields>}
            itemFactory={coBorrowerItemFactory}
            itemLabel="Созаемщик"
            emptyText="Нажмите «Добавить», чтобы добавить созаемщика"
            itemBody={CoBorrowerItem}
            testIdPrefix="step5.coBorrowers"
          />
        )}
      </div>

      {hasCoBorrower && (
        <div className="pt-4 border-t">
          <FormField control={control.coBorrowersIncome} testId="step5.coBorrowersIncome" />
        </div>
      )}
    </section>
  );
}

function Step6({ control }: { control: FormProxy<CreditApplicationForm> }) {
  return (
    <section
      className="bg-white border rounded-xl shadow-sm p-6 space-y-4"
      data-testid="step-6-section"
    >
      <h2 className="text-xl font-bold text-gray-900" data-testid="step-heading">
        Шаг 6. Подтверждение и согласия
      </h2>

      <div className="space-y-2">
        <FormField control={control.agreePersonalData} testId="step6.agreePersonalData" />
        <FormField control={control.agreeCreditHistory} testId="step6.agreeCreditHistory" />
        <FormField control={control.agreeMarketing} testId="step6.agreeMarketing" />
        <FormField control={control.agreeTerms} testId="step6.agreeTerms" />
        <FormField control={control.confirmAccuracy} testId="step6.confirmAccuracy" />
      </div>

      <FormField control={control.electronicSignature} testId="step6.electronicSignature" />
    </section>
  );
}

// ============================================================================
// Step indicator (custom render — chips with lucide icons + en-dashes)
// ============================================================================

const STEP_META: Array<{ icon: ComponentType<{ size?: number; className?: string }> }> = [
  { icon: Coins },
  { icon: User },
  { icon: Phone },
  { icon: Briefcase },
  { icon: FileText },
  { icon: CheckSquare },
];

const STEPS: FormWizardIndicatorStep[] = [
  { number: 1, title: 'Кредит' },
  { number: 2, title: 'Данные' },
  { number: 3, title: 'Контакты' },
  { number: 4, title: 'Работа' },
  { number: 5, title: 'Доп. инфо' },
  { number: 6, title: 'Подтверждение' },
];

function StepIndicator({ steps, goToStep }: FormWizardIndicatorRenderProps) {
  return (
    <ol
      className="flex flex-wrap items-center gap-2 text-sm"
      data-testid="step-indicator"
      aria-label="Шаги формы"
    >
      {steps.map((step, idx) => {
        const Icon = STEP_META[idx]?.icon ?? FileText;
        const enabled = step.canNavigate;
        const baseCls =
          'inline-flex items-center gap-1 rounded-full border px-3 py-1 transition-colors';
        const stateCls = step.isCurrent
          ? 'bg-blue-600 text-white border-blue-600'
          : step.isCompleted
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
        const disabledCls = !enabled ? 'opacity-50 cursor-not-allowed hover:bg-inherit' : '';

        return (
          <li key={step.number} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToStep(step.number)}
              disabled={!enabled}
              data-testid={`step-chip-${step.number}`}
              data-current={step.isCurrent || undefined}
              data-completed={step.isCompleted || undefined}
              className={`${baseCls} ${stateCls} ${disabledCls}`}
              aria-current={step.isCurrent ? 'step' : undefined}
            >
              <Icon size={14} />
              <span className="font-medium">{step.number}.</span>
              <span>{step.title}</span>
            </button>
            {idx < steps.length - 1 && (
              <span aria-hidden className="text-gray-300 select-none">
                —
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ActionsBar({ prev, next, submit, isFirstStep, isLastStep }: FormWizardActionsRenderProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t">
      {!isFirstStep ? (
        <Button
          type="button"
          variant="outline"
          onClick={prev.onClick}
          disabled={prev.disabled}
          data-testid="wizard-prev"
        >
          ← Назад
        </Button>
      ) : (
        <span aria-hidden />
      )}
      {!isLastStep ? (
        <Button
          type="button"
          onClick={next.onClick}
          disabled={next.disabled}
          data-testid="wizard-next"
        >
          Далее →
        </Button>
      ) : (
        <Button
          type="button"
          onClick={submit.onClick}
          disabled={submit.disabled}
          data-testid="wizard-submit"
        >
          {submit.isSubmitting ? 'Отправка…' : 'Отправить'}
        </Button>
      )}
    </div>
  );
}

function ProgressLine({ current, total, percent }: FormWizardProgressRenderProps) {
  return (
    <div className="text-sm text-center text-gray-500" data-testid="step-progress">
      Шаг {current} из {total} • {percent}% завершено
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function McpCreditApplicationV7() {
  const form = useMemo(() => createCreditForm(), []);
  const wizardRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const config = useMemo(
    () => ({
      stepValidations: STEP_VALIDATIONS,
      fullValidation,
    }),
    []
  );

  const handleSubmit = async () => {
    try {
      const result = await wizardRef.current?.submit(async (values) => {
        console.log('[mcp-credit-v7] submit values:', values);
        return values;
      });
      if (result) {
        alert('Заявка успешно отправлена');
      } else {
        alert('Пожалуйста, исправьте ошибки в форме');
      }
    } catch (err) {
      console.error('[mcp-credit-v7] submit error:', err);
      alert('Ошибка отправки заявки');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="mcp-credit-v7-page">
      <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит (iter-7 page 1, core)</h1>

      <FormWizard ref={wizardRef} form={form} config={config}>
        <FormWizard.Indicator steps={STEPS}>
          {(props) => <StepIndicator {...props} />}
        </FormWizard.Indicator>

        <FormWizard.Step>
          <Step1 control={form} />
        </FormWizard.Step>
        <FormWizard.Step>
          <Step2 control={form} />
        </FormWizard.Step>
        <FormWizard.Step>
          <Step3 control={form} />
        </FormWizard.Step>
        <FormWizard.Step>
          <Step4 control={form} />
        </FormWizard.Step>
        <FormWizard.Step>
          <Step5 control={form} />
        </FormWizard.Step>
        <FormWizard.Step>
          <Step6 control={form} />
        </FormWizard.Step>

        <FormWizard.Actions onSubmit={handleSubmit}>
          {(props) => <ActionsBar {...props} />}
        </FormWizard.Actions>

        <FormWizard.Progress>{(props) => <ProgressLine {...props} />}</FormWizard.Progress>
      </FormWizard>
    </div>
  );
}

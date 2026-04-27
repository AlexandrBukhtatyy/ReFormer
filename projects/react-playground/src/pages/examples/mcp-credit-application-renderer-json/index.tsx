import { useEffect, useMemo, useState } from 'react';
import { createForm, validateForm } from '@reformer/core';
import { FormField, Input, Textarea, Select, Checkbox } from '@reformer/ui-kit';
import { FormRenderer } from '@reformer/renderer-react';
import { createCreditApplicationRenderSchema } from './render-schema';
import { STEP_VALIDATIONS, fullValidation } from './schema';
import type { CreditApplicationForm } from './types';

// ── Noop placeholder (same as in schema.ts) ───────────────────────────────────
const Noop = Input;

// ── Address sub-schema factory ────────────────────────────────────────────────
const addressSchema = () => ({
  region: { value: '', component: Input },
  city: { value: '', component: Input },
  street: { value: '', component: Input },
  house: { value: '', component: Input },
  apartment: { value: '', component: Input },
  postalCode: { value: '', component: Input },
});

const personalDataSchema = () => ({
  lastName: { value: '', component: Input },
  firstName: { value: '', component: Input },
  middleName: { value: '', component: Input },
  birthDate: { value: '', component: Input },
  gender: { value: 'male', component: Select },
  birthPlace: { value: '', component: Input },
});

// ── Step labels for the indicator ────────────────────────────────────────────
const STEP_LABELS: Record<number, string> = {
  1: 'Кредит',
  2: 'Личные данные',
  3: 'Контакты',
  4: 'Занятость',
  5: 'Дополнительно',
  6: 'Подтверждение',
};
const TOTAL_STEPS = 6;

// ── StepIndicator ─────────────────────────────────────────────────────────────
interface StepIndicatorProps {
  currentStep: number;
  completedSteps: Set<number>;
}

function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1;
        const isCurrent = step === currentStep;
        const isCompleted = completedSteps.has(step);

        let tileClass =
          'flex-1 min-w-[80px] rounded-md px-2 py-2 text-center text-xs font-medium transition-colors select-none';
        if (isCurrent) {
          tileClass += ' bg-blue-600 text-white';
        } else if (isCompleted) {
          tileClass += ' bg-green-100 text-green-800 border border-green-300';
        } else {
          tileClass += ' bg-gray-100 text-gray-500 border border-gray-200';
        }

        return (
          <div key={step} className={tileClass}>
            <div className="font-semibold">
              {isCompleted && !isCurrent ? '✓ ' : ''}
              {step}
            </div>
            <div className="truncate">{STEP_LABELS[step]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function McpCreditApplicationRendererJson() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isValidating, setIsValidating] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  const form = useMemo(
    () =>
      (
        createForm as (config: {
          form: unknown;
        }) => ReturnType<typeof createForm<CreditApplicationForm>>
      )({
        form: {
          step1: {
            loanType: { value: 'consumer', component: Select },
            loanAmount: { value: null, component: Input },
            loanTerm: { value: 12, component: Input },
            loanPurpose: { value: '', component: Textarea },
            propertyValue: { value: null, component: Input },
            initialPayment: { value: null, component: Noop, disabled: true },
            carBrand: { value: null, component: Input },
            carModel: { value: null, component: Input },
            carYear: { value: null, component: Input },
            carPrice: { value: null, component: Input },
            interestRate: { value: null, component: Noop, disabled: true },
            monthlyPayment: { value: null, component: Noop, disabled: true },
          },
          step2: {
            personalData: personalDataSchema(),
            passportData: {
              series: { value: '', component: Input },
              number: { value: '', component: Input },
              issueDate: { value: '', component: Input },
              issuedBy: { value: '', component: Input },
              departmentCode: { value: '', component: Input },
            },
            inn: { value: '', component: Input },
            snils: { value: '', component: Input },
            fullName: { value: '', component: Noop, disabled: true },
            age: { value: null, component: Noop, disabled: true },
          },
          step3: {
            phoneMain: { value: '', component: Input },
            phoneAdditional: { value: null, component: Input },
            email: { value: '', component: Input },
            emailAdditional: { value: null, component: Input },
            registrationAddress: addressSchema(),
            sameAsRegistration: { value: true, component: Checkbox },
            residenceAddress: addressSchema(),
          },
          step4: {
            employmentStatus: { value: 'employed', component: Select },
            companyName: { value: null, component: Input },
            companyInn: { value: null, component: Input },
            companyPhone: { value: null, component: Input },
            companyAddress: { value: null, component: Input },
            position: { value: null, component: Input },
            workExperienceTotal: { value: null, component: Input },
            workExperienceCurrent: { value: null, component: Input },
            monthlyIncome: { value: null, component: Input },
            additionalIncome: { value: null, component: Input },
            additionalIncomeSource: { value: null, component: Input },
            businessType: { value: null, component: Input },
            businessInn: { value: null, component: Input },
            businessActivity: { value: null, component: Textarea },
            totalIncome: { value: null, component: Noop, disabled: true },
            paymentToIncomeRatio: { value: null, component: Noop, disabled: true },
          },
          step5: {
            maritalStatus: { value: 'single', component: Select },
            dependents: { value: 0, component: Input },
            education: { value: 'higher', component: Select },
            hasProperty: { value: false, component: Checkbox },
            properties: [
              {
                type: { value: 'apartment', component: Select },
                description: { value: '', component: Textarea },
                estimatedValue: { value: 0, component: Input },
                hasEncumbrance: { value: false, component: Checkbox },
              },
            ],
            hasExistingLoans: { value: false, component: Checkbox },
            existingLoans: [
              {
                bank: { value: '', component: Input },
                type: { value: '', component: Input },
                amount: { value: 0, component: Input },
                remainingAmount: { value: 0, component: Input },
                monthlyPayment: { value: 0, component: Input },
                maturityDate: { value: '', component: Input },
              },
            ],
            hasCoBorrower: { value: false, component: Checkbox },
            coBorrowers: [
              {
                personalData: personalDataSchema(),
                phone: { value: '', component: Input },
                email: { value: '', component: Input },
                relationship: { value: '', component: Input },
                monthlyIncome: { value: 0, component: Input },
              },
            ],
            coBorrowersIncome: { value: null, component: Noop, disabled: true },
          },
          step6: {
            agreePersonalData: { value: false, component: Checkbox },
            agreeCreditHistory: { value: false, component: Checkbox },
            agreeMarketing: { value: false, component: Checkbox },
            agreeTerms: { value: false, component: Checkbox },
            confirmAccuracy: { value: false, component: Checkbox },
            electronicSignature: { value: '', component: Input },
          },
        },
      }),
    []
  );

  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  // ── Step visibility: imperatively hide all steps except currentStep ──────────
  // Сводка section and the three array sub-sections keep their own visibility
  // (managed by makeArrayGating in render-schema.ts).
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(n !== currentStep);
    }
  }, [schema, currentStep]);

  // ── Navigation handlers ────────────────────────────────────────────────────

  const goToNextStep = async () => {
    setIsValidating(true);
    try {
      const stepValidation = STEP_VALIDATIONS[currentStep];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isValid = await validateForm(form as any, stepValidation as any);
      if (!isValid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (form as any).markAsTouched?.();
        return;
      }
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
      setCurrentStep((prev) => prev + 1);
    } finally {
      setIsValidating(false);
    }
  };

  const goToPrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    setIsValidating(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isValid = await validateForm(form as any, fullValidation as any);
      if (!isValid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (form as any).markAsTouched?.();
        return;
      }
      setSubmittedAt(Date.now());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (form as any).submit?.((values: CreditApplicationForm) => console.log(values));
    } finally {
      setIsValidating(false);
    }
  };

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит</h1>

      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />

      {submittedAt != null && (
        <p className="text-sm text-gray-500">
          Последняя попытка отправки: {new Date(submittedAt).toLocaleTimeString('ru-RU')}
        </p>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-2">
        {!isFirstStep && (
          <button
            type="button"
            onClick={goToPrevStep}
            disabled={isValidating}
            className="rounded-md bg-gray-200 px-6 py-3 text-gray-800 font-semibold hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
          >
            Назад
          </button>
        )}

        <div className="flex-1" />

        {!isLastStep ? (
          <button
            type="button"
            onClick={() => void goToNextStep()}
            disabled={isValidating}
            className="rounded-md bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isValidating ? 'Проверка...' : 'Далее'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isValidating}
            className="rounded-md bg-green-600 px-6 py-3 text-white font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isValidating ? 'Проверка...' : 'Отправить'}
          </button>
        )}
      </div>
    </div>
  );
}

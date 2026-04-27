import { useMemo, useState, useEffect } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { validateForm } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { creditApplicationForm, STEP_VALIDATIONS, fullValidation } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

const STEP_TITLES: Record<number, string> = {
  1: 'Кредит',
  2: 'Личные',
  3: 'Контакты',
  4: 'Работа',
  5: 'Доп. инфо',
  6: 'Подтверждение',
};

// ─── StepIndicator ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: number;
  completedSteps: Set<number>;
}

function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <div className="mb-6 flex gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = i + 1;
        const isCurrent = n === currentStep;
        const isCompleted = completedSteps.has(n);
        const baseClass =
          'flex min-w-0 flex-1 flex-col items-center rounded-lg px-2 py-2 text-xs font-medium transition-colors';
        const colorClass = isCurrent
          ? 'bg-blue-500 text-white'
          : isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-gray-100 text-gray-500';

        return (
          <div key={n} className={`${baseClass} ${colorClass}`}>
            <span className="text-sm font-bold">{isCompleted && !isCurrent ? '✓' : n}</span>
            <span className="mt-0.5 truncate">{STEP_TITLES[n]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function McpCreditApplicationRenderer() {
  const schema = useMemo(() => createCreditApplicationRenderSchema(creditApplicationForm), []);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isValidating, setIsValidating] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  // ── Imperatively toggle step visibility via setHidden ─────────────────────
  // The Сводка section (no selector) and the inner FormArray sub-sections
  // (properties-section, existing-loans-section, co-borrowers-section) are NOT
  // toggled here — they are controlled by their own arrayGating behavior.
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(n !== currentStep);
    }
  }, [schema, currentStep]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goToNextStep = async () => {
    setIsValidating(true);
    try {
      const isValid = await validateForm(creditApplicationForm, STEP_VALIDATIONS[currentStep]);
      if (!isValid) {
        creditApplicationForm.markAsTouched();
        return;
      }
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
      setCurrentStep((s) => s + 1);
    } finally {
      setIsValidating(false);
    }
  };

  const goToPrevStep = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setIsValidating(true);
    try {
      const isValid = await validateForm(creditApplicationForm, fullValidation);
      if (!isValid) {
        creditApplicationForm.markAsTouched();
        return;
      }
      setSubmittedAt(Date.now());
      console.log('Renderer-react credit application submitted', creditApplicationForm);
    } finally {
      setIsValidating(false);
    }
  };

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <div className="w-full">
      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />

      <div className="mt-6 flex items-center gap-3">
        {!isFirstStep && (
          <button
            type="button"
            onClick={goToPrevStep}
            disabled={isValidating}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Назад
          </button>
        )}

        {!isLastStep ? (
          <button
            type="button"
            onClick={goToNextStep}
            disabled={isValidating}
            className="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {isValidating ? 'Проверка...' : 'Далее'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isValidating}
            className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isValidating ? 'Отправка...' : 'Отправить заявку'}
          </button>
        )}

        {submittedAt && (
          <span className="text-sm text-gray-500">
            Submit вызван в {new Date(submittedAt).toLocaleTimeString()} (см. console + ошибки под
            полями)
          </span>
        )}
      </div>
    </div>
  );
}

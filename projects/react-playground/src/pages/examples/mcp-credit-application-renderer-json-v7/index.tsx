/**
 * iter-7 page 3 — credit-application form, target=renderer-json.
 *
 * (A, B) pair: **A4 (manual useState) + B3 (renderer-json + setHidden)**.
 * Обоснование выбора A4 — см. dev-plan.md / dev-report.md.
 *
 * Архитектура:
 *  - `createCreditApplicationForm()` — FormProxy с form/behavior/validation.
 *  - `createCreditApplicationRegistry()` — defineRegistry с ui-kit + FormRoot
 *    + RendererFormArraySection + 8 option arrays + 3 templates.
 *  - **RenderSchemaFn-wrapper** (Patch F-1) — `createRenderSchemaFromJson` сам
 *    не умеет инжектить `form` в FormRoot's componentProps; оборачиваем
 *    результат и подменяем root.componentProps.form. Без обёртки FormRoot
 *    получит `form === undefined` и поля молча отрендерятся пустыми.
 *  - `useState(currentStep, completedSteps)` — A4-стейт.
 *  - `useEffect setHidden('stepN')` — B3 показ только активного шага.
 *  - `useEffect setHidden('subsection')` для 8 conditional sub-sections —
 *    подписан через `useFormControlValue` на соответствующие fieldNodes.
 *  - StepIndicator с lucide icons + en-dashes; nav buttons с стрелками;
 *    progress text — visual baseline из A1/A2 baseline (ручная разметка).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createRenderSchema,
  FormRenderer,
  type ContainerRenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import { createRenderSchemaFromJson } from '@reformer/renderer-json';
import { useFormControlValue, validateForm } from '@reformer/core';
import { Button, FormField } from '@reformer/ui-kit';
import {
  Coins,
  User,
  Phone,
  Briefcase,
  FileText,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react';

import { createCreditApplicationForm, STEP_VALIDATIONS } from './schema';
import { createCreditApplicationRegistry } from './registry';
import { creditApplicationJsonSchema } from './render-schema';
import type { CreditApplicationForm } from './types';

const TOTAL_STEPS = 6;

interface StepMeta {
  n: number;
  label: string;
  icon: LucideIcon;
}

const STEP_META: StepMeta[] = [
  { n: 1, label: 'Кредит', icon: Coins },
  { n: 2, label: 'Данные', icon: User },
  { n: 3, label: 'Контакты', icon: Phone },
  { n: 4, label: 'Работа', icon: Briefcase },
  { n: 5, label: 'Доп. инфо', icon: FileText },
  { n: 6, label: 'Подтверждение', icon: CheckSquare },
];

export default function McpCreditApplicationRendererJsonV7() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const registry = useMemo(() => createCreditApplicationRegistry(), []);

  // Patch F-1: RenderSchemaFn-wrapper для form-injection в FormRoot.
  const schema = useMemo(() => {
    const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(
      creditApplicationJsonSchema,
      registry
    );
    const fnWithForm: RenderSchemaFn<CreditApplicationForm> = (path) => {
      const root = baseFn(path) as ContainerRenderNode<CreditApplicationForm>;
      return {
        ...root,
        componentProps: { ...(root.componentProps ?? {}), form },
      };
    };
    return createRenderSchema(fnWithForm);
  }, [registry, form]);

  // ===== A4: wizard state =====
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [maxReached, setMaxReached] = useState(1);
  const [isValidating, setIsValidating] = useState(false);

  // ===== B3: setHidden for step containers =====
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(n !== currentStep);
    }
  }, [schema, currentStep]);

  // ===== Conditional sub-sections (subscribe to controlling fields) =====
  const loanType = useFormControlValue(form.loanType);
  const sameAsRegistration = useFormControlValue(form.sameAsRegistration);
  const employmentStatus = useFormControlValue(form.employmentStatus);
  const hasProperty = useFormControlValue(form.hasProperty);
  const hasExistingLoans = useFormControlValue(form.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(form.hasCoBorrower);

  useEffect(() => {
    schema.node('mortgage-section').setHidden(loanType !== 'mortgage');
  }, [schema, loanType]);

  useEffect(() => {
    schema.node('car-section').setHidden(loanType !== 'car');
  }, [schema, loanType]);

  useEffect(() => {
    schema.node('residence-address-section').setHidden(sameAsRegistration === true);
  }, [schema, sameAsRegistration]);

  useEffect(() => {
    schema.node('employer-section').setHidden(employmentStatus !== 'employed');
  }, [schema, employmentStatus]);

  useEffect(() => {
    schema.node('business-section').setHidden(employmentStatus !== 'selfEmployed');
  }, [schema, employmentStatus]);

  useEffect(() => {
    schema.node('properties-array-section').setHidden(hasProperty !== true);
  }, [schema, hasProperty]);

  useEffect(() => {
    schema.node('existing-loans-array-section').setHidden(hasExistingLoans !== true);
  }, [schema, hasExistingLoans]);

  useEffect(() => {
    schema.node('coborrowers-array-section').setHidden(hasCoBorrower !== true);
  }, [schema, hasCoBorrower]);

  // ===== Navigation handlers =====
  async function goNext() {
    setIsValidating(true);
    try {
      const stepSchema = STEP_VALIDATIONS[currentStep];
      const isValid = await validateForm(form, stepSchema);
      if (!isValid) {
        form.markAsTouched();
        return;
      }
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps((prev) => [...prev, currentStep]);
      }
      if (currentStep < TOTAL_STEPS) {
        const next = currentStep + 1;
        setCurrentStep(next);
        if (next > maxReached) setMaxReached(next);
      }
    } finally {
      setIsValidating(false);
    }
  }

  function goPrev() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  function goToStep(n: number) {
    if (n === 1 || completedSteps.includes(n - 1) || n <= maxReached) {
      setCurrentStep(n);
    }
  }

  async function handleSubmit() {
    setIsValidating(true);
    try {
      const isValid = await form.validate();
      if (!isValid) {
        form.markAsTouched();
        return;
      }
      await form.submit(
        async (values: CreditApplicationForm) => {
          // Mock submit — в реальном коде POST /api/v1/credit-applications.

          console.log('[CreditApplication] submit', values);
          alert('Заявка успешно отправлена');
          return values;
        },
        { skipValidation: true }
      );
    } finally {
      setIsValidating(false);
    }
  }

  const progressPercent = Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="credit-application-v7-json">
      {/* Step indicator strip */}
      <ol data-testid="step-indicator" className="flex items-center justify-center gap-2 flex-wrap">
        {STEP_META.map((s, idx) => {
          const isCompleted = completedSteps.includes(s.n);
          const isCurrent = s.n === currentStep;
          const isClickable = s.n === 1 || completedSteps.includes(s.n - 1) || s.n <= maxReached;
          const Icon = s.icon;
          const chip = (
            <li key={`chip-${s.n}`}>
              <button
                type="button"
                onClick={() => isClickable && goToStep(s.n)}
                disabled={!isClickable}
                data-testid={`step-chip-${s.n}`}
                data-current={isCurrent ? 'true' : undefined}
                data-completed={isCompleted ? 'true' : undefined}
                className={
                  'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ' +
                  (isCurrent
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isCompleted
                      ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed')
                }
              >
                <Icon className="w-4 h-4" aria-hidden />
                <span>
                  {s.n}. {s.label}
                </span>
              </button>
            </li>
          );
          const dash =
            idx < STEP_META.length - 1 ? (
              <li key={`dash-${s.n}`} aria-hidden className="text-gray-300">
                —
              </li>
            ) : null;
          return [chip, dash] as ReactNode[];
        })}
      </ol>

      {/* Form body — все 6 шагов смонтированы; setHidden скрывает неактивные */}
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />

      {/* Navigation buttons + progress text */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t">
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            data-testid="wizard-prev"
            disabled={isValidating}
          >
            ← Назад
          </Button>
        ) : (
          <span aria-hidden />
        )}
        {currentStep < TOTAL_STEPS ? (
          <Button type="button" onClick={goNext} data-testid="wizard-next" disabled={isValidating}>
            Далее →
          </Button>
        ) : (
          <Button
            type="submit"
            onClick={handleSubmit}
            data-testid="wizard-submit"
            disabled={isValidating}
          >
            Отправить
          </Button>
        )}
      </div>
      <div data-testid="step-progress" className="text-sm text-center text-gray-500">
        Шаг {currentStep} из {TOTAL_STEPS} • {progressPercent}% завершено
      </div>
    </div>
  );
}

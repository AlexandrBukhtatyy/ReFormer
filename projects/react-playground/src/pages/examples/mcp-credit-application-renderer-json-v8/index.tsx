/**
 * Iter-8 page (target=renderer-json) — credit-application form built fully via
 * MCP create-form / add-validation / add-behavior / add-form-array / add-wizard
 * prompts.
 *
 * Wizard pair: A=A4 (manual useState), B=B3 (renderer-json + setHidden orchestration).
 * Reasoning in `dev-plan.md`.
 *
 * Patches verified:
 * - F-1: `RenderSchemaFn`-wrapper injects `form` into root `FormRoot` componentProps.
 * - C: no `extends FormFields` on union-literal leaves.
 * - H: camelCase componentProps (`readOnly`, not `readonly`).
 * - I: `computeFrom` for `fullName` subscribes to group node.
 * - D1: `options` arrays declared in `createForm` componentProps + `reg.source(...)`.
 * - D3: `FormArraySection.initialValue` is plain-leaf primitives.
 * - C update: `FormArraySection` from ui-kit; JSON `itemComponent: { $template }`.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  FormRenderer,
  createRenderSchema,
  type RenderSchemaFn,
  type ContainerRenderNode,
} from '@reformer/renderer-react';
import { createRenderSchemaFromJson, JsonRendererProvider } from '@reformer/renderer-json';
import { useFormControlValue, validateForm, type GroupNode } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';

import type { CreditApplicationForm } from './types';
import { createCreditApplicationForm, STEP_VALIDATIONS } from './schema';
import { createCreditApplicationRegistry } from './registry';
import { creditApplicationJsonSchema } from './render-schema';
import { happyPathFixture } from './data-fixture';

const STEP_TITLES: { n: number; title: string; icon: string }[] = [
  { n: 1, title: 'Кредит', icon: '💰' },
  { n: 2, title: 'Данные', icon: '👤' },
  { n: 3, title: 'Контакты', icon: '📞' },
  { n: 4, title: 'Работа', icon: '💼' },
  { n: 5, title: 'Доп. инфо', icon: '📋' },
  { n: 6, title: 'Подтверждение', icon: '✓' },
];
const TOTAL_STEPS = STEP_TITLES.length;

export default function McpCreditApplicationRendererJsonV8() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const registry = useMemo(() => createCreditApplicationRegistry(), []);

  // ----- Patch F-1: RenderSchemaFn-wrapper injects `form` into root `FormRoot`
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

  // ----- Wizard step state (A4 — manual useState)
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // ----- B3: external setHidden orchestration for step containers
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(n !== currentStep);
    }
  }, [schema, currentStep]);

  // ----- Conditional sub-sections
  const loanType = useFormControlValue(form.loanType as never) as string;
  const employmentStatus = useFormControlValue(form.employmentStatus as never) as string;
  const sameAsRegistration = useFormControlValue(form.sameAsRegistration as never) as boolean;
  const hasProperty = useFormControlValue(form.hasProperty as never) as boolean;
  const hasExistingLoans = useFormControlValue(form.hasExistingLoans as never) as boolean;
  const hasCoBorrower = useFormControlValue(form.hasCoBorrower as never) as boolean;

  useEffect(() => {
    schema.node('mortgage-section').setHidden(loanType !== 'mortgage');
    schema.node('car-section').setHidden(loanType !== 'car');
  }, [schema, loanType]);

  useEffect(() => {
    schema.node('employer-section').setHidden(employmentStatus !== 'employed');
    schema.node('business-section').setHidden(employmentStatus !== 'selfEmployed');
  }, [schema, employmentStatus]);

  useEffect(() => {
    schema.node('residence-address-section').setHidden(sameAsRegistration === true);
  }, [schema, sameAsRegistration]);

  useEffect(() => {
    schema.node('properties-array').setHidden(!hasProperty);
  }, [schema, hasProperty]);
  useEffect(() => {
    schema.node('existing-loans-array').setHidden(!hasExistingLoans);
  }, [schema, hasExistingLoans]);
  useEffect(() => {
    schema.node('co-borrowers-array').setHidden(!hasCoBorrower);
  }, [schema, hasCoBorrower]);

  // ----- Navigation
  const goNext = async () => {
    setIsValidating(true);
    try {
      const ok = await validateForm(
        form as unknown as GroupNode<CreditApplicationForm>,
        STEP_VALIDATIONS[currentStep]
      );
      if (!ok) return;
      setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep((s) => s + 1);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const goToStep = (n: number) => {
    // Allow navigation only to completed steps or the immediately-next-after-completed.
    if (n === currentStep) return;
    if (n < currentStep || completedSteps.includes(n - 1) || n === 1) {
      setCurrentStep(n);
    }
  };

  const handleSubmit = async () => {
    setIsValidating(true);
    try {
      const ok = await validateForm(
        form as unknown as GroupNode<CreditApplicationForm>,
        STEP_VALIDATIONS[currentStep]
      );
      if (!ok) return;
      const values = form.getValue();

      console.log('[mcp-credit-renderer-json-v8] submit', values);

      alert('Заявка успешно отправлена!');
    } finally {
      setIsValidating(false);
    }
  };

  const isFirst = currentStep === 1;
  const isLast = currentStep === TOTAL_STEPS;
  const progressPct = Math.round((completedSteps.length / TOTAL_STEPS) * 100);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Заявка на кредит — Iter-8 (renderer-json)</h1>

      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => form.setValue(happyPathFixture)}
          data-testid="fill-fake-data"
          className="mb-4 px-3 py-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300"
        >
          🎭 Заполнить тестовыми данными
        </button>
      )}

      {/* Step indicator strip */}
      <nav
        className="flex flex-wrap items-center gap-2"
        data-testid="step-indicator"
        aria-label="Шаги формы"
      >
        {STEP_TITLES.map((s, idx) => {
          const isCurrent = s.n === currentStep;
          const isCompleted = completedSteps.includes(s.n);
          return (
            <div key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(s.n)}
                data-testid={`step-chip-${s.n}`}
                data-current={isCurrent || undefined}
                data-completed={isCompleted || undefined}
                className={[
                  'px-3 py-1.5 text-sm rounded border transition-colors',
                  isCurrent
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isCompleted
                      ? 'bg-green-100 text-green-900 border-green-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400',
                ].join(' ')}
              >
                <span className="mr-1.5" aria-hidden="true">
                  {s.icon}
                </span>
                {s.n}. {s.title}
              </button>
              {idx < STEP_TITLES.length - 1 && (
                <span className="text-gray-400" aria-hidden="true">
                  –
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Form layout (FormRenderer with full JSON-driven schema) */}
      <JsonRendererProvider settings={{ registry }}>
        <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
      </JsonRendererProvider>

      {/* Nav buttons */}
      <div className="flex items-center justify-between gap-4 mt-6">
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirst}
          data-testid="wizard-prev"
          className="px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Назад
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isValidating}
            data-testid="wizard-submit"
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isValidating ? 'Проверка…' : 'Отправить заявку'}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={isValidating}
            data-testid="wizard-next"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isValidating ? 'Проверка…' : 'Далее →'}
          </button>
        )}
      </div>

      <p className="text-center text-sm text-gray-500" data-testid="step-progress">
        Шаг {currentStep} из {TOTAL_STEPS} · {progressPct}% завершено
      </p>
    </div>
  );
}

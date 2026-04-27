/**
 * Credit application page (renderer-react v2 — page 2 of MCP-validation iter 2).
 *
 * Stage 5 — wizard navigation via `schema.node('stepN').setHidden(...)`.
 *
 *  - Step indicator strip (6 chips) shows current/done/pending state.
 *  - `useEffect` keyed on `currentStep` calls
 *    `schema.node('stepN').setHidden(currentStep !== n)` for n in 1..6.
 *  - "Далее" runs `validateForm(form, STEP_VALIDATIONS[currentStep])`;
 *    advances on true, otherwise calls `form.markAsTouched()` so the
 *    inline ui-kit FormField wrapper renders the red error messages.
 *  - "Назад" decrements step (no validation).
 *  - On step 6, "Далее" is replaced with "Отправить" which runs the
 *    full `form.validate()` + submit handler.
 */
import { useEffect, useMemo, useState } from 'react';
import { validateForm } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { Button, FormField } from '@reformer/ui-kit';
import { creditApplicationForm, STEP_VALIDATIONS } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';

const STEP_LABELS = [
  { n: 1, label: 'Кредит' },
  { n: 2, label: 'Личные' },
  { n: 3, label: 'Контакты' },
  { n: 4, label: 'Работа' },
  { n: 5, label: 'Доп.' },
  { n: 6, label: 'Подтверждение' },
];

const TOTAL_STEPS = 6;

export default function McpCreditApplicationRendererV2() {
  // Form is module-level (created once on import). For test isolation we wrap
  // it in useMemo so re-renders don't recreate it.
  const form = useMemo(() => creditApplicationForm, []);
  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState<unknown>(null);

  // Wizard: hide all steps except current via the named selectors in render-schema.
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(currentStep !== n);
    }
  }, [schema, currentStep]);

  const handleNext = async () => {
    const validator = STEP_VALIDATIONS[currentStep];
    // Cast: STEP_VALIDATIONS is typed against CreditApplicationForm but
    // validateForm's `T extends FormFields` constraint widens to the base
    // FormFields path — the runtime is identical.
    const valid = validator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await validateForm(form as any, validator as any)
      : true;
    if (!valid) {
      form.markAsTouched();
      return;
    }
    setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Final-step submit: validate the full form and surface result.
    form.markAsTouched();
    const valid = await form.validate();
    const values = form.getValue();
    // eslint-disable-next-line no-console
    console.log('[mcp-credit-renderer-v2] submit', { valid, values });
    setSubmitted({ valid, values });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит</h1>
      <p className="text-sm text-gray-500">
        Renderer-react TS RenderSchema. Wizard на 6 шагов через
        {' '}
        <code className="bg-gray-100 px-1 rounded">schema.node('stepN').setHidden</code>
        {' '}
        (page 2, stages 4+5).
      </p>

      {/* Step indicator strip */}
      <ol
        className="flex flex-wrap items-center gap-2"
        aria-label="Шаги заявки"
        data-testid="step-indicator"
      >
        {STEP_LABELS.map(({ n, label }) => {
          const isCurrent = n === currentStep;
          const isDone = n < currentStep;
          const cls = isCurrent
            ? 'bg-blue-600 text-white'
            : isDone
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-gray-100 text-gray-500 border border-gray-200';
          return (
            <li
              key={n}
              data-testid={`step-chip-${n}`}
              data-current={isCurrent || undefined}
              data-done={isDone || undefined}
              className={`px-3 py-1 rounded-full text-xs font-medium select-none ${cls}`}
            >
              {isDone ? '✓ ' : ''}
              {n}. {label}
            </li>
          );
        })}
      </ol>

      <form onSubmit={handleSubmit} className="space-y-6" data-testid="credit-form">
        <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              data-testid="wizard-back"
            >
              Назад
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}

          {currentStep < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={handleNext}
              data-testid="wizard-next"
            >
              Далее
            </Button>
          ) : (
            <Button type="submit" data-testid="submit-button">
              Отправить
            </Button>
          )}
        </div>
      </form>

      {submitted ? (
        <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto">
          {JSON.stringify(submitted, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

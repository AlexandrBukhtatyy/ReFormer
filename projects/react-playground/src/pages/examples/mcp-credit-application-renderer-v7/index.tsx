/**
 * Page: iter-7 page 2 — credit-application form (target = renderer-react).
 *
 * Wizard implementation: A=A3 (CDK FormWizard compound).
 * Integration: B=B2 (renderer-react setHidden via useEffect).
 *
 * Layout (top → bottom):
 *  - Step indicator chips (lucide icons + en-dashes between chips)
 *  - <FormRenderer> rendering the schema with FormRoot owning all 6
 *    `step1..step6` containers. WizardSync drives setHidden so only the
 *    current step is visible.
 *  - Six invisible <FormWizard.Step /> children — pure plumbing so the CDK
 *    wizard's `countSteps` reports `totalSteps = 6`.
 *  - Nav buttons (Назад / Далее → / Отправить) and progress text.
 */

import { useEffect, useMemo } from 'react';
import { Briefcase, CheckSquare, Coins, FileText, Phone, User } from 'lucide-react';
import { FormWizard, useFormWizard } from '@reformer/cdk/form-wizard';
import { FormField } from '@reformer/ui-kit';
import { FormRenderer } from '@reformer/renderer-react';
import type { RenderSchemaProxy } from '@reformer/renderer-react';
import { createCreditApplicationForm, STEP_VALIDATIONS, fullValidation } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';
import type { CreditApplicationForm } from './types';

const TOTAL_STEPS = 6;

const STEP_DEFS = [
  { number: 1, title: 'Кредит', Icon: Coins },
  { number: 2, title: 'Данные', Icon: User },
  { number: 3, title: 'Контакты', Icon: Phone },
  { number: 4, title: 'Работа', Icon: Briefcase },
  { number: 5, title: 'Доп. инфо', Icon: FileText },
  { number: 6, title: 'Подтверждение', Icon: CheckSquare },
] as const;

// ---------------------------------------------------------------------------
// WizardSync — sits inside <FormWizard> so it can read currentStep via the
// wizard context, and drives setHidden on the schema's step containers.
// ---------------------------------------------------------------------------

function WizardSync({ schema }: { schema: RenderSchemaProxy<CreditApplicationForm> }) {
  const { currentStep } = useFormWizard<CreditApplicationForm>();
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(n !== currentStep);
    }
  }, [schema, currentStep]);
  return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function McpCreditApplicationRendererV7() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  const handleSubmit = async () => {
    const values = form.getValue();

    console.log('[credit-application-v7-renderer] submit:', values);
    alert(`Заявка отправлена. Полное имя: ${values.fullName || '—'}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="credit-application-v7-renderer">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит</h1>
        <p className="text-sm text-gray-600">
          iter-7 page 2 — target=renderer-react · A3 CDK FormWizard + B2 setHidden
        </p>
      </header>

      <FormWizard form={form} config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}>
        {/* Step indicator strip with lucide icons + en-dashes between chips. */}
        <FormWizard.Indicator steps={STEP_DEFS.map(({ number, title }) => ({ number, title }))}>
          {({ steps, goToStep }) => (
            <nav
              data-testid="step-indicator"
              className="flex flex-wrap items-center justify-center gap-2 mb-6"
            >
              {steps.map((step, idx) => {
                const def = STEP_DEFS[idx];
                const Icon = def.Icon;
                return (
                  <span key={step.number} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToStep(step.number)}
                      disabled={!step.canNavigate}
                      data-testid={`step-chip-${step.number}`}
                      data-current={step.isCurrent || undefined}
                      data-completed={step.isCompleted || undefined}
                      className={
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                        (step.isCurrent
                          ? 'bg-blue-600 text-white border-blue-600'
                          : step.isCompleted
                            ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed')
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>
                        {step.number}. {step.title}
                      </span>
                    </button>
                    {idx < steps.length - 1 ? (
                      <span aria-hidden="true" className="text-gray-300">
                        –
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </nav>
          )}
        </FormWizard.Indicator>

        {/* Card-wrapped step body. The schema renders all 6 step containers,
            but setHidden ensures only the current one is visible. */}
        <div className="bg-white border rounded-xl shadow-sm p-6 space-y-4">
          <WizardSync schema={schema} />
          <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
        </div>

        {/* Six invisible Step children — pure plumbing so countSteps()=6
            and wizard nav buttons enable/disable correctly. */}
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <FormWizard.Step key={i} />
        ))}

        {/* Nav buttons: Back / Next → / Submit */}
        <FormWizard.Actions onSubmit={handleSubmit}>
          {({ prev, next, submit, isFirstStep, isLastStep, isValidating, isSubmitting }) => (
            <div className="flex justify-between items-center mt-6">
              <button
                type="button"
                onClick={prev.onClick}
                disabled={prev.disabled || isFirstStep}
                data-testid="wizard-prev"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Назад
              </button>
              {isLastStep ? (
                <button
                  type="button"
                  onClick={submit.onClick}
                  disabled={submit.disabled || isSubmitting}
                  data-testid="wizard-submit"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next.onClick}
                  disabled={next.disabled || isValidating}
                  data-testid="wizard-next"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {isValidating ? 'Проверка...' : 'Далее →'}
                </button>
              )}
            </div>
          )}
        </FormWizard.Actions>

        {/* Progress text underneath nav buttons. */}
        <FormWizard.Progress>
          {({ current, total, percent }) => (
            <div data-testid="step-progress" className="mt-2 text-center text-xs text-gray-500">
              Шаг {current} из {total} • {percent}% завершено
            </div>
          )}
        </FormWizard.Progress>
      </FormWizard>
    </div>
  );
}

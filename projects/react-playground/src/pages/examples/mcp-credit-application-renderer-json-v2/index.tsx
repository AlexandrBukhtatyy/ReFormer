import { useMemo, useCallback, useState, useEffect } from 'react';
import { validateForm } from '@reformer/core';
import { Button, FormField } from '@reformer/ui-kit';
import {
  FormRenderer,
  createRenderSchema,
  type RenderSchemaFn,
  type ContainerRenderNode,
} from '@reformer/renderer-react';
import { JsonRendererProvider, createRenderSchemaFromJson } from '@reformer/renderer-json';

import { createCreditApplicationForm, STEP_VALIDATIONS } from './schema';
import { creditApplicationJsonSchema } from './render-schema';
import { registry } from './registry';
import { CreditFormProvider } from './array-blocks';
import type { CreditApplicationForm } from './types';

const TOTAL_STEPS = 6;
const STEP_TITLES: Record<number, string> = {
  1: 'Кредит',
  2: 'Личные данные',
  3: 'Занятость',
  4: 'Финансы',
  5: 'Созаёмщики',
  6: 'Подтверждение',
};

export default function McpCreditApplicationRendererJsonV2() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const schema = useMemo(() => {
    // Wrap the JSON-derived RenderSchemaFn so the root container receives the live form.
    const factory: RenderSchemaFn<CreditApplicationForm> = (path) => {
      const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(
        creditApplicationJsonSchema,
        registry
      );
      const baseRoot = baseFn(path) as ContainerRenderNode<CreditApplicationForm>;
      return {
        ...baseRoot,
        componentProps: { ...baseRoot.componentProps, form },
      } as ContainerRenderNode<CreditApplicationForm>;
    };
    return createRenderSchema<CreditApplicationForm>(factory);
  }, [form]);

  // Wizard: toggle step section visibility through schema.node('stepN').setHidden(...).
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(currentStep !== n);
    }
  }, [schema, currentStep]);

  const goNext = useCallback(async () => {
    const validator = STEP_VALIDATIONS[currentStep];
    // validateForm accepts GroupNode<FormFields>; FormProxy is structurally compatible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = validator ? await validateForm(form as any, validator as any) : true;
    if (!ok) {
      form.markAsTouched();
      return;
    }
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
    setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }, [currentStep, form]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    form.markAsTouched();
    const ok = await form.validate();
    const value = form.getValue();

    console.log('[mcp-credit-renderer-json-v2] submit', { ok, value });
  }, [form]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Заявка на кредит — renderer-json v2</h1>
      <p className="text-sm text-gray-600 mb-6">
        Demo: JSON-схема + ui-kit + Tailwind. Шесть шагов через schema.node().setHidden().
      </p>

      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2 mb-6" data-testid="wizard-indicator">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
          const isCurrent = n === currentStep;
          const isCompleted = completedSteps.has(n);
          const cls = isCurrent
            ? 'bg-blue-600 text-white border-blue-600'
            : isCompleted
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-gray-100 text-gray-500 border-gray-200';
          return (
            <li
              key={n}
              data-testid={`step-chip-${n}`}
              data-current={isCurrent ? 'true' : undefined}
              data-completed={isCompleted ? 'true' : undefined}
              className={`px-3 py-1 text-xs rounded-full border ${cls}`}
            >
              {isCompleted && !isCurrent ? '✓ ' : `${n}. `}
              {STEP_TITLES[n]}
            </li>
          );
        })}
      </ol>

      <CreditFormProvider form={form}>
        <JsonRendererProvider settings={{ registry, fieldWrapper: FormField }}>
          <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
        </JsonRendererProvider>
      </CreditFormProvider>

      <div className="mt-6 flex gap-2">
        {currentStep > 1 && (
          <Button type="button" variant="outline" onClick={goBack} data-testid="wizard-back">
            Назад
          </Button>
        )}
        {currentStep < TOTAL_STEPS && (
          <Button type="button" onClick={goNext} data-testid="wizard-next">
            Далее
          </Button>
        )}
        {currentStep === TOTAL_STEPS && (
          <Button type="submit" onClick={handleSubmit} data-testid="wizard-submit">
            Отправить
          </Button>
        )}
      </div>
    </div>
  );
}

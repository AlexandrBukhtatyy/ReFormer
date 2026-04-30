// =============================================================================
// index.tsx — page component for renderer-json (iter-10)
// =============================================================================
//
// Composition (B3 integration per playbook):
//   - createCreditApplicationForm() — schema + validation + behavior
//     (same @reformer/core form as sibling A=core).
//   - RenderSchemaFn-wrapper injects `form` into root FormRoot componentProps
//     so that RenderNodeComponent forwards it down to FieldNodes.
//   - Wizard step orchestration: useState(currentStep) + per-condition
//     useEffect schema.node('stepN').setHidden(...) — A4×B3 pair.
//   - Conditional sub-section visibility: per-condition useEffect bridge using
//     useFormControlValue (Patch L) — never raw effect() + signal-write.
//
// Patches encoded:
//   K — JSON leaves use `model`, page just consumes that.
//   L — useFormControlValue + per-condition useEffect; no raw effect().
//   M — N/A here (form.X reads from callback are inside schema.ts via
//       computeFrom/copyFrom; this file only reads through useFormControlValue).
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useFormControlValue,
  validateForm,
  type GroupNode,
} from '@reformer/core';
import { Button, FormField } from '@reformer/ui-kit';
import {
  FormRenderer,
  createRenderSchema,
  type ContainerRenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import { createRenderSchemaFromJson } from '@reformer/renderer-json';
import {
  Coins,
  User,
  Phone,
  Briefcase,
  FileText,
  CheckSquare,
} from 'lucide-react';

import { createCreditApplicationForm, STEP_VALIDATIONS, fullValidation } from './schema';
import { creditApplicationJsonSchema } from './render-schema';
import { createCreditApplicationRegistry } from './registry';
import { happyPathFixture } from './data-fixture';
import type { CreditApplicationFormV10 } from './types';

const TOTAL_STEPS = 6;

const STEP_META = [
  { n: 1, label: 'Кредит', icon: Coins },
  { n: 2, label: 'Данные', icon: User },
  { n: 3, label: 'Контакты', icon: Phone },
  { n: 4, label: 'Работа', icon: Briefcase },
  { n: 5, label: 'Доп. инфо', icon: FileText },
  { n: 6, label: 'Подтверждение', icon: CheckSquare },
] as const;

export default function McpCreditApplicationRendererJsonV10() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const registry = useMemo(() => createCreditApplicationRegistry(), []);

  // B3: wrap converter so root FormRoot receives `form` via componentProps.
  const schema = useMemo(() => {
    const baseFn = createRenderSchemaFromJson<CreditApplicationFormV10>(
      creditApplicationJsonSchema,
      registry
    );
    const fnWithForm: RenderSchemaFn<CreditApplicationFormV10> = (path) => {
      const root = baseFn(path) as ContainerRenderNode<CreditApplicationFormV10>;
      return {
        ...root,
        componentProps: { ...(root.componentProps ?? {}), form },
      };
    };
    return createRenderSchema(fnWithForm);
  }, [registry, form]);

  const [currentStep, setCurrentStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);

  // ---------------------------------------------------------------------------
  // Wizard step visibility (A4 × B3 — useEffect cascade)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      schema.node(`step${n}`).setHidden(n !== currentStep);
    }
  }, [schema, currentStep]);

  // ---------------------------------------------------------------------------
  // Conditional sub-section visibility — per-condition useEffect, useFormControlValue bridge.
  // (Patch L: never raw effect() + setHidden in same scope.)
  // ---------------------------------------------------------------------------
  const loanType = useFormControlValue(form.loanType as never) as string;
  useEffect(() => {
    schema.node('mortgage-section').setHidden(loanType !== 'mortgage');
  }, [schema, loanType]);
  useEffect(() => {
    schema.node('car-section').setHidden(loanType !== 'car');
  }, [schema, loanType]);

  const sameAsRegistration = useFormControlValue(
    form.sameAsRegistration as never
  ) as boolean;
  useEffect(() => {
    schema.node('residence-section').setHidden(sameAsRegistration === true);
  }, [schema, sameAsRegistration]);

  const employmentStatus = useFormControlValue(
    form.employmentStatus as never
  ) as string;
  useEffect(() => {
    schema.node('employed-section').setHidden(employmentStatus !== 'employed');
  }, [schema, employmentStatus]);
  useEffect(() => {
    schema
      .node('business-section')
      .setHidden(employmentStatus !== 'selfEmployed');
  }, [schema, employmentStatus]);

  const hasProperty = useFormControlValue(form.hasProperty as never) as boolean;
  useEffect(() => {
    schema.node('properties-section').setHidden(hasProperty !== true);
  }, [schema, hasProperty]);

  const hasExistingLoans = useFormControlValue(
    form.hasExistingLoans as never
  ) as boolean;
  useEffect(() => {
    schema.node('existingLoans-section').setHidden(hasExistingLoans !== true);
  }, [schema, hasExistingLoans]);

  const hasCoBorrower = useFormControlValue(
    form.hasCoBorrower as never
  ) as boolean;
  useEffect(() => {
    schema.node('coBorrowers-section').setHidden(hasCoBorrower !== true);
  }, [schema, hasCoBorrower]);

  // ---------------------------------------------------------------------------
  // Wizard navigation
  // ---------------------------------------------------------------------------

  const goToStep = useCallback(
    (n: number) => {
      if (n < 1 || n > TOTAL_STEPS) return;
      if (n > maxReached) return;
      setCurrentStep(n);
    },
    [maxReached]
  );

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const goNext = useCallback(async () => {
    const validator = STEP_VALIDATIONS[currentStep];
    if (validator) {
      const isValid = await validateForm(
        form as unknown as GroupNode<CreditApplicationFormV10>,
        validator as never
      );
      if (!isValid) return;
    }
    setCurrentStep((s) => {
      const next = Math.min(TOTAL_STEPS, s + 1);
      setMaxReached((m) => Math.max(m, next));
      return next;
    });
  }, [currentStep, form]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const isValid = await validateForm(
        form as unknown as GroupNode<CreditApplicationFormV10>,
        fullValidation as never
      );
      if (!isValid) return;
      const values = (form as any).getValue?.() ?? (form as any).values?.value;
      // eslint-disable-next-line no-console
      console.log('[mcp-credit-application-renderer-json-v10] submit', values);
      window.alert('Заявка отправлена (mock)');
    },
    [form]
  );

  // ---------------------------------------------------------------------------
  // Fill-fake-data — set every leaf to happyPathFixture
  // ---------------------------------------------------------------------------

  const fillFakeData = useCallback(() => {
    const setLeaves = (node: any, value: any, _pathSegments: string[] = []) => {
      if (node == null) return;
      if (typeof node?.setValue === 'function' && typeof value !== 'object') {
        node.setValue(value);
        return;
      }
      if (typeof node?.setValue === 'function' && value === null) {
        node.setValue(value);
        return;
      }
      if (Array.isArray(value)) {
        // ArrayNode: clear, then add each item, then descend per-item.
        if (typeof node?.clear === 'function') node.clear();
        if (typeof node?.add === 'function') {
          // For each fixture item, add one and descend
          value.forEach((item: any) => {
            // Use plain leaf-tree default; add() with no args creates default item
            node.add();
          });
          // descend after items exist
          const items =
            (typeof node?.at === 'function' && node?.length?.value) ||
            (Array.isArray(node?.items?.value) ? node.items.value.length : 0);
          for (let i = 0; i < items; i++) {
            const child = node.at?.(i);
            setLeaves(child, value[i]);
          }
        }
        return;
      }
      if (typeof value === 'object' && value !== null) {
        // GroupNode-like: descend by keys
        for (const key of Object.keys(value)) {
          const childNode = (node as any)?.[key];
          if (childNode != null) setLeaves(childNode, (value as any)[key]);
        }
        return;
      }
      // Leaf: setValue if available
      if (typeof node?.setValue === 'function') node.setValue(value);
    };
    setLeaves(form, happyPathFixture);
  }, [form]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Заявка на кредит (renderer-json v10)
        </h1>
        <Button
          type="button"
          variant="outline"
          data-testid="fill-fake-data"
          onClick={fillFakeData}
        >
          Заполнить тестовыми данными
        </Button>
      </div>

      {/* Step indicator */}
      <ol
        className="flex items-center gap-2 flex-wrap"
        data-testid="step-indicator"
      >
        {STEP_META.map((s, i) => {
          const Icon = s.icon;
          const completed = s.n < currentStep;
          const isActive = s.n === currentStep;
          const reachable = s.n <= maxReached;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                data-testid={`step-indicator-${s.n}`}
                data-current={isActive ? 'true' : undefined}
                data-completed={completed ? 'true' : undefined}
                onClick={() => goToStep(s.n)}
                className={[
                  'inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : completed
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-gray-600 border-gray-300',
                  reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                ].join(' ')}
              >
                <Icon size={16} />
                <span>{`${s.n}. ${s.label}`}</span>
              </button>
              {i < STEP_META.length - 1 && (
                <span aria-hidden className="text-gray-300">
                  —
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <form onSubmit={onSubmit} className="space-y-6">
        <FormRenderer
          render={schema}
          settings={{ fieldWrapper: FormField as never }}
        />

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              data-testid="btn-prev"
              onClick={goPrev}
            >
              ← Назад
            </Button>
          ) : (
            <span aria-hidden />
          )}
          {currentStep < TOTAL_STEPS ? (
            <Button type="button" data-testid="btn-next" onClick={goNext}>
              Далее →
            </Button>
          ) : (
            <Button type="submit" data-testid="btn-submit">
              Отправить
            </Button>
          )}
        </div>
        <div className="text-sm text-center text-gray-500">
          Шаг {currentStep} из {TOTAL_STEPS} •{' '}
          {Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100)}% завершено
        </div>
      </form>
    </div>
  );
}

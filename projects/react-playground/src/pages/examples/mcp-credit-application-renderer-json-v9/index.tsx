/**
 * mcp-credit-application-renderer-json-v9
 *
 * iter-9 регрессия MCP-сервера, target=renderer-json.
 * Wizard pair = (A1: ui-kit FormWizard, B: ui-kit FormWizard internal switching).
 *
 * Архитектура (Patch F-1: RenderSchemaFn-wrapper для form-injection):
 *
 *   1. createCreditApplicationForm() — typed FormProxy.
 *   2. createCreditApplicationRegistry() — defineRegistry с ui-kit + sources.
 *   3. createRenderSchemaFromJson(jsonSchema, registry) — конвертирует JSON в
 *      RenderSchemaFn<T>, но не инжектит form в root.componentProps.
 *   4. Оборачиваем baseFn в fnWithForm: добавляет
 *      `componentProps: { ...root.componentProps, form, config, onSubmit }` на
 *      root-узел (`wizard`). FormWizard через `__selfManagedChildren = true`
 *      получает form + config + onSubmit как props.
 *   5. createRenderSchema(fnWithForm) → RenderSchemaProxy. Вызываем
 *      schema.node(selector).setHidden(...) для условных секций (hideWhen
 *      orchestration в renderEffect).
 *   6. <FormRenderer render={schema} settings={{ fieldWrapper: FormField }}>.
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  FormRenderer,
  createRenderSchema,
  type ContainerRenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import { createRenderSchemaFromJson } from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';
import { useFormControlValue } from '@reformer/core';
import { createCreditApplicationForm, STEP_VALIDATIONS, fullValidation } from './schema';
import { createCreditApplicationRegistry } from './registry';
import { creditApplicationJsonSchema } from './render-schema';
import { happyPathFixture } from './data-fixture';
import type { CreditApplicationForm } from './types';

export default function McpCreditApplicationRendererJsonV9() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const registry = useMemo(() => createCreditApplicationRegistry(), []);

  const handleSubmit = useMemo(
    () => async (values: CreditApplicationForm) => {
      console.log('[mcp-credit-renderer-json-v9] submit', values);
      alert('Заявка отправлена! См. console для деталей.');
    },
    []
  );

  const schema = useMemo(() => {
    const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(
      creditApplicationJsonSchema,
      registry
    );
    // F-1: RenderSchemaFn-wrapper for form-injection into FormWizard root.
    // ui-kit FormWizard ожидает props: form, config, onSubmit. Они НЕ
    // часть JSON-схемы (это runtime-сущности), поэтому patch'им root.componentProps.
    const fnWithForm: RenderSchemaFn<CreditApplicationForm> = (path) => {
      const root = baseFn(path) as ContainerRenderNode<CreditApplicationForm>;
      return {
        ...root,
        componentProps: {
          ...(root.componentProps ?? {}),
          form,
          config: {
            stepValidations: STEP_VALIDATIONS,
            fullValidation,
          },
          onSubmit: handleSubmit,
        },
      };
    };
    return createRenderSchema(fnWithForm);
  }, [registry, form, handleSubmit]);

  // ── Orchestration: setHidden для условных секций ──
  // Используем `useFormControlValue` (signal → React state) + отдельные
  // useEffect'ы. Combining `effect()` с setHidden внутри одного блока даёт
  // «Cycle detected» — setHidden пишет в hidden-signal, effect re-runs.
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
    schema.node('income-section').setHidden(employmentStatus === 'unemployed');
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

  // Fill-button (dev-only)
  const fillButtonRef = useRef<HTMLButtonElement>(null);
  const handleFill = () => {
    form.setValue(happyPathFixture);
  };

  return (
    <div className="w-full p-6">
      {import.meta.env?.DEV !== false && (
        <div className="mb-4 flex justify-end">
          <button
            ref={fillButtonRef}
            type="button"
            data-testid="fill-fake-data"
            onClick={handleFill}
            className="px-3 py-1 text-xs bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-amber-900"
          >
            Fill fake data (dev)
          </button>
        </div>
      )}
      <FormRenderer<CreditApplicationForm>
        render={schema}
        settings={{ fieldWrapper: FormField }}
      />
    </div>
  );
}

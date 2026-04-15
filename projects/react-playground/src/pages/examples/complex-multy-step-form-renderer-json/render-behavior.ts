/**
 * Behavior-схема JSON-варианта кредитной заявки.
 *
 * Тонкая обёртка над TS-variant behavior-ом:
 * 1. Инжектит в `componentProps` wizard-а через `onInit` (build-time hook,
 *    до первого рендера) всё form-specific: сам FormProxy, step-validations и
 *    full-validation. JSON-схема не знает про эти сущности — она описывает layout.
 * 2. Делегирует остальное (hideWhen для conditional sections, onComponentEvent
 *    для submit, renderEffect, lifecycle-хуки) в общий `createCreditApplicationRenderBehavior`.
 */

import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from '../complex-multy-step-form/schemas/credit-application-validation';
import { createCreditApplicationRenderBehavior } from '../complex-multy-step-form-renderer/render-behavior';

export function createCreditApplicationJsonRenderBehavior(
  form: FormProxy<CreditApplicationForm>
): RenderBehaviorFn<CreditApplicationForm> {
  return (schema) => {
    onInit(schema.node('wizard'), () => ({
      form,
      stepValidations: STEP_VALIDATIONS,
      fullValidation: creditApplicationValidation,
    }));
    createCreditApplicationRenderBehavior(form)(schema);
  };
}

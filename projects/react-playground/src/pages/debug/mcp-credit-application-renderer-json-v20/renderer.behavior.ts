// renderer.behavior.ts — runtime wiring the static JSON can't express:
// inject form + validation into the wizard, submit, and conditional sections.

import {
  hideWhen,
  onComponentEvent,
  onInit,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';
import type { FormModel, FormProxy } from '@reformer/core';
import { makeValidationConfig } from './validation';
import { submitCreditApplication } from './api';
import type { CreditApplicationForm, FormMode } from './types';

export type RenderBehaviorOptions = {
  mode?: FormMode;
  simulateError?: boolean;
  onResult?: (message: string, ok: boolean) => void;
};

export function createJsonRenderBehavior(
  form: FormProxy<CreditApplicationForm>,
  model: FormModel<CreditApplicationForm>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<CreditApplicationForm> {
  const { mode = 'create', simulateError = false, onResult } = options;

  return (schema) => {
    const wizard = schema.node('wizard');

    // (a) Inject runtime entities: form + validateStep/validateAll.
    onInit(wizard, () => {
      wizard.patchProps({ form, ...makeValidationConfig(model) });
      if (mode === 'view') form.disable(); // model-level cascade → read-only
    });

    // (b) Submit — read values from the model, call mock API, surface result.
    onComponentEvent(wizard, 'onSubmit', async () => {
      const values = model.get();
      const res = await submitCreditApplication(values, simulateError);
      if (res.success) {
        onResult?.(`Заявка отправлена. Номер: ${res.data.id}`, true);
      } else {
        onResult?.(res.error, false);
      }
    });

    // (c) Conditional sections — reactive by form signals (read `.value.value`).
    hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
    hideWhen(schema.node('car-section'), () => form.loanType.value.value !== 'car');
    hideWhen(schema.node('residence-section'), () => form.sameAsRegistration.value.value === true);
    hideWhen(
      schema.node('employed-section'),
      () => form.employmentStatus.value.value !== 'employed'
    );
    hideWhen(
      schema.node('self-employed-section'),
      () => form.employmentStatus.value.value !== 'selfEmployed'
    );
    hideWhen(schema.node('properties-section'), () => form.hasProperty.value.value !== true);
    hideWhen(schema.node('loans-section'), () => form.hasExistingLoans.value.value !== true);
    hideWhen(schema.node('coborrowers-section'), () => form.hasCoBorrower.value.value !== true);
  };
}

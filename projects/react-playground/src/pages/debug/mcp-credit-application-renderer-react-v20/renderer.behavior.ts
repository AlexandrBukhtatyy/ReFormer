// renderer.behavior.ts — declarative render behavior: hideWhen for conditional sections
// (visibility layer; availability/validation handled by enableWhen + branch nodes) + submit wiring.

import type { FormModel } from '@reformer/core';
import { hideWhen, onComponentEvent, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { CreditApplicationForm } from './types';
import { submitCreditApplication } from './api';

export function makeCreditRenderBehavior(
  model: FormModel<CreditApplicationForm>,
  onDone?: (result: { id?: string; message: string }) => void
): RenderBehaviorFn<CreditApplicationForm> {
  return (schema) => {
    // Conditional sections — hidden until the controlling value matches.
    hideWhen(schema.node('mortgage-section'), () => model.$.loanType.value !== 'mortgage');
    hideWhen(schema.node('car-section'), () => model.$.loanType.value !== 'car');
    hideWhen(schema.node('employed-section'), () => model.$.employmentStatus.value !== 'employed');
    hideWhen(
      schema.node('selfEmployed-section'),
      () => model.$.employmentStatus.value !== 'selfEmployed'
    );
    hideWhen(schema.node('residence-section'), () => model.$.sameAsRegistration.value === true);
    hideWhen(schema.node('properties-section'), () => model.$.hasProperty.value !== true);
    hideWhen(schema.node('existingLoans-section'), () => model.$.hasExistingLoans.value !== true);
    hideWhen(schema.node('coBorrowers-section'), () => model.$.hasCoBorrower.value !== true);

    // Submit — FormWizard onSubmit is no-arg; read values from the model.
    onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
      const result = await submitCreditApplication(model.get());
      onDone?.(result);
    });
  };
}

import type { FormProxy } from '@reformer/core';
import {
  createRenderSchema,
  hideWhen,
  type RenderBehaviorFn,
  type RenderSchemaFn,
  type RenderNode,
} from '@reformer/renderer-react';
import { createRenderSchemaFromJson } from '@reformer/renderer-json';
import { jsonSchema } from './json-schema';
import { registry } from './registry';
import type { CreditApplicationForm } from './types';

// Closure factory: wraps the JSON-derived RenderSchemaFn so the root FormRoot
// component receives the live form via componentProps (per Quick Start pattern).

function createCreditApplicationSchemaFn(
  form: FormProxy<CreditApplicationForm>
): RenderSchemaFn<CreditApplicationForm> {
  return (path) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(jsonSchema, registry) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseRoot = baseFn(path) as RenderNode<any>;
    return {
      ...baseRoot,
      componentProps: { ...(baseRoot.componentProps as object), form },
    } as RenderNode<CreditApplicationForm>;
  };
}

// ── Render behavior: FormArray section gating ──────────────────────────────────
// Hides the three FormArray sections when their controlling checkbox is false.
// Uses hideWhen with reactive Preact-signal access via form proxy (captured in closure).
// Rule #8 compliant: no enableWhen on ArrayNode — visibility only, no resetOnDisable.

function makeArrayGating(
  form: FormProxy<CreditApplicationForm>
): RenderBehaviorFn<CreditApplicationForm> {
  const arrayGating: RenderBehaviorFn<CreditApplicationForm> = (schema) => {
    hideWhen(schema.node('properties-section'), () => {
      return !(form.step5.hasProperty.value.value as boolean);
    });
    hideWhen(schema.node('existing-loans-section'), () => {
      return !(form.step5.hasExistingLoans.value.value as boolean);
    });
    hideWhen(schema.node('co-borrowers-section'), () => {
      return !(form.step5.hasCoBorrower.value.value as boolean);
    });
  };
  return arrayGating;
}

export function createCreditApplicationRenderSchema(form: FormProxy<CreditApplicationForm>) {
  const schema = createRenderSchema<CreditApplicationForm>(createCreditApplicationSchemaFn(form));

  // Apply FormArray section gating: reactive hideWhen conditions via form closure
  makeArrayGating(form)(schema);

  return schema;
}

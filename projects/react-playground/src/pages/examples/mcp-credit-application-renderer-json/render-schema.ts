import type { FormProxy } from '@reformer/core';
import { createRenderSchema, type RenderSchemaFn, type RenderNode } from '@reformer/renderer-react';
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

export function createCreditApplicationRenderSchema(form: FormProxy<CreditApplicationForm>) {
  return createRenderSchema<CreditApplicationForm>(createCreditApplicationSchemaFn(form));
}

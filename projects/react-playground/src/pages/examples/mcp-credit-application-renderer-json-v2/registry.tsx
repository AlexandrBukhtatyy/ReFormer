import type { FormProxy } from '@reformer/core';
import {
  Box,
  Section,
  Input,
  InputMask,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
  FormField,
} from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';

import type { CreditApplicationForm } from './types';
import { LOAN_TYPE_OPTIONS, EMPLOYMENT_STATUS_OPTIONS, MARITAL_STATUS_OPTIONS } from './schema';

// FormRoot — required for JSON renderer to forward the live FormProxy down to RenderNode tree.
function FormRoot<T>({ form, children }: { form: FormProxy<T>; children: RenderNode<T>[] }) {
  return (
    <>
      {children.map((child, i) => (
        <RenderNodeComponent key={i} node={child} form={form} />
      ))}
    </>
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(FormRoot as any).__selfManagedChildren = true;

export const registry: ComponentRegistry = defineRegistry((reg) => {
  // containers
  reg.container('FormRoot', FormRoot as never);
  reg.container('Box', Box);
  reg.container('Section', Section);
  reg.container(FIELD_WRAPPER, FormField);

  // fields
  reg.field('Input', Input);
  reg.field('InputMask', InputMask);
  reg.field('Select', Select);
  reg.field('Textarea', Textarea);
  reg.field('Checkbox', Checkbox);
  reg.field('RadioGroup', RadioGroup);

  // source values
  reg.source('LOAN_TYPE_OPTIONS', LOAN_TYPE_OPTIONS);
  reg.source('EMPLOYMENT_STATUS_OPTIONS', EMPLOYMENT_STATUS_OPTIONS);
  reg.source('MARITAL_STATUS_OPTIONS', MARITAL_STATUS_OPTIONS);
});

export type { CreditApplicationForm };

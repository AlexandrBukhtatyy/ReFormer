// =============================================================================
// registry.tsx — Component & source registry for renderer-json (iter-10)
// =============================================================================
//
// Pattern: ui-kit field components + container components + FormRoot
// (self-managed children carrying `form` via componentProps) + sources for
// option arrays referenced by string from JSON.
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FormProxy } from '@reformer/core';
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import {
  Box,
  Button,
  Checkbox,
  FormField,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import { FormArraySection } from '@reformer/ui-kit/form-array';

import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from './types';

// -----------------------------------------------------------------------------
// FormRoot — self-managed B3 root. Renderer-react `FormRenderer(render={schema})`
// calls the recursive walker with form=undefined at root. With
// `__selfManagedChildren = true` the renderer hands raw RenderNode[] children +
// form (from componentProps) to FormRoot, which threads form down via
// RenderNodeComponent — restoring field resolution.
// -----------------------------------------------------------------------------

function FormRoot<T>({
  form,
  children,
}: {
  form: FormProxy<T>;
  children: RenderNode<T>[];
}) {
  return (
    <>
      {children.map((c, i) => (
        <RenderNodeComponent key={i} node={c} form={form} />
      ))}
    </>
  );
}
(FormRoot as any).__selfManagedChildren = true;

// -----------------------------------------------------------------------------
// createCreditApplicationRegistry — registry factory used by index.tsx.
// -----------------------------------------------------------------------------

export function createCreditApplicationRegistry() {
  return defineRegistry((reg) => {
    // ui-kit field components (each accepts FieldNode via FormField wrapper)
    reg.field('Input', Input);
    reg.field('InputMask', InputMask);
    reg.field('Textarea', Textarea);
    reg.field('Select', Select);
    reg.field('Checkbox', Checkbox);
    reg.field('RadioGroup', RadioGroup);

    // ui-kit layout containers
    reg.container('Box', Box);
    reg.container('Section', Section);
    reg.container('Button', Button);

    // FormArray section (works with renderer-json $template for itemComponent)
    reg.container('FormArraySection', FormArraySection as any);

    // Self-managed root that forwards `form` down
    reg.container('FormRoot', FormRoot);

    // FIELD_WRAPPER — auto-wraps every field-typed leaf in label+error+pending.
    reg.container(FIELD_WRAPPER, FormField);

    // Source: option arrays referenced by string in JSON componentProps.
    reg.source('LOAN_TYPE_OPTIONS', [...LOAN_TYPE_OPTIONS]);
    reg.source('GENDER_OPTIONS', [...GENDER_OPTIONS]);
    reg.source('EMPLOYMENT_OPTIONS', [...EMPLOYMENT_OPTIONS]);
    reg.source('MARITAL_OPTIONS', [...MARITAL_OPTIONS]);
    reg.source('EDUCATION_OPTIONS', [...EDUCATION_OPTIONS]);
    reg.source('PROPERTY_TYPE_OPTIONS', [...PROPERTY_TYPE_OPTIONS]);
  });
}

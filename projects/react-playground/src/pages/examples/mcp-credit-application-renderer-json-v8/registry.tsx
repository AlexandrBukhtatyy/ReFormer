/**
 * Component registry for credit-application iter-8 / target=renderer-json.
 *
 * Authored via MCP create-form prompt (target=renderer-json) + add-form-array
 * (Path C ui-kit migration).
 *
 * Uses:
 * - ui-kit fields/containers (Input, Select, Box, Section, AsyncBoundary, FormField).
 * - `FormArraySection` from `@reformer/ui-kit/form-array` (Path C unified component;
 *   itemComponent shape = `ComponentType<{ control }>`. JSON inline `$template`
 *   wrapped to FC by converter.)
 * - Self-managed `FormRoot` with `__selfManagedChildren = true`. Receives `form`
 *   via componentProps (injected by RenderSchemaFn-wrapper in `index.tsx`,
 *   Patch F-1) and forwards it to children via `<RenderNodeComponent form={form}>`.
 * - `FIELD_WRAPPER` constant → ui-kit `FormField` (the form-control compound used
 *   for ordinary leaf inputs).
 * - Source-functions for itemLabel + LoadingState/ErrorStateDefault for AsyncBoundary.
 */

import { createElement, type ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import {
  Input,
  InputMask,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  Box,
  Section,
  FormField,
  AsyncBoundary,
  LoadingState,
  ErrorState,
  FormArraySection,
} from '@reformer/ui-kit';
import type { CreditApplicationForm, Property, ExistingLoan, CoBorrower } from './types';
import {
  LOAN_TYPES,
  EMPLOYMENT_STATUSES,
  MARITAL_STATUSES,
  EDUCATIONS,
  GENDERS,
  EXISTING_LOAN_TYPES,
  RELATIONSHIPS,
  PROPERTY_TYPES,
} from './schema';

// ----------------------------------------------------------------------------
// Self-managed FormRoot
// ----------------------------------------------------------------------------

interface FormRootProps {
  form?: FormProxy<CreditApplicationForm>;
  children?: RenderNode<CreditApplicationForm>[];
}

function FormRoot({ form, children }: FormRootProps): ReactNode {
  if (!form || !children) return null;
  return (
    <>
      {children.map((child, i) => (
        <RenderNodeComponent key={i} node={child} form={form} />
      ))}
    </>
  );
}
// Required marker so the renderer passes form/children down rather than rendering them itself.
(FormRoot as unknown as { __selfManagedChildren: boolean }).__selfManagedChildren = true;

// ----------------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------------

export function createCreditApplicationRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Fields (leaf inputs)
    reg.field('Input', Input);
    reg.field('InputMask', InputMask);
    reg.field('Textarea', Textarea);
    reg.field('Select', Select);
    reg.field('Checkbox', Checkbox);
    reg.field('RadioGroup', RadioGroup);

    // Containers
    reg.container('Box', Box);
    reg.container('Section', Section);
    reg.container('AsyncBoundary', AsyncBoundary);
    reg.container('FormRoot', FormRoot);

    // Form-array (Path C — single ui-kit component, itemComponent is FC)
    reg.container('FormArraySection', FormArraySection);

    // Field wrapper (label/error compound)
    reg.container(FIELD_WRAPPER, FormField);

    // AsyncBoundary slots
    reg.source('LoadingState', LoadingState);
    reg.source('ErrorStateDefault', () =>
      createElement(ErrorState, { error: 'Не удалось загрузить заявку' })
    );

    // Item-label sources (referenced by name in JSON FormArraySection.itemLabel)
    reg.source(
      'PROPERTY_ITEM_LABEL',
      (_: FormProxy<Property>, index: number) => `Имущество #${index + 1}`
    );
    reg.source(
      'EXISTING_LOAN_ITEM_LABEL',
      (_: FormProxy<ExistingLoan>, index: number) => `Кредит #${index + 1}`
    );
    reg.source(
      'CO_BORROWER_ITEM_LABEL',
      (_: FormProxy<CoBorrower>, index: number) => `Созаемщик #${index + 1}`
    );

    // Option arrays — duplicated from `schema.ts` componentProps.
    // The runtime source-of-truth is `createForm` componentProps; these JSON
    // references are documentation only (see create-form.md inline rule for
    // `target=renderer-json`).
    reg.source('LOAN_TYPES', LOAN_TYPES);
    reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.source('EDUCATIONS', EDUCATIONS);
    reg.source('GENDERS', GENDERS);
    reg.source('PROPERTY_TYPES', PROPERTY_TYPES);
    reg.source('EXISTING_LOAN_TYPES', EXISTING_LOAN_TYPES);
    reg.source('RELATIONSHIPS', RELATIONSHIPS);
  });
}

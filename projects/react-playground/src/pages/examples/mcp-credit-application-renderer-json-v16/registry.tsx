/* eslint-disable react-refresh/only-export-components */
/**
 * iter-16 / renderer-json — component + source registry.
 *
 * Field components, container components (Box/Section/FormWizard/FormArraySection),
 * and source values (option lists, plain-leaf templates, item-label fns) for JSON schema.
 *
 * Exported as a factory `buildRegistry(extras)` because closures (form, onSubmit, config)
 * can only be captured at component-mount time. There is no `ComponentRegistry.clone()`
 * API in @reformer/renderer-json (gap discovered iter-16) — so we rebuild from scratch
 * with merged extras instead.
 */
import { type ReactNode } from 'react';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import {
  Input,
  InputMask,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
  Button,
  FormField,
} from '@reformer/ui-kit';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { FormArraySection } from '@reformer/ui-kit/form-array';

import { FormRoot } from './JsonFormApp';
import {
  LOAN_TYPES,
  GENDERS,
  EMPLOYMENT_STATUSES,
  MARITAL_STATUSES,
  EDUCATIONS,
  PROPERTY_TYPES,
  REGIONS,
  CURRENT_YEAR_PLUS_ONE,
  propertyTemplate,
  existingLoanTemplate,
  coBorrowerTemplate,
} from './schema';

// Local Box and Section containers (lightweight, declarative)
function Box({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}): ReactNode {
  return <div className={className ?? 'space-y-3'}>{children}</div>;
}

function Section({
  children,
  className,
  title,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
}): ReactNode {
  return (
    <section className={className ?? 'space-y-4 border rounded p-4 bg-white'}>
      {title ? <h3 className="text-base font-semibold">{title}</h3> : null}
      {children}
    </section>
  );
}

export interface RegistryExtras {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sources?: Record<string, any>;
}

export function buildRegistry(extras: RegistryExtras = {}): ComponentRegistry {
  return defineRegistry((reg) => {
    // Field components
    reg.field('Input', Input);
    reg.field('InputMask', InputMask);
    reg.field('Select', Select);
    reg.field('Textarea', Textarea);
    reg.field('Checkbox', Checkbox);
    reg.field('RadioGroup', RadioGroup);

    // Container components
    reg.container('Box', Box);
    reg.container('Section', Section);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reg.container('FormRoot', FormRoot as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reg.container('FormWizard', FormWizard as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reg.container('FormArraySection', FormArraySection as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reg.container('Button', Button as any);

    // FIELD_WRAPPER (label/error wrapper)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reg.container(FIELD_WRAPPER, FormField as any);

    // Source values — option lists
    reg.source('LOAN_TYPES', LOAN_TYPES);
    reg.source('GENDERS', GENDERS);
    reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.source('EDUCATIONS', EDUCATIONS);
    reg.source('PROPERTY_TYPES', PROPERTY_TYPES);
    reg.source('REGIONS', REGIONS);
    reg.source('CURRENT_YEAR_PLUS_ONE', CURRENT_YEAR_PLUS_ONE);

    // Source values — plain-leaf templates for FormArraySection.initialValue
    reg.source('PROPERTY_TEMPLATE', propertyTemplate());
    reg.source('EXISTING_LOAN_TEMPLATE', existingLoanTemplate());
    reg.source('CO_BORROWER_TEMPLATE', coBorrowerTemplate());

    // Source — item-label functions
    reg.source(
      'PROPERTY_ITEM_LABEL',
      (_: unknown, index: number) => `Имущество #${index + 1}`
    );
    reg.source(
      'LOAN_ITEM_LABEL',
      (_: unknown, index: number) => `Кредит #${index + 1}`
    );
    reg.source(
      'CO_BORROWER_ITEM_LABEL',
      (_: unknown, index: number) => `Созаемщик #${index + 1}`
    );

    // Closure-captured extras (form, onSubmit, config) merged in
    if (extras.sources) {
      for (const [key, value] of Object.entries(extras.sources)) {
        reg.source(key, value);
      }
    }
  });
}

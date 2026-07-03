// registry.ts — binds component names ($component(...)) and data-source
// names ($dataSource(...)) used by renderer.schema.json. The Wizard shim adapts the
// JSON Step container-nodes into ui-kit FormWizard's { number, title, icon, body }.

import { createElement, type FC } from 'react';
import {
  Box,
  Checkbox,
  FormField,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import type { RenderNode } from '@reformer/renderer-react';
import type { CreditApplicationForm } from './types';
import {
  CO_BORROWER_ITEM_LABEL,
  CURRENT_YEAR_PLUS_ONE,
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  GENDERS,
  LOAN_ITEM_LABEL,
  LOAN_TYPES,
  MARITAL_STATUSES,
  PROPERTY_ITEM_LABEL,
  PROPERTY_TYPES,
  REGIONS,
} from './data-sources';

/** Shape of a converted JSON Step container-node passed via componentProps.steps. */
type StepRenderNode = {
  componentProps?: { title?: string; icon?: string };
  children?: RenderNode<CreditApplicationForm>[];
};

/**
 * `$component(Wizard)` shim: turns the JSON `Step` container-nodes into ui-kit
 * FormWizard steps (each step's children become a Box RenderNode `body`), and
 * threads through the injected `form` + validation config.
 */
const RendererFormWizard: FC<Record<string, unknown>> = (props) => {
  const rawSteps = (props.steps as StepRenderNode[] | undefined) ?? [];
  const steps = rawSteps.map((node, i) => ({
    number: i + 1,
    title: node.componentProps?.title ?? `Шаг ${i + 1}`,
    icon: node.componentProps?.icon,
    body: {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: node.children ?? [],
    },
  })) as unknown as FormWizardStep<CreditApplicationForm>[];

  return createElement(FormWizard as unknown as FC<Record<string, unknown>>, {
    form: props.form,
    steps,
    config: { validateStep: props.validateStep, validateAll: props.validateAll },
    onSubmit: props.onSubmit,
  });
};

export function createRegistry() {
  return defineRegistry((reg) => {
    // Wizard system components.
    reg.component('Wizard', RendererFormWizard);
    reg.component('Step', Box); // step node data is consumed by the shim above

    // Layout containers.
    reg.component('Box', Box);
    reg.component('Section', Section);

    // Leaf field components.
    reg.component('Input', Input);
    reg.component('Select', Select);
    reg.component('Textarea', Textarea);
    reg.component('Checkbox', Checkbox);
    reg.component('RadioGroup', RadioGroup);
    reg.component('InputMask', InputMask);

    // Field wrapper (label / error / hint).
    reg.component(FIELD_WRAPPER, FormField);

    // Static option dictionaries.
    reg.dataSource('LOAN_TYPES', LOAN_TYPES);
    reg.dataSource('GENDERS', GENDERS);
    reg.dataSource('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.dataSource('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.dataSource('EDUCATION_LEVELS', EDUCATION_LEVELS);
    reg.dataSource('PROPERTY_TYPES', PROPERTY_TYPES);
    reg.dataSource('REGIONS', REGIONS);
    reg.dataSource('CURRENT_YEAR_PLUS_ONE', CURRENT_YEAR_PLUS_ONE);

    // Array item-label functions.
    reg.dataSource('PROPERTY_ITEM_LABEL', PROPERTY_ITEM_LABEL);
    reg.dataSource('LOAN_ITEM_LABEL', LOAN_ITEM_LABEL);
    reg.dataSource('CO_BORROWER_ITEM_LABEL', CO_BORROWER_ITEM_LABEL);
  });
}

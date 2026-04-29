/**
 * Реестр компонентов и source-значений для JSON-схемы кредитной заявки.
 *
 * Содержит:
 * - ui-kit fields: Input, InputMask, Textarea, Select, Checkbox, RadioGroup.
 * - ui-kit containers: Box, Section.
 * - **FormRoot** — самонаписанный self-managed корень дерева. Маркер
 *   `__selfManagedChildren = true` обязателен — без него `RenderNodeComponent`
 *   НЕ передаёт `form` prop в FormRoot, и поля молча рендерятся пустыми.
 * - **RendererFormArraySection** — app-level (НЕ из `@reformer/renderer-react`).
 *   Импорт из `'../../../components/RendererFormArraySection'`.
 * - **FIELD_WRAPPER** → FormField (ui-kit) — рендерит label / error / pending
 *   вокруг каждого field-узла.
 * - 8 option arrays — для Select/RadioGroup. Дублируются как source (для JSON
 *   ссылки по строке) и используются напрямую в `createForm` componentProps в
 *   `schema.ts` (Patch D). JSON-ссылка остаётся как документация — рантайм
 *   подхватывает значение из componentProps на FieldNode.
 * - 3 templates — plain-leaf factories для AddButton initialValue. Передаются
 *   через `componentProps.initialValue` в `RendererFormArraySection`.
 */

import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { FormProxy } from '@reformer/core';
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
} from '@reformer/ui-kit';

import { RendererFormArraySection } from '../../../components/RendererFormArraySection';
import {
  LOAN_TYPES,
  EMPLOYMENT_STATUSES,
  MARITAL_STATUSES,
  EDUCATIONS,
  GENDERS,
  PROPERTY_TYPES,
  EXISTING_LOAN_TYPES,
  RELATIONSHIPS,
  PROPERTY_TEMPLATE,
  EXISTING_LOAN_TEMPLATE,
  COBORROWER_TEMPLATE,
} from './schema';
import type { CreditApplicationForm } from './types';

/**
 * FormRoot — корень дерева. Self-managed: получает `form` через
 * componentProps (инжектится в `index.tsx` через RenderSchemaFn-wrapper) и
 * сам рендерит детей через `RenderNodeComponent`, прокидывая `form` дальше.
 *
 * Без маркера `__selfManagedChildren = true`:
 *   1) `RenderNodeComponent` рендерил бы детей сам (не передавая `form`),
 *   2) Field-узлы потеряли бы доступ к FormProxy и молча отрендерились бы
 *      пустыми (только консольный warning "Field rendered without form").
 */
interface FormRootProps {
  form?: FormProxy<CreditApplicationForm>;
  children?: RenderNode<CreditApplicationForm>[];
}

function FormRoot({ form, children }: FormRootProps) {
  if (!form || !children) return null;
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

export function createCreditApplicationRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // ui-kit fields
    reg.field('Input', Input);
    reg.field('InputMask', InputMask);
    reg.field('Textarea', Textarea);
    reg.field('Select', Select);
    reg.field('Checkbox', Checkbox);
    reg.field('RadioGroup', RadioGroup);

    // ui-kit containers
    reg.container('Box', Box);
    reg.container('Section', Section);

    // App-level / system containers
    reg.container('FormRoot', FormRoot);
    reg.container('FormArraySection', RendererFormArraySection);
    reg.container(FIELD_WRAPPER, FormField);

    // Option arrays (referenced by string from JSON componentProps;
    // also embedded directly in createForm componentProps — Patch D)
    reg.source('LOAN_TYPES', LOAN_TYPES);
    reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.source('EDUCATIONS', EDUCATIONS);
    reg.source('GENDERS', GENDERS);
    reg.source('PROPERTY_TYPES', PROPERTY_TYPES);
    reg.source('EXISTING_LOAN_TYPES', EXISTING_LOAN_TYPES);
    reg.source('RELATIONSHIPS', RELATIONSHIPS);

    // Templates for AddButton initialValue (PLAIN leaves, no FieldConfig).
    reg.source('PROPERTY_TEMPLATE', PROPERTY_TEMPLATE);
    reg.source('EXISTING_LOAN_TEMPLATE', EXISTING_LOAN_TEMPLATE);
    reg.source('COBORROWER_TEMPLATE', COBORROWER_TEMPLATE);
  });
}

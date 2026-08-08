/**
 * Адаптер визарда для формы «test-02»: связывает JSON-схему и ui-kit `FormWizard`.
 *
 * Шаги в схеме лежат в `componentProps.steps[]` — конвертер renderer-json уже превратил их в
 * RenderNode, поэтому здесь достаточно поднять `title`/`icon` из узла и отдать сам узел как
 * `body`, а отрисовку узла дать пропом `renderStepBody`: ui-kit `FormWizard` намеренно не
 * зависит от `@reformer/renderer-react`. `form` приходит пропом — маркер
 * `__selfManagedChildren` просит рендерер отдать её и не обходить детей самому.
 *
 * `onSubmit` навешивается снаружи — в render-behavior.ts через onComponentEvent.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { FormShape } from './model';

/** Узел шага после конвертации: `title`/`icon` лежат в его `componentProps`. */
interface StepNode {
  componentProps?: { title?: string; icon?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface WizardProps {
  /** Приходит от рендерера (см. `__selfManagedChildren`). */
  form?: FormProxy<FormShape>;
  /** Узлы шагов из `componentProps.steps`. */
  steps?: StepNode[];
  className?: string;
  onSubmit?: (values: FormShape) => void | Promise<void>;
}

export function Wizard({ form, steps = [], className, onSubmit }: WizardProps): ReactNode {
  const wizardSteps: FormWizardStep<FormShape, RenderNode<FormShape>>[] = steps.map((node, i) => ({
    number: i + 1,
    title: node.componentProps?.title ?? `Шаг ${i + 1}`,
    icon: node.componentProps?.icon,
    body: node as any,
  }));

  return (
    <FormWizard<FormShape, RenderNode<FormShape>>
      form={form as FormProxy<FormShape>}
      className={className}
      steps={wizardSteps}
      config={{}}
      renderStepBody={(body, wizardForm) => <RenderNodeComponent node={body} form={wizardForm} />}
      onSubmit={onSubmit ? () => onSubmit(form?.getValue() as FormShape) : undefined}
    />
  );
}

// Контракт с рендерером: получить `form` пропом и сырые `steps`, без обхода детей.
(Wizard as any).__selfManagedChildren = true;

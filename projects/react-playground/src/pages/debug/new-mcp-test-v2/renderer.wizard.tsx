/**
 * App-шим под `$component(Wizard)`.
 *
 * Библиотека `RendererFormWizard` НЕ экспортирует — компонент, который
 * резолвится по имени `Wizard`, пишет приложение. Шим снимает `title`/`icon`
 * с `componentProps` Step-нод, кладёт сам узел в `step.body` и отдаёт ui-kit
 * `FormWizard` стратегию отрисовки тела (`renderStepBody`): ui-kit намеренно
 * не зависит от рендерера.
 */
import { useMemo, type ReactNode, type Ref } from 'react';

import type { FormProxy } from '@reformer/core';
import type { FormWizardConfig, FormWizardHandle } from '@reformer/cdk/form-wizard';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

type StepNode<T> = RenderNode<T> & {
  componentProps?: { title?: string; icon?: string };
};

export interface RendererFormWizardProps<T extends Record<string, unknown>> {
  /** Step-ноды, уже сконвертированные конвертером JSON → RenderNode. */
  steps?: StepNode<T>[];
  /** Инъектится render-behavior-ом через `patchProps` (JSON рантайм не выражает). */
  form?: FormProxy<T>;
  /** Инъектится вместе с формой; поддержана и «плоская» форма конфига. */
  config?: FormWizardConfig;
  validateStep?: FormWizardConfig['validateStep'];
  validateAll?: FormWizardConfig['validateAll'];
  onSubmit?: () => void | Promise<void>;
  className?: string;
  /**
   * Ref ноды схемы (`schema.node('wizard').getRef()`). Пробрасывается в
   * `FormWizard`, чтобы render-behavior мог вызвать `validateCurrentStep`
   * и `submit` (полная валидация живёт именно в `handle.submit`).
   */
  ref?: Ref<FormWizardHandle<T>>;
}

export function RendererFormWizard<T extends Record<string, unknown>>({
  steps = [],
  form,
  config,
  validateStep,
  validateAll,
  onSubmit,
  className,
  ref,
}: RendererFormWizardProps<T>): ReactNode {
  const wizardSteps = useMemo<FormWizardStep<T, RenderNode<T>>[]>(
    () =>
      steps.map((node, index) => ({
        number: index + 1,
        title: node.componentProps?.title ?? `Шаг ${index + 1}`,
        icon: node.componentProps?.icon,
        body: node as RenderNode<T>,
      })),
    [steps]
  );

  const wizardConfig = useMemo<FormWizardConfig>(
    () => config ?? { validateStep, validateAll },
    [config, validateStep, validateAll]
  );

  if (!form) return null;

  return (
    <FormWizard<T, RenderNode<T>>
      ref={ref}
      form={form}
      config={wizardConfig}
      steps={wizardSteps}
      onSubmit={onSubmit}
      className={className}
      renderStepBody={(body, wizardForm) => (
        <RenderNodeComponent<T> node={body} form={wizardForm} />
      )}
    />
  );
}

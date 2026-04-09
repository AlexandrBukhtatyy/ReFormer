/**
 * RendererFormWizard - пользовательский wizard-компонент для multi-step форм
 *
 * Использует headless-примитивы из @reformer/cdk и контекст рендеринга из @reformer/core.
 * Может использоваться в RenderSchema как обычный ContainerRenderNode.
 *
 * Компонент устанавливает __selfManagedChildren = true, чтобы RenderNodeComponent
 * передавал children как сырые RenderNode[], а не рендерил их самостоятельно.
 * Дочерние узлы идентифицируются по полю selector на уровне ContainerRenderNode.
 */

import { type ReactNode, type Ref } from 'react';
import { type FormProxy, type FieldPath } from '@reformer/core';
import { useRenderContext, RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { CreditApplicationForm } from '../../../types/credit-application';
import { FormWizard } from './FormWizard';
import type {
  FormWizardConfig,
  FormWizardActionsProps,
  FormWizardIndicatorStep,
  FormWizardHandle,
} from '@reformer/cdk/form-wizard';

type RendererStep = FormWizardIndicatorStep & {
  componentProps?: Record<string, unknown>;
};

interface RendererFormWizardProps<T extends Record<string, unknown>> {
  // React 19: ref как обычный prop
  ref?: Ref<FormWizardHandle<T>>;
  steps?: RendererStep[];
  stepValidations?: FormWizardConfig<T>['stepValidations'];
  fullValidation?: FormWizardConfig<T>['fullValidation'];
  onSubmit?: FormWizardActionsProps['onSubmit'];
  onStepChange?: (step: number) => void;
  scrollToTop?: boolean;
  className?: string;
}

export function RendererFormWizard<T extends Record<string, unknown>>({
  ref,
  steps = [],
  stepValidations,
  fullValidation,
  onSubmit,
  onStepChange,
  scrollToTop = true,
  className,
}: RendererFormWizardProps<T>): ReactNode {
  const { form, path, settings } = useRenderContext<T>();
  const fieldWrapper = settings?.fieldWrapper;

  const config: FormWizardConfig<T> = {
    stepValidations: stepValidations || {},
    fullValidation: fullValidation || (() => ({})),
  };

  return (
    <FormWizard
      ref={ref}
      className={className}
      form={form}
      config={config}
      onStepChange={onStepChange}
      scrollToTop={scrollToTop}
      steps={steps.map((step, index) => ({
        ...step,
        ...(step.componentProps ?? {}),
        number: index + 1,
        component: (
          <RenderNodeComponent
            node={step as RenderNode<CreditApplicationForm>}
            form={form as FormProxy<CreditApplicationForm>}
            path={path as FieldPath<CreditApplicationForm>}
            fieldWrapper={fieldWrapper}
          />
        ),
      }))}
      onSubmit={onSubmit ? () => form.submit(onSubmit) : undefined}
    />
  );
}

RendererFormWizard.displayName = 'RendererFormWizard';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RendererFormWizard as any).__selfManagedChildren = true;

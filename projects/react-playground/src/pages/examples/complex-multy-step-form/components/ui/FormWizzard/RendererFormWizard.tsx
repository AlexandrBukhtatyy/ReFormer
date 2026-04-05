/**
 * RendererFormWizard - пользовательский wizard-компонент для multi-step форм
 *
 * Использует headless-примитивы из @reformer/ui и контекст рендеринга из @reformer/core.
 * Может использоваться в RenderSchema как обычный ContainerRenderNode.
 *
 * Компонент устанавливает __selfManagedChildren = true, чтобы RenderNodeComponent
 * передавал children как сырые RenderNode[], а не рендерил их самостоятельно.
 * Дочерние узлы идентифицируются по полю selector на уровне ContainerRenderNode.
 */

import { type ReactNode } from 'react';
import { type FormProxy, type FieldPath } from '@reformer/core';
import { useRenderContext, RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import {
  FormWizard,
  type FormWizardProps,
} from '../complex-multy-step-form/components/ui/FormWizzard/FormWizard';
import type { FormWizardConfig } from '@reformer/ui/form-wizard';

export function RendererFormWizard({
  steps = [],
  stepValidations,
  fullValidation,
  onSubmit,
  onStepChange,
  scrollToTop = true,
  className,
}: FormWizardProps<CreditApplicationForm>): ReactNode {
  const { form, path, fieldWrapper } = useRenderContext<CreditApplicationForm>();

  const config: FormWizardConfig<CreditApplicationForm> = {
    stepValidations: stepValidations || {},
    fullValidation: fullValidation || (() => ({})),
  };

  return (
    <FormWizard
      // ref={navRef}
      className={className}
      form={form}
      config={config}
      onStepChange={onStepChange}
      scrollToTop={scrollToTop}
      steps={steps.map((step) => ({
        ...step.componentProps,
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

/**
 * RendererFormWizard - пользовательский wizard-компонент для multi-step форм
 *
 * Использует headless-примитивы из @reformer/cdk и контекст рендеринга из @reformer/core.
 * Может использоваться в RenderSchema как обычный ContainerRenderNode.
 *
 * Форма передаётся через componentProps (не через useRenderContext):
 * ```typescript
 * componentProps: { form, steps: [...] }
 * ```
 * Компонент предоставляет RenderContextProvider для дочерних нод.
 *
 * Компонент устанавливает __selfManagedChildren = true, чтобы RenderNodeComponent
 * передавал children как сырые RenderNode[], а не рендерил их самостоятельно.
 */

import { type ReactNode, type Ref, useRef } from 'react';
import { createFieldPath, type FormProxy, type FieldPath } from '@reformer/core';
import {
  useRenderContext,
  RenderContextProvider,
  RenderNodeComponent,
  type RenderNode,
} from '@reformer/renderer-react';
import type { CreditApplicationForm } from '../../../types/credit-application';
import { FormWizard } from './FormWizard';
import type {
  FormWizardConfig,
  FormWizardIndicatorStep,
  FormWizardHandle,
} from '@reformer/cdk/form-wizard';

type RendererStep = FormWizardIndicatorStep & {
  componentProps?: Record<string, unknown>;
};

interface RendererFormWizardProps<T extends Record<string, unknown>> {
  // React 19: ref как обычный prop
  ref?: Ref<FormWizardHandle<T>>;
  /** Форма — передаётся через componentProps в render-schema */
  form: FormProxy<T>;
  steps?: RendererStep[];
  stepValidations?: FormWizardConfig<T>['stepValidations'];
  fullValidation?: FormWizardConfig<T>['fullValidation'];
  /** Вызывается после успешной валидации всей формы, получает значения формы */
  onSubmit?: (values: T) => void | Promise<void>;
  onStepChange?: (step: number) => void;
  scrollToTop?: boolean;
  className?: string;
}

export function RendererFormWizard<T extends Record<string, unknown>>({
  ref: externalRef,
  form,
  steps = [],
  stepValidations,
  fullValidation,
  onSubmit,
  onStepChange,
  scrollToTop = true,
  className,
}: RendererFormWizardProps<T>): ReactNode {
  const { settings } = useRenderContext();
  const path = createFieldPath<T>();
  const fieldWrapper = settings?.fieldWrapper;
  // Внутренний ref для доступа к CDK FormWizard handle (валидация + submit)
  const wizardHandleRef = useRef<FormWizardHandle<T>>(null);

  const config: FormWizardConfig<T> = {
    stepValidations: stepValidations || {},
    fullValidation: fullValidation || (() => ({})),
  };

  return (
    <RenderContextProvider value={{ form, path, settings }}>
      <FormWizard
        ref={(node) => {
          (wizardHandleRef as React.RefObject<FormWizardHandle<T> | null>).current = node;
          if (externalRef) {
            if (typeof externalRef === 'function') {
              externalRef(node);
            } else {
              (externalRef as React.RefObject<FormWizardHandle<T> | null>).current = node;
            }
          }
        }}
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
        onSubmit={
          onSubmit
            ? () => {
                void wizardHandleRef.current?.submit(onSubmit);
              }
            : undefined
        }
      />
    </RenderContextProvider>
  );
}

RendererFormWizard.displayName = 'RendererFormWizard';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RendererFormWizard as any).__selfManagedChildren = true;

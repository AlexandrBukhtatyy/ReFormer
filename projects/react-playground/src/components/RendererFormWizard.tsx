/**
 * Compatibility shim for complex-multy-step-form-renderer pages.
 *
 * Real implementation lives in `@reformer/ui-kit/form-wizard` as `FormWizard`
 * (Path C unified API — `step.body: FC | ReactNode | RenderNode<T>`).
 *
 * Old consumers pass `steps[]` as RenderNode-shaped entries:
 *   `{ component: Step, componentProps: { title, icon }, children: [...] }`
 *
 * This shim extracts `title` / `icon` from `componentProps` (lifting them to the
 * step root expected by the new API) and passes the whole old node as `body`.
 * `renderStepBody` in ui-kit FormWizard sees a plain object with `.component`
 * and renders via `RenderNodeComponent`, preserving the original visual tree.
 *
 * After complex-form pages are rewritten to the new step shape, this shim can
 * be deleted.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ReactNode } from 'react';
import {
  FormWizard,
  type FormWizardProps as UiKitFormWizardProps,
  type FormWizardStep,
} from '@reformer/ui-kit/form-wizard';
import type { FormWizardConfig, FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { FormProxy } from '@reformer/core';

export interface LegacyRendererStep {
  /** Wrapper component (typically `Step` from CDK). */
  component?: unknown;
  componentProps?: {
    title?: string;
    icon?: string;
    [key: string]: unknown;
  };
  children?: unknown[];
  selector?: string;
  [key: string]: unknown;
}

export interface RendererFormWizardProps<T extends Record<string, unknown>> {
  ref?: React.Ref<FormWizardHandle<T>>;
  form: FormProxy<T>;
  steps: LegacyRendererStep[];
  stepValidations?: FormWizardConfig<T>['stepValidations'];
  fullValidation?: FormWizardConfig<T>['fullValidation'];
  onSubmit?: (values: T) => void | Promise<void>;
  onStepChange?: (step: number) => void;
  scrollToTop?: boolean;
  className?: string;
}

export function RendererFormWizard<T extends Record<string, unknown>>(
  props: RendererFormWizardProps<T>
): ReactNode {
  const {
    ref,
    form,
    steps: legacySteps,
    stepValidations,
    fullValidation,
    onSubmit,
    onStepChange,
    scrollToTop,
    className,
  } = props;

  const newSteps: FormWizardStep<T>[] = legacySteps.map((step, idx) => ({
    number: idx + 1,
    title: (step.componentProps?.title as string) ?? `Шаг ${idx + 1}`,
    icon: step.componentProps?.icon as string | undefined,
    // Pass the legacy RenderNode subtree as `body` — ui-kit FormWizard's
    // `renderStepBody` detects the RenderNode shape (object with `.component`)
    // and renders via RenderNodeComponent, preserving the wrapper hierarchy.
    body: step as any,
  }));

  const config: FormWizardConfig<T> = {
    stepValidations: stepValidations ?? {},
    fullValidation: fullValidation ?? (() => ({})),
  };

  const handleSubmit = onSubmit
    ? async () => {
        // Invoked via FormWizard.Actions render-prop — ui-kit FormWizard
        // already validates and calls submit; pass values through.
        // The headless FormWizard.submit is invoked elsewhere; here we just
        // expose the user-supplied onSubmit.
        await onSubmit(form.getValue() as T);
      }
    : undefined;

  return (
    <FormWizard<T>
      ref={ref}
      form={form}
      config={config}
      steps={newSteps}
      onSubmit={handleSubmit}
      onStepChange={onStepChange}
      scrollToTop={scrollToTop}
      className={className}
    />
  );
}

RendererFormWizard.displayName = 'RendererFormWizard';
(RendererFormWizard as any).__selfManagedChildren = true;

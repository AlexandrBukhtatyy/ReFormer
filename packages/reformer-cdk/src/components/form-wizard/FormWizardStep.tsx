import type { ComponentType, ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';
import { useFormWizard } from './FormWizardContext';

/**
 * Props for FormWizard.Step component
 *
 * Supports two usage patterns:
 * 1. Component-based: `<FormWizard.Step component={Step1} control={form} />`
 * 2. Children-based: `<FormWizard.Step>{children}</FormWizard.Step>`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormWizardStepProps<T extends Record<string, any>> {
  /** Component to render for this step (legacy API) */
  component?: ComponentType<{ control: FormProxy<T> } & Record<string, unknown>>;

  /** Form control to pass to the component (legacy API) */
  control?: FormProxy<T>;

  /** Children to render (new API - for use with selector-based wizard) */
  children?: ReactNode;

  /** Any additional props to pass to the component */
  [key: string]: unknown;
}

/**
 * Internal props that include the step index (set by parent FormWizard)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FormWizardStepInternalProps<
  T extends Record<string, any>,
> extends FormWizardStepProps<T> {
  /** Step index (1-based), set internally by FormWizard */
  _stepIndex?: number;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * FormWizard.Step - renders a step component when it's the current step
 *
 * @example Component-based (legacy)
 * ```tsx
 * <FormWizard ref={navRef} form={form} config={config}>
 *   <FormWizard.Step component={Step1} control={form} />
 *   <FormWizard.Step component={Step2} control={form} extraProp="value" />
 * </FormWizard>
 * ```
 *
 * @example Children-based (new)
 * ```tsx
 * <FormWizard form={form} config={config}>
 *   <FormWizard.Step>
 *     <RenderNodeComponent node={step1Content} ... />
 *   </FormWizard.Step>
 *   <FormWizard.Step>
 *     <RenderNodeComponent node={step2Content} ... />
 *   </FormWizard.Step>
 * </FormWizard>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FormWizardStep<T extends Record<string, any>>({
  component: Component,
  control,
  children,
  _stepIndex,
  ...restProps
}: FormWizardStepInternalProps<T>) {
  const { currentStep } = useFormWizard<T>();

  // Only render if this is the current step
  if (_stepIndex === undefined || currentStep !== _stepIndex) {
    return null;
  }

  // New API: render children directly
  if (children !== undefined) {
    return <>{children}</>;
  }

  // Legacy API: render component with control prop
  if (Component && control) {
    return <Component control={control} {...restProps} />;
  }

  // Neither children nor component provided
  return null;
}

// Display name for debugging
FormWizardStep.displayName = 'FormWizard.Step';

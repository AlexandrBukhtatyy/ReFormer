import type { ComponentType, ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';
import { useFormNavigation } from './FormNavigationContext';

/**
 * Props for FormNavigation.Step component
 *
 * Supports two usage patterns:
 * 1. Component-based: `<FormNavigation.Step component={Step1} control={form} />`
 * 2. Children-based: `<FormNavigation.Step>{children}</FormNavigation.Step>`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormNavigationStepProps<T extends Record<string, any>> {
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
 * Internal props that include the step index (set by parent FormNavigation)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FormNavigationStepInternalProps<
  T extends Record<string, any>,
> extends FormNavigationStepProps<T> {
  /** Step index (1-based), set internally by FormNavigation */
  _stepIndex?: number;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * FormNavigation.Step - renders a step component when it's the current step
 *
 * @example Component-based (legacy)
 * ```tsx
 * <FormNavigation ref={navRef} form={form} config={config}>
 *   <FormNavigation.Step component={Step1} control={form} />
 *   <FormNavigation.Step component={Step2} control={form} extraProp="value" />
 * </FormNavigation>
 * ```
 *
 * @example Children-based (new)
 * ```tsx
 * <FormNavigation form={form} config={config}>
 *   <FormNavigation.Step>
 *     <RenderNodeComponent node={step1Content} ... />
 *   </FormNavigation.Step>
 *   <FormNavigation.Step>
 *     <RenderNodeComponent node={step2Content} ... />
 *   </FormNavigation.Step>
 * </FormNavigation>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FormNavigationStep<T extends Record<string, any>>({
  component: Component,
  control,
  children,
  _stepIndex,
  ...restProps
}: FormNavigationStepInternalProps<T>) {
  const { currentStep } = useFormNavigation<T>();

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
FormNavigationStep.displayName = 'FormNavigation.Step';

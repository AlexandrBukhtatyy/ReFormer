import type { ComponentType } from 'react';
import type { FormProxy } from '@reformer/core';
import { useFormNavigation } from './FormNavigationContext';

/**
 * Props for FormNavigation.Step component
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormNavigationStepProps<T extends Record<string, any>> {
  /** Component to render for this step */
  component: ComponentType<{ control: FormProxy<T> } & Record<string, unknown>>;

  /** Form control to pass to the component */
  control: FormProxy<T>;

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
 * @example
 * ```tsx
 * <FormNavigation ref={navRef} form={form} config={config}>
 *   <FormNavigation.Step component={Step1} control={form} />
 *   <FormNavigation.Step component={Step2} control={form} extraProp="value" />
 * </FormNavigation>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FormNavigationStep<T extends Record<string, any>>({
  component: Component,
  control,
  _stepIndex,
  ...restProps
}: FormNavigationStepInternalProps<T>) {
  const { currentStep } = useFormNavigation<T>();

  // Only render if this is the current step
  if (_stepIndex === undefined || currentStep !== _stepIndex) {
    return null;
  }

  return <Component control={control} {...restProps} />;
}

// Display name for debugging
FormNavigationStep.displayName = 'FormNavigation.Step';

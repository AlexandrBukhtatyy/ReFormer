import { FormFieldRoot } from './FormFieldRoot';
import { FormFieldLabel } from './FormFieldLabel';
import { FormFieldControl } from './FormFieldControl';
import { FormFieldError } from './FormFieldError';
import { FormFieldDescription } from './FormFieldDescription';

/**
 * Compound component type with all sub-components attached
 */
type FormFieldComponent = typeof FormFieldRoot & {
  Root: typeof FormFieldRoot;
  Label: typeof FormFieldLabel;
  Control: typeof FormFieldControl;
  Error: typeof FormFieldError;
  Description: typeof FormFieldDescription;
};

/**
 * FormField - Headless compound component for accessible form field anatomy.
 *
 * Provides complete freedom in building field UI while handling all accessible
 * ID wiring (htmlFor, aria-labelledby, aria-describedby, aria-errormessage)
 * and field state management internally.
 *
 * ## Features
 * - **Headless** — complete freedom in building UI, no styles imposed
 * - **Compound Components** — declarative API via nested components
 * - **Accessible by default** — all ARIA relationships wired automatically
 * - **Type Safe** — full TypeScript support with generics
 *
 * ## Sub-components
 * - `FormField.Root` — context provider, accepts `control` and optional `id`
 * - `FormField.Label` — `<label>` with automatic `htmlFor` and required indicator
 * - `FormField.Control` — auto-renders `control.component` or wraps custom children
 * - `FormField.Error` — error message with `role="alert"`, supports multi-error
 * - `FormField.Description` — helper text with stable `id` for `aria-describedby`
 *
 * @example Minimal (auto-renders everything from field config)
 * ```tsx
 * <FormField.Root control={control.email}>
 *   <FormField.Label />
 *   <FormField.Control />
 *   <FormField.Error />
 * </FormField.Root>
 * ```
 *
 * @example Full control with custom styling
 * ```tsx
 * <FormField.Root control={control.email} hasDescription>
 *   <div className="space-y-1">
 *     <FormField.Label className="text-sm font-medium text-gray-700" />
 *
 *     <FormField.Control asChild>
 *       <Input type="email" className="border rounded-md px-3 py-2 w-full" />
 *     </FormField.Control>
 *
 *     <FormField.Description className="text-xs text-gray-500">
 *       We'll never share your email.
 *     </FormField.Description>
 *
 *     <FormField.Error className="text-xs text-red-600" />
 *   </div>
 * </FormField.Root>
 * ```
 *
 * @example Multiple errors with custom rendering
 * ```tsx
 * <FormField.Root control={control.password}>
 *   <FormField.Label />
 *   <FormField.Control />
 *   <FormField.Error
 *     multi
 *     render={(err) => (
 *       <span className={err.severity === 'warning' ? 'text-yellow-600' : 'text-red-600'}>
 *         {err.message}
 *       </span>
 *     )}
 *   />
 * </FormField.Root>
 * ```
 *
 * @example Using useFormField hook for full customization
 * ```tsx
 * import { useFormField } from '@reformer/cdk/form-field';
 *
 * function EmailField({ control }: { control: FieldNode<string> }) {
 *   const { labelProps, controlProps, errorProps, state, ids } = useFormField(control);
 *
 *   return (
 *     <div>
 *       <label {...labelProps}>{state.label}</label>
 *       <Input
 *         {...controlProps}
 *         aria-describedby={ids.descriptionId}
 *         type="email"
 *       />
 *       <p id={ids.descriptionId} className="text-xs text-gray-500">
 *         Helper text
 *       </p>
 *       {state.shouldShowError && (
 *         <p {...errorProps} className="text-xs text-red-600">{state.error}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const FormField = FormFieldRoot as FormFieldComponent;

FormField.Root = FormFieldRoot;
FormField.Label = FormFieldLabel;
FormField.Control = FormFieldControl;
FormField.Error = FormFieldError;
FormField.Description = FormFieldDescription;

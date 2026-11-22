import { useId, useMemo } from 'react';
import { useFormControl, watchValueOf } from '@reformer/core/react';
import { FormFieldContext } from './FormFieldContext';
import { useIssueMessageResolver } from '../../validation/error-resolver';
import { primaryIssueIndex } from '../../validation/primary-issue';
import type { FormFieldContextValue, FormFieldIds, FormFieldRootProps } from './types';

/** Ключи контекста, которые читаются из снимка поля при обращении. */
const STATE_KEYS: ReadonlySet<string | symbol> = new Set([
  'value',
  'issues',
  'pending',
  'disabled',
  'valid',
  'invalid',
  'touched',
  'shouldShowError',
  'shouldShowIssues',
  'error',
  'label',
  'required',
  'componentProps',
]);

/**
 * FormField.Root - Context provider for form field compound component.
 *
 * Computes stable accessible IDs (controlId, labelId, descriptionId, errorId, hintId)
 * and provides all field state to child FormField.* components.
 *
 * @example Minimal usage
 * ```tsx
 * <FormField.Root control={control.email}>
 *   <FormField.Label />
 *   <FormField.Control />
 *   <FormField.Error />
 * </FormField.Root>
 * ```
 *
 * @example With description (pass hasDescription to auto-wire aria-describedby)
 * ```tsx
 * <FormField.Root control={control.email} hasDescription>
 *   <FormField.Label />
 *   <FormField.Control />
 *   <FormField.Description>Helper text</FormField.Description>
 *   <FormField.Error />
 * </FormField.Root>
 * ```
 *
 * @example With hint (e.g. info-tooltip text; pass hasHint to auto-wire aria-describedby)
 * ```tsx
 * <FormField.Root control={control.email} hasHint>
 *   <FormField.Label />
 *   <FormField.Hint hidden>Shown in a tooltip next to the label</FormField.Hint>
 *   <FormField.Control />
 * </FormField.Root>
 * ```
 */
function FormFieldRoot<T>({
  control,
  children,
  id,
  hasDescription = false,
  hasHint = false,
}: FormFieldRootProps<T>) {
  const reactId = useId();
  const baseId = id ?? reactId;

  const ids = useMemo<FormFieldIds>(
    () => ({
      controlId: `control-${baseId}`,
      labelId: `label-${baseId}`,
      descriptionId: `desc-${baseId}`,
      errorId: `error-${baseId}`,
      hintId: `hint-${baseId}`,
    }),
    [baseId]
  );

  const raw = useFormControl(control);
  // i18n: контекстный `error` резолвим (ValidationMessagesProvider), а не сырой message —
  // иначе useFormFieldContext().error расходится с useFormField().state.error.
  const resolve = useIssueMessageResolver();

  // Состояние поля читается из снимка при обращении, как в `useFormField`: снимок `useFormControl`
  // подписывает корень на то, что прочитали он и его части (`Label`, `Control`, `Error`). Поле,
  // которое не показывает `pending` или `valid`, не перерисовывается на их смену, а контрол с
  // неуправляемым адаптером (`FieldAdapter.uncontrolled`) — на ввод. Копия контекста
  // (`{ ...ctx }`) и перечисление видят обычные поля.
  const contextValue = useMemo<FormFieldContextValue<T>>(() => {
    const read = (key: string | symbol): unknown => {
      switch (key) {
        case 'value':
          return raw.value;
        case 'issues':
          return raw.issues;
        case 'pending':
          return raw.pending;
        case 'disabled':
          return raw.disabled;
        case 'valid':
          return raw.valid;
        case 'invalid':
          return raw.invalid;
        case 'touched':
          return raw.touched;
        case 'shouldShowError':
          return raw.shouldShowError;
        case 'shouldShowIssues':
          return raw.shouldShowIssues;
        case 'error': {
          const primary = raw.issues[primaryIssueIndex(raw.issues)];
          return raw.shouldShowIssues && primary ? resolve(primary) : undefined;
        }
        case 'label':
          return raw.componentProps.label;
        case 'required':
          return Boolean(raw.componentProps.required);
        case 'componentProps':
          return raw.componentProps;
        default:
          return undefined;
      }
    };
    return new Proxy(
      {
        value: undefined,
        issues: undefined,
        pending: undefined,
        disabled: undefined,
        valid: undefined,
        invalid: undefined,
        touched: undefined,
        shouldShowError: undefined,
        shouldShowIssues: undefined,
        error: undefined,
        label: undefined,
        required: undefined,
        componentProps: undefined,
        control,
        ids,
        hasDescription,
        hasHint,
        seam: {
          control,
          get value() {
            return raw.value;
          },
          onChange: (v: unknown) => control.setValue(v as T),
          onBlur: () => control.markAsTouched(),
          watch: watchValueOf(raw),
        },
      },
      { get: (target, key) => (STATE_KEYS.has(key) ? read(key) : Reflect.get(target, key)) }
    ) as unknown as FormFieldContextValue<T>;
  }, [raw, control, ids, hasDescription, hasHint, resolve]);

  return <FormFieldContext.Provider value={contextValue}>{children}</FormFieldContext.Provider>;
}

FormFieldRoot.displayName = 'FormField.Root';

export { FormFieldRoot };

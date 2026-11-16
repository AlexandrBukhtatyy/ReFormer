import { useId, useMemo } from 'react';
import { type FormControl, type ValidationIssue } from '@reformer/core';
import { useFormControl, watchValueOf, type FieldSeam } from '@reformer/core/react';
import type { FormFieldIds } from './types';
import { useIssueMessageResolver } from '../../validation/error-resolver';
import { primaryIssueIndex } from '../../validation/primary-issue';

/**
 * Field state returned by useFormField
 */
export interface UseFormFieldState<T = unknown> {
  value: T;
  issues: ValidationIssue[];
  /**
   * Message of the primary issue — the first error, or the first warning when there are no
   * errors; only set when shouldShowIssues is true
   */
  error: string | undefined;
  isPending: boolean;
  isDisabled: boolean;
  isValid: boolean;
  isInvalid: boolean;
  isTouched: boolean;
  /** Error state (drives aria-invalid): the field is invalid and was touched or changed */
  shouldShowError: boolean;
  /** Whether issue messages are shown: errors or warnings on a touched or changed field */
  shouldShowIssues: boolean;
  label: string | undefined;
  required: boolean;
  /** Full componentProps bag from FormControl config */
  componentProps: Record<string, unknown>;
  /**
   * Field path in the model (`items.0.name`). For a field of an array row it follows the row
   * index, so `data-testid` / `name` derived from it stay correct after a neighbour row is
   * removed. Empty for a field that is not bound to a model.
   */
  path: string;
}

/** Props to spread onto a <label> element */
export interface UseFormFieldLabelProps {
  id: string;
  htmlFor: string;
}

/** Props to spread onto the interactive control element */
export interface UseFormFieldControlProps {
  id: string;
  disabled: boolean;
  'aria-labelledby': string;
  'aria-invalid': true | undefined;
  'aria-errormessage': string | undefined;
  'aria-required': true | undefined;
  /** Direct-value onChange compatible with ReFormer field components */
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

/** Props to spread onto an error paragraph */
export interface UseFormFieldErrorProps {
  id: string;
  role: 'alert';
}

/** Props to spread onto a description paragraph */
export interface UseFormFieldDescriptionProps {
  id: string;
}

/** Props to spread onto a hint element (e.g. hidden text of an info tooltip) */
export interface UseFormFieldHintProps {
  id: string;
}

/**
 * Return type of useFormField hook
 */
export interface UseFormFieldReturn<T = unknown> {
  /** Spread onto <label> */
  labelProps: UseFormFieldLabelProps;
  /** Spread onto the interactive control; includes value */
  controlProps: UseFormFieldControlProps & { value: T };
  /** Spread onto the first error paragraph */
  errorProps: UseFormFieldErrorProps;
  /** Spread onto the description paragraph */
  descriptionProps: UseFormFieldDescriptionProps;
  /** Spread onto the hint element; add `ids.hintId` to aria-describedby manually */
  hintProps: UseFormFieldHintProps;
  /** Structured field state */
  state: UseFormFieldState<T>;
  /**
   * Seam for `bindFieldProps` from `@reformer/core/react`: the field node, the value (read on
   * access) and value-based callbacks. With an `uncontrolled` adapter the value goes straight to
   * the DOM element and typing does not re-render the component — as long as the render does not
   * read `state.value` itself.
   *
   * @example
   * ```tsx
   * const { seam, state } = useFormField(control);
   * const Component = control.component;
   * return <Component {...bindFieldProps(getFieldAdapter(Component), seam, {}, Component)} />;
   * ```
   */
  seam: FieldSeam;
  /** Field actions */
  actions: {
    setValue: (value: T) => void;
    markAsTouched: () => void;
    markAsUntouched: () => void;
    reset: (value?: T) => void;
  };
  /** Raw IDs for manual wiring (e.g. aria-describedby) */
  ids: FormFieldIds;
}

/**
 * Primary hook for building accessible form fields.
 *
 * Returns partitioned prop collections and structured state that you can spread
 * directly onto your own elements. No prescribed DOM structure.
 *
 * @example Basic usage
 * ```tsx
 * function EmailField({ control }: { control: FormControl<string> }) {
 *   const { labelProps, controlProps, errorProps, state } = useFormField(control);
 *
 *   return (
 *     <div>
 *       <label {...labelProps}>{state.label}</label>
 *       <input {...controlProps} type="email" />
 *       {state.shouldShowIssues && (
 *         <p {...errorProps}>{state.error}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With description (manual aria-describedby wiring)
 * ```tsx
 * const { labelProps, controlProps, errorProps, descriptionProps, state, ids } =
 *   useFormField(control);
 *
 * const enrichedControlProps = {
 *   ...controlProps,
 *   'aria-describedby': [
 *     ids.descriptionId,
 *     state.shouldShowIssues ? ids.errorId : null,
 *   ].filter(Boolean).join(' ') || undefined,
 * };
 * ```
 */
/** Ключи `state` и `controlProps`, которые читаются из снимка поля при обращении. */
const LAZY_KEYS: ReadonlySet<string | symbol> = new Set([
  'value',
  'issues',
  'error',
  'isPending',
  'isDisabled',
  'isValid',
  'isInvalid',
  'isTouched',
  'shouldShowError',
  'shouldShowIssues',
  'label',
  'required',
  'componentProps',
  'path',
  'disabled',
  'aria-invalid',
  'aria-errormessage',
  'aria-required',
]);

export function useFormField<T>(control: FormControl<T>, id?: string): UseFormFieldReturn<T> {
  const reactId = useId();
  const baseId = id ?? reactId;
  const resolveError = useIssueMessageResolver();

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

  // Состояние читается из снимка при обращении, а не раскладывается целиком: снимок
  // `useFormControl` подписывает компонент только на прочитанное, и поле, которое не показывает
  // `isPending` или `isValid`, не перерисовывается на их смену (серверная проверка, живая
  // проверка на каждую клавишу). `state` и `controlProps` — `Proxy` над объектами с теми же
  // ключами: копия (`{ ...controlProps }`) и перечисление видят обычные поля.
  return useMemo<UseFormFieldReturn<T>>(() => {
    const read = (key: string | symbol): unknown => {
      switch (key) {
        case 'value':
          return raw.value;
        case 'issues':
          return raw.issues;
        case 'error': {
          const primary = raw.issues[primaryIssueIndex(raw.issues)];
          return raw.shouldShowIssues && primary ? resolveError(primary) : undefined;
        }
        case 'isPending':
          return raw.pending;
        case 'isDisabled':
        case 'disabled':
          return raw.disabled;
        case 'isValid':
          return raw.valid;
        case 'isInvalid':
          return raw.invalid;
        case 'isTouched':
          return raw.touched;
        case 'shouldShowError':
          return raw.shouldShowError;
        case 'shouldShowIssues':
          return raw.shouldShowIssues;
        case 'label':
          return raw.componentProps.label;
        case 'required':
          return Boolean(raw.componentProps.required);
        case 'componentProps':
          return raw.componentProps;
        case 'path':
          return raw.path;
        case 'aria-invalid':
          return raw.shouldShowError ? true : undefined;
        case 'aria-errormessage':
          return raw.shouldShowError && raw.issues.length > 0 ? ids.errorId : undefined;
        case 'aria-required':
          return raw.componentProps.required ? true : undefined;
        default:
          return undefined;
      }
    };
    const lazy: ProxyHandler<Record<string, unknown>> = {
      get: (target, key) => (LAZY_KEYS.has(key) ? read(key) : Reflect.get(target, key)),
    };
    const onChange = (v: unknown): void => control.setValue(v as T);
    const onBlur = (): void => control.markAsTouched();

    return {
      seam: {
        control,
        get value() {
          return raw.value;
        },
        onChange,
        onBlur,
        watch: watchValueOf(raw),
      },
      ids,
      labelProps: {
        id: ids.labelId,
        htmlFor: ids.controlId,
      },
      controlProps: new Proxy(
        {
          id: ids.controlId,
          value: undefined,
          disabled: undefined,
          'aria-labelledby': ids.labelId,
          'aria-invalid': undefined,
          'aria-errormessage': undefined,
          'aria-required': undefined,
          onChange,
          onBlur,
        },
        lazy
      ) as unknown as UseFormFieldReturn<T>['controlProps'],
      errorProps: {
        id: ids.errorId,
        role: 'alert' as const,
      },
      descriptionProps: {
        id: ids.descriptionId,
      },
      hintProps: {
        id: ids.hintId,
      },
      state: new Proxy(
        {
          value: undefined,
          issues: undefined,
          error: undefined,
          isPending: undefined,
          isDisabled: undefined,
          isValid: undefined,
          isInvalid: undefined,
          isTouched: undefined,
          shouldShowError: undefined,
          shouldShowIssues: undefined,
          label: undefined,
          required: undefined,
          componentProps: undefined,
          path: undefined,
        },
        lazy
      ) as unknown as UseFormFieldState<T>,
      actions: {
        setValue: (v: T) => control.setValue(v),
        markAsTouched: () => control.markAsTouched(),
        markAsUntouched: () => control.markAsUntouched(),
        reset: (v?: T) => control.reset(v),
      },
    };
  }, [raw, control, ids, resolveError]);
}

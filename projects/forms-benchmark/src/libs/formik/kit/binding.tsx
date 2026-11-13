/**
 * Formik field → props for the shared controls, plus the contract's reveal rule.
 *
 * Two binders give the same `Bound` object:
 * - `useBenchField` — `useField`: the component re-renders on every Formik update (fields whose
 *   rendering reads other state: options, copies; all fields of the small registration form);
 * - `FastBenchField` — `<FastField>`: re-renders only when its own slice of Formik state changes
 *   (values/errors/touched of its name, `isSubmitting`), for independent fields of a large form.
 */
import { createContext, useContext, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  FastField,
  useField,
  useFormikContext,
  type FieldHookConfig,
  type FieldInputProps,
  type FieldMetaProps,
  type FieldProps,
  type FormikHelpers,
} from 'formik';

/** Formik path → DOM-contract path: `personalData.lastName` → `personalData-lastName`, `items[2].x` → `items-2-x`. */
export const fieldPath = (name: string): string =>
  name
    .split(/[.[\]]+/)
    .filter(Boolean)
    .join('-');

/**
 * Submit attempts that reveal errors. A wizard provides the count for the current step; without a
 * provider `useBenchField` falls back to Formik's `submitCount`. `<FastField>` does not re-render
 * on `submitCount` changes (see its docs), so `FastBenchField` takes the count only from here: a
 * context update reaches the consumer whatever FastField's `shouldComponentUpdate` decides.
 */
export const SubmitAttempts = createContext<number | undefined>(undefined);

/** A change that replaces Formik's default setter (e.g. it also resets dependent fields). */
export type ValueChange<V, Values> = (value: V, form: FormikHelpers<Values>) => void;

export interface Bound<V> {
  /** Formik's `FieldInputProps`: name, value, onChange, onBlur (and `checked` for a checkbox). */
  field: FieldInputProps<V>;
  /** Value-based setter for controls whose value is not the event's (number, captcha). */
  setValue: (value: V) => void;
  setTouched: (touched: boolean) => void;
  /** DOM-contract path. */
  path: string;
  /** The error to show: `undefined` while the reveal rule hides it. */
  error: string | undefined;
}

const eventValue = (e: ChangeEvent<HTMLInputElement>): unknown =>
  e.target.type === 'checkbox' ? e.target.checked : e.target.value;

/**
 * Reveal rule (BENCH-CONTRACT §3, §8): errors stay hidden until a submit attempt made while the
 * field is on screen. A field that appears after a failed attempt (its section was switched on in
 * the live phase) stays quiet until the user changes it or submits again. This is local UI state,
 * like the `didFocus` flag in Formik's "instant feedback" example.
 */
function useBound<V, Values>(
  field: FieldInputProps<V>,
  meta: FieldMetaProps<V>,
  form: FormikHelpers<Values>,
  attempts: number,
  onValueChange: ValueChange<V, Values> | undefined
): Bound<V> {
  const [shownAt] = useState(attempts);
  const [edited, setEdited] = useState(false);
  const late = shownAt > 0;
  const revealed = attempts > shownAt || (late && edited);
  const markEdited = late && !edited ? () => setEdited(true) : undefined;

  const setValue = (value: V) => {
    markEdited?.();
    if (onValueChange) onValueChange(value, form);
    else void form.setFieldValue(field.name, value);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    markEdited?.();
    if (onValueChange) onValueChange(eventValue(e) as V, form);
    else field.onChange(e);
  };
  return {
    // Formik's own handler unless something has to happen around it.
    field: markEdited || onValueChange ? { ...field, onChange } : field,
    setValue,
    setTouched: (touched) => void form.setFieldTouched(field.name, touched),
    path: fieldPath(field.name),
    error: revealed ? meta.error : undefined,
  };
}

/** `useField` binder: the field re-renders on every Formik update. */
export function useBenchField<V, Values = unknown>(
  config: string | FieldHookConfig<V>,
  onValueChange?: ValueChange<V, Values>
): Bound<V> {
  const [field, meta] = useField<V>(config);
  const form = useFormikContext<Values>();
  const attempts = useContext(SubmitAttempts) ?? form.submitCount;
  return useBound(field, meta, form, attempts, onValueChange);
}

interface FastBenchFieldProps<V, Values> {
  name: string;
  /** `'checkbox'`: Formik gives `field.checked` and keeps a boolean value. */
  type?: 'checkbox';
  onValueChange?: ValueChange<V, Values>;
  children: (bound: Bound<V>) => ReactNode;
}

/**
 * `<FastField>` binder. `form` comes from FastField's own bag: its imperative methods
 * (`setFieldValue`, `setValues` with an updater) act on the current Formik state, so a custom
 * change may read other fields there even though this field does not re-render for them.
 */
export function FastBenchField<V, Values = unknown>({
  name,
  type,
  onValueChange,
  children,
}: FastBenchFieldProps<V, Values>) {
  return (
    <FastField name={name} type={type}>
      {({ field, meta, form }: FieldProps<V, Values>) => (
        <FastBound
          field={field}
          meta={meta}
          form={form}
          onValueChange={onValueChange}
          render={children}
        />
      )}
    </FastField>
  );
}

interface FastBoundProps<V, Values> {
  field: FieldInputProps<V>;
  meta: FieldMetaProps<V>;
  form: FormikHelpers<Values>;
  onValueChange: ValueChange<V, Values> | undefined;
  render: (bound: Bound<V>) => ReactNode;
}

/** Inner component of `FastBenchField`: hooks cannot live in FastField's render function itself. */
function FastBound<V, Values>({
  field,
  meta,
  form,
  onValueChange,
  render,
}: FastBoundProps<V, Values>) {
  const attempts = useContext(SubmitAttempts);
  const bound = useBound(field, meta, form, attempts ?? 0, onValueChange);
  if (attempts === undefined) throw new Error('FastBenchField needs a <SubmitAttempts.Provider>');
  return render(bound);
}

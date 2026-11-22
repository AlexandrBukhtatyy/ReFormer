/**
 * Programmatic updates of fields the user did not edit: dependent resets and copies.
 *
 * Such a field gets its new value with `setValue` (no validation — it is not the field the user
 * changed) and loses a stale error, so it behaves like a freshly shown field: quiet until it is
 * changed or the step is checked again.
 */
import { useEffect } from 'react';
import {
  get,
  useFormContext,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';

type DependentMethods<T extends FieldValues> = Pick<
  UseFormReturn<T>,
  'setValue' | 'getFieldState' | 'clearErrors'
>;

/** `setValue(name, value)` + `clearErrors(name)` when the field has an error. */
export function setDependent<T extends FieldValues>(
  { setValue, getFieldState, clearErrors }: DependentMethods<T>,
  name: FieldPath<T>,
  value: unknown
): void {
  setValue(name, value as never);
  if (getFieldState(name).invalid) clearErrors(name);
}

export interface CopyRule<T extends FieldValues> {
  /** Boolean field: while it is `true`, `target` equals `source`. */
  flag: FieldPath<T>;
  source: FieldPath<T>;
  target: FieldPath<T>;
  /** Value of `target` once `flag` is cleared. */
  cleared: () => unknown;
}

/**
 * Copy rules (pass a module-level constant): `source` is copied into `target` while `flag` is set;
 * clearing `flag` puts `cleared()` into `target`. Uses `subscribe` to the named fields' values (no
 * re-render): it fires for user edits and for `setValue` alike, so a reset source is copied too.
 */
export function useCopies<T extends FieldValues>(rules: readonly CopyRule<T>[]) {
  const { subscribe, setValue, getFieldState, clearErrors } = useFormContext<T>();
  useEffect(() => {
    const methods = { setValue, getFieldState, clearErrors };
    const offs = rules.map(({ flag, source, target, cleared }) =>
      subscribe({
        name: [flag, source],
        formState: { values: true },
        callback: ({ name, values }) => {
          if (name === flag) {
            setDependent(methods, target, get(values, flag) ? get(values, source) : cleared());
          } else if (
            (name === source || name?.startsWith(`${source}.`)) &&
            get(values, flag) === true
          ) {
            setDependent(methods, target, get(values, source));
          }
        },
      })
    );
    return () => offs.forEach((off) => off());
  }, [subscribe, setValue, getFieldState, clearErrors, rules]);
}

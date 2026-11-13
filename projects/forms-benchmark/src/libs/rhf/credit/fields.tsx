/**
 * Credit fields on the shared primitives. The control of a field comes from its metadata
 * (`CREDIT_FIELDS`), as on the baseline page; the binding is uncontrolled `register`, except Selects
 * whose options load after the field mounts (city, car model) — those are `useController`.
 *
 * Dependent behaviour from the shared tables is attached here, per field:
 * - `CREDIT_REVALIDATE` → `register(name, { deps })`;
 * - `CREDIT_RESETS` → `register(name, { onChange })` that resets the target (user edits only).
 */
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  useFormContext,
  useWatch,
  type FieldPath,
  type RegisterOptions,
  type UseFormRegisterReturn,
} from 'react-hook-form';
import {
  CREDIT_RESETS,
  CREDIT_REVALIDATE,
  fieldMeta,
  parseNumberInput,
  toFieldPattern,
  type CreditInput,
  type FieldMeta,
  type Option,
} from '../../../shared/domain/credit';
import {
  Checkbox,
  DateInput,
  MaskedInput,
  NumberInput,
  RadioGroup,
  Select,
  TextInput,
  Textarea,
} from '../../../shared/ui/controls';
import { ControllerField, Field, type ControlAttrs } from '../kit/Field';
import { setDependent } from '../kit/dependent';

export type CreditPath = FieldPath<CreditInput>;

/** The form of the nearest `FormProvider`, typed. */
export const useCreditForm = () => useFormContext<CreditInput>();

/** `CREDIT_REVALIDATE` targets of a field, row index carried over (`existingLoans.2.amount` → `…2.remainingAmount`). */
function revalidateTargets(name: string): CreditPath[] {
  const pattern = toFieldPattern(name);
  const row = /\.(\d+)\./.exec(name)?.[1];
  return CREDIT_REVALIDATE.filter((r) => r.source === pattern).map(
    (r) => (row === undefined ? r.target : r.target.replace('[]', `.${row}`)) as CreditPath
  );
}

const resetTargets = (name: string): CreditPath[] =>
  CREDIT_RESETS.filter((r) => r.source === name).map((r) => r.target);

type ChangeHandler = (event: ChangeEvent<HTMLInputElement>) => void;

export interface CreditFieldProps {
  name: CreditPath;
  /** Extra change handler (user edits), run after RHF stored the value. */
  onChange?: ChangeHandler;
  /** Options of a Select whose options come from the API dictionaries. */
  options?: readonly Option[];
  readOnly?: boolean;
}

/** A registered field: `FieldFrame` + the primitive of its control kind. */
export function CreditField({ name, onChange, options, readOnly }: CreditFieldProps) {
  const methods = useCreditForm();
  const { control, register } = methods;
  const meta = fieldMeta(name);

  const rules: RegisterOptions<CreditInput> = {};
  // NumberInput → `number | null`. RHF also passes values it writes itself (defaults, `setValue`)
  // through `setValueAs`; the shared parser passes numbers and `null` through unchanged.
  if (meta.control === 'number') rules.setValueAs = parseNumberInput;
  const deps = revalidateTargets(name);
  // One dependent field as a string: `trigger(name)` then re-renders only that field.
  if (deps.length) rules.deps = deps.length === 1 ? deps[0] : deps;
  const resets = resetTargets(name);
  if (resets.length || onChange) {
    rules.onChange = (event: ChangeEvent<HTMLInputElement>) => {
      for (const target of resets) setDependent(methods, target, '');
      onChange?.(event);
    };
  }

  return (
    <Field control={control} name={name} label={meta.label} inline={meta.control === 'checkbox'}>
      {(attrs) => renderControl(meta, register(name, rules), attrs, { options, readOnly })}
    </Field>
  );
}

function renderControl(
  meta: FieldMeta,
  field: UseFormRegisterReturn,
  attrs: ControlAttrs,
  { options, readOnly }: Pick<CreditFieldProps, 'options' | 'readOnly'>
): ReactNode {
  switch (meta.control) {
    case 'text':
    case 'email':
      return (
        <TextInput
          type={meta.control}
          {...field}
          placeholder={meta.placeholder}
          readOnly={readOnly}
          {...attrs}
        />
      );
    case 'textarea':
      return <Textarea {...field} placeholder={meta.placeholder} {...attrs} />;
    case 'number':
      return <NumberInput {...field} placeholder={meta.placeholder} {...attrs} />;
    case 'date':
      return <DateInput {...field} {...attrs} />;
    case 'masked':
      return (
        <MaskedInput mask={meta.mask ?? ''} {...field} placeholder={meta.placeholder} {...attrs} />
      );
    case 'select':
      return (
        <Select
          {...field}
          options={options ?? meta.options ?? []}
          placeholder={meta.placeholder}
          {...attrs}
        />
      );
    case 'radio':
      return <RadioGroup {...field} options={meta.options ?? []} {...attrs} />;
    case 'checkbox':
      return <Checkbox {...field} {...attrs} />;
  }
}

/**
 * Options of a Select that depend on another field's value, loaded through the shared client
 * (it caches and debounces; `undefined` — the call was superseded, keep the current options).
 */
function useApiOptions(
  load: (key: string) => Promise<Option[] | undefined>,
  key: string
): Option[] {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    let current = true;
    load(key).then(
      (loaded) => {
        if (current && loaded) setOptions(loaded);
      },
      () => {}
    );
    return () => {
      current = false;
    };
  }, [load, key]);
  return options;
}

/**
 * Select with options from the API, bound with `useController`: a controlled `<select>` shows its
 * value once the options arrive (an uncontrolled one keeps what the DOM had when RHF set it).
 */
export function ApiSelectField({
  name,
  source,
  load,
}: {
  name: CreditPath;
  /** Field whose value selects the options. */
  source: 'carBrand' | 'registrationAddress.region' | 'residenceAddress.region';
  load: (key: string) => Promise<Option[] | undefined>;
}) {
  const { control } = useCreditForm();
  const options = useApiOptions(load, useWatch({ control, name: source }));
  const meta = fieldMeta(name);
  return (
    <ControllerField control={control} name={name} label={meta.label}>
      {(field, attrs) => (
        <Select
          {...field}
          value={field.value as string}
          options={options}
          placeholder={meta.placeholder}
          {...attrs}
        />
      )}
    </ControllerField>
  );
}

/**
 * Credit fields: the shared metadata (`CREDIT_FIELDS`: label, control, placeholder, mask, static
 * options) rendered by the kit views and bound to Formik in one of two ways:
 *
 * - `FastCreditField` — `<FastField>`, for a field that "does not change behavior or render
 *   anything that is based on updates to another <Field />'s slice" (FastField docs): it renders
 *   only its own value and error. A cross rule qualifies: the schema computes it from other fields,
 *   but its result lands in `errors.<name>`, the field's own slice, which FastField does re-render
 *   for. Such a field can still drive others (loan type, flags): its change handler writes them
 *   through `setValues`.
 * - `CreditField` — `useField`, for a field whose rendering reads other state: options loaded by
 *   another field's value or from the API, `readOnly` while a copy flag is set. FastField would
 *   block those updates: it re-renders only for its own slice of Formik state and not for new
 *   props either.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useFormikContext } from 'formik';
import { creditApi } from '../../../shared/api/credit-client';
import {
  COMPUTED_LABELS,
  CREDIT_VISIBILITY,
  fieldMeta,
  type CreditAddress,
  type CreditComputed,
  type CreditInput,
  type CreditValues,
  type Option,
} from '../../../shared/domain/credit';
import { FastBenchField, useBenchField, type Bound } from '../kit/binding';
import {
  ComputedField,
  checkboxView,
  dateView,
  maskedView,
  radioView,
  selectView,
  textView,
  textareaView,
} from '../kit/fields';
import { numberView } from '../kit/number';
import { changeRegion, type CreditChange } from './changes';

type AddressKey = 'registrationAddress' | 'residenceAddress';

/** Options loaded once at start (`getRegions`, `getDictionaries`). */
export interface CreditOptionsValue {
  regions: readonly Option[];
  propertyTypes: readonly Option[];
}
export const CreditOptions = createContext<CreditOptionsValue>({ regions: [], propertyTypes: [] });

interface Extra {
  /** Options of a Select whose options come from the API. */
  options?: readonly Option[];
  readOnly?: boolean;
}

/** Kit view for the field's control. The value type follows `meta.control` at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
function view(name: string, b: Bound<any>, { options, readOnly }: Extra) {
  const meta = fieldMeta(name);
  const { label, placeholder } = meta;
  switch (meta.control) {
    case 'text':
    case 'email':
      return textView(b, { label, placeholder, readOnly, type: meta.control });
    case 'textarea':
      return textareaView(b, { label, placeholder });
    case 'number':
      return numberView(b, { label, placeholder });
    case 'date':
      return dateView(b, { label });
    case 'masked':
      return maskedView(b, { label, placeholder, mask: meta.mask ?? '' });
    case 'select':
      return selectView(b, { label, placeholder, options: options ?? meta.options ?? [] });
    case 'radio':
      return radioView(b, { label, options: meta.options ?? [] });
    case 'checkbox':
      return checkboxView(b, { label });
  }
}

const bindType = (name: string) =>
  fieldMeta(name).control === 'checkbox' ? 'checkbox' : undefined;

interface CreditFieldProps<V> {
  name: string;
  onValueChange?: CreditChange<V>;
}

/** Independent field bound with `<FastField>`. */
export function FastCreditField<V>({ name, onValueChange }: CreditFieldProps<V>) {
  return (
    <FastBenchField name={name} type={bindType(name)} onValueChange={onValueChange}>
      {(b) => view(name, b, {})}
    </FastBenchField>
  );
}

/** Field that reads other fields, bound with `useField`. */
export function CreditField<V>({ name, onValueChange, ...extra }: CreditFieldProps<V> & Extra) {
  return view(name, useBenchField({ name, type: bindType(name) }, onValueChange), extra);
}

/** Computed value C.1–C.8 (read only). */
export function Computed({ name }: { name: keyof CreditComputed }) {
  return <ComputedField name={name} label={COMPUTED_LABELS[name]} />;
}

/** Conditional section: rendered while CREDIT_VISIBILITY shows `field`; unmounted otherwise. */
export function Shown({ field, children }: { field: keyof CreditInput; children: ReactNode }) {
  const { values } = useFormikContext<CreditValues>();
  const rule = CREDIT_VISIBILITY.find((r) => r.fields.includes(field));
  return !rule || rule.visible(values) ? children : null;
}

// ── Selects with API options ─────────────────────────────────────────────────
/**
 * Options that depend on another field's value, loaded in an effect with an "is current" flag:
 * Formik's dependent-fields-async-api-request example. The client debounces and caches; a call it
 * superseded answers `undefined` and leaves the options as they are.
 */
function useLoadedOptions(
  source: string,
  load: (source: string) => Promise<readonly Option[] | undefined>
): readonly Option[] {
  const [options, setOptions] = useState<readonly Option[]>([]);
  useEffect(() => {
    let current = true;
    void load(source).then((loaded) => {
      if (current && loaded) setOptions(loaded);
    });
    return () => {
      current = false;
    };
  }, [source, load]);
  return options;
}

export function CarModelField() {
  const { values } = useFormikContext<CreditValues>();
  const options = useLoadedOptions(values.carBrand, creditApi.getCarModels);
  return <CreditField name="carModel" options={options} />;
}

export function CityField({ address }: { address: AddressKey }) {
  const { values } = useFormikContext<CreditValues>();
  const options = useLoadedOptions(values[address].region, creditApi.getCities);
  return <CreditField name={`${address}.city`} options={options} />;
}

export function RegionField({ address }: { address: AddressKey }) {
  const { regions } = useContext(CreditOptions);
  return (
    <CreditField
      name={`${address}.region`}
      options={regions}
      onValueChange={changeRegion(address)}
    />
  );
}

export function PropertyTypeField({ name }: { name: string }) {
  const { propertyTypes } = useContext(CreditOptions);
  return <CreditField name={name} options={propertyTypes} />;
}

// ── Copies (CREDIT_COPIES) while the flag is set ──────────────────────────────
/**
 * `emailAdditional` follows `email` while `sameEmail` is set and is read only then: Formik's
 * dependent-fields example (the field sets its own value from other fields in an effect).
 */
export function EmailAdditionalField() {
  const { values, setFieldValue } = useFormikContext<CreditValues>();
  const { email, sameEmail, emailAdditional } = values;
  useEffect(() => {
    if (sameEmail && emailAdditional !== email) void setFieldValue('emailAdditional', email);
  }, [sameEmail, email, emailAdditional, setFieldValue]);
  return <CreditField name="emailAdditional" readOnly={sameEmail} />;
}

const sameAddress = (a: CreditAddress, b: CreditAddress) =>
  (Object.keys(a) as (keyof CreditAddress)[]).every((k) => a[k] === b[k]);

/**
 * The residence address is a copy of the registration address while `sameAsRegistration` is set
 * (its fields are hidden then). Not validated, so the copy skips validation.
 */
export function ResidenceCopy() {
  const { values, setFieldValue } = useFormikContext<CreditValues>();
  const { sameAsRegistration, registrationAddress, residenceAddress } = values;
  useEffect(() => {
    if (sameAsRegistration && !sameAddress(residenceAddress, registrationAddress)) {
      void setFieldValue('residenceAddress', { ...registrationAddress }, false);
    }
  }, [sameAsRegistration, registrationAddress, residenceAddress, setFieldValue]);
  return null;
}

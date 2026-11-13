/**
 * User changes of controlling fields that also move other fields (spec «Поведение при изменении
 * полей»). Each is ONE `setValues` with an updater: Formik applies it to its current state and
 * validates the resulting values once. Separate `setFieldValue` calls would each validate a
 * snapshot that misses the other change.
 *
 * Only user changes go through here: loading an application (`?application=1`) is not a change
 * (CREDIT_RESETS), so these rules are bound to the fields' change handlers, not to effects.
 */
import type { FormikHelpers } from 'formik';
import {
  CREDIT_ARRAYS,
  CREDIT_INITIAL_INPUT,
  CREDIT_VISIBILITY,
  emptyAddress,
  type CreditArrayKey,
  type CreditInput,
  type CreditValues,
} from '../../../shared/domain/credit';
import type { ValueChange } from '../kit/binding';

export type CreditChange<V> = ValueChange<V, CreditValues>;
type Update = (values: CreditValues) => CreditValues;

const change =
  <V>(update: (value: V) => Update): CreditChange<V> =>
  (value, { setValues }: FormikHelpers<CreditValues>) =>
    void setValues(update(value));

/** A change that hides a section (CREDIT_VISIBILITY) returns its fields to their initial values. */
function hideSections(prev: CreditValues, next: CreditValues): CreditValues {
  let out = next;
  for (const rule of CREDIT_VISIBILITY) {
    if (!rule.visible(prev) || rule.visible(next)) continue;
    for (const f of rule.fields) out = { ...out, [f]: structuredClone(CREDIT_INITIAL_INPUT[f]) };
  }
  return out;
}

/** Loan type: mortgage / car sections switch, the hidden one is reset. */
export const changeLoanType = change<string>(
  (loanType) => (v) => hideSections(v, { ...v, loanType: loanType as CreditInput['loanType'] })
);

/** Employment status: employer / business sections switch, the hidden one is reset. */
export const changeEmploymentStatus = change<string>(
  (status) => (v) =>
    hideSections(v, { ...v, employmentStatus: status as CreditInput['employmentStatus'] })
);

/** CREDIT_RESETS: a new brand empties the model (its options are loaded for the brand). */
export const changeCarBrand = change<string>((carBrand) => (v) => ({
  ...v,
  carBrand,
  carModel: '',
}));

/** CREDIT_RESETS: a new region empties the city of the same address. */
export const changeRegion = (address: 'registrationAddress' | 'residenceAddress') =>
  change<string>((region) => (v) => ({ ...v, [address]: { ...v[address], region, city: '' } }));

/** CREDIT_COPIES: checking copies `email`; unchecking returns `emailAdditional` to its initial value. */
export const toggleSameEmail = change<boolean>((sameEmail) => (v) => ({
  ...v,
  sameEmail,
  emailAdditional: sameEmail ? v.email : CREDIT_INITIAL_INPUT.emailAdditional,
}));

/** CREDIT_COPIES: checking copies the registration address; unchecking shows empty residence fields. */
export const toggleSameAsRegistration = change<boolean>((sameAsRegistration) => (v) => ({
  ...v,
  sameAsRegistration,
  residenceAddress: sameAsRegistration ? { ...v.registrationAddress } : emptyAddress(),
}));

/** Array flag: switching on adds one empty row, switching off clears the array. */
export const toggleArray = (array: CreditArrayKey) =>
  change<boolean>((on) => (v) => {
    const { flag, empty } = CREDIT_ARRAYS[array];
    return { ...v, [flag]: on, [array]: on ? [empty()] : [] };
  });

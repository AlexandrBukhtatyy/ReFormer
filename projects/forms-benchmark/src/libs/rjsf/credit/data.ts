/**
 * The credit application as RJSF form data, and what the page derives from it on each change:
 * the shared behaviour tables of `domain/credit.ts` applied to the data a step `<Form>` reports.
 *
 * RJSF keeps an emptied field as `undefined` — the field is absent from the form data (docs: «The case
 * of empty strings», `ui:emptyValue`) — which is what lets JSON Schema `required` reject it. So the
 * domain's `''`/`null` are absent here, and so is an empty array (a switched-off array: its flag's
 * `then` schema puts the first row back as a `default`).
 */
import { deepEquals } from '@rjsf/utils';
import {
  CREDIT_COPIES,
  CREDIT_INITIAL_INPUT,
  CREDIT_RESETS,
  CREDIT_VISIBILITY,
  computeAge,
  computeCoBorrowersIncome,
  computeFullName,
  computeInitialPayment,
  computeInterestRate,
  computeMonthlyPayment,
  computePaymentToIncomeRatio,
  computeTotalIncome,
  toDomPath,
  type CreditComputed,
  type CreditInput,
  type CreditStep,
  type CreditValues,
} from '../../../shared/domain/credit';

type Empty<T> = T extends readonly (infer I)[]
  ? Empty<I>[]
  : T extends object
    ? { [K in keyof T]?: Empty<T[K]> }
    : Exclude<T, null | ''>;

/** `CreditValues` as RJSF holds them: every empty value absent. */
export type CreditFormData = Empty<CreditValues>;

/** Data of one step `<Form>`: its top-level keys only. */
export type StepData = Partial<CreditFormData>;

type Data = Record<string, unknown>;

/** Domain value → RJSF form data: `''`, `null` and `[]` dropped (objects are kept, even empty). */
export function toFormData<T>(value: T): Empty<T> {
  return strip(value) as Empty<T>;
}

function strip(value: unknown): unknown {
  if (value === '' || value === null) return undefined;
  if (Array.isArray(value)) return value.length > 0 ? value.map(strip) : undefined;
  if (typeof value !== 'object') return value;
  const out: Data = {};
  for (const [key, item] of Object.entries(value)) {
    const stripped = strip(item);
    if (stripped !== undefined) out[key] = stripped;
  }
  return out;
}

/**
 * C.1–C.8 by the shared formulas. A computed value with nothing to show is absent: the down payment
 * outside a mortgage, the co-borrowers' income while there are none (its `then` schema is inactive).
 */
function computeValues(v: CreditFormData): Partial<CreditComputed> {
  const person = v.personalData ?? {};
  const interestRate = computeInterestRate(
    v.loanType ?? '',
    v.registrationAddress?.region ?? '',
    v.hasProperty === true,
    v.properties?.length ?? 0
  );
  const monthlyPayment = computeMonthlyPayment(
    v.loanAmount ?? null,
    v.loanTerm ?? null,
    interestRate
  );
  const totalIncome = computeTotalIncome(v.monthlyIncome ?? null, v.additionalIncome ?? null);
  return {
    interestRate,
    monthlyPayment,
    initialPayment: computeInitialPayment(v.loanType ?? '', v.propertyValue ?? null) ?? undefined,
    fullName:
      computeFullName({
        lastName: person.lastName ?? '',
        firstName: person.firstName ?? '',
        middleName: person.middleName ?? '',
      }) || undefined,
    age: computeAge(person.birthDate ?? '') ?? undefined,
    totalIncome,
    paymentToIncomeRatio: computePaymentToIncomeRatio(monthlyPayment, totalIncome),
    coBorrowersIncome: v.hasCoBorrower
      ? computeCoBorrowersIncome(
          (v.coBorrowers ?? []).map((c) => ({ monthlyIncome: c.monthlyIncome ?? null }))
        )
      : undefined,
  };
}

/** Writes only the computed values that changed: an unchanged one leaves the step's data as it is. */
function withComputed(next: Data): Data {
  for (const [key, value] of Object.entries(computeValues(next as CreditFormData))) {
    if (next[key] !== value) next[key] = value;
  }
  return next;
}

/** Initial page values from domain values (`CREDIT_INITIAL_INPUT` or a loaded application). */
export function initialFormData(values: CreditInput): CreditFormData {
  return withComputed(toFormData(values) as Data) as CreditFormData;
}

/** Top-level keys a step `<Form>` holds: its fields and its computed values. */
export const stepKeys = (step: CreditStep): readonly string[] => [...step.keys, ...step.computed];

/** The step's slice of the page values, keys exactly as RJSF reported them (absent stays absent). */
export function stepData(values: CreditFormData, keys: readonly string[]): StepData {
  const out: Data = {};
  for (const key of keys) if (key in values) out[key] = (values as Data)[key];
  return out as StepData;
}

const get = (data: Data, path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => (node as Data | undefined)?.[key], data);

/** `data` with `path` (`a` or `a.b`) set to `undefined`, copying the objects on the way; no parent — no-op. */
function clear(data: Data, path: string): Data {
  const [head, leaf] = path.split('.');
  if (leaf === undefined) return { ...data, [head]: undefined };
  const parent = data[head] as Data | undefined;
  return parent ? { ...data, [head]: { ...parent, [leaf]: undefined } } : data;
}

/**
 * Page values after the step owning `keys` reported `data` (RJSF's data, never mutated — RJSF keeps the
 * same objects in its state). Then, from the shared tables, only for rules whose source is on this step:
 * - resets (🆕): a changed source empties its dependent field (`carBrand` → `carModel`, region → city);
 * - copies (✅): while the flag is set the target equals the source; unsetting it restores the
 *   target's initial value (the residence address reappears empty);
 * - computed values (C.1–C.8), written only when they changed.
 * Hidden fields need nothing here: RJSF already cleared them (`sanitizeDataForNewSchema` when a `then`
 * switches off), and a switched-off array went with them.
 */
export function applyStepData(
  prev: CreditFormData,
  keys: readonly string[],
  data: StepData
): CreditFormData {
  const before = prev as Data;
  let next: Data = { ...before };
  for (const key of keys) {
    if (key in data) next[key] = (data as Data)[key];
    else delete next[key];
  }
  for (const { source, target } of CREDIT_RESETS) {
    if (get(next, source) !== get(before, source)) next = clear(next, target);
  }
  for (const { flag, source, target } of CREDIT_COPIES) {
    if (!keys.includes(flag)) continue;
    if (next[flag] === true) {
      if (!deepEquals(next[target], next[source])) next[target] = structuredClone(next[source]);
    } else if (before[flag] === true) {
      next[target] = toFormData(CREDIT_INITIAL_INPUT[target]);
    }
  }
  return withComputed(next) as CreditFormData;
}

// ── Quiet fields (BENCH-CONTRACT §8) ─────────────────────────────────────────
const topKey = (pattern: string) => pattern.split(/[.[-]/)[0];

/** The contract path belongs to a field of `step`. */
const onStep = (step: CreditStep, path: string) =>
  (step.keys as readonly string[]).includes(topKey(path));

function isShown(key: string, v: CreditFormData): boolean {
  const rule = CREDIT_VISIBILITY.find((r) => (r.fields as readonly string[]).includes(key));
  // The predicates only compare values, so RJSF's `undefined` reads like the domain's `''`/`null`.
  return rule ? rule.visible(v as unknown as CreditInput) : true;
}

/** Contract paths of the step's fields on screen for values `v` (array fields — per row). */
export function shownPaths(step: CreditStep, v: CreditFormData): Set<string> {
  const out = new Set<string>();
  for (const pattern of step.fields) {
    const key = topKey(pattern);
    if (!isShown(key, v)) continue;
    if (!pattern.includes('[]')) {
      out.add(toDomPath(pattern));
      continue;
    }
    const rows = ((v as Data)[key] as unknown[] | undefined)?.length ?? 0;
    for (let i = 0; i < rows; i++) out.add(toDomPath(pattern.replace('[]', `.${i}`)));
  }
  return out;
}

/**
 * Quiet paths after a change in the live phase of `step`: a field that came on screen (its condition
 * became true, a row was added) is quiet until the user changes it (`changed`) or presses «Далее»;
 * a field that left the screen is forgotten. Returns `quiet` itself when nothing changed.
 */
export function nextQuiet(
  quiet: ReadonlySet<string>,
  step: CreditStep,
  prev: CreditFormData,
  next: CreditFormData,
  changed: string | undefined
): ReadonlySet<string> {
  const before = shownPaths(step, prev);
  const after = shownPaths(step, next);
  const out = new Set<string>();
  for (const path of quiet) {
    if (path !== changed && (after.has(path) || !onStep(step, path))) {
      out.add(path);
    }
  }
  for (const path of after) if (!before.has(path)) out.add(path);
  return out.size === quiet.size && [...out].every((p) => quiet.has(p)) ? quiet : out;
}

/** Quiet paths after «Далее» on `step`: its fields all speak now. */
export function revealStep(quiet: ReadonlySet<string>, step: CreditStep): ReadonlySet<string> {
  const out = [...quiet].filter((path) => !onStep(step, path));
  return out.length === quiet.size ? quiet : new Set(out);
}

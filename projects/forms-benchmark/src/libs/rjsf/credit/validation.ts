/**
 * The two documented validation hooks of the step forms:
 * - `transformErrors` — one message per field, the first violated rule in spec order, spec texts;
 * - `customValidate` per step — the cross-field rules (🆕) on the field the user enters.
 * https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation
 */
import type {
  CustomValidator,
  ErrorSchema,
  ErrorTransformer,
  RJSFValidationError,
} from '@rjsf/utils';
import {
  PAYMENT_TO_INCOME_MAX,
  experienceExceedsTotal,
  exceedsMortgageLimit,
  isTooOld,
  isTooYoung,
  remainingExceedsAmount,
  toFieldPattern,
} from '../../../shared/domain/credit';
import { CREDIT_MESSAGES, msg, type CreditMessageKey } from '../../../shared/messages/credit';
import type { StepData } from './data';

/** ajv keyword → rule name of `shared/messages` (`enum: [true]` is the «required» of a consent). */
const RULE_OF_KEYWORD: Readonly<Record<string, string>> = {
  required: 'required',
  enum: 'required',
  minimum: 'min',
  maximum: 'max',
  minLength: 'minLength',
  maxLength: 'maxLength',
  pattern: 'pattern',
  format: 'email',
};

/** Rules of each field (path template) in check order — the key order of `CREDIT_MESSAGES`. */
const RULES = new Map<string, string[]>();
for (const key of Object.keys(CREDIT_MESSAGES)) {
  const dot = key.lastIndexOf('.');
  const field = key.slice(0, dot);
  RULES.set(field, [...(RULES.get(field) ?? []), key.slice(dot + 1)]);
}

/** Field of an error: ajv8 reports a top-level `required` as `name`, the rest as `.a.0.b`. */
export const fieldOf = (error: RJSFValidationError) => (error.property ?? '').replace(/^\./, '');

/**
 * ajv (`allErrors`) reports every failed keyword of a field; the contract shows one message — the
 * first violated rule in the spec's order — with the spec text. Errors without a field are the
 * `if` of an `allOf` entry whose `then` failed: that `then` reports its own field errors, so they go.
 */
export const transformErrors: ErrorTransformer = (errors) => {
  const firstByField = new Map<string, { rank: number; error: RJSFValidationError }>();
  for (const error of errors) {
    const field = fieldOf(error);
    if (!field) continue;
    const pattern = toFieldPattern(field);
    const rules = RULES.get(pattern) ?? [];
    const rule = RULE_OF_KEYWORD[error.name ?? ''];
    const index = rule === undefined ? -1 : rules.indexOf(rule);
    // A keyword outside the table (none expected) still blocks, ranked after the known rules.
    const rank = index === -1 ? rules.length : index;
    const kept = firstByField.get(field);
    if (kept && kept.rank <= rank) continue;
    const message = index === -1 ? error.message : msg(`${pattern}.${rule}` as CreditMessageKey);
    firstByField.set(field, { rank, error: { ...error, message, stack: `${field}: ${message}` } });
  }
  return [...firstByField.values()].map(({ error }) => error);
};

/** The field already shows a schema error (4th argument of `customValidate`): its later rules wait. */
const failed = (node: unknown) => Boolean((node as ErrorSchema | undefined)?.__errors?.length);

/** Step 1: the mortgage amount is at most the property value minus the down payment. */
export const validateLoan: CustomValidator<StepData> = (data = {}, errors, _ui, errorSchema) => {
  if (
    !failed(errorSchema?.loanAmount) &&
    exceedsMortgageLimit(data.loanType ?? '', data.loanAmount ?? null, data.propertyValue ?? null)
  ) {
    errors.loanAmount?.addError(msg('loanAmount.maxMortgage'));
  }
  return errors;
};

/** Step 2: the borrower is 18–70 (C.5 from the birth date). */
export const validatePersonal: CustomValidator<StepData> = (
  data = {},
  errors,
  _ui,
  errorSchema
) => {
  const birthDate = data.personalData?.birthDate;
  const field = errors.personalData?.birthDate;
  if (birthDate && !failed(errorSchema?.personalData?.birthDate)) {
    if (isTooYoung(birthDate)) field?.addError(msg('personalData.birthDate.minAge'));
    else if (isTooOld(birthDate)) field?.addError(msg('personalData.birthDate.maxAge'));
  }
  return errors;
};

/**
 * Step 4: the current job's experience is at most the total; the payment is at most 50 % of the
 * income — C.7, which the page keeps in this step's data (`paymentToIncomeRatio`).
 */
export const validateEmployment: CustomValidator<StepData> = (
  data = {},
  errors,
  _ui,
  errorSchema
) => {
  if (
    !failed(errorSchema?.workExperienceCurrent) &&
    experienceExceedsTotal(data.workExperienceCurrent ?? null, data.workExperienceTotal ?? null)
  ) {
    errors.workExperienceCurrent?.addError(msg('workExperienceCurrent.maxTotal'));
  }
  if (
    !failed(errorSchema?.monthlyIncome) &&
    (data.paymentToIncomeRatio ?? 0) > PAYMENT_TO_INCOME_MAX
  ) {
    errors.monthlyIncome?.addError(msg('monthlyIncome.paymentRatio'));
  }
  return errors;
};

/** Step 5: in each existing loan, the remaining debt is at most the loan amount. */
export const validateAdditional: CustomValidator<StepData> = (
  data = {},
  errors,
  _ui,
  errorSchema
) => {
  data.existingLoans?.forEach((loan, i) => {
    if (
      !failed(errorSchema?.existingLoans?.[i]?.remainingAmount) &&
      remainingExceedsAmount(loan.remainingAmount ?? null, loan.amount ?? null)
    ) {
      errors.existingLoans?.[i]?.remainingAmount?.addError(
        msg('existingLoans[].remainingAmount.maxAmount')
      );
    }
  });
  return errors;
};

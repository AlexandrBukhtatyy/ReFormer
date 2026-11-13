/**
 * The registration form as RJSF data: JSON Schema (the spec's sync rules), uiSchema (widgets,
 * placeholders, layout) and the two documented validation hooks. Module-level constants, as in every
 * RJSF docs example — nothing here depends on component state.
 */
import type {
  CustomValidator,
  ErrorTransformer,
  RJSFSchema,
  RJSFValidationError,
  UiSchema,
} from '@rjsf/utils';
import {
  CAPTCHA_LENGTH,
  FULL_NAME_MIN,
  PASSWORD_MIN,
  PHONE_MASK,
  PHONE_PATTERN,
  REGISTRATION_LABELS as L,
  REGISTRATION_PLACEHOLDERS as P,
  USERNAME_MIN,
  USERNAME_PATTERN,
  type RegistrationValues,
} from '../../../shared/domain/registration';
import { msg, type RegistrationMessageKey } from '../../../shared/messages/registration';
import { RegistrationLayout } from './RegistrationLayout';

/**
 * RJSF keeps an emptied input as `undefined` — the field is absent from form data (docs: «The case of
 * empty strings», `ui:emptyValue`). That is what lets JSON Schema `required` reject an empty field.
 */
export type RegistrationFormData = Partial<RegistrationValues>;

export const schema: RJSFSchema = {
  type: 'object',
  required: [
    'username',
    'email',
    'password',
    'confirmPassword',
    'fullName',
    'phone',
    'captcha',
    'acceptTerms',
  ],
  properties: {
    username: {
      type: 'string',
      title: L.username,
      minLength: USERNAME_MIN,
      pattern: USERNAME_PATTERN.source,
    },
    email: { type: 'string', title: L.email, format: 'email' },
    password: {
      type: 'string',
      title: L.password,
      minLength: PASSWORD_MIN,
      // `isStrongPassword` from the shared domain as a JSON Schema pattern: upper, lower, digit.
      pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)',
    },
    confirmPassword: { type: 'string', title: L.confirmPassword },
    fullName: { type: 'string', title: L.fullName, minLength: FULL_NAME_MIN },
    phone: { type: 'string', title: L.phone, pattern: PHONE_PATTERN.source },
    captcha: {
      type: 'string',
      title: L.captcha,
      minLength: CAPTCHA_LENGTH,
      maxLength: CAPTCHA_LENGTH,
    },
    // «Обязательно отметить»: only `true` is valid (`const` would be pre-filled as a default).
    acceptTerms: { type: 'boolean', title: L.acceptTerms, enum: [true] },
  },
};

export const uiSchema: UiSchema = {
  'ui:ObjectFieldTemplate': RegistrationLayout,
  username: { 'ui:placeholder': P.username },
  email: { 'ui:placeholder': P.email },
  password: { 'ui:widget': 'password', 'ui:placeholder': P.password },
  confirmPassword: { 'ui:widget': 'password', 'ui:placeholder': P.confirmPassword },
  fullName: { 'ui:placeholder': P.fullName },
  phone: { 'ui:widget': 'masked', 'ui:placeholder': P.phone, 'ui:options': { mask: PHONE_MASK } },
  captcha: { 'ui:widget': 'captcha', 'ui:placeholder': P.captcha },
};

/**
 * The spec's «Сообщения об ошибках»: for each field, its rules in check order as
 * `[ajv keyword, message key]`. The order — not ajv's — decides which message a field shows.
 */
const RULES: Record<string, ReadonlyArray<readonly [string, RegistrationMessageKey]>> = {
  username: [
    ['required', 'username.required'],
    ['minLength', 'username.minLength'],
    ['pattern', 'username.pattern'],
  ],
  email: [
    ['required', 'email.required'],
    ['format', 'email.email'],
  ],
  password: [
    ['required', 'password.required'],
    ['minLength', 'password.minLength'],
    ['pattern', 'password.strength'],
  ],
  confirmPassword: [['required', 'confirmPassword.required']],
  fullName: [
    ['required', 'fullName.required'],
    ['minLength', 'fullName.minLength'],
  ],
  phone: [
    ['required', 'phone.required'],
    ['pattern', 'phone.pattern'],
  ],
  captcha: [
    ['required', 'captcha.required'],
    ['minLength', 'captcha.length'],
    ['maxLength', 'captcha.length'],
  ],
  acceptTerms: [
    ['required', 'acceptTerms.required'],
    ['enum', 'acceptTerms.required'],
  ],
};

/** Field of an error: ajv8 reports `required` as `username`, the other keywords as `.username`. */
export const fieldOf = (error: RJSFValidationError) => (error.property ?? '').replace(/^\./, '');

/**
 * ajv (`allErrors`) reports every failed keyword of a field; the spec shows one message per field —
 * the first violated rule in its order. Keep that error and give it the spec text.
 */
export const transformErrors: ErrorTransformer<RegistrationFormData> = (errors) => {
  const firstByField = new Map<string, { rank: number; error: RJSFValidationError }>();
  for (const error of errors) {
    const field = fieldOf(error);
    const rules = RULES[field] ?? [];
    const index = rules.findIndex(([keyword]) => keyword === error.name);
    // A keyword outside the table (none expected) still blocks submit, ranked after the known rules.
    const rank = index === -1 ? rules.length : index;
    const kept = firstByField.get(field);
    if (kept && kept.rank <= rank) continue;
    const message = index === -1 ? error.message : msg(rules[index][1]);
    firstByField.set(field, { rank, error: { ...error, message, stack: `${field}: ${message}` } });
  }
  return [...firstByField.values()].map(({ error }) => error);
};

/**
 * The cross-field rule «должно совпадать с паролем». It is confirmPassword's second rule, so it runs
 * only when the JSON Schema rules of the field (`errorSchema`, 4th argument) passed. Validation is
 * whole-form, so a change of `password` re-checks it under `liveValidate`.
 */
export const customValidate: CustomValidator<RegistrationFormData> = (
  formData,
  errors,
  _uiSchema,
  errorSchema
) => {
  if (
    !errorSchema?.confirmPassword?.__errors?.length &&
    formData?.confirmPassword !== formData?.password
  ) {
    errors.confirmPassword?.addError(msg('confirmPassword.match'));
  }
  return errors;
};

/**
 * Registration on RJSF 6 + ajv8, bench theme.
 *
 * - Validation reveal `afterFirstSubmit`: RJSF validates on submit by default; the first attempt
 *   turns on `liveValidate="onChange"`, after which every change re-validates the whole form.
 * - Server checks (username, email, captcha) go through the documented `extraErrors` prop, blocking
 *   submit with `extraErrorsBlockSubmit`. RJSF has no async validation of its own, so the page runs
 *   them: on each change after the first attempt, for a value that passed the field's sync rules,
 *   and on submit, which waits for them before `register`.
 * - «Очистить» — the Form's `reset()` back to `initialFormData` (empty, or the invite prefill) plus
 *   the quiet phase again.
 */
import { useEffect, useRef, useState } from 'react';
import type Form from '@rjsf/core';
import type { IChangeEvent } from '@rjsf/core';
import type { ErrorSchema, RJSFValidationError } from '@rjsf/utils';
import { ErrorSchemaBuilder, toErrorList } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { api } from '../../../shared/api/client';
import { serverConfig } from '../../../shared/api/server';
import {
  toRegistrationPayload,
  type RegistrationValues,
} from '../../../shared/domain/registration';
import { msg } from '../../../shared/messages/registration';
import { Actions, Page, ResetButton, SubmitButton, SubmitResult } from '../../../shared/ui/layout';
import { BenchForm } from '../theme';
import {
  customValidate,
  fieldOf,
  schema,
  transformErrors,
  uiSchema,
  type RegistrationFormData,
} from './schema';

/** Server checks — the last rule of their field. The client debounces and caches them itself. */
const ASYNC_RULES = {
  username: { check: api.checkUsername, message: msg('username.taken') },
  email: { check: api.checkEmail, message: msg('email.taken') },
  captcha: { check: api.verifyCaptcha, message: msg('captcha.invalid') },
};
type AsyncField = keyof typeof ASYNC_RULES;
const ASYNC_FIELDS = Object.keys(ASYNC_RULES) as AsyncField[];

type ExtraErrors = ErrorSchema | undefined;

/**
 * `extraErrors` with the async error of `field` set to `message` or cleared, written with RJSF's
 * `ErrorSchemaBuilder`. No errors left → `undefined`: under `extraErrorsBlockSubmit` any object,
 * even one without messages, blocks submit.
 */
function withAsyncError(prev: ExtraErrors, field: AsyncField, message?: string): ExtraErrors {
  if (prev?.[field]?.__errors?.[0] === message) return prev;
  const builder = new ErrorSchemaBuilder(prev);
  if (message) builder.setErrors(message, field);
  else builder.clearErrors(field);
  return toErrorList(builder.ErrorSchema).length > 0 ? builder.ErrorSchema : undefined;
}

/**
 * The field passed its sync rules (JSON Schema). RJSF merges `extraErrors` into the errors it reports,
 * so the field's own async message — stale once the value has changed — is not counted.
 */
const passesSyncRules = (errors: RJSFValidationError[], field: AsyncField) =>
  !errors.some((error) => fieldOf(error) === field && error.message !== ASYNC_RULES[field].message);

/**
 * Empty initial data: strings stay absent (RJSF's empty value); RJSF itself sets the required boolean
 * `acceptTerms` to `false` (`getDefaultFormState`: a required boolean without `default` gets `false`;
 * the current docs describe it as `experimental_defaultFormStateBehavior.requiredBooleanDefault`,
 * default `populateFalse`, an option 6.10.1 does not have yet).
 */
const EMPTY: RegistrationFormData = {};

/** Waits for the invite prefill (if any): `initialFormData` is read when the Form mounts. */
export function RegistrationForm() {
  const { invite } = serverConfig;
  const [initialFormData, setInitialFormData] = useState(invite ? undefined : EMPTY);

  useEffect(() => {
    if (!invite) return;
    let active = true;
    void api.getRegistrationPrefill(invite).then((prefill) => {
      if (active) setInitialFormData(prefill);
    });
    return () => {
      active = false;
    };
  }, [invite]);

  return (
    <Page title="Регистрация">
      {initialFormData ? <RegistrationFormBody initialFormData={initialFormData} /> : null}
    </Page>
  );
}

function RegistrationFormBody({ initialFormData }: { initialFormData: RegistrationFormData }) {
  const formRef = useRef<Form<RegistrationFormData>>(null);
  /** Latest form data: an async result is applied only while its value is still in the field. */
  const values = useRef(initialFormData);
  /** Bumped by «Очистить»: checks started before it no longer report. */
  const generation = useRef(0);
  const [submitted, setSubmitted] = useState(false);
  const [extraErrors, setExtraErrors] = useState<ExtraErrors>();
  const [userId, setUserId] = useState<string>();

  /** Run the server check of `field`; resolves `false` only for a definite «taken/invalid». */
  const runCheck = async (field: AsyncField, value: string) => {
    const run = generation.current;
    const ok = await ASYNC_RULES[field].check(value);
    // `undefined` — superseded by a newer check of this field: no verdict, nothing to show.
    if (ok !== undefined && run === generation.current && values.current[field] === value) {
      setExtraErrors((prev) =>
        withAsyncError(prev, field, ok ? undefined : ASYNC_RULES[field].message)
      );
    }
    return ok !== false;
  };

  /** Checks for every async field whose value passed its sync rules. */
  const checkFields = (data: RegistrationFormData, errors: RJSFValidationError[]) =>
    ASYNC_FIELDS.flatMap((field) => {
      const value = data[field];
      return value !== undefined && passesSyncRules(errors, field) ? [runCheck(field, value)] : [];
    });

  /**
   * `id` — the field the user changed. Changes without one (mount defaults, `reset()`) re-check
   * nothing; `reset()` even calls the `onChange` it read before re-rendering, i.e. this handler from
   * before «Очистить», with `submitted` still true.
   */
  const handleChange = (
    { formData = EMPTY, errors }: IChangeEvent<RegistrationFormData>,
    id?: string
  ) => {
    const previous = values.current;
    values.current = formData;
    if (!submitted || id === undefined) return;
    for (const field of ASYNC_FIELDS) {
      const value = formData[field];
      if (value === previous[field]) continue;
      // The verdict belonged to the previous value.
      setExtraErrors((prev) => withAsyncError(prev, field));
      if (value !== undefined && passesSyncRules(errors, field)) void runCheck(field, value);
    }
  };

  /** Submit attempt with sync errors (or a standing async one): show them, check the rest. */
  const handleError = (errors: RJSFValidationError[]) => {
    setSubmitted(true);
    void Promise.all(checkFields(values.current, errors));
  };

  /** Sync rules passed: wait for the server checks, then register. */
  const handleSubmit = async ({ formData = EMPTY }: IChangeEvent<RegistrationFormData>) => {
    setSubmitted(true);
    const run = generation.current;
    const results = await Promise.all(checkFields(formData, []));
    if (run !== generation.current || results.includes(false)) return;
    // Valid against the schema, so every field is present.
    const { userId: id } = await api.register(
      toRegistrationPayload(formData as RegistrationValues)
    );
    setUserId(id);
  };

  const handleReset = () => {
    generation.current++;
    formRef.current?.reset();
    setSubmitted(false);
    setExtraErrors(undefined);
  };

  return (
    <>
      <BenchForm
        ref={formRef}
        schema={schema}
        uiSchema={uiSchema}
        validator={validator}
        initialFormData={initialFormData}
        idSeparator="-"
        noHtml5Validate
        showErrorList={false}
        liveValidate={submitted ? 'onChange' : undefined}
        transformErrors={transformErrors}
        customValidate={customValidate}
        extraErrors={extraErrors}
        extraErrorsBlockSubmit
        onChange={handleChange}
        onError={handleError}
        onSubmit={handleSubmit}
      >
        <Actions>
          <SubmitButton>Зарегистрироваться</SubmitButton>
          <ResetButton onClick={handleReset} />
        </Actions>
      </BenchForm>
      {userId ? <SubmitResult>Регистрация успешна: {userId}</SubmitResult> : null}
    </>
  );
}

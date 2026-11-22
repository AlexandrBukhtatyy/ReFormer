/**
 * Formik + Yup: `<Formik>` with a Yup `validationSchema`, `<Form>`, and `useField`-based inputs from
 * `../kit`. Errors are revealed after the first submit attempt (`submitCount`), the server response
 * is kept in Formik `status`, the invite prefill arrives as new `initialValues` (`enableReinitialize`).
 */
import { useEffect, useState } from 'react';
import { Form, Formik, useFormikContext, type FormikHelpers } from 'formik';
import { api } from '../../../shared/api/client';
import { serverConfig } from '../../../shared/api/server';
import {
  PHONE_MASK,
  REGISTRATION_INITIAL,
  REGISTRATION_LABELS as L,
  REGISTRATION_PLACEHOLDERS as P,
  toRegistrationPayload,
  type RegistrationValues,
} from '../../../shared/domain/registration';
import { Actions, Page, ResetButton, SubmitButton, SubmitResult } from '../../../shared/ui/layout';
import { CaptchaField } from '../kit/captcha';
import { CheckboxField, MaskedField, TextField } from '../kit/fields';
import { registrationSchema } from './schema';

interface RegistrationStatus {
  userId: string;
}

async function submitRegistration(
  values: RegistrationValues,
  { setStatus }: FormikHelpers<RegistrationValues>
): Promise<void> {
  const { userId } = await api.register(toRegistrationPayload(values));
  setStatus({ userId } satisfies RegistrationStatus);
}

function RegistrationResult() {
  const { status } = useFormikContext<RegistrationValues>();
  const result = status as RegistrationStatus | undefined;
  return result ? <SubmitResult>Регистрация успешна: {result.userId}</SubmitResult> : null;
}

export function RegistrationForm() {
  const [initialValues, setInitialValues] = useState<RegistrationValues>(REGISTRATION_INITIAL);

  useEffect(() => {
    const { invite } = serverConfig;
    if (!invite) return;
    let active = true;
    void api.getRegistrationPrefill(invite).then((prefill) => {
      if (active) setInitialValues({ ...REGISTRATION_INITIAL, ...prefill });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Page title="Регистрация">
      <Formik
        initialValues={initialValues}
        enableReinitialize
        validationSchema={registrationSchema}
        onSubmit={submitRegistration}
      >
        <Form noValidate>
          <div className="b-grid">
            <TextField name="username" label={L.username} placeholder={P.username} />
            <TextField type="email" name="email" label={L.email} placeholder={P.email} />
            <TextField
              type="password"
              name="password"
              label={L.password}
              placeholder={P.password}
            />
            <TextField
              type="password"
              name="confirmPassword"
              label={L.confirmPassword}
              placeholder={P.confirmPassword}
            />
          </div>
          <TextField name="fullName" label={L.fullName} placeholder={P.fullName} />
          <MaskedField mask={PHONE_MASK} name="phone" label={L.phone} placeholder={P.phone} />
          <CaptchaField name="captcha" label={L.captcha} placeholder={P.captcha} />
          <CheckboxField name="acceptTerms" label={L.acceptTerms} />
          <Actions>
            <SubmitButton>Зарегистрироваться</SubmitButton>
            {/* type="reset": `<Form>` routes the native reset event to Formik's handleReset. */}
            <ResetButton type="reset" />
          </Actions>
          <RegistrationResult />
        </Form>
      </Formik>
    </Page>
  );
}

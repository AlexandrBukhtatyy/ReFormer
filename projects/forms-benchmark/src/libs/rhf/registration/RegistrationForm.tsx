/**
 * Registration form on React Hook Form + zod (zodResolver). Same markup and primitives as the
 * baseline page; see ../README.md for the docs behind every pattern used here.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { CaptchaWidget } from '../../../shared/ui/CaptchaWidget';
import { Checkbox, MaskedInput, TextInput } from '../../../shared/ui/controls';
import { Actions, Page, ResetButton, SubmitButton, SubmitResult } from '../../../shared/ui/layout';
import { ControllerField, Field } from '../kit/Field';
import { registrationResolver } from './schema';

/**
 * Default values: empty, or — with an invite — an async `defaultValues` function. Its result
 * becomes the defaults that `reset()` returns to. A rejected promise would leave `isLoading`
 * stuck, so a failed prefill falls back to the empty form (useForm docs, `defaultValues`).
 */
function registrationDefaults(
  invite: string | null
): RegistrationValues | (() => Promise<RegistrationValues>) {
  if (!invite) return REGISTRATION_INITIAL;
  return async () => {
    try {
      return { ...REGISTRATION_INITIAL, ...(await api.getRegistrationPrefill(invite)) };
    } catch {
      return REGISTRATION_INITIAL;
    }
  };
}

const defaultValues = registrationDefaults(serverConfig.invite);

export function RegistrationForm() {
  const [userId, setUserId] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isLoading },
  } = useForm<RegistrationValues>({
    defaultValues,
    resolver: registrationResolver,
    // mode: 'onSubmit' and reValidateMode: 'onChange' are the defaults: quiet until the first
    // submit, then every change re-validates.
    shouldFocusError: false,
  });

  const onValid = async (values: RegistrationValues) => {
    const result = await api.register(toRegistrationPayload(values));
    setUserId(result.userId);
  };

  const onReset = () => {
    reset();
    setUserId(null);
  };

  return (
    <Page title="Регистрация">
      {/* Async defaults: controlled fields must not mount with `undefined` (useController docs). */}
      {isLoading ? null : (
        <form noValidate onSubmit={handleSubmit(onValid)}>
          <div className="b-grid">
            <Field control={control} name="username" label={L.username}>
              {(attrs) => (
                <TextInput {...register('username')} placeholder={P.username} {...attrs} />
              )}
            </Field>
            <Field control={control} name="email" label={L.email}>
              {(attrs) => (
                <TextInput type="email" {...register('email')} placeholder={P.email} {...attrs} />
              )}
            </Field>
            <Field control={control} name="password" label={L.password}>
              {(attrs) => (
                <TextInput
                  type="password"
                  {...register('password', { deps: 'confirmPassword' })}
                  placeholder={P.password}
                  {...attrs}
                />
              )}
            </Field>
            <Field control={control} name="confirmPassword" label={L.confirmPassword}>
              {(attrs) => (
                <TextInput
                  type="password"
                  {...register('confirmPassword')}
                  placeholder={P.confirmPassword}
                  {...attrs}
                />
              )}
            </Field>
          </div>
          <Field control={control} name="fullName" label={L.fullName}>
            {(attrs) => <TextInput {...register('fullName')} placeholder={P.fullName} {...attrs} />}
          </Field>
          <Field control={control} name="phone" label={L.phone}>
            {(attrs) => (
              <MaskedInput
                mask={PHONE_MASK}
                {...register('phone')}
                placeholder={P.phone}
                {...attrs}
              />
            )}
          </Field>
          <ControllerField control={control} name="captcha" label={L.captcha}>
            {({ ref, ...field }, attrs) => (
              <CaptchaWidget {...field} inputRef={ref} placeholder={P.captcha} {...attrs} />
            )}
          </ControllerField>
          <Field control={control} name="acceptTerms" label={L.acceptTerms} inline>
            {(attrs) => <Checkbox {...register('acceptTerms')} {...attrs} />}
          </Field>
          <Actions>
            <SubmitButton>Зарегистрироваться</SubmitButton>
            <ResetButton onClick={onReset} />
          </Actions>
          {userId ? <SubmitResult>Регистрация успешна: {userId}</SubmitResult> : null}
        </form>
      )}
    </Page>
  );
}

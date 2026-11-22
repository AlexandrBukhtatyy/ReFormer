/**
 * Регистрация на `@reformer/core` + headless `@reformer/cdk` (порт демо
 * `react-playground/src/pages/demo/registration-form` на нейтральный UI).
 *
 * Паттерны по документации ReFormer (packages/reformer/docs/llms):
 * - сборка `createForm({ initial, schema, validation })` — 38-form-flow.md, 28-submit-and-reset.md;
 * - схема — только поля (`component` + `componentProps`), JSX — `<Field control={form.x} />`;
 * - правила — `defineValidation` (../../reformer-kit/registration-rules.ts), стратегия
 *   `afterFirstSubmit` полем `validation` сборки — 33-validation-strategy.md;
 * - отправка — `bundle.submission.submit(handler)`;
 * - «Очистить» — `bundle.form.reset()`: значения к исходным (пустым или из приглашения), ноды и
 *   тихая фаза `afterFirstSubmit` — 28-submit-and-reset.md, 33-validation-strategy.md.
 */
import { useEffect, useState } from 'react';
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
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
import { Checkbox, MaskedInput, TextInput } from '../../../shared/ui/controls';
import { CaptchaWidget } from '../../../shared/ui/CaptchaWidget';
import { Actions, Page, ResetButton, SubmitButton, SubmitResult } from '../../../shared/ui/layout';
import { Field } from '../../reformer-kit/Field';
import { registrationMessages, registrationRules } from '../../reformer-kit/registration-rules';

// Схема: только поля. Путь DOM-контракта (testid) `Field` берёт из пути поля в модели.
const schema = (model: FormModel<RegistrationValues>) => ({
  children: [
    {
      model: model.$.username,
      component: TextInput,
      componentProps: { label: L.username, placeholder: P.username },
    },
    {
      model: model.$.email,
      component: TextInput,
      componentProps: { label: L.email, placeholder: P.email, type: 'email' },
    },
    {
      model: model.$.password,
      component: TextInput,
      componentProps: {
        label: L.password,
        placeholder: P.password,
        type: 'password',
      },
    },
    {
      model: model.$.confirmPassword,
      component: TextInput,
      componentProps: {
        label: L.confirmPassword,
        placeholder: P.confirmPassword,
        type: 'password',
      },
    },
    {
      model: model.$.fullName,
      component: TextInput,
      componentProps: { label: L.fullName, placeholder: P.fullName },
    },
    {
      model: model.$.phone,
      component: MaskedInput,
      componentProps: { label: L.phone, placeholder: P.phone, mask: PHONE_MASK },
    },
    {
      model: model.$.captcha,
      component: CaptchaWidget,
      componentProps: { label: L.captcha, placeholder: P.captcha },
    },
    {
      model: model.$.acceptTerms,
      component: Checkbox,
      componentProps: { label: L.acceptTerms },
    },
  ],
});

const createRegistration = (initial: RegistrationValues) =>
  createForm<RegistrationValues>({
    initial,
    schema,
    validation: { rules: registrationRules, strategy: 'afterFirstSubmit' },
  });

function RegistrationFormBody({ initial }: { initial: RegistrationValues }) {
  const bundle = useFormBundle(() => createRegistration(initial));
  const { form } = bundle;
  const [userId, setUserId] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const outcome = await bundle.submission.submit((values) =>
      api.register(toRegistrationPayload(values))
    );
    if (outcome.status === 'submitted') setUserId(outcome.result.userId);
  };

  const onReset = () => {
    bundle.form.reset();
    setUserId(null);
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <div className="b-grid">
        <Field control={form.username} />
        <Field control={form.email} />
        <Field control={form.password} />
        <Field control={form.confirmPassword} />
      </div>
      <Field control={form.fullName} />
      <Field control={form.phone} />
      <Field control={form.captcha} />
      <Field control={form.acceptTerms} />
      <Actions>
        <SubmitButton>Зарегистрироваться</SubmitButton>
        <ResetButton onClick={onReset} />
      </Actions>
      {userId ? <SubmitResult>Регистрация успешна: {userId}</SubmitResult> : null}
    </form>
  );
}

export function RegistrationForm() {
  const invite = serverConfig.invite;
  const [initial, setInitial] = useState<RegistrationValues | null>(
    invite ? null : REGISTRATION_INITIAL
  );

  useEffect(() => {
    if (!invite) return;
    void api
      .getRegistrationPrefill(invite)
      .then((prefill) => setInitial({ ...REGISTRATION_INITIAL, ...prefill }));
  }, [invite]);

  return (
    <ValidationMessagesProvider messages={registrationMessages}>
      <Page title="Регистрация">{initial ? <RegistrationFormBody initial={initial} /> : null}</Page>
    </ValidationMessagesProvider>
  );
}

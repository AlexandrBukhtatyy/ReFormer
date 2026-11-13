/**
 * Регистрация на `@reformer/renderer-json`: разметка и поля — JSON-документ (form.json), правила —
 * общая TS-схема ReFormer (../../reformer-kit/registration-rules.ts), компоненты — реестр
 * (../kit/registry.ts). В TSX — только загрузка приглашения и рендерер.
 *
 * Документация: packages/reformer-renderer-json/docs/llms/06-validation.md (правила и стратегия),
 * сборка `createForm({ schema: json, registry, initial, validation })`. «Очистить» —
 * `bundle.form.reset()` в `<form>` реестра (../kit/form-shell.tsx).
 */
import { useEffect, useState } from 'react';
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { api } from '../../../shared/api/client';
import { serverConfig } from '../../../shared/api/server';
import {
  REGISTRATION_INITIAL,
  toRegistrationPayload,
  type RegistrationValues,
} from '../../../shared/domain/registration';
import { registrationMessages, registrationRules } from '../../reformer-kit/registration-rules';
import { benchRegistry } from '../kit/registry';
import { FormActionsContext, type FormActions } from '../kit/form-shell';
import rawSchema from './form.json';

// JSON-операторы типизируются строками — приведение и есть сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<RegistrationValues>;

/** Обработчик отправки — со страницы контекстом: JSON не выражает функции. */
const actions: FormActions = {
  async submit(values) {
    const { userId } = await api.register(toRegistrationPayload(values as RegistrationValues));
    return `Регистрация успешна: ${userId}`;
  },
};

const createRegistration = (initial: RegistrationValues) =>
  createForm<RegistrationValues>({
    schema,
    registry: benchRegistry,
    initial,
    validation: { rules: registrationRules, strategy: 'afterFirstSubmit' },
  });

function RegistrationRenderer({ initial }: { initial: RegistrationValues }) {
  const bundle = useFormBundle(() => createRegistration(initial));
  return <FormRenderer<RegistrationValues> form={bundle} />;
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
      <FormActionsContext.Provider value={actions}>
        {initial ? <RegistrationRenderer initial={initial} /> : null}
      </FormActionsContext.Provider>
    </ValidationMessagesProvider>
  );
}

/**
 * Форма регистрации без слоя представления — для страниц кросс-фреймворк проверки.
 *
 * Документ формы, правила, тексты ошибок и API — те же, что у участника бенчмарка на
 * `@reformer/renderer-json`: `form.json` (../libs/reformer-json/registration), правила
 * (../libs/reformer-kit/registration-rules.ts), общий клиент API. Хост стека (React, Vue, Angular)
 * приносит только реестр своих компонентов и монтирует сборку своим рендерером — поэтому различие
 * в поведении страниц означает различие рендереров, а не форм.
 */
import { createForm, type FormBundle, type SchemaResolver } from '@reformer/core';
import type { JsonFormSchema } from '@reformer/renderer-json/neutral';
import { api } from '../shared/api/client';
import { serverConfig } from '../shared/api/server';
import {
  REGISTRATION_INITIAL,
  toRegistrationPayload,
  type RegistrationValues,
} from '../shared/domain/registration';
import { registrationMessages, registrationRules } from '../libs/reformer-kit/registration-rules';
import rawSchema from '../libs/reformer-json/registration/form.json';

export { registrationMessages };
export type { RegistrationValues };

// JSON-операторы типизируются строками — приведение и есть сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<RegistrationValues>;

/**
 * Начальные значения формы: пустые либо предзаполненные по приглашению (`?invite=`). Форма
 * собирается уже с ними — «Очистить» возвращает предзаполнение, а не пустые поля.
 */
export async function loadRegistrationInitial(): Promise<RegistrationValues> {
  const invite = serverConfig.invite;
  if (!invite) return REGISTRATION_INITIAL;
  return { ...REGISTRATION_INITIAL, ...(await api.getRegistrationPrefill(invite)) };
}

/** Сборка формы на реестре компонентов хоста. Владелец сборки — хост: он же зовёт `dispose()`. */
export function createRegistrationForm(
  registry: SchemaResolver,
  initial: RegistrationValues
): FormBundle<RegistrationValues> {
  return createForm<RegistrationValues>({
    schema,
    registry,
    initial,
    validation: { rules: registrationRules, strategy: 'afterFirstSubmit' },
  });
}

/** Отправка валидной формы; возвращает текст подтверждения. */
export async function submitRegistration(values: RegistrationValues): Promise<string> {
  const { userId } = await api.register(toRegistrationPayload(values));
  return `Регистрация успешна: ${userId}`;
}

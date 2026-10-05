/**
 * Прямая сборка формы: модель, дерево из JSON-схемы, реестр, поведение — одним вызовом `createForm`.
 *
 * Вынесено из компонента, чтобы в TSX остался только рендерер. Здесь нет ни одного React-хука —
 * это чистая функция сборки, которую компонент вызывает один раз (`useFormBundle`).
 *
 * Данные (`model.ts`), поведение (`form.behavior.ts`) и реестр компонентов (`registry.tsx`) лежат
 * отдельно, потому что ими же пользуется запись реестра форм (`form-entry.ts`). Здесь остался
 * только способ сборки — прямой, без реестра форм.
 */

import { createForm, type FormBundle } from '@reformer/core';
import { signal } from '@reformer/core/signals';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { createRegistrationRegistry, type FormUiState } from './registry';
import { INITIAL } from './model';
import { createRegistrationBehavior } from './form.behavior';
import rawJsonSchema from './json-schema.json';

// Операторы в чистом JSON типизируются как `string`, поэтому приведение — это и есть
// сценарий «схема пришла строкой с сервера». Параметр `<RegistrationFormData>` даёт сборке
// типобезопасность путей `$model(...)` (сам cast остаётся).
export const registrationJsonSchema =
  rawJsonSchema as unknown as JsonFormSchema<RegistrationFormData>;

/** Собранная форма регистрации: бандл {@link createForm}. */
export type RegistrationFormBundle = FormBundle<RegistrationFormData>;

/**
 * Собирает всё, что нужно рендереру. Вызывается один раз (`useFormBundle`) — повторный вызов
 * создал бы новый реестр и новый тип компонента `AsyncBoundary`, из-за чего загрузка префилла
 * стартовала бы заново.
 */
export function createRegistrationSetup(): RegistrationFormBundle {
  // `ui` здесь локальный: у прямой сборки реестр компонентов свой на каждый вызов, а значит
  // и сигналы могут быть свои. У записи реестра всё наоборот — см. комментарий в `form-entry.ts`.
  const ui: FormUiState = { status: signal<string | null>(null), pending: signal(false) };

  return createForm<RegistrationFormData>({
    schema: registrationJsonSchema,
    registry: createRegistrationRegistry(ui),
    initial: { ...INITIAL },
    behavior: createRegistrationBehavior(ui),
  });
}

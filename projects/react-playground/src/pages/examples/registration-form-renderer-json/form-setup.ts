/**
 * Прямая сборка формы: модель, форма из JSON-схемы, реестр, render-behavior.
 *
 * Вынесено из компонента, чтобы в TSX остались только `JsonRendererProvider` и
 * `JsonFormRenderer`. Здесь нет ни одного React-хука — это чистая функция сборки,
 * которую компонент вызывает один раз (ленивый `useState`). Сборка модели/формы — одним
 * проходом через `createJsonForm` (§7).
 *
 * Данные (`model.ts`), поведение рендера (`render-behavior.ts`) и реестр компонентов
 * (`registry.tsx`) лежат отдельно, потому что ими же пользуется запись реестра форм
 * (`form-entry.ts`). Здесь остался только способ сборки — прямой, без реестра.
 */

import { signal } from '@reformer/core/signals';
import { createJsonForm, type JsonForm, type JsonFormSchema } from '@reformer/renderer-json';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { createRegistrationRegistry, type FormUiState } from './registry';
import { INITIAL, registrationBehavior } from './model';
import { createRegistrationRenderBehavior } from './render-behavior';
import rawJsonSchema from './json-schema.json';

// Операторы в чистом JSON типизируются как `string`, поэтому приведение — это и есть
// сценарий «схема пришла строкой с сервера». Параметр `<RegistrationFormData>` даёт
// `createJsonForm<T>` типобезопасность путей `$model(...)` при сборке (сам cast остаётся).
export const registrationJsonSchema =
  rawJsonSchema as unknown as JsonFormSchema<RegistrationFormData>;

/** Собранная форма регистрации: бандл {@link createJsonForm} (он же несёт render-behavior). */
export type RegistrationJsonForm = JsonForm<RegistrationFormData>;

/**
 * Собирает всё, что нужно рендереру. Вызывается один раз (ленивый `useState`) — повторный вызов
 * создал бы новый реестр и новый тип компонента `AsyncBoundary`, из-за чего загрузка префилла
 * стартовала бы заново.
 *
 * Render-behavior доклеивается к готовому бандлу, а не задаётся полем конфига: фабрика из конфига
 * вызывается ВНУТРИ `createJsonForm`, то есть до того, как появятся `form` и `model`, которые ей
 * нужны. У записи реестра этой сложности нет — там фабрику зовёт загрузчик уже с готовым бандлом.
 */
export function createRegistrationSetup(): RegistrationJsonForm {
  // `ui` здесь локальный: у прямой сборки реестр компонентов свой на каждый вызов, а значит
  // и сигналы могут быть свои. У записи реестра всё наоборот — см. комментарий в `form-entry.ts`.
  const ui: FormUiState = { status: signal<string | null>(null), pending: signal(false) };
  const registry = createRegistrationRegistry(ui);

  const jsonForm = createJsonForm<RegistrationFormData>({
    schema: registrationJsonSchema,
    registry,
    initial: { ...INITIAL },
    behavior: registrationBehavior,
  });

  return {
    ...jsonForm,
    renderBehavior: createRegistrationRenderBehavior(ui, jsonForm.form, jsonForm.model),
  };
}

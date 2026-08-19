/**
 * Форма регистрации как ЗАПИСЬ РЕЕСТРА ФОРМ.
 *
 * Соседний `form-setup.ts` остаётся образцом прямого использования `renderer-json`; отличие ровно
 * одно — здесь форма не собирается на странице, а объявляется записью, и страница просит смонтировать
 * её по `id`. Данные, поведение и реестр компонентов у обоих способов общие (`model.ts`,
 * `render-behavior.ts`, `registry.tsx`), поэтому разъехаться они не могут.
 *
 * **Ограничение: одна смонтированная копия за раз.** `FormEntry.registry` — это `CodeSource`
 * ЭКЗЕМПЛЯРА, а не фабрики, поэтому реестр компонентов создаётся один раз на модуль. Внутри него
 * `createPendingButton(ui.pending)` порождает ТИП React-компонента: пересоздавать его на каждый
 * монтаж нельзя — React ремонтировал бы поддерево (по той же причине рядом `AsyncBoundary`
 * зарегистрирован ссылкой). Отсюда модульный `ui` — и отсюда же ограничение: две одновременно
 * смонтированные копии этой формы разделят `pending` и текст статуса. Для витрины с вкладками это
 * не проблема; если понадобится показывать копии рядом, реестр придётся параметризовать.
 * Протечка состояния МЕЖДУ монтажами закрыта сбросом в `createRegistrationRenderBehavior`.
 *
 * @module react-playground/examples/registration-form-renderer-json/form-entry
 */

import { signal } from '@reformer/core/signals';
import type { DataSource, FormEntry } from '@reformer/form-registry';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { createRegistrationRegistry, type FormUiState } from './registry';
import { INITIAL, createRegistrationModel, registrationBehavior } from './model';
import { createRegistrationRenderBehavior } from './render-behavior';
import { registrationJsonSchema } from './form-setup';

/** UI-состояние отправки, общее на модуль. Почему так — см. заголовок модуля. */
const ui: FormUiState = { status: signal<string | null>(null), pending: signal(false) };

/** Реестр компонентов — тоже один на модуль: он замыкает `ui` и порождает тип `PendingButton`. */
const registry = createRegistrationRegistry(ui);

/**
 * Запись реестра с заданным источником схемы.
 *
 * @param id - Идентификатор записи. Разные источники одной формы обязаны иметь разные `id` (или
 *   версии): `FormOutlet` монтирует поддерево с ключом `id@version`, и без этого переключение
 *   источника не пересоздало бы форму. Разными выходят и ключи кэша.
 * @param schema - Откуда взять схему: из бандла (`inline`) или по сети (`http`).
 */
export function makeRegistrationEntry(
  id: string,
  schema: DataSource<JsonFormSchema<RegistrationFormData>>
): FormEntry<RegistrationFormData> {
  return {
    id,
    version: '1.0.0',
    owner: 'react-playground',

    // Данные.
    schema,
    // `initial` и `model` заданы ОБА намеренно. `initial` нужен preflight-проверке
    // `unmaterialized-model-paths` — без него она молча не запускается, а именно она ловит самый
    // коварный класс поломок (нет поля в модели → нет сигнала → ошибки валидации тихо исчезают).
    // Собирать форму загрузчик всё равно будет фабрикой: она отдаёт свежую модель на каждый монтаж,
    // тогда как из `initial` модель строилась бы от одного и того же объекта.
    initial: { kind: 'inline', value: INITIAL },
    model: { kind: 'inline', value: createRegistrationModel },

    // Код.
    registry: { kind: 'inline', value: registry },
    behavior: { kind: 'inline', value: registrationBehavior },
    // Валидация записи НЕ задаётся: `FormEntry.validation` ждёт форму `{ steps, extras }`
    // (пошаговая), а здесь валидация — `ValidationSchema`, которую прогоняет `validateModel` на
    // submit. Она строится внутри render-behavior, где есть модель.
    renderBehavior: {
      kind: 'inline',
      value: (form, model) => createRegistrationRenderBehavior(ui, form, model),
    },

    meta: {
      name: 'Регистрация (реестр форм)',
      description: 'Форма регистрации из JSON-схемы, смонтированная через реестр форм',
      tags: ['renderer-json', 'form-registry', 'validation', 'async-boundary'],
    },
  };
}

/** Запись со схемой из бандла — источник по умолчанию. */
export const registrationFormEntry: FormEntry<RegistrationFormData> = makeRegistrationEntry(
  'registration-form',
  { kind: 'inline', value: registrationJsonSchema }
);

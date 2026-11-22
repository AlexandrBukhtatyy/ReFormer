---
id: locale
title: Локализация cdk
sidebar_label: Локализация
description: Строки, которые cdk произносит сам, и загрузчик loadCdkLocale для I18nProvider.
---

# Локализация cdk

Компоненты cdk не рисуют видимого текста — подписи кнопок, заголовки и пустые состояния пишете вы.
Но несколько строк cdk произносит сам: статусы для скринридера, подписи кнопок без текста, текст
ошибки загрузки. Вход `@reformer/cdk/locale` отдаёт их на английском и русском для `I18nProvider`.

## Когда нужно

- Приложение работает не на английском: без провайдера cdk говорит по-английски («Remove file
  a.png», «Step 2 of 3»).
- Вы используете cdk без `@reformer/ui-kit`. С китом нужен `loadKitLocale` из
  `@reformer/ui-kit/locale`: он уже включает ядро и cdk.

## Минимальный пример

```tsx
import { createLocaleLoader } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { loadCdkLocale } from '@reformer/cdk/locale';

// Константа модуля: загрузчик хранит кэш языков.
const loadLocale = createLocaleLoader([loadCdkLocale]);

<I18nProvider lang="ru" load={loadLocale}>
  <App />
</I18nProvider>;
```

Локаль cdk накопительная: в ней словарь ядра (тексты замечаний валидации, единицы размера файла)
плюс строки cdk. Ставить `loadCoreLocale` рядом с ней не нужно.

## Что cdk произносит сам

| Компонент                       | Что                                                                 | Ключи                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `FileUpload`                    | Статусы для скринридера: файл добавлен, отклонён, удалён, загружен… | `cdk.fileUpload.added`, `rejected`, `removed`, `cleared`, `uploaded`, `uploadAborted`, `uploadFailed`         |
| `FileUpload`                    | `aria-label` кнопок удаления и повтора у файла                      | `cdk.fileUpload.removeFile`, `cdk.fileUpload.retryUpload`                                                     |
| `FileUpload`                    | Размер файла в `FileUpload.ItemSize`                                | `format.fileSize.*` (словарь ядра)                                                                            |
| `AsyncBoundary`                 | Текст ошибки, когда отказ не несёт своего                           | `cdk.asyncBoundary.unknownError`                                                                              |
| `FormWizard`                    | Статус для скринридера при смене шага: «Шаг N из M»                 | `cdk.formWizard.stepStatus` (параметры `current`, `total`)                                                    |
| `FormField`, `FieldArray.Error` | Тексты замечаний валидации                                          | `validation.<code>` (словарь ядра); поверх — словарь формы, см. [Тексты замечаний](./validation-messages.mdx) |

У `Autocomplete`, `List`, `FieldArray` (кроме текста замечаний) своих строк нет.

## Три вида одной локали

| Вид               | Импорт                                    | Для чего                                         |
| ----------------- | ----------------------------------------- | ------------------------------------------------ |
| загрузчик         | `loadCdkLocale` из `@reformer/cdk/locale` | основной путь: чанк языка грузится по запросу    |
| JSON-файл         | `@reformer/cdk/locale/ru.json`            | выложить на свой сервер и править без пересборки |
| синхронный модуль | `ru` из `@reformer/cdk/locale/ru`         | SSR и тесты                                      |

Синхронный модуль передают провайдеру готовым объектом:

```tsx
import { I18nProvider } from '@reformer/core/react';
import { ru } from '@reformer/cdk/locale/ru';

<I18nProvider locale={ru}>
  <App />
</I18nProvider>;
```

## Другие языки

Встроены `en` и `ru` (список — `CDK_LOCALES`). Для остальных языков `loadCdkLocale` отдаёт `null`, и
строки cdk остаются английскими. Свой язык добавляет второй источник в списке загрузчика —
например, JSON с вашего сервера:

```ts
import { createLocaleLoader, fetchMessages } from '@reformer/core/i18n';
import { loadCdkLocale } from '@reformer/cdk/locale';

const loadLocale = createLocaleLoader([
  loadCdkLocale,
  fetchMessages((code) => `/locales/${code}.json`), // { "cdk.formWizard.stepStatus": "…", … }
]);
```

## Подводные камни

- **Смена языка переводит уже показанное.** Статус в регионе `FileUpload` хранится ключом, подписи
  кнопок вычисляются при рендере — список файлов при этом не перемонтируется. Исключение — текст
  ошибки `AsyncBoundary`: он берётся в момент отказа.
- **Чистые функции языка не знают.** `formatFileSize(1536)` всегда отдаёт `'1.5 KB'`,
  `defaultToError({})` — `'Unknown error'`. Размер на языке пользователя —
  `useI18n().fileSize(bytes)` из `@reformer/core/react`.
- **Загрузчик — константа модуля.** Созданный в рендере `createLocaleLoader` теряет кэш языков.

## См. также

- [Локализация](/docs/guides/localization) — языки, провайдер и словари ядра, cdk и кита.
- [Тексты замечаний](./validation-messages.mdx) — словарь формы поверх локали.
- [FileUpload](./file-upload.mdx), [AsyncBoundary](./async-boundary.mdx), [FormWizard](./form-wizard.mdx) —
  компоненты со своими строками.

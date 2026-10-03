# Overview

`@reformer/cdk` provides headless UI components for `@reformer/core` forms.

## Key Concepts

- **Headless**: No default UI or styles - you build the interface
- **Compound Components**: Composable, declarative API
- **Render Props**: Children as function for full control
- **Context-based**: State shared via React Context

## Components

| Component       | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `AsyncBoundary` | Data-loading UI states (idle / loading / ready / error)   |
| `Autocomplete`  | Free-text input with suggestions (static or async source) |
| `FormArray`     | Manage dynamic form arrays                                |
| `FormField`     | Accessible field anatomy (label/control/…)                |
| `FormWizard`    | Multi-step form wizard                                    |

## Installation

```bash
npm install @reformer/cdk @reformer/core
```

## Import Patterns

```typescript
// All components
import { AsyncBoundary, FormArray, FormField, FormWizard } from '@reformer/cdk';

// Tree-shaking (recommended)
import { AsyncBoundary, useAsyncBoundary } from '@reformer/cdk/async-boundary';
import { Autocomplete, useAutocomplete } from '@reformer/cdk/autocomplete';
import { useResourceOptions, type ResourceConfig } from '@reformer/cdk/option-source';
import { FormArray, useFormArray } from '@reformer/cdk/form-array';
import { FormField, useFormField } from '@reformer/cdk/form-field';
import { FormWizard, useFormWizard } from '@reformer/cdk/form-wizard';
import { FileUpload, useFileUpload } from '@reformer/cdk/file-upload';
import { loadCdkLocale } from '@reformer/cdk/locale';
```

## Localization

cdk — headless: видимый текст пишет приложение. Но несколько строк cdk произносит сам, и они
идут через локаль `I18nProvider` из `@reformer/core/i18n`:

| Что                                                                                                                                          | Ключи словаря                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Статусы `FileUpload` для скринридера (aria-live): файл добавлен, отклонён, удалён, загружен, загрузка прервана или не удалась, список очищен | `cdk.fileUpload.added`, `rejected`, `removed`, `uploaded`, `uploadAborted`, `uploadFailed`, `cleared` |
| `aria-label` кнопок удаления и повтора у файла                                                                                               | `cdk.fileUpload.removeFile`, `cdk.fileUpload.retryUpload`                                             |
| Текст ошибки `AsyncBoundary` / `useAsyncResource`, когда отказ не несёт своего текста                                                        | `cdk.asyncBoundary.unknownError`                                                                      |
| Размер файла в `FileUpload.ItemSize`                                                                                                         | `format.fileSize.*` (словарь ядра)                                                                    |
| Тексты ошибок валидации в `FormField`                                                                                                        | `validation.<code>` (словарь ядра)                                                                    |

- **Без провайдера cdk говорит по-английски** («Remove file a.png», «1.5 KB»). Русский и любой
  другой язык включает `I18nProvider`.
- **Смена языка переводит и уже показанное**: статус в aria-live хранится ключом, а не готовой
  строкой, подписи кнопок получаются при рендере — список файлов при этом не перемонтируется.
- **Локаль cdk накопительная** — словарь ядра плюс строки cdk — и отдаётся в трёх видах:

| Вид               | Импорт                                    | Для чего                                        |
| ----------------- | ----------------------------------------- | ----------------------------------------------- |
| загрузчик         | `loadCdkLocale` из `@reformer/cdk/locale` | основной путь: чанк языка по запросу            |
| JSON-файл         | `@reformer/cdk/locale/ru.json`            | выложить на свой сервер, править без пересборки |
| синхронный модуль | `ru` из `@reformer/cdk/locale/ru`         | SSR и тесты                                     |

```tsx
import { createLocaleLoader, I18nProvider } from '@reformer/core/i18n';
import { loadCdkLocale } from '@reformer/cdk/locale';

// Константа модуля: загрузчик хранит кэш языков.
const loadLocale = createLocaleLoader([loadCdkLocale]);

<I18nProvider lang="ru" load={loadLocale}>
  <App />
</I18nProvider>;
```

Приложению с `@reformer/ui-kit` вместо него нужен `loadKitLocale` из `@reformer/ui-kit/locale`: он
включает и ядро, и cdk.

Встроенные языки — `en` и `ru`; для остальных `loadCdkLocale` отдаёт `null`, и строки cdk
остаются английскими, пока приложение не даст их своим источником (вторым в списке
`createLocaleLoader`).

Чистые функции языка не знают и отдают английский: `formatFileSize(1536)` → `'1.5 KB'`,
`defaultToError({})` → `'Unknown error'`. Размер по языку — `useI18n().fileSize(bytes)`.

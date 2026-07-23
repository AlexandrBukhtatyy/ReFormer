# File Upload: CDK headless + ui-kit варианты

## Context

В CDK и UI-Kit нет компонента выбора/загрузки файлов — ниша полностью свободна (в ui-kit есть только презентационный `Attachment` — порт shadcn AI-примитива без логики и field-версии). Проведено исследование экосистемы (Ant Design, PrimeReact, Mantine, MUI, Ark UI/Zag.js, react-dropzone, react-aria, Uppy, FilePond) и платформенных API (input[type=file], DnD, clipboard, стратегии загрузки).

**Принятые решения (подтверждены пользователем):**

1. **Контракт «выбор + опциональный uploader»**: база — selection-manager (value = `File[]`, без сети, как современный консенсус Ark UI/react-dropzone). Опционально инжектируется `uploader(file, {onProgress, signal}) => Promise<RemoteFileRef>` — включает immediate-режим: value = сериализуемые дескрипторы (нужно для renderer-json и черновиков — `File` не сериализуется в JSON), появляются progress/retry/abort.
2. **Слои**: сначала CDK headless-компонент, который хранит ВСЁ поведение; поверх — ui-kit варианты.
3. **UI-варианты v1**: кнопка-триггер, dropzone, avatar — все три, плюс возможность собирать кастомные варианты из CDK-частей.

**Референсы:** машина Zag.js/Ark UI file-upload (states только idle/focused/dragging, загрузка вне машины, анатомия parts); стиль CDK — свежий `AsyncBoundary` (React-free редьюсер + хук + prop-getters + compound-слоты + императивный handle).

## Ключевые решения дизайна

| Вопрос | Решение |
|---|---|
| Модель значения | Внутри CDK — `FileUploadItem[]` (discriminated union по `status`); наружу в seam — проекция: без uploader → `File[]`, с uploader → `RemoteFileRef[]` (только `uploaded`); пустой список эмитится как `null`, чтобы `required()` работал без изменений |
| Коды ошибок | camelCase по репо-конвенции (`maxFiles`, `fileType`, `maxFileSize`, `minFileSize`, `maxTotalFileSize`, `minFiles`, `fileExists`, `fileInvalid`, `uploadFailed`, `uploadAborted`) — одна таблица `createMessageResolver` обслуживает и core-валидацию, и onReject |
| Accept-матчер | Одна реализация `matchesFileAccept` в `@reformer/core` (рядом с валидаторами), CDK импортирует её (core уже peer-dep CDK) |
| SSR / duck-typing | `isFileLike(v)` вместо `instanceof File`; валидаторы работают и с `File`, и с `RemoteFileRef`; обращения к `URL`/`document` — только в эффектах/колбэках |
| ui-kit диспетчер | `FileUploadField` с `variant: 'button' \| 'dropzone'` (registry `FileUpload`, multi-value) + отдельный `FileUploadAvatarField` (registry `FileUploadAvatar`, single-value `File \| RemoteFileRef \| null` → другой адаптер → отдельная props-схема) |
| Удаление vs abort | удаление item во время загрузки → abort + удалить; явный `abort(key)` → item в `error` c `uploadAborted` (retry доступен) |
| Дефолтный uploader | НЕ делаем — только контракт (инжекция). Progress в реальных реализациях — XHR (fetch не умеет надёжно), но это забота консумента |
| v1 включает | click-пикер, DnD, paste (opt-in `allowPaste`), capture, полный uploader-lifecycle, превью через managed objectURL |
| v2 (вне объёма) | `webkitdirectory` + обход папок (`webkitGetAsEntry`), chunked/resumable, `transformFiles` (сжатие), drag-reorder, magic-bytes валидация |

## Контракты типов (CDK)

`packages/reformer-cdk/src/components/file-upload/types.ts`:

```ts
export interface RemoteFileRef {
  id: string;
  name: string;
  url?: string;
  size?: number;
  type?: string;
  meta?: Record<string, string | number | boolean | null>; // сериализуемо, совместимо с FormValue
}

export interface FileError { code: string; message: string; params?: Record<string, unknown> }
export interface FileRejection { file: File; errors: FileError[] }

/** key — стабильный uid (name+size+lastModified+счётчик) */
export type FileUploadItem =
  | { key: string; status: 'local';     file: File }
  | { key: string; status: 'uploading'; file: File; progress: number }        // 0..100
  | { key: string; status: 'uploaded';  file?: File; remote: RemoteFileRef }  // file нет у preloaded
  | { key: string; status: 'error';     file: File; error: FileError; progress?: number };

export type FileUploadValue = File[] | RemoteFileRef[] | null;

export type FileUploadUploader = (
  file: File,
  ctx: { onProgress: (percent: number) => void; signal: AbortSignal }
) => Promise<RemoteFileRef>;

export interface UseFileUploadOptions {
  // seam (controlled)
  value?: FileUploadValue;
  onChange?: (value: FileUploadValue) => void;
  onBlur?: () => void;
  disabled?: boolean;
  // отбор
  accept?: string;              // native-синтаксис; применяется и к DnD через матчер
  multiple?: boolean;           // default false; false → новая селекция ЗАМЕНЯЕТ, maxFiles=1
  maxFiles?: number;
  maxFileSize?: number;         // байты
  minFileSize?: number;
  maxTotalFileSize?: number;
  preventDuplicates?: boolean;  // fileExists по name+size, default true
  validate?: (file: File, ctx: { existing: FileUploadItem[] }) => FileError[] | null;
  // взаимодействие
  allowDrop?: boolean;          // default true
  allowPaste?: boolean;         // default false
  capture?: 'user' | 'environment';
  // uploader-режим
  uploader?: FileUploadUploader;
  autoUpload?: boolean;         // default true (при наличии uploader)
  // события
  onFilesChange?: (items: FileUploadItem[]) => void;
  onAccept?: (files: File[]) => void;
  onReject?: (rejections: FileRejection[]) => void;
  onUploadSuccess?: (item: Extract<FileUploadItem, { status: 'uploaded' }>) => void;
  onUploadError?: (item: Extract<FileUploadItem, { status: 'error' }>) => void;
  id?: string;
}

export interface FileUploadHandle {
  openFilePicker(): void;
  addFiles(files: File[]): void;
  removeItem(key: string): void;
  clear(): void;
  retry(key: string): void;
  abort(key?: string): void;
  focus(): void; // hidden input — для «сфокусировать невалидное поле»
}
```

`file-upload-core.ts` — чистый React-free модуль (по образцу `async-resource.ts`): `fileUploadReducer` + `initialFileUploadState` (state: `{ items, rejections }`), actions `add/remove/clear/upload-start/upload-progress/upload-success/upload-error/retry/sync-value`; чистые функции `selectFiles(candidates, opts, existing)` (accept/size/total/maxFiles/duplicates/validate → `{accepted, rejected}`), `projectValue(items, mode)` (`local` → все File | null; `remote` → только uploaded RemoteFileRef | null), `reconcileItems(items, value, mode)` (local — по ссылке File; remote — по `remote.id`; незнакомый ref → `uploaded` без file — сценарий preloaded при редактировании), `fileItemKey`, `formatFileSize`.

`useFileUpload(options)` возвращает:

- **состояние**: `items`, `rejections`, `dragging` (drag-counter, не boolean — от мерцания dragleave), `focused`, `disabled`, `maxFilesReached`, `uploading`;
- **действия**: `openFilePicker`, `addFiles`, `removeItem`, `clear`, `retry`, `abort`, `getPreviewUrl(key)` (managed objectURL: lazy create, revoke при удалении/unmount);
- **prop-getters**: `getRootProps`, `getDropzoneProps` (role=button, tabIndex, Enter/Space → пикер, dragenter/over/leave/drop с preventDefault, опц. onPaste), `getTriggerProps`, `getHiddenInputProps` (visually hidden input; после change → `addFiles` + `input.value=''` — иначе повторный выбор того же файла не сработает; onCancel), `getItemGroupProps` (role=list), `getItemProps`, `getItemDeleteTriggerProps` (aria-label «Удалить файл X»), `getItemRetryTriggerProps`, `getClearTriggerProps`, `getLiveRegionProps` (aria-live=polite) + `liveMessage`, `ids`.

Внутренности: `useReducer`; `mode = uploader ? 'remote' : 'local'`; controlled-sync через эффект на `options.value` с guard `lastEmittedRef` (защита от эха собственного onChange); очередь загрузки — эффект «есть local + uploader + autoUpload» с `Map<key, AbortController>` в ref, throttled progress (~100мс); `AbortError` при удалении item — не ошибка.

**Compound-слоты** (тонкие обёртки над Context, стиль AsyncBoundary): `FileUpload.Root` (props = options + ref FileUploadHandle; сам рендерит hidden input и live region), `.Trigger` (asChild), `.Dropzone` (asChild), `.ItemGroup`, `.Item` (per-item Context `{item, previewUrl}`), `.ItemPreview`, `.ItemName`, `.ItemSize`, `.ItemProgress` (role=progressbar), `.ItemDeleteTrigger`, `.ItemRetryTrigger`, `.ClearTrigger` + `useFileUploadContext`/`useFileUploadItemContext`.

## ui-kit

Адаптеры (локально в варианте, как selectAsyncAdapter):

```ts
// multi (button + dropzone): почти identity
const fileUploadAdapter: FieldAdapter = {
  valueProp: 'value', changeProp: 'onChange',
  fromEmit: (v) => (Array.isArray(v) && v.length > 0 ? v : null),
  toValue: (v) => v ?? null,
};
// avatar (single): File | RemoteFileRef | null ↔ массив длины 1
const fileUploadSingleAdapter: FieldAdapter = {
  valueProp: 'value', changeProp: 'onChange',
  fromEmit: (v) => (Array.isArray(v) ? (v[0] ?? null) : null),
  toValue: (v) => (v == null ? null : [v]),
};
```

Rich handle: `FileUploadFieldHandle extends FieldHandle { openFilePicker(); clear(); abort(); }` — композит реализует сам через `useImperativeHandle` → `withFormControl(..., { exposesHandle: true })` (как SelectAsyncField).

**Варианты** (все pure-компоненты controlled по seam, внутри используют `useFileUpload` из `@reformer/cdk/file-upload`; только токены темы, `data-slot`, `cn()`, lucide-иконки):

- **base (button)**: `Button` «Выбрать файлы» + список на существующем `Attachment`/`AttachmentGroup` (маппинг: `local→idle/done`, `uploading→uploading`, `error→error`, `uploaded→done`); `AttachmentMedia` — превью image/* или иконка по типу; `AttachmentActions` — retry/delete. Общий список — `variants/base/file-upload-item-list.tsx`, переиспользуется dropzone-вариантом.
- **dropzone**: рамка `border-dashed rounded-xl bg-card`, `data-[dragging]:border-ring data-[dragging]:bg-muted/50`, `aria-invalid:border-destructive`; текст + hint из accept/maxFileSize; ниже тот же ItemList.
- **avatar**: одиночный круглый/квадратный preview, клик по превью → пикер, оверлей заменить/удалить, default `accept="image/*"`, `multiple=false`.

**Props-схемы**: `file-upload-base.props.ts` (`x-registryName: 'FileUpload'`; `variant: 'button' | 'dropzone'` default `'button'`, accept, multiple, maxFiles, maxFileSize, minFileSize, maxTotalFileSize, allowDrop, allowPaste, className; `x-runtimeProps`: value, onChange, `uploader` — функция через реестр, по образцу `resource` в select-async.props.ts, onReject); `file-upload-avatar.props.ts` (`x-registryName: 'FileUploadAvatar'`, single value, `shape: 'circle' | 'square'`). Диспетчер `file-upload-field.tsx` — по образцу [input-field.tsx](packages/reformer-ui-kit/src/components/input/input-field.tsx).

## Валидаторы core

`packages/reformer/src/form/validation/validators/` — фабрики по шаблону [max-length.ts](packages/reformer/src/form/validation/validators/max-length.ts) (пустые значения пропускаются, `code` + `params`, `message: options?.message ?? 'invalid'`), duck-typed через `isFileLike` (работают с `File`, `RemoteFileRef` и массивами обоих; `RemoteFileRef` без `size` size-валидаторы пропускают):

| Файл | Фабрика | code | params |
|---|---|---|---|
| `file-utils.ts` | `isFileLike`, `matchesFileAccept` (экспорт для CDK) | — | — |
| `max-file-size.ts` | `maxFileSize(bytes)` | `maxFileSize` | `{maxFileSize, fileName, actualSize}` |
| `min-file-size.ts` | `minFileSize(bytes)` | `minFileSize` | аналогично |
| `file-type.ts` | `fileType(accept)` | `fileType` | `{accept, fileName}` |
| `max-files.ts` | `maxFiles(n)` | `maxFiles` | `{maxFiles, actualCount}` |
| `min-files.ts` | `minFiles(n)` | `minFiles` | `{minFiles, actualCount}` |
| `max-total-file-size.ts` | `maxTotalFileSize(bytes)` | `maxTotalFileSize` | `{maxTotalFileSize, actualTotal}` |

RU-тексты новых кодов — в демо через `createMessageResolver` из `@reformer/cdk` (центральной таблицы в ui-kit нет).

## Файлы

**Создать — CDK** `packages/reformer-cdk/src/components/file-upload/`: `types.ts`, `file-upload-core.ts` (+test), `useFileUpload.ts` (+test), `FileUploadContext.tsx`, `FileUpload.tsx`, `FileUploadRoot.tsx`, `FileUploadTrigger.tsx`, `FileUploadDropzone.tsx`, `FileUploadItemGroup.tsx`, `FileUploadItem.tsx`, `FileUploadItemPreview.tsx`, `FileUploadItemName.tsx`, `FileUploadItemSize.tsx`, `FileUploadItemProgress.tsx`, `FileUploadItemDeleteTrigger.tsx`, `FileUploadItemRetryTrigger.tsx`, `FileUploadClearTrigger.tsx`, `FileUpload.test.tsx`, `index.ts`.

**Изменить — CDK** (exports здесь РУЧНЫЕ): `package.json` (`exports['./file-upload']`), `vite.config.ts` (entry), `src/index.ts`.

**Создать — core**: 7 файлов валидаторов (+тесты); **изменить**: `validators/index.ts` (+ реэкспорт в `validation/index.ts`).

**Создать — ui-kit** `packages/reformer-ui-kit/src/components/file-upload/`: `index.ts`, `file-upload-field.tsx`, тесты (`file-upload.test.tsx`, `file-upload.props.test.ts`), `variants/base/{file-upload-base.tsx, .field.tsx, .props.ts, file-upload-item-list.tsx}`, `variants/dropzone/{file-upload-dropzone.tsx, .field.tsx}` (без своей схемы — вариант через enum), `variants/avatar/{file-upload-avatar.tsx, .field.tsx, .props.ts}`.

**Генерация — ui-kit** (НЕ руками): `npm run generate:barrels` → `package.json#exports`, `src/index.ts`, `src/meta.ts` (props-схемы подхватятся глобом → `defaultPropSchemas` → renderer-json/MCP видят автоматически).

**Playground/e2e**: `projects/react-playground/src/pages/examples/file-upload/FileUploadDemo.tsx` (3 варианта, mock-uploader с прогрессом и рандомной ошибкой для retry, preloaded-сценарий `RemoteFileRef[]`, `ValidationMessagesProvider`, testId по конвенции) + маршрут в `App.tsx`; `projects/react-playground-e2e/tests/pages/file-upload/file-upload.spec.ts`; скриншоты в `projects/react-playground-e2e/screenshots/file-upload/`.

## Этапы (каждый — отдельный, самодостаточный)

1. **core: file-валидаторы + матчер** (без зависимостей). Верификация: `npm test` в packages/reformer.
2. **CDK file-upload**: 2а — types + core-модуль + тесты редьюсера (чистые, без DOM); 2б — `useFileUpload` + jsdom-тесты (выбор через change hidden input, замена в single, очистка input.value, reject-коды, uploader happy-path/error/retry/abort на fake-промисах, revoke URL — мок `URL.createObjectURL`); 2в — слоты + exports. Верификация: `npm test`, `npm run build` в reformer-cdk.
3. **ui-kit**: base → dropzone → avatar → диспетчер → тесты → `generate:barrels` → `check:packaging`.
4. **Демо + e2e**: страница, маршрут, spec (`page.setInputFiles` в hidden input, DnD через DataTransfer, reject больших файлов, progress/retry, preloaded, a11y: фокус dropzone, Enter открывает пикер, aria-live), скриншоты.

v2 (вне объёма): папки, chunked, transformFiles, drag-reorder, magic-bytes.

## Риски

1. **Цикл controlled-sync** (onChange → value → reconcile → onChange) — guard `lastEmittedRef`, reconcile по identity, тест «эхо не мутирует items».
2. **Утечки objectURL** — revoke централизован в одном ref-Map; ItemPreview никогда не создаёт URL сам; тест на revoke при remove/clear/unmount.
3. **Черновики в uploader-режиме** — в value только `uploaded`; items в `uploading/error` при сериализации теряются (осознанно: не догружен = нет); демо показывает блокировку submit по `uploading`.
4. **SSR** — core-модуль без DOM, browser-API только в эффектах/колбэках.
5. **Повторный выбор того же файла** — обязательный `input.value = ''` после change.
6. **Расхождение props-схем и реальности** — `file-upload.props.test.ts` сверяет enum variant и registry-имена.

## Верификация (сквозная)

- Unit: reformer (валидаторы), reformer-cdk (редьюсер без DOM + хук/слоты jsdom), ui-kit (варианты + props-схемы + package-exports).
- `npm run build` cdk и ui-kit; `check:packaging` ui-kit.
- E2E playwright: file-upload.spec.ts (выбор/замена/удаление/clear, reject, progress/retry/abort, preloaded, a11y), скриншоты в `screenshots/file-upload/`.
- renderer-json: демо-registry `reg.component('FileUpload', FileUploadField)` + `mcp__reformer__validate_json_schema` на демо-схеме.

## Эталонные файлы

- [useAsyncBoundary.ts](packages/reformer-cdk/src/components/async-boundary/useAsyncBoundary.ts) — эталон хука с prop-getters и React-free ядром
- [with-form-control.tsx](packages/reformer-ui-kit/src/fields/with-form-control.tsx) — HOC/адаптеры/exposesHandle
- [attachment-base.tsx](packages/reformer-ui-kit/src/components/attachment/variants/base/attachment-base.tsx) — визуальный кирпич списка файлов
- [max-length.ts](packages/reformer/src/form/validation/validators/max-length.ts) — шаблон фабрик валидаторов
- [input-field.tsx](packages/reformer-ui-kit/src/components/input/input-field.tsx) — образец variant-диспетчера

# FileUpload

Headless-компонент выбора и загрузки файлов: кнопка, зона drag-and-drop, вставка из буфера,
список файлов с прогрессом, повтором и удалением. Разметки и стилей не рендерит — кроме скрытого
`<input type="file">` и `aria-live`-региона статусов. Готовые поля формы на его основе —
`FileUploadBase`, `FileUploadDropzone`, `FileUploadInput`, `FileUploadAvatar` из
`@reformer/ui-kit/file-upload`.

```typescript
import { FileUpload, useFileUpload, type FileUploadHandle } from '@reformer/cdk/file-upload';
```

## Значение, отбор файлов, слоты и доступность

### Два режима значения

| Режим         | Когда                 | Значение поля                                                         |
| ------------- | --------------------- | --------------------------------------------------------------------- |
| **deferred**  | `uploader` не задан   | `File[]`; отправить файлы на сервер — забота приложения при отправке  |
| **immediate** | `uploader` задан      | `RemoteFileRef[]` — только успешно загруженные, сериализуются в JSON  |

Пустой список отдаётся как `null`, поэтому `required()` работает без доработок.
`RemoteFileRef` — `{ id, name, url?, size?, type?, meta? }`: его переживают черновики, JSON-схема
и восстановление формы при редактировании.

Загрузчик — функция приложения, своей реализации у пакета нет:

```typescript
type FileUploadUploader = (
  file: File,
  ctx: { onProgress: (percent: number) => void; signal: AbortSignal }
) => Promise<RemoteFileRef>;
```

Загрузчик обязан прерывать запрос по `signal` (удаление файла и `abort()` его отменяют).

### Связь с полем формы

`FileUpload.Root` принимает шов поля — `value`, `onChange`, `onBlur`, `disabled`. В схеме формы
обычно стоит готовое поле ui-kit; с cdk напрямую шов подключают через `useFormControl`:

```tsx
import type { FormControl } from '@reformer/core';
import { useFormControl } from '@reformer/core/react';
import { FileUpload, type FileUploadValue } from '@reformer/cdk/file-upload';

function DocumentsField({ control }: { control: FormControl<FileUploadValue> }) {
  const { value, disabled } = useFormControl(control);
  return (
    <FileUpload.Root
      value={value}
      onChange={(next) => control.setValue(next)}
      onBlur={() => control.markAsTouched()}
      disabled={disabled}
      accept=".pdf,image/*"
      multiple
      maxFiles={3}
      maxFileSize={10 * 1024 * 1024}
    >
      <FileUpload.Dropzone aria-label="Документы: PDF или изображение, до 10 МБ, не больше 3">
        Перетащите файлы или нажмите
      </FileUpload.Dropzone>
      <FileUpload.ItemGroup>
        {(item) => (
          <FileUpload.Item key={item.key} item={item}>
            <FileUpload.ItemName />
            <FileUpload.ItemSize />
            <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
          </FileUpload.Item>
        )}
      </FileUpload.ItemGroup>
    </FileUpload.Root>
  );
}
```

Правила на значение поля — обычные правила ядра из `@reformer/core/validators`: `required()`,
`maxFiles(n)`, `minFiles(n)`, `maxFileSize(bytes)`, `minFileSize(bytes)`,
`maxTotalFileSize(bytes)`, `fileType(accept)`.

### Отбор файлов

Опции `Root` (они же — опции `useFileUpload`):

| Опция                                                   | Что делает                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `accept`                                                | Типы в синтаксисе нативного `accept`; действует и на drop/paste                   |
| `multiple`                                              | Несколько файлов. Без него новый выбор заменяет текущий (`@default false`)        |
| `maxFiles`, `maxFileSize`, `minFileSize`, `maxTotalFileSize` | Лимиты; размеры в байтах                                                     |
| `preventDuplicates`                                     | Отклонять файл с тем же `name` и `size` (`@default true`)                         |
| `validate(file, { existing })`                          | Своя проверка: массив ошибок или `null`                                           |
| `allowDrop` / `allowPaste`                              | Каналы ввода (`@default true` / `false`)                                          |
| `capture`                                               | Камера мобильного пикера: `'user'` или `'environment'`                            |
| `uploader`, `autoUpload`                                | Загрузка при выборе (`autoUpload` — `@default true`; при `false` — `upload()`)    |

Отклонённые файлы в значение не попадают: они уходят в `onReject(rejections)` и в
`rejections` хука. Ошибка — `ValidationIssue` с кодом, без текста: `fileType`, `maxFileSize`,
`minFileSize`, `maxFiles`, `maxTotalFileSize`, `fileExists`, `uploadFailed`, `uploadAborted` или
код своей `validate`. Текст даёт `useIssueMessageResolver()` — тот же резолвер, что у замечаний
валидации; в локали ядра есть ключи `validation.<код>`.

События: `onFilesChange(items)`, `onAccept(files)`, `onReject(rejections)`,
`onUploadSuccess(item)`, `onUploadError(item)`.

### Слоты

| Слот                       | Что рендерит                                                                |
| -------------------------- | --------------------------------------------------------------------------- |
| `FileUpload.Root`          | Контекст, скрытый `<input type="file">`, `aria-live`-регион                 |
| `FileUpload.Trigger`       | `<button>`, открывает пикер (`asChild` — свой элемент)                      |
| `FileUpload.Dropzone`      | `<div>`: drop и одновременно кнопка (клик, Enter, Space); `data-dragging`   |
| `FileUpload.ItemGroup`     | `<ul>`; `children` — функция `(item) => ReactNode`                          |
| `FileUpload.Item`          | `<li data-status="local / uploading / uploaded / error">`, проп `item`      |
| `FileUpload.ItemPreview`   | `<img>` для изображений, иначе `children` (фолбэк)                          |
| `FileUpload.ItemName`      | Имя файла                                                                   |
| `FileUpload.ItemSize`      | Размер по активной локали; без известного размера не рендерится             |
| `FileUpload.ItemProgress`  | Только в статусе `uploading`: `role="progressbar"`, `children(progress)`    |
| `FileUpload.ItemDeleteTrigger` | Удаляет файл, идущую загрузку прерывает                                 |
| `FileUpload.ItemRetryTrigger`  | Только в статусе `error`: повторяет загрузку                            |
| `FileUpload.ClearTrigger`  | Очищает список, прерывает загрузки; заблокирован на пустом списке           |

`<FileUpload>` — то же, что `<FileUpload.Root>`. Элемент списка (тип `FileUploadItemData`) —
объединение по `status`:
`local` (`file`), `uploading` (`file`, `progress`), `uploaded` (`remote`, `file?`), `error`
(`file`, `error`, `progress?`). `key` — стабильный ключ элемента, не индекс.

### Управление снаружи — ref

`ref` на `FileUpload.Root` даёт `FileUploadHandle`: `openFilePicker()`, `addFiles(files)`,
`removeItem(key)`, `clear()`, `retry(key)`, `upload(key?)`, `abort(key?)`, `focus()`.

`upload(key?)` — ручной запуск загрузки при `autoUpload: false`: принятые файлы ждут в статусе
`local`, пока их не отправит `upload()` (без `key` — все ожидающие). `retry(key)` в этом режиме
перезапускает загрузку сразу.

```tsx
const uploadRef = useRef<FileUploadHandle>(null);

<button type="button" onClick={() => uploadRef.current?.openFilePicker()}>Добавить</button>
<FileUpload.Root ref={uploadRef} value={value} onChange={setValue}>…</FileUpload.Root>;
```

### Хук без разметки

Хук без разметки — для своего набора элементов. Принимает те же опции, что `Root`, и отдаёт
состояние (`items`, `rejections`, `dragging`, `maxFilesReached`, `uploading`, `liveMessage`),
действия (`openFilePicker`, `addFiles`, `removeItem`, `clear`, `retry`, `upload`, `abort`, `focus`,
`getPreviewUrl`) и prop-getters (`getRootProps`, `getDropzoneProps`, `getTriggerProps`,
`getHiddenInputProps`, `getItemProps`, …). `uploading` — признак незавершённых загрузок: по нему
блокируют отправку формы.

### Доступность и локализация

- Скрытый `<input type="file">` — настоящий: `label`, клик и `focus()` работают нативно.
- Зона drop — ещё и кнопка: перетаскивание никогда не единственный способ выбрать файл.
- Ограничения в `aria-label` зоны пишет приложение — хук их текстом не формулирует.
- Статусы в `aria-live` (файл добавлен, отклонён, загружен, загрузка не удалась) и подписи кнопок
  удаления и повтора идут через локаль (`cdk.fileUpload.*`, см. Localization в обзоре cdk). Без
  `I18nProvider` — по-английски.

### Anti-patterns

- Класть `File` в модель формы, которую сохраняют черновиком или отправляют JSON: `File` не
  сериализуется. Нужна сериализация — задайте `uploader`, значением станут `RemoteFileRef`.
- Ждать, что отклонённый файл окажется в значении и правило `fileType` его покажет: отбор
  отклоняет файл до значения, ошибки — в `onReject` / `rejections`.
- Загрузчик без `signal`: удаление файла и `abort()` не прервут сетевой запрос — он дойдёт до
  сервера впустую.

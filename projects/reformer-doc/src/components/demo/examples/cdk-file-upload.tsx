import { useRef, useState } from 'react';
import {
  FileUpload,
  useFileUpload,
  type FileRejection,
  type FileUploadHandle,
  type FileUploadUploader,
  type FileUploadValue,
  type RemoteFileRef,
} from '@reformer/cdk/file-upload';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

const BOX: React.CSSProperties = { maxWidth: 440, width: '100%', display: 'grid', gap: 8 };

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  border: '1px solid var(--ifm-toc-border-color)',
  borderRadius: 6,
  fontSize: 13,
};

const ZONE: React.CSSProperties = {
  padding: 24,
  border: '2px dashed var(--ifm-toc-border-color)',
  borderRadius: 8,
  textAlign: 'center',
  cursor: 'pointer',
  fontSize: 14,
};

const MUTED: React.CSSProperties = { color: 'var(--ifm-color-emphasis-600)', fontSize: 13 };

/**
 * Загрузчик-имитация: прогресс по таймеру, файл с «fail» в имени падает на 60 %. Уважает `signal` —
 * удаление строки во время загрузки прерывает таймер.
 */
const demoUploader: FileUploadUploader = (file, { onProgress, signal }) =>
  new Promise<RemoteFileRef>((resolve, reject) => {
    let percent = 0;
    const fails = file.name.toLowerCase().includes('fail');
    const timer = setInterval(() => {
      percent += 15;
      if (fails && percent >= 60) {
        clearInterval(timer);
        reject(new Error('Сервер вернул 500'));
        return;
      }
      if (percent >= 100) {
        clearInterval(timer);
        resolve({ id: `${Date.now()}-${file.name}`, name: file.name, size: file.size });
        return;
      }
      onProgress(percent);
    }, 200);
    signal.addEventListener('abort', () => {
      clearInterval(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** Значение поля — то, что ушло бы в модель формы: `File[]` или дескрипторы `RemoteFileRef[]`. */
function ValueLine({ value }: { value: FileUploadValue }) {
  const names = (value ?? []).map((entry) => entry.name);
  return <p style={MUTED}>value: {names.length ? names.join(', ') : 'null'}</p>;
}

function DeferredDemo() {
  const [value, setValue] = useState<FileUploadValue>(null);
  return (
    <div style={BOX}>
      <FileUpload.Root
        value={value}
        onChange={setValue}
        accept=".pdf,image/*"
        multiple
        maxFiles={3}
      >
        <FileUpload.Trigger asChild>
          <Button variant="outline">Выбрать файлы</Button>
        </FileUpload.Trigger>
        <FileUpload.ItemGroup style={{ display: 'grid', gap: 6 }}>
          {(item) => (
            <FileUpload.Item key={item.key} item={item} style={ROW}>
              <FileUpload.ItemName style={{ flex: 1 }} />
              <FileUpload.ItemSize style={MUTED} />
              <FileUpload.ItemDeleteTrigger asChild>
                <Button variant="ghost" size="sm">
                  ×
                </Button>
              </FileUpload.ItemDeleteTrigger>
            </FileUpload.Item>
          )}
        </FileUpload.ItemGroup>
      </FileUpload.Root>
      <ValueLine value={value} />
    </div>
  );
}

function ImmediateDemo() {
  const [value, setValue] = useState<FileUploadValue>(null);
  return (
    <div style={BOX}>
      <FileUpload.Root value={value} onChange={setValue} multiple uploader={demoUploader}>
        <FileUpload.Dropzone style={ZONE}>
          Перетащите файлы или нажмите — файл с «fail» в имени упадёт
        </FileUpload.Dropzone>
        <FileUpload.ItemGroup style={{ display: 'grid', gap: 6 }}>
          {(item) => (
            <FileUpload.Item key={item.key} item={item} style={ROW}>
              <FileUpload.ItemName style={{ flex: 1 }} />
              <FileUpload.ItemProgress style={MUTED} />
              {item.status === 'error' && (
                <FileUpload.ItemRetryTrigger asChild>
                  <Button variant="outline" size="sm">
                    Повторить
                  </Button>
                </FileUpload.ItemRetryTrigger>
              )}
              <FileUpload.ItemDeleteTrigger asChild>
                <Button variant="ghost" size="sm">
                  ×
                </Button>
              </FileUpload.ItemDeleteTrigger>
            </FileUpload.Item>
          )}
        </FileUpload.ItemGroup>
      </FileUpload.Root>
      <ValueLine value={value} />
    </div>
  );
}

function HookDemo() {
  const [value, setValue] = useState<FileUploadValue>(null);
  const upload = useFileUpload({ value, onChange: setValue, multiple: true });
  return (
    <div style={BOX} {...upload.getRootProps()}>
      <input {...upload.getHiddenInputProps()} />
      <div
        {...upload.getDropzoneProps()}
        style={{ ...ZONE, borderColor: upload.dragging ? 'var(--ifm-color-primary)' : undefined }}
      >
        {upload.dragging ? 'Отпустите файлы' : 'Своя зона: перетащите или нажмите'}
      </div>
      <ul
        {...upload.getItemGroupProps()}
        style={{ margin: 0, padding: 0, display: 'grid', gap: 6 }}
      >
        {upload.items.map((item) => (
          <li key={item.key} {...upload.getItemProps(item)} style={ROW}>
            <span style={{ flex: 1 }}>
              {item.status === 'uploaded' ? item.remote.name : item.file.name}
            </span>
            <button {...upload.getItemDeleteTriggerProps(item)}>×</button>
          </li>
        ))}
      </ul>
      <span aria-live="polite" style={MUTED}>
        {upload.liveMessage}
      </span>
    </div>
  );
}

function RejectionsDemo() {
  const [value, setValue] = useState<FileUploadValue>(null);
  const [rejections, setRejections] = useState<FileRejection[]>([]);
  return (
    <div style={BOX}>
      <FileUpload.Root
        value={value}
        onChange={setValue}
        multiple
        accept="image/*"
        maxFileSize={200 * 1024}
        onReject={setRejections}
      >
        <FileUpload.Trigger asChild>
          <Button variant="outline">Только изображения до 200 КБ</Button>
        </FileUpload.Trigger>
      </FileUpload.Root>
      {rejections.map(({ file, errors }) => (
        <p key={file.name} style={{ ...MUTED, color: 'var(--ifm-color-danger)' }}>
          {file.name}:{' '}
          {errors.map((error) => `${error.code} ${JSON.stringify(error.params ?? {})}`).join('; ')}
        </p>
      ))}
      <ValueLine value={value} />
    </div>
  );
}

function RefDemo() {
  const [value, setValue] = useState<FileUploadValue>(null);
  const uploadRef = useRef<FileUploadHandle>(null);
  return (
    <div style={BOX}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="outline" onClick={() => uploadRef.current?.openFilePicker()}>
          Открыть пикер снаружи
        </Button>
        <Button variant="ghost" onClick={() => uploadRef.current?.clear()}>
          Очистить
        </Button>
      </div>
      <FileUpload.Root ref={uploadRef} value={value} onChange={setValue} multiple>
        <FileUpload.ItemGroup style={{ display: 'grid', gap: 6 }}>
          {(item) => (
            <FileUpload.Item key={item.key} item={item} style={ROW}>
              <FileUpload.ItemName />
            </FileUpload.Item>
          )}
        </FileUpload.ItemGroup>
      </FileUpload.Root>
      <ValueLine value={value} />
    </div>
  );
}

export const cdkFileUploadDocConfig: ComponentDocConfig = {
  name: 'FileUpload',
  importFrom: '@reformer/cdk/file-upload',
  description:
    'Headless compound-компонент выбора и загрузки файлов: отбор, drag-and-drop, прогресс, повтор и отмена. Разметку пишете сами.',
  variants: [
    {
      id: 'deferred',
      title: 'Deferred: кнопка и список',
      description:
        'Без uploader значение поля — File[]: файлы уходят на сервер при отправке формы. Отбор (accept, maxFiles, дубликаты) выполняет сам компонент.',
      render: DeferredDemo,
      code: `<FileUpload.Root value={value} onChange={setValue} accept=".pdf,image/*" multiple maxFiles={3}>
  <FileUpload.Trigger asChild>
    <Button variant="outline">Выбрать файлы</Button>
  </FileUpload.Trigger>
  <FileUpload.ItemGroup>
    {(item) => (
      <FileUpload.Item key={item.key} item={item}>
        <FileUpload.ItemName />
        <FileUpload.ItemSize />
        <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
      </FileUpload.Item>
    )}
  </FileUpload.ItemGroup>
</FileUpload.Root>`,
    },
    {
      id: 'immediate',
      title: 'Immediate: зона, прогресс, повтор',
      description:
        'С uploader файлы уходят на сервер сразу при выборе, значение поля — сериализуемые RemoteFileRef[] (только загруженные). Загрузчик обязан уважать signal.',
      render: ImmediateDemo,
      code: `const uploader: FileUploadUploader = async (file, { onProgress, signal }) => {
  // XHR с xhr.upload.onprogress, tus, presigned S3 — что угодно, возвращающее дескриптор
  return api.upload(file, { onProgress, signal }); // → { id, name, url?, size? }
};

<FileUpload.Root value={refs} onChange={setRefs} multiple uploader={uploader}>
  <FileUpload.Dropzone>Перетащите файлы или нажмите</FileUpload.Dropzone>
  <FileUpload.ItemGroup>
    {(item) => (
      <FileUpload.Item key={item.key} item={item}>
        <FileUpload.ItemName />
        <FileUpload.ItemProgress />
        {item.status === 'error' && <FileUpload.ItemRetryTrigger>Повторить</FileUpload.ItemRetryTrigger>}
        <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
      </FileUpload.Item>
    )}
  </FileUpload.ItemGroup>
</FileUpload.Root>`,
    },
  ],
  examples: [
    {
      id: 'hook',
      title: 'Хук useFileUpload',
      description:
        'Те же возможности без слотов: prop-getters навешивают обработчики, роли и aria на вашу разметку. Скрытый input и aria-live-регион вы рисуете сами.',
      render: HookDemo,
      code: `const upload = useFileUpload({ value, onChange: setValue, multiple: true });

<div {...upload.getRootProps()}>
  <input {...upload.getHiddenInputProps()} />
  <div {...upload.getDropzoneProps()}>
    {upload.dragging ? 'Отпустите файлы' : 'Перетащите или нажмите'}
  </div>
  <ul {...upload.getItemGroupProps()}>
    {upload.items.map((item) => (
      <li key={item.key} {...upload.getItemProps(item)}>
        {item.status === 'uploaded' ? item.remote.name : item.file.name}
        <button {...upload.getItemDeleteTriggerProps(item)}>×</button>
      </li>
    ))}
  </ul>
  <span aria-live="polite">{upload.liveMessage}</span>
</div>`,
    },
    {
      id: 'rejections',
      title: 'Отбор и отклонённые файлы',
      description:
        'Отклонённый файл в значение не попадает — уходит в onReject со всеми нарушениями сразу. У ошибки нет текста, только code и params, как у правил ядра: текст даёт словарь формы через useIssueMessageResolver.',
      render: RejectionsDemo,
      code: `<FileUpload.Root
  value={value}
  onChange={setValue}
  multiple
  accept="image/*"
  maxFileSize={200 * 1024}
  onReject={(rejections) => setRejections(rejections)}
>
  …
</FileUpload.Root>

// rejections: [{ file, errors: [{ code: 'fileType', params: { … } }, { code: 'maxFileSize', params: { … } }] }]
// Коды отбора: fileType, maxFileSize, minFileSize, maxFiles, maxTotalFileSize, fileExists,
// uploadFailed, uploadAborted — или свой из validate.`,
    },
    {
      id: 'ref',
      title: 'Управление снаружи через ref',
      description:
        'FileUploadHandle: openFilePicker, addFiles, removeItem, clear, retry, abort, focus — для триггеров вне дерева компонента.',
      render: RefDemo,
      code: `const uploadRef = useRef<FileUploadHandle>(null);

<button onClick={() => uploadRef.current?.openFilePicker()}>Открыть пикер</button>
<button onClick={() => uploadRef.current?.clear()}>Очистить</button>
<FileUpload.Root ref={uploadRef} value={value} onChange={setValue} multiple>
  …
</FileUpload.Root>`,
    },
  ],
  props: [
    {
      name: 'FileUpload.Root',
      type: 'UseFileUploadOptions & { children; ref?: FileUploadHandle }',
      description:
        'Провайдер контекста и владелец поведения. Сам рендерит только служебные узлы: скрытый <input type="file"> (основа доступности) и visually-hidden aria-live-регион статусов.',
    },
    {
      name: 'value / onChange / onBlur / disabled',
      type: 'File[] | RemoteFileRef[] | null',
      description:
        'Seam-контракт поля формы. Пустой список эмитится как null — required() работает без изменений.',
    },
    {
      name: 'accept / multiple / maxFiles / maxFileSize / minFileSize / maxTotalFileSize',
      type: 'string / boolean / number',
      description:
        'Отбор файлов. accept — синтаксис нативного атрибута, применяется и к drop/paste собственным матчером. Без multiple новая селекция заменяет текущую.',
      default: 'multiple: false',
    },
    {
      name: 'preventDuplicates / validate',
      type: 'boolean / (file, { existing }) => FileError[] | null',
      description: 'Отсев дубликатов (имя + размер) и своя проверка файла при отборе.',
      default: 'preventDuplicates: true',
    },
    {
      name: 'allowDrop / allowPaste / capture',
      type: "boolean / boolean / 'user' | 'environment'",
      description:
        'Каналы ввода: drag-and-drop на зоне, вставка из буфера, камера мобильного пикера.',
      default: 'allowDrop: true, allowPaste: false',
    },
    {
      name: 'uploader / autoUpload',
      type: '(file, { onProgress, signal }) => Promise<RemoteFileRef> / boolean',
      description:
        'Immediate-режим: загрузка при выборе, значение — RemoteFileRef[]. Дефолтной реализации нет — только ваша.',
      default: 'autoUpload: true',
    },
    {
      name: 'onFilesChange / onAccept / onReject / onUploadSuccess / onUploadError',
      type: 'колбэки',
      description: 'События списка, отбора и загрузки.',
    },
    {
      name: 'FileUpload.Trigger / Dropzone / ClearTrigger',
      type: 'asChild?',
      description:
        'Кнопка пикера, зона drag-and-drop (data-dragging, фокус, paste) и очистка списка. asChild отдаёт поведение вашему элементу.',
    },
    {
      name: 'FileUpload.ItemGroup',
      type: 'children: (item: FileUploadItem) => ReactNode',
      description:
        'Список (role="list"). item — дискриминированное объединение по status: local, uploading (progress), uploaded (remote), error (error).',
    },
    {
      name: 'FileUpload.Item + ItemPreview / ItemName / ItemSize / ItemProgress / ItemDeleteTrigger / ItemRetryTrigger',
      type: 'item; children?',
      description:
        'Строка (role="listitem", data-status) и её части. ItemPreview — управляемый object URL изображения (revoke при удалении), ItemProgress — role="progressbar".',
    },
    {
      name: 'useFileUpload(options)',
      type: '→ { items, rejections, dragging, uploading, liveMessage, …, getRootProps, getDropzoneProps, getTriggerProps, getHiddenInputProps, getItemGroupProps, getItemProps, getItemDeleteTriggerProps }',
      description: 'Всё поведение компонента для своей разметки.',
    },
    {
      name: 'fileUploadReducer / selectFiles / projectValue / reconcileItems',
      type: 'чистые функции',
      description:
        'React-free ядро состояния: переход списка, отбор файлов, проекция списка в значение поля, сверка списка с внешним value. Для тестов и своих обёрток.',
    },
  ],
};

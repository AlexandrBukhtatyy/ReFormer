import { useRef } from 'react';
import { createModel, createForm } from '@reformer/core';
import { required, maxFiles, maxFileSize, fileType } from '@reformer/core/validators';
import type { FileUploadUploader, RemoteFileRef } from '@reformer/cdk/file-upload';
import {
  FormField,
  FileUploadField,
  FileUploadAvatarField,
  fileUploadBasePropsSchema,
} from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

/**
 * FileUpload — поле выбора/загрузки файлов. Значение поля — АТОМАРНЫЙ массив
 * (File[] | RemoteFileRef[] | null), а не форма-массив; пустой список эмитится
 * как null (required() работает без изменений). Поведение целиком в headless
 * @reformer/cdk/file-upload, варианты ui-kit — только представление.
 */

/** Детерминированный mock-загрузчик: прогресс каждые 200 мс; имя с «fail» — падает. */
const mockUploader: FileUploadUploader = (file, { onProgress, signal }) =>
  new Promise<RemoteFileRef>((resolve, reject) => {
    let percent = 0;
    const shouldFail = file.name.toLowerCase().includes('fail');
    const timer = setInterval(() => {
      percent += 12;
      if (shouldFail && percent >= 60) {
        clearInterval(timer);
        reject(new Error('Сервер вернул 500'));
        return;
      }
      if (percent >= 100) {
        clearInterval(timer);
        resolve({ id: `srv-${file.name}`, name: file.name, size: file.size, type: file.type });
        return;
      }
      onProgress(percent);
    }, 200);
    signal.addEventListener('abort', () => {
      clearInterval(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** Ранее загруженные дескрипторы (редактирование формы). */
const PRELOADED: RemoteFileRef[] = [
  { id: 'doc-1', name: 'договор.pdf', size: 245_760, type: 'application/pdf' },
  { id: 'doc-2', name: 'паспорт.jpg', size: 1_048_576, type: 'image/jpeg' },
];

/**
 * Preloaded-демо: initial в модели — null (leaf-сигнал), дескрипторы кладутся в
 * `model.signalAt()` ПОСЛЕ createForm — массив объектов в initial дал бы ArrayNode
 * вместо поля (см. паттерн в примерах playground).
 */
function PreloadedDemo() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  if (ref.current === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createModel<any>({ field: null });
    const schema = {
      field: {
        value: model.$.field,
        component: FileUploadField,
        componentProps: {
          label: 'Ранее загруженные',
          placeholder: 'Добавить документ',
          multiple: true,
          uploader: mockUploader,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createForm<any>({ model, schema });
    model.signalAt('field')!.value = PRELOADED;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref.current = (form as any).field;
  }
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FormField control={ref.current} />
    </div>
  );
}

export const fileUploadDocConfig: ComponentDocConfig = {
  name: 'FileUpload',
  importFrom: '@reformer/ui-kit',
  description:
    'Поле выбора и загрузки файлов. Значение — File[] (deferred, файлы уходят на submit через FormData) либо сериализуемые дескрипторы RemoteFileRef[] (immediate — при заданном uploader). Отбор (accept / maxFiles / maxFileSize / дубликаты) выполняет сам компонент; варианты button / dropzone / input — один контракт, разное представление; single-изображение — отдельный FileUploadAvatarField.',
  variants: [
    {
      id: 'button',
      title: 'Кнопка (по умолчанию)',
      description:
        'Компактный триггер + список выбранных файлов на Attachment. Отклонённые отбором файлы показываются под списком.',
      render: makeFieldVariant({
        initial: null,
        component: FileUploadField,
        componentProps: {
          label: 'Документы',
          hint: 'Изображения или PDF, до 5 МБ',
          accept: 'image/*,.pdf',
          multiple: true,
          maxFileSize: 5 * 1024 * 1024,
        },
      }),
      code: `{
  value: model.$.documents,
  component: FileUploadField,
  componentProps: {
    label: 'Документы',
    hint: 'Изображения или PDF, до 5 МБ',
    accept: 'image/*,.pdf',
    multiple: true,
    maxFileSize: 5 * 1024 * 1024,
  },
}`,
    },
    // Порядок = раскладка галереи (2 колонки): компактные пары (button + input),
    // затем высокие зоны (dropzone + invalid), avatar — последним.
    {
      id: 'input',
      title: 'Input с кнопкой-иконкой',
      description:
        'Выглядит как текстовое поле: имена файлов строкой, скрепка открывает пикер, крестик очищает. Списка-превью нет — для форм, где вложения второстепенны.',
      render: makeFieldVariant({
        initial: null,
        component: FileUploadField,
        componentProps: {
          variant: 'input',
          label: 'Вложения',
          placeholder: 'Прикрепите файлы…',
          multiple: true,
          maxFiles: 3,
        },
      }),
      code: `componentProps: {
  variant: 'input',
  placeholder: 'Прикрепите файлы…',
  multiple: true,
  maxFiles: 3,
}`,
    },
    {
      id: 'dropzone',
      title: 'Dropzone',
      description:
        'Зона drag-and-drop: клик и Enter/Space открывают пикер, drop и paste (allowPaste) принимают файлы. Подсветка перетаскивания — data-dragging.',
      render: makeFieldVariant({
        initial: null,
        component: FileUploadField,
        componentProps: {
          variant: 'dropzone',
          label: 'Документы',
          hint: 'До 10 файлов, любые типы',
          multiple: true,
          maxFiles: 10,
          allowPaste: true,
        },
        fullWidth: true, // дроп-зона занимает всю ширину превью
      }),
      code: `componentProps: {
  variant: 'dropzone',
  multiple: true,
  maxFiles: 10,
  allowPaste: true,
}`,
    },
    {
      id: 'invalid',
      title: 'Invalid-состояние',
      description:
        'Под FormField aria-invalid приходит от обёртки при ошибке валидации (здесь — required на touched-поле): dropzone/input/avatar подсвечивают рамку, button показывает ошибку текстом. Вне формы то же состояние задаётся пропом invalid.',
      render: makeFieldVariant({
        initial: null,
        component: FileUploadField,
        componentProps: { variant: 'dropzone', label: 'Документы', multiple: true },
        validators: [required({ message: 'Приложите хотя бы один файл' })],
        touched: true,
        fullWidth: true,
      }),
      code: `// в форме — рамку подсвечивает aria-invalid от FormField:
validate(model.signalAt('documents')!, [required({ message: 'Приложите хотя бы один файл' })]);

// вне формы — явный проп:
<FileUploadDropzone invalid />`,
    },
    {
      id: 'avatar',
      title: 'Avatar (single image)',
      description:
        'Одно изображение с превью: клик/drop по зоне — выбрать или заменить, крестик — удалить. Отдельный компонент FileUploadAvatarField: значение single (File | RemoteFileRef | null).',
      render: makeFieldVariant({
        initial: null,
        component: FileUploadAvatarField,
        componentProps: { label: 'Аватар' },
      }),
      code: `{
  value: model.$.avatar,
  component: FileUploadAvatarField, // значение: File | RemoteFileRef | null
  componentProps: { shape: 'circle', maxFileSize: 2 * 1024 * 1024 },
}`,
    },
  ],
  examples: [
    {
      id: 'immediate',
      title: 'Immediate upload (uploader)',
      description:
        'Задан uploader — файлы уходят на сервер при выборе (прогресс, retry по ошибке, abort при удалении), а значением поля становятся сериализуемые дескрипторы {id, name, size, type}: черновики и JSON-формы работают. Файл с «fail» в имени — упадёт (кнопка повтора). Живое значение поля смотрите в табе API — панель «Value» (Form data) под превью.',
      render: makeFieldVariant({
        initial: null,
        component: FileUploadField,
        componentProps: {
          label: 'Документы',
          variant: 'dropzone',
          placeholder: 'Файлы уходят на сервер сразу',
          hint: 'Имя с «fail» — упадёт (retry)',
          multiple: true,
          uploader: mockUploader,
        },
        fullWidth: true,
      }),
      code: `{
  value: model.$.documents,
  component: FileUploadField,
  componentProps: {
    variant: 'dropzone',
    multiple: true,
    // единственная точка подключения транспорта (XHR / tus / presigned S3 — на выбор):
    uploader: (file, { onProgress, signal }) =>
      api.upload(file, { onProgress, signal }), // => Promise<RemoteFileRef>
  },
}
// значение поля: RemoteFileRef[] — только успешно загруженные`,
    },
    {
      id: 'preloaded',
      title: 'Preloaded — редактирование с ранее загруженными файлами',
      description:
        'Начальное значение — RemoteFileRef[] с сервера: элементы показываются как uploaded (имя/размер из дескриптора), их можно удалять и добавлять новые. Важно: в initial модели — null, дескрипторы кладутся в model.signalAt() ПОСЛЕ createForm (массив объектов в initial создал бы форму-массив вместо поля).',
      render: PreloadedDemo,
      code: `const model = createModel<FormShape>({ documents: null }); // именно null!
const form = createForm({ model, schema });
// префилл с сервера — в leaf-сигнал, после createForm:
model.signalAt('documents')!.value = [
  { id: 'doc-1', name: 'договор.pdf', size: 245760, type: 'application/pdf' },
];`,
    },
    {
      id: 'validation',
      title: 'File-валидаторы core',
      description:
        'Отбор при выборе делает сам компонент (componentProps), а на submit те же правила проверяют значение поля: maxFiles / minFiles / maxFileSize / minFileSize / maxTotalFileSize / fileType. Работают и с File, и с RemoteFileRef (duck-typing). Сигнал поля берётся через model.signalAt(): $-доступ у массивоподобных значений типизируется как индексное дерево.',
      render: makeFieldVariant({
        initial: null,
        component: FileUploadField,
        componentProps: {
          label: 'Документы',
          accept: 'image/*,.pdf',
          multiple: true,
          maxFiles: 2,
        },
        validators: [
          required({ message: 'Приложите хотя бы один файл' }),
          maxFiles(2),
          maxFileSize(5 * 1024 * 1024),
          fileType('image/*,.pdf'),
        ],
        touched: true,
      }),
      code: `import { required, maxFiles, maxFileSize, fileType } from '@reformer/core/validators';

// правила — в validation-схеме (@reformer/core/validation):
validate(model.signalAt('documents')!, [
  required({ message: 'Приложите хотя бы один файл' }),
  maxFiles(2),
  maxFileSize(5 * 1024 * 1024),
  fileType('image/*,.pdf'),
]);`,
    },
  ],
  api: {
    component: FileUploadField,
    initialValue: null,
    // Числовые лимиты и label — фиксированные (number-контрол без default дал бы 0 и
    // отклонял бы любой выбор); настраиваются пропы представления и каналов ввода.
    // uploader (mock) — чтобы панель «Value» (Form data) показывала настоящее
    // сериализуемое значение поля: RemoteFileRef[] вместо несериализуемых File.
    baseComponentProps: {
      label: 'Документы',
      maxFiles: 5,
      maxFileSize: 5 * 1024 * 1024,
      uploader: mockUploader,
    },
    validators: [required({ message: 'Приложите хотя бы один файл' })],
    valuePresets: [
      { label: 'Пусто (null)', value: null },
      {
        label: 'Загруженные дескрипторы',
        value: [
          { id: 'doc-1', name: 'договор.pdf', size: 245_760, type: 'application/pdf' },
          { id: 'doc-2', name: 'паспорт.jpg', size: 1_048_576, type: 'image/jpeg' },
        ],
      },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(fileUploadBasePropsSchema), {
      omit: ['label', 'maxFiles', 'maxFileSize', 'minFileSize', 'maxTotalFileSize', 'capture'],
    }),
    code: (v) =>
      `{
  value: model.$.documents,
  component: FileUploadField,
  componentProps: {
    label: 'Документы',${v.variant && v.variant !== 'button' ? `\n    variant: '${v.variant}',` : ''}${v.placeholder ? `\n    placeholder: '${v.placeholder}',` : ''}${v.hint ? `\n    hint: '${v.hint}',` : ''}${v.accept ? `\n    accept: '${v.accept}',` : ''}${v.multiple ? '\n    multiple: true,' : ''}
    maxFiles: 5,
    maxFileSize: 5 * 1024 * 1024,${v.allowPaste ? '\n    allowPaste: true,' : ''}${v.invalid ? '\n    invalid: true,' : ''}
    // immediate-режим: значение поля — сериализуемые RemoteFileRef[]
    uploader: (file, { onProgress, signal }) =>
      api.upload(file, { onProgress, signal }),
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.signalAt('documents')!, [required({ message: 'Приложите хотя бы один файл' })]);`,
  },
};

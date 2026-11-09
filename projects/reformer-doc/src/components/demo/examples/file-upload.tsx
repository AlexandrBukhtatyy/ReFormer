import { useRef } from 'react';
import { createModel, createFormFromModel } from '@reformer/core';
import { required, maxFiles, maxFileSize, fileType } from '@reformer/core/validators';
import type { FileUploadUploader, RemoteFileRef } from '@reformer/cdk/file-upload';
import {
  FormField,
  FileUploadBase,
  FileUploadDropzone,
  FileUploadInput,
  FileUploadAvatar,
  fileUploadBasePropsSchema,
} from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant, raw } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

const MB = 1024 * 1024;

/** Имитация сервера: прогресс каждые 200 мс; файл с «fail» в имени падает на 60 %. */
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

/** Так загрузчик выглядит в коде примеров: сеть — ваша, компонент только зовёт функцию. */
const UPLOADER_CODE = raw(
  '(file, { onProgress, signal }) => api.upload(file, { onProgress, signal })'
);

/** Ранее загруженные файлы — дескрипторы с сервера (редактирование формы). */
const PRELOADED: RemoteFileRef[] = [
  { id: 'doc-1', name: 'договор.pdf', size: 245_760, type: 'application/pdf' },
  { id: 'doc-2', name: 'паспорт.jpg', size: 1_048_576, type: 'image/jpeg' },
];

const PRELOADED_PROPS = {
  label: 'Ранее загруженные',
  placeholder: 'Добавить документ',
  multiple: true,
};

/**
 * Поле с файлами, пришедшими с сервера позже сборки формы: начальное значение — null,
 * дескрипторы записываются в сигнал поля после создания формы.
 */
function PreloadedDemo() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  if (ref.current === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createModel<any>({ documents: null });
    const schema = {
      model: model.$.documents,
      component: FileUploadBase,
      componentProps: { ...PRELOADED_PROPS, uploader: mockUploader },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createFormFromModel<any>({ model, schema });
    // Ответ сервера пришёл — дескрипторы в сигнал поля.
    model.$.documents.value = PRELOADED;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref.current = (form as any).documents;
  }
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FormField control={ref.current} />
    </div>
  );
}

const PRELOADED_CODE = `${fieldSnippet({
  field: 'documents',
  component: 'FileUploadBase',
  props: { ...PRELOADED_PROPS, uploader: UPLOADER_CODE },
})}

// ответ сервера пришёл — дескрипторы в сигнал поля:
model.$.documents.value = [
  { id: 'doc-1', name: 'договор.pdf', size: 245760, type: 'application/pdf' },
  { id: 'doc-2', name: 'паспорт.jpg', size: 1048576, type: 'image/jpeg' },
];`;

// Пропсы панели API — из props-схемы варианта. Числовые лимиты, label и загрузчик — постоянные
// (числовой контрол без умолчания дал бы 0 и отклонял бы любой файл). allowDrop/allowPaste
// показываем: у кнопки файл бросают и вставляют прямо на неё.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(fileUploadBasePropsSchema), {
  omit: ['label', 'maxFiles', 'maxFileSize', 'minFileSize', 'maxTotalFileSize', 'capture'],
});

export const fileUploadDocConfig: ComponentDocConfig = {
  name: 'FileUpload',
  importFrom: '@reformer/ui-kit',
  description:
    'Поле выбора и загрузки файлов: кнопка, зона перетаскивания, строка ввода или аватар. Значение — File[] или дескрипторы загруженных файлов.',
  variants: [
    fieldVariant({
      id: 'button',
      title: 'Кнопка',
      description:
        'FileUploadBase: кнопка выбора и список файлов под ней. Отклонённые отбором файлы показываются под списком.',
      field: 'documents',
      component: FileUploadBase,
      componentName: 'FileUploadBase',
      initial: null,
      props: {
        label: 'Документы',
        hint: 'Изображения или PDF, до 5 МБ',
        accept: 'image/*,.pdf',
        multiple: true,
        maxFileSize: 5 * MB,
      },
      codeProps: { maxFileSize: raw('5 * 1024 * 1024') },
    }),
    fieldVariant({
      id: 'input',
      title: 'Строка ввода',
      description:
        'FileUploadInput: имена файлов строкой, скрепка открывает выбор, крестик очищает. Списка с превью нет — для форм, где вложения второстепенны.',
      field: 'attachments',
      component: FileUploadInput,
      componentName: 'FileUploadInput',
      initial: null,
      props: { label: 'Вложения', placeholder: 'Прикрепите файлы…', multiple: true, maxFiles: 3 },
    }),
    fieldVariant({
      id: 'dropzone',
      title: 'Зона перетаскивания',
      description:
        'FileUploadDropzone: щелчок, Enter и пробел открывают выбор файлов, перетаскивание и вставка из буфера (allowPaste) добавляют файлы.',
      field: 'documents',
      component: FileUploadDropzone,
      componentName: 'FileUploadDropzone',
      initial: null,
      props: {
        label: 'Документы',
        hint: 'До 10 файлов, любые типы',
        multiple: true,
        maxFiles: 10,
        allowPaste: true,
      },
      fullWidth: true,
    }),
    fieldVariant({
      id: 'invalid',
      title: 'Ошибка',
      description:
        'При замечании FormField ставит aria-invalid, и зона, строка ввода и аватар подсвечивают рамку. Кнопка показывает ошибку только текстом. Вне формы то же состояние задаёт проп invalid.',
      field: 'documents',
      component: FileUploadDropzone,
      componentName: 'FileUploadDropzone',
      initial: null,
      props: { label: 'Документы', multiple: true, required: true },
      validators: [required({ code: 'documents.required' })],
      rules: "required({ code: 'documents.required' })",
      messages: { 'documents.required': 'Приложите хотя бы один файл' },
      touched: true,
      fullWidth: true,
    }),
    fieldVariant({
      id: 'avatar',
      title: 'Аватар',
      description:
        'FileUploadAvatar: одно изображение с превью. Щелчок или перетаскивание — выбрать или заменить, крестик — удалить. Значение — File | RemoteFileRef | null.',
      field: 'avatar',
      component: FileUploadAvatar,
      componentName: 'FileUploadAvatar',
      initial: null,
      props: { label: 'Фото профиля', shape: 'circle', maxFileSize: 2 * MB },
      codeProps: { maxFileSize: raw('2 * 1024 * 1024') },
    }),
  ],
  examples: [
    fieldVariant({
      id: 'immediate',
      title: 'Загрузка сразу при выборе',
      description:
        'С uploader файлы уходят на сервер при выборе: прогресс, повтор после ошибки, отмена при удалении. Значение поля — дескрипторы { id, name, size, type } успешно загруженных файлов. В демо сервер имитирован: файл с «fail» в имени упадёт, появится кнопка повтора.',
      field: 'documents',
      component: FileUploadDropzone,
      componentName: 'FileUploadDropzone',
      initial: null,
      props: {
        label: 'Документы',
        placeholder: 'Файлы уходят на сервер сразу',
        multiple: true,
        uploader: mockUploader,
      },
      codeProps: { uploader: UPLOADER_CODE },
      fullWidth: true,
    }),
    {
      id: 'preloaded',
      title: 'Редактирование: файлы уже загружены',
      description:
        'Значение — дескрипторы с сервера: файлы показываются загруженными, их можно удалить и добавить новые. Дескрипторы кладут в начальное значение модели или записывают в сигнал поля, когда придёт ответ сервера.',
      render: PreloadedDemo,
      code: PRELOADED_CODE,
    },
    fieldVariant({
      id: 'validation',
      title: 'Правила для файлов',
      description:
        'Компонент отсеивает файлы при выборе по своим пропсам, а правила проверяют значение поля целиком перед отправкой. Правила работают и с File, и с дескрипторами.',
      field: 'documents',
      component: FileUploadBase,
      componentName: 'FileUploadBase',
      initial: null,
      props: { label: 'Документы', accept: 'image/*,.pdf', multiple: true, maxFiles: 2 },
      validators: [
        required({ code: 'documents.required' }),
        maxFiles(2),
        maxFileSize(5 * MB),
        fileType('image/*,.pdf'),
      ],
      rules:
        "required({ code: 'documents.required' }), maxFiles(2), maxFileSize(5 * 1024 * 1024), fileType('image/*,.pdf')",
      messages: { 'documents.required': 'Приложите хотя бы один файл' },
      touched: true,
    }),
  ],
  api: {
    component: FileUploadBase,
    initialValue: null,
    // С загрузчиком панель «Value» показывает настоящее значение поля — дескрипторы, а не File.
    baseComponentProps: {
      label: 'Документы',
      maxFiles: 5,
      maxFileSize: 5 * MB,
      uploader: mockUploader,
    },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Приложите хотя бы один файл' },
    valuePresets: [
      { label: 'Пусто (null)', value: null },
      { label: 'Загруженные дескрипторы', value: PRELOADED },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'documents',
        component: 'FileUploadBase',
        props: {
          label: 'Документы',
          maxFiles: 5,
          maxFileSize: raw('5 * 1024 * 1024'),
          uploader: UPLOADER_CODE,
        },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};

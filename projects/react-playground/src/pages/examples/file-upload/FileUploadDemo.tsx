/**
 * Примеры FileUpload — поле загрузки файлов (@reformer/cdk/file-upload + @reformer/ui-kit).
 *
 * Покрывает оба режима значения:
 * - deferred (без uploader): value = File[], сеть — забота консумента при submit;
 * - immediate (mock-uploader с прогрессом): value = сериализуемые RemoteFileRef[],
 *   включая preloaded-сценарий (редактирование формы с ранее загруженными файлами).
 *
 * Mock-uploader детерминирован для e2e: файл с именем, содержащим «fail», падает
 * (демо retry); остальные грузятся ~2 с с прогрессом.
 */

import { useMemo, useState } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, maxFiles, maxFileSize, fileType } from '@reformer/core/validators';
import { ValidationMessagesProvider, createMessageResolver } from '@reformer/cdk';
import type { FileUploadUploader, FileUploadValue, RemoteFileRef } from '@reformer/cdk/file-upload';
import {
  FileUploadField,
  FileUploadAvatarField,
  FileUploadDropzone,
  FileUploadInput,
  FileUploadAvatar,
  FormField,
  ExampleCard,
  Button,
} from '@reformer/ui-kit';

interface FileUploadDemoForm {
  // FileUploadValue (union массивов) — форма мапит поле в FieldNode (лист),
  // а не в FormArrayProxy: массив файлов — атомарное значение, не форма-массив.
  documents: FileUploadValue;
  dropzoneFiles: FileUploadValue;
  attachments: FileUploadValue;
  uploadedDocs: FileUploadValue;
  preloadedDocs: FileUploadValue;
  avatar: File | RemoteFileRef | null;
}

/** Ранее загруженные файлы (редактирование заявки): в форме — только дескрипторы. */
const PRELOADED: RemoteFileRef[] = [
  { id: 'doc-1', name: 'договор.pdf', size: 245_760, type: 'application/pdf' },
  { id: 'doc-2', name: 'паспорт.jpg', size: 1_048_576, type: 'image/jpeg' },
];

const INITIAL: FileUploadDemoForm = {
  documents: null,
  dropzoneFiles: null,
  attachments: null,
  uploadedDocs: null,
  // ВАЖНО: initial null, а не PRELOADED — массив объектов в initial модель превратила бы
  // в ModelArray (форма-массив). Префилл кладётся в уже созданный leaf-сигнал ниже.
  preloadedDocs: null,
  avatar: null,
};

/**
 * Mock-загрузчик: прогресс каждые 200 мс, детерминированный отказ по имени файла
 * («fail» в имени → ошибка на 60% — видно и прогресс, и retry).
 */
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
        resolve({
          id: `srv-${Date.now()}-${file.name}`,
          name: file.name,
          size: file.size,
          type: file.type,
        });
        return;
      }
      onProgress(percent);
    }, 200);
    signal.addEventListener('abort', () => {
      clearInterval(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

// Таблица сообщений для кодов file-валидаторов и отборов CDK (точка i18n).
const fileMessages = createMessageResolver({
  required: () => 'Приложите хотя бы один файл',
  maxFiles: (p) => `Максимум ${p?.maxFiles} файла(ов)`,
  minFiles: (p) => `Минимум ${p?.minFiles} файла(ов)`,
  fileType: (p) => `Недопустимый тип файла (разрешено: ${p?.accept})`,
  maxFileSize: () => 'Файл больше 5 МБ',
  minFileSize: () => 'Файл пустой',
  maxTotalFileSize: () => 'Суммарный размер превышен',
  fileExists: (p) => `Файл ${p?.fileName} уже добавлен`,
  uploadFailed: (p) => `Не удалось загрузить: ${p?.reason ?? 'ошибка сети'}`,
  uploadAborted: () => 'Загрузка прервана',
});

function buildSchema(model: ReturnType<typeof createModel<FileUploadDemoForm>>) {
  return {
    children: [
      {
        value: model.$.documents,
        component: FileUploadField,
        componentProps: {
          testId: 'documents',
          label: 'Документы',
          hint: 'Изображения или PDF, до 5 МБ, максимум 3',
          accept: 'image/*,.pdf',
          multiple: true,
          maxFiles: 3,
          maxFileSize: 5 * 1024 * 1024,
        },
      },
      {
        value: model.$.dropzoneFiles,
        component: FileUploadField,
        componentProps: {
          testId: 'dropzoneFiles',
          variant: 'dropzone',
          hint: 'До 10 файлов, любые типы',
          multiple: true,
          maxFiles: 10,
          allowPaste: true,
        },
      },
      {
        value: model.$.attachments,
        component: FileUploadField,
        componentProps: {
          testId: 'attachments',
          variant: 'input',
          label: 'Вложения',
          placeholder: 'Прикрепите файлы…',
          hint: 'До 3 файлов',
          multiple: true,
          maxFiles: 3,
        },
      },
      {
        value: model.$.uploadedDocs,
        component: FileUploadField,
        componentProps: {
          testId: 'uploadedDocs',
          variant: 'dropzone',
          placeholder: 'Файлы уходят на сервер сразу',
          hint: 'Имя с «fail» — упадёт (retry)',
          multiple: true,
          uploader: mockUploader,
        },
      },
      {
        value: model.$.preloadedDocs,
        component: FileUploadField,
        componentProps: {
          testId: 'preloadedDocs',
          label: 'Ранее загруженные',
          placeholder: 'Добавить документ',
          multiple: true,
          uploader: mockUploader,
        },
      },
      {
        value: model.$.avatar,
        component: FileUploadAvatarField,
        componentProps: {
          testId: 'avatar',
          maxFileSize: 2 * 1024 * 1024,
        },
      },
    ],
  };
}

// Слой валидации — отдельная схема над моделью (контракт @reformer/core/validation).
// `model.signalAt(path)` вместо `model.$.documents`: у массивоподобных значений `$`-тип
// разворачивается в индексное дерево, а валидатору нужен leaf-сигнал целиком.
const demoValidation = defineValidationSchema<FileUploadDemoForm>(({ model }) => {
  validate(model.signalAt('documents')!, [
    required({ message: 'Приложите хотя бы один файл' }),
    maxFiles(3),
    maxFileSize(5 * 1024 * 1024),
    fileType('image/*,.pdf'),
  ]);
});

export default function FileUploadDemo() {
  const { form, model } = useMemo(() => {
    const m = createModel<FileUploadDemoForm>({ ...INITIAL });
    const s = buildSchema(m);
    const f = createForm<FileUploadDemoForm>({ model: m, schema: s });
    // Префилл «ранее загруженных» — ПОСЛЕ createForm: фабрика узлов решает по текущему
    // значению сигнала, и массив объектов на этапе создания дал бы ArrayNode вместо поля.
    m.signalAt('preloadedDocs')!.value = PRELOADED;
    return { form: f, model: m };
  }, []);

  const [snapshot, setSnapshot] = useState<string | null>(null);

  const handleValidate = async () => {
    form.markAsTouched();
    await validateModel(model, demoValidation);
  };

  /** Демонстрация сериализуемости: File отображается меткой, дескрипторы — как есть. */
  const handleSnapshot = () => {
    setSnapshot(
      JSON.stringify(
        model.get(),
        (_key, value: unknown) =>
          typeof File !== 'undefined' && value instanceof File
            ? `[File: ${value.name}, ${value.size} Б]`
            : value,
        2
      )
    );
  };

  return (
    <ValidationMessagesProvider resolver={fileMessages}>
      <div className="mx-auto p-6">
        <h2 className="text-2xl font-bold mb-2">FileUpload</h2>
        <p className="text-gray-600 mb-6">
          Поле загрузки файлов: варианты button/dropzone/avatar, deferred и immediate режимы
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExampleCard
            title="Кнопка (deferred)"
            description="value = File[]; отбор: image/*+.pdf, до 5 МБ, максимум 3"
            bgColor="bg-white"
            code={`{
  value: model.$.documents,
  component: FileUploadField,
  componentProps: {
    accept: 'image/*,.pdf',
    multiple: true, maxFiles: 3,
    maxFileSize: 5 * 1024 * 1024,
  },
}
// те же правила вторым эшелоном — file-валидаторы core (отдельная схема валидации):
validate(model.signalAt('documents')!, [required(), maxFiles(3), maxFileSize(5 * 1024 * 1024), fileType('image/*,.pdf')]);`}
          >
            <FormField control={form.documents} />
          </ExampleCard>

          <ExampleCard
            title="Dropzone (deferred)"
            description="Перетаскивание, клик и Enter/Space, paste из буфера"
            bgColor="bg-white"
            code={`componentProps: {
  variant: 'dropzone',
  multiple: true, maxFiles: 10,
  allowPaste: true,
}`}
          >
            <FormField control={form.dropzoneFiles} />
          </ExampleCard>

          <ExampleCard
            title="Input с кнопкой-иконкой"
            description="Компактный вариант: выглядит как текстовое поле, имена файлов строкой, скрепка и крестик очистки"
            bgColor="bg-white"
            code={`componentProps: {
  variant: 'input',
  placeholder: 'Прикрепите файлы…',
  multiple: true, maxFiles: 3,
}`}
          >
            <FormField control={form.attachments} />
          </ExampleCard>

          <ExampleCard
            title="Invalid state"
            description="Проп invalid подсвечивает рамку dropzone/input/avatar; для button ошибку показывает FormField.Error"
            bgColor="bg-white"
            code={`<FileUploadDropzone invalid />
<FileUploadInput invalid />
<FileUploadAvatar invalid />
// под FormField invalid не нужен:
// aria-invalid приходит от обёртки при ошибке валидации`}
          >
            <div data-testid="invalid-showcase" className="flex flex-col gap-4">
              <FileUploadDropzone value={null} invalid placeholder="Невалидная зона" />
              <FileUploadInput value={null} invalid placeholder="Невалидный инпут" />
              <FileUploadAvatar value={null} invalid />
            </div>
          </ExampleCard>

          <ExampleCard
            title="Immediate upload"
            description="uploader инжектируется; value = сериализуемые дескрипторы {id, name, size}"
            bgColor="bg-white"
            code={`componentProps: {
  variant: 'dropzone', multiple: true,
  uploader: (file, { onProgress, signal }) =>
    api.upload(file, { onProgress, signal }), // => Promise<RemoteFileRef>
}`}
          >
            <FormField control={form.uploadedDocs} />
          </ExampleCard>

          <ExampleCard
            title="Preloaded (редактирование)"
            description="Начальное значение — RemoteFileRef[] с сервера; файлы можно удалять и добавлять"
            bgColor="bg-white"
            code={`// префилл с сервера — в leaf-сигнал поля (initial в модели: null)
model.signalAt('preloadedDocs')!.value = [
  { id: 'doc-1', name: 'договор.pdf', size: 245760, type: 'application/pdf' },
];`}
          >
            <FormField control={form.preloadedDocs} />
          </ExampleCard>

          <ExampleCard
            title="Avatar (single image)"
            description="Одно изображение с превью: клик/drop по зоне, замена и удаление"
            bgColor="bg-white"
            code={`{
  value: model.$.avatar,
  component: FileUploadAvatarField,
  componentProps: { maxFileSize: 2 * 1024 * 1024 },
}`}
          >
            <FormField control={form.avatar} />
          </ExampleCard>

          <ExampleCard
            title="Значение формы"
            description="Дескрипторы сериализуемы в JSON, File — нет (deferred уходит через FormData)"
            bgColor="bg-white"
            code={`JSON.stringify(model.get())`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button data-testid="button-validate" variant="outline" onClick={handleValidate}>
                  Провалидировать
                </Button>
                <Button data-testid="button-snapshot" variant="outline" onClick={handleSnapshot}>
                  Показать значение
                </Button>
              </div>
              {snapshot && (
                <pre
                  data-testid="value-snapshot"
                  className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs"
                >
                  {snapshot}
                </pre>
              )}
            </div>
          </ExampleCard>
        </div>
      </div>
    </ValidationMessagesProvider>
  );
}

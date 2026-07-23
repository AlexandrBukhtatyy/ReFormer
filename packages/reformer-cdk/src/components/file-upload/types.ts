/**
 * Типы headless-компонента загрузки файлов.
 *
 * @module reformer/cdk/file-upload/types
 */

import type { ValidationError } from '@reformer/core';

/**
 * Сериализуемый дескриптор загруженного файла (uploader-режим).
 *
 * Именно он попадает в значение поля формы вместо `File`: `File` не сериализуется
 * в JSON, а дескриптор переживает черновики, `renderer-json` и восстановление
 * формы при редактировании (preloaded-файлы).
 */
export interface RemoteFileRef {
  /** Идентификатор файла на сервере — по нему матчится восстановление и revert. */
  id: string;
  /** Имя файла для отображения. */
  name: string;
  /** URL для скачивания/превью, если сервер его отдаёт. */
  url?: string;
  /** Размер в байтах, если известен. */
  size?: number;
  /** MIME-тип, если известен. */
  type?: string;
  /** Произвольные сериализуемые данные бэкенда (bucket, версия и т.п.). */
  meta?: Record<string, string | number | boolean | null>;
}

/**
 * Ошибка отбора/загрузки файла. `code` разрешается в текст резолвером сообщений
 * (`useValidationErrorResolver`/`createMessageResolver`), поэтому тип — ровно
 * {@link ValidationError} из core: один резолвер обслуживает и валидацию, и отбор.
 *
 * Коды отбора: `'fileType' | 'maxFileSize' | 'minFileSize' | 'maxFiles' |
 * 'maxTotalFileSize' | 'fileExists' | 'uploadFailed' | 'uploadAborted'`
 * или произвольный из кастомного `validate`. `message` по умолчанию — `'invalid'`
 * (как у core-валидаторов), в `params` — лимит/имя файла/фактическое значение.
 */
export type FileError = ValidationError;

/** Файл, отклонённый при отборе. В значение поля не попадает — уходит в `onReject`. */
export interface FileRejection {
  file: File;
  /** Все нарушения сразу (файл может быть и не того типа, и слишком большим). */
  errors: FileError[];
}

/**
 * Элемент внутреннего списка файлов — дискриминированное объединение по `status`.
 *
 * `key` — стабильный uid элемента (не индекс): по нему живут превью, abort-контроллеры
 * и React-ключи при переупорядочивании.
 */
export type FileUploadItem =
  | { key: string; status: 'local'; file: File }
  | { key: string; status: 'uploading'; file: File; progress: number }
  | { key: string; status: 'uploaded'; file?: File; remote: RemoteFileRef }
  | { key: string; status: 'error'; file: File; error: FileError; progress?: number };

/**
 * Значение поля формы: `File[]` (без uploader) либо `RemoteFileRef[]` (с uploader,
 * только успешно загруженные). Пустой список эмитится как `null`, чтобы `required()`
 * работал без изменений.
 */
export type FileUploadValue = File[] | RemoteFileRef[] | null;

/**
 * Контракт загрузчика. Дефолтной реализации нет — только инжекция консумента
 * (XHR с `xhr.upload.onprogress`, tus, presigned S3 — что угодно, возвращающее дескриптор).
 *
 * Реализация обязана уважать `signal` (прервать запрос) и может репортить
 * прогресс в процентах через `onProgress`.
 */
export type FileUploadUploader = (
  file: File,
  ctx: { onProgress: (percent: number) => void; signal: AbortSignal }
) => Promise<RemoteFileRef>;

/** Опции {@link useFileUpload}. Совпадают с props `FileUpload.Root`. */
export interface UseFileUploadOptions {
  // ── seam-контракт поля (controlled) ──
  /** Текущее значение поля. */
  value?: FileUploadValue;
  /** Эмит нового значения (value-based). */
  onChange?: (value: FileUploadValue) => void;
  /** Пометить поле touched (обычно после закрытия пикера/blur зоны). */
  onBlur?: () => void;
  /** Поле недоступно: пикер не открывается, drop/paste игнорируются. */
  disabled?: boolean;
  // ── отбор файлов ──
  /**
   * Допустимые типы в синтаксисе нативного `accept` (`'image/*,.pdf'`). Пробрасывается
   * в hidden input и применяется к drag-and-drop/paste через собственный матчер —
   * нативный `accept` на drop не действует.
   */
  accept?: string;
  /**
   * Разрешить несколько файлов. При `false` новая селекция ЗАМЕНЯЕТ текущую,
   * лимит файлов — 1.
   * @default false
   */
  multiple?: boolean;
  /** Максимум файлов в списке (действует при `multiple`). */
  maxFiles?: number;
  /** Максимальный размер одного файла, байты. */
  maxFileSize?: number;
  /** Минимальный размер одного файла, байты (например `1` — отсев пустых). */
  minFileSize?: number;
  /** Максимальный суммарный размер всех файлов, байты. */
  maxTotalFileSize?: number;
  /**
   * Отклонять дубликаты (совпадение `name` + `size` с уже выбранным).
   * @default true
   */
  preventDuplicates?: boolean;
  /** Кастомная валидация файла при отборе. `null` — файл принят. */
  validate?: (file: File, ctx: { existing: FileUploadItem[] }) => FileError[] | null;
  // ── каналы ввода ──
  /**
   * Принимать drag-and-drop на зоне.
   * @default true
   */
  allowDrop?: boolean;
  /**
   * Принимать файлы из буфера обмена (paste на сфокусированной зоне).
   * @default false
   */
  allowPaste?: boolean;
  /** Источник камеры для мобильного пикера (пробрасывается в hidden input). */
  capture?: 'user' | 'environment';
  // ── uploader-режим ──
  /**
   * Загрузчик. Задан — компонент работает в immediate-режиме: файлы уходят на сервер
   * при выборе, значением поля становятся {@link RemoteFileRef}. Не задан — deferred:
   * значение поля `File[]`, сеть — забота консумента при submit.
   */
  uploader?: FileUploadUploader;
  /**
   * Автоматически запускать загрузку принятых файлов (при заданном `uploader`).
   * @default true
   */
  autoUpload?: boolean;
  // ── события ──
  /** Любое изменение внутреннего списка (включая прогресс и смену статусов). */
  onFilesChange?: (items: FileUploadItem[]) => void;
  /** Файлы приняты отбором (до загрузки). */
  onAccept?: (files: File[]) => void;
  /** Файлы отклонены отбором. */
  onReject?: (rejections: FileRejection[]) => void;
  /** Файл успешно загружен (uploader-режим). */
  onUploadSuccess?: (item: Extract<FileUploadItem, { status: 'uploaded' }>) => void;
  /** Загрузка файла упала (uploader-режим). */
  onUploadError?: (item: Extract<FileUploadItem, { status: 'error' }>) => void;
  /** Явный префикс для генерируемых id (a11y-связки). */
  id?: string;
}

/** Императивный handle `FileUpload.Root` (через ref), по образцу AsyncBoundaryHandle. */
export interface FileUploadHandle {
  /** Открыть системный пикер файлов. */
  openFilePicker(): void;
  /** Программно добавить файлы (пройдут тот же отбор, что выбор/drop). */
  addFiles(files: File[]): void;
  /** Удалить элемент списка (загрузка, если шла, прерывается). */
  removeItem(key: string): void;
  /** Очистить список целиком. */
  clear(): void;
  /** Повторить упавшую загрузку. */
  retry(key: string): void;
  /** Прервать загрузку элемента (или все, без `key`) — элемент остаётся с ошибкой `uploadAborted`. */
  abort(key?: string): void;
  /** Сфокусировать hidden input — для «подсветить невалидное поле». */
  focus(): void;
}

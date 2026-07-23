/**
 * Чистое (React-free) ядро headless-компонента загрузки файлов: редьюсер списка,
 * отбор кандидатов (accept/размер/количество/дубликаты/кастомная валидация) и
 * проекции значения поля.
 *
 * Вынесено из компонента, чтобы переходы статусов и правила отбора были
 * юнит-тестируемы без DOM — тот же приём, что `async-resource` у AsyncBoundary.
 *
 * @module reformer/cdk/file-upload/file-upload-core
 */

import { matchesFileAccept } from '@reformer/core/validators';
import type {
  FileError,
  FileRejection,
  FileUploadItem,
  FileUploadValue,
  RemoteFileRef,
} from './types';

// ============================================================================
// Состояние и редьюсер
// ============================================================================

/** Снимок состояния списка файлов. */
export interface FileUploadState {
  /** Текущий список (принятые файлы во всех статусах). */
  items: FileUploadItem[];
  /** Отклонённые ПОСЛЕДНИМ отбором (сбрасываются следующим отбором и clear). */
  rejections: FileRejection[];
}

/** Действия редьюсера. */
export type FileUploadAction =
  /** Итог отбора: принятые становятся `local`-элементами, отклонённые — в `rejections`. */
  | { kind: 'add'; accepted: File[]; keys: string[]; rejected: FileRejection[]; replace: boolean }
  /** Удаление элемента. */
  | { kind: 'remove'; key: string }
  /** Полная очистка. */
  | { kind: 'clear' }
  /** Загрузка элемента стартовала (`local`/`error` → `uploading`). */
  | { kind: 'upload-start'; key: string }
  /** Прогресс загрузки, проценты 0–100. */
  | { kind: 'upload-progress'; key: string; percent: number }
  /** Загрузка завершена — элемент становится `uploaded` с дескриптором сервера. */
  | { kind: 'upload-success'; key: string; remote: RemoteFileRef }
  /** Загрузка упала (или прервана — `code: 'uploadAborted'`). */
  | { kind: 'upload-error'; key: string; error: FileError }
  /** Повтор упавшей загрузки: `error` → `local` (очередь подхватит заново). */
  | { kind: 'retry'; key: string }
  /** Синхронизация с внешним значением формы: список замещается пересобранным. */
  | { kind: 'sync-items'; items: FileUploadItem[] };

/** Начальное состояние: пустой список. */
export function initialFileUploadState(): FileUploadState {
  return { items: [], rejections: [] };
}

/**
 * Редьюсер списка файлов.
 *
 * Переходы статусов элемента: `local → uploading → uploaded | error`, `error → local`
 * (retry). Действия для несуществующего `key` или недопустимого исходного статуса —
 * no-op (возвращается прежний state): загрузка может завершиться после удаления
 * элемента, и это не должно ронять список.
 *
 * @param state - Текущее состояние.
 * @param action - Действие.
 * @returns Новое состояние.
 */
export function fileUploadReducer(
  state: FileUploadState,
  action: FileUploadAction
): FileUploadState {
  switch (action.kind) {
    case 'add': {
      const added: FileUploadItem[] = action.accepted.map((file, i) => ({
        key: action.keys[i],
        status: 'local',
        file,
      }));
      return {
        items: action.replace ? added : [...state.items, ...added],
        rejections: action.rejected,
      };
    }

    case 'remove': {
      const items = state.items.filter((item) => item.key !== action.key);
      return items.length === state.items.length ? state : { ...state, items };
    }

    case 'clear':
      return initialFileUploadState();

    case 'upload-start':
      return mapItem(state, action.key, (item) =>
        item.status === 'local' || item.status === 'error'
          ? { key: item.key, status: 'uploading', file: item.file, progress: 0 }
          : item
      );

    case 'upload-progress':
      return mapItem(state, action.key, (item) =>
        item.status === 'uploading' ? { ...item, progress: clampPercent(action.percent) } : item
      );

    case 'upload-success':
      return mapItem(state, action.key, (item) =>
        item.status === 'uploading'
          ? { key: item.key, status: 'uploaded', file: item.file, remote: action.remote }
          : item
      );

    case 'upload-error':
      return mapItem(state, action.key, (item) =>
        item.status === 'uploading'
          ? {
              key: item.key,
              status: 'error',
              file: item.file,
              error: action.error,
              progress: item.progress,
            }
          : item
      );

    case 'retry':
      return mapItem(state, action.key, (item) =>
        item.status === 'error' ? { key: item.key, status: 'local', file: item.file } : item
      );

    case 'sync-items':
      return { ...state, items: action.items };
  }
}

/** Точечная замена элемента по `key`; без изменений — прежний state (реф-равенство). */
function mapItem(
  state: FileUploadState,
  key: string,
  update: (item: FileUploadItem) => FileUploadItem
): FileUploadState {
  let changed = false;
  const items = state.items.map((item) => {
    if (item.key !== key) return item;
    const next = update(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...state, items } : state;
}

function clampPercent(percent: number): number {
  if (Number.isNaN(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

// ============================================================================
// Отбор кандидатов
// ============================================================================

/** Правила отбора — подмножество опций {@link UseFileUploadOptions}. */
export interface SelectFilesOptions {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  minFileSize?: number;
  maxTotalFileSize?: number;
  preventDuplicates?: boolean;
  validate?: (file: File, ctx: { existing: FileUploadItem[] }) => FileError[] | null;
}

/** Итог отбора: что добавить в список и что отдать в `onReject`. */
export interface SelectFilesResult {
  accepted: File[];
  rejected: FileRejection[];
}

/** Ошибка отбора с дефолтным `message: 'invalid'` (текст даёт резолвер сообщений). */
export function makeFileError(code: string, params?: FileError['params']): FileError {
  return { code, message: 'invalid', params };
}

/**
 * Отбор кандидатов (выбор в пикере, drop, paste, программный `addFiles`).
 *
 * Каждый файл проверяется на тип/размер/дубликат/кастомные правила — все нарушения
 * собираются в ОДНУ rejection (`errors[]`), как у react-dropzone/Ark UI. Затем
 * применяются коллективные лимиты: переполнение `maxFiles`/`maxTotalFileSize`
 * отклоняет лишние файлы (не весь дроп) с кодами `maxFiles`/`maxTotalFileSize`.
 *
 * При `multiple: false` лимит — один файл; замену текущего выбора организует
 * вызывающий код (передаёт `existing: []` и `replace: true` в действии `add`).
 *
 * @param candidates - Файлы-кандидаты в порядке поступления.
 * @param options - Правила отбора.
 * @param existing - Текущий список (для дубликатов и коллективных лимитов).
 * @returns Принятые и отклонённые файлы.
 */
export function selectFiles(
  candidates: File[],
  options: SelectFilesOptions,
  existing: FileUploadItem[]
): SelectFilesResult {
  const {
    accept,
    multiple = false,
    maxFiles,
    maxFileSize,
    minFileSize,
    maxTotalFileSize,
    preventDuplicates = true,
    validate,
  } = options;

  const capacity = multiple ? (maxFiles ?? Infinity) : 1;
  const existingCount = existing.length;
  const existingTotal = existing.reduce((sum, item) => sum + itemSize(item), 0);

  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  let acceptedTotal = 0;

  for (const file of candidates) {
    const errors: FileError[] = [];

    if (accept && !matchesFileAccept(file, accept)) {
      errors.push(makeFileError('fileType', { accept, fileName: file.name }));
    }
    if (typeof maxFileSize === 'number' && file.size > maxFileSize) {
      errors.push(
        makeFileError('maxFileSize', { maxFileSize, fileName: file.name, actualSize: file.size })
      );
    }
    if (typeof minFileSize === 'number' && file.size < minFileSize) {
      errors.push(
        makeFileError('minFileSize', { minFileSize, fileName: file.name, actualSize: file.size })
      );
    }
    if (preventDuplicates && isDuplicate(file, existing, accepted)) {
      errors.push(makeFileError('fileExists', { fileName: file.name }));
    }
    const custom = validate?.(file, { existing });
    if (custom?.length) errors.push(...custom);

    if (errors.length === 0) {
      // Коллективные лимиты применяются только к индивидуально валидным файлам —
      // иначе невалидный файл «занимал бы место» валидного за ним.
      if (existingCount + accepted.length + 1 > capacity) {
        errors.push(makeFileError('maxFiles', { maxFiles: capacity, fileName: file.name }));
      } else if (
        typeof maxTotalFileSize === 'number' &&
        existingTotal + acceptedTotal + file.size > maxTotalFileSize
      ) {
        errors.push(makeFileError('maxTotalFileSize', { maxTotalFileSize, fileName: file.name }));
      }
    }

    if (errors.length > 0) rejected.push({ file, errors });
    else {
      accepted.push(file);
      acceptedTotal += file.size;
    }
  }

  return { accepted, rejected };
}

function itemSize(item: FileUploadItem): number {
  if (item.status === 'uploaded') return item.file?.size ?? item.remote.size ?? 0;
  return item.file.size;
}

function isDuplicate(file: File, existing: FileUploadItem[], accepted: File[]): boolean {
  const sameAs = (name: string, size: number | undefined) =>
    name === file.name && size === file.size;
  return (
    existing.some((item) =>
      item.status === 'uploaded'
        ? sameAs(item.file?.name ?? item.remote.name, item.file?.size ?? item.remote.size)
        : sameAs(item.file.name, item.file.size)
    ) || accepted.some((f) => sameAs(f.name, f.size))
  );
}

// ============================================================================
// Проекции значения поля
// ============================================================================

/**
 * Проекция внутреннего списка в значение поля формы.
 *
 * - `'local'` (deferred-режим): все файлы списка → `File[]`.
 * - `'remote'` (uploader-режим): ТОЛЬКО `uploaded`-элементы → `RemoteFileRef[]` —
 *   значение всегда сериализуемо; `uploading`/`error` в форму не попадают
 *   (файл не догружен — его нет).
 *
 * Пустой результат — `null`, чтобы `required()` срабатывал без изменений.
 *
 * @param items - Внутренний список.
 * @param mode - Режим проекции.
 * @returns Значение поля.
 */
export function projectValue(items: FileUploadItem[], mode: 'local' | 'remote'): FileUploadValue {
  if (mode === 'remote') {
    const refs = items.flatMap((item) => (item.status === 'uploaded' ? [item.remote] : []));
    return refs.length > 0 ? refs : null;
  }
  const files = items.flatMap((item) => (item.file ? [item.file] : []));
  return files.length > 0 ? files : null;
}

/**
 * Пересборка списка под внешнее значение формы (reset/patchValue снаружи).
 *
 * Внешняя запись авторитетна: элементы, не представленные в значении (включая
 * незавершённые загрузки), выбывают — их abort-очистку делает хук. Существующие
 * элементы матчятся, чтобы сохранить `key` (превью, DOM-стабильность):
 * в `'local'`-режиме — по ссылке `File`, в `'remote'` — по `remote.id`
 * (незнакомый дескриптор становится `uploaded`-элементом без `file` — preloaded
 * при редактировании формы).
 *
 * @param items - Текущий список.
 * @param value - Внешнее значение поля.
 * @param mode - Режим проекции.
 * @param makeKey - Генератор ключей для новых `File` (у ключей hook-счётчик).
 * @returns Новый список.
 */
export function reconcileItems(
  items: FileUploadItem[],
  value: FileUploadValue,
  mode: 'local' | 'remote',
  makeKey: (file: File) => string
): FileUploadItem[] {
  if (value === null || value.length === 0) return [];

  if (mode === 'remote') {
    return (value as RemoteFileRef[]).map((ref) => {
      const found = items.find((item) => item.status === 'uploaded' && item.remote.id === ref.id);
      return found ?? { key: `remote:${ref.id}`, status: 'uploaded', remote: ref };
    });
  }

  return (value as File[]).map((file) => {
    const found = items.find((item) => item.file === file);
    return found ?? { key: makeKey(file), status: 'local', file };
  });
}

// ============================================================================
// Утилиты
// ============================================================================

/**
 * Стабильный уникальный ключ элемента. Уникальность даёт `seq` (сквозной счётчик
 * хука) — метаданные в ключе нужны только для отладки.
 */
export function fileItemKey(file: File, seq: number): string {
  return `${seq}:${file.name}:${file.size}:${file.lastModified ?? ''}`;
}

const SIZE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const;

/**
 * Человекочитаемый размер файла: `1024`-base, одна цифра после точки, без хвоста `.0`.
 *
 * @example
 * ```ts
 * formatFileSize(512);        // '512 Б'
 * formatFileSize(1536);       // '1.5 КБ'
 * formatFileSize(5_242_880);  // '5 МБ'
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < SIZE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? size : Math.round(size * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${SIZE_UNITS[unit]}`;
}

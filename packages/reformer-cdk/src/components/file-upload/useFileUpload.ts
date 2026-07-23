import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import {
  fileItemKey,
  fileUploadReducer,
  initialFileUploadState,
  makeFileError,
  projectValue,
  reconcileItems,
  selectFiles,
  type FileUploadAction,
  type FileUploadState,
} from './file-upload-core';
import type { FileRejection, FileUploadItem, FileUploadValue, UseFileUploadOptions } from './types';

/** Идентификаторы, которыми связываются зона, hidden input и live-регион статусов. */
export interface FileUploadIds {
  root: string;
  hiddenInput: string;
  dropzone: string;
  liveRegion: string;
}

/** Visually hidden, но фокусируемый (не `display:none` — скринридеры и focus() работают). */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Пропсы контейнера: data-атрибуты для CSS и e2e. */
export interface FileUploadRootPropGetters {
  id: string;
  'data-dragging'?: true;
  'data-disabled'?: true;
}

/** Пропсы дроп-зоны: доступная кнопка (клик/Enter/Space → пикер) + drag/paste-каналы. */
export interface FileUploadDropzonePropGetters {
  id: string;
  role: 'button';
  tabIndex: number;
  'aria-disabled'?: true;
  'data-dragging'?: true;
  'data-disabled'?: true;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onFocus: (e: FocusEvent) => void;
  onBlur: (e: FocusEvent) => void;
  onDragEnter?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onPaste?: (e: ClipboardEvent) => void;
}

/** Возвращаемое значение {@link useFileUpload}. */
export interface UseFileUploadReturn {
  /** Текущий список файлов (все статусы). */
  items: FileUploadItem[];
  /** Отклонённые последним отбором. */
  rejections: FileRejection[];
  /** Файл тащат над зоной (drag-counter — вложенные элементы не «мигают»). */
  dragging: boolean;
  /** Дроп-зона в фокусе. */
  focused: boolean;
  disabled: boolean;
  /** Лимит файлов достигнут (триггеры можно дизейблить). */
  maxFilesReached: boolean;
  /** Есть незавершённые загрузки (блокировка submit). */
  uploading: boolean;
  /** Сообщение для aria-live региона (обновляется на выбор/загрузку/ошибки). */
  liveMessage: string;
  ids: FileUploadIds;

  openFilePicker: () => void;
  addFiles: (files: File[]) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  retry: (key: string) => void;
  abort: (key?: string) => void;
  /** Сфокусировать hidden input («подсветить невалидное поле»). */
  focus: () => void;
  /**
   * Managed object URL превью: создаётся лениво, revoke при удалении элемента и
   * unmount. Для `uploaded` без локального `file` возвращает `remote.url`.
   */
  getPreviewUrl: (key: string) => string | null;

  getRootProps: () => FileUploadRootPropGetters;
  getDropzoneProps: () => FileUploadDropzonePropGetters;
  getTriggerProps: () => {
    type: 'button';
    disabled: boolean;
    onClick: () => void;
  };
  getHiddenInputProps: () => Record<string, unknown> & { ref: Ref<HTMLInputElement> };
  getItemGroupProps: () => { role: 'list' };
  getItemProps: (item: FileUploadItem) => { role: 'listitem'; 'data-status': string };
  getItemDeleteTriggerProps: (item: FileUploadItem) => {
    type: 'button';
    'aria-label': string;
    disabled: boolean;
    onClick: () => void;
  };
  getItemRetryTriggerProps: (item: FileUploadItem) => {
    type: 'button';
    'aria-label': string;
    onClick: () => void;
  };
  getClearTriggerProps: () => { type: 'button'; disabled: boolean; onClick: () => void };
  getLiveRegionProps: () => {
    id: string;
    role: 'status';
    'aria-live': 'polite';
    style: CSSProperties;
  };
}

/** Имя элемента для aria-label и live-сообщений. */
function itemName(item: FileUploadItem): string {
  return item.status === 'uploaded' ? (item.file?.name ?? item.remote.name) : item.file.name;
}

/** Сравнение значений поля по содержимому (элементы — по identity: File и ref стабильны). */
function sameValue(a: FileUploadValue | undefined, b: FileUploadValue | undefined): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * Headless-хук выбора и загрузки файлов: собственный список с семантикой «добавить»
 * (нативный input каждый выбор ЗАМЕНЯЕТ `files` — поэтому input очищается после
 * каждого change), отбор кандидатов (accept/размер/количество/дубликаты), drag-and-drop,
 * paste, опциональная immediate-загрузка через инжектируемый `uploader` и prop-getters
 * для всех частей разметки.
 *
 * Используется самим `FileUpload.Root`, но пригоден и отдельно, когда compound-дерево
 * избыточно.
 *
 * @param options - См. {@link UseFileUploadOptions}.
 * @returns Состояние, действия и prop-getters — {@link UseFileUploadReturn}.
 *
 * @example Ручная разметка без compound-дерева
 * ```tsx
 * import { useFileUpload } from '@reformer/cdk/file-upload';
 *
 * function Uploader({ value, onChange }: Props) {
 *   const f = useFileUpload({ value, onChange, accept: 'image/*', multiple: true });
 *   return (
 *     <div {...f.getRootProps()}>
 *       <input {...f.getHiddenInputProps()} />
 *       <div {...f.getDropzoneProps()} aria-label="Загрузка изображений">
 *         Перетащите файлы или нажмите
 *       </div>
 *       <ul {...f.getItemGroupProps()}>
 *         {f.items.map((item) => (
 *           <li key={item.key} {...f.getItemProps(item)}>
 *             {item.file?.name}
 *             <button {...f.getItemDeleteTriggerProps(item)}>×</button>
 *           </li>
 *         ))}
 *       </ul>
 *       <div {...f.getLiveRegionProps()}>{f.liveMessage}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileUpload(options: UseFileUploadOptions): UseFileUploadReturn {
  const {
    value,
    disabled = false,
    accept,
    multiple = false,
    maxFiles,
    allowDrop = true,
    allowPaste = false,
    capture,
    uploader,
    autoUpload = true,
    id,
  } = options;

  const mode: 'local' | 'remote' = uploader ? 'remote' : 'local';

  const seqRef = useRef(0);
  const makeKey = useCallback((file: File) => fileItemKey(file, ++seqRef.current), []);

  // Ленивая инициализация из value: SSR и первый рендер сразу показывают preloaded-файлы
  // (controlled-sync живёт в эффекте, а эффекты в SSR не выполняются).
  const [state, dispatch] = useReducer(fileUploadReducer, undefined, () =>
    value != null && value.length > 0
      ? { items: reconcileItems([], value, uploader ? 'remote' : 'local', makeKey), rejections: [] }
      : initialFileUploadState()
  );
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');

  // Опции читаются через ref: колбэки консумента — инлайновые стрелки, а действия
  // (addFiles/removeItem/…) должны быть стабильными (иначе контекст пересоздаётся).
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Зеркало state: действия вычисляют следующий state синхронно (редьюсер чистый),
  // чтобы эмитить onChange с актуальной проекцией, не дожидаясь ре-рендера.
  const stateRef = useRef<FileUploadState>(state);
  stateRef.current = state;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const controllersRef = useRef(new Map<string, AbortController>());
  const previewUrlsRef = useRef(new Map<string, string>());
  const dragCounterRef = useRef(0);
  /** Последнее отэмиченное значение — guard от эха собственного onChange. */
  const lastEmittedRef = useRef<FileUploadValue | undefined>(undefined);

  const reactId = useId();
  const baseId = id ?? reactId;
  const ids = useMemo<FileUploadIds>(
    () =>
      Object.freeze({
        root: `file-upload-${baseId}`,
        hiddenInput: `file-upload-input-${baseId}`,
        dropzone: `file-upload-dropzone-${baseId}`,
        liveRegion: `file-upload-live-${baseId}`,
      }),
    [baseId]
  );

  /** Синхронный переход: обновить зеркало и продублировать действие в React-state. */
  const apply = useCallback((action: FileUploadAction): FileUploadState => {
    const next = fileUploadReducer(stateRef.current, action);
    stateRef.current = next;
    dispatch(action);
    return next;
  }, []);

  const revokePreview = useCallback((key: string) => {
    const url = previewUrlsRef.current.get(key);
    if (url !== undefined) {
      previewUrlsRef.current.delete(key);
      URL.revokeObjectURL(url);
    }
  }, []);

  // mode зависит от наличия uploader; в колбэках читаем через ref, чтобы не плодить зависимости.
  const uploaderRef = useRef(uploader);
  uploaderRef.current = uploader;

  /** Эмит значения формы, если проекция изменилась (guard от лишних onChange). */
  const emit = useCallback((items: FileUploadItem[]) => {
    const next = projectValue(items, uploaderRef.current ? 'remote' : 'local');
    if (sameValue(next, lastEmittedRef.current)) return;
    lastEmittedRef.current = next;
    optionsRef.current.onChange?.(next);
  }, []);

  // ── Загрузка ──────────────────────────────────────────────────────────────

  const startUpload = useCallback(
    (key: string, file: File) => {
      const upload = uploaderRef.current;
      if (!upload) return;
      const controller = new AbortController();
      controllersRef.current.set(key, controller);
      apply({ kind: 'upload-start', key });

      let lastProgressAt = 0;
      const onProgress = (percent: number) => {
        // Троттлинг: пишем в state не чаще ~10 раз/с (100% — всегда).
        const now = Date.now();
        if (percent < 100 && now - lastProgressAt < 100) return;
        lastProgressAt = now;
        apply({ kind: 'upload-progress', key, percent });
      };

      upload(file, { onProgress, signal: controller.signal }).then(
        (remote) => {
          controllersRef.current.delete(key);
          const next = apply({ kind: 'upload-success', key, remote });
          const item = next.items.find((i) => i.key === key);
          if (item?.status === 'uploaded') {
            optionsRef.current.onUploadSuccess?.(item);
            setLiveMessage(`Файл ${file.name} загружен`);
            emit(next.items);
          }
        },
        (err: unknown) => {
          controllersRef.current.delete(key);
          const aborted =
            controller.signal.aborted || (err instanceof Error && err.name === 'AbortError');
          const error = aborted
            ? makeFileError('uploadAborted', { fileName: file.name })
            : makeFileError('uploadFailed', {
                fileName: file.name,
                reason: err instanceof Error ? err.message : String(err),
              });
          // Если элемент уже удалён (removeItem прервал загрузку) — no-op редьюсера.
          const next = apply({ kind: 'upload-error', key, error });
          const item = next.items.find((i) => i.key === key);
          if (item?.status === 'error') {
            optionsRef.current.onUploadError?.(item);
            setLiveMessage(
              aborted ? `Загрузка ${file.name} прервана` : `Ошибка загрузки ${file.name}`
            );
          }
        }
      );
    },
    [apply, emit]
  );

  // Очередь: каждый `local`-элемент без активного контроллера уходит в загрузку.
  useEffect(() => {
    if (!uploader || !autoUpload) return;
    for (const item of state.items) {
      if (item.status === 'local' && !controllersRef.current.has(item.key)) {
        startUpload(item.key, item.file);
      }
    }
  }, [state.items, uploader, autoUpload, startUpload]);

  // ── Действия ──────────────────────────────────────────────────────────────

  const addFiles = useCallback(
    (files: File[]) => {
      const opts = optionsRef.current;
      if (opts.disabled || files.length === 0) return;
      const replace = !(opts.multiple ?? false);
      const existing = replace ? [] : stateRef.current.items;
      const { accepted, rejected } = selectFiles(
        files,
        {
          accept: opts.accept,
          multiple: opts.multiple,
          maxFiles: opts.maxFiles,
          maxFileSize: opts.maxFileSize,
          minFileSize: opts.minFileSize,
          maxTotalFileSize: opts.maxTotalFileSize,
          preventDuplicates: opts.preventDuplicates,
          validate: opts.validate,
        },
        existing
      );
      if (replace) {
        // Замена: прежние элементы выбывают — прерываем их загрузки и чистим превью.
        for (const item of stateRef.current.items) {
          controllersRef.current.get(item.key)?.abort();
          controllersRef.current.delete(item.key);
          revokePreview(item.key);
        }
      }
      const keys = accepted.map(makeKey);
      const next = apply({ kind: 'add', accepted, keys, rejected, replace });
      if (accepted.length > 0) {
        opts.onAccept?.(accepted);
        setLiveMessage(
          accepted.length === 1
            ? `Файл ${accepted[0].name} добавлен`
            : `Добавлено файлов: ${accepted.length}`
        );
      }
      if (rejected.length > 0) {
        opts.onReject?.(rejected);
        setLiveMessage(
          rejected.length === 1
            ? `Файл ${rejected[0].file.name} отклонён`
            : `Отклонено файлов: ${rejected.length}`
        );
      }
      emit(next.items);
    },
    [apply, emit, makeKey, revokePreview]
  );

  const removeItem = useCallback(
    (key: string) => {
      // Удаление = отказ от файла: активная загрузка прерывается молча.
      controllersRef.current.get(key)?.abort();
      controllersRef.current.delete(key);
      revokePreview(key);
      const item = stateRef.current.items.find((i) => i.key === key);
      const next = apply({ kind: 'remove', key });
      if (item) setLiveMessage(`Файл ${itemName(item)} удалён`);
      emit(next.items);
    },
    [apply, emit, revokePreview]
  );

  const clear = useCallback(() => {
    for (const [, controller] of controllersRef.current) controller.abort();
    controllersRef.current.clear();
    for (const [key] of previewUrlsRef.current) revokePreview(key);
    const next = apply({ kind: 'clear' });
    setLiveMessage('Список файлов очищен');
    emit(next.items);
  }, [apply, emit, revokePreview]);

  const retry = useCallback(
    (key: string) => {
      // error → local; очередь подхватит и перезапустит загрузку.
      apply({ kind: 'retry', key });
    },
    [apply]
  );

  const abort = useCallback((key?: string) => {
    if (key !== undefined) {
      controllersRef.current.get(key)?.abort();
      return;
    }
    for (const [, controller] of controllersRef.current) controller.abort();
  }, []);

  const openFilePicker = useCallback(() => {
    if (optionsRef.current.disabled) return;
    inputRef.current?.click();
  }, []);

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const getPreviewUrl = useCallback((key: string): string | null => {
    const item = stateRef.current.items.find((i) => i.key === key);
    if (!item) return null;
    if (!item.file) return item.status === 'uploaded' ? (item.remote.url ?? null) : null;
    const cached = previewUrlsRef.current.get(key);
    if (cached !== undefined) return cached;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const url = URL.createObjectURL(item.file);
    previewUrlsRef.current.set(key, url);
    return url;
  }, []);

  // ── Controlled sync ───────────────────────────────────────────────────────

  useEffect(() => {
    if (value === undefined) return; // uncontrolled
    if (sameValue(value, lastEmittedRef.current)) return; // эхо собственного onChange
    // Уже согласовано (в т.ч. ленивой инициализацией) — не пересобираем список:
    // иначе на mount сбрасывались бы незавершённые загрузки.
    if (sameValue(value, projectValue(stateRef.current.items, mode))) {
      lastEmittedRef.current = value;
      return;
    }
    const next = reconcileItems(stateRef.current.items, value, mode, makeKey);
    // Выбывшие элементы: прервать загрузки, отпустить превью.
    const kept = new Set(next.map((i) => i.key));
    for (const item of stateRef.current.items) {
      if (kept.has(item.key)) continue;
      controllersRef.current.get(item.key)?.abort();
      controllersRef.current.delete(item.key);
      revokePreview(item.key);
    }
    apply({ kind: 'sync-items', items: next });
    lastEmittedRef.current = projectValue(next, mode);
  }, [value, mode, apply, makeKey, revokePreview]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const controllers = controllersRef.current;
    const previews = previewUrlsRef.current;
    return () => {
      for (const [, controller] of controllers) controller.abort();
      controllers.clear();
      for (const [, url] of previews) URL.revokeObjectURL(url);
      previews.clear();
    };
  }, []);

  // Событие cancel пикера (Chrome 113+/Safari 16.4+): снять фокус-ожидание, пометить touched.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onCancel = () => optionsRef.current.onBlur?.();
    input.addEventListener('cancel', onCancel);
    return () => input.removeEventListener('cancel', onCancel);
  }, []);

  useEffect(() => {
    optionsRef.current.onFilesChange?.(state.items);
  }, [state.items]);

  // ── Prop getters ──────────────────────────────────────────────────────────

  const getRootProps = useCallback(
    (): FileUploadRootPropGetters => ({
      id: ids.root,
      // Булевы data-атрибуты — только `true | undefined`: `false` отрендерился бы
      // строкой "false" и сломал бы селекторы вида [data-dragging].
      'data-dragging': dragging || undefined,
      'data-disabled': disabled || undefined,
    }),
    [ids, dragging, disabled]
  );

  const resetDrag = useCallback(() => {
    dragCounterRef.current = 0;
    setDragging(false);
  }, []);

  const getDropzoneProps = useCallback((): FileUploadDropzonePropGetters => {
    const props: FileUploadDropzonePropGetters = {
      id: ids.dropzone,
      role: 'button',
      tabIndex: disabled ? -1 : 0,
      'aria-disabled': disabled || undefined,
      'data-dragging': dragging || undefined,
      'data-disabled': disabled || undefined,
      onClick: openFilePicker,
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFilePicker();
        }
      },
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        optionsRef.current.onBlur?.();
      },
    };
    if (allowDrop && !disabled) {
      props.onDragEnter = (e) => {
        e.preventDefault();
        // В dragenter/dragover файлы недоступны (protected mode) — подсвечиваем по kind.
        if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
        dragCounterRef.current += 1;
        setDragging(true);
      };
      props.onDragOver = (e) => {
        // Без preventDefault drop не сработает и браузер откроет файл сам.
        e.preventDefault();
      };
      props.onDragLeave = () => {
        // Счётчик, не boolean: dragleave стреляет на каждом вложенном элементе.
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) setDragging(false);
      };
      props.onDrop = (e) => {
        e.preventDefault();
        resetDrag();
        const files = Array.from(e.dataTransfer?.files ?? []);
        if (files.length > 0) addFiles(files);
        optionsRef.current.onBlur?.();
      };
    }
    if (allowPaste && !disabled) {
      props.onPaste = (e) => {
        const files = Array.from(e.clipboardData?.files ?? []);
        if (files.length > 0) {
          e.preventDefault();
          addFiles(files);
        }
      };
    }
    return props;
  }, [ids, disabled, dragging, allowDrop, allowPaste, openFilePicker, addFiles, resetDrag]);

  const getTriggerProps = useCallback(
    () => ({ type: 'button' as const, disabled, onClick: openFilePicker }),
    [disabled, openFilePicker]
  );

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      // Нативный input ЗАМЕНЯЕТ files каждым выбором и не эмитит change на тот же
      // файл — очистка возвращает семантику «добавить» и повторный выбор.
      e.target.value = '';
      if (files.length > 0) addFiles(files);
      optionsRef.current.onBlur?.();
    },
    [addFiles]
  );

  const getHiddenInputProps = useCallback(
    () => ({
      ref: inputRef as Ref<HTMLInputElement>,
      id: ids.hiddenInput,
      type: 'file' as const,
      accept,
      multiple,
      capture,
      disabled,
      tabIndex: -1,
      'aria-hidden': true as const,
      style: VISUALLY_HIDDEN,
      onChange: onInputChange,
    }),
    [ids, accept, multiple, capture, disabled, onInputChange]
  );

  const getItemGroupProps = useCallback(() => ({ role: 'list' as const }), []);

  const getItemProps = useCallback(
    (item: FileUploadItem) => ({
      role: 'listitem' as const,
      'data-status': item.status,
    }),
    []
  );

  const getItemDeleteTriggerProps = useCallback(
    (item: FileUploadItem) => ({
      type: 'button' as const,
      'aria-label': `Удалить файл ${itemName(item)}`,
      disabled,
      onClick: () => removeItem(item.key),
    }),
    [disabled, removeItem]
  );

  const getItemRetryTriggerProps = useCallback(
    (item: FileUploadItem) => ({
      type: 'button' as const,
      'aria-label': `Повторить загрузку файла ${itemName(item)}`,
      onClick: () => retry(item.key),
    }),
    [retry]
  );

  const getClearTriggerProps = useCallback(
    () => ({
      type: 'button' as const,
      disabled: disabled || state.items.length === 0,
      onClick: clear,
    }),
    [disabled, state.items.length, clear]
  );

  const getLiveRegionProps = useCallback(
    () => ({
      id: ids.liveRegion,
      role: 'status' as const,
      'aria-live': 'polite' as const,
      style: VISUALLY_HIDDEN,
    }),
    [ids]
  );

  const capacity = multiple ? (maxFiles ?? Infinity) : 1;
  const uploading = state.items.some((item) => item.status === 'uploading');

  return {
    items: state.items,
    rejections: state.rejections,
    dragging,
    focused,
    disabled,
    maxFilesReached: state.items.length >= capacity,
    uploading,
    liveMessage,
    ids,
    openFilePicker,
    addFiles,
    removeItem,
    clear,
    retry,
    abort,
    focus,
    getPreviewUrl,
    getRootProps,
    getDropzoneProps,
    getTriggerProps,
    getHiddenInputProps,
    getItemGroupProps,
    getItemProps,
    getItemDeleteTriggerProps,
    getItemRetryTriggerProps,
    getClearTriggerProps,
    getLiveRegionProps,
  };
}

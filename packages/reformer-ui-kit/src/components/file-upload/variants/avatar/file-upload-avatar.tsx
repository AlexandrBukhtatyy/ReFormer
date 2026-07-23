import * as React from 'react';
import { CameraIcon, XIcon } from 'lucide-react';
import {
  FileUpload as CdkFileUpload,
  useFileUploadContext,
  type FileUploadHandle,
} from '@reformer/cdk/file-upload';
import { useValidationErrorResolver } from '@reformer/cdk';

import { cn } from '@/lib/utils';
import { makeElementFieldHandle } from '@/fields/field-handle';
import {
  splitFileUploadProps,
  type FileUploadBaseProps,
  type FileUploadFieldHandle,
} from '../base/file-upload-base';

/** Props avatar-варианта: single-файл, только изображения по умолчанию. */
export interface FileUploadAvatarProps extends Omit<
  FileUploadBaseProps,
  'multiple' | 'maxFiles' | 'allowPaste' | 'hint' | 'placeholder'
> {
  /** Форма превью. @default 'circle' */
  shape?: 'circle' | 'square';
  /** Доступное имя зоны (aria-label; текста у зоны нет). @default 'Загрузить изображение' */
  label?: string;
}

/** Внутренность зоны: превью/плейсхолдер + статусы. Читает контекст CDK Root. */
function AvatarSurface() {
  const { items, getPreviewUrl } = useFileUploadContext();
  const resolveError = useValidationErrorResolver();
  const item = items[0];
  const url = item ? getPreviewUrl(item.key) : null;

  return (
    <>
      {url ? (
        <img
          src={url}
          alt=""
          className={cn('size-full object-cover', item?.status === 'uploading' && 'opacity-60')}
        />
      ) : (
        <CameraIcon className="size-6 text-muted-foreground" />
      )}
      {item?.status === 'uploading' && (
        <span
          data-slot="file-upload-avatar-progress"
          className="absolute inset-0 flex items-center justify-center bg-background/50 text-xs font-medium"
        >
          {Math.round(item.progress)}%
        </span>
      )}
      {item?.status === 'error' && (
        <span
          data-slot="file-upload-avatar-error"
          title={resolveError(item.error)}
          className="absolute inset-x-0 bottom-0 bg-destructive/80 px-1 py-0.5 text-center text-[10px] text-white"
        >
          Ошибка
        </span>
      )}
    </>
  );
}

/**
 * Кнопка удаления — СНАРУЖИ зоны (сосед, не потомок): внутри зоны её обрезал бы
 * `overflow-hidden` круга, а клик перехватывала бы кликабельная зона-пикер.
 */
function AvatarDeleteButton() {
  const { items, removeItem, disabled } = useFileUploadContext();
  const item = items[0];
  if (!item || disabled) return null;
  const name = item.status === 'uploaded' ? (item.file?.name ?? item.remote.name) : item.file.name;

  return (
    <button
      type="button"
      aria-label={`Удалить файл ${name}`}
      onClick={() => removeItem(item.key)}
      className={cn(
        'absolute -top-1 -right-1 z-10 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors',
        'hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 outline-none'
      )}
    >
      <XIcon className="size-3" />
    </button>
  );
}

/**
 * FileUpload (вариант `avatar`) — одиночное изображение с превью: круглая/квадратная
 * кликабельная зона (клик/drop/Enter — выбрать или заменить), оверлеи прогресса и
 * ошибки, кнопка удаления. `accept` по умолчанию `image/*`, файл всегда один
 * (новый выбор заменяет текущий).
 */
export function FileUploadAvatar({
  ref,
  shape = 'circle',
  ...props
}: FileUploadAvatarProps & Record<string, unknown> & { ref?: React.Ref<FileUploadFieldHandle> }) {
  const { options, label, invalid, className, id, rest } = splitFileUploadProps(props);
  const cdkOptions = { ...options, accept: options.accept ?? 'image/*', multiple: false };

  const cdkRef = React.useRef<FileUploadHandle>(null);
  const zoneRef = React.useRef<HTMLElement | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      ...makeElementFieldHandle(zoneRef),
      openFilePicker: () => cdkRef.current?.openFilePicker(),
      clear: () => cdkRef.current?.clear(),
      abort: () => cdkRef.current?.abort(),
    }),
    []
  );

  return (
    <div
      data-slot="file-upload"
      data-variant="avatar"
      data-shape={shape}
      className={cn('relative w-fit', className)}
    >
      <CdkFileUpload.Root ref={cdkRef} {...cdkOptions} id={id}>
        <CdkFileUpload.Dropzone
          ref={zoneRef}
          id={id}
          aria-label={label ?? 'Загрузить изображение'}
          // Явный `invalid` — до rest: aria-invalid от FormField (ошибка валидации) главнее.
          aria-invalid={invalid || undefined}
          {...rest}
          className={cn(
            'relative flex size-20 cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-input bg-muted transition-colors outline-none',
            shape === 'circle' ? 'rounded-full' : 'rounded-xl',
            'hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50',
            'data-[dragging]:border-ring data-[dragging]:bg-muted/50',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            'aria-[invalid=true]:border-destructive'
          )}
        >
          <AvatarSurface />
        </CdkFileUpload.Dropzone>
        <AvatarDeleteButton />
      </CdkFileUpload.Root>
    </div>
  );
}

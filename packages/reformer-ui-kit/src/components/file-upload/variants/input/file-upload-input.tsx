import * as React from 'react';
import { PaperclipIcon, XIcon } from 'lucide-react';
import {
  FileUpload as CdkFileUpload,
  useFileUploadContext,
  type FileUploadHandle,
  type FileUploadItemData,
} from '@reformer/cdk/file-upload';
import { useValidationErrorResolver } from '@reformer/cdk';

import { cn } from '@/lib/utils';
import { makeElementFieldHandle } from '@/fields/field-handle';
import {
  splitFileUploadProps,
  type FileUploadBaseProps,
  type FileUploadFieldHandle,
} from '../base/file-upload-base';

export type FileUploadInputProps = FileUploadBaseProps;

function itemName(item: FileUploadItemData): string {
  return item.status === 'uploaded' ? (item.file?.name ?? item.remote.name) : item.file.name;
}

/** Текст внутри «инпута»: имена выбранных файлов либо placeholder. Читает контекст CDK Root. */
function InputValueText({ placeholder }: { placeholder: string }) {
  const { items } = useFileUploadContext();
  if (items.length === 0) {
    return (
      <span data-slot="file-upload-placeholder" className="truncate text-muted-foreground">
        {placeholder}
      </span>
    );
  }
  return (
    <span data-slot="file-upload-value-text" className="truncate">
      {items.map(itemName).join(', ')}
    </span>
  );
}

/** Кнопка очистки (крестик) — видна только при выбранных файлах. Сосед зоны, не потомок. */
function InputClearButton() {
  const { items, clear, disabled } = useFileUploadContext();
  if (items.length === 0 || disabled) return null;
  return (
    <button
      type="button"
      aria-label="Очистить выбранные файлы"
      onClick={clear}
      className="pointer-events-auto flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <XIcon className="size-4" />
    </button>
  );
}

/** Отклонения последнего отбора — компактный текст под полем. */
function InputRejections() {
  const { rejections } = useFileUploadContext();
  const resolveError = useValidationErrorResolver();
  if (rejections.length === 0) return null;
  return (
    <ul
      data-slot="file-upload-rejections"
      className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-destructive"
    >
      {rejections.map((rejection, i) => (
        <li key={`${rejection.file.name}-${i}`}>
          {rejection.file.name}: {resolveError(rejection.errors[0])}
        </li>
      ))}
    </ul>
  );
}

/**
 * FileUpload (вариант `input`) — поле в виде текстового инпута с кнопкой-иконкой
 * (скрепка): клик по полю или иконке открывает пикер, drop на поле принимает файлы,
 * выбранные имена показываются внутри строкой, крестик очищает выбор. Списка-превью
 * нет — компактный вариант для форм, где вложения второстепенны.
 *
 * `aria-*`/`id` из FormField ложатся на зону; `invalid` (или aria-invalid от FormField)
 * подсвечивает рамку как у Input.
 */
export function FileUploadInput({
  ref,
  ...props
}: FileUploadInputProps & Record<string, unknown> & { ref?: React.Ref<FileUploadFieldHandle> }) {
  const { options, placeholder, hint, invalid, className, id, rest } = splitFileUploadProps(props);

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
      data-variant="input"
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
    >
      <CdkFileUpload.Root ref={cdkRef} {...options} id={id}>
        <div className="relative">
          <CdkFileUpload.Dropzone
            ref={zoneRef}
            id={id}
            // Явный `invalid` — до rest: aria-invalid от FormField (ошибка валидации) главнее.
            aria-invalid={invalid || undefined}
            {...rest}
            className={cn(
              // Визуально — Input (shadcn), но это кликабельная зона (role=button).
              'flex h-9 w-full min-w-0 cursor-pointer items-center rounded-md border border-input bg-transparent px-3 py-1 pr-16 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm dark:bg-input/30',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 dark:aria-[invalid=true]:ring-destructive/40',
              'data-[dragging]:border-ring data-[dragging]:bg-muted/50',
              'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'
            )}
          >
            <InputValueText placeholder={placeholder ?? 'Выберите файлы…'} />
          </CdkFileUpload.Dropzone>
          {/* Кнопки-иконки — СОСЕДИ зоны (не потомки role=button): клик не открывает пикер лишний раз. */}
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5">
            <InputClearButton />
            <CdkFileUpload.Trigger asChild>
              <button
                aria-label="Выбрать файлы"
                className="pointer-events-auto flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <PaperclipIcon className="size-4" />
              </button>
            </CdkFileUpload.Trigger>
          </div>
        </div>
        {hint && (
          <span data-slot="file-upload-hint" className="text-xs text-muted-foreground">
            {hint}
          </span>
        )}
        <InputRejections />
      </CdkFileUpload.Root>
    </div>
  );
}

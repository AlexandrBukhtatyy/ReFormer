import * as React from 'react';
import { UploadIcon } from 'lucide-react';
import {
  FileUpload as CdkFileUpload,
  type FileUploadHandle,
  type UseFileUploadOptions,
} from '@reformer/cdk/file-upload';

import { cn } from '@/lib/utils';
import { Button } from '@/components/button';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { FileUploadItemList } from './file-upload-item-list';

/**
 * Императивный handle field-версий FileUpload: baseline {@link FieldHandle}
 * (focus/blur/scrollIntoView/getElement от интерактивного элемента) + управление
 * пикером и списком. Достаётся из render-схемы:
 * `schema.node('documents').getRef<FileUploadFieldHandle>().current?.openFilePicker()`.
 */
export interface FileUploadFieldHandle extends FieldHandle {
  /** Открыть системный пикер файлов. */
  openFilePicker(): void;
  /** Очистить список (активные загрузки прерываются). */
  clear(): void;
  /** Прервать все активные загрузки (элементы остаются с ошибкой `uploadAborted`). */
  abort(): void;
}

/** Общие props вариантов FileUpload: опции CDK-хука + презентационные. */
export interface FileUploadBaseProps extends Omit<UseFileUploadOptions, 'id'> {
  /**
   * Подпись поля — конвенция FormField (`componentProps.label` рендерит обёртка).
   * Сам компонент её НЕ отображает (иначе текст дублировался бы), только снимает из DOM-spread.
   */
  label?: string;
  /** Видимый текст триггера/зоны. @default 'Выбрать файлы' (button) */
  placeholder?: string;
  /** Подсказка под триггером (ограничения: типы, размер). */
  hint?: string;
  /**
   * Явно пометить поле невалидным (стилизация рамки у dropzone/input/avatar).
   * Под FormField не нужен: обёртка сама передаёт `aria-invalid` при ошибке валидации.
   * Вариант button внешний вид не меняет — ошибку показывает FormField.Error.
   */
  invalid?: boolean;
  /** Доп. CSS-класс контейнера. */
  className?: string;
  id?: string;
}

/** Собирает опции CDK-хука из props варианта, отделяя презентационные и DOM-rest. */
export function splitFileUploadProps(props: FileUploadBaseProps & Record<string, unknown>) {
  const {
    value,
    onChange,
    onBlur,
    disabled,
    accept,
    multiple,
    maxFiles,
    maxFileSize,
    minFileSize,
    maxTotalFileSize,
    preventDuplicates,
    validate,
    allowDrop,
    allowPaste,
    capture,
    uploader,
    autoUpload,
    onFilesChange,
    onAccept,
    onReject,
    onUploadSuccess,
    onUploadError,
    label,
    placeholder,
    hint,
    invalid,
    className,
    id,
    ...rest
  } = props;
  const options: UseFileUploadOptions = {
    value,
    onChange,
    onBlur,
    disabled,
    accept,
    multiple,
    maxFiles,
    maxFileSize,
    minFileSize,
    maxTotalFileSize,
    preventDuplicates,
    validate,
    allowDrop,
    allowPaste,
    capture,
    uploader,
    autoUpload,
    onFilesChange,
    onAccept,
    onReject,
    onUploadSuccess,
    onUploadError,
    id,
  };
  return { options, label, placeholder, hint, invalid, className, id, rest };
}

/**
 * FileUpload (вариант `button`) — компактное поле загрузки файлов: кнопка «Выбрать
 * файлы» + список выбранных на презентационном `Attachment`. Controlled по seam
 * (`value`/`onChange`/`onBlur`/`disabled`); поведение целиком в
 * `@reformer/cdk/file-upload`.
 *
 * `aria-*`/`id` из FormField ложатся на кнопку-триггер (rest-spread).
 */
export function FileUploadBase({
  ref,
  ...props
}: FileUploadBaseProps & Record<string, unknown> & { ref?: React.Ref<FileUploadFieldHandle> }) {
  const { options, placeholder, hint, className, id, rest } = splitFileUploadProps(props);

  const cdkRef = React.useRef<FileUploadHandle>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      ...makeElementFieldHandle(triggerRef),
      openFilePicker: () => cdkRef.current?.openFilePicker(),
      clear: () => cdkRef.current?.clear(),
      abort: () => cdkRef.current?.abort(),
    }),
    []
  );

  return (
    <div
      data-slot="file-upload"
      data-variant="button"
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <CdkFileUpload.Root ref={cdkRef} {...options} id={id}>
        <div className="flex items-center gap-3">
          <CdkFileUpload.Trigger asChild>
            {/* id — на интерактивном элементе: клик по <label htmlFor> фокусирует кнопку. */}
            <Button ref={triggerRef} id={id} variant="outline" {...rest}>
              <UploadIcon />
              {placeholder ?? 'Выбрать файлы'}
            </Button>
          </CdkFileUpload.Trigger>
          {hint && (
            <span data-slot="file-upload-hint" className="text-xs text-muted-foreground">
              {hint}
            </span>
          )}
        </div>
        <FileUploadItemList />
      </CdkFileUpload.Root>
    </div>
  );
}

import * as React from 'react';
import { UploadCloudIcon } from 'lucide-react';
import { FileUpload as CdkFileUpload, type FileUploadHandle } from '@reformer/cdk/file-upload';

import { cn } from '@/lib/utils';
import { useFieldTooltip } from '@/fields/field-tooltip';
import { makeElementFieldHandle } from '@/fields/field-handle';
import { defineFieldControl } from '@/fields/field-control';
import { fileUploadAdapter } from '../base/file-upload-base';
import {
  splitFileUploadProps,
  type FileUploadBaseProps,
  type FileUploadFieldHandle,
} from '../base/file-upload-base';
import { FileUploadItemList } from '../base/file-upload-item-list';

export type FileUploadDropzoneProps = FileUploadBaseProps;

/**
 * FileUpload (вариант `dropzone`) — зона drag-and-drop: рамка с подсветкой состояния
 * (`data-dragging` из CDK), клик и Enter/Space открывают пикер (drop — не единственный
 * канал). Список файлов — тот же `FileUploadItemList`, что в варианте `button`.
 *
 * `aria-*`/`id` из FormField ложатся на зону (rest-spread).
 */
export function FileUploadDropzone({
  ref,
  ...props
}: FileUploadDropzoneProps & Record<string, unknown> & { ref?: React.Ref<FileUploadFieldHandle> }) {
  const { options, placeholder, hint, tooltip, invalid, className, id, rest } =
    splitFileUploadProps(props);

  const tooltipHint = useFieldTooltip(tooltip, {
    id,
    describedBy: rest['aria-describedby'] as string | undefined,
    testId: rest['data-testid'] as string | undefined,
    className: 'absolute top-2 right-2 z-10',
  });

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

  const dropzone = (
    <CdkFileUpload.Dropzone
      ref={zoneRef}
      id={id}
      // Явный `invalid` — до rest: aria-invalid от FormField (ошибка валидации) главнее.
      aria-invalid={invalid || undefined}
      {...rest}
      aria-describedby={tooltipHint.describedBy}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input bg-card px-6 py-8 text-center transition-colors outline-none',
        'hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50',
        'data-[dragging]:border-ring data-[dragging]:bg-muted/50',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'aria-[invalid=true]:border-destructive'
      )}
    >
      <UploadCloudIcon className="size-6 text-muted-foreground" />
      <span className="text-sm font-medium">
        {placeholder ?? 'Перетащите файлы или нажмите для выбора'}
      </span>
      {hint && (
        <span data-slot="file-upload-hint" className="text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </CdkFileUpload.Dropzone>
  );

  // Иконка-подсказка — СОСЕД зоны (не потомок role=button), поверх её правого верхнего угла.
  const zone = tooltipHint.node ? (
    <div data-slot="field-tooltip" className="relative">
      {dropzone}
      {tooltipHint.node}
    </div>
  ) : (
    dropzone
  );

  return (
    <div
      data-slot="file-upload"
      data-variant="dropzone"
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <CdkFileUpload.Root ref={cdkRef} {...options} id={id}>
        {zone}
        <FileUploadItemList />
      </CdkFileUpload.Root>
    </div>
  );
}

// Тот же контракт значения, что у base (визуал разный) — статика адаптера.
defineFieldControl(FileUploadDropzone, { adapter: fileUploadAdapter });

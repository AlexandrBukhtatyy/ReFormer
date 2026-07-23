import { FileIcon, FileTextIcon, ImageIcon, RotateCwIcon, XIcon } from 'lucide-react';
import {
  FileUpload as CdkFileUpload,
  useFileUploadContext,
  type FileUploadItemData,
} from '@reformer/cdk/file-upload';
import { useValidationErrorResolver } from '@reformer/cdk';

import { cn } from '@/lib/utils';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/attachment';

/** Статус CDK-элемента → data-state презентационного Attachment. */
function attachmentState(status: FileUploadItemData['status']) {
  switch (status) {
    case 'uploading':
      return 'uploading' as const;
    case 'error':
      return 'error' as const;
    default:
      return 'done' as const; // local (выбран) и uploaded — файл «на месте»
  }
}

function itemMime(item: FileUploadItemData): string {
  return item.file?.type ?? (item.status === 'uploaded' ? item.remote.type : undefined) ?? '';
}

/** Иконка-фолбэк по MIME (для не-изображений превью нет — только тип). */
function MimeIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <ImageIcon />;
  if (mime === 'application/pdf' || mime.startsWith('text/')) return <FileTextIcon />;
  return <FileIcon />;
}

/**
 * Список выбранных файлов + отклонения последнего отбора. Общий кусок вариантов
 * `button` и `dropzone`: CDK-слоты (semantics, статусы, действия) + презентационный
 * `Attachment` (визуал). Рендерится ТОЛЬКО внутри `CdkFileUpload.Root`.
 */
export function FileUploadItemList({ className }: { className?: string }) {
  const { rejections } = useFileUploadContext();
  const resolveError = useValidationErrorResolver();

  return (
    <>
      <CdkFileUpload.ItemGroup
        data-slot="file-upload-item-list"
        className={cn('flex list-none flex-col gap-2 p-0', className)}
      >
        {(item) => (
          <CdkFileUpload.Item key={item.key} item={item}>
            <Attachment
              state={attachmentState(item.status)}
              size="sm"
              className="w-full max-w-none"
            >
              <AttachmentMedia variant={itemMime(item).startsWith('image/') ? 'image' : 'icon'}>
                <CdkFileUpload.ItemPreview>
                  <MimeIcon mime={itemMime(item)} />
                </CdkFileUpload.ItemPreview>
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>
                  <CdkFileUpload.ItemName />
                </AttachmentTitle>
                <AttachmentDescription>
                  {item.status === 'error' ? (
                    resolveError(item.error)
                  ) : item.status === 'uploading' ? (
                    <>
                      {Math.round(item.progress)}% · <CdkFileUpload.ItemSize />
                    </>
                  ) : (
                    <CdkFileUpload.ItemSize />
                  )}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <CdkFileUpload.ItemRetryTrigger asChild>
                  <AttachmentAction>
                    <RotateCwIcon />
                  </AttachmentAction>
                </CdkFileUpload.ItemRetryTrigger>
                <CdkFileUpload.ItemDeleteTrigger asChild>
                  <AttachmentAction>
                    <XIcon />
                  </AttachmentAction>
                </CdkFileUpload.ItemDeleteTrigger>
              </AttachmentActions>
              <CdkFileUpload.ItemProgress className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-xl bg-muted">
                {(percent) => (
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${percent}%` }}
                  />
                )}
              </CdkFileUpload.ItemProgress>
            </Attachment>
          </CdkFileUpload.Item>
        )}
      </CdkFileUpload.ItemGroup>
      {rejections.length > 0 && (
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
      )}
    </>
  );
}

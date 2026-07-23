import { FileUploadRoot } from './FileUploadRoot';
import { FileUploadTrigger } from './FileUploadTrigger';
import { FileUploadDropzone } from './FileUploadDropzone';
import { FileUploadItemGroup } from './FileUploadItemGroup';
import { FileUploadItem } from './FileUploadItem';
import { FileUploadItemPreview } from './FileUploadItemPreview';
import { FileUploadItemName } from './FileUploadItemName';
import { FileUploadItemSize } from './FileUploadItemSize';
import { FileUploadItemProgress } from './FileUploadItemProgress';
import { FileUploadItemDeleteTrigger } from './FileUploadItemDeleteTrigger';
import { FileUploadItemRetryTrigger } from './FileUploadItemRetryTrigger';
import { FileUploadClearTrigger } from './FileUploadClearTrigger';

/** Тип compound-компонента `FileUpload` со слотами. */
export type FileUploadComponent = typeof FileUploadRoot & {
  Root: typeof FileUploadRoot;
  Trigger: typeof FileUploadTrigger;
  Dropzone: typeof FileUploadDropzone;
  ItemGroup: typeof FileUploadItemGroup;
  Item: typeof FileUploadItem;
  ItemPreview: typeof FileUploadItemPreview;
  ItemName: typeof FileUploadItemName;
  ItemSize: typeof FileUploadItemSize;
  ItemProgress: typeof FileUploadItemProgress;
  ItemDeleteTrigger: typeof FileUploadItemDeleteTrigger;
  ItemRetryTrigger: typeof FileUploadItemRetryTrigger;
  ClearTrigger: typeof FileUploadClearTrigger;
};

/**
 * FileUpload — headless compound-компонент выбора и загрузки файлов.
 *
 * `<FileUpload>` — алиас `<FileUpload.Root>`; слоты доступны как свойства.
 * См. документацию по частям в {@link FileUploadRoot}.
 */
export const FileUpload = FileUploadRoot as FileUploadComponent;
FileUpload.Root = FileUploadRoot;
FileUpload.Trigger = FileUploadTrigger;
FileUpload.Dropzone = FileUploadDropzone;
FileUpload.ItemGroup = FileUploadItemGroup;
FileUpload.Item = FileUploadItem;
FileUpload.ItemPreview = FileUploadItemPreview;
FileUpload.ItemName = FileUploadItemName;
FileUpload.ItemSize = FileUploadItemSize;
FileUpload.ItemProgress = FileUploadItemProgress;
FileUpload.ItemDeleteTrigger = FileUploadItemDeleteTrigger;
FileUpload.ItemRetryTrigger = FileUploadItemRetryTrigger;
FileUpload.ClearTrigger = FileUploadClearTrigger;

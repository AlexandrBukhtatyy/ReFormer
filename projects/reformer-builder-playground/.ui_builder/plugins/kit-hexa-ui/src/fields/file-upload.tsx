/**
 * Загрузка файлов: `FileUpload` (кнопка) и `FileUploadDropzone` (область перетаскивания) — имена
 * записей ui-kit — на HexaUI `Uploader` в ручном режиме (`manual`).
 *
 * Значение модели — `File[] | null`: сами файлы, без отправки. HexaUI в ручном режиме сеть не
 * трогает (`beforeUpload` отвечает `false`) и держит список `UploadFile` — обёртка переводит его
 * в `File` и обратно ({@link uploadListOf}, {@link filesOf}). Отправить файлы — дело приложения:
 * они в значениях формы.
 *
 * Пропсы схем ui-kit здесь понимаются: `multiple`/`maxFiles` — число файлов (у HexaUI
 * `maxCount`), `hint` — требования под областью (`description`).
 *
 * Размер (`small` — кнопка, `medium` — область) обёртка задаёт явно: HexaUI объявляет его через
 * `defaultProps` функции, а React 19 такие умолчания больше не применяет.
 *
 * @module reformer/kit-hexa-ui/fields/file-upload
 */

import { useMemo, type FocusEventHandler, type ReactNode } from 'react';
import type { UploaderProps, UploadFile } from '@kaspersky/hexa-ui';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `../palette`).
import { Uploader } from '@kaspersky/hexa-ui/upload';
import { multiValueAdapter } from './adapters';
import { BlurScope } from './control';
import { filesOf, uploadListOf } from './convert';

/** Пропсы {@link FileUpload}: пропсы HexaUI `Uploader` без сети и без размера — его задаёт запись. */
export type FileUploadProps = Omit<
  UploaderProps,
  | 'fileList'
  | 'onChange'
  | 'manual'
  | 'size'
  | 'maxCount'
  | 'action'
  | 'customRequest'
  | 'headers'
  | 'method'
  | 'directory'
> & {
  value?: File[] | null;
  onChange?: (files: File[]) => void;
  onBlur?: FocusEventHandler;
  /** Можно ли выбрать несколько файлов. `false` — ровно один. */
  multiple?: boolean;
  /** Сколько файлов можно выбрать. */
  maxFiles?: number;
  /** Требования к файлам под областью (у HexaUI — `description`, он главнее). */
  hint?: ReactNode;
};

/** Пропсы {@link FileUploadDropzone} — те же, что у {@link FileUpload}. */
export type FileUploadDropzoneProps = FileUploadProps;

/** Идентификаторы файлов без своего `uid`: один файл — один идентификатор на всю жизнь. */
const uids = new WeakMap<File, string>();
let nextUid = 0;
function uidOf(file: File): string {
  let uid = uids.get(file);
  if (uid === undefined) {
    nextUid += 1;
    uid = `rf-file-${nextUid}`;
    uids.set(file, uid);
  }
  return uid;
}

/** Общая отрисовка: кнопка и область отличаются только размером HexaUI. */
function UploadField({
  value,
  onChange,
  onBlur,
  multiple,
  maxFiles,
  hint,
  description,
  size,
  ...rest
}: FileUploadProps & { size: 'small' | 'medium' }) {
  const fileList = useMemo(() => uploadListOf(value ?? [], uidOf), [value]);
  const maxCount = maxFiles ?? (multiple === false ? 1 : undefined);
  return (
    <BlurScope onBlur={onBlur}>
      <Uploader
        {...rest}
        manual
        size={size}
        maxCount={maxCount}
        description={description ?? hint}
        fileList={fileList as UploadFile[]}
        onChange={(info) => onChange?.(filesOf(info.fileList))}
      />
    </BlurScope>
  );
}

/** Загрузка файлов кнопкой: HexaUI `Uploader` размера `small`. */
export function FileUpload(props: FileUploadProps) {
  return <UploadField {...props} size="small" />;
}
FileUpload.reformerAdapter = multiValueAdapter;

/** Загрузка файлов перетаскиванием: HexaUI `Uploader` размера `medium` (область). */
export function FileUploadDropzone(props: FileUploadDropzoneProps) {
  return <UploadField {...props} size="medium" />;
}
FileUploadDropzone.reformerAdapter = multiValueAdapter;

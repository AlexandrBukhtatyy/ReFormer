/**
 * Диалоги файловых операций дерева (контекстное меню): prompt имени (создать файл/папку,
 * переименовать), подтверждение удаления, модалка «Каталог с формой» (имя + какие файлы). На
 * @reformer/ui-kit `dialog`/`checkbox`/`label`. Исполнение — экшены из `save-actions`; после сабмита
 * закрываемся. Активный диалог монтируется свежим (keyed) — локальный стейт полей сбрасывается.
 *
 * @module reformer-builder/panels/FilesDialogs
 */

import { useState } from 'react';
import { Button, Input } from '@reformer/ui-kit';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Label } from '@reformer/ui-kit/label';
import {
  createFileEntry,
  createFolderEntry,
  deleteEntry,
  generateFormDirectory,
  renameEntry,
  type FormDirFiles,
} from '../app/save-actions';

export type FilesDialog =
  | { kind: 'newFile'; dirPath: string }
  | { kind: 'newFolder'; dirPath: string }
  | { kind: 'rename'; path: string; entryKind: 'file' | 'directory'; currentName: string }
  | { kind: 'delete'; path: string; name: string }
  | { kind: 'formDir'; dirPath: string };

function keyOf(d: FilesDialog): string {
  return d.kind + ':' + ('dirPath' in d ? d.dirPath : d.path);
}

export function FilesDialogs({
  dialog,
  onClose,
}: {
  dialog: FilesDialog | null;
  onClose: () => void;
}) {
  if (!dialog) return null;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        {/* key — свежий монтаж на каждый вызов, чтобы локальный стейт полей сбрасывался */}
        <Body key={keyOf(dialog)} dialog={dialog} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function Body({ dialog, onClose }: { dialog: FilesDialog; onClose: () => void }) {
  if (dialog.kind === 'formDir') return <FormDirBody dirPath={dialog.dirPath} onClose={onClose} />;
  if (dialog.kind === 'delete')
    return <DeleteBody path={dialog.path} name={dialog.name} onClose={onClose} />;
  return <NameBody dialog={dialog} onClose={onClose} />;
}

function NameBody({
  dialog,
  onClose,
}: {
  dialog: Extract<FilesDialog, { kind: 'newFile' | 'newFolder' | 'rename' }>;
  onClose: () => void;
}) {
  const [name, setName] = useState(dialog.kind === 'rename' ? dialog.currentName : '');
  const title =
    dialog.kind === 'newFile'
      ? 'Новый файл'
      : dialog.kind === 'newFolder'
        ? 'Новая папка'
        : 'Переименовать';

  const submit = () => {
    const v = name.trim();
    if (!v) return;
    if (dialog.kind === 'newFile') void createFileEntry(dialog.dirPath, v);
    else if (dialog.kind === 'newFolder') void createFolderEntry(dialog.dirPath, v);
    else void renameEntry(dialog.path, dialog.entryKind, v);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={dialog.kind === 'newFolder' ? 'имя-папки' : 'имя-файла.ext'}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} disabled={!name.trim()}>
          {dialog.kind === 'rename' ? 'Переименовать' : 'Создать'}
        </Button>
      </DialogFooter>
    </>
  );
}

function DeleteBody({ path, name, onClose }: { path: string; name: string; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Удалить?</DialogTitle>
        <DialogDescription>
          <span className="font-mono">{name}</span> будет удалён безвозвратно (папки — со всем
          содержимым).
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            void deleteEntry(path);
            onClose();
          }}
        >
          Удалить
        </Button>
      </DialogFooter>
    </>
  );
}

const FORM_DIR_FILES: ReadonlyArray<{ key: keyof FormDirFiles; label: string }> = [
  { key: 'model', label: 'Модель (model.ts)' },
  { key: 'form', label: 'Схема формы (form.json)' },
  { key: 'validation', label: 'Схема валидации (validation.ts)' },
  { key: 'behavior', label: 'Поведение формы (behavior.ts)' },
  { key: 'ui', label: 'Поведение UI (ui.ts)' },
];

function FormDirBody({ dirPath, onClose }: { dirPath: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [files, setFiles] = useState<FormDirFiles>({
    model: true,
    form: true,
    validation: true,
    behavior: true,
    ui: true,
  });
  const anyFile = files.model || files.form || files.validation || files.behavior || files.ui;

  const submit = () => {
    const v = name.trim();
    if (!v || !anyFile) return;
    void generateFormDirectory(dirPath, v, files);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Каталог с формой</DialogTitle>
        <DialogDescription>
          Создаст папку с выбранными файлами. Схема формы откроется в canvas, остальные — в
          редакторе.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-1">
        <div className="space-y-1.5">
          <Label htmlFor="fd-name">Имя формы</Label>
          <Input
            id="fd-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="например: profile"
          />
        </div>
        <div className="space-y-2">
          {FORM_DIR_FILES.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={files[key]}
                onCheckedChange={() => setFiles((f) => ({ ...f, [key]: !f[key] }))}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} disabled={!name.trim() || !anyFile}>
          Создать
        </Button>
      </DialogFooter>
    </>
  );
}

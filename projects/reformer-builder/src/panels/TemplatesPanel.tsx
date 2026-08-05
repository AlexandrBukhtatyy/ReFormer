/**
 * Панель шаблонов форм: встроенный шаблон, шаблоны проекта (`.reformer/templates`) и локальные
 * (IndexedDB) одним списком. Строка раскрывается в состав файлов; из панели можно сгенерировать
 * форму (в корень проекта), переименовать и удалить шаблон. Создаются шаблоны из дерева файлов —
 * ПКМ «Создать шаблон…» в {@link ./FilesPanel}.
 *
 * @module reformer-builder/panels/TemplatesPanel
 */

import { useEffect, useState } from 'react';
import { Badge, Button, Input, ScrollArea } from '@reformer/ui-kit';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@reformer/ui-kit/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { FileCode, RotateCcw } from 'lucide-react';
import { deleteTemplate, openTemplatePreview, renameTemplate } from '../app/template-actions';
import { useProject } from '../store/project-store';
import { reloadTemplates, useTemplates } from '../store/templates-store';
import { SOURCE_LABEL, type FormTemplate } from '../templates';
import { FilesDialogs, type FilesDialog } from './FilesDialogs';

/** Локальный диалог панели: переименование или подтверждение удаления шаблона. */
type TemplateDialog =
  | { kind: 'rename'; template: FormTemplate }
  | { kind: 'delete'; template: FormTemplate };

export function TemplatesPanel() {
  const items = useTemplates((s) => s.items);
  const loading = useTemplates((s) => s.loading);
  const error = useTemplates((s) => s.error);
  const dirName = useProject((s) => s.dirName);

  const [dialog, setDialog] = useState<TemplateDialog | null>(null);
  const [filesDialog, setFilesDialog] = useState<FilesDialog | null>(null);

  // Локальные шаблоны доступны и без проекта — подтягиваем их при первом показе панели.
  useEffect(() => {
    void reloadTemplates();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <span className="truncate text-[11px] text-muted-foreground">
          {dirName ? `Проект: ${dirName}` : 'Проект не открыт — только локальные'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[11px]"
          onClick={() => void reloadTemplates()}
          disabled={loading}
        >
          <RotateCcw className="h-3 w-3" /> Обновить
        </Button>
      </div>

      <ScrollArea className="flex-1 py-1.5">
        {error && (
          <div className="mx-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
            Ошибка чтения шаблонов: {error}
          </div>
        )}

        {items.map((t) => (
          <ContextMenu key={`${t.source}:${t.id}`}>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => openTemplatePreview(t)}
                title={`${t.description ?? t.name} · ${t.files.length} файлов — клик открывает предпросмотр`}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
              >
                <FileCode className="h-3.5 w-3.5 flex-none text-primary" />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <Badge variant="secondary" className="h-4 flex-none px-1.5 text-[9px]">
                  {SOURCE_LABEL[t.source]}
                </Badge>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem onClick={() => openTemplatePreview(t)}>
                Открыть предпросмотр
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setFilesDialog({ kind: 'template', dirPath: '' })}>
                Создать форму…
              </ContextMenuItem>
              {t.source !== 'builtin' && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => setDialog({ kind: 'rename', template: t })}>
                    Переименовать…
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDialog({ kind: 'delete', template: t })}
                  >
                    Удалить
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}

        {!items.length && !loading && (
          <div className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Шаблонов нет. Выделите файлы формы в дереве и выберите «Создать шаблон…».
          </div>
        )}
      </ScrollArea>

      <TemplateDialogs dialog={dialog} onClose={() => setDialog(null)} />
      <FilesDialogs dialog={filesDialog} onClose={() => setFilesDialog(null)} />
    </div>
  );
}

function TemplateDialogs({
  dialog,
  onClose,
}: {
  dialog: TemplateDialog | null;
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
        {dialog.kind === 'rename' ? (
          <RenameBody key={dialog.template.id} template={dialog.template} onClose={onClose} />
        ) : (
          <DeleteBody template={dialog.template} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameBody({ template, onClose }: { template: FormTemplate; onClose: () => void }) {
  const [name, setName] = useState(template.name);
  const submit = () => {
    if (!name.trim()) return;
    void renameTemplate(template, name);
    onClose();
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>Переименовать шаблон</DialogTitle>
        <DialogDescription>
          Меняется только отображаемое имя — папка шаблона остаётся прежней.
        </DialogDescription>
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
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} disabled={!name.trim()}>
          Переименовать
        </Button>
      </DialogFooter>
    </>
  );
}

function DeleteBody({ template, onClose }: { template: FormTemplate; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Удалить шаблон?</DialogTitle>
        <DialogDescription>
          «{template.name}»{' '}
          {template.source === 'project'
            ? 'будет удалён вместе с папкой в проекте.'
            : 'будет удалён из локального хранилища браузера.'}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            void deleteTemplate(template);
            onClose();
          }}
        >
          Удалить
        </Button>
      </DialogFooter>
    </>
  );
}

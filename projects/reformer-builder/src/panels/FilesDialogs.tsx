/**
 * Диалоги файловых операций дерева (контекстное меню): prompt имени (создать файл/папку,
 * переименовать), подтверждение удаления, «Выбрать шаблон» (шаблон + имя формы + состав файлов) и
 * «Создать шаблон» (имя, базовое имя для плейсхолдеров, хранилище). На @reformer/ui-kit
 * `dialog`/`checkbox`/`label`. Исполнение — экшены из `save-actions` и `template-actions`; после
 * сабмита закрываемся. Активный диалог монтируется свежим (keyed) — локальный стейт полей сбрасывается.
 *
 * @module reformer-builder/panels/FilesDialogs
 */

import { useMemo, useState } from 'react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@reformer/ui-kit/collapsible';
import { Label } from '@reformer/ui-kit/label';
import { ChevronRight } from 'lucide-react';
import { createFileEntry, createFolderEntry, deleteEntry, renameEntry } from '../app/save-actions';
import {
  createTemplateFrom,
  generateFromTemplate,
  type TemplateTarget,
} from '../app/template-actions';
import { resolvePicked, suggestBaseName } from '../templates';
import { useTemplates } from '../store/templates-store';
import { TemplateCombobox } from './TemplateCombobox';
import { cn } from '../lib/cn';

export type FilesDialog =
  | { kind: 'newFile'; dirPath: string }
  | { kind: 'newFolder'; dirPath: string }
  | { kind: 'rename'; path: string; entryKind: 'file' | 'directory'; currentName: string }
  | { kind: 'delete'; path: string; name: string }
  /** Генерация формы по шаблону в каталоге `dirPath`. */
  | { kind: 'template'; dirPath: string }
  /** Сохранение выбранных в дереве путей как шаблона. */
  | { kind: 'newTemplate'; paths: string[] };

function keyOf(d: FilesDialog): string {
  if (d.kind === 'newTemplate') return 'newTemplate:' + d.paths.join('|');
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
  const wide = dialog.kind === 'template' || dialog.kind === 'newTemplate';
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className={wide ? 'max-w-lg' : 'max-w-md'}>
        {/* key — свежий монтаж на каждый вызов, чтобы локальный стейт полей сбрасывался */}
        <Body key={keyOf(dialog)} dialog={dialog} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function Body({ dialog, onClose }: { dialog: FilesDialog; onClose: () => void }) {
  if (dialog.kind === 'template')
    return <TemplatePickBody dirPath={dialog.dirPath} onClose={onClose} />;
  if (dialog.kind === 'newTemplate')
    return <NewTemplateBody paths={dialog.paths} onClose={onClose} />;
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

/** Имя формы должно быть латинским идентификатором — иначе плейсхолдеры не подставятся. */
function isValidFormName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*([-_ ][A-Za-z0-9]+)*$/.test(name.trim());
}

/** «Выбрать шаблон»: шаблон + имя формы + какие файлы создать. */
function TemplatePickBody({ dirPath, onClose }: { dirPath: string; onClose: () => void }) {
  const templates = useTemplates((s) => s.items);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const [name, setName] = useState('');
  // Состав файлов — деталь: по умолчанию свёрнут, берутся все файлы выбранного шаблона.
  const [filesOpen, setFilesOpen] = useState(false);
  // Выбор файлов — per-template: смена шаблона сбрасывает набор на «все файлы».
  const [pickedByTemplate, setPickedByTemplate] = useState<Record<string, Set<string>>>({});
  const picked = useMemo(
    () => pickedByTemplate[template?.id ?? ''] ?? new Set(template?.files.map((f) => f.path) ?? []),
    [pickedByTemplate, template]
  );

  const setPicked = (next: Set<string>) =>
    setPickedByTemplate((prev) => ({ ...prev, [template.id]: next }));

  // Отметка тянет зависимости шаблона; снятие убирает то, что без файла не соберётся.
  const toggle = (path: string) => {
    const next = new Set(picked);
    if (next.has(path)) {
      next.delete(path);
      for (const [owner, deps] of Object.entries(template.requires ?? {})) {
        if (deps.includes(path)) next.delete(owner);
      }
    } else {
      next.add(path);
    }
    setPicked(resolvePicked(next, template.requires));
  };

  const nameOk = isValidFormName(name);
  const canSubmit = nameOk && picked.size > 0 && template != null;

  const submit = () => {
    if (!canSubmit) return;
    void generateFromTemplate(dirPath, name.trim(), template, picked);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Выбрать шаблон</DialogTitle>
      </DialogHeader>

      <div className="min-w-0 space-y-3 py-1">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Имя формы</Label>
          <Input
            id="tpl-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="например: user-profile"
          />
          {name.trim() && !nameOk && (
            <p className="text-[11px] text-destructive">
              Латиница, цифры и дефис: имя попадает в названия компонентов и импорты.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="tpl-pick">Шаблон</Label>
          <TemplateCombobox
            id="tpl-pick"
            templates={templates}
            value={template?.id ?? ''}
            onChange={setTemplateId}
          />
        </div>

        {template && (
          <Collapsible open={filesOpen} onOpenChange={setFilesOpen} className="min-w-0 space-y-1.5">
            <CollapsibleTrigger className="flex w-full items-center gap-1 text-left">
              <ChevronRight
                className={cn(
                  'size-3.5 flex-none text-muted-foreground transition-transform',
                  filesOpen && 'rotate-90'
                )}
              />
              <Label className="cursor-pointer">
                Файлы ({picked.size} из {template.files.length})
              </Label>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* Свой overflow вместо ScrollArea: её Radix-viewport — display:table с min-width:100%,
                  он не сжимается ниже контента и распирает grid-детей диалога. */}
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {template.files.map((f) => (
                  <label
                    key={f.path}
                    className="flex min-w-0 cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      className="flex-none"
                      checked={picked.has(f.path)}
                      onCheckedChange={() => toggle(f.path)}
                    />
                    <span className="min-w-0 truncate">{template.labels?.[f.path] ?? f.path}</span>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          Создать
        </Button>
      </DialogFooter>
    </>
  );
}

/** «Создать шаблон»: имя/описание, базовое имя для плейсхолдеров, хранилище. */
function NewTemplateBody({ paths, onClose }: { paths: string[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseName, setBaseName] = useState(() => suggestBaseName(paths));
  const [target, setTarget] = useState<TemplateTarget>('project');

  const submit = () => {
    if (!name.trim()) return;
    void createTemplateFrom(paths, { name, description, baseName, target });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Создать шаблон</DialogTitle>
      </DialogHeader>

      <div className="min-w-0 space-y-3 py-1">
        <div className="space-y-1.5">
          <Label htmlFor="nt-name">Имя шаблона</Label>
          <Input
            id="nt-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="например: Форма заявки"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nt-desc">Описание</Label>
          <Input
            id="nt-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="необязательно"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nt-base">Базовое имя (заменяется плейсхолдерами)</Label>
          <Input
            id="nt-base"
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder="пусто — не заменять"
          />
          {baseName.trim().length > 0 && baseName.trim().length < 4 && (
            <p className="text-[11px] text-muted-foreground">
              Короткое имя может совпасть со случайными словами в коде — проверьте результат.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Где хранить</Label>
          <div className="flex gap-2">
            {(
              [
                ['project', 'В проекте (.reformer/templates)'],
                ['local', 'Локально в браузере'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTarget(value)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1.5 text-left text-xs',
                  target === value
                    ? 'border-primary bg-accent'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-32 overflow-y-auto rounded-md border border-border p-2">
          <ul className="min-w-0 space-y-0.5 text-[11px] text-muted-foreground">
            {paths.map((p) => (
              <li key={p} className="truncate font-mono">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} disabled={!name.trim() || !paths.length}>
          Сохранить
        </Button>
      </DialogFooter>
    </>
  );
}

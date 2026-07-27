/**
 * Панель файлов/схем. Mode B (спека §7.2, §3.1): открыть проект (FS Access) → **раскрываемое
 * дерево всего содержимого каталога** (папки с шевронами + файлы, по умолчанию всё развёрнуто).
 * Распознанные схемы форм помечены бейджами High/Med и открываются кликом как форма, прочие файлы
 * открываются как code-вкладка в Monaco (спека §7). «Переоткрыть проект» (из IndexedDB) — здесь;
 * «Открыть проект» и «Новая форма» переехали в меню «Файл» (AppMenuBar).
 *
 * @module reformer-builder/panels/FilesPanel
 */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Badge, Button, ScrollArea } from '@reformer/ui-kit';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@reformer/ui-kit/context-menu';
import { File, FileCode, Folder, FolderOpen, RotateCcw } from 'lucide-react';
import { useProject } from '../store/project-store';
import {
  checkReopen,
  generateBehavior,
  generateFormSchema,
  generateModel,
  generateUiBehavior,
  generateValidation,
  openCodeFile,
  openSchemaFile,
  reopenProject,
} from '../app/save-actions';
import { fsAccessSupported } from '../io/fs-access';
import type { TreeEntry } from '../io/discovery';
import { FilesDialogs, type FilesDialog } from './FilesDialogs';
import { cn } from '../lib/cn';

/** Ключ collapse-состояния корневого узла (реальные пути записей всегда непустые). */
const ROOT_KEY = '';

function indent(depth: number): CSSProperties {
  return { paddingLeft: `${depth * 12 + 8}px` };
}

/** Родительский каталог пути (пустой — если запись в корне). */
function parentDir(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/** Скрыть потомков свёрнутых папок (дерево плоское: папка идёт перед своими детьми). */
function visibleTree(tree: TreeEntry[], collapsed: Set<string>): TreeEntry[] {
  const out: TreeEntry[] = [];
  let skipBelow = Infinity;
  for (const e of tree) {
    if (e.depth > skipBelow) continue; // внутри свёрнутой папки
    skipBelow = Infinity;
    out.push(e);
    if (e.kind === 'directory' && collapsed.has(e.path)) skipBelow = e.depth;
  }
  return out;
}

function TreeRow({
  entry,
  collapsed,
  onToggle,
  depthOffset = 0,
}: {
  entry: TreeEntry;
  collapsed: boolean;
  onToggle: (path: string) => void;
  depthOffset?: number;
}) {
  if (entry.kind === 'directory') {
    return (
      <button
        onClick={() => onToggle(entry.path)}
        style={indent(entry.depth + depthOffset)}
        className="flex w-full items-center gap-1 py-1 pr-2 text-left text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <span
          className={cn('flex-none text-[8px] transition-transform', !collapsed && 'rotate-90')}
        >
          ▶
        </span>
        <Folder className="h-3.5 w-3.5 flex-none opacity-70" />
        <span className="min-w-0 truncate">{entry.name}</span>
      </button>
    );
  }

  if (entry.isForm) {
    return (
      <button
        onClick={() => void openSchemaFile(entry)}
        title={entry.path}
        style={indent(entry.depth + 1 + depthOffset)}
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs hover:bg-muted"
      >
        <FileCode className="h-3.5 w-3.5 flex-none text-primary" />
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        <Badge
          variant={entry.confidence === 'high' ? 'default' : 'secondary'}
          className="h-4 flex-none px-1.5 text-[9px]"
        >
          {entry.confidence === 'high' ? 'High' : 'Med'}
        </Badge>
      </button>
    );
  }

  return (
    <button
      onClick={() => void openCodeFile(entry)}
      title={`${entry.path} — открыть в редакторе`}
      style={indent(entry.depth + 1 + depthOffset)}
      className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs text-muted-foreground hover:bg-muted"
    >
      <File className="h-3.5 w-3.5 flex-none opacity-70" />
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
    </button>
  );
}

export function FilesPanel() {
  const dirName = useProject((s) => s.dirName);
  const tree = useProject((s) => s.tree);
  const scanning = useProject((s) => s.scanning);
  const error = useProject((s) => s.error);
  const canReopen = useProject((s) => s.canReopen);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const visible = useMemo(() => visibleTree(tree, collapsed), [tree, collapsed]);
  const rootOpen = !collapsed.has(ROOT_KEY);
  const [dialog, setDialog] = useState<FilesDialog | null>(null);

  useEffect(() => {
    void checkReopen();
  }, []);

  // Контекстное меню строки: dirPath — «внутрь чего» создавать (папка → в неё, файл → в родителя,
  // корень → в корень); rename/delete показываем только для конкретной записи (не для корня).
  const rowMenu = (key: string, row: ReactNode, target: TreeEntry | 'root') => {
    const entry = target === 'root' ? null : target;
    const dirPath = entry ? (entry.kind === 'directory' ? entry.path : parentDir(entry.path)) : '';
    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger asChild>
          <div>{row}</div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => setDialog({ kind: 'newFile', dirPath })}>
            Новый файл…
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setDialog({ kind: 'newFolder', dirPath })}>
            Новая папка…
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Сгенерировать</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => setDialog({ kind: 'formDir', dirPath })}>
                Каталог с формой…
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => void generateModel(dirPath)}>Модель</ContextMenuItem>
              <ContextMenuItem onClick={() => void generateFormSchema(dirPath)}>
                Схема формы
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void generateValidation(dirPath)}>
                Схема валидации
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void generateBehavior(dirPath)}>
                Поведение формы
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void generateUiBehavior(dirPath)}>
                Поведение UI
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {entry && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() =>
                  setDialog({
                    kind: 'rename',
                    path: entry.path,
                    entryKind: entry.kind,
                    currentName: entry.name,
                  })
                }
              >
                Переименовать…
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDialog({ kind: 'delete', path: entry.path, name: entry.name })}
              >
                Удалить
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* «Открыть проект» и «Новая форма» — в меню «Файл» (AppMenuBar). Здесь — быстрый reopen. */}
      {canReopen && !dirName && (
        <div className="flex flex-col gap-1.5 border-b border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={() => void reopenProject()}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Переоткрыть проект
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 py-1.5">
        {dirName && (
          <>
            {/* Корневой каталог — верхний раскрываемый узел дерева (не заголовок секции). */}
            {rowMenu(
              'root',
              <button
                onClick={() => toggle(ROOT_KEY)}
                title={dirName}
                style={indent(0)}
                className="flex w-full items-center gap-1 py-1 pr-2 text-left text-[11.5px] font-semibold text-foreground hover:bg-muted"
              >
                <span
                  className={cn(
                    'flex-none text-[8px] transition-transform',
                    rootOpen && 'rotate-90'
                  )}
                >
                  ▶
                </span>
                {rootOpen ? (
                  <FolderOpen className="h-3.5 w-3.5 flex-none opacity-80" />
                ) : (
                  <Folder className="h-3.5 w-3.5 flex-none opacity-80" />
                )}
                <span className="min-w-0 truncate">{dirName}</span>
                {scanning && (
                  <span className="flex-none text-[10px] font-normal text-muted-foreground">
                    · сканирую…
                  </span>
                )}
              </button>,
              'root'
            )}

            {rootOpen && (
              <>
                {error && (
                  <div className="mx-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
                    Ошибка сканирования: {error}
                  </div>
                )}
                {!scanning && !error && tree.length === 0 && (
                  <div style={indent(1)} className="py-1 text-[11px] text-muted-foreground">
                    Каталог пуст.
                  </div>
                )}
                {visible.map((entry) =>
                  rowMenu(
                    entry.path,
                    <TreeRow
                      entry={entry}
                      depthOffset={1}
                      collapsed={collapsed.has(entry.path)}
                      onToggle={toggle}
                    />,
                    entry
                  )
                )}
              </>
            )}
          </>
        )}

        {!fsAccessSupported() && (
          <div className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Открытие проекта требует Chromium (File System Access API). Создать форму — меню «Файл →
            Новая форма».
          </div>
        )}
      </ScrollArea>

      <FilesDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

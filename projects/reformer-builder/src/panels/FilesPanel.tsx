/**
 * Панель файлов/схем. Mode B (спека §7.2, §3.1): открыть проект (FS Access) → **дерево всего
 * содержимого каталога** (папки + файлы с отступами); распознанные схемы форм помечены бейджами
 * High/Med и открываются кликом, прочие файлы приглушены и на клик отдают тост. «Переоткрыть» из
 * IndexedDB. Mode A: «Новая схема». Без Chromium — только Mode A.
 *
 * @module reformer-builder/panels/FilesPanel
 */

import { useEffect, type CSSProperties } from 'react';
import { Badge, Button, ScrollArea } from '@reformer/ui-kit';
import { toast } from '@reformer/ui-kit/sonner';
import { File, FileCode, FilePlus2, Folder, FolderOpen, RotateCcw } from 'lucide-react';
import { emptySchema } from '../model';
import { editorActions } from '../store';
import { useProject } from '../store/project-store';
import { checkReopen, openProject, openSchemaFile, reopenProject } from '../app/save-actions';
import { fsAccessSupported } from '../io/fs-access';
import type { TreeEntry } from '../io/discovery';

let counter = 1;

function indent(depth: number): CSSProperties {
  return { paddingLeft: `${depth * 12 + 8}px` };
}

function TreeRow({ entry }: { entry: TreeEntry }) {
  if (entry.kind === 'directory') {
    return (
      <div
        style={indent(entry.depth)}
        className="flex items-center gap-1.5 py-1 pr-2 text-[11.5px] font-medium text-muted-foreground"
      >
        <Folder className="h-3.5 w-3.5 flex-none opacity-70" />
        <span className="min-w-0 truncate">{entry.name}</span>
      </div>
    );
  }

  if (entry.isForm) {
    return (
      <button
        onClick={() => void openSchemaFile(entry)}
        title={entry.path}
        style={indent(entry.depth)}
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
      onClick={() => toast('Файл не распознан как схема формы')}
      title={entry.path}
      style={indent(entry.depth)}
      className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground"
    >
      <File className="h-3.5 w-3.5 flex-none opacity-60" />
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

  useEffect(() => {
    void checkReopen();
  }, []);

  const newSchema = () => {
    counter += 1;
    const name = `new-form-${counter}.json`;
    editorActions.openTab(name, { kind: 'new', name }, emptySchema());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 border-b border-border p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={() => void openProject()}
        >
          <FolderOpen className="h-3.5 w-3.5" /> Открыть проект…
        </Button>
        {canReopen && !dirName && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={() => void reopenProject()}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Переоткрыть проект
          </Button>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={newSchema}>
          <FilePlus2 className="h-3.5 w-3.5" /> Новая схема
        </Button>
      </div>

      <ScrollArea className="flex-1 py-1.5">
        {dirName && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="min-w-0 truncate">{dirName}</span>
            {scanning && <span className="flex-none normal-case">· сканирую…</span>}
          </div>
        )}
        {error && (
          <div className="mx-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
            Ошибка сканирования: {error}
          </div>
        )}
        {dirName && !scanning && !error && tree.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">Каталог пуст.</div>
        )}
        {tree.map((entry) => (
          <TreeRow key={entry.path} entry={entry} />
        ))}

        {!fsAccessSupported() && (
          <div className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Открытие проекта требует Chromium (File System Access API). Доступен режим «Новая схема».
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

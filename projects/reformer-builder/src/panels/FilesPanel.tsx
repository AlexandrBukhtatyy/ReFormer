/**
 * Панель файлов/схем. Mode B (спека §7.2, §3.1): открыть проект (FS Access) → **раскрываемое
 * дерево содержимого каталога** (папки с шевронами + файлы). Дерево читается **лениво**: при
 * открытии проекта — только корень, содержимое папки — при её раскрытии (тоже один уровень), так
 * что большой репозиторий не сканируется целиком. Строки рендерятся **виртуально**
 * ({@link useVirtualRows}) — в DOM не висят тысячи узлов с контекстным меню.
 *
 * Распознанные схемы форм помечены бейджами High/Med и открываются кликом как форма, прочие файлы
 * открываются как code-вкладка в Monaco (спека §7). «Переоткрыть проект» (из IndexedDB) — здесь;
 * «Открыть проект» и «Новая форма» переехали в меню «Файл» (AppMenuBar).
 *
 * @module reformer-builder/panels/FilesPanel
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Badge, Button, ScrollArea } from '@reformer/ui-kit';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@reformer/ui-kit/context-menu';
import { ChevronRight, File, FileCode, Folder, FolderOpen, Loader2, RotateCcw } from 'lucide-react';
import { useProject } from '../store/project-store';
import { useFileClipboard } from '../store/file-clipboard';
import {
  checkReopen,
  copyEntries,
  generateFormBehavior,
  generateFormSchema,
  generateModel,
  generateRenderBehavior,
  generateValidation,
  loadDirectory,
  openTreeEntry,
  pasteEntries,
  reopenProject,
} from '../app/save-actions';
import { fsAccessSupported } from '../io/fs-access';
import type { TreeEntry } from '../io/discovery';
import { FilesDialogs, type FilesDialog } from './FilesDialogs';
import { cn } from '../lib/cn';
import { formatShortcut } from '../lib/shortcuts';
import { useVirtualRows } from '../lib/use-virtual-rows';

/** Ключ раскрытия корневого узла (реальные пути записей всегда непустые). */
const ROOT_KEY = '';

/** Высота строки дерева, px. Фиксирована — на ней держится виртуальный скролл (класс `h-6`). */
const ROW_HEIGHT = 24;

function indent(depth: number): CSSProperties {
  return { paddingLeft: `${depth * 12 + 8}px` };
}

/** Родительский каталог пути (пустой — если запись в корне). */
function parentDir(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/** Скрыть содержимое свёрнутых папок (дерево плоское: папка идёт перед своими детьми). */
function visibleTree(tree: TreeEntry[], expanded: Set<string>): TreeEntry[] {
  const out: TreeEntry[] = [];
  let skipBelow = Infinity;
  for (const e of tree) {
    if (e.depth > skipBelow) continue; // внутри свёрнутой папки
    skipBelow = Infinity;
    out.push(e);
    if (e.kind === 'directory' && !expanded.has(e.path)) skipBelow = e.depth;
  }
  return out;
}

function TreeRow({
  entry,
  expanded,
  loading,
  onActivate,
  depthOffset = 0,
}: {
  entry: TreeEntry;
  expanded: boolean;
  /** Содержимое папки читается прямо сейчас (ленивая загрузка) — вместо шеврона спиннер. */
  loading?: boolean;
  /** Клик по строке: панель сама решает — открыть файл/свернуть папку или пополнить мульти-выбор. */
  onActivate: (entry: TreeEntry, e: MouseEvent) => void;
  depthOffset?: number;
}) {
  if (entry.kind === 'directory') {
    return (
      <button
        onClick={(e) => onActivate(entry, e)}
        style={indent(entry.depth + depthOffset)}
        className="flex h-6 w-full items-center gap-1 pr-2 text-left text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 flex-none animate-spin" />
        ) : (
          <ChevronRight
            className={cn('h-3 w-3 flex-none transition-transform', expanded && 'rotate-90')}
          />
        )}
        <Folder className="h-3.5 w-3.5 flex-none opacity-70" />
        <span className="min-w-0 truncate">{entry.name}</span>
      </button>
    );
  }

  if (entry.isForm) {
    return (
      <button
        onClick={(e) => onActivate(entry, e)}
        title={entry.path}
        style={indent(entry.depth + 1 + depthOffset)}
        className="flex h-6 w-full items-center gap-1.5 pr-2 text-left text-xs hover:bg-muted"
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
      onClick={(e) => onActivate(entry, e)}
      title={`${entry.path} — открыть в редакторе (${formatShortcut('Mod')}+клик — добавить к выбору)`}
      style={indent(entry.depth + 1 + depthOffset)}
      className="flex h-6 w-full items-center gap-1.5 pr-2 text-left text-xs text-muted-foreground hover:bg-muted"
    >
      <File className="h-3.5 w-3.5 flex-none opacity-70" />
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
    </button>
  );
}

export function FilesPanel() {
  const dirName = useProject((s) => s.dirName);
  const tree = useProject((s) => s.tree);
  const loadedDirs = useProject((s) => s.loadedDirs);
  const loadingDirs = useProject((s) => s.loadingDirs);
  const scanning = useProject((s) => s.scanning);
  const error = useProject((s) => s.error);
  const canReopen = useProject((s) => s.canReopen);
  const clipboard = useFileClipboard();

  // Раскрытые узлы (корень открыт сразу). Раскрытие папки, содержимое которой ещё не прочитано,
  // запускает ленивую загрузку одного уровня — вложенные каталоги подгружаются так же, по клику.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([ROOT_KEY]));
  const toggle = (path: string) => {
    const willExpand = !expanded.has(path);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (willExpand) next.add(path);
      else next.delete(path);
      return next;
    });
    if (willExpand && path !== ROOT_KEY) void loadDirectory(path);
  };

  const visible = useMemo(() => visibleTree(tree, expanded), [tree, expanded]);
  const rootOpen = expanded.has(ROOT_KEY);
  const [dialog, setDialog] = useState<FilesDialog | null>(null);

  // Клавиатурная навигация по дереву (в стиле VSCode). Выделение хранится по пути (стабильно при
  // сворачивании); плоский список навигации — корень + видимые записи (respect collapse). Он же —
  // список строк виртуального скролла: индекс в navPaths == индекс строки.
  const treeRef = useRef<HTMLDivElement>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const navPaths = useMemo<string[]>(() => {
    if (!dirName) return [];
    return rootOpen ? [ROOT_KEY, ...visible.map((e) => e.path)] : [ROOT_KEY];
  }, [dirName, rootOpen, visible]);
  const visibleByPath = useMemo(() => new Map(visible.map((e) => [e.path, e])), [visible]);

  const virtual = useVirtualRows(navPaths.length, ROW_HEIGHT);

  // Фокус следует за выделением (роуминг). Строка может быть вне окна виртуализации — сначала
  // доскролливаем, затем фокусируем, когда она появилась в DOM (эффект ниже, по окну [start,end)).
  const [focusPath, setFocusPath] = useState<string | null>(null);
  useEffect(() => {
    if (focusPath == null) return;
    const el = treeRef.current?.querySelector<HTMLElement>(
      `[data-tree-path="${CSS.escape(focusPath)}"] button`
    );
    if (el) {
      el.focus();
      setFocusPath(null);
    }
  }, [focusPath, virtual.start, virtual.end]);

  const selectAndFocus = (path: string) => {
    setSelectedPath(path);
    virtual.scrollToRow(navPaths.indexOf(path));
    setFocusPath(path);
  };

  // Фокус любой строки (клик/Tab) → она становится выделенной.
  const onTreeFocus = (e: FocusEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tree-path]');
    if (el) setSelectedPath(el.dataset.treePath ?? null);
  };

  // Мульти-выбор путей (для «Создать шаблон…»): ⌘/Ctrl+клик — тоггл, ⇧+клик — диапазон по видимым
  // строкам. Обычный клик работает как раньше (открыть файл / свернуть папку) и схлопывает набор.
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  // Смена проекта — сбрасываем раскрытие/выбор: пути старого дерева больше ничего не значат.
  useEffect(() => {
    setExpanded(new Set([ROOT_KEY]));
    setChecked(new Set());
    setSelectedPath(null);
  }, [dirName]);

  const activateRow = (entry: TreeEntry, e: MouseEvent) => {
    const path = entry.path;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      setSelectedPath(path);
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      const from = navPaths.indexOf(selectedPath ?? path);
      const to = navPaths.indexOf(path);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        setChecked(new Set(navPaths.slice(lo, hi + 1).filter((p) => p !== ROOT_KEY)));
      }
      setSelectedPath(path);
      return;
    }
    setChecked(new Set([path]));
    setSelectedPath(path);
    if (entry.kind === 'directory') {
      toggle(path);
      return;
    }
    // Как в VSCode: одиночный клик открывает файл временной preview-вкладкой (следующий такой клик
    // займёт её слот), двойной (`detail > 1`) — закрепляет вкладку за файлом.
    void openTreeEntry(entry, { preview: e.detail < 2 });
  };

  /** К каким путям применить действие ПКМ: ко всему набору, если кликнули по его строке. */
  const menuPaths = (entry: TreeEntry): string[] =>
    checked.has(entry.path) && checked.size > 1 ? [...checked] : [entry.path];

  // ↑↓ — перемещение, →/← — раскрыть/свернуть/к родителю, F2 — переименовать, Delete — удалить,
  // Mod+C/Mod+V — копировать/вставить (те же действия, что в контекстном меню).
  // Enter/Space не трогаем: это нативная активация кнопки строки (открыть файл / свернуть папку).
  const onTreeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const NAV = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F2', 'Delete', 'Backspace'];
    // Копирование — по e.code: в русской раскладке Ctrl+C даёт e.key === 'с' (кириллица).
    const mod = e.metaKey || e.ctrlKey;
    const copyPaste = mod && (e.code === 'KeyC' || e.code === 'KeyV');
    if (!NAV.includes(e.key) && !copyPaste) return;
    const sel = selectedPath ?? navPaths[0];
    if (sel == null) return;
    e.preventDefault();
    e.stopPropagation(); // не отдаём клавишу глобальному canvas-обработчику (EditorLayout)

    const isRoot = sel === ROOT_KEY;
    const entry = isRoot ? null : visibleByPath.get(sel);
    const isDir = isRoot || entry?.kind === 'directory';
    const isOpen = isRoot ? rootOpen : entry ? expanded.has(entry.path) : false;
    const idx = navPaths.indexOf(sel);

    if (copyPaste) {
      // «Куда вставлять» — как в меню: папка → в неё, файл → в его каталог, корень → в корень.
      if (e.code === 'KeyV') void pasteEntries(isDir ? sel : parentDir(sel));
      else if (entry) copyEntries(menuPaths(entry));
      return;
    }
    const move = (d: number) => {
      const p = navPaths[Math.min(Math.max(idx + d, 0), navPaths.length - 1)];
      if (p != null) selectAndFocus(p);
    };

    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'ArrowRight') {
      if (isDir && !isOpen) toggle(sel);
      else if (isDir && isOpen) move(1);
    } else if (e.key === 'ArrowLeft') {
      if (isDir && isOpen) toggle(sel);
      else selectAndFocus(isRoot ? ROOT_KEY : parentDir(sel));
    } else if (e.key === 'F2' && entry) {
      setDialog({
        kind: 'rename',
        path: entry.path,
        entryKind: entry.kind,
        currentName: entry.name,
      });
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && entry) {
      setDialog({ kind: 'delete', path: entry.path, name: entry.name });
    }
  };

  useEffect(() => {
    void checkReopen();
  }, []);

  // Контекстное меню строки: dirPath — «внутрь чего» создавать (папка → в неё, файл → в родителя,
  // корень → в корень); rename/delete показываем только для конкретной записи (не для корня).
  const rowMenu = (key: string, row: ReactNode, target: TreeEntry | 'root') => {
    const entry = target === 'root' ? null : target;
    const navPath = target === 'root' ? ROOT_KEY : target.path;
    const dirPath = entry ? (entry.kind === 'directory' ? entry.path : parentDir(entry.path)) : '';
    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger asChild>
          <div
            data-tree-path={navPath}
            className={cn(
              'h-6 focus-within:ring-1 focus-within:ring-ring',
              (selectedPath === navPath || checked.has(navPath)) && 'bg-accent'
            )}
          >
            {row}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {/* Копирование — внутри проекта, по путям: системный буфер FS-хендлы не переносит. */}
          {entry && (
            <ContextMenuItem onClick={() => copyEntries(menuPaths(entry))}>
              {checked.has(entry.path) && checked.size > 1
                ? `Копировать (${checked.size})`
                : 'Копировать'}
              <ContextMenuShortcut>{formatShortcut('Mod+C')}</ContextMenuShortcut>
            </ContextMenuItem>
          )}
          <ContextMenuItem disabled={!clipboard.length} onClick={() => void pasteEntries(dirPath)}>
            {clipboard.length > 1 ? `Вставить (${clipboard.length})` : 'Вставить'}
            <ContextMenuShortcut>{formatShortcut('Mod+V')}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setDialog({ kind: 'newFile', dirPath })}>
            Новый файл…
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setDialog({ kind: 'newFolder', dirPath })}>
            Новая папка…
          </ContextMenuItem>
          {entry && (
            <ContextMenuItem
              onClick={() => setDialog({ kind: 'newTemplate', paths: menuPaths(entry) })}
            >
              {checked.has(entry.path) && checked.size > 1
                ? `Создать шаблон (${checked.size})…`
                : 'Создать шаблон…'}
            </ContextMenuItem>
          )}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Сгенерировать</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => setDialog({ kind: 'template', dirPath })}>
                Выбрать шаблон…
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => void generateModel(dirPath)}>Модель</ContextMenuItem>
              <ContextMenuItem onClick={() => void generateFormSchema(dirPath)}>
                Схема формы
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void generateValidation(dirPath)}>
                Схема валидации
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void generateFormBehavior(dirPath)}>
                Поведение формы
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void generateRenderBehavior(dirPath)}>
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

      {/* min-h-0 обязателен: без него flex-элемент растёт под контент, скроллит внешняя панель,
          а вьюпорт «выше» списка — виртуализация тогда рендерит все строки. */}
      <ScrollArea ref={virtual.scrollRef} className="min-h-0 flex-1 py-1.5">
        <div ref={treeRef} onKeyDown={onTreeKeyDown} onFocus={onTreeFocus} className="outline-none">
          {dirName && (
            // Виртуальный список: распорка на всю высоту дерева, окно строк сдвинуто translateY.
            // Строка 0 — корневой каталог (раскрываемый узел, а не заголовок секции), далее visible.
            <div style={{ height: virtual.totalHeight }}>
              <div style={{ transform: `translateY(${virtual.offsetTop}px)` }}>
                {navPaths.slice(virtual.start, virtual.end).map((path) => {
                  if (path === ROOT_KEY) {
                    return rowMenu(
                      'root',
                      <button
                        onClick={() => toggle(ROOT_KEY)}
                        title={dirName}
                        style={indent(0)}
                        className="flex h-6 w-full items-center gap-1 pr-2 text-left text-[11.5px] font-semibold text-foreground hover:bg-muted"
                      >
                        <ChevronRight
                          className={cn(
                            'h-3 w-3 flex-none transition-transform',
                            rootOpen && 'rotate-90'
                          )}
                        />
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
                    );
                  }
                  const entry = visibleByPath.get(path);
                  if (!entry) return null;
                  return rowMenu(
                    entry.path,
                    <TreeRow
                      entry={entry}
                      depthOffset={1}
                      expanded={expanded.has(entry.path)}
                      loading={loadingDirs.has(entry.path)}
                      onActivate={activateRow}
                    />,
                    entry
                  );
                })}
              </div>
            </div>
          )}

          {dirName && rootOpen && error && (
            <div className="mx-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
              Ошибка сканирования: {error}
            </div>
          )}
          {dirName &&
            rootOpen &&
            !scanning &&
            !error &&
            loadedDirs.has(ROOT_KEY) &&
            !tree.length && (
              <div style={indent(1)} className="py-1 text-[11px] text-muted-foreground">
                Каталог пуст.
              </div>
            )}
        </div>

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

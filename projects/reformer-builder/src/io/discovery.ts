/**
 * Обнаружение JSON-схем форм в каталоге проекта (спека §7.2). Дискриминатор meta-vs-form (MUST):
 * `json.root` — узел (несёт `component`/`value`/`children`) — отсекает `form-schema.schema.json`
 * (draft-07 JSON Schema) и прочие JSON. Бейджи уверенности: `$schema`→form-schema = high,
 * эвристика по shape = medium.
 *
 * Классификация и фильтр файлов — чистые (тестируются). Обход каталога — через File System
 * Access API (browser), **поуровневый** (ленивая загрузка: корень при открытии проекта, содержимое
 * папки — при её раскрытии). FS-типы описаны локально структурно (в lib.dom они неполны).
 *
 * @module reformer-builder/io/discovery
 */

import { getRuntimeConfig } from '../config/state';
import { isFormSchema } from '../model';

/** Уверенность распознавания схемы. */
export type Confidence = 'high' | 'medium';

/** Результат классификации кандидата. */
export interface Classification {
  isForm: boolean;
  confidence: Confidence | null;
}

/** Маркеры мета-схемы формы в поле `$schema` (строгий критерий). */
const DEFAULT_FORM_SCHEMA_MARKERS = [
  'form-schema.schema.json',
  'reformer.dev/schemas/form',
  'renderer.schema.json',
];

/** Маркеры схемы: дефолтные + добавленные клиентом (`project.formSchemaMarkers`). */
function formSchemaMarkers(): string[] {
  const extra = getRuntimeConfig().project?.formSchemaMarkers ?? [];
  return extra.length ? [...DEFAULT_FORM_SCHEMA_MARKERS, ...extra] : DEFAULT_FORM_SCHEMA_MARKERS;
}

/** Классифицировать распарсенный JSON: форма ли это и с какой уверенностью. */
export function classifyFormSchema(json: unknown): Classification {
  if (!isFormSchema(json)) return { isForm: false, confidence: null };
  const ref = (json as { $schema?: unknown }).$schema;
  if (typeof ref === 'string' && formSchemaMarkers().some((m) => ref.includes(m))) {
    return { isForm: true, confidence: 'high' };
  }
  return { isForm: true, confidence: 'medium' };
}

/** Каталоги, которые не сканируем. */
const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '_generated',
  '.git',
  '.beads',
  '.next',
  '.turbo',
  '.cache',
];

/** Файлы-исключения (не схемы, но тяжёлые/частые .json). */
const DEFAULT_SKIP_FILES = [
  'package-lock.json',
  'package.json',
  'tsconfig.json',
  'components.json',
];

/** Игнорируемые каталоги: дефолтные ∪ клиентские (`project.ignoreDirs`). */
function ignoreDirs(): Set<string> {
  const extra = getRuntimeConfig().project?.ignoreDirs ?? [];
  return extra.length ? new Set([...DEFAULT_IGNORE_DIRS, ...extra]) : new Set(DEFAULT_IGNORE_DIRS);
}

/** Скипаемые файлы: дефолтные ∪ клиентские (`project.skipFiles`). */
function skipFiles(): Set<string> {
  const extra = getRuntimeConfig().project?.skipFiles ?? [];
  return extra.length ? new Set([...DEFAULT_SKIP_FILES, ...extra]) : new Set(DEFAULT_SKIP_FILES);
}

export function isIgnoredDir(name: string): boolean {
  // Скрываем только тяжёлые/служебные каталоги; остальную структуру (в т.ч. `.vscode`, `.github`) показываем.
  return ignoreDirs().has(name);
}

/** Стоит ли читать файл как кандидат-схему (быстрый фильтр до парсинга). */
export function shouldScanFile(name: string): boolean {
  if (!name.endsWith('.json')) return false;
  if (skipFiles().has(name)) return false;
  if (name.endsWith('tsconfig.json') || name.endsWith('.tsbuildinfo')) return false;
  return true;
}

// ── Обход каталога (browser, File System Access API) ────────────────────────

/** Структурные типы FS Access API (lib.dom неполон). */
interface FsFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}
interface FsDirHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<FsFileHandle | FsDirHandle>;
}

/** Запись файлового дерева каталога проекта (спека §3.1: дерево с бейджами на схемах). */
export interface TreeEntry {
  /** Относительный путь от корня выбранного каталога. */
  path: string;
  name: string;
  kind: 'file' | 'directory';
  /** Глубина вложенности (для отступов дерева). */
  depth: number;
  /** Файл распознан как схема формы. */
  isForm?: boolean;
  confidence?: Confidence;
  /** Handle файла — для открытия (схема → форма, прочий файл → code-вкладка). Есть у всех файлов. */
  handle?: FileSystemFileHandle;
  /** Handle каталога — для догрузки его содержимого при раскрытии. Есть у всех папок. */
  dirHandle?: FileSystemDirectoryHandle;
  /** Метка времени файла — только для распознанных схем (детект внешних изменений). */
  lastModified?: number;
}

/** Защита от гигантских каталогов: максимум записей ОДНОГО уровня. */
const MAX_LEVEL_ENTRIES = 2000;

/** Только распознанные схемы из дерева (для счётчиков/бейджей). */
export function formsOf(tree: TreeEntry[]): TreeEntry[] {
  return tree.filter((e) => e.isForm);
}

/**
 * Прочитать ОДИН уровень каталога (без рекурсии) — базовая операция ленивой загрузки дерева:
 * при открытии проекта читается корень, при раскрытии папки — она сама.
 *
 * `.json`-кандидаты классифицируются как схемы форм параллельно (чтение файла — самая долгая часть
 * уровня); порядок записей от этого не зависит: папки первыми, внутри — по алфавиту.
 *
 * @param dir каталог, содержимое которого читаем
 * @param prefix путь каталога от корня проекта с завершающим `/` (корень — пустая строка)
 * @param depth глубина вложенности содержимого (для отступов дерева)
 */
export async function scanLevel(
  dir: FileSystemDirectoryHandle,
  prefix = '',
  depth = 0
): Promise<TreeEntry[]> {
  const handles: Array<FsFileHandle | FsDirHandle> = [];
  for await (const entry of (dir as unknown as FsDirHandle).values()) {
    if (entry.kind === 'directory' && isIgnoredDir(entry.name)) continue;
    handles.push(entry);
    if (handles.length >= MAX_LEVEL_ENTRIES) break;
  }
  // папки первыми, затем файлы; внутри — по алфавиту
  handles.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
  );

  const out: TreeEntry[] = handles.map((entry) => {
    const item: TreeEntry = {
      path: `${prefix}${entry.name}`,
      name: entry.name,
      kind: entry.kind,
      depth,
    };
    if (entry.kind === 'directory') item.dirHandle = entry as unknown as FileSystemDirectoryHandle;
    // Handle — на любой файл: схемы открываются как форма, прочие — как code-вкладка в Monaco.
    else item.handle = entry as unknown as FileSystemFileHandle;
    return item;
  });

  await Promise.all(
    out.map(async (item, i) => {
      if (item.kind !== 'file' || !shouldScanFile(item.name)) return;
      try {
        const file = await (handles[i] as FsFileHandle).getFile();
        const { isForm, confidence } = classifyFormSchema(JSON.parse(await file.text()));
        if (isForm && confidence) {
          item.isForm = true;
          item.confidence = confidence;
          item.lastModified = file.lastModified;
        }
      } catch {
        // нечитаемый/невалидный JSON — просто файл
      }
    })
  );

  return out;
}

/**
 * Пересобрать плоское дерево: корень + рекурсивно только те каталоги, что уже были раскрыты
 * (`loaded`). Нужен после файловых операций — обновляет дерево, не разворачивая проект целиком.
 * Исчезнувшие каталоги просто не встретятся при обходе.
 */
export async function scanTree(
  root: FileSystemDirectoryHandle,
  loaded: ReadonlySet<string>
): Promise<TreeEntry[]> {
  const out: TreeEntry[] = [];
  const level = async (dir: FileSystemDirectoryHandle, prefix: string, depth: number) => {
    const entries = await scanLevel(dir, prefix, depth);
    for (const e of entries) {
      out.push(e);
      if (e.kind === 'directory' && e.dirHandle && loaded.has(e.path)) {
        await level(e.dirHandle, `${e.path}/`, depth + 1);
      }
    }
  };
  await level(root, '', 0);
  return out;
}

/**
 * Вставить содержимое каталога в плоское дерево сразу после его строки. Если каталога в дереве нет
 * или его содержимое уже вставлено (следующая запись глубже) — дерево возвращается без изменений.
 */
export function insertChildren(
  tree: TreeEntry[],
  parentPath: string,
  children: TreeEntry[]
): TreeEntry[] {
  const i = tree.findIndex((e) => e.path === parentPath && e.kind === 'directory');
  if (i === -1) return tree;
  const parent = tree[i]!;
  if (tree[i + 1] && tree[i + 1]!.depth > parent.depth) return tree;
  return [...tree.slice(0, i + 1), ...children, ...tree.slice(i + 1)];
}

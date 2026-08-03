/**
 * Обнаружение JSON-схем форм в каталоге проекта (спека §7.2). Дискриминатор meta-vs-form (MUST):
 * `json.root` — узел (несёт `component`/`value`/`children`) — отсекает `form-schema.schema.json`
 * (draft-07 JSON Schema) и прочие JSON. Бейджи уверенности: `$schema`→form-schema = high,
 * эвристика по shape = medium.
 *
 * Классификация и фильтр файлов — чистые (тестируются). Обход каталога — через File System
 * Access API (browser). FS-типы описаны локально структурно (в lib.dom они неполны).
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
  /** Метка времени файла — только для распознанных схем (детект внешних изменений). */
  lastModified?: number;
}

/** Защита от гигантских каталогов: максимум записей дерева. */
const MAX_TREE_ENTRIES = 4000;

/** Пройти каталог и собрать ПОЛНОЕ дерево (файлы+папки), классифицируя `.json` как схемы форм. */
export async function scanDirectory(dir: FileSystemDirectoryHandle): Promise<TreeEntry[]> {
  const out: TreeEntry[] = [];
  await walkTree(dir as unknown as FsDirHandle, '', 0, out);
  return out;
}

/** Только распознанные схемы из дерева (для счётчиков/бейджей). */
export function formsOf(tree: TreeEntry[]): TreeEntry[] {
  return tree.filter((e) => e.isForm);
}

async function walkTree(
  dir: FsDirHandle,
  prefix: string,
  depth: number,
  out: TreeEntry[]
): Promise<void> {
  if (out.length >= MAX_TREE_ENTRIES) return;
  const entries: Array<FsFileHandle | FsDirHandle> = [];
  for await (const entry of dir.values()) entries.push(entry);
  // папки первыми, затем файлы; внутри — по алфавиту
  entries.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
  );

  for (const entry of entries) {
    if (out.length >= MAX_TREE_ENTRIES) return;
    if (entry.kind === 'directory') {
      if (isIgnoredDir(entry.name)) continue;
      out.push({ path: `${prefix}${entry.name}`, name: entry.name, kind: 'directory', depth });
      await walkTree(entry, `${prefix}${entry.name}/`, depth + 1, out);
      continue;
    }

    const item: TreeEntry = {
      path: `${prefix}${entry.name}`,
      name: entry.name,
      kind: 'file',
      depth,
    };
    // Handle — на любой файл: схемы открываются как форма, прочие — как code-вкладка в Monaco.
    item.handle = entry as unknown as FileSystemFileHandle;
    if (shouldScanFile(entry.name)) {
      try {
        const file = await entry.getFile();
        const { isForm, confidence } = classifyFormSchema(JSON.parse(await file.text()));
        if (isForm && confidence) {
          item.isForm = true;
          item.confidence = confidence;
          item.lastModified = file.lastModified;
        }
      } catch {
        // нечитаемый/невалидный JSON — просто файл
      }
    }
    out.push(item);
  }
}

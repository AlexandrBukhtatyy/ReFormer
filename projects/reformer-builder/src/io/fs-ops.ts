/**
 * Path-based файловые операции над открытым проектом (File System Access, Chromium): создать файл/
 * папку (в т.ч. по вложенному пути), прочитать текст, перечислить содержимое, удалить (рекурсивно),
 * переименовать (`handle.move()`), скопировать (рекурсивно). Родительский каталог резолвится по
 * относительному пути от корня (`projectStore.dirHandle`). FS-типы описаны структурно локально
 * (lib.dom неполон: нет `getDirectoryHandle`/`removeEntry`/`createWritable`/`move`/`values`).
 *
 * @module reformer-builder/io/fs-ops
 */

interface Writable {
  /** `Blob` — при копировании файла: пишем содержимое как есть, не разбирая его как текст. */
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
  move?(name: string): Promise<void>;
}
interface FsDirHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<FsFileHandle | FsDirHandle>;
  move?(name: string): Promise<void>;
}

type Root = FileSystemDirectoryHandle;

const asDir = (h: unknown): FsDirHandle => h as unknown as FsDirHandle;

/** Резолвить каталог по относительному пути (пустой путь → корень). */
async function resolveDir(root: Root, dirPath: string, create = false): Promise<FsDirHandle> {
  let cur = asDir(root);
  for (const seg of dirPath.split('/').filter(Boolean)) {
    cur = await cur.getDirectoryHandle(seg, create ? { create: true } : undefined);
  }
  return cur;
}

/** Разбить путь на родительский каталог и имя (basename). */
export function splitPath(path: string): { dirPath: string; base: string } {
  const i = path.lastIndexOf('/');
  return i === -1
    ? { dirPath: '', base: path }
    : { dirPath: path.slice(0, i), base: path.slice(i + 1) };
}

/** Склеить путь каталога и имя (пустой каталог → просто имя). */
export function joinPath(dirPath: string, name: string): string {
  return dirPath ? `${dirPath}/${name}` : name;
}

/** Создать файл `name` в каталоге `dirPath` с содержимым (перезапись при существовании). */
export async function createFile(
  root: Root,
  dirPath: string,
  name: string,
  content: string
): Promise<FileSystemFileHandle> {
  const parent = await resolveDir(root, dirPath);
  const fh = await parent.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
  return fh as unknown as FileSystemFileHandle;
}

/** Создать каталог `name` в каталоге `dirPath` (идемпотентно). */
export async function createDirectory(root: Root, dirPath: string, name: string): Promise<void> {
  const parent = await resolveDir(root, dirPath);
  await parent.getDirectoryHandle(name, { create: true });
}

/**
 * Создать файл по ВЛОЖЕННОМУ пути внутри `dirPath`, доделывая недостающие каталоги
 * (`ui/head.tsx` → создаст `ui/`). Нужен генерации из шаблона: шаблон может нести подпапки.
 */
export async function createFileDeep(
  root: Root,
  dirPath: string,
  relPath: string,
  content: string
): Promise<FileSystemFileHandle> {
  const { dirPath: sub, base } = splitPath(relPath);
  const parent = await resolveDir(root, sub ? `${dirPath}/${sub}` : dirPath, true);
  const fh = await parent.getFileHandle(base, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
  return fh as unknown as FileSystemFileHandle;
}

/** Прямые подкаталоги каталога (имена). Отсутствующий каталог — пустой список. */
export async function listSubdirectories(root: Root, dirPath: string): Promise<string[]> {
  let dir: FsDirHandle;
  try {
    dir = await resolveDir(root, dirPath);
  } catch {
    return [];
  }
  const out: string[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') out.push(entry.name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Защита от случайного «шаблона» из тысяч файлов. */
const MAX_TEMPLATE_FILES = 500;

/**
 * Рекурсивно собрать пути файлов внутри `dirPath` (относительно него). Отсутствующий каталог —
 * пустой список; обход ограничен {@link MAX_TEMPLATE_FILES} записями.
 */
export async function listFilesDeep(root: Root, dirPath: string): Promise<string[]> {
  let dir: FsDirHandle;
  try {
    dir = await resolveDir(root, dirPath);
  } catch {
    return [];
  }
  const out: string[] = [];
  const walk = async (handle: FsDirHandle, prefix: string): Promise<void> => {
    for await (const entry of handle.values()) {
      if (out.length >= MAX_TEMPLATE_FILES) return;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') await walk(entry, rel);
      else out.push(rel);
    }
  };
  await walk(dir, '');
  return out.sort((a, b) => a.localeCompare(b));
}

/** Прочитать текстовый файл по пути от корня проекта. */
export async function readTextFile(root: Root, path: string): Promise<string> {
  const { dirPath, base } = splitPath(path);
  const parent = await resolveDir(root, dirPath);
  const fh = await parent.getFileHandle(base);
  const file = await fh.getFile();
  return file.text();
}

/** Лежит ли `path` внутри каталога `dir` (или это он сам) — по путям, без обращения к ФС. */
export function isInsideDir(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}/`);
}

/** Защита от копирования гигантских деревьев одним действием. */
const MAX_COPY_ENTRIES = 2000;

/**
 * Скопировать файл или каталог (рекурсивно) в каталог `destDir`. Имя при конфликте разводится
 * через {@link uniqueName} (`ui.tsx` → `ui-2.tsx`), содержимое файлов пишется как `Blob` —
 * бинарные файлы переживают копирование без порчи.
 *
 * Каталог нельзя скопировать в себя или в собственного потомка (иначе обход не завершится) —
 * такой вызов бросает ошибку. Возвращает путь созданной копии.
 */
export async function copyPath(root: Root, srcPath: string, destDir: string): Promise<string> {
  const { dirPath: srcDir, base } = splitPath(srcPath);
  const parent = await resolveDir(root, srcDir);

  let src: FsFileHandle | FsDirHandle;
  try {
    src = await parent.getFileHandle(base);
  } catch {
    src = await parent.getDirectoryHandle(base); // не файл — пробуем каталог
  }
  if (src.kind === 'directory' && isInsideDir(destDir, srcPath)) {
    throw new Error(`Нельзя скопировать «${base}» внутрь самой себя`);
  }

  const target = await resolveDir(root, destDir, true);
  const name = await uniqueName(root, destDir, base);
  let copied = 0;

  const copyFile = async (from: FsFileHandle, into: FsDirHandle, as: string): Promise<void> => {
    if (++copied > MAX_COPY_ENTRIES)
      throw new Error(`Слишком много файлов (> ${MAX_COPY_ENTRIES})`);
    const fh = await into.getFileHandle(as, { create: true });
    const w = await fh.createWritable();
    await w.write(await from.getFile());
    await w.close();
  };

  const copyDir = async (from: FsDirHandle, into: FsDirHandle, as: string): Promise<void> => {
    const dir = await into.getDirectoryHandle(as, { create: true });
    for await (const entry of from.values()) {
      if (entry.kind === 'directory') await copyDir(entry, dir, entry.name);
      else await copyFile(entry, dir, entry.name);
    }
  };

  if (src.kind === 'directory') await copyDir(src, target, name);
  else await copyFile(src, target, name);
  return joinPath(destDir, name);
}

/** Удалить файл/каталог по пути (рекурсивно для каталогов). */
export async function deletePath(root: Root, path: string): Promise<void> {
  const { dirPath, base } = splitPath(path);
  const parent = await resolveDir(root, dirPath);
  await parent.removeEntry(base, { recursive: true });
}

/** Переименовать файл/каталог в том же каталоге через `handle.move()`. */
export async function renamePath(
  root: Root,
  path: string,
  kind: 'file' | 'directory',
  newName: string
): Promise<void> {
  const { dirPath, base } = splitPath(path);
  const parent = await resolveDir(root, dirPath);
  const handle =
    kind === 'directory' ? await parent.getDirectoryHandle(base) : await parent.getFileHandle(base);
  if (typeof handle.move !== 'function') {
    throw new Error('Переименование не поддерживается этим браузером');
  }
  await handle.move(newName);
}

/**
 * Существует ли `name` (файл или каталог) в каталоге `dirPath`. Несуществующий `dirPath` — это
 * тоже «нет» (иначе подбор имени в ещё не созданном каталоге падал бы).
 */
export async function existsIn(root: Root, dirPath: string, name: string): Promise<boolean> {
  let parent: FsDirHandle;
  try {
    parent = await resolveDir(root, dirPath);
  } catch {
    return false;
  }
  try {
    await parent.getFileHandle(name);
    return true;
  } catch {
    /* не файл */
  }
  try {
    await parent.getDirectoryHandle(name);
    return true;
  } catch {
    /* не каталог */
  }
  return false;
}

/** Уникальное имя в каталоге: `base` или `base-2`, `base-3`… (учитывает расширение). */
export async function uniqueName(root: Root, dirPath: string, name: string): Promise<string> {
  if (!(await existsIn(root, dirPath, name))) return name;
  const dot = name.indexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot);
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem}-${n}${ext}`;
    if (!(await existsIn(root, dirPath, candidate))) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

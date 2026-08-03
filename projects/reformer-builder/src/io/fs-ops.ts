/**
 * Path-based файловые операции над открытым проектом (File System Access, Chromium): создать файл/
 * папку, удалить (рекурсивно), переименовать (`handle.move()`). Родительский каталог резолвится по
 * относительному пути от корня (`projectStore.dirHandle`). FS-типы описаны структурно локально
 * (lib.dom неполон: нет `getDirectoryHandle`/`removeEntry`/`createWritable`/`move`).
 *
 * @module reformer-builder/io/fs-ops
 */

interface Writable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  kind: 'file';
  name: string;
  createWritable(): Promise<Writable>;
  move?(name: string): Promise<void>;
}
interface FsDirHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
  move?(name: string): Promise<void>;
}

type Root = FileSystemDirectoryHandle;

const asDir = (h: unknown): FsDirHandle => h as unknown as FsDirHandle;

/** Резолвить каталог по относительному пути (пустой путь → корень). */
async function resolveDir(root: Root, dirPath: string): Promise<FsDirHandle> {
  let cur = asDir(root);
  for (const seg of dirPath.split('/').filter(Boolean)) {
    cur = await cur.getDirectoryHandle(seg);
  }
  return cur;
}

/** Разбить путь на родительский каталог и имя (basename). */
function splitPath(path: string): { dirPath: string; base: string } {
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

/** Существует ли `name` (файл или каталог) в каталоге `dirPath`. */
export async function existsIn(root: Root, dirPath: string, name: string): Promise<boolean> {
  const parent = await resolveDir(root, dirPath);
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

/**
 * File System Access API (спека §7.1, Chromium-only). Выбор каталога readwrite upfront, чтение/
 * запись файлов, запрос разрешения, чтение конфигов prettier. FS-типы описаны структурно локально
 * (lib.dom неполон: нет `showDirectoryPicker`, async-итерации, `createWritable`).
 *
 * @module reformer-builder/io/fs-access
 */

// ── структурные типы FS Access API ──────────────────────────────────────────

interface Writable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
}
interface FsDirHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<FsFileHandle | FsDirHandle>;
  getFileHandle(name: string): Promise<FsFileHandle>;
}
interface PermissionCapable {
  queryPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}
type Picker = (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

/** Поддерживается ли File System Access API (Chromium). */
export function fsAccessSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/** Выбрать каталог проекта (readwrite upfront — один промпт, спека §7.1 Q30). */
export function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  // Вызываем МЕТОДОМ на window (this === window) — иначе TypeError: Illegal invocation.
  const w = window as unknown as { showDirectoryPicker: Picker };
  return w.showDirectoryPicker({ mode: 'readwrite' });
}

/** Запросить/подтвердить readwrite-разрешение на handle (для «Переоткрыть»). */
export async function ensurePermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const h = handle as unknown as PermissionCapable;
  if (h.queryPermission && (await h.queryPermission({ mode })) === 'granted') return true;
  if (h.requestPermission && (await h.requestPermission({ mode })) === 'granted') return true;
  return false;
}

/** Прочитать файл: текст + метка времени (для baseline/конфликтов). */
export async function readFile(
  handle: FileSystemFileHandle
): Promise<{ text: string; lastModified: number }> {
  const file = await (handle as unknown as FsFileHandle).getFile();
  return { text: await file.text(), lastModified: file.lastModified };
}

/** Записать текст в файл (защищённая запись — вызывающий уже проверил конфликт). */
export async function writeFile(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await (handle as unknown as FsFileHandle).createWritable();
  await writable.write(text);
  await writable.close();
}

/** Имена конфигов форматирования, которые пытаемся прочитать из корня проекта. */
const CONFIG_NAMES = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.cjs',
  '.prettierrc.js',
  '.prettierrc.mjs',
  '.editorconfig',
  'package.json',
];

/** Прочитать доступные конфиги prettier из корня каталога (карта `имя → содержимое`). */
export async function readPrettierConfigs(
  dir: FileSystemDirectoryHandle
): Promise<Record<string, string>> {
  const d = dir as unknown as FsDirHandle;
  const out: Record<string, string> = {};
  await Promise.all(
    CONFIG_NAMES.map(async (name) => {
      try {
        const handle = await d.getFileHandle(name);
        out[name] = await (await handle.getFile()).text();
      } catch {
        /* нет такого файла */
      }
    })
  );
  return out;
}

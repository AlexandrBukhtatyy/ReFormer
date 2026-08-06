/**
 * In-memory реализация File System Access API для юнитов: живой пикер каталога автоматизацией не
 * проходится, поэтому запись/чтение файлов проверяем на этой заглушке. Поддерживает ровно то, что
 * использует `io/fs-ops`: getFileHandle / getDirectoryHandle / removeEntry / values / createWritable.
 */

class FakeFile {
  kind = 'file' as const;
  name: string;
  content: string;

  constructor(name: string, content = '') {
    this.name = name;
    this.content = content;
  }

  getFile(): Promise<{ text: () => Promise<string> }> {
    return Promise.resolve({ text: () => Promise.resolve(this.content) });
  }

  createWritable(): Promise<{
    write: (d: string | { text(): Promise<string> }) => Promise<void>;
    close: () => Promise<void>;
  }> {
    return Promise.resolve({
      // Копирование пишет `Blob` (File), а не строку — как в браузере, сохраняем его содержимое.
      write: async (d: string | { text(): Promise<string> }) => {
        this.content = typeof d === 'string' ? d : await d.text();
      },
      close: () => Promise.resolve(),
    });
  }
}

class FakeDir {
  kind = 'directory' as const;
  name: string;
  children = new Map<string, FakeFile | FakeDir>();

  constructor(name: string) {
    this.name = name;
  }

  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FakeFile> {
    const existing = this.children.get(name);
    if (existing instanceof FakeFile) return Promise.resolve(existing);
    if (existing || !opts?.create) return Promise.reject(new Error(`NotFound: ${name}`));
    const file = new FakeFile(name);
    this.children.set(name, file);
    return Promise.resolve(file);
  }

  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDir> {
    const existing = this.children.get(name);
    if (existing instanceof FakeDir) return Promise.resolve(existing);
    if (existing || !opts?.create) return Promise.reject(new Error(`NotFound: ${name}`));
    const dir = new FakeDir(name);
    this.children.set(name, dir);
    return Promise.resolve(dir);
  }

  removeEntry(name: string): Promise<void> {
    this.children.delete(name);
    return Promise.resolve();
  }

  async *values(): AsyncIterableIterator<FakeFile | FakeDir> {
    for (const child of this.children.values()) yield child;
  }
}

/** Пустой корень проекта. */
export function fakeRoot(): FileSystemDirectoryHandle {
  return new FakeDir('project') as unknown as FileSystemDirectoryHandle;
}

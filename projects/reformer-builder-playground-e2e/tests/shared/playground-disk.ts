/**
 * «Диск» теста: копия каталога playground, которую билдер открывает как проект.
 *
 * ## Почему не настоящий каталог
 *
 * Билдер читает и пишет проект через File System Access, а каталог получает из
 * `showDirectoryPicker()` — системного диалога, которым Playwright управлять не может. Поэтому
 * выбор каталога подменяется, и отдаёт подмена каталог из OPFS страницы, заранее заполненный
 * файлами `projects/reformer-builder-playground`.
 *
 * OPFS, а не объект-заглушка, потому что билдеру нужен НАСТОЯЩИЙ `FileSystemDirectoryHandle`:
 * он кладёт хэндл в IndexedDB (структурное клонирование заглушку не переживёт) и по нему же
 * восстанавливает проект после перезагрузки, сверяет каталоги через `isSameEntry`, спрашивает
 * `queryPermission`. Хэндл OPFS проходит весь этот путь тем же кодом, что и каталог с диска.
 *
 * Побочная выгода — изоляция: у каждого теста свой контекст браузера, значит свой OPFS и своя
 * свежая копия. Тест может править и удалять файлы, не трогая рабочее дерево репозитория.
 *
 * @module tests/shared/playground-disk
 */

import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { PLAYGROUND_DIR } from './paths';

/**
 * Каталог верхнего уровня в OPFS, под которым лежит «диск».
 *
 * Свои корни там есть и у билдера — `ws/` (рабочие копии), `build/` (кэш транспиляции)
 * и `plugins/` (установленные плагины); имя выбрано так, чтобы с ними не пересечься.
 */
const DISK_MOUNT = 'e2e-disk';

/** Чего в копии нет: это не файлы проекта, и на них билдер упёрся бы в потолок листинга. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist']);

/** Файл снимка. Содержимое — base64: аргумент `page.evaluate` обязан быть сериализуемым. */
interface DiskFile {
  /** Путь от корня проекта, через `/`. */
  readonly path: string;
  readonly base64: string;
}

/** Содержимое «диска»: путь от корня проекта → текст файла. */
export type DiskSnapshot = Readonly<Record<string, string>>;

/** Мост к «диску» на странице — ставится init-скриптом {@link PlaygroundDisk.install}. */
interface DiskBridge {
  /** Корень проекта. `create` — завести, если его ещё нет. */
  root(create?: boolean): Promise<FileSystemDirectoryHandle>;
  /** Файл по пути от корня проекта. `create` доделывает и недостающие каталоги. */
  file(filePath: string, create?: boolean): Promise<FileSystemFileHandle>;
}

declare global {
  interface Window {
    __e2eDisk?: DiskBridge;
  }
}

/** Файлы каталога рекурсивно, в устойчивом порядке. */
function readDirectory(root: string, relative = ''): DiskFile[] {
  const files: DiskFile[] = [];
  const entries = readdirSync(path.join(root, relative), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...readDirectory(root, entryPath));
    } else if (entry.isFile()) {
      files.push({
        path: entryPath,
        base64: readFileSync(path.join(root, entryPath)).toString('base64'),
      });
    }
  }
  return files;
}

export class PlaygroundDisk {
  /** Имя каталога проекта. Его же билдер показывает подписью проекта в «Недавно открытых». */
  readonly name = path.basename(PLAYGROUND_DIR);

  constructor(private readonly page: Page) {}

  /**
   * Подменяет выбор каталога и ставит мост к «диску».
   *
   * Зовётся до первой навигации: init-скрипт исполняется на каждой загрузке страницы раньше
   * кода приложения, поэтому подмена переживает и перезагрузку.
   */
  async install(): Promise<void> {
    await this.page.addInitScript(
      ({ mount, name }) => {
        const root = async (create = false): Promise<FileSystemDirectoryHandle> => {
          const opfs = await navigator.storage.getDirectory();
          const disk = await opfs.getDirectoryHandle(mount, { create });
          return disk.getDirectoryHandle(name, { create });
        };

        window.__e2eDisk = {
          root,
          async file(filePath, create = false) {
            const segments = filePath.split('/');
            const fileName = segments.pop() ?? '';
            let directory = await root();
            for (const segment of segments) {
              directory = await directory.getDirectoryHandle(segment, { create });
            }
            return directory.getFileHandle(fileName, { create });
          },
        };

        // «Диск» не заполнен — `getDirectoryHandle` откажет `NotFoundError`, и билдер честно
        // покажет, что проект не открылся: тест, забывший `seed()`, падает на причине.
        (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker =
          () => root();
      },
      { mount: DISK_MOUNT, name: this.name }
    );
  }

  /**
   * Кладёт на «диск» свежую копию playground; прежнюю сносит.
   *
   * Требует уже открытой страницы билдера: OPFS принадлежит origin, и до навигации его нет.
   */
  async seed(): Promise<void> {
    const files = readDirectory(PLAYGROUND_DIR);
    await this.page.evaluate(
      async ({ mount, name, files }) => {
        const opfs = await navigator.storage.getDirectory();
        const disk = await opfs.getDirectoryHandle(mount, { create: true });
        try {
          await disk.removeEntry(name, { recursive: true });
        } catch {
          // Каталога ещё нет — сносить нечего.
        }
        await disk.getDirectoryHandle(name, { create: true });

        for (const file of files) {
          const handle = await window.__e2eDisk!.file(file.path, true);
          const writable = await handle.createWritable();
          await writable.write(Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0)));
          await writable.close();
        }
      },
      { mount: DISK_MOUNT, name: this.name, files }
    );
  }

  /** Текст файла с «диска» — то, что билдер туда записал. */
  readText(filePath: string): Promise<string> {
    return this.page.evaluate(async (target) => {
      const handle = await window.__e2eDisk!.file(target);
      return (await handle.getFile()).text();
    }, filePath);
  }

  /** Пишет файл на «диск» мимо билдера — правка «снаружи», как из IDE. */
  async writeText(filePath: string, text: string): Promise<void> {
    await this.page.evaluate(
      async ({ target, content }) => {
        const handle = await window.__e2eDisk!.file(target, true);
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      },
      { target: filePath, content: text }
    );
  }

  /** Есть ли файл на «диске». */
  exists(filePath: string): Promise<boolean> {
    return this.page.evaluate(async (target) => {
      try {
        await window.__e2eDisk!.file(target);
        return true;
      } catch {
        return false;
      }
    }, filePath);
  }

  /** Весь «диск» целиком — для сравнения «до и после». */
  snapshot(): Promise<DiskSnapshot> {
    return this.page.evaluate(async () => {
      const snapshot: Record<string, string> = {};
      const visit = async (directory: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
        for await (const entry of directory.values()) {
          const entryPath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
          if (entry.kind === 'directory') {
            await visit(entry as FileSystemDirectoryHandle, entryPath);
          } else {
            snapshot[entryPath] = await (await (entry as FileSystemFileHandle).getFile()).text();
          }
        }
      };
      await visit(await window.__e2eDisk!.root(), '');
      return snapshot;
    });
  }
}

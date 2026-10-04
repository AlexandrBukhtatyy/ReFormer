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

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
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

/** Файл снимка. Содержимое — base64: аргумент `page.evaluate` обязан быть сериализуемым. */
interface DiskFile {
  /** Путь от корня проекта, через `/`. */
  readonly path: string;
  readonly base64: string;
}

/** Каталог плагинов проекта — там их ищет билдер, там же лежат их пакеты. */
const PLUGINS_DIR = '.ui_builder/plugins';

/**
 * Плагины, которые лежат на «диске» всегда.
 *
 * Плагин проекта — пакет в `.ui_builder/plugins/<id>/`: исходники в `src/`, а в корне каталога —
 * сборка для билдера (`build:dev` пакета), её он и грузит. Сборку исключает `.gitignore` самого
 * плагина, поэтому в список файлов репозитория она не попадает и добавляется к копии отдельно.
 * Собирает её подготовка прогона (`global-setup.ts`).
 */
const DEFAULT_PLUGINS = ['playground-hello'];

/**
 * Плагины, которые кладутся на «диск» только по просьбе теста.
 *
 * Сборка кита HexaUI весит около 5 МБ: в каждой копии она стоила бы секунд каждому тесту.
 * Без теста, который её просит, каталога плагина в копии нет вовсе — включённый настройкой,
 * но отсутствующий плагин билдер пропускает молча.
 */
const OPTIONAL_PLUGINS = ['kit-hexa-ui'];

/** Что положить на «диск» сверх обычной копии. */
export interface SeedOptions {
  /** Плагины из числа необязательных — идентификаторами: `['kit-hexa-ui']`. */
  readonly plugins?: readonly string[];
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

const readFile = (root: string, filePath: string): DiskFile => ({
  path: filePath,
  base64: readFileSync(path.join(root, filePath)).toString('base64'),
});

/**
 * Файлы проекта, как их видит git: отслеживаемые и новые, без игнорируемых.
 *
 * Одно правило вместо своего списка исключений: что `.gitignore` называет не-проектом
 * (`node_modules`, сборки, отчёты), то и в копию не едет. Заодно копия одинакова на любой
 * машине.
 *
 * @param skippedDirectories каталоги, которых в копии быть не должно, — пути от корня проекта.
 */
function readRepositoryFiles(root: string, skippedDirectories: readonly string[]): DiskFile[] {
  const listing = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }
  );
  return (
    listing
      .split('\0')
      // Удалённый из рабочего дерева файл в индексе ещё значится — на диске его нет.
      .filter((filePath) => filePath !== '' && existsSync(path.join(root, filePath)))
      .filter((filePath) => !skippedDirectories.some((dir) => filePath.startsWith(`${dir}/`)))
      .sort()
      .map((filePath) => readFile(root, filePath))
  );
}

/** То, что из собранного манифеста плагина нужно, чтобы назвать файлы сборки. */
interface BuiltManifest {
  readonly main: string;
  readonly styles?: { readonly file: string };
  readonly contributes?: { readonly messages?: Readonly<Record<string, string>> };
}

/**
 * Сборка плагина для билдера: файлы, которые называет её манифест в корне каталога плагина.
 *
 * Список берётся из манифеста, а не обходом каталога: рядом со сборкой лежит сам пакет —
 * исходники, `node_modules`, сборка для поставки.
 */
function readPluginBuild(root: string, pluginDir: string): DiskFile[] {
  const manifestPath = `${pluginDir}/manifest.json`;
  if (!existsSync(path.join(root, manifestPath))) {
    throw new Error(
      `в playground нет «${manifestPath}»: плагин не собран. ` +
        'Плагины проекта собирает «npm run plugins:build -w reformer-builder-playground»'
    );
  }
  const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), 'utf8')) as BuiltManifest;
  return [
    'manifest.json',
    manifest.main,
    ...(manifest.styles === undefined ? [] : [manifest.styles.file]),
    ...Object.values(manifest.contributes?.messages ?? {}),
  ].map((file) => readFile(root, `${pluginDir}/${file}`));
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
  async seed(options: SeedOptions = {}): Promise<void> {
    const plugins = [...DEFAULT_PLUGINS, ...(options.plugins ?? [])];
    const skipped = OPTIONAL_PLUGINS.filter((id) => !plugins.includes(id));
    const files = [
      ...readRepositoryFiles(
        PLAYGROUND_DIR,
        skipped.map((id) => `${PLUGINS_DIR}/${id}`)
      ),
      ...plugins.flatMap((id) => readPluginBuild(PLAYGROUND_DIR, `${PLUGINS_DIR}/${id}`)),
    ];
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

  /** Удаляет файл или каталог с «диска» — как будто его там и не было. */
  async remove(entryPath: string): Promise<void> {
    await this.page.evaluate(async (target) => {
      const segments = target.split('/');
      const name = segments.pop() ?? '';
      let directory = await window.__e2eDisk!.root();
      for (const segment of segments) directory = await directory.getDirectoryHandle(segment);
      await directory.removeEntry(name, { recursive: true });
    }, entryPath);
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

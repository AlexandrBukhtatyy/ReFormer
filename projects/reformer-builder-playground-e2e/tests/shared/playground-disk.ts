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
import { existsSync, readdirSync, readFileSync } from 'fs';
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

/** Каталог исходников пакета плагина; его `manifest.json` и делает каталог пакетом плагина. */
const PLUGIN_SOURCES = 'src';

/**
 * Плагины, которые кладутся на «диск» только по просьбе теста, — каталогами от каталога плагинов.
 * Остальные плагины проекта лежат там всегда.
 *
 * Сборка кита HexaUI весит около 5 МБ, сборка ассистента с корпусом знаний — около 8 МБ:
 * в каждой копии они стоили бы секунд каждому тесту. Без теста, который такой плагин просит,
 * его каталога в копии нет вовсе — включённый настройкой, но отсутствующий плагин билдер
 * пропускает молча.
 */
const OPTIONAL_PLUGINS = ['kit-hexa-ui', 'reformer/ai'];

/** Что положить на «диск» сверх обычной копии. */
export interface SeedOptions {
  /** Плагины из числа необязательных — каталогами: `['kit-hexa-ui']`. */
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
 * Файлы проекта, как их видит git: отслеживаемые и новые, без игнорируемых, — путями от корня.
 *
 * Одно правило вместо своего списка исключений: что `.gitignore` называет не-проектом
 * (`node_modules`, сборки, отчёты), то и в копию не едет. Заодно копия одинакова на любой
 * машине.
 */
function repositoryFiles(root: string): string[] {
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
      .sort()
  );
}

/**
 * Пакеты плагинов проекта — каталогами от каталога плагинов: `playground-hello`, `rjsf/editor`.
 *
 * Правило то же, что у загрузчика билдера: пакет плагина лежит либо прямо в каталоге плагинов,
 * либо уровнем ниже, в каталоге домена. Пакет узнаётся по манифесту исходников; ядро домена
 * (`rjsf/core`) плагином не является и в копию не идёт.
 */
function pluginPackages(root: string): string[] {
  const pluginsRoot = path.join(root, PLUGINS_DIR);
  const directories = (dir: string): string[] =>
    readdirSync(path.join(pluginsRoot, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .filter((entry) => entry.name !== 'node_modules')
      .map((entry) => (dir === '' ? entry.name : `${dir}/${entry.name}`))
      .sort();
  const isPackage = (dir: string): boolean =>
    existsSync(path.join(pluginsRoot, dir, PLUGIN_SOURCES, 'manifest.json'));

  return directories('').flatMap((dir) =>
    isPackage(dir) ? [dir] : directories(dir).filter(isPackage)
  );
}

/** То, что из собранного манифеста плагина нужно, чтобы назвать файлы сборки. */
interface BuiltManifest {
  readonly main: string;
  readonly styles?: { readonly file: string };
  readonly contributes?: { readonly messages?: Readonly<Record<string, string>> };
}

/** Каталог модулей данных сборки: JSON, который плагин импортирует отложенно. */
const PLUGIN_CHUNKS = 'chunks';

/**
 * Сборка плагина для билдера: файлы, которые называет её манифест в корне каталога плагина,
 * и модули данных из `chunks/` — их манифест не называет, каталог принадлежит сборке.
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
  const chunksDir = path.join(root, pluginDir, PLUGIN_CHUNKS);
  const chunks = existsSync(chunksDir)
    ? readdirSync(chunksDir).map((name) => `${PLUGIN_CHUNKS}/${name}`)
    : [];
  return [
    'manifest.json',
    manifest.main,
    ...(manifest.styles === undefined ? [] : [manifest.styles.file]),
    ...Object.values(manifest.contributes?.messages ?? {}),
    ...chunks,
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
    const requested = options.plugins ?? [];
    const plugins = pluginPackages(PLAYGROUND_DIR)
      .filter((dir) => !OPTIONAL_PLUGINS.includes(dir) || requested.includes(dir))
      .map((dir) => `${PLUGINS_DIR}/${dir}`);
    // Из каталога плагинов в копию идут только пакеты плагинов, и те без исходников: билдер
    // грузит сборку, а сотни файлов `src/` стоили бы времени каждому тесту. Остальное там —
    // ядра доменов и общие тестовые помощники — проекту, открытому билдером, не нужно.
    const inPlugin = (filePath: string): boolean =>
      plugins.some(
        (dir) => filePath.startsWith(`${dir}/`) && !filePath.startsWith(`${dir}/${PLUGIN_SOURCES}/`)
      );
    const files = [
      ...repositoryFiles(PLAYGROUND_DIR)
        .filter((filePath) => !filePath.startsWith(`${PLUGINS_DIR}/`) || inPlugin(filePath))
        .map((filePath) => readFile(PLAYGROUND_DIR, filePath)),
      ...plugins.flatMap((dir) => readPluginBuild(PLAYGROUND_DIR, dir)),
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

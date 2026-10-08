/**
 * «Диск» прогона `embedded`: каталог приложения-образца, который встроенный билдер открывает
 * как проект.
 *
 * ## То же, что у остальных тестов, и одно отличие
 *
 * Выбор каталога подменён «диском» в OPFS страницы — см. `tests/shared/playground-disk.ts`.
 * Но встроенному билдеру этого мало: форму в его превью рисует ПРИЛОЖЕНИЕ, а его dev-сервер
 * читает настоящий диск. Сохранённый в OPFS файл превью не увидело бы никогда.
 *
 * Поэтому запись зеркалируется: когда билдер закрывает поток записи в файл проекта, тот же
 * файл ложится в копию приложения на настоящем диске — и закрытие потока завершается только
 * после этого. Для билдера и для сервера это выглядит как обычный каталог: «сохранил —
 * файл на диске изменился».
 *
 * ## Копия на диске одна на весь прогон
 *
 * В отличие от OPFS, она общая для всех тестов (сервер один), поэтому тесты цели `embedded`
 * идут по одному, а каждый возвращает за собой тронутые файлы — {@link HostDisk.restore}.
 *
 * @module tests/embedded/shared/host-disk
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { HOST_E2E_DIR, HOST_EXAMPLE_DIR } from '../../shared/paths';
import { PlaygroundDisk } from '../../shared/playground-disk';

/** Имя функции страницы, которой зеркало отдаёт записанный файл. */
const MIRROR_BINDING = '__e2eMirrorWrite';

declare global {
  interface Window {
    __e2eMirrorWrite?: (filePath: string, base64: string) => Promise<void>;
  }
}

/** Файлы приложения, как их видит git: отслеживаемые и новые, без игнорируемых. */
function hostFiles(): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: HOST_EXAMPLE_DIR,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((filePath) => filePath !== '' && existsSync(path.join(HOST_EXAMPLE_DIR, filePath)))
    .sort();
}

export class HostDisk extends PlaygroundDisk {
  /** Имя каталога проекта — им билдер подписывает проект. */
  override readonly name = path.basename(HOST_EXAMPLE_DIR);

  /** Файлы копии на настоящем диске, изменённые за тест, — путями от корня проекта. */
  private readonly touched = new Set<string>();

  constructor(private readonly hostPage: Page) {
    super(hostPage);
  }

  /** Подменяет выбор каталога (как у остальных тестов) и включает зеркало записи. */
  override async install(): Promise<void> {
    await super.install();

    await this.hostPage.exposeFunction(MIRROR_BINDING, (filePath: string, base64: string) => {
      const target = path.join(HOST_E2E_DIR, filePath);
      const content = Buffer.from(base64, 'base64');
      // Тот же текст не пишется: dev-сервер следит за временем изменения, и пустая запись
      // (заполнение «диска» перед тестом) выглядела бы для него правкой каждого файла.
      if (existsSync(target) && readFileSync(target).equals(content)) return;
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
      this.touched.add(filePath);
    });

    await this.hostPage.addInitScript((binding) => {
      // Рамки превью — тоже документы этой страницы; пишет в проект только верхний.
      if (window.top !== window) return;
      const createWritable = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = async function (
        this: FileSystemFileHandle,
        ...options
      ) {
        const stream = await createWritable.apply(this, options);
        const close = stream.close.bind(stream);
        stream.close = async () => {
          await close();
          const mirror = (window as unknown as Record<string, unknown>)[binding] as
            | ((filePath: string, base64: string) => Promise<void>)
            | undefined;
          // В OPFS у билдера есть и свои каталоги (рабочие копии, кэш сборки): зеркалится
          // только то, что лежит в каталоге проекта.
          const root = await window.__e2eDisk?.root().catch(() => null);
          const segments = root == null ? null : await root.resolve(this);
          if (mirror === undefined || segments == null) return;
          const bytes = new Uint8Array(await (await this.getFile()).arrayBuffer());
          let binary = '';
          for (const byte of bytes) binary += String.fromCharCode(byte);
          await mirror(segments.join('/'), btoa(binary));
        };
        return stream;
      };
    }, MIRROR_BINDING);
  }

  /** Кладёт на «диск» приложение-образец — тот же набор файлов, что в копии под сервером. */
  override async seed(): Promise<void> {
    const files = hostFiles().map((filePath) => ({
      path: filePath,
      base64: readFileSync(path.join(HOST_EXAMPLE_DIR, filePath)).toString('base64'),
    }));
    await this.hostPage.evaluate(async (entries) => {
      await window.__e2eDisk!.root(true);
      for (const entry of entries) {
        const handle = await window.__e2eDisk!.file(entry.path, true);
        const writable = await handle.createWritable();
        await writable.write(Uint8Array.from(atob(entry.base64), (char) => char.charCodeAt(0)));
        await writable.close();
      }
    }, files);
  }

  /** Текст файла в копии на настоящем диске — то, что читает dev-сервер приложения. */
  readServed(filePath: string): string {
    return readFileSync(path.join(HOST_E2E_DIR, filePath), 'utf8');
  }

  /**
   * Возвращает копию на настоящем диске к исходному виду: тронутые тестом файлы переписываются
   * из оригинала, а появившиеся — удаляются.
   */
  restore(): void {
    for (const filePath of this.touched) {
      const original = path.join(HOST_EXAMPLE_DIR, filePath);
      const served = path.join(HOST_E2E_DIR, filePath);
      if (existsSync(original)) writeFileSync(served, readFileSync(original));
      else rmSync(served, { force: true });
    }
    this.touched.clear();
  }
}

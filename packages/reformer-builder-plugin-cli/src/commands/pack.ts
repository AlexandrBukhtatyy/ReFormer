/**
 * `reformer-plugin pack`: собранный плагин → npm-архив `<имя>-<версия>.tgz`.
 *
 * В архиве ровно каталог сборки плюс `package.json`: установка из npm (фаза 9 плана) распакует
 * его в каталог плагина, и загрузчик найдёт там то же, что после `build`. Исходники, тесты
 * и `node_modules` в архив не попадают — упаковывается временный каталог, а не каталог автора.
 *
 * `package.json` архива собирается из исходного: имя, версия, описание, лицензия и ключевые
 * слова, к которым добавляется `reformer-builder-plugin` — по нему плагин ищется в реестре.
 * `private` снимается, зависимостей нет: всё, что плагину нужно, вложено в `main.js`
 * или подставляется оболочкой. Версия берётся из манифеста — `validate` уже проверил, что
 * с `package.json` она совпадает.
 *
 * Сам архив делает `npm pack`: формат tarball'а npm — не то, что стоит повторять руками.
 *
 * @module @reformer/builder-plugin-cli/commands/pack
 */

import { exec } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { buildPlugin } from './build.js';
import type { Finding } from './findings.js';

const run = promisify(exec);

/** Ключевое слово, по которому плагины билдера ищутся в реестре npm. */
const PLUGIN_KEYWORD = 'reformer-builder-plugin';

export interface PackOptions {
  readonly dir: string;
  /** Куда положить архив; умолчание — каталог исходников. */
  readonly destination?: string;
}

export type PackResult =
  | { readonly ok: true; readonly file: string; readonly notices: readonly string[] }
  | { readonly ok: false; readonly findings: readonly Finding[] };

export async function packPlugin(options: PackOptions): Promise<PackResult> {
  const dir = resolve(options.dir);
  const destination = resolve(dir, options.destination ?? '.');
  const staging = await mkdtemp(join(tmpdir(), 'reformer-plugin-pack-'));

  try {
    const built = await buildPlugin({ dir, outDir: staging });
    if (!built.ok) return built;
    const { manifest } = built;

    let source: Record<string, unknown> = {};
    try {
      source = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      // Без package.json имя пакета — идентификатор плагина.
    }
    const keywords = Array.isArray(source.keywords) ? (source.keywords as unknown[]) : [];
    const pkg = {
      name: typeof source.name === 'string' ? source.name : manifest.id.toLowerCase(),
      version: manifest.version,
      ...(typeof source.description === 'string' ? { description: source.description } : {}),
      ...(typeof source.license === 'string' ? { license: source.license } : {}),
      keywords: [...new Set([...keywords, PLUGIN_KEYWORD])],
    };
    await writeFile(join(staging, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

    try {
      // Одной строкой через оболочку — ради Windows: `npm` там командный файл и без оболочки
      // не запускается, а массив аргументов вместе с `shell` Node объявил устаревшим (DEP0190).
      // Единственный подставляемый аргумент — путь, и он в кавычках JSON.
      const { stdout } = await run(
        `npm pack --json --pack-destination ${JSON.stringify(destination)}`,
        { cwd: staging }
      );
      const [info] = JSON.parse(stdout) as { filename: string }[];
      if (info === undefined) throw new Error('npm pack не назвал архив');
      return { ok: true, file: join(destination, info.filename), notices: built.notices };
    } catch (error) {
      return {
        ok: false,
        findings: [
          {
            code: 'pack-failed',
            message: `npm pack отказал: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

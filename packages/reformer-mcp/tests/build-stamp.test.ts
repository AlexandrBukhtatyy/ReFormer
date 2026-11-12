/**
 * Метка сборки и свежесть `dist` (фаза 5 аудита, ReFormer-11oe.6).
 *
 * Копии MCP — бандл воркера (`mcp:build`), компилятор и корпус в плагинах (`plugins:build`) —
 * собираются из `dist`. Метка — хэш исходников, хэш корпуса — по содержимому пакетов; проверка
 * свежести не даёт собрать копию из устаревшего `dist`, а одинаковые метки и хэши значат одну сборку.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBuildId, readManifest, sourceHash, staleness } from '../scripts/lib/build-stamp.mjs';
import { corpusHash, readCorpusSources } from '../scripts/lib/corpus.mjs';
import { buildIdOf, versionWithBuild } from '../src/build-info';
import { precondition } from './support/preconditions';

const pkgDir = resolve(__dirname, '..');

/**
 * Пакет-двойник: `src/`, `package.json`, `dist` с меткой и корпусом и монорепо с одним пакетом
 * документации — ровно то, что читает проверка свежести.
 */
function fakeRepo(root: string) {
  const pkg = join(root, 'packages', 'reformer-mcp');
  const docs = join(root, 'packages', 'reformer');
  mkdirSync(join(pkg, 'src'), { recursive: true });
  mkdirSync(join(pkg, 'dist', 'core', 'docs'), { recursive: true });
  mkdirSync(join(pkg, 'dist', 'knowledge'), { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeFileSync(join(pkg, 'package.json'), '{"version":"1.2.3"}');
  writeFileSync(join(pkg, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(
    join(pkg, 'dist', 'core', 'docs', 'packages.js'),
    "export const packageDirName = (pkg) => pkg.replace('@reformer/core', 'reformer');\n"
  );
  writeFileSync(join(docs, 'llms-index.json'), '{"symbols":[],"topics":[]}');
  writeFileSync(join(docs, 'llms.txt'), '# core\n');

  /** Собрать `dist` так, как это делает `npm run build`: метка и манифест корпуса. */
  const build = () => {
    writeFileSync(
      join(pkg, 'dist', 'build-info.js'),
      `export const BUILD_ID = '${sourceHash(pkg)}';\n`
    );
    const sources = readCorpusSources({
      repoRoot: root,
      packages: ['@reformer/core'],
      packageDirName: (name: string) => name.replace('@reformer/core', 'reformer'),
    });
    writeFileSync(
      join(pkg, 'dist', 'knowledge', 'knowledge-manifest.json'),
      JSON.stringify({ corpusHash: corpusHash(sources), packages: ['@reformer/core'] })
    );
  };
  return { pkg, docs, build };
}

describe('метка сборки', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'build-stamp-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('хэш исходников: тот же текст — та же метка, CRLF — как LF, правка или версия — другая', () => {
    const { pkg } = fakeRepo(root);
    const first = sourceHash(pkg);
    expect(first).toMatch(/^[0-9a-f]{12}$/);
    expect(sourceHash(pkg)).toBe(first);

    writeFileSync(join(pkg, 'src', 'a.ts'), 'export const a = 1;\r\n');
    expect(sourceHash(pkg)).toBe(first);
    writeFileSync(join(pkg, 'src', 'a.ts'), 'export const a = 2;\n');
    expect(sourceHash(pkg)).not.toBe(first);
    writeFileSync(join(pkg, 'src', 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(pkg, 'package.json'), '{"version":"1.2.4"}');
    expect(sourceHash(pkg)).not.toBe(first);
  });

  it('хэш корпуса — по содержимому: время изменения источника его не меняет', () => {
    const { docs } = fakeRepo(root);
    const read = () =>
      corpusHash(
        readCorpusSources({
          repoRoot: root,
          packages: ['@reformer/core'],
          packageDirName: () => 'reformer',
        })
      );
    const first = read();
    utimesSync(join(docs, 'llms.txt'), new Date(2030, 0, 1), new Date(2030, 0, 1));
    expect(read()).toBe(first);
    writeFileSync(join(docs, 'llms.txt'), '# core v2\n');
    expect(read()).not.toBe(first);
  });

  it('свежесть: не собран, собран, правка исходников, правка документации', async () => {
    const { pkg, docs, build } = fakeRepo(root);
    expect(await staleness(pkg, root)).toEqual(['dist не собран или собран без метки']);

    build();
    expect(await staleness(pkg, root)).toEqual([]);

    writeFileSync(join(pkg, 'src', 'a.ts'), 'export const a = 2;\n');
    expect((await staleness(pkg, root)).join('\n')).toContain('исходники @reformer/mcp изменились');
    build();

    writeFileSync(join(docs, 'llms.txt'), '# core v2\n');
    expect((await staleness(pkg, root)).join('\n')).toContain('документация пакетов');

    // `tsc` без `npm run build` кладёт заглушку: сборка не полная, даже если код свежий.
    writeFileSync(join(docs, 'llms.txt'), '# core\n');
    writeFileSync(join(pkg, 'dist', 'build-info.js'), "export const BUILD_ID = 'dev';\n");
    expect(await staleness(pkg, root)).toEqual([
      'dist пересобран tsc без метки (npm run dev или tsc), а не npm run build',
    ]);
  });

  it('метка в версии serverInfo: 6.0.0+<метка>, у кода из исходников — без неё', () => {
    expect(versionWithBuild('6.0.0', 'abc123')).toBe('6.0.0+abc123');
    expect(versionWithBuild('6.0.0', 'dev')).toBe('6.0.0');
    expect(buildIdOf('6.0.0+abc123')).toBe('abc123');
    expect(buildIdOf('6.0.0')).toBeNull();
    expect(buildIdOf(undefined)).toBeNull();
  });
});

// Полная сборка: корпус есть, а метка не заглушка — `tsc` (npm run dev) перезаписывает её на `dev`.
const built =
  existsSync(resolve(pkgDir, 'dist', 'knowledge', 'knowledge-manifest.json')) &&
  readBuildId(pkgDir) !== 'dev';

describe.runIf(precondition('полная сборка dist', built, 'npm run build -w @reformer/mcp'))(
  'собранный dist пакета',
  () => {
    it('метка и манифест корпуса — одной сборки', () => {
      const id = readBuildId(pkgDir);
      expect(id).toMatch(/^[0-9a-f]{12}$/);
      const manifest = readManifest(pkgDir);
      expect(manifest.buildId).toBe(id);
      expect(manifest.corpusHash).toMatch(/^[0-9a-f]{16}$/);
      // Корпус браузера — без документации самого MCP.
      expect(manifest.packages).not.toContain('@reformer/mcp');
    });
  }
);

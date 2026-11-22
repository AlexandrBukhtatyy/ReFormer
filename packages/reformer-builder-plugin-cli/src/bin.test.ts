/**
 * Точка входа `reformer-plugin` — закоммиченный файл, а не `dist`.
 *
 * npm связывает бинарники при установке и пропускает те, чьего файла ещё нет. В монорепо `dist`
 * собирается после `npm ci`, и `bin`, указывающий в `dist`, оставлял CI и свежий клон без
 * `reformer-plugin` (`plugin:build` кита HexaUI падал с «not found»). Храповик держит `bin` вне
 * `dist` и проверяет, что точка входа действительно запускает CLI.
 *
 * Второй тест исполняет собранный `dist/cli.js`: в CI сборка CLI стоит раньше его тестов.
 *
 * @module @reformer/builder-plugin-cli/bin.test
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  version: string;
  bin: Record<string, string>;
  files: string[];
};
const entry = (pkg.bin['reformer-plugin'] ?? '').replace(/^\.\//, '');

describe('точка входа reformer-plugin', () => {
  it('bin — закоммиченный файл вне dist, и он едет в опубликованный пакет', () => {
    expect(entry).not.toBe('');
    expect(entry.startsWith('dist/')).toBe(false);
    expect(existsSync(join(root, entry))).toBe(true);
    expect(pkg.files).toContain(entry.split('/')[0]);
  });

  it('запускает CLI: --version печатает версию пакета', () => {
    const out = execFileSync(process.execPath, [join(root, entry), '--version'], {
      encoding: 'utf8',
    });

    expect(out.trim()).toBe(pkg.version);
  });
});

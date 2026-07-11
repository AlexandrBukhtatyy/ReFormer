import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Packaging integrity: every subpath declared in package.json `exports`
 * must point at a file the build actually produces. Vite emits one output
 * per `build.lib.entry` key (entryFileNames '[name].js' + a matching
 * '[name].d.ts' from vite-plugin-dts), so an export target `./dist/<K>.js`
 * is only resolvable when `<K>` is a declared (non-commented) entry key.
 *
 * Regression guard for `./form-field`, which used to map to
 * `./dist/form-field.{js,d.ts}` while the build only ever emits
 * `dist/ui/form-field.*` (entry key `ui/form-field`).
 */

const pkgDir = resolve(__dirname, '..');

function viteEntryKeys(): Set<string> {
  const src = readFileSync(resolve(pkgDir, 'vite.config.ts'), 'utf8');
  const keys = new Set<string>();
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('//')) continue; // commented-out entry
    const m = line.match(/^(?:'([^']+)'|"([^"]+)"|([\w$/-]+))\s*:\s*resolve\(/);
    if (m) keys.add(m[1] ?? m[2] ?? m[3]);
  }
  return keys;
}

type ExportCond = { import?: string; types?: string };

describe('@reformer/ui-kit package.json exports resolve to build outputs', () => {
  const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8')) as {
    exports: Record<string, ExportCond>;
  };
  const entryKeys = viteEntryKeys();
  const cases = Object.entries(pkg.exports);

  it.each(cases)('subpath "%s" maps to a real build entry', (subpath, cond) => {
    for (const field of ['import', 'types'] as const) {
      const target = cond[field];
      if (!target) continue;
      const key = target.replace(/^\.\/dist\//, '').replace(/\.(js|d\.ts)$/, '');
      expect(
        entryKeys.has(key),
        `exports["${subpath}"].${field} = "${target}" resolves to build key "${key}", ` +
          `which is not a vite entry. Built keys: ${[...entryKeys].join(', ')}`
      ).toBe(true);
    }
  });
});

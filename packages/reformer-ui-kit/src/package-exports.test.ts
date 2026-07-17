import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Страж генерации (generate-exports.mjs): package.json#exports ↔ src/components в ОБЕ стороны.
 * Ловит dir-без-export (забыт прогон генератора) и export-без-dir (удалён каталог, exports не пере-сгенерирован).
 */
const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const componentsDir = join(pkgRoot, 'src', 'components');
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};

const FIXED = new Set(['.', './meta', './styles']);

function componentDirs(): string[] {
  if (!existsSync(componentsDir)) return [];
  return readdirSync(componentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(componentsDir, d.name, 'index.ts')))
    .map((d) => d.name)
    .sort();
}

describe('package.json#exports ↔ src/components', () => {
  const components = componentDirs();
  const exportKeys = Object.keys(pkg.exports);
  const componentExportNames = exportKeys
    .filter((k) => k.startsWith('./') && !FIXED.has(k))
    .map((k) => k.slice(2));

  it('фиксированные точки присутствуют: ., ./meta, ./styles', () => {
    expect(pkg.exports['.']).toBeTruthy();
    expect(pkg.exports['./meta']).toBeTruthy();
    expect(pkg.exports['./styles']).toBe('./src/styles/theme.css');
  });

  it('dir → export: каждый компонент с index.ts имеет subpath', () => {
    for (const c of components) {
      expect(exportKeys, `нет "./${c}" в exports — прогони generate-exports.mjs`).toContain(
        `./${c}`
      );
    }
  });

  it('export → dir: каждый компонент-subpath имеет каталог', () => {
    for (const name of componentExportNames) {
      expect(components, `export "./${name}" без каталога src/components/${name}/`).toContain(name);
    }
  });

  it('subpath указывает на dist/<name>.{js,d.ts}', () => {
    for (const c of components) {
      const e = pkg.exports[`./${c}`] as { import: string; types: string };
      expect(e.import).toBe(`./dist/${c}.js`);
      expect(e.types).toBe(`./dist/${c}.d.ts`);
    }
  });
});

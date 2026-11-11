/**
 * Поиск пакетов `@reformer/*` на диске в обход `exports` (аудит 2026-11, C1).
 *
 * У библиотечных пакетов в `exports` нет `./package.json`, а главный вход объявлен только условием
 * `import`. Прежний поиск резолвил `<pkg>/package.json` и падал с `ERR_PACKAGE_PATH_NOT_EXPORTED`
 * у всех шести: вне монорепо справка была пуста. Фикстуры здесь повторяют именно такие пакеты.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { locatePackage, locatePackages } from '../src/platform/cli/package-locator';
import { createCliIndexSource } from '../src/platform/cli/index-source';
import { clearKnowledgeProblems, knowledgeProblems } from '../src/platform/cli/problems';

const temporary: string[] = [];

function scratch(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'locator-')));
  temporary.push(root);
  return root;
}

/** Пакет как у библиотек ReFormer: exports только `import`, без `./package.json`. */
function libraryPackage(dir: string, name: string, version = '1.0.0'): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name,
      version,
      type: 'module',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    })
  );
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist', 'index.js'), 'export {};\n');
  return dir;
}

beforeEach(() => clearKnowledgeProblems());

afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('locatePackage', () => {
  it('находит пакет в node_modules проекта, хотя exports не отдают package.json', () => {
    const project = scratch();
    libraryPackage(join(project, 'node_modules', '@reformer', 'core'), '@reformer/core', '9.1.0');
    const nested = join(project, 'src', 'forms', 'credit');
    mkdirSync(nested, { recursive: true });

    const found = locatePackage('@reformer/core', [nested]);
    expect(found).toMatchObject({
      name: '@reformer/core',
      root: join(project, 'node_modules', '@reformer', 'core'),
      version: '9.1.0',
      via: 'node_modules',
    });
  });

  it('каталог с тем же именем, но чужим package.json, не считается пакетом', () => {
    const project = scratch();
    libraryPackage(join(project, 'node_modules', '@reformer', 'core'), 'not-reformer');
    expect(locatePackage('@reformer/core', [project])?.root ?? null).not.toBe(
      join(project, 'node_modules', '@reformer', 'core')
    );
  });

  it('участник workspaces находится без ссылок в node_modules', () => {
    const repo = scratch();
    writeFileSync(
      join(repo, 'package.json'),
      JSON.stringify({ name: 'mono', private: true, workspaces: ['packages/*'] })
    );
    libraryPackage(join(repo, 'packages', 'reformer-cdk'), '@reformer/cdk', '2.0.0');
    const app = join(repo, 'apps', 'web');
    mkdirSync(app, { recursive: true });

    expect(locatePackage('@reformer/cdk', [app])).toMatchObject({
      root: join(repo, 'packages', 'reformer-cdk'),
      via: 'workspace',
    });
  });

  it('сам пакет — база внутри него', () => {
    const repo = scratch();
    const pkg = libraryPackage(join(repo, 'reformer-ui-kit'), '@reformer/ui-kit');
    expect(locatePackage('@reformer/ui-kit', [join(pkg, 'dist')])).toMatchObject({
      root: pkg,
      via: 'self',
    });
  });

  it('несколько мест — по порядку баз, одна установка по ссылке считается одной', () => {
    const first = scratch();
    const second = scratch();
    const real = libraryPackage(join(first, 'node_modules', '@reformer', 'core'), '@reformer/core');
    libraryPackage(join(second, 'node_modules', '@reformer', 'core'), '@reformer/core', '2.0.0');
    // Третья база ссылается на установку первой (pnpm/npm workspaces).
    const third = scratch();
    mkdirSync(join(third, 'node_modules', '@reformer'), { recursive: true });
    symlinkSync(real, join(third, 'node_modules', '@reformer', 'core'), 'dir');

    const roots = locatePackages('@reformer/core', [first, second, third]).map((l) => l.root);
    expect(roots.slice(0, 2)).toEqual([real, join(second, 'node_modules', '@reformer', 'core')]);
    expect(roots.filter((root) => root === real)).toHaveLength(1);
  });
});

describe('индекс пакета', () => {
  it('битый llms-index.json первой установки не прячет исправный у следующей и попадает в статус', () => {
    const first = scratch();
    const second = scratch();
    const broken = libraryPackage(
      join(first, 'node_modules', '@reformer', 'core'),
      '@reformer/core'
    );
    writeFileSync(join(broken, 'llms-index.json'), '{ not json');
    const good = libraryPackage(
      join(second, 'node_modules', '@reformer', 'core'),
      '@reformer/core'
    );
    writeFileSync(join(good, 'llms-index.json'), JSON.stringify({ marker: 'good' }));

    const index = createCliIndexSource([first, second]).read('@reformer/core');
    expect(index).toEqual({ marker: 'good' });
    expect(knowledgeProblems()).toEqual([
      expect.objectContaining({ source: 'index:@reformer/core' }),
    ]);
  });
});

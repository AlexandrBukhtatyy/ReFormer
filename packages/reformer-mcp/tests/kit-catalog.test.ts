/**
 * Кит приложения — зависимость со входом `./catalog`. Генератор знает кит только по его каталогу,
 * поэтому клиент находит каталог среди зависимостей приложения, а не по зашитому имени пакета.
 * Нескольких китов — берётся кит фреймворка приложения, из них `@reformer/ui-kit`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  kitCatalogPaths,
  kitCatalogSummary,
  loadKitCatalog,
  projectKit,
  projectKits,
} from '../src/local/kit-catalog';
import { knowledgeProblems } from '../src/local/problems';

const temporary: string[] = [];

interface KitSpec {
  name: string;
  framework?: 'react' | 'vue' | 'angular';
  /** Без входа `./catalog` пакет — не кит. */
  catalog?: boolean;
}

function project(dependencies: string[], kits: KitSpec[]): string {
  const root = mkdtempSync(join(tmpdir(), 'kit-catalog-'));
  temporary.push(root);
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'app',
      dependencies: Object.fromEntries(dependencies.map((name) => [name, '*'])),
    })
  );
  for (const kit of kits) {
    const dir = join(root, 'node_modules', ...kit.name.split('/'));
    mkdirSync(dir, { recursive: true });
    const withCatalog = kit.catalog !== false;
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: kit.name,
        exports: withCatalog ? { './catalog': './component-catalog.json' } : { '.': './index.js' },
      })
    );
    if (withCatalog) {
      writeFileSync(
        join(dir, 'component-catalog.json'),
        JSON.stringify({
          version: '3.1',
          kit: {
            id: kit.name,
            package: kit.name,
            ...(kit.framework ? { framework: kit.framework } : {}),
          },
          components: [{ name: 'Input', role: 'field', propsSchema: {} }],
        })
      );
    }
  }
  return root;
}

afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('кит приложения', () => {
  it('React-приложение с ui-kit: его каталог, фреймворк react', () => {
    const root = project(['react', '@reformer/ui-kit'], [{ name: '@reformer/ui-kit' }]);
    expect(projectKit(root)).toMatchObject({ package: '@reformer/ui-kit', framework: 'react' });
  });

  it('Vue-приложение: кит Vue, а не ui-kit, даже если тот тоже в зависимостях', () => {
    const root = project(
      ['vue', '@reformer/ui-kit', '@reformer/kit-vuetify'],
      [{ name: '@reformer/ui-kit' }, { name: '@reformer/kit-vuetify', framework: 'vue' }]
    );
    expect(projectKit(root)?.package).toBe('@reformer/kit-vuetify');
    const catalog = loadKitCatalog(kitCatalogPaths(root, [root])) as { kit: { package: string } };
    expect(catalog.kit.package).toBe('@reformer/kit-vuetify');
  });

  it('Angular-приложение: кит Angular', () => {
    const root = project(
      ['@angular/core', '@reformer/kit-taiga'],
      [{ name: '@reformer/kit-taiga', framework: 'angular' }]
    );
    expect(kitCatalogSummary(kitCatalogPaths(root, [root]))).toMatchObject({
      package: '@reformer/kit-taiga',
      framework: 'angular',
      components: 1,
    });
  });

  it('сторонний кит со своим каталогом — тоже кит', () => {
    const root = project(['react', '@acme/ds'], [{ name: '@acme/ds' }]);
    expect(projectKit(root)?.package).toBe('@acme/ds');
  });

  it('пакет без входа ./catalog китом не считается', () => {
    const root = project(['react', 'left-pad'], [{ name: 'left-pad', catalog: false }]);
    expect(projectKits(root)).toEqual([]);
  });

  it('нескольких китов фреймворка — ui-kit, иначе первый по имени, и выбор виден в статусе', () => {
    const root = project(
      ['vue', '@b/kit', '@a/kit'],
      [
        { name: '@b/kit', framework: 'vue' },
        { name: '@a/kit', framework: 'vue' },
      ]
    );
    expect(projectKit(root)?.package).toBe('@a/kit');
    expect(knowledgeProblems().some((problem) => problem.detail.includes('взят @a/kit'))).toBe(
      true
    );
  });

  it('кит другого фреймворка не берётся: Vue-приложению — не React-кит', () => {
    const root = project(['vue', '@reformer/ui-kit'], [{ name: '@reformer/ui-kit' }]);
    expect(projectKit(root)).toBeNull();
  });

  it('кита у приложения нет — только запасной ui-kit, в самом проекте каталога нет', () => {
    const root = project(['react'], []);
    expect(projectKit(root)).toBeNull();
    // Запасной `@reformer/ui-kit` находится и рядом с клиентом (монорепо) — в проекте его нет.
    const own = kitCatalogPaths(root, [root]).filter((path) => path.startsWith(root));
    expect(loadKitCatalog(own)).toBeUndefined();
  });
});

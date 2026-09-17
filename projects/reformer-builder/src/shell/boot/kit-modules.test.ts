/**
 * Подпути кита: полнота списка и правомерность алиасов — на настоящем ките, а не на списке.
 *
 * Оба утверждения `kit-modules` проверяются здесь, потому что ни одно из них не держится само:
 * список подпутей стареет с выходом кита, а «все экспорты подпути есть в бочке» перестаёт быть
 * правдой ровно тогда, когда символ из бочки уезжает. Второе особенно коварно: алиас продолжит
 * резолвиться, но вернёт объект БЕЗ нужного имени — `undefined` вместо компонента и пустота
 * вместо отказа.
 *
 * @module shell/boot/kit-modules.test
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { KIT_BARREL_SUBPATHS, KIT_SUBPATH_MODULES } from './kit-modules';

/**
 * Подпути кита, за которыми лежит JS: `./styles` — CSS, `./catalog` — JSON.
 *
 * Манифест кита читается ФАЙЛОМ, а не импортом: `"./package.json"` кит в `exports` не объявляет,
 * и `import '@reformer/ui-kit/package.json'` у потребителя не резолвится вовсе.
 */
function declaredSubpaths(): string[] {
  const manifest = new URL('../../../../../packages/reformer-ui-kit/package.json', import.meta.url);
  const kitPackage = JSON.parse(readFileSync(manifest, 'utf8')) as {
    exports: Record<string, unknown>;
  };
  const exports = kitPackage.exports;
  return Object.entries(exports)
    .filter(([key]) => key.startsWith('./') && key !== './package.json')
    .filter(([, value]) => {
      const target =
        typeof value === 'string'
          ? value
          : ((value as { import?: string; default?: string }).import ??
            (value as { default?: string }).default ??
            '');
      return target.endsWith('.js');
    })
    .map(([key]) => `@reformer/ui-kit/${key.slice(2)}`)
    .sort();
}

describe('подпути кита в реестре модулей', () => {
  it('перечислены все, которые кит объявляет', () => {
    // Подпуть, появившийся в ките и забытый здесь, — форма, которая у пользователя собралась,
    // а в билдере не поднялась. Обратное (лишний спецификатор) — отказ на первой же загрузке.
    expect(KIT_SUBPATH_MODULES.map(([specifier]) => specifier).sort()).toEqual(declaredSubpaths());
  });

  it('алиас на бочку правомерен: её экспорты покрывают экспорты подпути', async () => {
    const barrel = await import('@reformer/ui-kit');
    const names = new Set(Object.keys(barrel));

    const missing: string[] = [];
    for (const specifier of KIT_BARREL_SUBPATHS) {
      const subpath = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
      const absent = Object.keys(subpath).filter((name) => !names.has(name));
      if (absent.length > 0) missing.push(`${specifier}: ${absent.join(', ')}`);
    }

    // Пусто — иначе символ уехал из бочки, и подпуть надо переводить в свой чанк
    // (`KIT_OWN_MODULES`), а не оставлять алиасом.
    expect(missing).toEqual([]);
  }, 60_000);
});

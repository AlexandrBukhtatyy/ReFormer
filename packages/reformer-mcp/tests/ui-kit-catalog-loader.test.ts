/**
 * CLI ищет каталог кита там, откуда форма будет импортировать кит: от проекта, затем рядом с
 * сервером. Нашёлся у проекта — генератор называет компоненты той версии кита, что у потребителя.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uiKitFromCatalog } from '../src/core/generate/ui-kit-components';
import { loadUiKitCatalog } from '../src/platform/cli/ui-kit-catalog';

const temporary: string[] = [];

function project(withKit: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'ui-kit-catalog-'));
  temporary.push(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'consumer' }));
  if (withKit) {
    const kit = join(root, 'node_modules', '@reformer', 'ui-kit');
    mkdirSync(kit, { recursive: true });
    writeFileSync(
      join(kit, 'package.json'),
      JSON.stringify({
        name: '@reformer/ui-kit',
        exports: { './catalog': './component-catalog.json' },
      })
    );
    writeFileSync(
      join(kit, 'component-catalog.json'),
      JSON.stringify({ components: [{ name: 'Rating', role: 'field', exportName: 'RatingStars' }] })
    );
  }
  return root;
}

afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('loadUiKitCatalog', () => {
  it('каталог проекта побеждает: первая база, где он резолвится', () => {
    const root = project(true);
    const kit = uiKitFromCatalog(loadUiKitCatalog([join(root, 'package.json')]));
    expect(kit.fields).toEqual({ Rating: 'RatingStars' });
  });

  it('нет кита ни в одной базе — undefined', () => {
    const root = project(false);
    expect(loadUiKitCatalog([join(root, 'package.json')])).toBeUndefined();
  });
});

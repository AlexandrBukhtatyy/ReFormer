/**
 * Образец формы ReFormer в проекте-образце (`forms/contact/form.schema.json`).
 *
 * Смысл образца — одна форма, которую рисуют оба кита: встроенный и HexaUI. Компонент,
 * которого нет в одном из каталогов, этот смысл отменяет — и видно это только глазами,
 * в превью. Здесь то же сверяется по каталогам китов.
 *
 * @module plugins/reformer/integration/playground-forms.test
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isFormSchema } from '../core/form-model';

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/** Образец формы — в корне проекта-образца. */
const FORM = fromHere('../../../../forms/contact/form.schema.json');

/** Каталоги китов — источник истины для состава их компонентов. */
const KIT_CATALOGS = [
  fromHere('../../../../../../packages/reformer-ui-kit/component-catalog.json'),
  fromHere('../../kit-hexa-ui/catalog.json'),
];

interface KitCatalog {
  readonly components: readonly { readonly name: string }[];
}

describe('образец формы ReFormer', () => {
  it('схема формы из компонентов, общих для обоих китов', () => {
    const text = readFileSync(FORM, 'utf8');
    const used = [...text.matchAll(/\$component\(([^)]+)\)/g)].map((match) => match[1]);

    expect(isFormSchema(JSON.parse(text))).toBe(true);
    expect(used.length).toBeGreaterThan(0);
    for (const file of KIT_CATALOGS) {
      const catalog = JSON.parse(readFileSync(file, 'utf8')) as KitCatalog;
      const names = new Set(catalog.components.map((component) => component.name));
      expect(used.filter((name) => !names.has(name ?? ''))).toEqual([]);
    }
  });
});

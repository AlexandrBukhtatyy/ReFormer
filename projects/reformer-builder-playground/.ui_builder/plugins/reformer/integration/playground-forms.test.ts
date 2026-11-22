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

  it('у каждого поля свой путь в модели', () => {
    // Поле из палитры привязывается к `newField`. Брошенные так три поля разных видов делили
    // одно значение: флажок писал в него `true`, список — строку, число — число, и образец
    // показывал форму, которую никто не пишет нарочно.
    const paths: string[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node !== 'object' || node === null) return;
      const { model } = node as { model?: unknown };
      if (typeof model === 'string') paths.push(model);
      Object.values(node).forEach(visit);
    };
    visit(JSON.parse(readFileSync(FORM, 'utf8')));

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });
});

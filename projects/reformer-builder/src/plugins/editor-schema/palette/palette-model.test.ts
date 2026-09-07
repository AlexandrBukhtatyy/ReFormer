/**
 * Тесты модели палитры: порядок разделов, подписи и поиск.
 *
 * Часть проверок идёт по НАСТОЯЩЕМУ каталогу встроенного кита: группировка на выдуманных
 * трёх записях доказывала бы только то, что выдумка сгруппирована.
 *
 * @module plugins/editor-schema/palette/palette-model.test
 */

import { describe, expect, it } from 'vitest';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import type { CatalogEntry } from '@/lib/catalog/types';
import { DEFAULT_COLLAPSED_CATEGORIES, paletteNode, paletteSections } from './palette-model';

function entry(name: string, category: string, extra: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    name,
    role: 'field',
    category,
    propsSchema: { type: 'object', properties: {} },
    makeNode: () => ({ value: '$model(x)', component: `$component(${name})` }),
    ...extra,
  };
}

const CATALOG: readonly CatalogEntry[] = [
  entry('Input', 'Поля ввода'),
  entry('$html(div)', 'HTML', { role: 'container' }),
  entry('Button', 'Действия'),
  entry('InputPassword', 'Поля ввода', { variantGroup: 'Input', variant: 'Пароль' }),
];

describe('paletteSections', () => {
  it('раскладывает записи по разделам в объявленном порядке', () => {
    const sections = paletteSections(CATALOG);
    expect(sections.map((s) => s.category)).toEqual(['HTML', 'Поля ввода', 'Действия']);
    expect(sections[1].items.map((i) => i.name)).toEqual(['Input', 'InputPassword']);
  });

  it('подписывает html-элемент тегом, а не оператором', () => {
    const html = paletteSections(CATALOG)[0].items[0];
    expect(html.name).toBe('$html(div)');
    expect(html.label).toBe('div');
  });

  it('везёт метку варианта, чтобы члены группы различались на вид', () => {
    const items = paletteSections(CATALOG)[1].items;
    expect(items.find((i) => i.name === 'InputPassword')?.variant).toBe('Пароль');
  });

  it('поиск не различает регистр и ищет по имени, подписи и тегу', () => {
    expect(
      paletteSections(CATALOG, { query: 'inp' }).flatMap((s) => s.items.map((i) => i.name))
    ).toEqual(['Input', 'InputPassword']);
    expect(
      paletteSections(CATALOG, { query: 'DIV' }).flatMap((s) => s.items.map((i) => i.name))
    ).toEqual(['$html(div)']);
    expect(
      paletteSections(CATALOG, { query: 'пароль' }).flatMap((s) => s.items.map((i) => i.name))
    ).toEqual(['InputPassword']);
  });

  it('раздел без найденного не показывается вовсе', () => {
    expect(paletteSections(CATALOG, { query: 'zzz' })).toEqual([]);
  });

  it('порядок разделов берётся из конфига клиента, если он задан', () => {
    const sections = paletteSections(CATALOG, { order: ['Действия', 'HTML'] });
    // Незнакомые конфигу разделы уезжают в хвост, сохраняя порядок первого появления.
    expect(sections.map((s) => s.category)).toEqual(['Действия', 'HTML', 'Поля ввода']);
  });

  it('на настоящем каталоге кита начинается с HTML и не теряет записей', () => {
    const entries = builtinEntries();
    const sections = paletteSections(entries);
    expect(sections[0].category).toBe('HTML');
    expect(sections.reduce((sum, s) => sum + s.items.length, 0)).toBe(entries.length);
  });

  it('свёрнутыми по умолчанию объявлены самые длинные и самые редкие разделы', () => {
    const sizes = new Map(
      paletteSections(builtinEntries()).map((s) => [s.category, s.items.length])
    );
    for (const category of DEFAULT_COLLAPSED_CATEGORIES) {
      expect(sizes.get(category)).toBeGreaterThan(10);
    }
  });
});

describe('paletteNode', () => {
  it('берёт узел у записи каталога, а не строит свой', () => {
    const item = paletteSections(CATALOG)[1].items[0];
    expect(paletteNode(item)).toEqual({ value: '$model(x)', component: '$component(Input)' });
  });
});

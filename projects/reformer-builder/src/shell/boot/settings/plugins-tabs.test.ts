/**
 * Правила вкладок раздела «Плагины» — без React и без браузера.
 *
 * Проверяется то, что разъедется первым: какая запись на какой вкладке и когда предлагать
 * действие. Как это нарисовано, проверяет браузерный тест раздела.
 *
 * @module shell/boot/settings/plugins-tabs.test
 */

import { describe, expect, it } from 'vitest';

import type { PluginRow } from './plugins-list';
import {
  canRollback,
  developmentRows,
  marketplaceRows,
  tabCount,
  updateRows,
  visibleTabs,
  type InstalledInfo,
  type PluginTabsInput,
} from './plugins-tabs';

const row = (id: string, dev = false): PluginRow => ({
  id,
  name: id,
  version: null,
  state: 'disabled',
  dev,
  on: false,
  toggle: 'enable',
  canReload: false,
  problem: null,
  apiVersion: null,
  layer: null,
  shadowed: null,
});

const installed = (id: string, version: string, versions = [version]): InstalledInfo => ({
  id,
  package: `@acme/${id}`,
  version,
  versions,
});

const input = (over: Partial<PluginTabsInput> = {}): PluginTabsInput => ({
  rows: [],
  installed: [],
  marketplace: [],
  updates: [],
  ...over,
});

describe('состав вкладок', () => {
  it('без установки из npm остаются две: «что стоит» и «над чем работаю»', () => {
    // Вкладка, которая ничего не может, хуже отсутствующей: спросить каталог не у кого.
    expect(visibleTabs(false)).toEqual(['installed', 'development']);
    expect(visibleTabs(true)).toEqual(['installed', 'marketplace', 'updates', 'development']);
  });

  it('счётчики считают то, что на вкладке и окажется', () => {
    const data = input({
      rows: [row('a'), row('b', true)],
      installed: [installed('m', '1.0.0')],
      marketplace: [{ id: 'm', package: '@acme/m', name: 'M' }],
      updates: [{ id: 'm', package: '@acme/m', name: 'M', current: '1.0.0', available: '1.1.0' }],
    });

    expect(tabCount('installed', data)).toBe(2);
    expect(tabCount('marketplace', data)).toBe(1);
    expect(tabCount('updates', data)).toBe(1);
    expect(tabCount('development', data)).toBe(1);
  });
});

describe('каталог', () => {
  it('установленное помечается, а не выбрасывается', () => {
    // Человек ищет плагин по имени и должен найти его там, где искал: «в каталоге его нет»
    // прочиталось бы как «его не существует».
    const rows = marketplaceRows(
      input({
        installed: [installed('acme', '1.0.0')],
        marketplace: [
          { id: 'acme', package: '@acme/acme', name: 'Acme' },
          { id: 'other', package: '@acme/other', name: 'Other' },
        ],
      })
    );

    expect(rows.map((item) => [item.id, item.installed])).toEqual([
      ['acme', true],
      ['other', false],
    ]);
  });
});

describe('в разработке', () => {
  it('только помеченные человеком', () => {
    const rows = developmentRows(input({ rows: [row('a'), row('b', true)] }));

    expect(rows.map((item) => item.id)).toEqual(['b']);
  });
});

describe('откат', () => {
  it('предлагается, только если на диске есть вторая версия', () => {
    const records = [installed('one', '1.0.0'), installed('two', '2.0.0', ['1.0.0', '2.0.0'])];

    expect(canRollback('one', records)).toBe(false);
    expect(canRollback('two', records)).toBe(true);
    expect(canRollback('нет такого', records)).toBe(false);
  });
});

describe('обновления', () => {
  it('в список попадает только расхождение версий', () => {
    const rows = updateRows(
      [installed('same', '1.0.0'), installed('newer', '1.0.0'), installed('unknown', '1.0.0')],
      new Map([
        ['same', '1.0.0'],
        ['newer', '1.2.0'],
      ]),
      new Map([['newer', 'Новее']])
    );

    // `unknown` не попал: реестр про него не ответил, и предлагать обновление вслепую нечем.
    expect(rows).toEqual([
      { id: 'newer', package: '@acme/newer', name: 'Новее', current: '1.0.0', available: '1.2.0' },
    ]);
  });
});

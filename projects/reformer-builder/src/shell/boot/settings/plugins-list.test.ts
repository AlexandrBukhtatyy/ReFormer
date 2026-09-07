/**
 * Правила строки раздела «Плагины».
 *
 * Проверяется здесь то, что раздел РЕШАЕТ, а не то, как он выглядит: какое действие у
 * переключателя, где кнопка перезагрузки бессмысленна, и что показывать вместо списка.
 * Эти же вопросы решает палитра плагинов — и расходится с разделом она именно здесь.
 *
 * @module shell/boot/settings/plugins-list.test
 */

import { describe, expect, it } from 'vitest';
import { toDisposable } from '@/shell/platform/primitives/disposable';
import {
  emptyStateOf,
  settingsCardStateOf,
  toRows,
  type PluginCatalogEntry,
  type PluginsSettingsPort,
} from './plugins-list';

const entry = (patch: Partial<PluginCatalogEntry> & { id: string }): PluginCatalogEntry => ({
  name: patch.id,
  state: 'disabled',
  dev: false,
  ...patch,
});

/** Двойник порта: список задаётся, остальное не зовётся в этих проверках. */
const port = (
  entries: readonly PluginCatalogEntry[],
  state: { synced?: boolean; hasProject?: boolean } = {}
): PluginsSettingsPort => ({
  list: () => entries,
  subscribe: () => toDisposable(() => {}),
  enable: () => Promise.resolve(true),
  disable: () => {},
  setDev: () => {},
  reload: () => Promise.resolve(true),
  synced: () => state.synced ?? true,
  hasProject: () => state.hasProject ?? true,
});

describe('строки раздела «Плагины»', () => {
  it('переключатель включённого выключает, выключенного — включает', () => {
    // Порядок результата — по имени, поэтому включённый «a» идёт первым.
    const [on, off] = toRows([
      entry({ id: 'b', state: 'disabled' }),
      entry({ id: 'a', state: 'enabled' }),
    ]);

    expect(on?.toggle).toBe('disable');
    expect(on?.on).toBe(true);
    expect(off?.toggle).toBe('enable');
    expect(off?.on).toBe(false);
  });

  it('у упавшего переключатель ВЫКЛЮЧЕН, а нажатие — «попробовать снова»', () => {
    // Вклады упавшего сняты, и показать его включённым значило бы соврать про состояние.
    // Но включение для него — не «включить впервые», а повтор того же жеста, которым
    // человек уже просил его поднять.
    const [row] = toRows([entry({ id: 'x', state: 'failed' })]);

    expect(row?.on).toBe(false);
    expect(row?.toggle).toBe('retry');
  });

  it('перезагрузка предлагается только работающему', () => {
    // У выключенного `reload` возвращает успех, ничего не включив, — кнопка обещала бы
    // не то, что делает.
    const rows = toRows([
      entry({ id: 'a', state: 'enabled' }),
      entry({ id: 'b', state: 'disabled' }),
      entry({ id: 'c', state: 'failed' }),
    ]);

    expect(rows.map((row) => row.canReload)).toEqual([true, false, false]);
  });

  it('пометка «в разработке» не зависит от состояния', () => {
    const rows = toRows([
      entry({ id: 'a', state: 'failed', dev: true }),
      entry({ id: 'b', state: 'disabled', dev: true }),
    ]);

    expect(rows.every((row) => row.dev)).toBe(true);
  });

  it('порядок — по имени, а не по обходу файловой системы', () => {
    // Иначе строка прыгает под курсором каждый раз, когда каталог перечитан.
    const rows = toRows([
      entry({ id: 'z', name: 'Яблоко' }),
      entry({ id: 'a', name: 'Арбуз' }),
      entry({ id: 'm', name: 'Морковь' }),
    ]);

    expect(rows.map((row) => row.name)).toEqual(['Арбуз', 'Морковь', 'Яблоко']);
  });

  it('версии нет — место под неё не занимаем', () => {
    const [none, some] = toRows([
      entry({ id: 'a', name: 'A' }),
      entry({ id: 'b', name: 'B', version: '1.2.0' }),
    ]);

    expect(none?.version).toBeNull();
    expect(some?.version).toBe('1.2.0');
  });
});

describe('чем раздел заменяет список', () => {
  it('проекта нет — говорим про проект, а не «плагинов нет»', () => {
    expect(emptyStateOf(port([], { hasProject: false }))).toBe('no-project');
  });

  it('проект есть, каталог ещё не перечитан — «читаю», а не пустота', () => {
    // Между сменой проекта и обходом список содержит плагины ПРЕЖНЕГО проекта.
    expect(emptyStateOf(port([entry({ id: 'старый' })], { synced: false }))).toBe('loading');
  });

  it('перечитан и пуст — «плагинов нет»', () => {
    expect(emptyStateOf(port([]))).toBe('no-plugins');
  });

  it('есть что показать — заменять нечем', () => {
    expect(emptyStateOf(port([entry({ id: 'a' })]))).toBeNull();
  });
});

describe('форма настроек в карточке', () => {
  const rowOf = (state: 'enabled' | 'disabled' | 'failed') =>
    toRows([entry({ id: 'a', name: 'A', state })])[0]!;

  it('работает и объявил схему — рисуем форму', () => {
    expect(settingsCardStateOf(rowOf('enabled'), true)).toBe('form');
  });

  it('работает и схемы не объявлял — не обещаем настроек вовсе', () => {
    expect(settingsCardStateOf(rowOf('enabled'), false)).toBe('none');
  });

  it.each([['disabled'] as const, ['failed'] as const])(
    'не работает (%s) — объясняем, а не показываем пустую форму',
    (state) => {
      // Вклад снимается вместе с плагином, поэтому «выключен» и «настроек нет» — разные
      // ответы: в первом случае человеку надо включить плагин, во втором делать нечего.
      expect(settingsCardStateOf(rowOf(state), false)).toBe('plugin-off');
    }
  );
});

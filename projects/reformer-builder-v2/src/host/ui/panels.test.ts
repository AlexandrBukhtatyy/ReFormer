import { describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry } from '../primitives/extension-point';
import { whenContext } from '../primitives/when-context';
import { createI18nService } from '../services/i18n/i18n';
import {
  findPanel,
  panelInitial,
  panelOrder,
  panelTitle,
  resolveActivePanelId,
  selectPanels,
  type PanelEntry,
} from './panels';
import { PanelPoint, type PanelContribution } from './slots';

/**
 * Панели теста — фиктивные и намеренно бессодержательные.
 *
 * Предметных панелей («палитра», «инспектор») здесь быть не может: оболочка о них не знает,
 * и тест, который их заводит, проверял бы не оболочку, а собственную выдумку.
 */
const NOOP_BODY: PanelContribution['Body'] = () => null;

function panel(patch: Partial<PanelContribution> & { id: string }): PanelContribution {
  return {
    slot: 'panel.left',
    titleKey: `${patch.id}.title`,
    Body: NOOP_BODY,
    ...patch,
  };
}

/** Собирает реестр с набором панелей и отдаёт его вклады. */
function entriesOf(
  panels: readonly { plugin?: string; panel: PanelContribution; order?: number }[]
): readonly PanelEntry[] {
  const root = createExtensionRegistry();
  for (const item of panels) {
    root.forPlugin(item.plugin ?? 'test').contribute(PanelPoint, item.panel, { order: item.order });
  }
  return root.get(PanelPoint);
}

const NEUTRAL = whenContext();

describe('selectPanels', () => {
  it('берёт только панели своего слота', () => {
    const entries = entriesOf([
      { panel: panel({ id: 'left', slot: 'panel.left' }) },
      { panel: panel({ id: 'right', slot: 'panel.right' }) },
      { panel: panel({ id: 'status', slot: 'statusbar' }) },
    ]);

    expect(selectPanels(entries, 'panel.left', NEUTRAL).map((e) => e.value.id)).toEqual(['left']);
    expect(selectPanels(entries, 'panel.right', NEUTRAL).map((e) => e.value.id)).toEqual(['right']);
    expect(selectPanels(entries, 'toolbar', NEUTRAL)).toEqual([]);
  });

  it('панель без предиката видна всегда', () => {
    const entries = entriesOf([{ panel: panel({ id: 'always' }) }]);
    expect(selectPanels(entries, 'panel.left', NEUTRAL)).toHaveLength(1);
  });

  it('предикат управляет видимостью, но не составом реестра', () => {
    const entries = entriesOf([
      { panel: panel({ id: 'schema', when: (ctx) => ctx.activeResourceKind === 'form.schema' }) },
      { panel: panel({ id: 'always' }) },
    ]);

    const onSchema = whenContext({ activeResourceKind: 'form.schema' });
    const onMarkdown = whenContext({ activeResourceKind: 'markdown' });

    expect(selectPanels(entries, 'panel.left', onSchema).map((e) => e.value.id)).toEqual([
      'schema',
      'always',
    ]);
    expect(selectPanels(entries, 'panel.left', onMarkdown).map((e) => e.value.id)).toEqual([
      'always',
    ]);

    // Главное свойство: набор вкладов между этими двумя вызовами не менялся. Регистрация
    // глобальная — иначе рейл мигал бы при каждом переключении вкладки.
    expect(entries).toHaveLength(2);
  });

  it('не считает видимой панель, чей предикат вернул не «true»', () => {
    const entries = entriesOf([
      // Предикат из непроверенного кода вправе вернуть что угодно; «истинное значение»
      // и «истина» — разные вещи, и вторая здесь единственная приемлемая.
      { panel: panel({ id: 'sloppy', when: () => undefined as unknown as boolean }) },
    ]);
    expect(selectPanels(entries, 'panel.left', NEUTRAL)).toEqual([]);
  });

  it('упавший предикат прячет панель и сообщает об ошибке', () => {
    const boom = new Error('предикат сломан');
    const entries = entriesOf([
      {
        panel: panel({
          id: 'broken',
          when: () => {
            throw boom;
          },
        }),
      },
      { panel: panel({ id: 'fine' }) },
    ]);

    const onError = vi.fn();
    const visible = selectPanels(entries, 'panel.left', NEUTRAL, onError);

    expect(visible.map((e) => e.value.id)).toEqual(['fine']);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(boom);
  });

  it('сортирует по order панели', () => {
    const entries = entriesOf([
      { panel: panel({ id: 'third', order: 30 }) },
      { panel: panel({ id: 'first', order: 10 }) },
      { panel: panel({ id: 'second', order: 20 }) },
    ]);

    expect(selectPanels(entries, 'panel.left', NEUTRAL).map((e) => e.value.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('при равном порядке сохраняет порядок регистрации', () => {
    const entries = entriesOf([
      { panel: panel({ id: 'a' }) },
      { panel: panel({ id: 'b' }) },
      { panel: panel({ id: 'c' }) },
    ]);

    expect(selectPanels(entries, 'panel.left', NEUTRAL).map((e) => e.value.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('order панели перекрывает order вклада', () => {
    const entries = entriesOf([
      { panel: panel({ id: 'meta-first' }), order: 1 },
      { panel: panel({ id: 'panel-first', order: -100 }), order: 99 },
    ]);

    expect(selectPanels(entries, 'panel.left', NEUTRAL).map((e) => e.value.id)).toEqual([
      'panel-first',
      'meta-first',
    ]);
  });

  it('не трогает исходный массив вкладов', () => {
    const entries = entriesOf([
      { panel: panel({ id: 'late', order: 50 }) },
      { panel: panel({ id: 'early', order: 1 }) },
    ]);
    const before = entries.map((e) => e.value.id);

    selectPanels(entries, 'panel.left', NEUTRAL);

    expect(entries.map((e) => e.value.id)).toEqual(before);
  });
});

describe('panelOrder', () => {
  it('без собственного порядка берёт порядок вклада', () => {
    const [entry] = entriesOf([{ panel: panel({ id: 'a' }), order: 7 }]);
    expect(panelOrder(entry)).toBe(7);
  });

  it('нулевой порядок панели не подменяется порядком вклада', () => {
    const [entry] = entriesOf([{ panel: panel({ id: 'a', order: 0 }), order: 7 }]);
    expect(panelOrder(entry)).toBe(0);
  });
});

describe('resolveActivePanelId', () => {
  const entries = entriesOf([
    { panel: panel({ id: 'files' }) },
    { panel: panel({ id: 'search' }) },
  ]);

  it('сохраняет выбор, если такая панель ещё видна', () => {
    expect(resolveActivePanelId(entries, 'search')).toBe('search');
  });

  it('падает на первую, если выбранной панели больше нет', () => {
    expect(resolveActivePanelId(entries, 'gone')).toBe('files');
  });

  it('без выбора берёт первую', () => {
    expect(resolveActivePanelId(entries, null)).toBe('files');
  });

  it('без панелей активной нет', () => {
    expect(resolveActivePanelId([], 'files')).toBeNull();
  });
});

describe('findPanel', () => {
  const entries = entriesOf([{ panel: panel({ id: 'files' }) }]);

  it('находит панель по идентификатору', () => {
    expect(findPanel(entries, 'files')?.value.id).toBe('files');
  });

  it('неизвестный идентификатор и пустой выбор дают null', () => {
    expect(findPanel(entries, 'nope')).toBeNull();
    expect(findPanel(entries, null)).toBeNull();
  });
});

describe('panelTitle', () => {
  it('разрешает ключ в пространстве имён внёсшего плагина', () => {
    const i18n = createI18nService({ loadHostMessages: () => Promise.resolve({}), dev: false });
    i18n.forPlugin('alpha').contribute('en', { 'panel.title': 'Alpha' });
    i18n.forPlugin('beta').contribute('en', { 'panel.title': 'Beta' });

    const entries = entriesOf([
      { plugin: 'alpha', panel: panel({ id: 'a', titleKey: 'panel.title' }) },
      { plugin: 'beta', panel: panel({ id: 'b', titleKey: 'panel.title' }) },
    ]);

    // Один и тот же ключ у двух плагинов — два разных сообщения. Ради этого `pluginId`
    // и живёт на вкладе.
    expect(panelTitle(i18n, entries[0])).toBe('Alpha');
    expect(panelTitle(i18n, entries[1])).toBe('Beta');
  });

  it('промах остаётся видимым, а не подменяется словарём Host', () => {
    const i18n = createI18nService({ loadHostMessages: () => Promise.resolve({}), dev: false });
    const entries = entriesOf([{ plugin: 'alpha', panel: panel({ id: 'a', titleKey: 'gone' }) }]);

    expect(panelTitle(i18n, entries[0])).toBe('⟦alpha.gone⟧');
  });
});

describe('panelInitial', () => {
  it('берёт первую букву заголовка в верхнем регистре', () => {
    expect(panelInitial('Файлы')).toBe('Ф');
    expect(panelInitial('  search  ')).toBe('S');
  });

  it('переживает пустой заголовок', () => {
    expect(panelInitial('')).toBe('?');
    expect(panelInitial('   ')).toBe('?');
  });
});

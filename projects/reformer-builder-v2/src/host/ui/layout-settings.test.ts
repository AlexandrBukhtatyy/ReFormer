import { describe, expect, it } from 'vitest';

import {
  createInMemorySettingsBackend,
  createSettingsService,
  scopeForKey,
  type SettingsBackend,
} from '../services/settings';
import {
  DEFAULT_DOCK_STATE,
  dockSettingsKey,
  layoutSettingsKey,
  normalizeDockState,
  normalizeSizes,
  readDockState,
  readPanelSizes,
  toggleDock,
  writeDockState,
  writePanelSizes,
} from './layout-settings';

const MAIN_IDS = ['left', 'center', 'right'];

/** Служба поверх общего хранилища: «новая сессия» — это второй такой вызов на том же бэкенде. */
function session(backend: SettingsBackend) {
  return createSettingsService(backend);
}

describe('ключи раскладки', () => {
  it('уходят в пользовательскую область, а не в рабочую', () => {
    // Ширина сайдбара принадлежит человеку: открыть другой проект и обнаружить другую
    // ширину — это потеря настройки, а не настройка проекта.
    expect(scopeForKey(layoutSettingsKey('main'))).toBe('user');
    expect(scopeForKey(dockSettingsKey('panel.left', 'open'))).toBe('user');
  });

  it('различают группы и поля', () => {
    expect(layoutSettingsKey('main')).not.toBe(layoutSettingsKey('center'));
    expect(dockSettingsKey('panel.left', 'active')).not.toBe(dockSettingsKey('panel.left', 'open'));
    expect(dockSettingsKey('panel.left', 'open')).not.toBe(dockSettingsKey('panel.right', 'open'));
  });
});

describe('normalizeSizes', () => {
  it('оставляет размеры известных панелей', () => {
    expect(normalizeSizes({ left: 260, center: 900, right: 320 }, MAIN_IDS)).toEqual({
      left: 260,
      center: 900,
      right: 320,
    });
  });

  it('выбрасывает неизвестные панели', () => {
    expect(normalizeSizes({ left: 260, ghost: 100 }, MAIN_IDS)).toEqual({ left: 260 });
  });

  it('не требует полного набора: панель могла появиться позже', () => {
    expect(normalizeSizes({ left: 260 }, MAIN_IDS)).toEqual({ left: 260 });
  });

  it('отбрасывает размеры, которые не являются положительным числом', () => {
    expect(
      normalizeSizes(
        { left: Number.NaN, center: 0, right: -5, ghost: Number.POSITIVE_INFINITY },
        MAIN_IDS
      )
    ).toBeUndefined();
    expect(normalizeSizes({ left: '260', center: null, right: 320 }, MAIN_IDS)).toEqual({
      right: 320,
    });
  });

  it('не считает раскладкой то, что ею не является', () => {
    expect(normalizeSizes(undefined, MAIN_IDS)).toBeUndefined();
    expect(normalizeSizes(null, MAIN_IDS)).toBeUndefined();
    expect(normalizeSizes('left=260', MAIN_IDS)).toBeUndefined();
    expect(normalizeSizes([260, 900, 320], MAIN_IDS)).toBeUndefined();
    expect(normalizeSizes({}, MAIN_IDS)).toBeUndefined();
  });

  it('замораживает результат: раскладка уходит в чужую библиотеку', () => {
    const sizes = normalizeSizes({ left: 260 }, MAIN_IDS);
    expect(Object.isFrozen(sizes)).toBe(true);
  });
});

describe('normalizeDockState', () => {
  it('пустая настройка даёт раскрытый док без выбранной вкладки', () => {
    expect(normalizeDockState(undefined, undefined)).toEqual(DEFAULT_DOCK_STATE);
  });

  it('пустая строка — это «не выбрано», а не панель с пустым именем', () => {
    expect(normalizeDockState('', true).activeId).toBeNull();
  });

  it('непонятный режим разворачивает док', () => {
    // Ошибиться в сторону закрытого дока значит показать половину интерфейса и не дать
    // способа вернуть вторую.
    expect(normalizeDockState('files', 'yes').mode).toBe('full');
    expect(normalizeDockState('files', null).mode).toBe('full');
  });

  it('прежнее булево читается: сохранённая раскладка переживает правку', () => {
    // Поле хранилось булевым, и у людей оно в настройках уже лежит. Отвергни мы его —
    // раскладка сбрасывалась бы у всех разом и без объяснения.
    expect(normalizeDockState('files', true).mode).toBe('full');
    expect(normalizeDockState('files', false).mode).toBe('hidden');
  });

  it('во что сворачивается док, решает он сам', () => {
    // У бокового дока рейл снаружи и остаётся виден, у нижнего вкладки внутри —
    // спрятав их, док стало бы нечем вернуть.
    expect(normalizeDockState('files', false, 'minimal').mode).toBe('minimal');
    expect(toggleDock({ activeId: 'a', mode: 'full' }, 'a', 'minimal').mode).toBe('minimal');
    expect(toggleDock({ activeId: 'a', mode: 'full' }, 'a').mode).toBe('hidden');
  });

  it('щелчок по свёрнутой в полосу вкладке разворачивает её', () => {
    expect(toggleDock({ activeId: 'a', mode: 'minimal' }, 'a', 'minimal')).toEqual({
      activeId: 'a',
      mode: 'full',
    });
  });

  it('нестроковый идентификатор вкладки отбрасывается', () => {
    expect(normalizeDockState(42, true).activeId).toBeNull();
  });
});

describe('toggleDock', () => {
  it('нажатие на активную вкладку сворачивает док', () => {
    expect(toggleDock({ activeId: 'files', mode: 'full' }, 'files')).toEqual({
      activeId: 'files',
      mode: 'hidden',
    });
  });

  it('нажатие на ту же вкладку у свёрнутого дока разворачивает его', () => {
    expect(toggleDock({ activeId: 'files', mode: 'hidden' }, 'files')).toEqual({
      activeId: 'files',
      mode: 'full',
    });
  });

  it('нажатие на другую вкладку переключает и разворачивает', () => {
    expect(toggleDock({ activeId: 'files', mode: 'hidden' }, 'search')).toEqual({
      activeId: 'search',
      mode: 'full',
    });
  });
});

describe('сохранение и восстановление между сессиями', () => {
  it('размеры групп переживают пересоздание службы', async () => {
    const backend = createInMemorySettingsBackend();

    const first = session(backend);
    await first.hydrate();
    await writePanelSizes(first, 'main', { left: 240, center: 800, right: 300 });

    // Новая сессия — новая служба поверх того же хранилища.
    const second = session(backend);
    expect(readPanelSizes(second, 'main', MAIN_IDS)).toBeUndefined();

    await second.hydrate();
    expect(readPanelSizes(second, 'main', MAIN_IDS)).toEqual({
      left: 240,
      center: 800,
      right: 300,
    });
  });

  it('размеры разных групп не мешают друг другу', async () => {
    const backend = createInMemorySettingsBackend();
    const first = session(backend);
    await first.hydrate();
    await writePanelSizes(first, 'main', { left: 240 });
    await writePanelSizes(first, 'center', { editor: 600, bottom: 180 });

    const second = session(backend);
    await second.hydrate();
    expect(readPanelSizes(second, 'main', MAIN_IDS)).toEqual({ left: 240 });
    expect(readPanelSizes(second, 'center', ['editor', 'bottom'])).toEqual({
      editor: 600,
      bottom: 180,
    });
  });

  it('состояние дока переживает пересоздание службы', async () => {
    const backend = createInMemorySettingsBackend();
    const first = session(backend);
    await first.hydrate();
    await writeDockState(first, 'panel.left', { activeId: 'search', mode: 'hidden' });

    const second = session(backend);
    await second.hydrate();
    expect(readDockState(second, 'panel.left')).toEqual({ activeId: 'search', mode: 'hidden' });
  });

  it('снятый выбор вкладки не остаётся в хранилище', async () => {
    const backend = createInMemorySettingsBackend();
    const first = session(backend);
    await first.hydrate();
    await writeDockState(first, 'panel.left', { activeId: 'search', mode: 'full' });
    await writeDockState(first, 'panel.left', { activeId: null, mode: 'full' });

    const second = session(backend);
    await second.hydrate();
    expect(readDockState(second, 'panel.left')).toEqual(DEFAULT_DOCK_STATE);
  });

  it('испорченная запись не мешает открыться', async () => {
    const backend = createInMemorySettingsBackend({
      user: { [layoutSettingsKey('main')]: 'сломано' },
    });
    const settings = session(backend);
    await settings.hydrate();

    expect(readPanelSizes(settings, 'main', MAIN_IDS)).toBeUndefined();
  });
});

// @vitest-environment happy-dom
/**
 * Уровень темы [ReFormer-cn5g.2].
 *
 * Тема — первый уровень UI над моделью рядом с формой. Проверяется: действующая тема из выбора и
 * системы, привязка к полю модели (форма настроек меняет тему без клея), применение к корню
 * документа маркером ui-kit, хранилище выбора и время жизни в сторе.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { createModel, createStore, watchField } from '../../src/model/index';
import {
  createTheme,
  documentTheme,
  fixedSystemTheme,
  isThemePreference,
  mediaQuerySystemTheme,
  webStorage,
  type ThemePreference,
} from '../../src/theme/index';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Подменить `matchMedia`: тема системы под контролем теста. */
function stubMatchMedia(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query)
  );
  return {
    set(next: boolean) {
      query.matches = next;
      for (const l of [...listeners]) l();
    },
    get listeners() {
      return listeners.size;
    },
  };
}

describe('createTheme — действующая тема', () => {
  it('по умолчанию — «как в системе»: resolved следует за системой', () => {
    const system = fixedSystemTheme('light');
    const theme = createTheme({ system, target: null });
    expect(theme.preference.value).toBe('system');
    expect(theme.resolved.value).toBe('light');
    system.set('dark');
    expect(theme.system.value).toBe('dark');
    expect(theme.resolved.value).toBe('dark');
    theme.dispose();
  });

  it('явный выбор перекрывает систему; set и toggle', () => {
    const system = fixedSystemTheme('dark');
    const theme = createTheme({ system, target: null, initial: 'light' });
    expect(theme.resolved.value).toBe('light');
    theme.set('system');
    expect(theme.resolved.value).toBe('dark');
    theme.toggle(); // от действующей тёмной — к явной светлой
    expect(theme.preference.value).toBe('light');
    theme.toggle();
    expect(theme.preference.value).toBe('dark');
    theme.dispose();
  });

  it('system: null — система светлая', () => {
    const theme = createTheme({ system: null, target: null });
    expect(theme.system.value).toBe('light');
    expect(theme.resolved.value).toBe('light');
    theme.dispose();
  });

  it('состояние уровня снаружи только читается', () => {
    const theme = createTheme({ system: null, target: null });
    expect(() => {
      (theme.system as { value: string }).value = 'dark';
    }).toThrow(TypeError);
    theme.dispose();
  });
});

describe('createTheme — привязка к полю модели', () => {
  it('запись в поле модели (форма настроек) меняет тему, set пишет в поле', () => {
    const app = createStore(() => {
      const model = createModel({ settings: { theme: 'light' as ThemePreference } });
      const theme = createTheme({ preference: model.$.settings.theme, system: null, target: null });
      return { model, theme };
    });
    app.model.settings.theme = 'dark';
    expect(app.theme.resolved.value).toBe('dark');
    app.theme.set('light');
    expect(app.model.settings.theme).toBe('light');
    app.dispose();
  });

  it('непонятное значение в поле — «как в системе»', () => {
    const preference = signal<ThemePreference>('blue' as ThemePreference);
    const theme = createTheme({ preference, system: fixedSystemTheme('dark'), target: null });
    expect(theme.preference.value).toBe('system');
    expect(theme.resolved.value).toBe('dark');
    theme.dispose();
  });
});

describe('createTheme — применение к документу', () => {
  it('по умолчанию — класс dark и color-scheme на <html>', () => {
    const system = fixedSystemTheme('light');
    const theme = createTheme({ system });
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    system.set('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    theme.dispose();
    system.set('light');
    expect(root.classList.contains('dark')).toBe(true); // снятый уровень не применяет
  });

  it("attribute: 'data-theme' — атрибут вместо класса; colorScheme: false — без color-scheme", () => {
    const root = document.createElement('div');
    const theme = createTheme({
      system: null,
      initial: 'dark',
      target: documentTheme({ root, attribute: 'data-theme', colorScheme: false }),
    });
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('');
    theme.set('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    theme.dispose();
  });

  it('без document цели нет', () => {
    vi.stubGlobal('document', undefined);
    expect(documentTheme()).toBeNull();
  });
});

describe('mediaQuerySystemTheme', () => {
  it('читает prefers-color-scheme и следит за ним; подписка снимается с уровнем', () => {
    const media = stubMatchMedia(true);
    const theme = createTheme({ target: null });
    expect(theme.system.value).toBe('dark');
    media.set(false);
    expect(theme.resolved.value).toBe('light');
    expect(media.listeners).toBe(1);
    theme.dispose();
    expect(media.listeners).toBe(0);
  });

  it('без matchMedia — null', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(mediaQuerySystemTheme()).toBeNull();
  });

  it('без window — null', () => {
    vi.stubGlobal('window', undefined);
    expect(mediaQuerySystemTheme()).toBeNull();
  });
});

describe('createTheme — хранилище выбора', () => {
  it('восстанавливает сохранённый выбор и сохраняет новый', () => {
    localStorage.setItem('reformer.theme', '"dark"');
    const theme = createTheme({ system: null, target: null, storage: webStorage() });
    expect(theme.preference.value).toBe('dark');
    theme.set('light');
    expect(localStorage.getItem('reformer.theme')).toBe('"light"');
    theme.dispose();
  });

  it('негодное сохранённое значение пропускается; свой ключ', () => {
    localStorage.setItem('ui.theme', '"blue"');
    const theme = createTheme({
      system: null,
      target: null,
      storage: webStorage(),
      storageKey: 'ui.theme',
      initial: 'dark',
    });
    expect(theme.preference.value).toBe('dark');
    theme.dispose();
  });

  it('правка из другой вкладки применяется', () => {
    const theme = createTheme({ system: null, target: null, storage: webStorage() });
    localStorage.setItem('reformer.theme', '"dark"');
    window.dispatchEvent(new StorageEvent('storage', { key: 'reformer.theme' }));
    expect(theme.resolved.value).toBe('dark');
    theme.dispose();
  });
});

describe('createTheme — время жизни и реакции', () => {
  it('внутри стора снимается вместе с ним', () => {
    const system = fixedSystemTheme('light');
    const store = createStore(() => ({ theme: createTheme({ system }) }));
    store.dispose();
    system.set('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('watchField(theme.resolved) — реакция только на смену действующей темы', () => {
    const system = fixedSystemTheme('light');
    const theme = createTheme({ system, target: null, initial: 'light' });
    const changes: string[] = [];
    const stop = watchField(theme.resolved, (t) => changes.push(t));
    system.set('dark'); // выбор явный — действующая тема не меняется
    theme.set('dark');
    theme.set('system'); // система тоже тёмная — без смены
    stop();
    expect(changes).toEqual(['dark']);
    theme.dispose();
  });
});

describe('isThemePreference', () => {
  it('light, dark, system — да; прочее — нет', () => {
    expect(['light', 'dark', 'system'].every(isThemePreference)).toBe(true);
    expect(isThemePreference('blue')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe('fixedSystemTheme', () => {
  it('по умолчанию светлая; set той же темы не будит подписчиков', () => {
    const system = fixedSystemTheme();
    const onChange = vi.fn();
    const stop = system.subscribe(onChange);
    expect(system.current()).toBe('light');
    system.set('light');
    expect(onChange).not.toHaveBeenCalled();
    system.set('dark');
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });
});

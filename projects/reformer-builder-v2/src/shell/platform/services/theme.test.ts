import { describe, expect, it, vi } from 'vitest';

import {
  createInMemorySettingsBackend,
  createSettingsService,
  type SettingsBackend,
} from './settings';
import {
  DARK_CLASS,
  THEME_SETTINGS_KEY,
  createFixedSystemTheme,
  createThemeService,
  type ThemeKind,
  type ThemeRoot,
} from './theme';

/** Корень в объёме, который нужен службе: класс есть или его нет. */
function fakeRoot(): ThemeRoot & { has(token: string): boolean } {
  const tokens = new Set<string>();
  return {
    classList: {
      add: (token: string) => void tokens.add(token),
      remove: (token: string) => void tokens.delete(token),
    },
    has: (token: string) => tokens.has(token),
  };
}

async function loadedSettings(backend: SettingsBackend) {
  const settings = createSettingsService(backend);
  await settings.hydrate();
  return settings;
}

describe('системное предпочтение — умолчание', () => {
  it('без выбора пользователя действует тема системы', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const system = createFixedSystemTheme('dark');
    const root = fakeRoot();

    const theme = createThemeService({ settings, system, root });

    expect(theme.preference).toBe('system');
    expect(theme.theme).toBe('dark');
    expect(root.has(DARK_CLASS)).toBe(true);
  });

  it('светлая тема — это отсутствие класса, а не парный класс', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const root = fakeRoot();

    const theme = createThemeService({ settings, system: createFixedSystemTheme('light'), root });

    expect(theme.theme).toBe('light');
    expect(root.has(DARK_CLASS)).toBe(false);
  });

  it('пока выбор не сделан, оболочка следует за переключением системы', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const system = createFixedSystemTheme('light');
    const root = fakeRoot();
    const theme = createThemeService({ settings, system, root });
    const seen: ThemeKind[] = [];
    theme.onDidChange((next) => seen.push(next));

    system.set('dark');

    expect(theme.theme).toBe('dark');
    expect(root.has(DARK_CLASS)).toBe(true);
    expect(seen).toEqual(['dark']);
  });

  it('мусор в хранилище читается как «следуй за системой»', async () => {
    const settings = await loadedSettings(
      createInMemorySettingsBackend({ user: { [THEME_SETTINGS_KEY]: 'солярис' } })
    );

    const theme = createThemeService({
      settings,
      system: createFixedSystemTheme('dark'),
      root: fakeRoot(),
    });

    expect(theme.preference).toBe('system');
    expect(theme.theme).toBe('dark');
  });
});

describe('явный выбор перекрывает систему и сохраняется', () => {
  it('выбор применяется сразу и уведомляет подписчиков', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const root = fakeRoot();
    const theme = createThemeService({
      settings,
      system: createFixedSystemTheme('light'),
      root,
    });
    const seen: ThemeKind[] = [];
    theme.onDidChange((next) => seen.push(next));

    await theme.setPreference('dark');

    expect(theme.preference).toBe('dark');
    expect(theme.theme).toBe('dark');
    expect(root.has(DARK_CLASS)).toBe(true);
    expect(seen).toEqual(['dark']);
  });

  it('после явного выбора переключение системы темы не меняет', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const system = createFixedSystemTheme('light');
    const theme = createThemeService({ settings, system, root: fakeRoot() });
    await theme.setPreference('light');

    system.set('dark');

    expect(theme.theme).toBe('light');
  });

  it('выбор уходит в настройки — область пользователя', async () => {
    const backend = createInMemorySettingsBackend();
    const settings = await loadedSettings(backend);
    const theme = createThemeService({
      settings,
      system: createFixedSystemTheme('light'),
      root: fakeRoot(),
    });

    await theme.setPreference('dark');

    await expect(backend.read('user')).resolves.toEqual({ [THEME_SETTINGS_KEY]: 'dark' });
  });

  it('сохранённый выбор переживает перезапуск и остаётся сильнее системы', async () => {
    const backend = createInMemorySettingsBackend();
    const first = await loadedSettings(backend);
    await createThemeService({
      settings: first,
      system: createFixedSystemTheme('light'),
      root: fakeRoot(),
    }).setPreference('dark');

    // Новый запуск: то же хранилище, светлая система, но выбор пользователя сильнее.
    const restarted = await loadedSettings(backend);
    const root = fakeRoot();
    const theme = createThemeService({
      settings: restarted,
      system: createFixedSystemTheme('light'),
      root,
    });

    expect(theme.preference).toBe('dark');
    expect(theme.theme).toBe('dark');
    expect(root.has(DARK_CLASS)).toBe(true);
  });

  it('возврат к «как в системе» снова отдаёт тему системе', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const system = createFixedSystemTheme('dark');
    const theme = createThemeService({ settings, system, root: fakeRoot() });
    await theme.setPreference('light');

    await theme.setPreference('system');

    expect(theme.theme).toBe('dark');
  });

  it('правка настройки снаружи применяется тем же путём', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const root = fakeRoot();
    const theme = createThemeService({
      settings,
      system: createFixedSystemTheme('light'),
      root,
    });

    // Так сделает панель настроек: она пишет ключ, а не зовёт службу темы.
    await settings.set(THEME_SETTINGS_KEY, 'dark');

    expect(theme.theme).toBe('dark');
    expect(root.has(DARK_CLASS)).toBe(true);
  });
});

describe('жизненный цикл', () => {
  it('dispose снимает подписки на настройки и на систему', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const system = createFixedSystemTheme('light');
    const theme = createThemeService({ settings, system, root: fakeRoot() });
    const cb = vi.fn();
    theme.onDidChange(cb);

    theme.dispose();
    system.set('dark');

    expect(cb).not.toHaveBeenCalled();
  });

  it('dispose освобождает умолчание — служба темы вносит его сама', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const theme = createThemeService({
      settings,
      system: createFixedSystemTheme('light'),
      root: fakeRoot(),
    });
    expect(settings.get(THEME_SETTINGS_KEY)).toBe('system');

    theme.dispose();

    expect(settings.get(THEME_SETTINGS_KEY)).toBeUndefined();
  });

  it('без DOM служба считает тему, но не рисует', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());

    const theme = createThemeService({
      settings,
      system: createFixedSystemTheme('dark'),
      root: null,
    });

    expect(theme.theme).toBe('dark');
  });
});

describe('умолчание из конфига запуска', () => {
  it('defaultPreference действует до первого выбора и виден настройкам как умолчание', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const root = fakeRoot();
    createThemeService({
      settings,
      system: createFixedSystemTheme('light'),
      root,
      defaultPreference: 'dark',
    });

    // Система светлая, но конфиг сказал «тёмная по умолчанию» — и она применилась.
    expect(root.has(DARK_CLASS)).toBe(true);
    expect(settings.get(THEME_SETTINGS_KEY)).toBe('dark');
  });

  it('явный выбор человека сильнее умолчания из конфига', async () => {
    const settings = await loadedSettings(createInMemorySettingsBackend());
    const root = fakeRoot();
    const theme = createThemeService({
      settings,
      system: createFixedSystemTheme('dark'),
      root,
      defaultPreference: 'dark',
    });

    await theme.setPreference('light');

    expect(root.has(DARK_CLASS)).toBe(false);
  });
});

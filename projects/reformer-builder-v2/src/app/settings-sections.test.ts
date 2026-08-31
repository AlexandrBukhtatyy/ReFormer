/**
 * Разделы настроек: что показывается и куда уходит выбор.
 *
 * Проверяется главное свойство этой сборки: поле пишет через СЛУЖБУ, а не в хранилище
 * настроек. Разница не видна на записи (ключ в обоих случаях один) и видна на экране:
 * записанная мимо службы тема не появилась бы до перезагрузки, а язык — до следующей
 * догрузки словаря.
 *
 * @module app/settings-sections.test
 */

import { describe, expect, it } from 'vitest';
import { createI18nService } from '../host/services/i18n/i18n';
import { createSettingsService, createInMemorySettingsBackend } from '../host/services/settings';
import type { ThemePreference, ThemeService } from '../host/services/theme';
import { createSettingsSections, LOCALE_SETTINGS_KEY } from './settings-sections';

function fakeTheme(): ThemeService & { readonly applied: ThemePreference[] } {
  const applied: ThemePreference[] = [];
  return {
    theme: 'light',
    preference: 'system',
    applied,
    setPreference: async (next) => {
      applied.push(next);
    },
    onDidChange: () => ({ dispose: () => undefined }),
  };
}

async function deps() {
  const settings = createSettingsService(createInMemorySettingsBackend({}));
  await settings.hydrate();
  const i18n = createI18nService({ loadHostMessages: () => Promise.resolve({}), dev: false });
  await i18n.setLocale('ru');
  return { settings, i18n };
}

describe('разделы настроек', () => {
  it('тема и язык — два раздела, тема первой', async () => {
    const sections = createSettingsSections({ ...(await deps()), theme: fakeTheme() });
    expect(sections.map((section) => section.id)).toEqual(['appearance', 'language']);
  });

  it('без службы темы раздела внешнего вида нет: применять выбор нечем', async () => {
    const sections = createSettingsSections({ ...(await deps()), theme: null });
    expect(sections.map((section) => section.id)).toEqual(['language']);
  });

  it('поле темы показывает ВЫБОР человека, а не применённую тему', async () => {
    // При «как в системе» они расходятся, и показать «Светлая» значило бы соврать о том,
    // что выбрано.
    const theme = fakeTheme();
    const [appearance] = createSettingsSections({ ...(await deps()), theme });
    expect(appearance.fields[0]?.read()).toBe('system');
  });

  it('выбор темы уходит в службу, а не в хранилище настроек', async () => {
    const theme = fakeTheme();
    const { settings, i18n } = await deps();
    const [appearance] = createSettingsSections({ settings, i18n, theme });

    await appearance.fields[0]?.write('dark');

    expect(theme.applied).toEqual(['dark']);
  });

  it('выбор языка применяется и запоминается', async () => {
    const { settings, i18n } = await deps();
    const sections = createSettingsSections({ settings, i18n, theme: null });
    const locale = sections[0]?.fields[0];
    expect(locale?.read()).toBe('ru');

    await locale?.write('en');

    // Применено — то есть словарь уже переключён, а не «будет при следующем запуске».
    expect(i18n.locale).toBe('en');
    expect(settings.get<string>(LOCALE_SETTINGS_KEY)).toBe('en');
  });

  it('язык, который не поднялся, не запоминается', async () => {
    // Иначе следующий запуск встретил бы человека сломанным выбором, который он не делал:
    // запись пережила бы отказ, а применение — нет.
    const { settings } = await deps();
    const broken = createI18nService({
      loadHostMessages: () => Promise.reject(new Error('нет словаря')),
      dev: false,
    });
    const sections = createSettingsSections({ settings, i18n: broken, theme: null });

    await expect(sections[0]?.fields[0]?.write('en')).rejects.toThrow();

    expect(settings.get<string>(LOCALE_SETTINGS_KEY)).toBeUndefined();
  });
});

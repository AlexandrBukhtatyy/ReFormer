/**
 * Разделы настроек: что показывается и куда уходит выбор.
 *
 * Проверяется главное свойство этой сборки: поле пишет через СЛУЖБУ, а не в хранилище
 * настроек. Разница не видна на записи (ключ в обоих случаях один) и видна на экране:
 * записанная мимо службы тема не появилась бы до перезагрузки, а язык — до следующей
 * догрузки словаря.
 *
 * @module shell/boot/settings-sections.test
 */

import { describe, expect, it } from 'vitest';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import {
  createSettingsService,
  createInMemorySettingsBackend,
} from '@/shell/platform/services/settings';
import type { ThemePreference, ThemeService } from '@/shell/platform/services/theme';
import { createSettingsSections, LOCALE_SETTINGS_KEY } from './settings-sections';
import type { SettingField, SettingsSection } from '@/shell/platform/ui/dialogs/settings-ui';
import { toDisposable } from '@/shell/platform/primitives/disposable';
import type { PluginsSettingsPort } from './settings/plugins-list';

/**
 * Поля раздела с проверкой вида.
 *
 * Разделы, которые здесь проверяются, состоят из полей; раздел с собственным телом полей
 * не имеет вовсе. Бросаем, а не приводим типом: подмена вида — это красный тест, а не
 * повод молча прочитать undefined.
 */
function fieldsOf(section: SettingsSection | undefined): readonly SettingField[] {
  if (section === undefined || section.kind !== 'fields') {
    throw new Error('ожидался раздел из полей');
  }
  return section.fields;
}

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
    expect(fieldsOf(appearance)[0]?.read()).toBe('system');
  });

  it('выбор темы уходит в службу, а не в хранилище настроек', async () => {
    const theme = fakeTheme();
    const { settings, i18n } = await deps();
    const [appearance] = createSettingsSections({ settings, i18n, theme });

    await fieldsOf(appearance)[0]?.write('dark');

    expect(theme.applied).toEqual(['dark']);
  });

  it('выбор языка применяется и запоминается', async () => {
    const { settings, i18n } = await deps();
    const sections = createSettingsSections({ settings, i18n, theme: null });
    const locale = fieldsOf(sections[0])[0];
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

    await expect(fieldsOf(sections[0])[0]?.write('en')).rejects.toThrow();

    expect(settings.get<string>(LOCALE_SETTINGS_KEY)).toBeUndefined();
  });
});

describe('раздел «Плагины»', () => {
  /** Двойник каталога: разделу от него нужен список и подписка, остальное здесь не зовётся. */
  const port = (): PluginsSettingsPort => ({
    list: () => [],
    subscribe: () => toDisposable(() => {}),
    enable: () => Promise.resolve(true),
    disable: () => {},
    setDev: () => {},
    reload: () => Promise.resolve(true),
    synced: () => true,
    hasProject: () => true,
  });

  it('без каталога раздела нет: управлять нечем и показывать нечего', async () => {
    const { settings, i18n } = await deps();

    const sections = createSettingsSections({ settings, i18n, theme: null });

    expect(sections.map((section) => section.id)).not.toContain('plugins');
  });

  it('с каталогом раздел появляется и несёт СВОЁ тело, а не поля', async () => {
    const { settings, i18n } = await deps();

    const sections = createSettingsSections({ settings, i18n, theme: null, plugins: port() });
    const plugins = sections.find((section) => section.id === 'plugins');

    expect(plugins?.kind).toBe('custom');
    // Тело — то, из-за чего раздел вообще заведён: список живой, а массив разделов
    // строится один раз за запуск.
    expect(plugins?.kind === 'custom' ? plugins.Body : null).toBeTypeOf('function');
  });

  it('раздел находится поиском: у тела нет полей, и без ключей он выпал бы из результатов', async () => {
    const { settings, i18n } = await deps();

    const sections = createSettingsSections({ settings, i18n, theme: null, plugins: port() });
    const plugins = sections.find((section) => section.id === 'plugins');

    expect(plugins?.kind === 'custom' ? plugins.searchKeys : []).not.toEqual([]);
  });
});

/**
 * Разделы окна настроек — здесь, а не в оболочке.
 *
 * Оболочка знает, как нарисовать список и поле; ЧТО настраивается, знает композиция: тему
 * применяет служба темы, язык — служба локализации, и обе — её сборка. Окно, добравшееся
 * до этих служб само, стало бы вторым местом, где приложение решает, что у него есть.
 *
 * ## Запись идёт через СЛУЖБУ, а не в хранилище настроек
 *
 * Ключи (`host.theme`, `host.locale`) лежат в общем хранилище, и записать их напрямую можно —
 * но тогда тема не появилась бы на экране до перезагрузки, а язык — до следующей догрузки
 * словаря: применение живёт в службах. Поэтому поле пишет туда же, куда пишет команда.
 *
 * Локаль — исключение с двумя шагами: `I18nService` применяет её, но не помнит между
 * запусками, поэтому выбор дополнительно кладётся в настройки, откуда его читает `boot`.
 *
 * @module shell/boot/settings-sections
 */

import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { SettingsService } from '@/shell/platform/services/settings';
import type { ThemePreference, ThemeService } from '@/shell/platform/services/theme';
import type { SettingsSection } from '@/shell/platform/ui/dialogs/settings-ui';
import { createPluginsSettingsBody } from './settings/PluginsSettings';
import type { PluginSettingsHost, PluginsSettingsPort } from './settings/plugins-list';

/** Ключ настройки языка. Тот же, что читает `boot` при старте. */
export const LOCALE_SETTINGS_KEY = 'host.locale';

/** Языки, между которыми можно переключиться: те, для которых есть словарь Host. */
export const SUPPORTED_LOCALES: readonly string[] = Object.freeze(['ru', 'en']);

export interface SettingsSectionsDeps {
  readonly settings: SettingsService;
  readonly i18n: RootI18nService;
  /** Служба темы. Без неё раздела внешнего вида нет — применять выбор нечем. */
  readonly theme?: ThemeService | null;
  /**
   * Каталог плагинов. Без него раздела «Плагины» нет — показывать нечего и управлять нечем.
   *
   * Раздел единственный, у кого вместо полей собственное тело: список ЖИВОЙ (его меняют
   * палитра, обход проекта и авто-перезагрузка), а массив разделов строится один раз
   * за запуск. Поле такого не выражает — см. `platform/ui/dialogs/settings-ui`.
   */
  readonly plugins?: PluginsSettingsPort | null;
  /**
   * Настройки САМИХ плагинов: схемы, которые они внесли, и значения к ним.
   *
   * Отдельно от {@link plugins}, потому что это разные способности: список плагинов есть
   * всегда, а настройки — только когда есть кому их хранить и показывать. Без неё раздел
   * работает ровно как работал.
   */
  readonly pluginSettings?: PluginSettingsHost | null;
}

/**
 * Собирает разделы настроек.
 *
 * Раздел без единого поля не создаётся: пустой раздел в списке слева обещает настройки,
 * которых нет.
 */
export function createSettingsSections(deps: SettingsSectionsDeps): readonly SettingsSection[] {
  const sections: SettingsSection[] = [];
  const { settings, i18n, theme, plugins, pluginSettings } = deps;

  if (theme != null) {
    sections.push({
      kind: 'fields',
      id: 'appearance',
      titleKey: 'shell.settings.appearance',
      fields: [
        {
          id: 'theme',
          titleKey: 'shell.settings.theme',
          descriptionKey: 'shell.settings.theme.description',
          choices: [
            { value: 'system', titleKey: 'shell.settings.theme.system' },
            { value: 'light', titleKey: 'shell.settings.theme.light' },
            { value: 'dark', titleKey: 'shell.settings.theme.dark' },
          ],
          // Выбор ЧЕЛОВЕКА, а не применённая тема: при `system` они расходятся, и показать
          // «Светлая» там, где выбрано «Как в системе», значило бы соврать про настройку.
          read: () => theme.preference,
          write: (value) => theme.setPreference(value as ThemePreference),
        },
      ],
    });
  }

  sections.push({
    kind: 'fields',
    id: 'language',
    titleKey: 'shell.settings.language',
    fields: [
      {
        id: 'locale',
        titleKey: 'shell.settings.language.locale',
        descriptionKey: 'shell.settings.language.description',
        choices: SUPPORTED_LOCALES.map((locale) => ({
          value: locale,
          titleKey: `shell.settings.language.${locale}`,
        })),
        // Действующая локаль, а не записанная: они расходятся ровно между записью и
        // догрузкой словаря, и в этот момент окно обязано показывать то, что на экране.
        read: () => i18n.locale,
        write: async (value) => {
          await i18n.setLocale(value);
          // Запись ПОСЛЕ применения: локаль, которую не удалось поднять, не должна
          // пережить перезагрузку и встретить человека сломанным интерфейсом.
          await settings.set(LOCALE_SETTINGS_KEY, value);
        },
      },
    ],
  });

  if (plugins != null) {
    sections.push({
      kind: 'custom',
      id: 'plugins',
      titleKey: 'shell.settings.plugins',
      Body: createPluginsSettingsBody(plugins, pluginSettings ?? null),
      // Поиск идёт по видимому тексту полей, а у тела полей нет: без этих ключей запрос
      // «плагин» отвечал бы «ничего не найдено» при живом разделе слева.
      searchKeys: ['shell.settings.plugins.description'],
    });
  }

  return sections;
}

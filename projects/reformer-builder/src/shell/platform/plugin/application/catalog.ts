/**
 * Каталог плагинов ПРИЛОЖЕНИЯ: тот же каталог, что у проекта, с политикой уровня запуска.
 *
 * Плагины приложения — преемники встроенных: приезжают вместе с приложением, работают
 * до открытия проекта и для любого проекта. Отдельного механизма под них нет — это второй
 * экземпляр {@link createProjectPluginCatalog} над слоем файлов приложения (`./files`).
 * Различается только политика, и вся она собрана здесь:
 *
 * - **включено всё найденное.** Набор выбрал тот, кто приложение развернул, положив плагины
 *   рядом со сборкой; спрашивать человека за экраном, включать ли часть приложения, не о чем;
 * - **права выдаются из манифеста без вопроса** — как встроенным (`boot/composition`):
 *   доверие принадлежит уровню запуска, тому же, что читает конфиг запуска;
 * - **пометок «в разработке» нет**: файлы слоя не наблюдаются, автор правит плагин в проекте.
 *
 * Упавший плагин приложения выключается до следующего запуска, как и плагин каталога: строка
 * с причиной остаётся в списке, остальные работают.
 *
 * @module shell/platform/plugin/application/catalog
 */

import type { CapabilityProvider } from '@reformer/builder-plugin-api/internal';
import {
  createProjectPluginCatalog,
  type ProjectPluginCatalog,
  type ProjectPluginCatalogDeps,
} from '../catalog';

/** Имя источника манифестных клавиш плагинов приложения в раскладке. */
export const APPLICATION_KEYBINDINGS_SOURCE = 'application-plugins';

/** То, что каталогу приложения нужно от композиции: политику он задаёт сам. */
export type ApplicationPluginCatalogDeps = Pick<
  ProjectPluginCatalogDeps,
  'loader' | 'plugins' | 'i18n' | 'keymap' | 'installStyles' | 'capabilities' | 'onProblem'
>;

export interface ApplicationPluginCatalog {
  /** Сам каталог — ради списка в настройках и снятия при остановке приложения. */
  readonly catalog: ProjectPluginCatalog;
  /**
   * Читает слой и поднимает всё найденное. Возвращает идентификаторы поднявшихся.
   *
   * Зовётся один раз, при запуске: слой приложения не меняется, пока приложение работает.
   */
  start(): Promise<readonly string[]>;
  /**
   * Идентификаторы работающих плагинов приложения — для каталога проекта: копия такого
   * плагина в проекте не грузится. Упавший плагин идентификатор не занимает.
   */
  reserved(): ReadonlySet<string>;
  /** Возможности работающих плагинов приложения — их вправе требовать плагины проекта. */
  capabilities(): readonly CapabilityProvider[];
}

export function createApplicationPluginCatalog(
  deps: ApplicationPluginCatalogDeps
): ApplicationPluginCatalog {
  const catalog: ProjectPluginCatalog = createProjectPluginCatalog({
    ...deps,
    layer: 'application',
    keybindingsSource: APPLICATION_KEYBINDINGS_SOURCE,
    // «Включено всё найденное»: список включённых — сам каталог, хранить его негде и незачем.
    enabled: {
      read: () => Promise.resolve(catalog.list().map((entry) => entry.id)),
      write: () => Promise.resolve(),
    },
    confirmPermissions: () => Promise.resolve(true),
  });

  const running = () => catalog.list().filter((entry) => entry.state === 'enabled');

  return {
    catalog,
    start: async () => {
      await catalog.refresh();
      return catalog.restoreEnabled();
    },
    reserved: () => new Set(running().map((entry) => entry.id)),
    capabilities: () =>
      running().flatMap((entry) =>
        (entry.manifest?.provides ?? []).map((declared) => ({ ...declared, by: entry.id }))
      ),
  };
}

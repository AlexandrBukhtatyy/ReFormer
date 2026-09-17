/**
 * Управление плагинами каталога из палитры команд.
 *
 * UI-поверхность у каталога плагинов сегодня одна — динамические пункты палитры, по образцу
 * переключения китов. Панель со списком не заводится, пока палитры хватает: цикл разработки
 * держится на «включить», «перезагрузить» и пометке «в разработке», а всё это — действия,
 * которым списковый интерфейс не нужен.
 *
 * Пункты собираются на КАЖДОЕ открытие палитры заново (`provide`), поэтому список всегда
 * отражает текущее состояние каталога — подписка на его изменения не нужна. Перевод —
 * не реактивный по той же причине, что у китов: поставщик не компонент, смена локали
 * перестроит пункты на следующем открытии.
 *
 * @module plugins/plugin-manager/plugin
 */

import manifest from './manifest.json';
import { definePlugin, PaletteItemsPoint } from '@reformer/builder-plugin-api';
import type { PaletteItem, PaletteItemProvider, Plugin } from '@reformer/builder-plugin-api';
import type { ManagedPlugin, PluginManagerHost, Translate } from './host';
import { PLUGIN_MANAGER_MESSAGES } from './messages';

export const PLUGIN_MANAGER_PLUGIN_ID = manifest.id;

/** Идентификатор поставщика пунктов — адрес вклада в точке палитры. */
export const PLUGIN_MANAGER_PALETTE_PROVIDER_ID = 'plugin-manager.actions';

export interface PluginManagerPluginOptions {
  readonly host: PluginManagerHost;
}

/** Пояснение справа от пункта: у упавшего — причина, у наблюдаемого — режим. */
const detailOf = (plugin: ManagedPlugin, t: Translate): string | undefined => {
  if (plugin.state === 'failed') {
    return t('detail.failed', { message: plugin.problem?.message ?? '' });
  }
  return plugin.dev ? t('detail.dev') : undefined;
};

export function createPluginManagerPaletteProvider(
  host: PluginManagerHost,
  t: Translate
): PaletteItemProvider {
  return {
    id: PLUGIN_MANAGER_PALETTE_PROVIDER_ID,
    provide(): PaletteItem[] {
      const items: PaletteItem[] = [
        {
          id: 'plugin-manager.refresh',
          title: t('palette.refresh'),
          run: () => host.refresh(),
        },
      ];
      // Пункт появляется, только если установка в этой сборке вообще есть: команда,
      // которая ничего не делает, хуже отсутствующей.
      if (host.install !== undefined) {
        items.push({
          id: 'plugin-manager.install',
          title: t('palette.install'),
          detail: t('detail.install'),
          run: () => host.install?.(),
        });
      }
      for (const plugin of host.list()) {
        const params = { name: plugin.name };
        const detail = detailOf(plugin, t);
        if (plugin.state === 'enabled') {
          items.push(
            {
              id: `plugin-manager.disable.${plugin.id}`,
              title: t('palette.disable', params),
              detail,
              run: () => host.disable(plugin.id),
            },
            {
              id: `plugin-manager.reload.${plugin.id}`,
              title: t('palette.reload', params),
              detail,
              run: () => host.reload(plugin.id),
            }
          );
        } else {
          // Упавшему «включить» и есть «попробовать снова»: включение читает файлы заново.
          items.push({
            id: `plugin-manager.enable.${plugin.id}`,
            title: t('palette.enable', params),
            detail,
            run: () => host.enable(plugin.id),
          });
        }
        if (plugin.layer === 'installed') {
          if (host.rollback !== undefined) {
            items.push({
              id: `plugin-manager.rollback.${plugin.id}`,
              title: t('palette.rollback', params),
              detail,
              run: () => host.rollback?.(plugin.id),
            });
          }
          if (host.uninstall !== undefined) {
            items.push({
              id: `plugin-manager.uninstall.${plugin.id}`,
              title: t('palette.uninstall', params),
              detail,
              run: () => host.uninstall?.(plugin.id),
            });
          }
        }
        items.push({
          id: `plugin-manager.dev.${plugin.id}`,
          title: t(plugin.dev ? 'palette.dev-off' : 'palette.dev-on', params),
          detail,
          run: () => host.setDev(plugin.id, !plugin.dev),
        });
      }
      return items;
    },
  };
}

export function createPluginManagerPlugin(options: PluginManagerPluginOptions): Plugin {
  return definePlugin({
    id: PLUGIN_MANAGER_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PLUGIN_MANAGER_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }
      // Перевод НЕ реактивный, и это цена не-компонентного вклада: пункты палитры строит
      // поставщик, а не компонент, и хука там быть не может. Смена локали перестроит их
      // на следующем открытии палитры.
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PaletteItemsPoint,
          createPluginManagerPaletteProvider(options.host, (key, params) =>
            ctx.i18n.t(key, params)
          ),
          { id: PLUGIN_MANAGER_PALETTE_PROVIDER_ID }
        )
      );
    },
  });
}

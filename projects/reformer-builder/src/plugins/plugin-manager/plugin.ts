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

import { definePlugin, PaletteItemsPoint } from '@/sdk';
import type { PaletteItem, PaletteItemProvider, Plugin } from '@/sdk';
import type { ManagedPlugin, PluginManagerHost, Translate } from './host';

export const PLUGIN_MANAGER_PLUGIN_ID = 'plugin-manager';

/** Идентификатор поставщика пунктов — адрес вклада в точке палитры. */
export const PLUGIN_MANAGER_PALETTE_PROVIDER_ID = 'plugin-manager.actions';

export interface PluginManagerPluginOptions {
  readonly host: PluginManagerHost;
  readonly translate: Translate;
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
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PaletteItemsPoint,
          createPluginManagerPaletteProvider(options.host, options.translate),
          { id: PLUGIN_MANAGER_PALETTE_PROVIDER_ID }
        )
      );
    },
  });
}

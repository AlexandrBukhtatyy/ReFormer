/**
 * Плагин «Превью приложением»: панель, в которой форму и страницу рисует само приложение.
 *
 * **Для кого он.** Для билдера, встроенного в приложение. Там форму в превью рисует не билдер,
 * а приложение — со своим реестром, своим API и своими провайдерами, — и билдеру остаётся
 * открыть его адрес в рамке. В самостоятельном билдере приложения рядом нет, и плагин ничего
 * не вносит: ни панели, ни команд.
 *
 * **Откуда он знает адреса.** Из возможности `reformer.app.preview`, которую даёт оболочка,
 * встроенная в приложение. Возможности нет — приложения нет: спрашивается она при активации,
 * потому что оболочка регистрирует её до плагинов и на ходу не снимает.
 *
 * **Чего он не знает.** Ничего об устройстве приложения: ни маршрутов, ни реестра, ни того, как
 * форма собрана. Путь модуля формы — единственное, что уходит в адрес; что по нему нарисовать,
 * решает приложение.
 *
 * @module plugins/base/app-preview/plugin
 */

import { createElement, type ReactElement } from 'react';
import { MonitorPlay } from 'lucide-react';
import {
  AppPreviewCapability,
  definePlugin,
  DocumentsServiceToken,
  PanelPoint,
  WorkspaceFilesServiceToken,
  type Plugin,
} from '@reformer/builder-plugin-api';
import manifest from './manifest.json';
import { APP_PREVIEW_MESSAGES } from './messages';
import { createPreviewModeStore } from './model';
import { PreviewModeSwitch } from './ui/PreviewModeSwitch';
import { PreviewPanel } from './ui/PreviewPanel';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const APP_PREVIEW_PLUGIN_ID = manifest.id;

/** Панель превью. Он же — адрес вклада в точке расширения. */
export const APP_PREVIEW_PANEL_ID = 'app-preview.panel';

/** Значок панели. Обёртка ради размера: контракт объявляет значок компонентом без пропсов. */
const PreviewIcon = (): ReactElement => createElement(MonitorPlay, { className: 'size-4' });

export function createAppPreviewPlugin(): Plugin {
  return definePlugin({
    id: APP_PREVIEW_PLUGIN_ID,
    activate(ctx) {
      // Словарь — в любом случае: вклад в словарь не снимается, а стоит он ничего.
      for (const [locale, messages] of Object.entries(APP_PREVIEW_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const preview = ctx.services.get(AppPreviewCapability);
      const documents = ctx.services.get(DocumentsServiceToken);
      const files = ctx.services.get(WorkspaceFilesServiceToken);
      // Приложения рядом нет (самостоятельный билдер) — показывать нечего. Без служб рабочей
      // области панель не узнала бы, какую форму показывать, поэтому условие одно на всё.
      if (preview === undefined || documents === undefined || files === undefined) return;

      // Режим — один на плагин: переключатель стоит в шапке дока, рамка — в теле панели,
      // а это два разных поддерева оболочки.
      const mode = createPreviewModeStore();

      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          {
            id: APP_PREVIEW_PANEL_ID,
            slot: 'panel.right',
            titleKey: 'panel.title',
            icon: PreviewIcon,
            // Рамка с приложением — сама область просмотра: панели нужна вся высота дока,
            // а прокручивается в ней документ приложения, не панель.
            fill: true,
            Body: () =>
              createElement(PreviewPanel, { preview, documents, files, mode, i18n: ctx.i18n }),
            // Переключатель режима — в шапке дока: в теле панели он отнимал бы строку у рамки.
            Actions: () => createElement(PreviewModeSwitch, { mode, i18n: ctx.i18n }),
          },
          { id: APP_PREVIEW_PANEL_ID }
        )
      );
    },
  });
}

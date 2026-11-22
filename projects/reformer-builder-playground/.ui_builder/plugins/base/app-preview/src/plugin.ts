/**
 * Плагин «Превью приложением»: форму и страницу рисует само запущенное приложение.
 *
 * **Для кого он.** Для билдера, встроенного в приложение. Там форму в превью рисует не билдер,
 * а приложение — со своим реестром, своим API и своими провайдерами, — и билдеру остаётся
 * открыть его адрес в рамке. В самостоятельном билдере приложения рядом нет, и плагин ничего
 * не вносит: ни вида, ни панели.
 *
 * **Что он вносит.** Два вида, и у каждого своё место:
 *
 * - **форма** — поверхность превью (`./form-surface`). Её показывает вид «Форма» открытой
 *   вкладки, тот же, что в билдере без приложения: кнопка со значком в полосе вкладок. Плагин
 *   не заводит ни кнопки, ни тела вкладки — он только отвечает на вопрос «чем нарисовать»;
 * - **приложение** — панель в правом доке (`./ui/PreviewPanel`): страница целиком.
 *
 * **Откуда он знает адреса.** Из возможности `reformer.app.preview`, которую даёт оболочка,
 * встроенная в приложение. Возможности нет — приложения нет: спрашивается она при активации,
 * потому что оболочка регистрирует её до плагинов и на ходу не снимает.
 *
 * **Чего он не знает.** Ничего об устройстве приложения: ни маршрутов, ни реестра, ни того, как
 * форма собрана. Путь модуля формы — единственное, что уходит в адрес; что по нему нарисовать,
 * решает приложение.
 *
 * **Зачем ему право сохранять.** Приложение рисует то, что записано на диск. Несохранённую
 * правку вид «Форма» не покажет, и говорит об этом полосой над формой; кнопка в полосе
 * сохраняет всё изменённое — тем же путём, что Ctrl+S. Право (`workspace.save`) объявлено
 * в манифесте; им же плагин узнаёт, есть ли несохранённое вообще.
 *
 * @module plugins/base/app-preview/plugin
 */

import { createElement, type ReactElement } from 'react';
import { MonitorPlay } from 'lucide-react';
import {
  AppPreviewCapability,
  definePlugin,
  FormModulePoint,
  PanelPoint,
  PreviewSurfacePoint,
  WorkspaceFilesServiceToken,
  WorkspaceSaveCapability,
  type Plugin,
} from '@reformer/builder-plugin-api';
import { APP_FORM_SURFACE_ID, createFormSurface } from './form-surface';
import manifest from './manifest.json';
import { APP_PREVIEW_MESSAGES } from './messages';
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
      // Приложения рядом нет (самостоятельный билдер) — показывать нечего.
      if (preview === undefined) return;

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
            // Шапки нет: панель называет себя адресной строкой, а «Превью» уже написано
            // на её кнопке рейла. Строка шапки нужнее приложению в рамке.
            headless: true,
            Body: () => createElement(PreviewPanel, { preview, i18n: ctx.i18n }),
          },
          { id: APP_PREVIEW_PANEL_ID }
        )
      );

      // Форма — видом открытой вкладки. Поверхности нужна рабочая область: точку входа модуля
      // формы она ищет рядом с документом (для документа из папки `schema` — уровнем выше).
      // Без неё документов нет, и показывать форму не у чего.
      const files = ctx.services.get(WorkspaceFilesServiceToken);
      if (files === undefined) return;
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PreviewSurfacePoint,
          createFormSurface({
            preview,
            files,
            // Спрашивается в момент вопроса: право могли не дать, а службу — снять.
            saving: () => ctx.services.get(WorkspaceSaveCapability),
            // Где модуль формы, знает стек документа; без его ответа — правило «рядом с документом».
            modules: () => ctx.extensions.get(FormModulePoint).map((entry) => entry.value),
            t: (key, params) => ctx.i18n.t(key, params),
          }),
          { id: APP_FORM_SURFACE_ID }
        )
      );
    },
  });
}

/**
 * Поверхности превью стека ReFormer и панель модели формы.
 *
 * ## Почему отдельный плагин, а не половина плагина превью
 *
 * Превью состоит из двух разных знаний. Первое — КАК показывать документ: точка поверхностей,
 * правило выбора, состояния документов, находки сборки, канал выделения. Оно одно на все стеки
 * и живёт в плагине превью (`reformer.preview`). Второе — ЧЕМ рисовать схему ReFormer:
 * `renderer-json` с компонентами активного кита, компиляция сайдкаров формы, фикстуры, панель
 * значений модели `@reformer/core`. Оно принадлежит стеку, и держать его вместе с первым значило
 * бы, что второй стек получает превью только вместе с чужим рендерером.
 *
 * Связь с плагином превью — только через контракт: поверхности уходят в `PreviewSurfacePoint`,
 * панель модели читает опубликованную форму у возможности `reformer.preview.live`.
 *
 * @module plugins/reformer/render/plugin
 */

import { createElement } from 'react';
import {
  definePlugin,
  PanelPoint,
  PreviewLiveCapability,
  PreviewSurfacePoint,
  type Plugin,
  type PreviewSurface,
  type SlotId,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import { FORM_SCHEMA_PROVIDER_ID } from '@reformer/builder-stack-reformer/form-model';
import { createCompilingSurface } from './compiling/surface';
import { PREVIEW_RUNTIME_PLUGIN_ID } from './contract';
import type { PreviewHost, Translate } from './host';
import { previewHostFromContext } from './host-from-context';
import { PREVIEW_RUNTIME_MESSAGES } from './messages';
import { createRuntimeSurface } from './runtime/surface';
import { ModelPanel, MODEL_PANEL_ID } from './ui/ModelPanel';

export { PREVIEW_RUNTIME_PLUGIN_ID };

/**
 * Поверхности плагина в порядке возрастания способностей.
 *
 * Каркасной среди них больше нет: она рисовала структуру формы рамками, а структуру уже
 * показывают дерево и схема редактора — и оба умеют её ПРАВИТЬ, а не только показывать.
 */
export function builtinSurfaces(host: PreviewHost, t: Translate): readonly PreviewSurface[] {
  return [createRuntimeSurface(host, t), createCompilingSurface(host, t)];
}

export interface PreviewRuntimePluginOptions {
  /**
   * Порт превью. Обычно плагин собирает его сам из возможностей оболочки
   * (`./host-from-context`); параметр — ради тестов, которым нужен кит и файлы без приложения.
   */
  readonly host?: PreviewHost;
}

export function createPreviewRuntimePlugin(options: PreviewRuntimePluginOptions = {}): Plugin {
  return definePlugin({
    id: PREVIEW_RUNTIME_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PREVIEW_RUNTIME_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }
      const t: Translate = (key, params) => ctx.i18n.t(key, params);
      const host = options.host ?? previewHostFromContext(ctx);

      // Панель модели — значения собранной формы и состояние её узлов. Слот нижний: строки
      // значений читают в ширину, а не в высоту, и форме при этом остаётся весь экран.
      // Живой вид спрашивается в момент отрисовки: превью выключаемо, а панель — нет.
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          {
            id: MODEL_PANEL_ID,
            slot: 'panel.bottom' as SlotId,
            titleKey: 'model.title',
            when: (when: WhenContext) => when.activeResourceKind === FORM_SCHEMA_PROVIDER_ID,
            order: 30,
            Body: () =>
              createElement(ModelPanel, {
                host,
                live: () => ctx.services.get(PreviewLiveCapability),
              }),
          },
          { id: MODEL_PANEL_ID }
        )
      );

      for (const surface of builtinSurfaces(host, t)) {
        ctx.subscriptions.push(
          ctx.extensions.contribute(PreviewSurfacePoint, surface, { id: surface.id })
        );
      }
    },
  });
}

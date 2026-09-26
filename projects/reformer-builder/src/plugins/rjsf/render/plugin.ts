/**
 * Рендер домена RJSF: поверхность превью, которая рисует форму компонентами активного кита.
 *
 * Тема RJSF строится из каталога кита (`@reformer/rjsf-kit-theme`), поэтому кит, внесённый
 * внешним плагином, рисует и формы RJSF — без строчки кода под этот домен. Кит — необязательная
 * возможность `reformer.kit.catalog`: без неё форма рисуется стандартной темой RJSF.
 *
 * @module plugins/rjsf/render/plugin
 */

import {
  definePlugin,
  KitsCapability,
  PreviewSurfacePoint,
  type Plugin,
} from '@reformer/builder-plugin-api';
import { RJSF_RENDER_PLUGIN_ID, RJSF_SURFACE_ID } from './contract';
import { RJSF_RENDER_MESSAGES } from './messages';
import { createRjsfSurface } from './surface';

export { RJSF_RENDER_PLUGIN_ID };

export function createRjsfRenderPlugin(): Plugin {
  return definePlugin({
    id: RJSF_RENDER_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(RJSF_RENDER_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }
      const t = (key: string, params?: Record<string, unknown>): string => ctx.i18n.t(key, params);
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PreviewSurfacePoint,
          createRjsfSurface({ t, kits: () => ctx.services.get(KitsCapability) }),
          { id: RJSF_SURFACE_ID }
        )
      );
    },
  });
}

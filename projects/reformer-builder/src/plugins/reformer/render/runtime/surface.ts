/**
 * Вклад рантайм-поверхности.
 *
 * `executesCode: false` — и это не формальность, а то, что делает поверхность доступной
 * на источнике без права исполнения. Схема — данные; рисовать данные можно откуда угодно.
 *
 * `dragSource: false`: приём дропа с палитры означал бы правку схемы из превью, а правит схему
 * редактор. Появится — станет `true`, и переключатель об этом узнает сам.
 *
 * @module plugins/reformer/render/runtime/surface
 */

import { createElement } from 'react';
import type { PreviewSurface } from '@reformer/builder-plugin-api';
import { isFormSchemaDocument } from '@/plugins/reformer/core/form-model';
import type { PreviewHost, Translate } from '../host';
import { mountReact } from '../surface/mount';
import { RuntimeView, RUNTIME_SURFACE_ID } from './RuntimeView';

export { RUNTIME_SURFACE_ID };

export function createRuntimeSurface(host: PreviewHost, t: Translate): PreviewSurface {
  return {
    id: RUNTIME_SURFACE_ID,
    title: () => t('surface.runtime'),
    applies: isFormSchemaDocument,
    capabilities: {
      interactive: true,
      hitTest: true,
      dragSource: false,
      executesCode: false,
      sameRealm: true,
    },
    mount(element, ctx) {
      return mountReact(element, createElement(RuntimeView, { ctx, host }));
    },
  };
}

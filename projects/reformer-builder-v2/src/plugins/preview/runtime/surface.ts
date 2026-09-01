/**
 * Вклад рантайм-поверхности.
 *
 * `executesCode: false` — и это не формальность, а то, что делает поверхность доступной
 * на источнике без права исполнения. Схема — данные; рисовать данные можно откуда угодно.
 *
 * `dragSource: false`: приём дропа с палитры означал бы правку схемы из превью, а правит схему
 * редактор. Появится — станет `true`, и переключатель об этом узнает сам.
 *
 * @module plugins/preview/runtime/surface
 */

import { createElement } from 'react';
import type { PreviewSurface } from '../contract';
import { isFormDocument } from '../schema/document';
import type { PreviewHost } from '../host';
import { mountReact } from '../surface/mount';
import { RuntimeView, RUNTIME_SURFACE_ID } from './RuntimeView';

export { RUNTIME_SURFACE_ID };

export function createRuntimeSurface(host: PreviewHost): PreviewSurface {
  return {
    id: RUNTIME_SURFACE_ID,
    titleKey: 'surface.runtime',
    applies: isFormDocument,
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

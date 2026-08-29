/**
 * Вклад каркасной поверхности.
 *
 * Возможности читаются как определение: `hitTest` да, `executesCode` нет, `interactive` нет —
 * форму нельзя потрогать, потому что формы здесь и нет, есть её структура. Из этого набора
 * правило умолчания само выводит, что каркас показывается последним.
 *
 * @module plugins/preview/skeleton/surface
 */

import { createElement } from 'react';
import type { PreviewSurface } from '../contract';
import { isFormDocument } from '../document';
import type { PreviewHost } from '../host';
import { mountReact } from '../mount';
import { SkeletonView, SKELETON_SURFACE_ID } from './SkeletonView';

export { SKELETON_SURFACE_ID };

export function createSkeletonSurface(host: PreviewHost): PreviewSurface {
  return {
    id: SKELETON_SURFACE_ID,
    titleKey: 'surface.skeleton',
    applies: isFormDocument,
    capabilities: {
      interactive: false,
      hitTest: true,
      dragSource: false,
      executesCode: false,
      sameRealm: true,
    },
    mount(element, ctx) {
      return mountReact(element, createElement(SkeletonView, { ctx, host }));
    },
  };
}

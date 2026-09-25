/**
 * Вклад компилирующей поверхности.
 *
 * `executesCode: true` — единственная из трёх, и именно из-за этого признака её монтирование
 * проходит через запрет по источнику. `sameRealm: true` обязателен: исполняющая поверхность
 * в чужом realm означала бы второй экземпляр ядра.
 *
 * `applies` отвечает `true` даже без загрузчика модулей: поверхность применима к документу,
 * а доступна или нет — вопрос источника и композиции, и ответ на него принадлежит переключателю,
 * а не вкладу. Иначе поверхность просто исчезала бы из списка, и «почему нет живого превью»
 * осталось бы без ответа.
 *
 * @module plugins/reformer/render/compiling/surface
 */

import { createElement } from 'react';
import type { PreviewSurface } from '@reformer/builder-plugin-api';
import { isFormSchemaDocument } from '@reformer/builder-stack-reformer/form-model';
import type { PreviewHost, Translate } from '../host';
import { mountReact } from '../surface/mount';
import { CompilingView, COMPILING_SURFACE_ID } from './CompilingView';

export { COMPILING_SURFACE_ID };

export function createCompilingSurface(host: PreviewHost, t: Translate): PreviewSurface {
  return {
    id: COMPILING_SURFACE_ID,
    title: () => t('surface.compiling'),
    applies: isFormSchemaDocument,
    capabilities: {
      interactive: true,
      hitTest: true,
      dragSource: false,
      executesCode: true,
      sameRealm: true,
    },
    mount(element, ctx) {
      return mountReact(element, createElement(CompilingView, { ctx, host }));
    },
  };
}

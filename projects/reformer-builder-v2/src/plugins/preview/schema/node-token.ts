/**
 * Подъём от элемента DOM к узлу — и РЕЭКСПОРТ доменного кодека.
 *
 * Кодек («как выглядит токен») переехал в `@/lib/form-model/node-token`, когда потребителей
 * стало двое в разных плагинах: превью ставит токен, а редактор схемы читает DOM смонтированной
 * поверхности, чтобы выделять узел и принимать бросок. Довод целиком — в шапке доменного модуля.
 *
 * Здесь остаётся ровно то, что домену не принадлежит: единственная функция, знающая про DOM.
 *
 * @module plugins/preview/schema/node-token
 */

import { decodeNodeToken, tokenFromClassName } from '@/lib/form-model/node-token';
import type { NodeId } from '@/sdk';

export {
  decodeNodeToken,
  encodeNodeToken,
  EMPTY_CLASS,
  NODE_CLASS_PREFIX,
  tokenFromClassName,
} from '@/lib/form-model/node-token';

/**
 * Узел, которому принадлежит элемент DOM, — поиск вверх по предкам.
 *
 * Вверх, потому что клик приходит в самый глубокий элемент, а токен стоит на корне компонента:
 * между ними лежит вся внутренняя разметка контрола, у которой своего адреса нет.
 * Останов на `root` включительно — иначе поиск ушёл бы в оболочку и нашёл бы чужой токен.
 */
export function nodeAt(target: Element | null, root: Element): NodeId | null {
  for (let node: Element | null = target; node !== null; node = node.parentElement) {
    const className = typeof node.className === 'string' ? node.className : '';
    const token = tokenFromClassName(className);
    if (token !== null) {
      const id = decodeNodeToken(token);
      if (id !== null) return id;
    }
    if (node === root) break;
  }
  return null;
}

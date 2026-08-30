/**
 * Подъём от элемента DOM к узлу. Кодек проверяется в домене — `@/lib/form-model/node-token`.
 *
 * @module plugins/preview/node-token.test
 */

import { describe, expect, it } from 'vitest';
import { nodeAt, NODE_CLASS_PREFIX } from './node-token';

/** Минимальный двойник элемента: `nodeAt` ходит только по трём полям. */
function element(className: string, parent: Element | null = null): Element {
  return { className, parentElement: parent } as unknown as Element;
}

describe('nodeAt', () => {
  it('поднимается от цели клика до ближайшего узла с токеном', () => {
    const root = element('root');
    const node = element(`p-2 ${NODE_CLASS_PREFIX}a1b2c3d4`, root);
    const inner = element('label', node);
    expect(nodeAt(inner, root)).toBe('a1b2c3d4');
  });

  it('клик мимо узлов отвечает «здесь узла нет»', () => {
    const root = element('root');
    const inner = element('label', root);
    expect(nodeAt(inner, root)).toBeNull();
  });

  it('поиск останавливается на корне и в оболочку не уходит', () => {
    const outer = element(`${NODE_CLASS_PREFIX}zzzzzzzz`);
    const root = element('root', outer);
    const inner = element('label', root);
    expect(nodeAt(inner, root)).toBeNull();
  });
});

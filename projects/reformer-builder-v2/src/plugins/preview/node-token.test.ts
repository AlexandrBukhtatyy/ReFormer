/**
 * Кодек класс-токена и подъём от элемента DOM к узлу.
 *
 * @module plugins/preview/node-token.test
 */

import { describe, expect, it } from 'vitest';
import {
  decodeNodeToken,
  encodeNodeToken,
  nodeAt,
  NODE_CLASS_PREFIX,
  tokenFromClassName,
} from './node-token';

describe('кодек', () => {
  it('идентификатор оборачивается префиксом и разворачивается обратно', () => {
    const token = encodeNodeToken('a1b2c3d4');
    expect(token).toBe(`${NODE_CLASS_PREFIX}a1b2c3d4`);
    expect(decodeNodeToken(token)).toBe('a1b2c3d4');
  });

  it('чужой класс токеном не считается', () => {
    expect(decodeNodeToken('flex')).toBeNull();
    expect(decodeNodeToken(`${NODE_CLASS_PREFIX}СЛИШКОМ-ДЛИННЫЙ`)).toBeNull();
    expect(decodeNodeToken(NODE_CLASS_PREFIX)).toBeNull();
  });

  it('токен находится среди прочих классов', () => {
    expect(tokenFromClassName(`flex ${NODE_CLASS_PREFIX}a1b2c3d4 gap-2`)).toBe(
      `${NODE_CLASS_PREFIX}a1b2c3d4`
    );
    expect(tokenFromClassName('flex gap-2')).toBeNull();
  });

  it('строка без границы токеном не считается: подстрока чужого класса не адрес', () => {
    expect(tokenFromClassName(`x${NODE_CLASS_PREFIX}a1b2c3d4`)).toBeNull();
  });
});

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

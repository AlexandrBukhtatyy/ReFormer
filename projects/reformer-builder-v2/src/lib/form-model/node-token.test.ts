/**
 * Кодек класс-токена узла.
 *
 * @module reformer-builder/lib/form-model/node-token.test
 */

import { describe, expect, it } from 'vitest';
import {
  decodeNodeToken,
  encodeNodeToken,
  EMPTY_CLASS,
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

  it('класс пустого контейнера не попадает в хит-тест: он про отрисовку, а не про адрес', () => {
    expect(tokenFromClassName(`p-2 ${EMPTY_CLASS}`)).toBeNull();
    expect(EMPTY_CLASS.startsWith(NODE_CLASS_PREFIX)).toBe(false);
  });
});

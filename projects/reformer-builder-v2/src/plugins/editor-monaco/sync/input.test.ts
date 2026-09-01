/**
 * Тесты правила «ввод принадлежит редактору».
 *
 * @module plugins/editor-monaco/sync/input.test
 */

import { describe, expect, it } from 'vitest';
import { shouldStopPropagation } from './input';

describe('shouldStopPropagation', () => {
  it('прячет от глобального слоя то, что Monaco уже обработал', () => {
    expect(shouldStopPropagation({ defaultPrevented: true })).toBe(true);
  });

  it('пропускает наверх непонятное Monaco: `mod+s` обязан дойти до команды сохранения', () => {
    expect(shouldStopPropagation({ defaultPrevented: false })).toBe(false);
  });

  it('во время набора через IME нажатие принадлежит вводу целиком', () => {
    expect(shouldStopPropagation({ defaultPrevented: false, isComposing: true })).toBe(true);
  });

  it('отсутствие признака композиции не считается композицией', () => {
    expect(shouldStopPropagation({ defaultPrevented: false, isComposing: undefined })).toBe(false);
  });
});

/**
 * Тесты реестра фокуса — того самого признака, по которому откладывается перерисовка буфера.
 *
 * @module plugins/editor-monaco/focus.test
 */

import { describe, expect, it } from 'vitest';
import { createFocusRegistry } from './focus';

describe('createFocusRegistry', () => {
  it('без объявления фокуса отвечает «не в фокусе»: документ без редактора перерисовывается', () => {
    expect(createFocusRegistry().isFocused('fs:a.ts')).toBe(false);
  });

  it('помнит фокус по документу, а не «по редактору вообще»', () => {
    const focus = createFocusRegistry();
    focus.setFocused('fs:a.ts', true);
    expect(focus.isFocused('fs:a.ts')).toBe(true);
    expect(focus.isFocused('fs:b.ts')).toBe(false);
  });

  it('снятие фокуса возвращает документ в перерисовываемое состояние', () => {
    const focus = createFocusRegistry();
    focus.setFocused('fs:a.ts', true);
    focus.setFocused('fs:a.ts', false);
    expect(focus.isFocused('fs:a.ts')).toBe(false);
    expect(focus.hasFocus()).toBe(false);
  });

  it('повторное объявление не удваивает запись', () => {
    const focus = createFocusRegistry();
    focus.setFocused('fs:a.ts', true);
    focus.setFocused('fs:a.ts', true);
    focus.setFocused('fs:a.ts', false);
    expect(focus.hasFocus()).toBe(false);
  });
});

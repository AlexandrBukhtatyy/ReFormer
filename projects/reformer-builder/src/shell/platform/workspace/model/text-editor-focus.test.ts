/**
 * Тесты реестра фокуса — того самого признака, по которому откладывается перерисовка буфера.
 *
 * @module shell/platform/workspace/model/text-editor-focus.test
 */

import { describe, expect, it } from 'vitest';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createTextEditorFocusRegistry } from './text-editor-focus';
import { TextEditorFocusToken } from '@reformer/builder-plugin-api/internal';

describe('createTextEditorFocusRegistry', () => {
  it('без объявления фокуса отвечает «не в фокусе»: документ без редактора перерисовывается', () => {
    expect(createTextEditorFocusRegistry().isFocused('fs:a.ts')).toBe(false);
  });

  it('помнит фокус по документу, а не «по редактору вообще»', () => {
    const focus = createTextEditorFocusRegistry();
    focus.setFocused('fs:a.ts', true);
    expect(focus.isFocused('fs:a.ts')).toBe(true);
    expect(focus.isFocused('fs:b.ts')).toBe(false);
  });

  it('снятие фокуса возвращает документ в перерисовываемое состояние', () => {
    const focus = createTextEditorFocusRegistry();
    focus.setFocused('fs:a.ts', true);
    focus.setFocused('fs:a.ts', false);
    expect(focus.isFocused('fs:a.ts')).toBe(false);
    expect(focus.hasFocus()).toBe(false);
  });

  it('повторное объявление не удваивает запись', () => {
    const focus = createTextEditorFocusRegistry();
    focus.setFocused('fs:a.ts', true);
    focus.setFocused('fs:a.ts', true);
    focus.setFocused('fs:a.ts', false);
    expect(focus.hasFocus()).toBe(false);
  });
});

describe('TextEditorFocusToken', () => {
  it('через службу редактор пишет в ТОТ ЖЕ объект, который читает рабочая область', () => {
    // Композиция: один реестр — и в службу, и в `isTextEditorFocused` рабочей области.
    const focus = createTextEditorFocusRegistry();
    const services = createServiceRegistry();
    services.register(TextEditorFocusToken, focus);
    const isTextEditorFocused = (id: string): boolean => focus.isFocused(id);

    // Редактор (любой, в том числе внешний) знает только токен.
    services.require(TextEditorFocusToken).setFocused('fs:a.ts', true);

    expect(isTextEditorFocused('fs:a.ts')).toBe(true);
  });

  it('идентификатор службы — постоянный ключ: по нему её найдёт плагин из каталога', () => {
    // Токен сравнивается по строке, а не по объекту: у внешнего плагина свой экземпляр SDK.
    expect(TextEditorFocusToken.id).toBe('reformer.editor.focus');
  });
});

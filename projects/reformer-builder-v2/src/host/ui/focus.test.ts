import { describe, expect, it } from 'vitest';

import { classifyFocus, type FocusProbe } from './focus';

function probe(patch: Partial<FocusProbe> = {}): FocusProbe {
  return { tagName: 'DIV', type: null, contentEditable: false, zone: null, ...patch };
}

describe('classifyFocus', () => {
  it('без фокуса — none', () => {
    expect(classifyFocus(null)).toBe('none');
  });

  it('текстовый ввод — editable', () => {
    expect(classifyFocus(probe({ tagName: 'TEXTAREA' }))).toBe('editable');
    expect(classifyFocus(probe({ tagName: 'INPUT' }))).toBe('editable');
    expect(classifyFocus(probe({ tagName: 'INPUT', type: 'text' }))).toBe('editable');
    expect(classifyFocus(probe({ contentEditable: true }))).toBe('editable');
  });

  it('незнакомый тип ввода считается текстовым', () => {
    // Список исключений перечисляет то, что вводом не является; всё остальное — ввод.
    // Ошибка в эту сторону означает лишний пропуск сочетания, в обратную — сочетание,
    // сработавшее посреди набора текста.
    expect(classifyFocus(probe({ tagName: 'INPUT', type: 'datetime-local' }))).toBe('editable');
    expect(classifyFocus(probe({ tagName: 'INPUT', type: 'search' }))).toBe('editable');
  });

  it('кнопки и переключатели — control, а не поле ввода и не панель', () => {
    // Разведение с 'panel' несущее: охранное условие «не на кнопке» иначе невыразимо,
    // а в v1 именно оно держало обработчик клавиш нераздельным.
    for (const type of ['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range']) {
      expect(classifyFocus(probe({ tagName: 'INPUT', type }))).toBe('control');
    }
  });

  it('интерактивные теги — control независимо от области', () => {
    for (const tagName of ['BUTTON', 'SELECT', 'OPTION', 'SUMMARY']) {
      expect(classifyFocus(probe({ tagName }))).toBe('control');
      expect(classifyFocus(probe({ tagName, zone: 'canvas' }))).toBe('control');
    }
  });

  it('тег читается без учёта регистра', () => {
    expect(classifyFocus(probe({ tagName: 'textarea' }))).toBe('editable');
    expect(classifyFocus(probe({ tagName: 'input', type: 'TEXT' }))).toBe('editable');
  });

  it('вид области объявляет разметка', () => {
    expect(classifyFocus(probe({ zone: 'canvas' }))).toBe('canvas');
    expect(classifyFocus(probe({ zone: 'tree' }))).toBe('tree');
    expect(classifyFocus(probe({ zone: 'panel' }))).toBe('panel');
  });

  it('незнакомая область — это интерфейс оболочки', () => {
    expect(classifyFocus(probe({ zone: 'что-то своё' }))).toBe('panel');
    expect(classifyFocus(probe({ zone: '' }))).toBe('panel');
  });

  it('элемент вне объявленных областей — none', () => {
    // Намеренно нейтральный тег: BUTTON теперь классифицируется как control до проверки области.
    expect(classifyFocus(probe({ tagName: 'SPAN' }))).toBe('none');
  });

  it('поле ввода внутри канваса остаётся полем ввода', () => {
    // Порядок проверок несущий: иначе стрелки, двигающие узел, двигали бы его во время
    // набора имени.
    expect(classifyFocus(probe({ tagName: 'INPUT', zone: 'canvas' }))).toBe('editable');
    expect(classifyFocus(probe({ contentEditable: true, zone: 'tree' }))).toBe('editable');
  });
});

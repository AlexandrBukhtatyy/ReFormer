import { describe, it, expect } from 'vitest';
import { followFieldFontSize } from './field-font-size';

/**
 * Конвенция ui-kit — тесты без DOM-окружения, поэтому документ здесь двойник: ровно то, что
 * читает ref-колбэк. Что список в настоящем браузере действительно раскрывается размером
 * своего поля, проверяет панель свойств билдера (`InspectorPanel.browser.test`): там и Radix
 * Select, и список на `Popover`, и поле, сжатое классом.
 */

/** Поле с вычисленным размером шрифта. */
function fieldOf(fontSize: string): Element {
  return {
    ownerDocument: { defaultView: { getComputedStyle: () => ({ fontSize }) } },
  } as unknown as Element;
}

/** Список в документе, где запросу отвечают поля из `fields` (ключ — селектор). */
function listOf({
  id,
  fields = {},
  fontSize = '',
}: {
  id: string;
  fields?: Record<string, Element>;
  fontSize?: string;
}): { list: HTMLElement; queries: string[] } {
  const queries: string[] = [];
  const list = {
    id,
    style: { fontSize },
    getRootNode: () => ({
      querySelector: (selector: string) => {
        queries.push(selector);
        return fields[selector] ?? null;
      },
    }),
  };
  return { list: list as unknown as HTMLElement, queries };
}

describe('followFieldFontSize', () => {
  it('список берёт размер шрифта у поля, которое называет его в aria-controls', () => {
    const { list } = listOf({
      id: 'radix-_r_1_',
      fields: { '[aria-controls~="radix-_r_1_"]': fieldOf('12px') },
    });

    followFieldFontSize(list);

    expect(list.style.fontSize).toBe('12px');
  });

  it('адрес с двоеточиями (useId в React 18) уходит в запрос как есть', () => {
    const { list, queries } = listOf({
      id: 'radix-:r1:',
      fields: { '[aria-controls~="radix-:r1:"]': fieldOf('16px') },
    });

    followFieldFontSize(list);

    expect(queries).toEqual(['[aria-controls~="radix-:r1:"]']);
    expect(list.style.fontSize).toBe('16px');
  });

  it('кавычка и обратная черта в адресе экранируются — запрос остаётся разборным', () => {
    const { list, queries } = listOf({ id: 'a"b\\c' });

    followFieldFontSize(list);

    expect(queries).toEqual(['[aria-controls~="a\\"b\\\\c"]']);
  });

  it('поле не нашлось — размер остаётся за классом списка', () => {
    const { list } = listOf({ id: 'radix-_r_1_' });

    followFieldFontSize(list);

    expect(list.style.fontSize).toBe('');
  });

  it('список без адреса поле не ищет', () => {
    const { list, queries } = listOf({ id: '' });

    followFieldFontSize(list);

    expect(queries).toEqual([]);
    expect(list.style.fontSize).toBe('');
  });

  it('размер, заданный списку явно, не перебивается', () => {
    const { list, queries } = listOf({
      id: 'radix-_r_1_',
      fontSize: '20px',
      fields: { '[aria-controls~="radix-_r_1_"]': fieldOf('12px') },
    });

    followFieldFontSize(list);

    expect(queries).toEqual([]);
    expect(list.style.fontSize).toBe('20px');
  });

  it('исчезновение списка (null) — не ошибка', () => {
    expect(() => followFieldFontSize(null)).not.toThrow();
  });
});

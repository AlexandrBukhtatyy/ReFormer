import { describe, it, expect, vi } from 'vitest';
import { makeElementFieldHandle } from './field-handle';

describe('makeElementFieldHandle', () => {
  it('делегирует focus/blur/scrollIntoView на DOM-элемент по ссылке', () => {
    const el = { focus: vi.fn(), blur: vi.fn(), scrollIntoView: vi.fn() };
    const handle = makeElementFieldHandle({ current: el as unknown as HTMLElement });

    handle.focus();
    handle.blur();
    const opts = { behavior: 'smooth', block: 'center' } as const;
    handle.scrollIntoView(opts);

    expect(el.focus).toHaveBeenCalledOnce();
    expect(el.blur).toHaveBeenCalledOnce();
    expect(el.scrollIntoView).toHaveBeenCalledWith(opts);
    expect(handle.getElement()).toBe(el);
  });

  it('null current — вызовы безопасны (no-op), getElement === null', () => {
    const handle = makeElementFieldHandle({ current: null });

    expect(() => {
      handle.focus();
      handle.blur();
      handle.scrollIntoView();
    }).not.toThrow();
    expect(handle.getElement()).toBeNull();
  });
});

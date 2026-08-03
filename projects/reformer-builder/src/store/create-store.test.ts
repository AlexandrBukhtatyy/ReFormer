import { describe, expect, it, vi } from 'vitest';
import { createStore } from './create-store';

describe('createStore', () => {
  it('getState / setState (значение и updater)', () => {
    const s = createStore({ n: 0 });
    s.setState({ n: 1 });
    expect(s.getState().n).toBe(1);
    s.setState((p) => ({ n: p.n + 1 }));
    expect(s.getState().n).toBe(2);
  });

  it('subscribe вызывается при изменении', () => {
    const s = createStore(0);
    const l = vi.fn();
    s.subscribe(l);
    s.setState(1);
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('не уведомляет, если ссылка не изменилась', () => {
    const obj = { n: 0 };
    const s = createStore(obj);
    const l = vi.fn();
    s.subscribe(l);
    s.setState(obj);
    expect(l).not.toHaveBeenCalled();
  });

  it('unsubscribe', () => {
    const s = createStore(0);
    const l = vi.fn();
    const un = s.subscribe(l);
    un();
    s.setState(1);
    expect(l).not.toHaveBeenCalled();
  });
});

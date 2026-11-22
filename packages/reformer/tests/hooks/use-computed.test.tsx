// @vitest-environment happy-dom
/**
 * `useComputed` — селектор над сигналами и моделями [ReFormer-lywn.2].
 *
 * Компонент перерисовывается, только когда меняется результат селектора: правка соседней строки
 * модели или поля, которое селектор не читает, рендер не будит. `isEqual` гасит новые ссылки на
 * равные объекты, `deps` пересоздают вычисление при смене значений из рендера.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { signal } from '@preact/signals-core';
import { createModel, shallowEqual } from '../../src/model/index';
import { useComputed } from '../../src/platforms/react/hooks/useComputed';
import { act, cleanup, renderHookCounting } from '../test-utils/react';

afterEach(cleanup);

interface Item {
  id: string;
  title: string;
  qty: number;
}

function createCart() {
  return createModel<{ items: Item[]; coupon: string }>({
    items: [
      { id: 'a', title: 'Книга', qty: 1 },
      { id: 'b', title: 'Ручка', qty: 2 },
    ],
    coupon: '',
  });
}

describe('useComputed', () => {
  it('примитив: перерисовка только при смене результата', () => {
    const cart = createCart();
    const hook = renderHookCounting(() =>
      useComputed(() => cart.$.items.value.reduce((sum, i) => sum + i.qty, 0))
    );
    expect(hook.result.current).toBe(3);
    const before = hook.renders();

    act(() => {
      cart.coupon = 'SALE'; // селектор купон не читает
      cart.items.at(0)!.title = 'Тетрадь'; // сумма количеств не изменилась
    });
    expect(hook.renders()).toBe(before);

    act(() => {
      cart.items.at(1)!.qty = 5;
    });
    expect(hook.result.current).toBe(6);
    expect(hook.renders()).toBe(before + 1);
  });

  it('isEqual: равный объект — прежняя ссылка и нет перерисовки', () => {
    const cart = createCart();
    const hook = renderHookCounting(() =>
      useComputed(() => cart.$.items.value.find((i) => i.id === 'a'), [], shallowEqual)
    );
    const first = hook.result.current;
    expect(first).toEqual({ id: 'a', title: 'Книга', qty: 1 });
    const before = hook.renders();

    act(() => {
      cart.items.at(1)!.qty = 10; // чужая строка: снимок массива новый, строка a — равная
    });
    expect(hook.renders()).toBe(before);
    expect(hook.result.current).toBe(first);

    act(() => {
      cart.items.at(0)!.qty = 4;
    });
    expect(hook.result.current).toEqual({ id: 'a', title: 'Книга', qty: 4 });
    expect(hook.renders()).toBe(before + 1);
  });

  it('без isEqual новый объект на каждый пересчёт — перерисовка', () => {
    const cart = createCart();
    const hook = renderHookCounting(() =>
      useComputed(() => cart.$.items.value.find((i) => i.id === 'a'))
    );
    const before = hook.renders();
    act(() => {
      cart.items.at(1)!.qty = 10;
    });
    expect(hook.renders()).toBe(before + 1);
  });

  it('deps: смена значения из рендера пересоздаёт вычисление', () => {
    const cart = createCart();
    const hook = renderHookCounting(
      ({ id }: { id: string }) =>
        useComputed(() => cart.$.items.value.find((i) => i.id === id)?.title, [id]),
      { initialProps: { id: 'a' } }
    );
    expect(hook.result.current).toBe('Книга');
    hook.rerender({ id: 'b' });
    expect(hook.result.current).toBe('Ручка');
  });

  it('StrictMode: значение и реакция на изменения те же', () => {
    const count = signal(1);
    const hook = renderHookCounting(() => useComputed(() => count.value * 2), { strict: true });
    expect(hook.result.current).toBe(2);
    act(() => {
      count.value = 4;
    });
    expect(hook.result.current).toBe(8);
  });

  it('после размонтирования изменения не будят компонент', () => {
    const count = signal(1);
    const hook = renderHookCounting(() => useComputed(() => count.value));
    const before = hook.renders();
    hook.unmount();
    act(() => {
      count.value = 2;
    });
    expect(hook.renders()).toBe(before);
  });
});

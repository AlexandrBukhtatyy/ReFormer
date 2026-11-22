// @vitest-environment happy-dom
/**
 * `useSignalSnapshot` — значение произвольного сигнала в компоненте [ReFormer-7ec].
 *
 * Раньше хука не было, и документация писала его руками на `useSyncExternalStore` (индикация
 * отправки, чтение группы модели). Хук перерисовывает компонент при смене сигнала, понимает
 * `computed`, переносит подписку при смене сигнала и снимает её при размонтировании.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, signal } from '@preact/signals-core';
import { createModel } from '../../src/model/index';
import { useSignalSnapshot } from '../../src/platforms/react/hooks/useSignalSnapshot';
import { act, cleanup, render, screen } from '../test-utils/react';

afterEach(cleanup);

describe('useSignalSnapshot', () => {
  it('перерисовывает компонент при смене сигнала и computed', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    function View() {
      return (
        <span data-testid="out">
          {useSignalSnapshot(count)}:{useSignalSnapshot(doubled)}
        </span>
      );
    }

    render(<View />);
    expect(screen.getByTestId('out').textContent).toBe('1:2');

    act(() => {
      count.value = 5;
    });
    expect(screen.getByTestId('out').textContent).toBe('5:10');
  });

  it('читает группу модели целиком', () => {
    const model = createModel<{ address: { city: string } }>({ address: { city: 'Москва' } });
    function City() {
      return <span data-testid="city">{useSignalSnapshot(model.$.address).city}</span>;
    }

    render(<City />);
    act(() => {
      model.address.city = 'Казань';
    });
    expect(screen.getByTestId('city').textContent).toBe('Казань');
  });

  it('смена сигнала переносит подписку; после размонтирования запись не будит компонент', () => {
    const a = signal('a');
    const b = signal('b');
    const rendered = vi.fn();
    function View({ source }: { source: typeof a }) {
      rendered();
      return <span data-testid="v">{useSignalSnapshot(source)}</span>;
    }

    const { rerender, unmount } = render(<View source={a} />);
    rerender(<View source={b} />);
    expect(screen.getByTestId('v').textContent).toBe('b');

    const before = rendered.mock.calls.length;
    act(() => {
      a.value = 'a2'; // старый сигнал больше не подписан
    });
    expect(rendered).toHaveBeenCalledTimes(before);

    act(() => {
      b.value = 'b2';
    });
    expect(screen.getByTestId('v').textContent).toBe('b2');

    unmount();
    const afterUnmount = rendered.mock.calls.length;
    b.value = 'b3';
    expect(rendered).toHaveBeenCalledTimes(afterUnmount);
  });
});

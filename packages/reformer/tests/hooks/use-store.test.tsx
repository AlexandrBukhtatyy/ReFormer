// @vitest-environment happy-dom
/**
 * `useStore` — стор, которым владеет компонент [ReFormer-lywn.2].
 *
 * Фабрика вызывается один раз; при размонтировании стор снимается (его реакции перестают
 * работать); StrictMode, который снимает и тут же ставит эффекты заново, стор не убивает.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModel, createStore, computeFrom } from '../../src/model/index';
import { useStore } from '../../src/platforms/react/hooks/useStore';
import { useComputed } from '../../src/platforms/react/hooks/useComputed';
import { act, cleanup, renderHookCounting } from '../test-utils/react';
import { settle } from '../test-utils/async';

afterEach(cleanup);

function createCounter(onDispose = vi.fn()) {
  return createStore((scope) => {
    const model = createModel({ count: 1, doubled: 0 });
    computeFrom([model.$.count], model.$.doubled, (c) => c * 2);
    scope.add(onDispose);
    return { model };
  });
}

describe('useStore', () => {
  it('фабрика — один раз; ререндер отдаёт тот же стор', () => {
    const factory = vi.fn(() => createCounter());
    const hook = renderHookCounting(() => useStore(factory));
    const first = hook.result.current;
    hook.rerender();
    hook.rerender();
    expect(hook.result.current).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('размонтирование снимает стор после коммита', async () => {
    const onDispose = vi.fn();
    const hook = renderHookCounting(() => useStore(() => createCounter(onDispose)));
    const { model } = hook.result.current;

    hook.unmount();
    await settle();
    expect(onDispose).toHaveBeenCalledTimes(1);

    model.count = 5;
    expect(model.doubled).toBe(2); // реакция снята вместе со стором
  });

  it('StrictMode: повторный монтаж не убивает стор', async () => {
    const onDispose = vi.fn();
    const hook = renderHookCounting(() => useStore(() => createCounter(onDispose)), {
      strict: true,
    });
    await settle();
    const { model } = hook.result.current;
    expect(onDispose).not.toHaveBeenCalled();

    model.count = 4;
    expect(model.doubled).toBe(8);

    hook.unmount();
    await settle();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('вместе с useComputed: компонент видит изменения стора', () => {
    const hook = renderHookCounting(() => {
      const store = useStore(() => createCounter());
      return { store, doubled: useComputed(() => store.model.$.doubled.value, [store]) };
    });
    expect(hook.result.current.doubled).toBe(2);
    act(() => {
      hook.result.current.store.model.count = 3;
    });
    expect(hook.result.current.doubled).toBe(6);
  });
});

// @vitest-environment happy-dom
/**
 * `useSignalSubscription` — общий движок `useFormControl`: один effect на набор сигналов и кэш
 * снапшота для `useSyncExternalStore`.
 *
 * Проверяется на голых сигналах, без нод формы: кэш отдаёт тот же объект, пока значения из
 * `configs` не изменились (массивы — поэлементно при `useShallowArrayEqual`), а ререндер
 * происходит только при реальной смене. Ключ подписки — единственный повод пересоздать effect:
 * свежий объект `signals` на каждом рендере переподписки не даёт, смена ключа переносит подписку
 * на новые сигналы. StrictMode оставляет один effect, размонтирование его снимает.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import {
  useSignalSubscription,
  type SignalConfig,
  type SignalMap,
} from '../../src/platforms/react/hooks/useSignalSubscription';
import { act, cleanup, renderHookCounting } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';

/**
 * Счётчик созданных effect'ов. `liveEffects` пересоздание подписки не видит (минус один, плюс
 * один), а «ключ не сменился — effect не пересоздаётся» проверяется именно числом созданий.
 */
const created = vi.hoisted(() => ({ effects: 0 }));

vi.mock('@preact/signals-core', async (importOriginal) => {
  const signals = (await import('../test-utils/effect-tracker')).trackEffects(
    await importOriginal()
  );
  const effect: typeof signals.effect = (fn, options) => {
    created.effects++;
    return signals.effect(fn, options);
  };
  return { ...signals, effect };
});

afterEach(cleanup);

type Values = Record<string, unknown>;

interface Props {
  signals: SignalMap;
  configs: SignalConfig<string>[];
  build: (values: Values) => Values;
  subscriptionKey?: unknown;
}

const copy = (values: Values): Values => ({ ...values });

const renderSubscription = (props: Props, strict = false) =>
  renderHookCounting(
    (p: Props) => useSignalSubscription(p.signals, p.configs, p.build, p.subscriptionKey),
    { initialProps: props, strict }
  );

describe('useSignalSubscription — снапшот и кэш', () => {
  it('первый рендер строит снапшот из текущих значений', () => {
    const build = vi.fn(copy);
    const signals = { a: signal(1), b: signal('x') };

    const hook = renderSubscription({
      signals,
      configs: [{ key: 'a' }, { key: 'b' }],
      build,
      subscriptionKey: signals,
    });

    expect(hook.result.current).toEqual({ a: 1, b: 'x' });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('ререндер без смены значений отдаёт тот же объект и не строит снапшот заново', () => {
    const build = vi.fn(copy);
    const signals = { a: signal(1) };
    const props: Props = { signals, configs: [{ key: 'a' }], build, subscriptionKey: signals };
    const hook = renderSubscription(props);
    const snapshot = hook.result.current;

    hook.rerender({ ...props });

    expect(hook.result.current).toBe(snapshot);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('смена значения из configs — новый снапшот и один ререндер', () => {
    const signals = { a: signal(1), b: signal(2) };
    const hook = renderSubscription({
      signals,
      configs: [{ key: 'a' }, { key: 'b' }],
      build: copy,
      subscriptionKey: signals,
    });
    const before = hook.renders();

    act(() => {
      signals.b.value = 3;
    });

    expect(hook.result.current).toEqual({ a: 1, b: 3 });
    expect(hook.renders()).toBe(before + 1);
  });

  it('useShallowArrayEqual: новый массив с теми же элементами — тот же снапшот', () => {
    const item = { code: 'required' };
    const signals = { list: signal<unknown[]>([item]) };
    const hook = renderSubscription({
      signals,
      configs: [{ key: 'list', useShallowArrayEqual: true }],
      build: copy,
      subscriptionKey: signals,
    });
    const snapshot = hook.result.current;
    const before = hook.renders();

    act(() => {
      signals.list.value = [item];
    });

    expect(hook.result.current).toBe(snapshot);
    expect(hook.renders()).toBe(before);
  });

  it('useShallowArrayEqual: другая длина или другой элемент — новый снапшот', () => {
    const signals = { list: signal<unknown[]>(['a']) };
    const hook = renderSubscription({
      signals,
      configs: [{ key: 'list', useShallowArrayEqual: true }],
      build: copy,
      subscriptionKey: signals,
    });

    act(() => {
      signals.list.value = ['a', 'b'];
    });
    expect(hook.result.current).toEqual({ list: ['a', 'b'] });

    act(() => {
      signals.list.value = ['a', 'c'];
    });
    expect(hook.result.current).toEqual({ list: ['a', 'c'] });
  });

  it('useShallowArrayEqual: тот же массив — сравнение идёт дальше по configs', () => {
    const list = ['a'];
    const signals = { list: signal<unknown[]>(list), flag: signal(false) };
    const hook = renderSubscription({
      signals,
      configs: [{ key: 'list', useShallowArrayEqual: true }, { key: 'flag' }],
      build: copy,
      subscriptionKey: signals,
    });

    act(() => {
      signals.flag.value = true;
    });

    expect(hook.result.current).toEqual({ list, flag: true });
    expect(hook.result.current.list).toBe(list);
  });

  // поведение под вопросом [ReFormer-0f7y]: сигнал вне `configs` подписан effect'ом (будит его впустую), но
  // снапшот по нему не пересобирается — в снапшоте остаётся прежнее значение, пока не сменится
  // ключ из `configs`. `useFormControl` перечисляет в `configs` все сигналы, поэтому снаружи
  // это не видно.
  it('сигнал вне configs снапшот не обновляет до смены ключа из configs', () => {
    const signals = { tracked: signal(1), extra: signal('old') };
    const hook = renderSubscription({
      signals,
      configs: [{ key: 'tracked' }],
      build: copy,
      subscriptionKey: signals,
    });
    const before = hook.renders();

    act(() => {
      signals.extra.value = 'new';
    });
    expect(hook.renders()).toBe(before);
    expect(hook.result.current).toEqual({ tracked: 1, extra: 'old' });

    act(() => {
      signals.tracked.value = 2;
    });
    expect(hook.result.current).toEqual({ tracked: 2, extra: 'new' });
  });
});

describe('useSignalSubscription — ключ подписки', () => {
  it('свежий объект signals с тем же ключом не пересоздаёт effect', () => {
    const a = signal(1);
    const key = {};
    const hook = renderSubscription({
      signals: { a },
      configs: [{ key: 'a' }],
      build: copy,
      subscriptionKey: key,
    });
    const subscribed = liveEffects();
    const createdBefore = created.effects;

    for (let i = 0; i < 5; i++) {
      hook.rerender({ signals: { a }, configs: [{ key: 'a' }], build: copy, subscriptionKey: key });
    }

    expect(created.effects).toBe(createdBefore);
    expect(liveEffects()).toBe(subscribed);
    act(() => {
      a.value = 2;
    });
    expect(hook.result.current).toEqual({ a: 2 });
  });

  it('смена ключа переносит подписку на новые сигналы, старые компонент не будят', () => {
    const first = { a: signal('первый') };
    const second = { a: signal('второй') };
    const hook = renderSubscription({
      signals: first,
      configs: [{ key: 'a' }],
      build: copy,
      subscriptionKey: first,
    });
    const subscribed = liveEffects();
    const createdBefore = created.effects;

    hook.rerender({
      signals: second,
      configs: [{ key: 'a' }],
      build: copy,
      subscriptionKey: second,
    });
    expect(hook.result.current).toEqual({ a: 'второй' });
    // Новый effect создан, прежний снят.
    expect(created.effects).toBe(createdBefore + 1);
    expect(liveEffects()).toBe(subscribed);

    const before = hook.renders();
    act(() => {
      first.a.value = 'старый';
    });
    expect(hook.renders()).toBe(before);

    act(() => {
      second.a.value = 'новый';
    });
    expect(hook.result.current).toEqual({ a: 'новый' });
  });

  // Контракт: ключ обязан меняться вместе с сигналами. Без смены ключа effect держит прежние
  // сигналы, пока один из них не сработает и effect не перечитает актуальный набор.
  it('подмена сигналов без смены ключа: новые сигналы не будят, пока не сработает старый', () => {
    const key = {};
    const first = { a: signal(1) };
    const second = { a: signal(10) };
    const hook = renderSubscription({
      signals: first,
      configs: [{ key: 'a' }],
      build: copy,
      subscriptionKey: key,
    });

    hook.rerender({ signals: second, configs: [{ key: 'a' }], build: copy, subscriptionKey: key });
    expect(hook.result.current).toEqual({ a: 10 });

    const before = hook.renders();
    act(() => {
      second.a.value = 11;
    });
    expect(hook.renders()).toBe(before);

    act(() => {
      first.a.value = 2;
    });
    expect(hook.result.current).toEqual({ a: 11 });
  });

  // Кэш снапшота переживает смену ключа: новый getSnapshot сравнивает значения нового набора с
  // кэшем прежнего. Если сравнивать нечего (`configs` пуст — ветка `useFormControl(undefined)`),
  // изменений «нет» и наружу уходит снапшот прежнего ключа.
  it('смена ключа на пустой набор — снапшот строится заново [ReFormer-peaw]', () => {
    const first = { a: signal('прежний') };
    const hook = renderSubscription({
      signals: first,
      configs: [{ key: 'a' }],
      build: copy,
      subscriptionKey: first,
    });

    hook.rerender({
      signals: {},
      configs: [],
      build: () => ({ empty: true }),
      subscriptionKey: 'пусто',
    });

    expect(hook.result.current).toEqual({ empty: true });
  });
});

describe('useSignalSubscription — StrictMode', () => {
  it('двойной эффект оставляет один effect, снапшот обновляется', () => {
    const signals = { a: signal(1) };
    const base = liveEffects();
    const hook = renderSubscription(
      { signals, configs: [{ key: 'a' }], build: copy, subscriptionKey: signals },
      true
    );
    expect(liveEffects()).toBe(base + 1);

    act(() => {
      signals.a.value = 2;
    });
    expect(hook.result.current).toEqual({ a: 2 });

    hook.unmount();
    expect(liveEffects()).toBe(base);
  });
});

describe('useSignalSubscription — размонтирование', () => {
  it('effect снят, смена сигналов не перерисовывает', () => {
    const signals = { a: signal(1) };
    const base = liveEffects();
    const hook = renderSubscription({
      signals,
      configs: [{ key: 'a' }],
      build: copy,
      subscriptionKey: signals,
    });
    expect(liveEffects()).toBe(base + 1);

    hook.unmount();
    const after = hook.renders();
    act(() => {
      signals.a.value = 2;
    });

    expect(hook.renders()).toBe(after);
    expect(liveEffects()).toBe(base);
  });

  it('пустой набор без ключа: effect тоже снимается', () => {
    const base = liveEffects();
    const hook = renderSubscription({ signals: {}, configs: [], build: () => ({ empty: true }) });
    expect(hook.result.current).toEqual({ empty: true });
    expect(liveEffects()).toBe(base + 1);

    hook.unmount();
    expect(liveEffects()).toBe(base);
  });
});

// @vitest-environment happy-dom
/**
 * `useFormFlow` в DOM: снимок сигналов потока шагов для рендера визарда.
 *
 * Компонент перерисовывается при смене шага, пройденных шагов и состояния проверки шага — и только
 * при них: правка полей формы и ререндер родителя отдают тот же объект снимка. Проверка шага в
 * `next()` видна признаком `validating` на всё время прогона. Подмена потока переносит подписку,
 * StrictMode оставляет один effect, размонтирование его снимает.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFormFlow, type FormFlow } from '../../src/form/flow/flow';
import { createForm } from '../../src/form/form-bundle';
import type { ValidationResult } from '../../src/form/validation/types';
import { useFormFlow } from '../../src/platforms/react/hooks/use-form-flow';
import { act, cleanup, renderHookCounting } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';
import { deferred } from '../test-utils/async';

/**
 * Счётчик созданных effect'ов: `liveEffects` пересоздание подписки на каждом рендере не видит
 * (минус один, плюс один) — его ловит только число созданий.
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

const STEPS = ['loan', 'contacts', 'confirm'];

const VALID: ValidationResult = { status: 'valid', issues: new Map(), failures: [] };

const renderFlow = (flow: FormFlow, strict = false) =>
  renderHookCounting((props: { flow: FormFlow }) => useFormFlow(props.flow), {
    initialProps: { flow },
    strict,
  });

describe('useFormFlow — снимок потока', () => {
  it('первый кадр: первый шаг, пройденных нет', () => {
    const hook = renderFlow(createFormFlow({ steps: STEPS }));

    expect(hook.result.current).toEqual({
      current: 'loan',
      index: 0,
      completed: new Set(),
      isFirst: true,
      isLast: false,
      validating: false,
    });
  });

  it('next: шаг и пройденные в снимке, один ререндер на переход', async () => {
    const flow = createFormFlow({ steps: STEPS });
    const hook = renderFlow(flow);
    const before = hook.renders();

    await act(async () => {
      await flow.next();
    });

    expect(hook.renders()).toBe(before + 1);
    expect(hook.result.current).toMatchObject({ current: 'contacts', index: 1, isFirst: false });
    expect([...hook.result.current.completed]).toEqual(['loan']);
  });

  it('previous, goTo и reset — снимок следует за потоком', async () => {
    const flow = createFormFlow({ steps: STEPS });
    const hook = renderFlow(flow);
    await act(async () => {
      await flow.next();
      await flow.next();
    });
    expect(hook.result.current).toMatchObject({ current: 'confirm', isLast: true });

    act(() => void flow.previous());
    expect(hook.result.current).toMatchObject({ current: 'contacts', isLast: false });
    expect([...hook.result.current.completed]).toEqual(['loan']);

    act(() => void flow.goTo('loan'));
    expect(hook.result.current).toMatchObject({ current: 'loan', isFirst: true });

    act(() => flow.reset());
    expect(hook.result.current.completed.size).toBe(0);
  });

  it('проверка шага: validating виден на всё время прогона', async () => {
    const check = deferred<ValidationResult>();
    const flow = createFormFlow({ steps: STEPS, validateStep: () => check.promise });
    const hook = renderFlow(flow);

    let transition: ReturnType<FormFlow['next']> | undefined;
    act(() => {
      transition = flow.next();
    });
    expect(hook.result.current).toMatchObject({ current: 'loan', validating: true });

    await act(async () => {
      check.resolve(VALID);
      await transition;
    });
    expect(hook.result.current).toMatchObject({ current: 'contacts', validating: false });
  });

  it('next на последнем шаге: шаг пройден без перехода — новый снимок', async () => {
    const flow = createFormFlow({ steps: ['only'] });
    const hook = renderFlow(flow);
    const snapshot = hook.result.current;

    await act(async () => {
      await flow.next();
    });

    expect(hook.result.current).not.toBe(snapshot);
    expect(hook.result.current).toMatchObject({ current: 'only', index: 0, isLast: true });
    expect([...hook.result.current.completed]).toEqual(['only']);
  });

  it('ререндер родителя без изменений: тот же объект снимка, подписка не пересоздана', () => {
    const flow = createFormFlow({ steps: STEPS });
    const hook = renderFlow(flow);
    const snapshot = hook.result.current;
    const createdBefore = created.effects;

    for (let i = 0; i < 5; i++) hook.rerender({ flow });

    expect(hook.result.current).toBe(snapshot);
    expect(created.effects).toBe(createdBefore);
  });

  it('переход на текущий шаг ничего не меняет — ререндера нет', () => {
    const flow = createFormFlow({ steps: STEPS });
    const hook = renderFlow(flow);
    const before = hook.renders();

    act(() => void flow.goTo('loan'));

    expect(hook.renders()).toBe(before);
  });

  it('правка полей формы поток не трогает — ререндера нет', () => {
    const bundle = createForm<{ amount: number; email: string }>({
      initial: { amount: 0, email: '' },
      flow: { steps: [{ id: 'loan' }, { id: 'contacts' }] },
    });
    const hook = renderFlow(bundle.flow!);
    const before = hook.renders();

    act(() => {
      bundle.form.amount.setValue(100);
      bundle.model.email = 'a@b.c';
      bundle.form.email.markAsTouched();
    });

    expect(hook.renders()).toBe(before);
  });
});

describe('useFormFlow — подмена потока', () => {
  it('другой поток — снимок нового, старый компонент не будит', async () => {
    const first = createFormFlow({ steps: STEPS });
    const second = createFormFlow({ steps: ['a', 'b'] });
    const hook = renderFlow(first);
    const subscribed = liveEffects();
    const createdBefore = created.effects;

    hook.rerender({ flow: second });
    expect(hook.result.current).toMatchObject({ current: 'a', index: 0 });
    expect(created.effects).toBe(createdBefore + 1);
    expect(liveEffects()).toBe(subscribed);

    const before = hook.renders();
    await act(async () => {
      await first.next();
    });
    expect(hook.renders()).toBe(before);

    await act(async () => {
      await second.next();
    });
    expect(hook.result.current).toMatchObject({ current: 'b', isLast: true });
  });

  it('поток с теми же шагами на той же позиции — снимок нового потока', () => {
    const first = createFormFlow({ steps: STEPS });
    const second = createFormFlow({ steps: STEPS });
    const hook = renderFlow(first);
    const snapshot = hook.result.current;

    hook.rerender({ flow: second });

    expect(hook.result.current).not.toBe(snapshot);
    expect(hook.result.current.completed).toBe(second.completed.value);
  });
});

describe('useFormFlow — StrictMode', () => {
  it('двойной эффект оставляет один effect, переходы видны', async () => {
    const flow = createFormFlow({ steps: STEPS });
    const base = liveEffects();
    const hook = renderFlow(flow, true);
    expect(liveEffects()).toBe(base + 1);

    await act(async () => {
      await flow.next();
    });
    expect(hook.result.current.current).toBe('contacts');

    hook.unmount();
    expect(liveEffects()).toBe(base);
  });
});

describe('useFormFlow — размонтирование', () => {
  it('effect снят, переходы не перерисовывают', async () => {
    const flow = createFormFlow({ steps: STEPS });
    const base = liveEffects();
    const hook = renderFlow(flow);
    expect(liveEffects()).toBe(base + 1);

    hook.unmount();
    const after = hook.renders();
    await act(async () => {
      await flow.next();
    });

    expect(hook.renders()).toBe(after);
    expect(liveEffects()).toBe(base);
  });
});

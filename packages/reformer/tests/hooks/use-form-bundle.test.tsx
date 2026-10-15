// @vitest-environment happy-dom
/**
 * `useFormBundle` в DOM: сборка формы один раз на жизнь компонента и арминг живой валидации.
 *
 * Фабрика вызывается ленивым инициализатором `useState` — ререндеры и новая фабрика бандл не
 * пересобирают, а значит, введённое не теряется. Контроллер живой проверки армируется в эффекте и
 * снимается при размонтировании; перемонтирование по ключу собирает новый бандл. Сам хук ни на
 * что не подписан: записи в модель его компонент не перерисовывают.
 *
 * Размонтирование снимает и саму сборку — поведение формы, подписки нод (ReFormer-8el5). Снятие
 * идёт микрозадачей после коммита: StrictMode монтирует эффекты повторно над той же сборкой, и
 * синхронный `dispose()` снял бы живую форму.
 */

import { Activity, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForm, type FormBundle } from '../../src/form/form-bundle';
import { compute, defineFormBehavior } from '../../src/form/behaviors';
import { defineValidation, validate } from '../../src/form/validation';
import type { ValidationStrategyKind } from '../../src/form/validation/strategy';
import type { ValidationIssue } from '../../src/form/types/index';
import { useFormBundle } from '../../src/platforms/react/hooks/use-form-bundle';
import { act, cleanup, render, renderHookCounting } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';
import { settle } from '../test-utils/async';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(cleanup);

interface Order {
  price: number;
  qty: number;
  total: number;
  email: string;
}

const INITIAL: Order = { price: 1, qty: 1, total: 1, email: '' };

/** Фабрика заказа: правило почты со счётчиком прогонов, по желанию — стратегия и `compute`. */
function orderFactory(options: { strategy?: ValidationStrategyKind; behavior?: boolean } = {}) {
  const rule = vi.fn((value: string): ValidationIssue | null =>
    value ? null : { code: 'required' }
  );
  const rules = defineValidation<Order>(({ model }) => {
    validate(model.$.email, [rule]);
  });
  const behavior = defineFormBehavior<Order>(({ model }) => {
    compute(model.$.total, () => model.price * model.qty);
  });
  const factory = vi.fn(
    (): FormBundle<Order> =>
      createForm<Order>({
        initial: { ...INITIAL },
        validation: { rules, strategy: options.strategy ?? 'change' },
        ...(options.behavior ? { behavior } : {}),
      })
  );
  return { factory, rule };
}

const renderBundle = (factory: () => FormBundle<Order>, strict = false) =>
  renderHookCounting(
    (props: { factory: () => FormBundle<Order> }) => useFormBundle(props.factory),
    {
      initialProps: { factory },
      strict,
    }
  );

describe('useFormBundle — стабильность бандла', () => {
  it('фабрика вызывается один раз, бандл тот же между рендерами', () => {
    const { factory } = orderFactory();
    const hook = renderBundle(factory);
    const bundle = hook.result.current;

    hook.rerender({ factory });
    hook.rerender({ factory });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toBe(bundle);
    expect(bundle).toBe(factory.mock.results[0].value);
  });

  it('новая фабрика при ререндере не вызывается — введённое сохраняется', () => {
    const first = orderFactory();
    const second = orderFactory();
    const hook = renderBundle(first.factory);
    act(() => hook.result.current.form.email.setValue('a@b.c'));

    hook.rerender({ factory: second.factory });

    expect(second.factory).not.toHaveBeenCalled();
    expect(hook.result.current.model.email).toBe('a@b.c');
  });

  it('хук ни на что не подписан: записи в модель компонент не перерисовывают', async () => {
    const { factory } = orderFactory({ strategy: 'submit' });
    const hook = renderBundle(factory);
    const before = hook.renders();

    await act(async () => {
      hook.result.current.model.email = 'x';
      hook.result.current.form.email.markAsTouched();
      await hook.result.current.validate();
    });

    expect(hook.renders()).toBe(before);
  });
});

describe('useFormBundle — живая валидация', () => {
  it('после монтирования контроллер армирован: запись в модель запускает прогон', async () => {
    const { factory, rule } = orderFactory({ strategy: 'change' });
    const hook = renderBundle(factory);

    await act(async () => {
      hook.result.current.model.email = 'x';
      await settle();
    });

    expect(rule).toHaveBeenCalledTimes(1);
  });

  it('без правил контроллера нет — монтирование и размонтирование проходят', () => {
    const factory = vi.fn(() => createForm<Order>({ initial: { ...INITIAL } }));
    const base = liveEffects();
    const hook = renderHookCounting(() => useFormBundle(factory));

    expect(hook.result.current.validation).toBeUndefined();
    expect(liveEffects()).toBe(base);
    hook.unmount();
    expect(liveEffects()).toBe(base);
  });

  it('стратегия submit: контроллер есть, подписок стратегии нет', () => {
    const { factory } = orderFactory({ strategy: 'submit' });
    const base = liveEffects();
    const hook = renderBundle(factory);

    expect(hook.result.current.validation?.controller).toBeDefined();
    expect(liveEffects()).toBe(base);
  });
});

describe('useFormBundle — перемонтирование', () => {
  it('новый ключ — новый бандл; прежний контроллер снят, новый армирован', async () => {
    const first = orderFactory();
    const second = orderFactory();
    const bundles: FormBundle<Order>[] = [];
    function Probe({ factory }: { factory: () => FormBundle<Order> }) {
      bundles.push(useFormBundle(factory));
      return null;
    }
    const view = render(<Probe key="first" factory={first.factory} />);
    const base = liveEffects();

    view.rerender(<Probe key="second" factory={second.factory} />);
    expect(second.factory).toHaveBeenCalledTimes(1);
    expect(bundles.at(-1)).not.toBe(bundles[0]);
    expect(liveEffects()).toBe(base);

    await act(async () => {
      bundles[0].model.email = 'старый';
      bundles.at(-1)!.model.email = 'новый';
      await settle();
    });
    expect(first.rule).not.toHaveBeenCalled();
    expect(second.rule).toHaveBeenCalledTimes(1);
  });
});

describe('useFormBundle — StrictMode', () => {
  // React в разработке вызывает ленивый инициализатор дважды и оставляет первый результат; второй
  // бандл выбрасывается и не армируется. Его поведение не освобождается — см. ReFormer-8el5.
  it('бандл — первый результат фабрики и стабилен; стратегия армирована один раз', async () => {
    const { factory, rule } = orderFactory({ strategy: 'change' });
    const base = liveEffects();
    const hook = renderBundle(factory, true);
    const calls = factory.mock.calls.length;
    const bundle = hook.result.current;

    expect(bundle).toBe(factory.mock.results[0].value);
    expect(liveEffects()).toBe(base + 1);
    hook.rerender({ factory });
    expect(hook.result.current).toBe(bundle);
    expect(factory).toHaveBeenCalledTimes(calls);

    await act(async () => {
      bundle.model.email = 'x';
      await settle();
    });
    expect(rule).toHaveBeenCalledTimes(1);

    hook.unmount();
    expect(liveEffects()).toBe(base);
  });

  // поведение под вопросом [ReFormer-0f7y]: выброшенный React'ом второй бандл не армирован (живой проверки нет),
  // но его поведение работает, пока бандл не собран сборщиком мусора, — освободить его некому.
  // Утечка только в разработке, по бандлу на монтирование; родственно ReFormer-8el5.
  it('выброшенный второй бандл не армирован, но его поведение живо', async () => {
    const { factory, rule } = orderFactory({ strategy: 'change', behavior: true });
    renderBundle(factory, true);
    expect(factory).toHaveBeenCalledTimes(2);
    const discarded = factory.mock.results[1].value;

    await act(async () => {
      discarded.model.email = 'x';
      discarded.model.price = 5;
      await settle();
    });

    expect(rule).not.toHaveBeenCalled();
    expect(discarded.model.total).toBe(5);
  });
});

describe('useFormBundle — размонтирование', () => {
  it('контроллер снят: записи не запускают прогон, effect стратегии снят', async () => {
    const { factory, rule } = orderFactory({ strategy: 'change' });
    const base = liveEffects();
    const hook = renderBundle(factory);
    const bundle = hook.result.current;
    expect(liveEffects()).toBe(base + 1);

    hook.unmount();
    const after = hook.renders();
    await act(async () => {
      bundle.model.email = 'после';
      await settle();
    });

    expect(rule).not.toHaveBeenCalled();
    expect(liveEffects()).toBe(base);
    expect(hook.renders()).toBe(after);
  });

  it('поведение формы работает, пока компонент смонтирован', () => {
    const { factory } = orderFactory({ behavior: true });
    const hook = renderBundle(factory);
    const { model } = hook.result.current;

    act(() => {
      model.price = 10;
    });

    expect(model.total).toBe(10);
  });

  it('размонтирование снимает сборку: поведение формы больше не пересчитывает модель', async () => {
    const { factory } = orderFactory({ behavior: true });
    const hook = renderBundle(factory);
    const { model } = hook.result.current;

    hook.unmount();
    // Снятие — микрозадачей после коммита (см. шапку хука).
    await settle();
    model.price = 10;

    expect(model.total).toBe(1);
  });
});

/**
 * Очистка эффектов без размонтирования. Тестовое окружение не повторяет эффекты StrictMode, поэтому
 * тот же путь — «очистка и повторный запуск над той же сборкой» — воспроизводится скрытием и показом
 * `<Activity>`: эффекты снимаются, состояние компонента остаётся.
 */
describe('useFormBundle — очистка эффектов без размонтирования', () => {
  let mode: 'visible' | 'hidden' = 'visible';
  const ActivityWrapper = ({ children }: { children: ReactNode }) => (
    <Activity mode={mode}>{children}</Activity>
  );
  const renderInActivity = (factory: () => FormBundle<Order>) => {
    mode = 'visible';
    return renderHookCounting(
      (props: { factory: () => FormBundle<Order> }) => useFormBundle(props.factory),
      { initialProps: { factory }, wrapper: ActivityWrapper }
    );
  };
  const toggle = (
    hook: { rerender: (props: { factory: () => FormBundle<Order> }) => void },
    next: typeof mode,
    factory: () => FormBundle<Order>
  ) => {
    mode = next;
    act(() => hook.rerender({ factory }));
  };

  it('повторный запуск сразу после очистки (StrictMode, Fast Refresh) сборку не снимает', async () => {
    const { factory } = orderFactory({ behavior: true });
    const hook = renderInActivity(factory);
    const bundle = hook.result.current;

    toggle(hook, 'hidden', factory);
    toggle(hook, 'visible', factory);
    await settle();

    expect(hook.result.current).toBe(bundle);
    act(() => {
      bundle.model.price = 10;
    });
    expect(bundle.model.total).toBe(10);
  });

  it('сборку успели снять — показ собирает новую фабрикой, а не оставляет мёртвую', async () => {
    const { factory } = orderFactory({ behavior: true });
    const hook = renderInActivity(factory);
    const first = hook.result.current;

    toggle(hook, 'hidden', factory);
    await settle();
    // Замена ставится микрозадачей после показа — ждём её внутри act.
    mode = 'visible';
    await act(async () => {
      hook.rerender({ factory });
      await settle();
    });

    const second = hook.result.current;
    expect(second).not.toBe(first);
    act(() => {
      second.model.price = 7;
      first.model.price = 9;
    });
    expect(second.model.total).toBe(7);
    expect(first.model.total).toBe(1);
  });
});

// @vitest-environment happy-dom
/**
 * Контекст сборки в DOM: `FormBundleContext` и `useFormBundleContext`.
 *
 * Серверный рендер (`tests/core/utils/create-form-bundle.test.ts`) проверяет первый кадр. Здесь —
 * жизнь контекста: смена бандла в провайдере доходит до потребителя, вложенный провайдер
 * перекрывает внешний, а записи в модель и ререндер провайдера с тем же бандлом потребителя не
 * будят — значение контекста стабильно. Потребитель, подписанный на поле бандла из контекста,
 * снимает подписку при размонтировании.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { memo, type ReactNode } from 'react';
import { createForm, type FormBundle } from '../../src/form/form-bundle';
import {
  FormBundleContext,
  useFormBundleContext,
} from '../../src/platforms/react/form-bundle-context';
import { useFormControlValue } from '../../src/platforms/react/hooks/useFormControlValue';
import { act, cleanup, render, renderHookCounting, screen } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(cleanup);

interface Credit {
  kind: string;
  amount: number;
}

const createCredit = (kind = 'mortgage') => createForm<Credit>({ initial: { kind, amount: 0 } });

/** Обёртка `renderHook` с провайдером одного бандла. */
const providerOf =
  (bundle: FormBundle<Credit> | null) =>
  ({ children }: { children: ReactNode }) => (
    <FormBundleContext.Provider value={bundle}>{children}</FormBundleContext.Provider>
  );

describe('useFormBundleContext — DOM', () => {
  it('вне провайдера — null', () => {
    const hook = renderHookCounting(() => useFormBundleContext<Credit>());

    expect(hook.result.current).toBeNull();
  });

  it('внутри провайдера — бандл сборки', () => {
    const bundle = createCredit();
    const hook = renderHookCounting(() => useFormBundleContext<Credit>(), {
      wrapper: providerOf(bundle),
    });

    expect(hook.result.current).toBe(bundle);
  });

  it('вложенный провайдер перекрывает внешний для своего поддерева', () => {
    const outer = createCredit('outer');
    const inner = createCredit('inner');
    function Kind() {
      return <i>{useFormBundleContext<Credit>()?.model.kind}</i>;
    }

    render(
      <FormBundleContext.Provider value={outer}>
        <Kind />
        <FormBundleContext.Provider value={inner}>
          <Kind />
        </FormBundleContext.Provider>
      </FormBundleContext.Provider>
    );

    expect(document.body.textContent).toBe('outerinner');
  });

  it('смена бандла в провайдере доходит до потребителя', () => {
    const first = createCredit('first');
    const second = createCredit('second');
    const seen: (FormBundle<Credit> | null)[] = [];
    const Kind = memo(function Kind() {
      const bundle = useFormBundleContext<Credit>();
      seen.push(bundle);
      return <i data-testid="kind">{bundle?.model.kind}</i>;
    });
    const page = (bundle: FormBundle<Credit>) => (
      <FormBundleContext.Provider value={bundle}>
        <Kind />
      </FormBundleContext.Provider>
    );
    const view = render(page(first));
    expect(seen).toEqual([first]);

    view.rerender(page(second));

    expect(seen).toEqual([first, second]);
    expect(screen.getByTestId('kind').textContent).toBe('second');
  });

  it('записи в модель и состояние нод потребителя контекста не перерисовывают', () => {
    const bundle = createCredit();
    const hook = renderHookCounting(() => useFormBundleContext<Credit>(), {
      wrapper: providerOf(bundle),
    });
    const before = hook.renders();

    act(() => {
      bundle.model.amount = 100;
      bundle.form.kind.markAsTouched();
      bundle.form.kind.setIssues([{ code: 'required' }]);
    });

    expect(hook.renders()).toBe(before);
  });

  it('ререндер провайдера с тем же бандлом не будит memo-потребителя', () => {
    const bundle = createCredit();
    let consumerRenders = 0;
    const Consumer = memo(function Consumer() {
      consumerRenders++;
      return <span>{useFormBundleContext<Credit>()?.model.kind}</span>;
    });
    const page = (count: number) => (
      <FormBundleContext.Provider value={bundle}>
        <b>{count}</b>
        <Consumer />
      </FormBundleContext.Provider>
    );
    const view = render(page(0));
    const before = consumerRenders;

    view.rerender(page(1));

    expect(screen.getByText('1').tagName).toBe('B');
    expect(consumerRenders).toBe(before);
  });

  it('StrictMode: тот же бандл из контекста, подписка на его поле одна', () => {
    const bundle = createCredit('auto');
    const base = liveEffects();
    const hook = renderHookCounting(
      () => {
        const credit = useFormBundleContext<Credit>()!;
        return { credit, kind: useFormControlValue(credit.form.kind) };
      },
      { wrapper: providerOf(bundle), strict: true }
    );
    expect(hook.result.current.credit).toBe(bundle);
    expect(liveEffects()).toBe(base + 1);

    act(() => bundle.form.kind.setValue('mortgage'));

    expect(hook.result.current.kind).toBe('mortgage');
  });

  it('потребитель, подписанный на поле из контекста, снимает подписку при размонтировании', () => {
    const bundle = createCredit('auto');
    let renders = 0;
    function KindBadge() {
      renders++;
      const credit = useFormBundleContext<Credit>()!;
      return <span data-testid="kind">{useFormControlValue(credit.form.kind)}</span>;
    }
    const base = liveEffects();
    const view = render(
      <FormBundleContext.Provider value={bundle}>
        <KindBadge />
      </FormBundleContext.Provider>
    );
    expect(liveEffects()).toBe(base + 1);

    act(() => bundle.form.kind.setValue('mortgage'));
    expect(screen.getByTestId('kind').textContent).toBe('mortgage');

    view.unmount();
    const after = renders;
    act(() => bundle.form.kind.setValue('consumer'));

    expect(renders).toBe(after);
    expect(liveEffects()).toBe(base);
  });
});

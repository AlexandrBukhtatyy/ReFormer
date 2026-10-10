// @vitest-environment happy-dom
/**
 * `useArrayLength` в DOM: хук перерисовывает компонент только при смене числа строк массива.
 *
 * Правка значения строки и перестановка строк длину не меняют — лишних рендеров быть не должно.
 * После размонтирования подписка хука снята: число живых effect'ов возвращается к исходному.
 * Первый DOM-тест пакета — заодно проверка, что happy-dom и testing-library работают с vitest.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrayOf } from '../../src/model';
import { createForm } from '../../src/form/form-bundle';
import type { FormModel } from '../../src/model/types';
import { useArrayLength } from '../../src/platforms/react/hooks/useArrayLength';
import { act, cleanup, renderHookCounting } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';
import { InputStub } from '../test-utils/stubs';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(cleanup);

interface Phone {
  number: string;
}

const phoneRow = (row: FormModel<Phone>) => ({
  children: [{ model: row.$.number, component: InputStub }],
});

const createPhones = (numbers: string[] = ['111', '222']) =>
  createForm<{ phones: Phone[] }>({
    initial: {
      phones: arrayOf(
        () => ({ number: '' }),
        numbers.map((number) => ({ number }))
      ),
    },
    schema: (model) => ({ children: [{ model: model.$.phones, item: phoneRow }] }),
  });

describe('useArrayLength — DOM', () => {
  it('отдаёт число строк и перерисовывает при push и removeAt', () => {
    const bundle = createPhones();
    const hook = renderHookCounting(() => useArrayLength(bundle.form.phones));
    expect(hook.result.current).toBe(2);

    act(() => bundle.form.phones.push());
    expect(hook.result.current).toBe(3);

    act(() => bundle.form.phones.removeAt(0));
    expect(hook.result.current).toBe(2);
  });

  it('правка значения строки и перестановка строк не перерисовывают', () => {
    const bundle = createPhones();
    const hook = renderHookCounting(() => useArrayLength(bundle.form.phones));
    const rendersBefore = hook.renders();

    act(() => {
      bundle.model.phones.at(0).number = '999';
    });
    act(() => bundle.form.phones.move(0, 1));

    expect(hook.renders()).toBe(rendersBefore);
    expect(hook.result.current).toBe(2);
  });

  it('размонтирование снимает подписку хука', () => {
    const bundle = createPhones();
    const baseline = liveEffects();

    const hook = renderHookCounting(() => useArrayLength(bundle.form.phones));
    expect(liveEffects()).toBeGreaterThan(baseline);

    hook.unmount();
    expect(liveEffects()).toBe(baseline);
  });

  it('в StrictMode отдаёт то же число и реагирует на push', () => {
    const bundle = createPhones(['1']);
    const hook = renderHookCounting(() => useArrayLength(bundle.form.phones), { strict: true });
    expect(hook.result.current).toBe(1);

    act(() => bundle.form.phones.push());
    expect(hook.result.current).toBe(2);
  });
});

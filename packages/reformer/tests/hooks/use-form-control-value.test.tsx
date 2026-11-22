// @vitest-environment happy-dom
/**
 * `useFormControlValue` в DOM: хук подписан только на значение поля.
 *
 * Замечания, `touched`, доступность и пропсы компонента компонент не перерисовывают — ради этого
 * хук и существует рядом с `useFormControl`. Подмена контрола переносит подписку на новую ноду, а
 * старая перестаёт будить компонент. Первый запуск effect'а подписки пропускается — тест
 * проверяет, что запись между рендером и подпиской при этом не теряется. StrictMode с двойным
 * эффектом оставляет ровно одну подписку; после размонтирования effect снят.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLayoutEffect } from 'react';
import { createForm } from '../../src/form/form-bundle';
import type { FormControl } from '../../src/form/types/index';
import { useFormControlValue } from '../../src/platforms/react/hooks/useFormControlValue';
import { act, cleanup, render, renderHookCounting, screen } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';

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

interface Profile {
  email: string;
  name: string;
}

const createProfile = (initial: Partial<Profile> = {}) =>
  createForm<Profile>({ initial: { email: '', name: '', ...initial } });

/** Хук над контролом из пропсов — для подмены контрола через `rerender`. */
const renderValue = (control: FormControl<string>, strict = false) =>
  renderHookCounting(
    (props: { control: FormControl<string> }) => useFormControlValue(props.control),
    {
      initialProps: { control },
      strict,
    }
  );

describe('useFormControlValue — подписка на значение', () => {
  it('отдаёт текущее значение и перерисовывает при его смене', () => {
    const { form } = createProfile({ email: 'a@b.c' });
    const hook = renderValue(form.email);
    expect(hook.result.current).toBe('a@b.c');
    const before = hook.renders();

    act(() => form.email.setValue('x@y.z'));

    expect(hook.result.current).toBe('x@y.z');
    expect(hook.renders()).toBe(before + 1);
  });

  it('запись в модель мимо ноды видна хуку', () => {
    const bundle = createProfile();
    const hook = renderValue(bundle.form.name);

    act(() => {
      bundle.model.name = 'Анна';
    });

    expect(hook.result.current).toBe('Анна');
  });

  it('запись того же значения не перерисовывает', () => {
    const { form } = createProfile({ email: 'same' });
    const hook = renderValue(form.email);
    const before = hook.renders();

    act(() => form.email.setValue('same'));

    expect(hook.renders()).toBe(before);
  });

  it('замечания, touched, доступность и пропсы компонента не перерисовывают', () => {
    const { form } = createProfile();
    const hook = renderValue(form.email);
    const before = hook.renders();

    act(() => form.email.setIssues([{ code: 'required' }]));
    act(() => form.email.markAsTouched());
    act(() => form.email.disable());
    act(() => form.email.enable());
    act(() => form.email.updateComponentProps({ label: 'Почта' }));

    expect(hook.renders()).toBe(before);
  });

  it('соседнее поле не перерисовывает', () => {
    const { form } = createProfile();
    const hook = renderValue(form.email);
    const before = hook.renders();

    act(() => form.name.setValue('Пётр'));

    expect(hook.renders()).toBe(before);
  });

  it('несколько записей в одном act — один ререндер с последним значением', () => {
    const { form } = createProfile();
    const hook = renderValue(form.email);
    const before = hook.renders();

    act(() => {
      form.email.setValue('1');
      form.email.setValue('2');
      form.email.setValue('3');
    });

    expect(hook.result.current).toBe('3');
    expect(hook.renders()).toBe(before + 1);
  });

  it('запись между рендером и подпиской не теряется', () => {
    const { form } = createProfile({ email: 'early' });
    const seen: string[] = [];

    function Probe() {
      const value = useFormControlValue(form.email);
      seen.push(value);
      return <span data-testid="value">{value}</span>;
    }
    /** Пишет в layout-эффекте — до пассивного эффекта, в котором хук подписывается. */
    function LateWriter() {
      useLayoutEffect(() => form.email.setValue('late'), []);
      return null;
    }

    render(
      <>
        <Probe />
        <LateWriter />
      </>
    );

    expect(screen.getByTestId('value').textContent).toBe('late');
    // Первый кадр — со старым значением: запись пришла после рендера, её подхватила сверка
    // снапшота после подписки, а не пропущенный первый запуск effect'а.
    expect(seen).toEqual(['early', 'late']);
  });
});

describe('useFormControlValue — подмена контрола', () => {
  it('другая нода — значение новой, подписка переезжает', () => {
    const first = createProfile({ email: 'first' });
    const second = createProfile({ email: 'second' });
    const hook = renderValue(first.form.email);
    const subscribed = liveEffects();
    const createdBefore = created.effects;

    hook.rerender({ control: second.form.email });
    expect(hook.result.current).toBe('second');
    expect(created.effects).toBe(createdBefore + 1);
    expect(liveEffects()).toBe(subscribed);

    const before = hook.renders();
    act(() => first.form.email.setValue('старая нода'));
    expect(hook.renders()).toBe(before);

    act(() => second.form.email.setValue('новая нода'));
    expect(hook.result.current).toBe('новая нода');
    expect(hook.renders()).toBe(before + 1);
  });

  it('ререндер с тем же контролом подписку не пересоздаёт', () => {
    const { form } = createProfile();
    const hook = renderValue(form.email);
    const createdBefore = created.effects;

    for (let i = 0; i < 5; i++) hook.rerender({ control: form.email });

    expect(created.effects).toBe(createdBefore);
  });

  it('новая нода с тем же значением отдаёт его же', () => {
    const first = createProfile({ email: 'общее' });
    const second = createProfile({ email: 'общее' });
    const hook = renderValue(first.form.email);

    hook.rerender({ control: second.form.email });

    expect(hook.result.current).toBe('общее');
    act(() => second.form.email.setValue('своё'));
    expect(hook.result.current).toBe('своё');
  });
});

describe('useFormControlValue — StrictMode', () => {
  it('двойной эффект оставляет одну подписку, значение обновляется', () => {
    const { form } = createProfile();
    const base = liveEffects();
    const hook = renderValue(form.email, true);
    expect(liveEffects()).toBe(base + 1);

    act(() => form.email.setValue('strict'));
    expect(hook.result.current).toBe('strict');

    hook.unmount();
    expect(liveEffects()).toBe(base);
  });
});

describe('useFormControlValue — размонтирование', () => {
  it('снимает подписку: записи не перерисовывают, effect снят', () => {
    const { form } = createProfile();
    const base = liveEffects();
    const hook = renderValue(form.email);
    expect(liveEffects()).toBe(base + 1);

    hook.unmount();
    const after = hook.renders();
    act(() => form.email.setValue('после размонтирования'));

    expect(hook.renders()).toBe(after);
    expect(liveEffects()).toBe(base);
  });
});

// @vitest-environment happy-dom
/**
 * FormWizard — смена шага: `onStepChange` и прокрутка к началу (`scrollToTop`).
 *
 * Визард реагирует на сам поток (`flow.current`), а не на свои кнопки: переход снаружи —
 * `flow.goTo` из кода или поведения, отказ отправки с `onInvalidSubmit: 'firstInvalidStep'`,
 * `flow.reset()` — получает те же побочные эффекты, что и «Далее». Было: их запускали только
 * переходы самого визарда, и отказ отправки переводил пользователя на шаг с ошибкой без колбэка и
 * прокрутки. Эффекты идут после фиксации, поэтому нужен живой DOM, а не `react-dom/server`.
 */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createForm, createFormFlow, type FormBundle, type FormFlow } from '@reformer/core';
import { FormBundleContext } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { FormWizard } from './FormWizard';
import { useFormWizard, type FormWizardContextValue } from './FormWizardContext';

interface Shape {
  amount: string;
  phone: string;
}

const amountRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});

const createBundle = (
  initial: Shape = { amount: '', phone: '' },
  onInvalidSubmit: 'stay' | 'firstInvalidStep' = 'stay'
): FormBundle<Shape> =>
  createForm<Shape>({
    initial,
    flow: {
      steps: [{ id: 'loan', rules: amountRules }, { id: 'contacts' }, { id: 'confirm' }],
      onInvalidSubmit,
    },
  });

let scrollTo: MockInstance<typeof window.scrollTo>;

beforeEach(() => {
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Визард на три шага внутри сборки; возвращает доступ к `useFormWizard()`. */
function renderWizard(
  bundle: FormBundle<Shape>,
  props: { onStepChange?: (step: number) => void; scrollToTop?: boolean; flow?: FormFlow } = {},
  options: { strict?: boolean } = {}
) {
  const wizard: { current?: FormWizardContextValue<Shape> } = {};
  const Probe = ({ onWizard }: { onWizard: (value: FormWizardContextValue<Shape>) => void }) => {
    onWizard(useFormWizard<Shape>());
    return null;
  };
  const view = (next: typeof props) => (
    <FormBundleContext.Provider value={bundle}>
      <FormWizard {...next}>
        <FormWizard.Step>
          <h2>Loan</h2>
        </FormWizard.Step>
        <FormWizard.Step>
          <h2>Contacts</h2>
        </FormWizard.Step>
        <FormWizard.Step>
          <h2>Confirm</h2>
        </FormWizard.Step>
        <Probe onWizard={(value) => (wizard.current = value)} />
      </FormWizard>
    </FormBundleContext.Provider>
  );
  const { rerender } = render(view(props), options.strict ? { wrapper: StrictMode } : {});
  return { wizard, rerender: (next: typeof props) => rerender(view(next)) };
}

describe('FormWizard — смена шага: onStepChange и прокрутка', () => {
  it('первая отрисовка — не смена шага, даже если поток уже не на первом шаге', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    await bundle.flow!.next();
    const onStepChange = vi.fn();

    renderWizard(bundle, { onStepChange });

    expect(screen.getByRole('heading').textContent).toBe('Contacts');
    expect(onStepChange).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('StrictMode: двойной запуск эффектов при монтировании — ни вызова на старте, ни повтора', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const onStepChange = vi.fn();
    renderWizard(bundle, { onStepChange }, { strict: true });
    expect(onStepChange).not.toHaveBeenCalled();

    await act(() => bundle.flow!.next());

    expect(onStepChange.mock.calls).toEqual([[2]]);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('переход снаружи (flow.goTo) — колбэк один раз и прокрутка к началу', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const onStepChange = vi.fn();
    renderWizard(bundle, { onStepChange });
    await act(() => bundle.flow!.next());
    onStepChange.mockClear();
    scrollTo.mockClear();

    act(() => {
      bundle.flow!.goTo('loan');
    });

    expect(onStepChange).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('свои переходы визарда — «Далее», «Назад», goToStep — ровно по одному вызову', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const onStepChange = vi.fn();
    const { wizard } = renderWizard(bundle, { onStepChange });

    await act(async () => {
      expect(await wizard.current!.goToNextStep()).toBe(true);
    });
    expect(onStepChange.mock.calls).toEqual([[2]]);

    await act(async () => {
      expect(await wizard.current!.goToNextStep()).toBe(true);
    });
    expect(onStepChange.mock.calls).toEqual([[2], [3]]);

    act(() => wizard.current!.goToPreviousStep());
    expect(onStepChange.mock.calls).toEqual([[2], [3], [2]]);

    act(() => {
      expect(wizard.current!.goToStep(1)).toBe(true);
    });
    expect(onStepChange.mock.calls).toEqual([[2], [3], [2], [1]]);
    expect(scrollTo).toHaveBeenCalledTimes(4);
  });

  it('колбэк приходит, когда новый шаг уже нарисован: в него можно перевести фокус', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const headings: string[] = [];
    const { wizard } = renderWizard(bundle, {
      onStepChange: () => headings.push(document.querySelector('h2')?.textContent ?? ''),
    });

    await act(async () => {
      await wizard.current!.goToNextStep();
    });
    await act(() => bundle.flow!.next());
    // Было: синхронные переходы («Назад», goToStep) звали колбэк до отрисовки нового шага — в DOM
    // стоял прежний.
    act(() => wizard.current!.goToPreviousStep());
    act(() => {
      wizard.current!.goToStep(1);
    });

    expect(headings).toEqual(['Contacts', 'Confirm', 'Contacts', 'Loan']);
  });

  it('шаг не сменился — ни колбэка, ни прокрутки; итоги goToStep/goToNextStep прежние', async () => {
    const bundle = createBundle();
    const onStepChange = vi.fn();
    const { wizard } = renderWizard(bundle, { onStepChange });

    // Правила шага не прошли — «Далее» остаётся на шаге и сообщает об этом.
    await act(async () => {
      expect(await wizard.current!.goToNextStep()).toBe(false);
    });
    // Закрытый шаг и шаг, на котором поток уже стоит, — не переход.
    act(() => {
      expect(wizard.current!.goToStep(3)).toBe(false);
      expect(wizard.current!.goToStep(1)).toBe(false);
      wizard.current!.goToPreviousStep();
    });

    expect(bundle.flow!.current.value).toBe('loan');
    expect(onStepChange).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('отказ отправки с onInvalidSubmit: firstInvalidStep переводит поток — колбэк и прокрутка', async () => {
    const bundle = createBundle({ amount: '100', phone: '' }, 'firstInvalidStep');
    const onStepChange = vi.fn();
    const handler = vi.fn();
    const { wizard } = renderWizard(bundle, { onStepChange });
    await act(async () => {
      await wizard.current!.goToNextStep();
      await wizard.current!.goToNextStep();
    });
    onStepChange.mockClear();
    scrollTo.mockClear();
    // Правка на последнем шаге делает ранний шаг недействительным.
    bundle.model.amount = '';

    let status: string | undefined;
    await act(async () => {
      status = (await wizard.current!.submit(handler)).status;
    });

    expect(status).toBe('invalid');
    expect(handler).not.toHaveBeenCalled();
    expect(screen.getByRole('heading').textContent).toBe('Loan');
    expect(onStepChange.mock.calls).toEqual([[1]]);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('flow.reset() возвращает на первый шаг — это смена шага', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const onStepChange = vi.fn();
    renderWizard(bundle, { onStepChange });
    await act(() => bundle.flow!.next());
    onStepChange.mockClear();

    act(() => bundle.flow!.reset());
    // Сброс на первом шаге шага не меняет.
    act(() => bundle.flow!.reset());

    expect(onStepChange.mock.calls).toEqual([[1]]);
  });

  it('scrollToTop={false} — колбэк есть, прокрутки нет', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const onStepChange = vi.fn();
    const { wizard } = renderWizard(bundle, { onStepChange, scrollToTop: false });

    await act(async () => {
      await wizard.current!.goToNextStep();
    });
    act(() => {
      bundle.flow!.goTo('loan');
    });

    expect(onStepChange.mock.calls).toEqual([[2], [1]]);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('замена самого потока (проп flow) — не смена шага', async () => {
    const bundle = createBundle();
    const onStepChange = vi.fn();
    const other = createFormFlow({ steps: ['a', 'b', 'c'] });
    await other.next();
    const { rerender } = renderWizard(bundle, { onStepChange });

    rerender({ onStepChange, flow: other });
    expect(screen.getByRole('heading').textContent).toBe('Contacts');
    expect(onStepChange).not.toHaveBeenCalled();

    // Переходы нового потока — уже смены шага.
    act(() => {
      other.goTo('a');
    });
    expect(onStepChange.mock.calls).toEqual([[1]]);
  });

  it('новый колбэк на каждой отрисовке не вызывает его повторно', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const calls: number[] = [];
    const { rerender } = renderWizard(bundle, { onStepChange: (step) => calls.push(step) });
    await act(() => bundle.flow!.next());

    rerender({ onStepChange: (step) => calls.push(step) });
    rerender({ onStepChange: (step) => calls.push(step), scrollToTop: false });

    expect(calls).toEqual([2]);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

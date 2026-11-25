// @vitest-environment happy-dom
/**
 * FormWizard — условный шаг: шаг, который поток сейчас пропускает.
 *
 * В сборке условный шаг — скрытый узел шага (`hideWhen(schema.node('<шаг>'), …)`): поток убирает
 * его из `flow.activeSteps`. Визард рисует только участвующие шаги: индикатор, счёт «шаг N из M»,
 * пройденные шаги и `goToStep` считаются по ним, а `FormWizard.Step` остаётся связан с шагом потока
 * по месту среди всех шагов. Было: шаг со скрытым содержимым оставался в индикаторе и навигации, и
 * «Далее» приводило на пустой шаг.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createForm, type FormBundle } from '@reformer/core';
import { FormBundleContext } from '@reformer/core/react';
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { FormWizard } from './FormWizard';
import { useFormWizard, type FormWizardContextValue } from './FormWizardContext';
import type { FormWizardIndicatorRenderProps } from './FormWizardIndicator';

interface Order {
  customerType: 'person' | 'company';
  name: string;
  companyName: string;
}

const buyerRules = defineValidation<Order>(({ model }) => {
  validate(model.$.name, [required()]);
});
const companyRules = defineValidation<Order>(({ model }) => {
  validate(model.$.companyName, [required()]);
});

/** Шаг «company» нужен только юрлицу: узел шага скрыт правилом поведения. */
const orderBehavior = defineFormBehavior<Order>(({ model, schema }) => {
  hideWhen(schema.node('company'), () => model.customerType !== 'company');
});

const createOrder = (customerType: Order['customerType']): FormBundle<Order> =>
  createForm<Order>({
    initial: { customerType, name: 'Анна', companyName: '' },
    behavior: orderBehavior,
    flow: {
      steps: [
        { id: 'buyer', rules: buyerRules },
        { id: 'company', rules: companyRules },
        { id: 'delivery' },
      ],
    },
  });

const STEPS = [
  { number: 1, title: 'Buyer' },
  { number: 2, title: 'Company' },
  { number: 3, title: 'Delivery' },
];

let scrollTo: MockInstance<typeof window.scrollTo>;

beforeEach(() => {
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Визард заказа внутри сборки: доступ к `useFormWizard()` и render-props индикатора. */
function renderOrder(bundle: FormBundle<Order>, onStepChange?: (step: number) => void) {
  const seen: {
    wizard?: FormWizardContextValue<Order>;
    indicator?: FormWizardIndicatorRenderProps;
  } = {};
  const Probe = ({ onWizard }: { onWizard: (value: FormWizardContextValue<Order>) => void }) => {
    onWizard(useFormWizard<Order>());
    return null;
  };
  render(
    <FormBundleContext.Provider value={bundle}>
      <FormWizard onStepChange={onStepChange}>
        <FormWizard.Indicator steps={STEPS}>
          {(props) => {
            seen.indicator = props;
            return (
              <ol>
                {props.steps.map((step) => (
                  <li key={step.title}>
                    {step.number}. {step.title}
                  </li>
                ))}
              </ol>
            );
          }}
        </FormWizard.Indicator>
        <FormWizard.Step>
          <h2>Buyer</h2>
        </FormWizard.Step>
        <FormWizard.Step>
          <h2>Company</h2>
        </FormWizard.Step>
        <FormWizard.Step>
          <h2>Delivery</h2>
        </FormWizard.Step>
        <Probe onWizard={(value) => (seen.wizard = value)} />
      </FormWizard>
    </FormBundleContext.Provider>
  );
  return seen;
}

const indicatorItems = (): string[] =>
  screen.getAllByRole('listitem').map((item) => item.textContent ?? '');

describe('FormWizard — условный шаг', () => {
  it('физлицо: шага «Company» нет в индикаторе, шаги нумеруются подряд', () => {
    const seen = renderOrder(createOrder('person'));

    expect(indicatorItems()).toEqual(['1. Buyer', '2. Delivery']);
    expect(seen.indicator?.totalSteps).toBe(2);
    expect(seen.wizard?.activeStepIds).toEqual(['buyer', 'delivery']);
    expect(screen.getByRole('status').textContent).toBe('Step 1 of 2');
  });

  it('юрлицо: шаг «Company» в индикаторе есть', () => {
    renderOrder(createOrder('company'));

    expect(indicatorItems()).toEqual(['1. Buyer', '2. Company', '3. Delivery']);
    expect(screen.getByRole('status').textContent).toBe('Step 1 of 3');
  });

  it('«Далее» у физлица рисует шаг «Delivery», а не пустой «Company»', async () => {
    const onStepChange = vi.fn();
    const seen = renderOrder(createOrder('person'), onStepChange);

    await act(() => seen.wizard!.goToNextStep());

    expect(screen.getByRole('heading').textContent).toBe('Delivery');
    expect(seen.wizard).toMatchObject({
      currentStep: 2,
      currentStepId: 'delivery',
      totalSteps: 2,
      completedSteps: [1],
      isLastStep: true,
    });
    expect(onStepChange.mock.calls).toEqual([[2]]);
  });

  it('«Далее» у юрлица ведёт на «Company» и проверяет его правила', async () => {
    const bundle = createOrder('company');
    const seen = renderOrder(bundle);

    await act(() => seen.wizard!.goToNextStep());
    expect(screen.getByRole('heading').textContent).toBe('Company');

    await act(() => seen.wizard!.goToNextStep());
    expect(screen.getByRole('heading').textContent).toBe('Company');
    expect(bundle.form.companyName.shouldShowError.value).toBe(true);
  });

  it('смена типа покупателя перестраивает индикатор без перезагрузки визарда', () => {
    const bundle = createOrder('person');
    renderOrder(bundle);

    act(() => {
      bundle.model.customerType = 'company';
    });
    expect(indicatorItems()).toEqual(['1. Buyer', '2. Company', '3. Delivery']);

    act(() => {
      bundle.model.customerType = 'person';
    });
    expect(indicatorItems()).toEqual(['1. Buyer', '2. Delivery']);
  });

  it('goToStep принимает номер среди участвующих шагов', async () => {
    const seen = renderOrder(createOrder('person'));
    await act(() => seen.wizard!.goToNextStep());
    expect(screen.getByRole('heading').textContent).toBe('Delivery');

    let moved = true;
    act(() => {
      // Участвующих шагов два: «Delivery» — второй, третьего нет.
      moved = seen.wizard!.goToStep(3);
    });
    expect(moved).toBe(false);
    expect(screen.getByRole('heading').textContent).toBe('Delivery');

    act(() => {
      moved = seen.wizard!.goToStep(1);
    });
    expect(moved).toBe(true);
    expect(screen.getByRole('heading').textContent).toBe('Buyer');
  });

  it('индикатор: состояние шага после пропущенного считается по участвующим', async () => {
    const seen = renderOrder(createOrder('person'));

    expect(seen.indicator?.steps.map((step) => step.canNavigate)).toEqual([true, false]);

    await act(() => seen.wizard!.goToNextStep());

    expect(
      seen.indicator?.steps.map(({ title, isCurrent, isCompleted }) => ({
        title,
        isCurrent,
        isCompleted,
      }))
    ).toEqual([
      { title: 'Buyer', isCurrent: false, isCompleted: true },
      { title: 'Delivery', isCurrent: true, isCompleted: false },
    ]);
  });

  it('шаг перед текущим скрылся: номер меньше, шаг тот же — не смена шага', async () => {
    const bundle = createOrder('company');
    bundle.model.companyName = 'Ромашка';
    const onStepChange = vi.fn();
    const seen = renderOrder(bundle, onStepChange);
    await act(() => seen.wizard!.goToNextStep());
    await act(() => seen.wizard!.goToNextStep());
    expect(seen.wizard).toMatchObject({ currentStep: 3, currentStepId: 'delivery' });
    onStepChange.mockClear();
    scrollTo.mockClear();

    act(() => {
      bundle.model.customerType = 'person';
    });

    expect(seen.wizard).toMatchObject({ currentStep: 2, currentStepId: 'delivery' });
    expect(screen.getByRole('heading').textContent).toBe('Delivery');
    expect(onStepChange).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

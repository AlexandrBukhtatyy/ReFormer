/**
 * FormWizard — адаптер потока шагов ядра (`FormFlow`).
 *
 * Правила доступности шагов и проверку шага держит поток (их тесты — в ядре,
 * `tests/core/flow/form-flow.test.ts`); здесь — что визард берёт поток из пропа или сборки,
 * без них строит позиционный, рисует номер шага и отправляет через сборку.
 *
 * DOM-окружения в пакете нет (только `react-dom/server`), поэтому клик не имитируется:
 * render-props отдают обработчики функциями — их и вызываем.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createForm, createFormFlow, type FormBundle } from '@reformer/core';
import { FormBundleContext } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { FormWizard } from './FormWizard';
import type { FormWizardActionsRenderProps } from './FormWizardActions';
import type { FormWizardIndicatorRenderProps } from './FormWizardIndicator';

interface Shape {
  amount: string;
  phone: string;
}

const amountRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});

const createBundle = (initial: Shape = { amount: '', phone: '' }): FormBundle<Shape> =>
  createForm<Shape>({
    initial,
    flow: { steps: [{ id: 'loan', rules: amountRules }, { id: 'confirm' }] },
  });

const Empty = () => null;

/** Нарисовать визард и вернуть render-props кнопок и индикатора. */
function capture(
  element: (slots: {
    actions: (props: FormWizardActionsRenderProps) => null;
    indicator: (props: FormWizardIndicatorRenderProps) => null;
  }) => React.ReactElement
) {
  const captured: {
    actions?: FormWizardActionsRenderProps;
    indicator?: FormWizardIndicatorRenderProps;
  } = {};
  const html = renderToStaticMarkup(
    element({
      actions: (props) => {
        captured.actions = props;
        return null;
      },
      indicator: (props) => {
        captured.indicator = props;
        return null;
      },
    })
  );
  return { html, ...captured };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('FormWizard — поток шагов', () => {
  it('без потока — позиционный: live-region «Step 1 of 2»', () => {
    const { form } = createBundle();
    const html = renderToStaticMarkup(
      <FormWizard form={form}>
        <FormWizard.Step component={Empty} control={form} />
        <FormWizard.Step component={Empty} control={form} />
      </FormWizard>
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Step 1 of 2');
  });

  it('поток из пропа: номер и пройденные шаги — из потока', async () => {
    const { form } = createBundle();
    const flow = createFormFlow({ steps: ['a', 'b', 'c'] });
    await flow.next();

    const { html, indicator } = capture(({ indicator: render }) => (
      <FormWizard form={form} flow={flow}>
        <FormWizard.Indicator steps={[1, 2, 3].map((number) => ({ number, title: `${number}` }))}>
          {render}
        </FormWizard.Indicator>
        <FormWizard.Step component={Empty} control={form} />
        <FormWizard.Step component={Empty} control={form} />
        <FormWizard.Step component={Empty} control={form} />
      </FormWizard>
    ));

    expect(html).toContain('Step 2 of 3');
    expect(indicator?.steps.map((step) => step.isCompleted)).toEqual([true, false, false]);
  });

  it('поток сборки из контекста: «Далее» проверяет правила шага', async () => {
    const bundle = createBundle();
    const { actions } = capture(({ actions: render }) => (
      <FormBundleContext.Provider value={bundle}>
        <FormWizard>
          <FormWizard.Step component={Empty} control={bundle.form} />
          <FormWizard.Step component={Empty} control={bundle.form} />
          <FormWizard.Actions>{render}</FormWizard.Actions>
        </FormWizard>
      </FormBundleContext.Provider>
    ));

    actions!.next.onClick();
    await flush();

    expect(bundle.flow!.current.value).toBe('loan');
    expect(bundle.form.amount.shouldShowError.value).toBe(true);

    bundle.model.amount = '100';
    actions!.next.onClick();
    await flush();
    expect(bundle.flow!.current.value).toBe('confirm');
  });
});

describe('FormWizard — отправка', () => {
  it('в сборке: замечания — обработчик не вызывается', async () => {
    const bundle = createBundle();
    const onSubmit = vi.fn();
    const { actions } = capture(({ actions: render }) => (
      <FormBundleContext.Provider value={bundle}>
        <FormWizard>
          <FormWizard.Step component={Empty} control={bundle.form} />
          <FormWizard.Actions onSubmit={onSubmit}>{render}</FormWizard.Actions>
        </FormWizard>
      </FormBundleContext.Provider>
    ));

    actions!.submit.onClick();
    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(bundle.form.amount.touched.value).toBe(true);
  });

  it('в сборке: форма прошла проверку — обработчик ровно один раз', async () => {
    const bundle = createBundle({ amount: '100', phone: '' });
    const onSubmit = vi.fn();
    const { actions } = capture(({ actions: render }) => (
      <FormBundleContext.Provider value={bundle}>
        <FormWizard>
          <FormWizard.Step component={Empty} control={bundle.form} />
          <FormWizard.Actions onSubmit={onSubmit}>{render}</FormWizard.Actions>
        </FormWizard>
      </FormBundleContext.Provider>
    ));

    actions!.submit.onClick();
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('без сборки обработчик зовётся по нажатию: проверку делает приложение', async () => {
    const { form } = createBundle();
    const onSubmit = vi.fn();
    const { actions } = capture(({ actions: render }) => (
      <FormWizard form={form}>
        <FormWizard.Step component={Empty} control={form} />
        <FormWizard.Actions onSubmit={onSubmit}>{render}</FormWizard.Actions>
      </FormWizard>
    ));

    actions!.submit.onClick();
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

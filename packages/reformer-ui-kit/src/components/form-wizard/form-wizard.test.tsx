import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  FormWizardActionsRenderProps,
  FormWizardIndicatorRenderProps,
  FormWizardIndicatorStepWithState,
  FormWizardProgressRenderProps,
} from '@reformer/cdk/form-wizard';
import { FormWizardActions, FormWizardProgress, StepIndicator } from './index';

const noop = () => {};

// --- FormWizardActions ---------------------------------------------------

function actionsProps(
  overrides: Partial<FormWizardActionsRenderProps> = {}
): FormWizardActionsRenderProps {
  return {
    prev: { onClick: noop, disabled: false },
    next: { onClick: noop, disabled: false },
    submit: { onClick: noop, disabled: false, isSubmitting: false },
    isFirstStep: false,
    isLastStep: false,
    isValidating: false,
    isSubmitting: false,
    ...overrides,
  };
}

describe('FormWizardActions', () => {
  it('на первом шаге скрывает «Назад», показывает «Далее →»', () => {
    const html = renderToStaticMarkup(
      <FormWizardActions {...actionsProps({ isFirstStep: true })} />
    );
    expect(html).not.toContain('btn-previous');
    expect(html).toContain('data-testid="btn-next"');
    expect(html).toContain('Далее →');
  });

  it('не на первом шаге показывает «← Назад»', () => {
    const html = renderToStaticMarkup(
      <FormWizardActions {...actionsProps({ isFirstStep: false })} />
    );
    expect(html).toContain('data-testid="btn-previous"');
    expect(html).toContain('← Назад');
  });

  it('на последнем шаге показывает «Отправить заявку» вместо «Далее»', () => {
    const html = renderToStaticMarkup(
      <FormWizardActions {...actionsProps({ isLastStep: true })} />
    );
    expect(html).toContain('data-testid="btn-submit"');
    expect(html).toContain('Отправить заявку');
    expect(html).not.toContain('data-testid="btn-next"');
  });

  it('во время валидации показывает «Проверка...»', () => {
    const html = renderToStaticMarkup(
      <FormWizardActions {...actionsProps({ isValidating: true })} />
    );
    expect(html).toContain('Проверка...');
  });

  it('во время submit показывает «Отправка...»', () => {
    const html = renderToStaticMarkup(
      <FormWizardActions {...actionsProps({ isLastStep: true, isSubmitting: true })} />
    );
    expect(html).toContain('Отправка...');
  });

  it('переопределяет подписи кнопок', () => {
    const html = renderToStaticMarkup(
      <FormWizardActions {...actionsProps({ isLastStep: true })} submitLabel="Оформить заявку" />
    );
    expect(html).toContain('Оформить заявку');
  });
});

// --- FormWizardProgress --------------------------------------------------

function progressProps(
  overrides: Partial<FormWizardProgressRenderProps> = {}
): FormWizardProgressRenderProps {
  return {
    current: 2,
    total: 3,
    percent: 66,
    completedCount: 1,
    isFirstStep: false,
    isLastStep: false,
    ...overrides,
  };
}

describe('FormWizardProgress', () => {
  it('по умолчанию рендерит «Шаг N из M • X% завершено»', () => {
    const html = renderToStaticMarkup(<FormWizardProgress {...progressProps()} />);
    expect(html).toContain('Шаг 2 из 3 • 66% завершено');
  });

  it('несёт data-slot="form-wizard-progress"', () => {
    const html = renderToStaticMarkup(<FormWizardProgress {...progressProps()} />);
    expect(html).toContain('data-slot="form-wizard-progress"');
  });

  it('переопределяет формат строки', () => {
    const html = renderToStaticMarkup(
      <FormWizardProgress
        {...progressProps()}
        format={({ current, total }) => `${current} / ${total}`}
      />
    );
    expect(html).toContain('2 / 3');
    expect(html).not.toContain('завершено');
  });
});

// --- StepIndicator -------------------------------------------------------

function step(
  overrides: Partial<FormWizardIndicatorStepWithState> = {}
): FormWizardIndicatorStepWithState {
  return {
    number: 1,
    title: 'Кредит',
    icon: '💰',
    isCurrent: false,
    isCompleted: false,
    canNavigate: true,
    ...overrides,
  };
}

function indicatorProps(steps: FormWizardIndicatorStepWithState[]): FormWizardIndicatorRenderProps {
  return {
    steps,
    goToStep: () => true,
    currentStep: 1,
    totalSteps: steps.length,
    completedSteps: [],
  };
}

describe('StepIndicator', () => {
  it('несёт role="navigation" и aria-label «Шаги формы»', () => {
    const html = renderToStaticMarkup(
      <StepIndicator
        {...indicatorProps([step({ isCurrent: true }), step({ number: 2, title: 'Данные' })])}
      />
    );
    expect(html).toContain('role="navigation"');
    expect(html).toContain('aria-label="Шаги формы"');
    expect(html).toContain('data-testid="step-indicator"');
  });

  it('текущий шаг помечен aria-current="step"', () => {
    const html = renderToStaticMarkup(
      <StepIndicator {...indicatorProps([step({ isCurrent: true })])} />
    );
    expect(html).toContain('aria-current="step"');
  });

  it('завершённый шаг рендерит галочку ✓ вместо иконки', () => {
    const html = renderToStaticMarkup(
      <StepIndicator {...indicatorProps([step({ isCompleted: true, icon: '💰' })])} />
    );
    expect(html).toContain('✓');
  });

  it('переопределяет aria-label контейнера', () => {
    const html = renderToStaticMarkup(
      <StepIndicator {...indicatorProps([step()])} navAriaLabel="Этапы заявки" />
    );
    expect(html).toContain('aria-label="Этапы заявки"');
  });
});

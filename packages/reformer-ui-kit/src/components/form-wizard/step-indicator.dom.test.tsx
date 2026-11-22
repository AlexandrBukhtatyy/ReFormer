// @vitest-environment happy-dom
/**
 * StepIndicator в DOM: клавиатура шага. `role="button"` обязывает к поведению нативной кнопки —
 * Enter и Space (ReFormer-d0j); SSR-тест (`form-wizard.test.tsx`) событий не видит.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormWizardIndicatorStepWithState } from '@reformer/cdk/form-wizard';
import { StepIndicator } from './index';

afterEach(cleanup);

const steps: FormWizardIndicatorStepWithState[] = [
  {
    number: 1,
    title: 'Кредит',
    icon: '1',
    isCurrent: false,
    isCompleted: true,
    canNavigate: true,
  },
  { number: 2, title: 'Данные', icon: '2', isCurrent: true, isCompleted: false, canNavigate: true },
  { number: 3, title: 'Итог', icon: '3', isCurrent: false, isCompleted: false, canNavigate: false },
];

function renderIndicator() {
  const goToStep = vi.fn(() => true);
  render(
    <StepIndicator
      steps={steps}
      goToStep={goToStep}
      currentStep={2}
      totalSteps={3}
      completedSteps={[1]}
    />
  );
  return goToStep;
}

describe('StepIndicator — клавиатура', () => {
  it('Space на доступном шаге переходит к нему и не прокручивает страницу', () => {
    const goToStep = renderIndicator();
    const target = screen.getByTestId('step-indicator-1');

    // Было: срабатывал только Enter.
    const notPrevented = fireEvent.keyDown(target, { key: ' ' });

    expect(goToStep).toHaveBeenCalledWith(1);
    expect(notPrevented).toBe(false);
  });

  it('Enter по-прежнему переходит к шагу', () => {
    const goToStep = renderIndicator();
    fireEvent.keyDown(screen.getByTestId('step-indicator-1'), { key: 'Enter' });
    expect(goToStep).toHaveBeenCalledWith(1);
  });

  it('недоступный шаг на Space и Enter не реагирует', () => {
    const goToStep = renderIndicator();
    const locked = screen.getByTestId('step-indicator-3');
    fireEvent.keyDown(locked, { key: ' ' });
    fireEvent.keyDown(locked, { key: 'Enter' });
    expect(goToStep).not.toHaveBeenCalled();
  });

  it('прочие клавиши не перехватываются (Tab уходит дальше)', () => {
    const goToStep = renderIndicator();
    const notPrevented = fireEvent.keyDown(screen.getByTestId('step-indicator-1'), { key: 'Tab' });
    expect(notPrevented).toBe(true);
    expect(goToStep).not.toHaveBeenCalled();
  });
});

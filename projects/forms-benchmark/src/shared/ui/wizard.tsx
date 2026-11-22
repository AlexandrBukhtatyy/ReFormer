/**
 * Разметка визарда, общая для всех реализаций (BENCH-CONTRACT §3–4). Состояния нет: номер шага,
 * переходы и проверку шага держит библиотека.
 *
 * - `StepIndicator` — список шагов и заголовок текущего (`step-current`, `data-step` с 1);
 * - `WizardNav` — «Назад» (`btn-prev`, на шаге 1 есть, но `disabled` — кнопки не сдвигаются между
 *   шагами), «Далее» (`btn-next`, шаги 1…n−1), «Отправить» (`btn-submit`, последний шаг, `type="submit"`);
 * - `WizardShell` — индикатор + содержимое шага + навигация.
 *
 * «Далее» с `onNext` — `type="button"` и обработчик клика; без `onNext` — `type="submit"`, переход
 * делает `onSubmit` формы библиотеки (паттерн Formik MultistepWizard, `<Form>` шага в RJSF). Кнопки
 * должны оказаться внутри `<form>` библиотеки, если на них завязана отправка: тогда `WizardShell`
 * (или `WizardNav`) рендерится внутри формы.
 */
import type { ReactNode } from 'react';
import { SubmitButton } from './layout';
import { countRender, registerPrimitives } from './instrument';

export interface WizardStepTitle {
  title: string;
}

export interface StepIndicatorProps {
  /** Текущий шаг, с 1. */
  step: number;
  steps: readonly WizardStepTitle[];
}

export function StepIndicator({ step, steps }: StepIndicatorProps) {
  countRender('StepIndicator');
  return (
    <>
      <ol className="b-steps">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={i + 1 === step ? 'b-steps__item b-steps__item--current' : 'b-steps__item'}
            aria-current={i + 1 === step ? 'step' : undefined}
          >
            {s.title}
          </li>
        ))}
      </ol>
      <h2 className="b-step-title" data-testid="step-current" data-step={step}>
        {`Шаг ${step} из ${steps.length}. ${steps[step - 1]?.title ?? ''}`}
      </h2>
    </>
  );
}

export interface WizardNavProps {
  step: number;
  /** Последний шаг: вместо «Далее» — «Отправить». */
  isLast: boolean;
  onPrev: () => void;
  /** Нет — «Далее» становится `type="submit"`. */
  onNext?: () => void;
}

export function WizardNav({ step, isLast, onPrev, onNext }: WizardNavProps) {
  countRender('WizardNav');
  return (
    <div className="b-actions">
      <button
        type="button"
        className="b-button b-button--ghost"
        data-testid="btn-prev"
        disabled={step === 1}
        onClick={onPrev}
      >
        Назад
      </button>
      {isLast ? (
        <SubmitButton key="submit" />
      ) : (
        <button
          key="next"
          type={onNext ? 'button' : 'submit'}
          className="b-button"
          data-testid="btn-next"
          onClick={onNext}
        >
          Далее
        </button>
      )}
    </div>
  );
}

export interface WizardShellProps extends StepIndicatorProps {
  onPrev: () => void;
  onNext?: () => void;
  /** По умолчанию — `step === steps.length`. */
  isLast?: boolean;
  children: ReactNode;
}

export function WizardShell({ step, steps, onPrev, onNext, isLast, children }: WizardShellProps) {
  countRender('WizardShell');
  return (
    <>
      <StepIndicator step={step} steps={steps} />
      {children}
      <WizardNav
        step={step}
        isLast={isLast ?? step === steps.length}
        onPrev={onPrev}
        onNext={onNext}
      />
    </>
  );
}

registerPrimitives({ StepIndicator, WizardNav, WizardShell });

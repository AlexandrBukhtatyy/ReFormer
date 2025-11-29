import type { ReactNode } from 'react';
import type { GroupNodeWithControls, ValidationSchemaFn, FormValue } from 'reformer';

/**
 * Конфигурация multi-step формы
 */
export interface StepNavigationConfig<T extends Record<string, FormValue>> {
  /** Общее количество шагов */
  totalSteps: number;

  /** Схемы валидации для каждого шага */
  stepValidations: Record<number, ValidationSchemaFn<T>>;

  /** Полная схема валидации (для submit) */
  fullValidation: ValidationSchemaFn<T>;
}

/**
 * Handle для внешнего доступа к методам StepNavigation через ref
 */
export interface StepNavigationHandle<T extends Record<string, FormValue>> {
  /** Текущий шаг (1-based) */
  currentStep: number;

  /** Завершенные шаги */
  completedSteps: number[];

  /** Валидировать текущий шаг */
  validateCurrentStep: () => Promise<boolean>;

  /** Перейти на следующий шаг (с валидацией) */
  goToNextStep: () => Promise<boolean>;

  /** Перейти на предыдущий шаг */
  goToPreviousStep: () => void;

  /** Перейти на конкретный шаг */
  goToStep: (step: number) => boolean;

  /** Отправить форму (с полной валидацией) */
  submit: <R>(onSubmit: (values: T) => Promise<R> | R) => Promise<R | null>;

  /** Первый ли это шаг */
  isFirstStep: boolean;

  /** Последний ли это шаг */
  isLastStep: boolean;

  /** Идёт ли валидация */
  isValidating: boolean;
}

/**
 * Состояние, передаваемое в render props
 */
export interface StepNavigationRenderState {
  /** Текущий шаг (1-based) */
  currentStep: number;

  /** Завершенные шаги */
  completedSteps: number[];

  /** Первый ли это шаг */
  isFirstStep: boolean;

  /** Последний ли это шаг */
  isLastStep: boolean;

  /** Идёт ли валидация */
  isValidating: boolean;
}

/**
 * Props для компонента StepNavigation
 */
export interface StepNavigationProps<T extends Record<string, FormValue>> {
  /** Форма */
  form: GroupNodeWithControls<T>;

  /** Конфигурация шагов */
  config: StepNavigationConfig<T>;

  /** Содержимое (функция, принимающая состояние навигации) */
  children: (state: StepNavigationRenderState) => ReactNode;

  /** Callback при смене шага */
  onStepChange?: (step: number) => void;

  /** Прокручивать страницу наверх при смене шага */
  scrollToTop?: boolean;
}

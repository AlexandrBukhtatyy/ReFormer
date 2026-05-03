/**
 * Step - маркер-компонент для определения шага в wizard-схеме
 *
 * Используется в RenderSchema для определения метаданных шага (title, icon).
 * Фактический рендеринг выполняется wizard-компонентом, который извлекает
 * метаданные из componentProps.
 *
 * @module form-wizard/Step
 *
 * @example
 * ```tsx
 * // В схеме
 * {
 *   selector: 'step:1',
 *   component: Step,
 *   componentProps: { title: 'Личные данные', icon: '👤' },
 *   children: [
 *     { component: path.firstName },
 *     { component: path.lastName },
 *   ],
 * }
 * ```
 */

import type { ReactNode } from 'react';

/**
 * Props для Step компонента
 */
export interface StepProps {
  /** Заголовок шага (отображается в индикаторе) */
  title: string;
  /** Иконка шага (emoji или текст) */
  icon?: string;
  /** CSS класс */
  className?: string;
  /** Дочерние элементы */
  children?: ReactNode;
}

/**
 * Step - маркер-компонент для wizard-схемы
 *
 * Компонент просто рендерит children. Метаданные (title, icon) извлекаются
 * wizard-компонентом из componentProps через useFormWizardSelectors.
 */
export function Step({ children }: StepProps): ReactNode {
  return <>{children}</>;
}

Step.displayName = 'Step';

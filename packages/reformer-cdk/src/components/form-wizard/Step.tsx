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
 *     { value: model.$.firstName, component: Input },
 *     { value: model.$.lastName, component: Input },
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
 *
 * @internal Используется внутри пакета через `FormWizard.Step`; намеренно не
 * выведен в главный `index.ts` как самостоятельный публичный компонент.
 */
export function Step({ children }: StepProps): ReactNode {
  return <>{children}</>;
}

Step.displayName = 'Step';

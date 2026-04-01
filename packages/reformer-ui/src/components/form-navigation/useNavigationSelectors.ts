/**
 * useNavigationSelectors - утилита для парсинга selector-based children в wizard-компонентах
 *
 * @module form-navigation/useNavigationSelectors
 */

import { useMemo } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { RenderNode } from '@reformer/core';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Доступные селекторы для wizard-навигации
 */
export type WizardSelector = 'indicator' | `step:${number}` | 'actions' | 'progress';

/**
 * Props для компонентов indicator/actions/progress
 */
export interface WizardComponentProps {
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

/**
 * Узел с селектором для wizard-компонента
 */
export interface WizardSelectorNode<T = unknown> {
  /** Селектор определяет тип узла */
  selector: WizardSelector;

  /** React-компонент (для indicator/actions/progress/step) */
  component?: ComponentType<WizardComponentProps>;

  /** Props для компонента (включая title/icon для step) */
  componentProps?: {
    title?: string;
    icon?: string;
    className?: string;
    children?: WizardSelectorNode<T>[];
    [key: string]: unknown;
  };

  /** Дочерние узлы для step:N (поля формы) */
  children?: RenderNode<T>[];
}

/**
 * Метаданные шага, извлечённые из componentProps
 */
export interface StepMetadata {
  /** Номер шага (1-based, извлекается из селектора) */
  number: number;
  /** Заголовок шага */
  title: string;
  /** Иконка шага (emoji или текст) */
  icon?: string;
}

/**
 * Результат парсинга selector-based children
 */
export interface ParsedWizardSelectors<T = unknown> {
  /** Узел индикатора шагов */
  indicator: WizardSelectorNode<T> | undefined;
  /** Узлы шагов (отсортированные по номеру) */
  stepNodes: WizardSelectorNode<T>[];
  /** Метаданные шагов для индикатора */
  steps: StepMetadata[];
  /** Узел кнопок навигации */
  actions: WizardSelectorNode<T> | undefined;
  /** Узел прогресса */
  progress: WizardSelectorNode<T> | undefined;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Извлекает номер шага из селектора 'step:N'
 */
export function parseStepNumber(selector: string): number {
  const match = selector.match(/^step:(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Хук для парсинга selector-based children в wizard-компонентах
 *
 * Разбирает массив children с селекторами и возвращает структурированный объект
 * с indicator, stepNodes, steps, actions и progress.
 *
 * @example
 * ```tsx
 * function MyWizard({ children }) {
 *   const { indicator, stepNodes, steps, actions } = useNavigationSelectors(children);
 *
 *   return (
 *     <FormNavigation form={form}>
 *       {indicator && <FormNavigation.Indicator steps={steps}>...</FormNavigation.Indicator>}
 *
 *       {stepNodes.map(stepNode => (
 *         <FormNavigation.Step key={stepNode.selector}>
 *           {stepNode.children?.map(child => <RenderNodeComponent node={child} />)}
 *         </FormNavigation.Step>
 *       ))}
 *
 *       {actions && <FormNavigation.Actions>...</FormNavigation.Actions>}
 *     </FormNavigation>
 *   );
 * }
 * ```
 */
export function useNavigationSelectors<T = unknown>(
  children: WizardSelectorNode<T>[]
): ParsedWizardSelectors<T> {
  return useMemo(() => {
    // Фильтруем и сортируем шаги
    const stepNodes = children
      .filter((c) => c.selector.startsWith('step:'))
      .sort((a, b) => parseStepNumber(a.selector) - parseStepNumber(b.selector));

    // Извлекаем метаданные шагов из componentProps
    const steps: StepMetadata[] = stepNodes.map((node) => ({
      number: parseStepNumber(node.selector),
      title: (node.componentProps?.title as string) || `Step ${parseStepNumber(node.selector)}`,
      icon: node.componentProps?.icon as string | undefined,
    }));

    return {
      indicator: children.find((c) => c.selector === 'indicator'),
      stepNodes,
      steps,
      actions: children.find((c) => c.selector === 'actions'),
      progress: children.find((c) => c.selector === 'progress'),
    };
  }, [children]);
}

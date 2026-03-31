/**
 * FormArray - компонент для рендеринга массивов в RenderSchema
 *
 * Используется как маркер типа в ArrayRenderNode.
 * Фактический рендеринг массива выполняется в RenderNodeComponent.
 *
 * @module core/render/components/form-array
 */

import type { ReactNode } from 'react';

/**
 * Props компонента FormArray
 *
 * Компонент не рендерится напрямую - он используется как маркер типа
 * для распознавания ArrayRenderNode в RenderNodeComponent.
 */
export interface FormArrayProps {
  /** CSS класс для контейнера */
  className?: string;
  /** Дочерние элементы (рендерятся RenderNodeComponent) */
  children?: ReactNode;

  /** Ссылка на массив (path.items) - типизируется через ArrayRenderNodeProps */
  array?: unknown;

  /** Условие скрытия массива */
  hidden?: unknown;
}

/**
 * FormArray - маркерный компонент для массивов
 *
 * Этот компонент не рендерится напрямую. Он используется как
 * дискриминатор типа в RenderSchema для определения ArrayRenderNode.
 *
 * Фактический рендеринг массива выполняется в RenderNodeComponent,
 * который использует selector-based children для определения частей массива.
 *
 * @example
 * ```typescript
 * {
 *   component: FormArray,
 *   componentProps: {
 *     array: path.items,
 *     children: [
 *       { selector: 'header', component: HeaderComponent },
 *       { selector: 'empty', component: EmptyComponent },
 *       {
 *         selector: 'item',
 *         render: (itemPath) => ({
 *           component: Box,
 *           componentProps: { children: [{ component: itemPath.name }] },
 *         }),
 *       },
 *     ],
 *   },
 * }
 * ```
 */
export function FormArray({ className, children }: FormArrayProps): ReactNode {
  return <div className={className}>{children}</div>;
}

/**
 * Уникальный маркер для TypeScript-дискриминации ArrayRenderNode.
 * Без него Box/Section структурно совместимы с typeof FormArray (все props optional),
 * что мешает TypeScript правильно определять union-член при contextual typing.
 */
FormArray.__isFormArray = true as const;

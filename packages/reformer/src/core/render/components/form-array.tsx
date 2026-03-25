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
}

/**
 * FormArray - маркерный компонент для массивов
 *
 * Этот компонент не рендерится напрямую. Он используется как
 * дискриминатор типа в RenderSchema для определения ArrayRenderNode.
 *
 * Фактический рендеринг массива выполняется в RenderNodeComponent,
 * который итерирует по элементам массива и вызывает renderItem.
 *
 * @example
 * ```typescript
 * {
 *   component: FormArray,
 *   componentProps: {
 *     array: path.items,
 *     renderItem: (itemPath) => ({
 *       component: Box,
 *       componentProps: {
 *         children: [
 *           { component: itemPath.name },
 *         ],
 *       },
 *     }),
 *   },
 * }
 * ```
 */
export function FormArray({ className, children }: FormArrayProps): ReactNode {
  return <div className={className}>{children}</div>;
}

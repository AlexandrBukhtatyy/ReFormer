/**
 * Типы для RenderSchema - декларативное описание структуры страницы формы
 *
 * RenderSchema отвечает только за layout и условия отображения,
 * а не за конфигурацию полей (это делает ModelSchema).
 *
 * @module core/render/types
 */

import type { ComponentType, ElementType } from 'react';
import type { FieldPath, FieldPathNode, FormProxy } from '../types';
import type { FormArray } from './components/form-array';

// ============================================================================
// RENDER SCHEMA
// ============================================================================

/**
 * Функция создания RenderSchema
 *
 * Принимает типизированный path для доступа к полям и возвращает
 * дерево узлов рендеринга.
 *
 * @example
 * ```typescript
 * const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
 *   component: Box,
 *   componentProps: {
 *     className: 'flex flex-col gap-4',
 *     children: [
 *       { component: path.email },
 *       { component: path.password },
 *     ],
 *   },
 * });
 * ```
 */
export type RenderSchemaFn<T> = (path: FieldPath<T>) => RenderNode<T>;

// ============================================================================
// RENDER NODE - дискриминированный union
// ============================================================================

/**
 * Узел рендеринга формы
 *
 * Дискриминированный union из трёх типов узлов:
 * - FieldRenderNode - поле формы
 * - ContainerRenderNode - контейнер (Box, Section, etc.)
 * - ArrayRenderNode - рендеринг массива элементов
 */
export type RenderNode<T> = FieldRenderNode<T> | ContainerRenderNode<T> | ArrayRenderNode<T>;

// ============================================================================
// FIELD RENDER NODE
// ============================================================================

/**
 * Props для FieldRenderNode
 */
export interface FieldRenderNodeProps<T> {
  /** CSS класс для wrapper элемента */
  className?: string;

  /** Wrapper элемент (по умолчанию 'div') */
  wrapper?: ElementType;

  /** Условие скрытия поля */
  hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
}

/**
 * Узел рендеринга поля формы
 *
 * Ссылается на поле через FieldPathNode из path.
 *
 * @example
 * ```typescript
 * { component: path.email }
 * { component: path.email, componentProps: { className: 'col-span-2' } }
 * ```
 */
export interface FieldRenderNode<T> {
  /** Ссылка на поле формы (path.fieldName) */
  component: FieldPathNode<T, unknown, unknown>;

  /** Props для рендеринга поля */
  componentProps?: FieldRenderNodeProps<T>;
}

// ============================================================================
// CONTAINER RENDER NODE
// ============================================================================

/**
 * Props для ContainerRenderNode
 */
export interface ContainerRenderNodeProps<T> {
  /** CSS класс для контейнера */
  className?: string;

  /** Дочерние узлы */
  children?: RenderNode<T>[];

  /** Условие скрытия контейнера */
  hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;

  /** Произвольные props для компонента контейнера */
  [key: string]: unknown;
}

/**
 * Узел контейнера (Box, Section, Collapsible и т.д.)
 *
 * @example
 * ```typescript
 * {
 *   component: Section,
 *   componentProps: {
 *     title: 'Личные данные',
 *     className: 'grid grid-cols-2 gap-4',
 *     children: [
 *       { component: path.firstName },
 *       { component: path.lastName },
 *     ],
 *   },
 * }
 * ```
 */
export interface ContainerRenderNode<T> {
  /** React-компонент контейнера */
  component: ComponentType<ContainerComponentProps>;

  /** Props для компонента */
  componentProps?: ContainerRenderNodeProps<T>;
}

// ============================================================================
// ARRAY RENDER NODE
// ============================================================================

/**
 * Props для ArrayRenderNode
 */
export interface ArrayRenderNodeProps<T, TItem = unknown> {
  /** Ссылка на массив (path.items) */
  array: FieldPathNode<T, TItem[], unknown>;

  /** CSS класс для контейнера массива */
  className?: string;

  /** Функция рендеринга элемента массива */
  renderItem: (itemPath: FieldPath<TItem>, index: number) => RenderNode<TItem>;

  /** Условие скрытия массива */
  hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
}

/**
 * Узел рендеринга массива
 *
 * @example
 * ```typescript
 * {
 *   component: FormArray,
 *   componentProps: {
 *     array: path.items,
 *     className: 'flex flex-col gap-4',
 *     renderItem: (itemPath, index) => ({
 *       component: Box,
 *       componentProps: {
 *         className: 'grid grid-cols-3 gap-2',
 *         children: [
 *           { component: itemPath.product },
 *           { component: itemPath.quantity },
 *           { component: itemPath.price },
 *         ],
 *       },
 *     }),
 *   },
 * }
 * ```
 */
export interface ArrayRenderNode<T> {
  /** Компонент FormArray */
  component: typeof FormArray;

  /** Props для FormArray */
  componentProps: ArrayRenderNodeProps<T>;
}

// ============================================================================
// FORM RENDERER
// ============================================================================

/**
 * Props для FormRenderer
 */
export interface FormRendererProps<T> {
  /** Proxy формы (результат createForm) */
  form: FormProxy<T>;

  /** Функция создания RenderSchema */
  render: RenderSchemaFn<T>;
}

// ============================================================================
// CONTAINER COMPONENT PROPS
// ============================================================================

/**
 * Базовые props для компонентов-контейнеров
 */
export interface ContainerComponentProps {
  /** CSS класс */
  className?: string;

  /** Дочерние элементы (рендерятся FormRenderer) */
  children?: React.ReactNode;

  /** Произвольные дополнительные props */
  [key: string]: unknown;
}

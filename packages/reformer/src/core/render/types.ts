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
import type { FormArray, FormArrayProps } from './components/form-array';

// ============================================================================
// SELECTOR TYPES - для декларативного FormArray
// ============================================================================

/**
 * Доступные селекторы для FormArray
 */
export type FormArraySelector =
  | 'header'
  | 'empty'
  | 'item'
  | 'item:header'
  | 'item:content'
  | 'item:footer'
  | 'footer';

/**
 * Узел с селектором для FormArray
 *
 * Позволяет декларативно определять части FormArray через селекторы.
 */
export interface SelectorRenderNode<T, TItem = unknown> {
  /** Селектор определяет где будет отрендерен этот узел */
  selector: FormArraySelector;

  /** React-компонент для рендеринга */
  component?: ComponentType<ContainerComponentProps>;

  /** Props для компонента */
  componentProps?: ContainerRenderNodeProps<T> & {
    /** Вложенные узлы с селекторами */
    children?: SelectorRenderNode<T, TItem>[];
  };

  /**
   * Функция рендеринга для item:content
   * Получает путь к элементу и индекс
   */
  render?: (itemPath: FieldPath<TItem>, index: number) => RenderNode<TItem>;
}

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
 * - ContainerRenderNode - контейнер (Box, Section, wizard и т.д.)
 * - ArrayRenderNode - рендеринг массива элементов
 */
export type RenderNode<T> = FieldRenderNode<T> | ContainerRenderNode<T> | ArrayRenderNode<T>;

// ============================================================================
// FIELD RENDER NODE
// ============================================================================

/**
 * Props для FieldRenderNode
 */
export interface FieldRenderNodeProps {
  /** CSS класс для wrapper элемента */
  className?: string;

  /** Wrapper элемент (по умолчанию 'div') */
  wrapper?: ElementType;

  /**
   * Компонент-обёртка для этого поля (переопределяет глобальный fieldWrapper)
   *
   * @example
   * ```typescript
   * { component: path.email, componentProps: { fieldWrapper: CustomFieldWrapper } }
   * ```
   */
  fieldWrapper?: ComponentType<FieldWrapperProps>;
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
  component: FieldPathNode<unknown, unknown, unknown>;

  /** Условие скрытия узла */
  hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;

  /** Props для рендеринга поля */
  componentProps?: FieldRenderNodeProps;
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
  /** Slot-идентификатор для составных компонентов (например, wizard) */
  selector?: string;

  /** React-компонент контейнера */
  component: ComponentType<ContainerComponentProps>;

  /** Условие скрытия узла */
  hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;

  /** Props для компонента */
  componentProps?: ContainerRenderNodeProps<T>;
}

// ============================================================================
// ARRAY RENDER NODE
// ============================================================================

/**
 * Props для ArrayRenderNode
 *
 * Использует selector-based API с children для полной гибкости.
 * Каждый child определяет свою часть через selector: 'header', 'empty', 'item', 'footer'.
 */
export interface ArrayRenderNodeProps<T, TItem = unknown> extends Omit<
  FormArrayProps,
  'array' | 'hidden' | 'children'
> {
  /** Ссылка на массив (path.items) */
  array: FieldPathNode<T, TItem[], unknown>;

  /** Дочерние узлы с селекторами (header, empty, item, footer) */
  children: SelectorRenderNode<T, TItem>[];
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
 *     className: 'bg-white p-4 rounded-lg shadow',
 *     children: [
 *       { selector: 'header', component: HeaderComponent },
 *       { selector: 'empty', component: EmptyComponent },
 *       {
 *         selector: 'item',
 *         component: Box,
 *         componentProps: {
 *           className: 'p-4 border rounded mb-4',
 *           children: [
 *             { selector: 'item:header', component: ItemHeader },
 *             {
 *               selector: 'item:content',
 *               render: (itemPath) => ({
 *                 component: Box,
 *                 componentProps: {
 *                   className: 'grid grid-cols-3 gap-2',
 *                   children: [
 *                     { component: itemPath.product },
 *                     { component: itemPath.quantity },
 *                     { component: itemPath.price },
 *                   ],
 *                 },
 *               }),
 *             },
 *           ],
 *         },
 *       },
 *     ],
 *   },
 * }
 * ```
 */
export interface ArrayRenderNode<T> {
  /** Компонент FormArray */
  component: typeof FormArray;

  /** Условие скрытия узла */
  hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;

  /** Props для FormArray */
  componentProps: ArrayRenderNodeProps<T>;
}

// ============================================================================
// FORM RENDERER
// ============================================================================

/**
 * Props для компонента-обёртки поля
 *
 * Обёртка получает control и рендерит label, input и errors.
 */
export interface FieldWrapperProps {
  /** Контрол поля */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  /** CSS класс */
  className?: string;
  /** Дочерний элемент (отрендеренный input) */
  children: React.ReactNode;
}

/**
 * Props для FormRenderer
 */
export interface FormRendererProps<T> {
  /** Proxy формы (результат createForm) */
  form: FormProxy<T>;

  /** Функция создания RenderSchema */
  render: RenderSchemaFn<T>;

  /**
   * Компонент-обёртка для полей (опционально)
   *
   * Если указан, каждое поле будет обёрнуто этим компонентом.
   * Обёртка отвечает за рендеринг label, errors и т.д.
   *
   * @example
   * ```tsx
   * <FormRenderer
   *   form={form}
   *   render={renderSchema}
   *   fieldWrapper={FormField}
   * />
   * ```
   */
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
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

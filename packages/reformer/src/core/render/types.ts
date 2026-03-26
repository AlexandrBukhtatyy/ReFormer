/**
 * Типы для RenderSchema - декларативное описание структуры страницы формы
 *
 * RenderSchema отвечает только за layout и условия отображения,
 * а не за конфигурацию полей (это делает ModelSchema).
 *
 * @module core/render/types
 */

import type { ComponentType, ElementType, ReactNode } from 'react';
import type { FieldPath, FieldPathNode, FormProxy } from '../types';
import type { FormArray, FormArrayProps } from './components/form-array';

// ============================================================================
// ARRAY UI CONFIG - конфигурация UI для массивов
// ============================================================================

/**
 * Конфигурация заголовка массива
 */
export interface ArrayUIHeaderConfig {
  /** Заголовок секции */
  title?: string;
  /** CSS класс заголовка */
  titleClassName?: string;
  /** Текст/содержимое кнопки добавления */
  addButton?: ReactNode;
  /** CSS класс кнопки добавления */
  addButtonClassName?: string;
  /** CSS класс контейнера заголовка */
  className?: string;
}

/**
 * Конфигурация пустого состояния массива
 */
export interface ArrayUIEmptyConfig {
  /** Основное сообщение */
  message: ReactNode;
  /** Дополнительная подсказка */
  hint?: ReactNode;
  /** CSS класс контейнера */
  className?: string;
  /** CSS класс подсказки */
  hintClassName?: string;
}

/**
 * Конфигурация рендеринга элемента массива
 *
 * Объединяет функцию рендеринга контента и UI конфигурацию элемента.
 */
export interface ArrayRenderItemConfig<TItem> {
  /** Функция рендеринга контента элемента */
  render: (itemPath: FieldPath<TItem>, index: number) => RenderNode<TItem>;

  /** CSS класс обёртки элемента */
  wrapper?: string;
  /** Показывать индекс элемента */
  showIndex?: boolean;
  /** Метка перед индексом (например "Адрес") */
  indexLabel?: string;
  /** CSS класс индекса */
  indexClassName?: string;
  /** Текст/содержимое кнопки удаления */
  removeButton?: ReactNode;
  /** CSS класс кнопки удаления */
  removeButtonClassName?: string;
  /** CSS класс заголовка элемента (контейнер индекса и кнопки удаления) */
  headerClassName?: string;
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
 *
 * Расширяет FormArrayProps с точной типизацией для array и renderItem.
 */
export interface ArrayRenderNodeProps<T, TItem = unknown> extends Omit<
  FormArrayProps,
  'array' | 'renderItem' | 'hidden' | 'item'
> {
  /** Ссылка на массив (path.items) */
  array: FieldPathNode<T, TItem[], unknown>;

  /** Конфигурация элемента массива (функция рендеринга + UI) */
  renderItem: ArrayRenderItemConfig<TItem>;

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
 *     className: 'bg-white p-4 rounded-lg shadow',
 *     renderItem: {
 *       render: (itemPath, index) => ({
 *         component: Box,
 *         componentProps: {
 *           className: 'grid grid-cols-3 gap-2',
 *           children: [
 *             { component: itemPath.product },
 *             { component: itemPath.quantity },
 *             { component: itemPath.price },
 *           ],
 *         },
 *       }),
 *       wrapper: 'p-4 border rounded mb-4',
 *       showIndex: true,
 *       removeButton: 'Удалить',
 *     },
 *     header: { title: 'Товары', addButton: '+ Добавить' },
 *     empty: { message: 'Нет товаров' },
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

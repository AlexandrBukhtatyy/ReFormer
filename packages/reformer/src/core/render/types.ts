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
 * Дискриминированный union из четырёх типов узлов:
 * - FieldRenderNode - поле формы
 * - ContainerRenderNode - контейнер (Box, Section, etc.)
 * - ArrayRenderNode - рендеринг массива элементов
 * - NavigationRenderNode - multi-step навигация
 */
export type RenderNode<T> =
  | FieldRenderNode<T>
  | ContainerRenderNode<T>
  | ArrayRenderNode<T>
  | NavigationRenderNode<T>;

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

  /** Props для FormArray */
  componentProps: ArrayRenderNodeProps<T>;
}

// ============================================================================
// NAVIGATION RENDER NODE
// ============================================================================

/**
 * Доступные селекторы для FormNavigation
 *
 * - 'indicator' - индикатор шагов (заголовки, иконки, номера)
 * - 'step:N' - содержимое шага N (step:1, step:2, ...)
 * - 'actions' - кнопки навигации (Назад, Далее, Отправить)
 * - 'progress' - информация о прогрессе (шаг X из Y)
 */
export type FormNavigationSelector = 'indicator' | `step:${number}` | 'actions' | 'progress';

/**
 * Конфигурация шага для индикатора
 */
export interface NavigationStepConfig {
  /** Номер шага (1-based) */
  number: number;
  /** Заголовок шага */
  title: string;
  /** Иконка шага (emoji или текст) */
  icon?: string;
}

/**
 * Props для компонентов indicator/actions/progress
 */
export interface NavigationComponentProps {
  /** CSS класс */
  className?: string;
  /** Дочерние элементы */
  children?: React.ReactNode;
  /** Произвольные дополнительные props */
  [key: string]: unknown;
}

/**
 * Узел с селектором для FormNavigation
 *
 * @example
 * ```typescript
 * // Индикатор шагов
 * { selector: 'indicator', component: StepIndicator }
 *
 * // Содержимое шага
 * {
 *   selector: 'step:1',
 *   children: [
 *     { component: path.firstName },
 *     { component: path.lastName },
 *   ]
 * }
 *
 * // Кнопки навигации
 * { selector: 'actions', component: NavigationActions }
 * ```
 */
export interface NavigationSelectorRenderNode<T> {
  /** Селектор определяет где будет отрендерен этот узел */
  selector: FormNavigationSelector;

  /** React-компонент (для indicator/actions/progress) */
  component?: React.ComponentType<NavigationComponentProps>;

  /** Props для компонента */
  componentProps?: ContainerRenderNodeProps<T>;

  /** Дочерние узлы для step:N (поля формы) */
  children?: RenderNode<T>[];
}

/**
 * Props для NavigationRenderNode
 */
export interface NavigationRenderNodeProps<T> {
  /** Конфигурация шагов (для индикатора) */
  steps: NavigationStepConfig[];

  /** Валидация по шагам (1-based) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stepValidations?: Record<number, any>;

  /** Полная валидация при отправке */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullValidation?: any;

  /** Дочерние узлы с селекторами */
  children: NavigationSelectorRenderNode<T>[];

  /** Callback при отправке */
  onSubmit?: (values: T) => Promise<void> | void;

  /** Callback при смене шага */
  onStepChange?: (step: number) => void;

  /** Прокрутка вверх при смене шага */
  scrollToTop?: boolean;

  /** CSS класс для контейнера шагов */
  className?: string;

  /** Условие скрытия */
  hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
}

/**
 * Узел рендеринга multi-step навигации
 *
 * @example
 * ```typescript
 * const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
 *   component: FormNavigation,
 *   componentProps: {
 *     steps: STEPS,
 *     stepValidations: STEP_VALIDATIONS,
 *     fullValidation: myValidation,
 *     onSubmit: handleSubmit,
 *     children: [
 *       { selector: 'indicator', component: StepIndicator },
 *       { selector: 'step:1', children: [{ component: path.email }] },
 *       { selector: 'step:2', children: [{ component: path.password }] },
 *       { selector: 'actions', component: NavigationActions },
 *       { selector: 'progress', component: NavigationProgress },
 *     ],
 *   },
 * });
 * ```
 */
export interface NavigationRenderNode<T> {
  /** Компонент FormNavigation (маркер типа) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any; // typeof FormNavigation - будет проверяться через isNavigationRenderNode

  /** Props для FormNavigation */
  componentProps: NavigationRenderNodeProps<T>;
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

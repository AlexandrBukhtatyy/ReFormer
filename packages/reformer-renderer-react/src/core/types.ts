/**
 * Типы для RenderSchema - декларативное описание структуры страницы формы
 *
 * RenderSchema отвечает только за layout и условия отображения,
 * а не за конфигурацию полей (это делает ModelSchema).
 *
 * @module reformer/renderer-react/types
 */

import type { ComponentType, ElementType } from 'react';
import type { FieldPath, FieldPathNode } from '@reformer/core';

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
 * Дискриминированный union из двух типов узлов:
 * - FieldRenderNode - поле формы
 * - ContainerRenderNode - контейнер (Box, Section, wizard и т.д.)
 */
export type RenderNode<T> = FieldRenderNode | ContainerRenderNode<T>;

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
 * { selector: 'email-field', component: path.email }  // selector для renderBehavior
 * ```
 */
export interface FieldRenderNode {
  /**
   * Идентификатор узла для renderBehavior (b.hideWhen).
   * Необязателен — нужен только если к полю привязано поведение.
   */
  selector?: string;

  /** Ссылка на поле формы (path.fieldName) */
  component: FieldPathNode<unknown, unknown, unknown>;

  /** Props для рендеринга поля */
  componentProps?: FieldRenderNodeProps;
}

// ============================================================================
// CONTAINER RENDER NODE
// ============================================================================

/**
 * Props для ContainerRenderNode
 *
 * Произвольные props для компонента-контейнера.
 * Дочерние узлы задаются через `ContainerRenderNode.children`, а не здесь.
 */
export interface ContainerRenderNodeProps {
  /** CSS класс для контейнера */
  className?: string;

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
  /**
   * Идентификатор узла — используется составными компонентами (wizard, tabs)
   * и renderBehavior (b.hideWhen).
   */
  selector?: string;

  /** React-компонент контейнера */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;

  /** Дочерние узлы рендеринга */
  children?: RenderNode<T>[];

  /** Props для компонента-контейнера (className, title и т.д.) */
  componentProps?: ContainerRenderNodeProps;
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
 * Настройки рендерера формы
 */
export interface RendererSettings {
  /**
   * Компонент-обёртка для полей (опционально)
   *
   * Если указан, каждое поле будет обёрнуто этим компонентом.
   * Обёртка отвечает за рендеринг label, errors и т.д.
   */
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

/**
 * Props для FormRenderer
 */
export interface FormRendererProps<T> {
  /** Функция создания RenderSchema (или RenderSchemaProxy из createRenderSchema) */
  render: RenderSchemaFn<T>;

  /**
   * Настройки рендерера
   *
   * @example
   * ```tsx
   * <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
   * ```
   */
  settings?: RendererSettings;
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

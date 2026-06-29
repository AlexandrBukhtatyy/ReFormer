/**
 * Типы для RenderSchema - декларативное описание структуры страницы формы
 *
 * RenderSchema отвечает только за layout и условия отображения,
 * а не за конфигурацию полей (это делает ModelSchema).
 *
 * @module reformer/renderer-react/types
 */

import type { ComponentType, ElementType } from 'react';
import type { Signal } from '@preact/signals-core';

// ============================================================================
// RENDER SCHEMA
// ============================================================================

/**
 * Функция создания RenderSchema (M1).
 *
 * Возвращает дерево узлов рендеринга. Привязка к данным — через сигналы модели в листьях
 * (`value: model.$.x`), поэтому аргумент-путь больше не нужен (legacy FieldPath удалён).
 *
 * @example
 * ```typescript
 * const renderSchema: RenderSchemaFn<MyForm> = () => ({
 *   component: Box,
 *   children: [
 *     { value: model.$.email, component: Input },
 *     { value: model.$.password, component: InputPassword },
 *   ],
 * });
 * ```
 */
export type RenderSchemaFn<T> = () => RenderNode<T>;

// ============================================================================
// RENDER NODE - дискриминированный union
// ============================================================================

/**
 * Узел рендеринга формы
 *
 * Дискриминированный union из типов узлов:
 * - ModelFieldRenderNode — поле формы, привязанное к СИГНАЛУ модели (M1, единая схема)
 * - ArrayRenderNode — массив модели (M1): данные `{ array, item }`, рендер-секция
 * - ContainerRenderNode — контейнер (Box, Section, wizard и т.д.)
 */
export type RenderNode<T> = ModelFieldRenderNode | ArrayRenderNode<T> | ContainerRenderNode<T>;

// ============================================================================
// MODEL FIELD / ARRAY RENDER NODE (M1 — единая схема, привязка через сигнал)
// ============================================================================

/**
 * Узел-поле единой схемы (M1): значение приходит из СИГНАЛА модели (`model.$.x`),
 * `component` + `componentProps` — конфиг поля (как в схеме формы). State-нода (errors/disabled)
 * резолвится по сигналу через реестр сигнал→нода (заполняется `createForm`).
 *
 * @example
 * ```typescript
 * { value: model.$.loanType, component: Select, componentProps: { label: 'Тип', options } }
 * ```
 */
export interface ModelFieldRenderNode {
  selector?: string;
  /** Сигнал значения из модели (`model.$.<path>`). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: Signal<any>;
  /** UI-компонент поля. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  /** Props компонента (+ опц. `testId`/`className`/`fieldWrapper`/`wrapper`). */
  componentProps?: Record<string, unknown> & {
    testId?: string;
    className?: string;
    fieldWrapper?: ComponentType<FieldWrapperProps>;
    wrapper?: ElementType;
  };
}

/** Минимальный контракт реактивного массива модели (`model.<path>`), используемый рендерером. */
export interface RenderModelArrayControl {
  readonly __path: string;
  readonly length: number;
  at(index: number): unknown;
  push(item: unknown): void;
  removeAt(index: number): void;
}

/**
 * Узел-массив единой схемы (M1): данные принадлежат модели (`array`), форма элемента описывается
 * `item(itemModel)`. `createForm` материализует `ModelArrayNode` (по `{ array, item }`), рендерер
 * итерирует элементы и рисует поддерево `item(itemModel)` (листья на сигналах под-модели).
 *
 * @example
 * ```typescript
 * { array: model.coBorrowers, initialValue: createBlankCoBorrower,
 *   item: (im) => ({ component: Box, children: [{ value: im.$.phone, component: Input }] }) }
 * ```
 */
export interface ArrayRenderNode<T> {
  selector?: string;
  /** Реактивный массив модели (`model.<path>`). */
  array: RenderModelArrayControl;
  /** Схема элемента: под-модель элемента → узел поддерева. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: (itemModel: any) => RenderNode<T>;
  /** Значение (или фабрика) нового элемента для кнопки «Добавить». */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValue?: unknown | (() => any);
  /** Оформление секции массива. */
  componentProps?: {
    title?: string;
    addButtonLabel?: string;
    removeButtonLabel?: string;
    emptyMessage?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemLabel?: string | ((itemModel: any, index: number) => string);
    className?: string;
    cardClassName?: string;
    [key: string]: unknown;
  };
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
 * Узел контейнера (Box, Section, Collapsible и т.д.).
 *
 * **Важно:** `children` — это TOP-LEVEL свойство узла, НЕ часть `componentProps`.
 * Если положить `children` внутрь `componentProps`, то `node.children` будет undefined
 * и рендерер ничего не отрисует (он деструктурирует `const { children } = node`).
 *
 * @example
 * ```typescript
 * {
 *   component: Section,
 *   componentProps: {
 *     title: 'Личные данные',
 *     className: 'grid grid-cols-2 gap-4',
 *   },
 *   children: [
 *     { component: path.firstName },
 *     { component: path.lastName },
 *   ],
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
  /**
   * testId для генерации data-testid на wrapper/label/error.
   * Выводится рендерером из FieldPath или переопределяется через componentProps.testId.
   */
  testId?: string;
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

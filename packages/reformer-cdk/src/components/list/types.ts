import type { ReactNode, ElementType } from 'react';
import type { ArrayNode, ModelArrayNode, FormProxy } from '@reformer/core';

/**
 * Узел массива, принимаемый CDK-компонентом {@link List}.
 *
 * Идентичен {@link FormArrayControl} — legacy {@link ArrayNode} (владеет элементами) ИЛИ M1
 * {@link ModelArrayNode} (делегирует массиву модели). `List` использует лишь read-часть контракта
 * (`map`/`at`/`length`/`value`), поэтому мутационные методы здесь не нужны, но union тот же:
 * консументы M1 (у которых `form.<field>` материализуется как ModelArrayNode) не должны кастовать.
 */
export type ListControl<T extends object> = ArrayNode<T> | ModelArrayNode<T>;

/**
 * Один элемент списка — контрол, индекс и стабильный ключ. В отличие от
 * {@link FormArrayItemRenderProps} НЕ несёт мутационных/reorder-хелперов: `List` — display-итерация.
 */
export interface ListItem<T extends object> {
  /** Контрол для данного элемента */
  control: FormProxy<T>;
  /** Индекс элемента (0-based) */
  index: number;
  /** Уникальный идентификатор для React key */
  id: string | number;
}

/**
 * Props for List.Root component
 */
export interface ListRootProps<T extends object> {
  /** Массив-контрол из формы — legacy ArrayNode или M1 ModelArrayNode */
  control: ListControl<T>;
  /** Дочерние компоненты */
  children: ReactNode;
}

/**
 * Props for List.Items component
 */
export interface ListItemsProps<T extends object> {
  /** Render-функция для каждого элемента */
  children: (item: ListItem<T>) => ReactNode;
  /** Опциональный className контейнера */
  className?: string;
  /** Опциональный тег контейнера (по умолчанию Fragment, если нет className) */
  as?: ElementType;
}

/**
 * Props for List.Empty component
 */
export interface ListEmptyProps {
  /** Содержимое, показываемое когда список пуст */
  children: ReactNode;
}

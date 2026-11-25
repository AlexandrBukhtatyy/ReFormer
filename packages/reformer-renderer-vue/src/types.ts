/**
 * Типы рендерера Vue: что получают компоненты реестра.
 *
 * @module renderer-vue/types
 */

import type { Component, VNodeChild } from 'vue';
import type { CompiledNode, FormControl } from '@reformer/core';
import type { FieldAdapter } from '@reformer/core/render';

/** Пропсы обёртки поля. Контрол приходит слотом по умолчанию. */
export interface FieldWrapperProps {
  /** Нода поля: значение, замечания, `touched`, `disabled`. */
  control: FormControl<unknown>;
  /** `data-testid`-основа поля: явная из схемы либо путь поля через дефис. */
  testId?: string;
}

/** Настройки рендерера. */
export interface RendererSettings {
  /**
   * Обёртка поля: подпись, ошибка, описание. Без неё рендерер кладёт контрол в `div` (или в
   * `wrapper` из пропсов поля) — так рисуются киты, где подпись и ошибку показывает сам контрол.
   */
  fieldWrapper?: Component;
  /**
   * Диалект контрола для компонента, у которого нет статики `reformerAdapter` (чужая библиотека).
   * Найденный адаптер главнее статики.
   */
  resolveFieldAdapter?: (component: unknown) => FieldAdapter | undefined;
}

/**
 * Отрисовать узел схемы. Приходит пропом `renderNode` компоненту, который ведёт детей сам
 * (`__selfManagedChildren`): так компонент библиотеки рисует полученные узлы, не зная о рендерере.
 */
export type RenderNodeFn = (node: CompiledNode, key?: string | number) => VNodeChild;

/**
 * Пропсы компонента, который ведёт детей сам (визард, вкладки): статика
 * `__selfManagedChildren = true`. Оба пропса компонент обязан объявить — необъявленный проп Vue
 * отдал бы атрибутом корневому элементу.
 */
export interface SelfManagedProps {
  /** Узлы-дети данными; текстовые части такому компоненту не отдаются. */
  children?: readonly CompiledNode[];
  /** Способ отрисовать узел. */
  renderNode: RenderNodeFn;
}

/** Строка массива, уже отрисованная рендерером. */
export interface ArrayItemSlot {
  /** Стабильный ключ строки — по идентичности под-модели элемента. */
  key: number;
  /** Живой индекс элемента в массиве модели — для `onRemove(index)` и `onMove(index, …)`. */
  index: number;
  /** Под-модель элемента — для подписи строки. */
  model?: unknown;
  /** Поддерево строки: компонент массива вставляет его в свою разметку как есть. */
  children: VNodeChild;
}

/**
 * Пропсы компонента массива (`component` узла-массива) — к ним добавляются `componentProps` узла.
 * Итерацию, области строк и ключи делает рендерер; компоненту остаётся оформление и кнопки.
 */
export interface ArrayComponentProps {
  items: readonly ArrayItemSlot[];
  /** Добавить элемент по шаблону массива. */
  onAdd: () => void;
  /** Удалить элемент по индексу модели. */
  onRemove: (index: number) => void;
  /** Переставить элемент; индексы — модели. */
  onMove: (from: number, to: number) => void;
}

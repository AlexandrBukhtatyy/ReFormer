/**
 * Типы рендерера Angular: что получают компоненты реестра.
 *
 * @module renderer-angular/types
 */

import type { Type } from '@angular/core';
import type { CompiledNode, CompiledSchema, FormControl, FormSchemaNode } from '@reformer/core';
import type { FieldAdapter } from '@reformer/core/render';

/**
 * Входы обёртки поля. Контрол приходит содержимым — `<ng-content />` в шаблоне обёртки. Вход,
 * которого обёртка не объявила, рендерер ей не передаёт.
 */
export interface FieldWrapperInputs {
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
  fieldWrapper?: Type<unknown>;
  /**
   * Диалект контрола для компонента, у которого нет статики `reformerAdapter` (чужая библиотека).
   * Найденный адаптер главнее статики.
   */
  resolveFieldAdapter?: (component: unknown) => FieldAdapter | undefined;
}

/**
 * Входы компонента, который ведёт детей сам (визард, вкладки): статика
 * `__selfManagedChildren = true`. Узлы он рисует директивой `reformerNode` в своём шаблоне.
 */
export interface SelfManagedInputs {
  /** Узлы-дети данными; текстовые части такому компоненту не отдаются. */
  children?: readonly CompiledNode[];
}

/** Содержимое строки массива — для директивы `reformerArrayItem`; компонент его не разбирает. */
export interface ArrayItemContent {
  /** Скомпилированная схема строки: её модель — ключ области строки. У примитива области нет. */
  readonly schema: CompiledSchema | undefined;
  /** Корневой узел строки. */
  readonly node: CompiledNode | FormSchemaNode;
  /** Обёртка полей строки. */
  readonly fieldWrapper: Type<unknown> | undefined;
}

/** Строка массива: данные для разметки и содержимое, которое рисует директива `reformerArrayItem`. */
export interface ArrayItemSlot {
  /** Стабильный ключ строки — по идентичности под-модели элемента; для `track` в `@for`. */
  readonly key: number;
  /** Живой индекс элемента в массиве модели — для `onRemove(index)` и `onMove(index, …)`. */
  readonly index: number;
  /** Под-модель элемента — для подписи строки. */
  readonly model?: unknown;
  /** Поддерево строки: `<ng-container [reformerArrayItem]="item" />`. */
  readonly content: ArrayItemContent;
}

/**
 * Входы компонента массива (`component` узла-массива) — к ним добавляются `componentProps` узла.
 * Итерацию, области строк и ключи делает рендерер; компоненту остаётся оформление и кнопки.
 *
 * Колбэки объявляются входами, а не выходами: у `onMove` два аргумента, а выход Angular несёт
 * одно значение.
 */
export interface ArrayComponentInputs {
  items: readonly ArrayItemSlot[];
  /** Добавить элемент по шаблону массива. */
  onAdd: () => void;
  /** Удалить элемент по индексу модели. */
  onRemove: (index: number) => void;
  /** Переставить элемент; индексы — модели. */
  onMove: (from: number, to: number) => void;
}

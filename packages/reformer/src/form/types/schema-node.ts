/**
 * Тип узла схемы формы.
 *
 * Схема — дерево узлов, которое обходят два места:
 *  - `createFormFromModel({ model, schema })` — привязывает конфиг поля к ноде по идентичности
 *    ручки модели и запоминает схемы строк массивов;
 *  - рендерер (`@reformer/renderer-react`) — рисует то же дерево.
 *
 * Правила валидации это дерево не несёт: они живут в отдельной `ValidationSchema`
 * (`@reformer/core/validation`).
 *
 * Узел — один из четырёх видов; вид определяют ключи `model`, `item`, `part` и `children`:
 *
 * | Вид              | Ключи                              |
 * | ---------------- | ---------------------------------- |
 * | поле             | `model` — лист или массив целиком  |
 * | массив под-форм  | `model` — массив + `item`          |
 * | подформа         | `model` — группа + `part`          |
 * | контейнер        | `children`                         |
 *
 * Вложенные узлы читаются только из `children` и из поддерева `part`; в `componentProps` и под
 * произвольными ключами обход не заглядывает.
 *
 * @group Types
 * @module form/types/schema-node
 */

import type { ElementType } from 'react';
import type { Signal } from '../../signals';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Контракт реактивного массива модели — фасада `model.<массив>`. Рендерерский
 * `RenderModelArrayControl` — его расширение (добавляет `move`).
 *
 * @group Types
 */
export interface SchemaArrayControl {
  /** Путь массива в модели (dot-нотация) — нужен для резолва узла массива. */
  readonly __path: string;
  /** Реактивная длина. */
  readonly length: number;
  at(index: number): unknown;
  push(item?: unknown): void;
  removeAt(index: number): void;
}

/**
 * Ручка значения из дерева `model.$`: лист (`model.$.email`) или массив целиком
 * (`model.$.tags`). Группа ручкой значения не является — у неё нет пути.
 *
 * @group Types
 */
export type SchemaValueHandle = Signal<any> & { readonly __path: string };

/**
 * Ручка массива из дерева `model.$` (`model.$.phones`) — ручка значения с длиной.
 *
 * @group Types
 */
export type SchemaArrayHandle = SchemaValueHandle & { readonly length: number };

/**
 * Ручка группы из дерева `model.$` (`model.$.address`).
 *
 * @group Types
 */
export interface SchemaGroupHandle {
  peek(): object | null | undefined;
  /** Признак «не ручка значения»: у листа и массива путь есть, у группы — нет. */
  readonly __path?: never;
}

/** Ключи, общие для узла любого вида. */
interface SchemaNodeBase {
  /**
   * UI-компонент либо нативный HTML-тег (`'div'`, `'p'`, `'h3'`) для презентационной вёрстки
   * прямо в схеме. Опционален: ядро работает без UI и `component` не интерпретирует — он доезжает
   * до рендерера как есть.
   */
  component?: ElementType;
  /**
   * Пропсы компонента. Вложенных узлов здесь нет: обход схемы в пропсы не заглядывает, дети узла
   * пишутся в `children`.
   */
  componentProps?: Record<string, unknown>;
  /** Идентификатор узла: по нему узел адресуют поведение (`schema.node(...)`) и шаги визарда. */
  selector?: string;
}

/**
 * Поле: узел, привязанный к ручке значения — листу или массиву целиком (мультивыбор, теги, файлы).
 *
 * @example
 * ```ts
 * { model: model.$.email, component: Input, componentProps: { label: 'Email' } }
 * ```
 *
 * @group Types
 */
export interface SchemaFieldNode extends SchemaNodeBase {
  /** Привязка поля — ручка значения `model.$.<лист | массив>`. */
  model: SchemaValueHandle;
  /** Поле создаётся отключённым. */
  disabled?: boolean;
  item?: never;
  part?: never;
  children?: never;
}

/**
 * Массив под-форм: у каждой строки своя форма, разметку строки строит `item`.
 *
 * @example
 * ```ts
 * { model: model.$.phones, component: FormArray, item: (row) => ({ children: [...] }) }
 * ```
 *
 * @group Types
 */
export interface SchemaArrayNode extends SchemaNodeBase {
  /** Привязка — ручка массива `model.$.<массив>`. */
  model: SchemaArrayHandle;
  /** Схема строки: под-модель строки → узел поддерева. */
  item: (model: any) => FormSchemaNode;
  /**
   * Шаблон нового элемента массива для кнопки «Добавить»: либо готовое значение, либо фабрика
   * `() => value`. Запасной путь — для форм, чья модель создаётся из данных без кода: шаблон,
   * объявленный в модели (`arrayOf(blank)`), главнее.
   *
   * Тип не различает варианты (union `unknown | (() => unknown)` схлопывается в `unknown`) —
   * рантайм различает по `typeof initialValue === 'function'`.
   */
  initialValue?: unknown;
  part?: never;
  children?: never;
}

/**
 * Подформа: часть схемы, подключённая к группе модели. Часть объявляется один раз и подключается
 * к любой группе той же формы данных; привязки внутри части идут через `$` полученной под-модели.
 *
 * @example
 * ```ts
 * { model: model.$.registrationAddress, part: address }
 * ```
 *
 * @group Types
 */
export interface SchemaPartNode extends SchemaNodeBase {
  /** Привязка — ручка группы `model.$.<группа>`. */
  model: SchemaGroupHandle;
  /** Часть схемы: под-модель группы → узел поддерева. */
  part: (model: any) => FormSchemaNode;
  item?: never;
  children?: never;
}

/** Ребёнок контейнера: вложенный узел либо текстовая часть — литерал, число, сигнал модели. */
export type SchemaChild = FormSchemaNode | string | number | Signal<any>;

/**
 * Контейнер: узел с детьми (секция, шаг визарда, html-тег). Текст — такой же ребёнок, как узел:
 * ядро его не интерпретирует, а рендерер выводит на своём месте в порядке следования.
 *
 * @example
 * ```ts
 * { component: Section, componentProps: { title: 'Контакты' }, children: [phoneField, emailField] }
 * ```
 *
 * @group Types
 */
export interface SchemaContainerNode extends SchemaNodeBase {
  children?: readonly SchemaChild[];
  model?: never;
  item?: never;
  part?: never;
}

/**
 * Узел схемы формы: поле, массив под-форм, подформа или контейнер — см. описание модуля.
 *
 * Тип закрыт: опечатка в ключе, группа без `part` и `item` не на массиве — ошибки компиляции.
 *
 * @group Types
 */
export type FormSchemaNode =
  | SchemaFieldNode
  | SchemaArrayNode
  | SchemaPartNode
  | SchemaContainerNode;

/* eslint-enable @typescript-eslint/no-explicit-any */

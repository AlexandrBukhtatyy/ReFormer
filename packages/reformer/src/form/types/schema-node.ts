/**
 * Тип узла единой схемы (M1).
 *
 * Схема формы под архитектурой M1 — это дерево узлов, которое обходят три места:
 *  - `createForm({ model, schema })` (`harvestFieldConfig`) — сбор конфига полей по идентичности
 *    сигнала + item-фабрик массивов;
 *  - `validateModel`/`validateFormModel`/`validateModelSync` (`walk`/`collect`) — валидация данных;
 *  - рендерер (`@reformer/renderer-react`: `RenderNode`) — отрисовка того же дерева.
 *
 * ⚠️ Не путать с {@link FormSchema} — та описывает **data-shaped** конфиг (ключи повторяют структуру
 * данных `T`, `{ field: FieldConfig }`) и служит формой конфига для {@link GroupNode}. `FormSchemaNode`
 * же — **узел дерева** M1-схемы (лист/массив/контейнер), передаваемой в `createForm({ model, schema })`.
 *
 * Обход рекурсивен по идентичности сигнала (`node.value instanceof Signal`) и НЕ ограничен ключом
 * `children`: узлы могут лежать в `children`, в `componentProps.*` (напр. steps визарда) или под
 * произвольными именованными ключами (core-target раскладывает поля как
 * `{ loanType: { value, component }, borrowerAge: { … }, … }`). Поэтому тип узла — намеренно
 * «открытый» (известные поля типизированы + индексная сигнатура для свободной вложенности), а не
 * строгий discriminated union: union отверг бы валидную запись record-of-fields.
 *
 * @group Types
 * @module core/types/schema-node
 */

import type { ElementType } from 'react';
// type-only импорт из barrel: schema-node реэкспортится из `./index`, поэтому образуется
// type-only цикл `index ↔ schema-node`, который стирается при emit (рантайм-цикла нет).
import type { ValidationError } from './contracts';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Валидатор поля схемы. Узел хранит validators гетерогенно: движок `validate*` вызывает их как
 * `(value, scope, root)`, но сюда кладут любой контракт — `ValidatorFn` (value),
 * `Validator` (value, control, root) или `ModelValidator` (value, model, root). Поэтому тип
 * намеренно широкий по параметрам.
 *
 * @group Types
 */
export type SchemaValidator = (
  value: any,
  ...rest: any[]
) => ValidationError | null | Promise<ValidationError | null>;

/**
 * Минимальный контракт реактивного массива модели ({@link FormSchemaNode.array}).
 * Совпадает по форме с рантайм-фасадом `model.<array>` (см. `ModelArray`); рендерерский
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
  push(item: unknown): void;
  removeAt(index: number): void;
}

/**
 * Узел единой схемы M1 — дерево, обходимое `createForm({ model, schema })`,
 * `validateModel`/`validateFormModel` и рендерерами.
 *
 * Узел совмещает несколько ролей (различаются рантаймом по форме):
 *  - **поле** — несёт `value: Signal` (сигнал модели `model.$.x`) + `component`/`validators`;
 *  - **массив** — `{ array: model.<path>, item(itemModel) }`;
 *  - **контейнер/ветка** — вложенные узлы (`children`), опц. условие `when`;
 *  - **record-of-fields** — под-узлы под произвольными именованными ключами (индексная сигнатура).
 *
 * Индексная сигнатура (`[key: string]: unknown`) отражает свободный рекурсивный обход: под-узлы
 * допустимы под любым ключом. Известные поля типизированы (даёт автокомплит и проверку их типов).
 *
 * @group Types
 */
export interface FormSchemaNode {
  /**
   * «Ручка» значения поля — маркер узла-поля. Обычно сигнал модели (`model.$.<path>`), но форма
   * зависит от таргета (для массива `model.$.x` — дерево сигналов; в renderer-типах сужается до
   * `Signal`). Движок разбирает узел как поле рантаймом по `value instanceof Signal`.
   */
  value?: unknown;
  /**
   * UI-компонент либо нативный HTML-тег (`'div'`, `'p'`, `'h3'`) для презентационной вёрстки
   * прямо в схеме. Опционален: core-часть работает без UI (значение/валидация) и `component`
   * не интерпретирует — он доезжает до рендерера как есть.
   */
  component?: ElementType;
  /** Props компонента. Также «клапан» для вложенности под-узлов (напр. steps визарда). */
  componentProps?: Record<string, unknown>;
  validators?: SchemaValidator[];
  asyncValidators?: SchemaValidator[];
  updateOn?: 'change' | 'blur' | 'submit';
  disabled?: boolean;
  /** Задержка (мс) перед запуском асинхронной валидации. */
  debounce?: number;
  /** Идентификатор узла (для wizard/tabs/renderBehavior). */
  selector?: string;
  testId?: string;
  /** Дочерние узлы (даёт контекстную типизацию вложенным литералам — value/validators/when). */
  children?: readonly FormSchemaNode[];
  /** Условие включения поддерева (branch-узел `{ when, children }`). */
  when?: (scope: any, root: any) => boolean;
  /** Реактивный массив модели (`model.<path>`) — маркер узла-массива (вместе с `item`). */
  array?: SchemaArrayControl;
  /** Схема элемента массива: под-модель элемента → узел поддерева. */
  item?: (itemModel: any) => FormSchemaNode;
  /**
   * Значение нового элемента массива для кнопки «Добавить»: либо готовое значение,
   * либо фабрика `() => value`. Тип не различает варианты (union `unknown | (() => unknown)`
   * схлопывается в `unknown`) — рантайм различает по `typeof initialValue === 'function'`.
   */
  initialValue?: unknown;
  /** Свободная вложенность: record-of-fields и произвольные под-узлы. */
  [key: string]: unknown;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Тип узла единой схемы (M1).
 *
 * Схема формы под архитектурой M1 — это layout-дерево узлов, которое обходят два места:
 *  - `createFormFromModel({ model, schema })` (`harvestFieldConfig`) — сбор конфига полей по идентичности
 *    сигнала + item-фабрик массивов;
 *  - рендерер (`@reformer/renderer-react`: `RenderNode`) — отрисовка того же дерева.
 *
 * Schema-валидация это дерево НЕ обходит: правила живут в отдельной `ValidationSchema`
 * (`@reformer/core/validation`, раннер `validateModel(model, schema)`).
 *
 * ⚠️ Не путать с {@link FormSchema} — та описывает **data-shaped** конфиг (ключи повторяют структуру
 * данных `T`, `{ field: FieldConfig }`) и служит формой конфига для {@link GroupNode}. `FormSchemaNode`
 * же — **узел дерева** M1-схемы (лист/массив/контейнер), передаваемой в `createFormFromModel({ model, schema })`.
 *
 * Обход рекурсивен по идентичности сигнала (`node.value instanceof Signal`) и НЕ ограничен ключом
 * `children`: узлы могут лежать в `children`, в `componentProps.*` (напр. steps визарда) или под
 * произвольными именованными ключами (core-target раскладывает поля как
 * `{ loanType: { value, component }, borrowerAge: { … }, … }`). Поэтому тип узла — намеренно
 * «открытый» (известные поля типизированы + индексная сигнатура для свободной вложенности), а не
 * строгий discriminated union: union отверг бы валидную запись record-of-fields.
 *
 * @group Types
 * @module form/types/schema-node
 */

import type { ElementType } from 'react';
import type { Signal } from '../../signals';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  push(item?: unknown): void;
  removeAt(index: number): void;
}

/**
 * Узел единой схемы M1 — layout-дерево, обходимое `createFormFromModel({ model, schema })`
 * и рендерерами (schema-валидация живёт отдельно — `@reformer/core/validation`).
 *
 * Узел совмещает несколько ролей (различаются рантаймом по форме):
 *  - **поле** — `{ model: model.$.x, component, componentProps }`;
 *  - **массив под-форм** — `{ model: model.$.items, item: (model) => узел }`;
 *  - **подформа** — `{ model: model.$.group, part: (model) => узел }`;
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
   * Привязка узла к части модели — ручка из дерева `model.$`. Чем узел является, решают ручка и
   * соседние ключи:
   *  - лист или массив (`model.$.email`, `model.$.tags`) — **поле**;
   *  - массив вместе с {@link FormSchemaNode.item} — **массив под-форм**;
   *  - группа вместе с {@link FormSchemaNode.part} — **подформа**.
   *
   * Узел распознаётся по значению, а не по имени ключа: в записи «имя поля → узел» поле данных
   * может называться `model`, и тогда под этим ключом лежит обычный вложенный узел.
   */
  model?: unknown;
  /**
   * Прежняя запись привязки поля — то же, что {@link FormSchemaNode.model}.
   *
   * @deprecated Пишите `model: model.$.<path>`.
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
  updateOn?: 'change' | 'blur' | 'submit';
  disabled?: boolean;
  /** Задержка (мс) перед запуском асинхронной валидации. */
  debounce?: number;
  /** Идентификатор узла (для wizard/tabs/renderBehavior). */
  selector?: string;
  /**
   * ⚠️ Рантайм этого поля НЕ ЧИТАЕТ — `renderer-react` берёт testId из `componentProps.testId`
   * (иначе выводит из пути сигнала). Поле оставлено только потому, что `RenderSchemaNode`
   * рендерера объявляет свой одноимённый; пишите `componentProps: { testId: '…' }`.
   */
  testId?: string;
  /**
   * Содержимое узла: под-узлы (даёт контекстную типизацию вложенным литералам — value/validators/when)
   * и текстовые части. Текст (литерал, число, сигнал модели) — такой же ребёнок, как узел: core его
   * не интерпретирует (обход пропускает примитивы и не спускается внутрь сигнала), а рендерер
   * выводит на своём месте в порядке следования.
   */
  children?: readonly (FormSchemaNode | string | number | Signal<any>)[];
  /**
   * Прежняя запись привязки массива под-форм — фасад `model.<path>` (вместе с `item`).
   *
   * @deprecated Пишите `model: model.$.<path>`.
   */
  array?: SchemaArrayControl;
  /** Схема элемента массива: под-модель элемента → узел поддерева. */
  item?: (model: any) => FormSchemaNode;
  /**
   * Подформа: под-модель группы → узел поддерева. Часть объявляется один раз и подключается к
   * любой группе той же формы данных: `{ model: model.$.registrationAddress, part: address }`.
   * Привязки внутри части идут через `$` полученной под-модели.
   */
  part?: (model: any) => FormSchemaNode;
  /**
   * Шаблон нового элемента массива для кнопки «Добавить»: либо готовое значение, либо фабрика
   * `() => value`. Запасной путь — для форм, чья модель создаётся из данных без кода: шаблон,
   * объявленный в модели (`arrayOf(blank)`), главнее.
   *
   * Тип не различает варианты (union `unknown | (() => unknown)` схлопывается в `unknown`) —
   * рантайм различает по `typeof initialValue === 'function'`.
   */
  initialValue?: unknown;
  /** Свободная вложенность: record-of-fields и произвольные под-узлы. */
  [key: string]: unknown;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

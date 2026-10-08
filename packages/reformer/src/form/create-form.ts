/**
 * Низкоуровневая фабрика формы: из модели и готового дерева схемы ({@link createFormFromModel}).
 *
 * Сборка одним вызовом — модель, форма, валидация и дерево для рендера — живёт в `form-bundle`
 * (`createForm`) и зовёт {@link createFormFromModel}.
 *
 * @group Utilities
 * @module form/create-form
 */

import type { Signal } from '@preact/signals-core';
import { FieldNode } from './nodes/field-node';
import type { FormNode } from './nodes/form-node';
import { GroupNode } from './nodes/group-node';
import { ModelArrayNode } from './nodes/model-array-node';
import { registerSignalNode } from './signal-node-registry';
import {
  isModelArraySignal,
  isModelContainerSignal,
  isValueSignal,
} from '../model/model-signals-proxy';
import {
  arrayHandleOf,
  groupHandleOf,
  isModelFacade,
  modelOf,
  provideArrayBlank,
} from '../model/model-value-proxy';
import { schemaSubtree } from './schema-subtree';
import type { FormProxy, FieldConfig } from './types/index';
import type { FormSchemaNode } from './types/schema-node';
import type { FormModel } from '../model/types';
import type { FormBehavior } from './behaviors';
import type { SchemaController } from './schema-controller';

/**
 * Аргументы createForm под архитектуру M1: данные приходят из {@link FormModel},
 * конфиг полей (component/componentProps) — из единой схемы.
 *
 * @group Utilities
 */
export interface CreateFormFromModelArgs<T> {
  /** Реактивная модель данных (источник истины значений). */
  model: FormModel<T>;
  /**
   * Схема — дерево узлов {@link FormSchemaNode}. Сборка обходит её и привязывает конфиг поля к
   * ноде по идентичности ручки (`node.model === model.$.<path>`). Опциональна.
   */
  schema?: FormSchemaNode;
  /**
   * Декларативная схема поведения ({@link defineFormBehavior}). Запускается ПОСЛЕ построения нод и
   * заполнения реестра сигнал→нода; cleanup живёт на форме и вызывается в `form.dispose()`.
   */
  behavior?: FormBehavior<T>;
  /**
   * Схема-контроллер сборки: через него поведение получает `schema` своей области. Его передаёт
   * сборка одним вызовом, чтобы правила узлов (`hideWhen`, `onComponentEvent`) дошли до рендерера.
   * Без него поведение пишет правила в собственный контроллер, который никто не читает.
   */
  schemaController?: SchemaController;
}

/**
 * Конфиг поля по его «ручке значения»: сигналу листа либо узлу-массиву дерева `model.$`
 * (см. {@link isValueSignal}). Ключ — идентичность ручки, поэтому тип ключа — `object`.
 * Сигнал значения в конфиг добавляет сборка нод — он и есть ручка.
 */
type HarvestedConfig = Map<object, Omit<FieldConfig<unknown>, 'valueSignal'>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ItemSchemaBuilder = (item: any) => FormSchemaNode;
/**
 * Item-схемы массивов под-форм. Ключ — ручка массива (`model.$.<массив>`), а не путь: путь
 * абсолютный (`items.0.phones`), а форма строки обходит модель строки от её корня (`phones`).
 */
type ArrayItemBuilders = Map<object, ItemSchemaBuilder>;

/** Ключи узла схемы, которые читает ядро или рендерер. */
const NODE_KEYS = new Set([
  'model',
  'item',
  'part',
  'children',
  'component',
  'componentProps',
  'selector',
  'disabled',
  'initialValue',
]);

/** Чем заменить ключ узла, который раньше что-то значил. */
const KEY_HINTS: Record<string, string> = {
  value: 'привязка поля — `model: model.$.<поле>`',
  array: 'привязка массива под-форм — `model: model.$.<массив>`',
};

/** Что обход собрал помимо конфига полей — для dev-проверок сборки. */
interface HarvestReport {
  /** Ключи узлов, которые обход не читает: опечатка либо узлы под произвольными ключами. */
  readonly unknownKeys: Set<string>;
}

/**
 * Обход схемы: собирает конфиг поля по ручке значения и схемы строк массивов по ручке массива.
 *
 * Узел — один из четырёх видов (см. {@link FormSchemaNode}):
 *  - поле — `{ model: model.$.<лист | массив>, component }`;
 *  - массив под-форм — `{ model: model.$.<массив>, item: (model) => узел }`;
 *  - подформа — `{ model: model.$.<группа>, part: (model) => узел }`;
 *  - контейнер — `{ children: [...] }`.
 *
 * Вложенные узлы читаются только из `children` и из поддерева `part`: в `componentProps` и под
 * произвольными ключами обход не заглядывает. Ключи, которые он не читает, копятся в `report`.
 */
function harvestFieldConfig(
  schema: unknown,
  map: HarvestedConfig,
  arrayItems: ArrayItemBuilders,
  visited: WeakSet<object>,
  report: HarvestReport
): void {
  if (schema == null || typeof schema !== 'object') return;
  // Текстовая часть `children` — сигнал модели: это содержимое, а не узел.
  if (isValueSignal(schema) || isModelContainerSignal(schema) || isModelFacade(schema)) return;
  // Одно и то же поддерево может стоять в дереве дважды — каждый узел обходим один раз.
  if (visited.has(schema)) return;
  visited.add(schema);
  const node = schema as Record<string, unknown>;

  if (process.env.NODE_ENV !== 'production') {
    for (const key of Object.keys(node)) if (!NODE_KEYS.has(key)) report.unknownKeys.add(key);
  }

  // Вид узла определяют ключи и ЗНАЧЕНИЕ привязки. Порядок проверок важен: ручка массива — тоже
  // ручка значения, поэтому массив под-форм узнаётся раньше поля.

  // Массив под-форм: { model: model.$.<массив>, item: (model) => узел }.
  if (typeof node.item === 'function') {
    const handle = arrayHandleOf(node.model);
    if (handle) {
      arrayItems.set(handle, node.item as ItemSchemaBuilder);
      // Шаблон нового элемента из схемы — запасной: шаблон модели (`arrayOf`) главнее.
      if (node.initialValue !== undefined) provideArrayBlank(handle, node.initialValue);
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[reformer] createForm({ schema }): у узла с `item` привязка — не массив модели, узел ' +
          'пропущен. Ожидается `model: model.$.<массив>`; начальное значение поля должно быть ' +
          'массивом, а не `null`.'
      );
    }
    return; // внутрь item-фабрики не идём (вызовется для каждой строки при её построении)
  }

  // Подформа: { model: model.$.<группа>, part: (model) => узел }. Отдельной формы у части нет —
  // поля группы принадлежат этой же форме, поэтому её поддерево обходится тут же.
  if (typeof node.part === 'function') {
    const handle = groupHandleOf(node.model);
    if (handle) {
      const subModel = modelOf(handle as { peek(): object });
      const subtree = schemaSubtree(node.part as ItemSchemaBuilder, subModel as object);
      harvestFieldConfig(subtree, map, arrayItems, visited, report);
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[reformer] createForm({ schema }): у узла с `part` привязка — не группа модели, узел ' +
          'пропущен. Ожидается `model: model.$.<группа>`.'
      );
    }
    return;
  }

  // Поле — узел с ручкой значения: лист ИЛИ массив целиком (мультивыбор, теги, список файлов).
  if (isValueSignal(node.model)) {
    map.set(node.model, {
      component: node.component as FieldConfig<unknown>['component'],
      componentProps: node.componentProps,
      disabled: node.disabled as boolean | undefined,
    });
    return;
  }
  if (node.model != null && process.env.NODE_ENV !== 'production') {
    // Узел с привязкой, которая не ручка значения. Частые причины: `model: model.<path>`
    // (value-фасад) вместо `model: model.$.<path>` либо группа без `part`.
    console.warn(
      '[reformer] createForm({ schema }): привязка узла не распознана — узел не стал полем. ' +
        'Ожидается `model: model.$.<path>` (лист или массив); проверьте, что не передан ' +
        '`model: model.<path>` (value-фасад) или группа без `part`.'
    );
  }

  // Контейнер: дети — узлы и текстовые части.
  if (Array.isArray(node.children)) {
    for (const child of node.children) harvestFieldConfig(child, map, arrayItems, visited, report);
  }
}

/** Dev-предупреждение о ключах узлов, которые обход схемы не читает. */
function warnUnknownNodeKeys(report: HarvestReport): void {
  if (report.unknownKeys.size === 0) return;
  const keys = [...report.unknownKeys];
  const hints = keys
    .filter((key) => key in KEY_HINTS)
    .map((key) => `\`${key}\`: ${KEY_HINTS[key]}`);
  console.warn(
    '[reformer] createForm({ schema }): у узлов схемы есть ключи, которые сборка не читает: ' +
      `${keys.map((key) => `\`${key}\``).join(', ')}. Узел описывают \`model\`, \`item\`, ` +
      '`part`, `children`, `component`, `componentProps`, `selector`, `disabled` и ' +
      '`initialValue`; вложенные узлы читаются только из `children`.' +
      (hints.length > 0 ? ` ${hints.join('; ')}.` : '')
  );
}

/** Что обход схемы нашёл для сборки нод. */
interface BuildContext {
  readonly bySignal: HarvestedConfig;
  readonly arrayItems: ArrayItemBuilders;
}

/** Строитель формы строки массива под-форм: своя форма над под-моделью строки. */
const rowFormBuilder =
  (item: ItemSchemaBuilder) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (rowModel: any): FormProxy<any> =>
    createFormFromModel({ model: rowModel, schema: schemaSubtree(item, rowModel) });

/**
 * Строит ноды группы по дереву сигналов модели (`model.$`) и сразу заполняет реестр ручка→нода.
 *
 * Вид ноды определяет ВИД узла модели, а не имена и значения полей:
 *  - лист → {@link FieldNode} над сигналом листа, с конфигом из схемы;
 *  - массив с `item` в схеме → {@link ModelArrayNode} (набор под-форм, на любой глубине);
 *  - массив, к которому схема привязала компонент → {@link FieldNode} над массивом целиком
 *    (мультивыбор, теги, файлы); без привязки массив пропускается — чем он является, решает
 *    схема, а не данные;
 *  - группа → вложенная {@link GroupNode}.
 *
 * Вид узла модели фиксируется при её создании, а значение меняется: лист, созданный из `null` и
 * позже получивший массив (мультивыбор после `patch` с сервера), остаётся листом — и остаётся
 * полем. Поле данных может называться как угодно (`schema`, `form`, `value`): по именам сборка
 * ничего не угадывает.
 */
function buildGroupNode(
  signals: Record<string, unknown>,
  context: BuildContext
): GroupNode<unknown> {
  const fields = new Map<string, FormNode<unknown>>();
  const leaves: Array<[FieldNode<unknown>, Signal<unknown>]> = [];

  const addField = (key: string, signal: Signal<unknown>): void => {
    // Schema-валидация живёт вне layout-дерева (`validateModel` из @reformer/core/validation),
    // нода правил не исполняет: из схемы она берёт только UI-конфиг узла.
    const node = new FieldNode<unknown>({
      ...(context.bySignal.get(signal) ?? {}),
      valueSignal: signal,
    });
    fields.set(key, node);
    registerSignalNode(signal, node);
    leaves.push([node, signal]);
  };

  for (const key of Object.keys(signals)) {
    const handle = signals[key];

    if (isModelArraySignal(handle)) {
      const item = context.arrayItems.get(handle as object);
      if (item) {
        const control = modelOf(handle as { peek(): unknown[] });
        const node = new ModelArrayNode(control as never, rowFormBuilder(item));
        fields.set(key, node as unknown as FormNode<unknown>);
        registerSignalNode(handle as object, node);
      } else if (context.bySignal.has(handle as object)) {
        addField(key, handle as Signal<unknown>);
      }
      continue;
    }

    if (isModelContainerSignal(handle)) {
      // Группа: её узел в дереве `$` перечисляет поля как собственные ключи.
      const node = buildGroupNode(handle as Record<string, unknown>, context);
      fields.set(key, node);
      registerSignalNode(handle as object, node);
      continue;
    }

    addField(key, handle as Signal<unknown>);
  }

  const group = new GroupNode<unknown>(fields);
  // F9: связать листовую ноду с её сигналом модели на ВЛАДЕЮЩЕЙ группе, чтобы bulk-set/patch
  // (GroupNode.setValue/patchValue) сверял derived-guard с записываемым сигналом, а не с
  // computed-обёрткой field.value (которую markDerived никогда не помечает).
  for (const [node, signal] of leaves) group.registerFieldSignal(node, signal);
  return group;
}

/**
 * Собрать форму из {@link FormModel} и единой схемы (низкоуровневая фабрика архитектуры M1).
 *
 * Значения принадлежат модели (источник истины), ноды формы держат UI/валидационное состояние и
 * ссылаются на сигналы модели по идентичности. Обходит структуру модели и строит ноды по виду её
 * узлов, привязывает конфиг поля (component/componentProps) из схемы, материализует массивы
 * под-форм как {@link ModelArrayNode} (на любой глубине), заполняет реестр ручка→нода (для
 * `enableWhen`, `apply`/`applyEach` и роутинга ошибок) и, при наличии, запускает декларативное
 * поведение (cleanup живёт на форме).
 *
 * Обычно вызывается сборкой одним вызовом (`createForm`): она строит дерево схемы, зовёт эту
 * фабрику и собирает валидацию. Прямой вызов нужен там, где бандл не нужен, — форма элемента
 * массива, тесты, свой слой сборки.
 *
 * @typeParam T - Тип модели данных формы
 * @param args - Модель, единая схема и (опционально) декларативное поведение {@link CreateFormFromModelArgs}
 * @returns Типизированная форма с Proxy-доступом к полям {@link FormProxy}
 *
 * @example Форма из модели и схемы
 * ```typescript
 * import { createModel, createFormFromModel } from '@reformer/core';
 *
 * interface Form {
 *   email: string;
 *   profile: { name: string; age: number };
 * }
 *
 * const model = createModel<Form>({ email: '', profile: { name: '', age: 0 } });
 * const schema = {
 *   component: Section,
 *   children: [
 *     // Layout несёт только component/componentProps; правила — в отдельной ValidationSchema.
 *     { model: model.$.email, component: Input },
 *     // вложенная группа: `model.$.profile.name` (≡ под-модель `model.profile.$.name` — тот же сигнал)
 *     { model: model.$.profile.name, component: Input },
 *   ],
 * };
 *
 * const form = createFormFromModel<Form>({ model, schema });
 *
 * // Двусторонняя связь нода ↔ модель:
 * form.email.setValue('user@mail.com');
 * console.log(model.email); // 'user@mail.com'
 * ```
 *
 * @see `createForm` — сборка одним вызовом: модель, форма, валидация и дерево для рендера
 * @group Utilities
 */
export function createFormFromModel<T>(args: CreateFormFromModelArgs<T>): FormProxy<T> {
  const { model, schema, behavior } = args;
  const bySignal: HarvestedConfig = new Map();
  const arrayItems: ArrayItemBuilders = new Map();
  if (schema !== undefined) {
    const report: HarvestReport = { unknownKeys: new Set() };
    harvestFieldConfig(schema, bySignal, arrayItems, new WeakSet(), report);
    if (process.env.NODE_ENV !== 'production') warnUnknownNodeKeys(report);
  }
  // Ноды строятся одним проходом по дереву `model.$`; реестр ручка→нода заполняется по ходу:
  // он нужен state-операциям поведения (enableWhen), подключению под-схем (apply, applyEach) и
  // разносу ошибок валидации. Ключ — идентичность ручки модели: сигнал листа, узел-массив (поле
  // над массивом целиком либо массив под-форм) или узел-группа.
  const groupNode = buildGroupNode(model.$ as unknown as Record<string, unknown>, {
    bySignal,
    arrayItems,
  }) as GroupNode<T>;
  // Корень тоже регистрируется: у формы строки массива он — ручка этой строки.
  registerSignalNode(model.$ as object, groupNode);

  const proxy = groupNode.getProxy();

  // Schema-валидация вынесена ВНЕ формы (контракт `@reformer/core/validation`): приложение
  // прогоняет `validateModel(model, schema)`, который сам роутит ошибки в ноды. `createForm` больше
  // не привязывает валидацию к `form.validate()`/`submit()` — те отражают текущее состояние нод.

  // Декларативное поведение: запускаем ПОСЛЕ заполнения реестра (enableWhen резолвит ноды по сигналу),
  // cleanup отдаём форме — отпишется в groupNode.dispose().
  if (behavior) {
    groupNode.attachBehaviorCleanup(behavior.__run(model, proxy, args.schemaController));
  }

  return proxy;
}

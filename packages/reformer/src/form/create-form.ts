/**
 * Низкоуровневые фабрики формы: из модели и готового дерева схемы ({@link createFormFromModel})
 * и из конфига без модели ({@link createLegacyForm}).
 *
 * Сборка одним вызовом — модель, форма, валидация и дерево для рендера — живёт в `form-bundle`
 * (`createForm`) и зовёт {@link createFormFromModel}.
 *
 * @group Utilities
 * @module form/create-form
 */

import { Signal } from '@preact/signals-core';
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
import type { FormProxy, GroupNodeConfig, FormSchema, FieldConfig } from './types/index';
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
   * Единая Schema (дерево узлов {@link FormSchemaNode}). createForm обходит её и привязывает конфиг
   * поля к ноде по идентичности сигнала (`node.value === model.$.path`). Опциональна.
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
 */
type HarvestedConfig = Map<object, Partial<FieldConfig<unknown>>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ItemSchemaBuilder = (item: any) => FormSchemaNode;
/**
 * Item-схемы массивов под-форм. Ключ — ручка массива (`model.$.<массив>`), а не путь: путь
 * абсолютный (`items.0.phones`), а форма строки обходит модель строки от её корня (`phones`).
 */
type ArrayItemBuilders = Map<object, ItemSchemaBuilder>;

/**
 * Глубокий обход схемы: собирает конфиг поля по сигналу + item-схемы массивов по ручке массива.
 * Устойчив к разной вложенности (children / componentProps.steps / любые вложенные узлы).
 *
 * Узлы с привязкой к модели:
 *  - поле — `{ model: model.$.<лист | массив>, component }`;
 *  - массив под-форм — `{ model: model.$.<массив>, item: (model) => узел }`;
 *  - подформа — `{ model: model.$.<группа>, part: (model) => узел }`.
 */
function harvestFieldConfig(
  schema: unknown,
  map: HarvestedConfig,
  arrayItems: ArrayItemBuilders,
  visited: WeakSet<object>
): void {
  if (schema == null || typeof schema !== 'object') return;
  // Сигнал — лист обхода, а не узел: спуск внутрь него бессмыслен (у Signal нет `component`/
  // `children`) и опасен — его внутренние поля (`_targets`/`_node`) образуют двусвязные списки
  // подписок с обратными ссылками. Сигналы попадают под обход не только как `node.value` (тот
  // пропускается ниже по ключу), но и под произвольными ключами: `text: model.$.x` у html-узла,
  // `componentProps.<prop>: '$model(…)'` после резолва в renderer-json. Узел-массив `model.$.<path>`
  // — такая же ручка значения, и спускаться в него так же незачем.
  if (isValueSignal(schema)) return;
  // Остальное, что принадлежит модели, — тоже не узлы схемы. Ручка группы (`model.$.<группа>`)
  // перечисляет сигналы своих полей, а value-фасад (`model`, `model.<группа>`, `model.<массив>`)
  // при чтении ключей реактивно читает значения модели.
  if (isModelContainerSignal(schema) || isModelFacade(schema)) return;
  // React-элемент или обёртка компонента (memo/forwardRef) в `componentProps`. Элемент, созданный
  // во время рендера, в dev ссылается на Fiber через `_owner`, а дерево Fiber циклично.
  if ((schema as { $$typeof?: unknown }).$$typeof !== undefined) return;
  // Один и тот же объект может стоять в дереве дважды, а чужие объекты в `componentProps` бывают
  // цикличны — каждый объект обходим один раз.
  if (visited.has(schema)) return;
  visited.add(schema);
  // Узел ФОРМЫ (FormProxy/GroupNode) внутри схемы — обычно `componentProps: { form }` у визарда,
  // когда дерево строят уже с формой. Спуск внутрь него — переполнение стека: прокси самоссылочен
  // (`_proxyInstance`, `formSubmitter.form`), а обход не помнит посещённые объекты. Пропускаем узел
  // (для harvest он всё равно бесполезен) и подсказываем, как строить дерево правильно.
  if (typeof (schema as { getProxy?: unknown }).getProxy === 'function') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[reformer] createForm({ schema }): в схему попал узел формы (FormProxy) — он пропущен. ' +
          'Стройте дерево для createForm БЕЗ формы, а форму донесите до узла вторым проходом ' +
          '(билдер `(model, form?) => …`) либо через render-behavior `patchProps({ form })`.'
      );
    }
    return;
  }
  if (Array.isArray(schema)) {
    for (const child of schema) harvestFieldConfig(child, map, arrayItems, visited);
    return;
  }
  const node = schema as Record<string, unknown>;

  // Вид узла определяется ЗНАЧЕНИЯМИ, а не одними именами ключей: `model` — ручка модели, `item`
  // и `part` — функции. Схема допускает запись «имя поля → узел», и поле данных с именем `model`,
  // `item`, `part` или `value` — обычный вложенный узел, а не привязка. Порядок проверок важен:
  // ручка массива — тоже ручка значения, поэтому массив под-форм узнаётся раньше поля.

  // Массив под-форм: { model: model.$.<массив>, item: (model) => узел }; прежний ключ — `array`.
  if (typeof node.item === 'function') {
    const handle = arrayHandleOf(node.model) ?? arrayHandleOf(node.array);
    if (handle) {
      arrayItems.set(handle, node.item as ItemSchemaBuilder);
      // Шаблон нового элемента из схемы — запасной: шаблон модели (`arrayOf`) главнее.
      if (node.initialValue !== undefined) provideArrayBlank(handle, node.initialValue);
      return; // внутрь item-фабрики не идём (вызовется per-item при построении)
    }
    if (node.array != null) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[reformer] createForm({ schema }): у узла-массива `array` — не массив модели, узел ' +
            'пропущен. Ожидается `model: model.$.<массив>`.'
        );
      }
      return;
    }
  }

  // Подформа: { model: model.$.<группа>, part: (model) => узел }. Отдельной формы у части нет —
  // поля группы принадлежат этой же форме, поэтому её поддерево обходится тут же.
  if (typeof node.part === 'function') {
    const handle = groupHandleOf(node.model);
    if (handle) {
      const subModel = modelOf(handle as { peek(): object });
      const subtree = schemaSubtree(node.part as ItemSchemaBuilder, subModel as object);
      harvestFieldConfig(subtree, map, arrayItems, visited);
      return;
    }
  }

  // Поле — узел с ручкой значения: лист ИЛИ массив целиком (мультивыбор, теги, список файлов).
  // Прежний ключ привязки — `value`.
  const binding = isValueSignal(node.model) ? node.model : node.value;
  if (isValueSignal(binding)) {
    map.set(binding, {
      component: node.component as FieldConfig<unknown>['component'],
      componentProps: node.componentProps,
      updateOn: node.updateOn as FieldConfig<unknown>['updateOn'],
      disabled: node.disabled as boolean | undefined,
      debounce: node.debounce as number | undefined,
    });
  } else if (
    process.env.NODE_ENV !== 'production' &&
    node.component !== undefined &&
    ('valueSignal' in node ||
      node.value != null ||
      isModelFacade(node.model) ||
      isModelContainerSignal(node.model))
  ) {
    // DEV-подсказка: узел похож на поле (есть `component`), но привязка — не ручка значения.
    // Частая ошибка: `model: model.<path>` (value-прокси) вместо `model: model.$.<path>`
    // (PathAwareSignal), `model: model.$.<группа>` (группа полем не бывает — ей нужен `part`) либо
    // `valueSignal:` (обход его не разбирает). Без ручки обход молча пропустит узел, и поле
    // отрендерится без компонента и пропсов.
    console.warn(
      '[reformer] createForm({ schema }): узел с `component` не распознан как поле — ' +
        'привязка не является сигналом модели. Ожидается `model: model.$.<path>` (лист или ' +
        'массив); проверьте, что не передан `model: model.<path>` (value-прокси), группа без ' +
        '`part` или `valueSignal:`.'
    );
  }
  // Ручки модели под любым ключом отсекаются в начале обхода — пропускать ключи привязки незачем.
  for (const child of Object.values(node)) harvestFieldConfig(child, map, arrayItems, visited);
}

/** Поле формы, найденное при обходе модели: путь и ручка его значения. */
interface FieldHandle {
  readonly path: string;
  readonly signal: Signal<unknown>;
}

/** Группа модели, найденная при обходе: путь внутри ЭТОЙ формы и её ручка `model.$.<группа>`. */
interface GroupHandle {
  readonly path: string;
  readonly handle: object;
}

/** Массив под-форм, найденный при обходе: путь внутри ЭТОЙ формы, ручка и item-схема. */
interface SubFormArray {
  readonly path: string;
  readonly handle: object;
  readonly item: ItemSchemaBuilder;
}

/** Всё, что обход модели находит помимо самого конфига нод. */
interface ModelParts {
  readonly fields: FieldHandle[];
  readonly groups: GroupHandle[];
  readonly arrays: SubFormArray[];
}

/**
 * Строит data-shaped FieldConfig-дерево из дерева сигналов модели (`model.$`): листья → FieldConfig
 * с valueSignal (значение из модели) + конфиг из схемы; группы → вложенный конфиг; массив — поле,
 * только если схема привязала к нему компонент.
 *
 * Обход идёт по ВИДУ узла модели, а не по текущему значению. Вид фиксируется при создании модели,
 * а значение меняется: лист, созданный из `null` и позже получивший массив (мультивыбор после
 * `patch` с сервера), остаётся листом — и остаётся полем. Обход по значению терял такое поле,
 * стоило загрузить данные до `createForm`.
 */
function buildModelConfig(
  signals: Record<string, unknown>,
  basePath: string,
  bySignal: HarvestedConfig,
  arrayItems: ArrayItemBuilders,
  parts: ModelParts
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const key of Object.keys(signals)) {
    const path = basePath === '' ? key : `${basePath}.${key}`;
    const child = signals[key];

    if (isModelArraySignal(child)) {
      // Массив — model-owned (M1). Как НАБОР ПОД-ФОРМ (`{ array, item }` в схеме) он строится
      // per-item рекурсивно, и в конфиг нод не попадает: его материализует `ModelArrayNode` уже
      // после построения групп — на любой глубине. Как ОДНО ЗНАЧЕНИЕ поля
      // (`{ value: model.$.<path>, component }` — мультивыбор, теги, файлы) он получает обычную
      // ноду поля над ручкой массива. Без привязки в схеме массив пропускается, как и раньше:
      // чем он является, решает схема, а не данные.
      const item = arrayItems.get(child as object);
      if (item) {
        parts.arrays.push({ path, handle: child as object, item });
        continue;
      }
      const nodeCfg = bySignal.get(child as object);
      if (nodeCfg !== undefined) {
        const signal = child as Signal<unknown>;
        config[key] = { ...nodeCfg, valueSignal: signal };
        parts.fields.push({ path, signal });
      }
      continue;
    }
    if (child instanceof Signal) {
      // Schema-валидация живёт вне layout-дерева (`validateModel` из @reformer/core/validation),
      // нода правил не исполняет: harvest собирает только UI/поведенческий конфиг узла.
      config[key] = { ...(bySignal.get(child) ?? {}), valueSignal: child };
      parts.fields.push({ path, signal: child });
      continue;
    }
    // Группа: её узел в дереве `$` перечисляет поля как собственные ключи.
    parts.groups.push({ path, handle: child as object });
    config[key] = buildModelConfig(
      child as Record<string, unknown>,
      path,
      bySignal,
      arrayItems,
      parts
    );
  }
  return config;
}

/** Группа-владелец узла по его пути внутри формы: для `a.b.c` — нода группы `a.b`. */
function ownerGroupOf<T>(root: GroupNode<T>, path: string): GroupNode<unknown> | undefined {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return root as unknown as GroupNode<unknown>;
  const owner = root.getFieldByPath(path.slice(0, dot));
  return owner instanceof GroupNode ? (owner as GroupNode<unknown>) : undefined;
}

/**
 * Собрать форму из {@link FormModel} и единой схемы (низкоуровневая фабрика архитектуры M1).
 *
 * Значения принадлежат модели (источник истины), ноды формы держат UI/валидационное состояние и
 * ссылаются на сигналы модели по идентичности (`node.value === model.$.path`). Обходит структуру
 * модели, привязывает конфиг поля (component/componentProps) из схемы, материализует массивы
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
 * @example Форма из модели + схемы (эквивалент `createFormFromModel({ model, schema })`)
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
 *     { value: model.$.email, component: Input },
 *     // вложенная группа: `model.$.profile.name` (≡ под-модель `model.profile.$.name` — тот же сигнал)
 *     { value: model.$.profile.name, component: Input },
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
  if (schema !== undefined) harvestFieldConfig(schema, bySignal, arrayItems, new WeakSet());
  const signals = model.$ as unknown as Record<string, unknown>;
  const parts: ModelParts = { fields: [], groups: [], arrays: [] };
  const config = buildModelConfig(signals, '', bySignal, arrayItems, parts);
  const groupNode = new GroupNode<T>(config as unknown as GroupNodeConfig<T>);

  // Материализация массивов под-форм как ModelArrayNode (делегируют массиву модели) — на любой
  // глубине: в корне, в группе и, через рекурсию `buildItem`, в строке другого массива. Нужна
  // item-схема из единой схемы (`{ array: model.<path>, item }`); без неё массив пропускается.
  for (const { path, handle, item } of parts.arrays) {
    const owner = ownerGroupOf(groupNode, path);
    if (!owner) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildItem = (itemModel: any): FormProxy<any> =>
      createFormFromModel({ model: itemModel, schema: schemaSubtree(item, itemModel) });
    const control = modelOf(handle as { peek(): unknown[] });
    const node = new ModelArrayNode(control as never, buildItem);
    owner.fields.set(path.slice(path.lastIndexOf('.') + 1) as never, node as never);
    registerSignalNode(handle, node);
  }

  const proxy = groupNode.getProxy();

  // Реестр ручка→нода: для state-операций behavior (enableWhen), подключения под-схем (apply,
  // applyEach) и in-form роутинга валидации. Ключ — идентичность ручки модели: сигнал листа,
  // узел-массив (поле над массивом целиком либо массив под-форм — выше) или узел-группа.
  // Корень тоже регистрируется: у формы строки массива он — ручка этой строки.
  registerSignalNode(model.$ as object, groupNode);
  for (const { path, handle } of parts.groups) {
    const node = groupNode.getFieldByPath(path);
    if (node) registerSignalNode(handle, node);
  }
  for (const { path, signal } of parts.fields) {
    const node = groupNode.getFieldByPath(path);
    if (node) {
      registerSignalNode(signal, node);
      // F9: связать листовую ноду с её сигналом модели на ВЛАДЕЮЩЕЙ группе, чтобы bulk-set/patch
      // (GroupNode.setValue/patchValue) сверял derived-guard с записываемым сигналом, а не с
      // computed-обёрткой field.value (которую markDerived никогда не помечает).
      ownerGroupOf(groupNode, path)?.registerFieldSignal(node, signal);
    }
  }

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

/**
 * Создать форму из готового конфига группы.
 *
 * @param config - Конфиг {@link GroupNode}
 * @returns Типизированная форма с Proxy-доступом к полям
 * @group Utilities
 */
export function createLegacyForm<T>(config: GroupNodeConfig<T>): FormProxy<T>;

/**
 * Создать форму из плоской схемы полей с инлайн-значениями (`value: ''`) — путь ДО архитектуры M1.
 *
 * Значения живут в нодах, модели нет: поведение (`defineFormBehavior`) и внешняя валидация
 * (`validateModel`) к такой форме не подключаются. Для нового кода — {@link createFormFromModel}
 * либо сборка одним вызовом.
 *
 * @param schema - Схема полей формы
 * @returns Типизированная форма с Proxy-доступом к полям
 * @group Utilities
 *
 * @example
 * ```typescript
 * const form = createLegacyForm<UserForm>({
 *   email: { value: '', component: Input },
 *   password: { value: '', component: Input },
 * });
 * ```
 */
export function createLegacyForm<T>(schema: FormSchema<T>): FormProxy<T>;

export function createLegacyForm<T>(
  schemaOrConfig: FormSchema<T> | GroupNodeConfig<T>
): FormProxy<T> {
  return new GroupNode<T>(schemaOrConfig as GroupNodeConfig<T>).getProxy();
}

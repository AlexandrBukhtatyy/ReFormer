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
import { FormControlNode } from './nodes/form-control-node';
import { FormGroupNode } from './nodes/form-group-node';
import { FormArrayNode, type ModelArrayControl } from './nodes/form-array-node';
import { rawNode, type InternalFormNode } from './nodes/node-kind';
import { createNodeScope, type NodeScope } from './signal-node-registry';
import { isModelArraySignal, isModelContainerSignal } from '../model/model-signals-proxy';
import { modelOf, provideArrayBlank } from '../model/model-value-proxy';
import { compileSchema } from './schema/compile';
import type { CompiledArrayNode, CompiledFieldNode, CompiledSchema } from './schema/compiled';
import type { FieldConfig, FormGroup } from './types/index';
import type { FormSchemaNode } from './types/schema-node';
import type { FormModel } from '../model/types';
import type { FormBehavior } from './behaviors';
import type { SchemaController } from './schema-controller';
import type { FormFlow } from './flow/flow';

/**
 * Аргументы сборки формы из модели: данные приходят из {@link FormModel},
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
   * заполнения реестра сигнал→нода; cleanup живёт на форме и снимается вместе с ней.
   */
  behavior?: FormBehavior<T>;
  /**
   * Схема-контроллер сборки: через него поведение получает `schema` своей области. Его передаёт
   * сборка одним вызовом, чтобы правила узлов (`hideWhen`, `onComponentEvent`) дошли до рендерера.
   * Без него поведение пишет правила в собственный контроллер, который никто не читает.
   */
  schemaController?: SchemaController;
  /** Поток шагов сборки: его получает поведение (`defineFormBehavior(({ flow }) => …)`). */
  flow?: FormFlow;
}

/** Что компиляция схемы дала для сборки нод: поля и массивы под-форм по ручке модели. */
interface BuildContext {
  readonly fields: ReadonlyMap<object, CompiledFieldNode>;
  readonly arrays: ReadonlyMap<object, CompiledArrayNode>;
}

const EMPTY_CONTEXT: BuildContext = { fields: new Map(), arrays: new Map() };

/**
 * Строитель формы строки массива под-форм: своя форма над скомпилированной схемой строки. Ноды
 * строки — ноды той же сборки, поэтому строка регистрируется в её области.
 */
const rowFormBuilder =
  (array: CompiledArrayNode, nodes: NodeScope) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (rowModel: any): FormGroup<any> =>
    createFormFromCompiled({ model: rowModel, compiled: array.row(rowModel), nodes });

/**
 * Строит ноды группы по дереву сигналов модели (`model.$`) и сразу заполняет реестр ручка→нода.
 *
 * Вид ноды определяет ВИД узла модели, а не имена и значения полей:
 *  - лист → поле ({@link FormControl}) над сигналом листа, с конфигом из схемы;
 *  - массив с `item` в схеме → массив под-форм ({@link FormArray}, на любой глубине);
 *  - массив, к которому схема привязала компонент → поле над массивом целиком (мультивыбор,
 *    теги, файлы); без привязки массив пропускается — чем он является, решает схема, а не данные
 *    (по пустому массиву не отличить список под-форм от мультивыбора). Обращение к такому полю
 *    группы в dev предупреждает, как его привязать;
 *  - группа → вложенная группа ({@link FormGroup}); в реестре ручка группы указывает на её лицо.
 *
 * Вид узла модели фиксируется при её создании, а значение меняется: лист, созданный из `null` и
 * позже получивший массив (мультивыбор после `patch` с сервера), остаётся листом — и остаётся
 * полем. Поле данных может называться как угодно (`schema`, `form`, `value`): по именам сборка
 * ничего не угадывает.
 */
function buildGroupNode(
  signals: Record<string, unknown>,
  context: BuildContext,
  nodes: NodeScope
): FormGroupNode<unknown> {
  const fields = new Map<string, InternalFormNode>();
  const leaves: Array<[FormControlNode<unknown>, Signal<unknown>]> = [];
  const unbound: string[] = [];

  const addField = (key: string, signal: Signal<unknown>): void => {
    // Правила валидации живут вне дерева схемы (`@reformer/core/validation`), нода их не
    // исполняет: из узла схемы она берёт только UI-конфиг.
    const field = context.fields.get(signal);
    const config: Omit<FieldConfig<unknown>, 'valueSignal'> = field
      ? {
          component: field.component,
          componentProps: field.source.componentProps,
          disabled: field.disabled,
        }
      : {};
    const node = new FormControlNode<unknown>({ ...config, valueSignal: signal });
    fields.set(key, node);
    nodes.register(signal, node);
    leaves.push([node, signal]);
  };

  for (const key of Object.keys(signals)) {
    const handle = signals[key];

    if (isModelArraySignal(handle)) {
      const array = context.arrays.get(handle as object);
      if (array) {
        const control = modelOf(handle as { peek(): unknown[] }) as ModelArrayControl<object>;
        const node = new FormArrayNode(control, rowFormBuilder(array, nodes));
        fields.set(key, node as unknown as InternalFormNode);
        nodes.register(handle as object, node);
      } else if (context.fields.has(handle as object)) {
        addField(key, handle as Signal<unknown>);
      } else {
        unbound.push(key);
      }
      continue;
    }

    if (isModelContainerSignal(handle)) {
      // Группа: её узел в дереве `$` перечисляет поля как собственные ключи.
      const node = buildGroupNode(handle as Record<string, unknown>, context, nodes);
      fields.set(key, node);
      nodes.register(handle as object, node.proxy);
      continue;
    }

    addField(key, handle as Signal<unknown>);
  }

  const group = new FormGroupNode<unknown>(fields, unbound);
  // Связать лист с его сигналом модели на ВЛАДЕЮЩЕЙ группе: групповой setValue сверяет цели
  // compute с записываемым сигналом, а не с computed-обёрткой value ноды (её markDerived не помечает).
  for (const [node, signal] of leaves) group.registerLeafSignal(node, signal);
  return group;
}

/**
 * Собрать форму из {@link FormModel} и единой схемы (низкоуровневая фабрика).
 *
 * Значения принадлежат модели (источник истины), ноды формы держат UI/валидационное состояние и
 * ссылаются на сигналы модели по идентичности. Обходит структуру модели и строит ноды по виду её
 * узлов, привязывает конфиг поля (component/componentProps) из схемы, материализует массивы
 * под-форм ({@link FormArray}, на любой глубине), заполняет реестр ручка→нода (для
 * `enableWhen`, `apply`/`applyEach` и роутинга ошибок) и, при наличии, запускает декларативное
 * поведение (cleanup живёт на форме).
 *
 * Обычно вызывается сборкой одним вызовом (`createForm`): она строит дерево схемы, зовёт эту
 * фабрику и собирает валидацию. Прямой вызов нужен там, где бандл не нужен, — форма элемента
 * массива, тесты, свой слой сборки.
 *
 * @typeParam T - Тип модели данных формы
 * @param args - Модель, единая схема и (опционально) декларативное поведение {@link CreateFormFromModelArgs}
 * @returns Группа формы {@link FormGroup} с нодами полей по именам
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
 *     // Layout несёт только component/componentProps; правила — в отдельной ValidationDefinition.
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
export function createFormFromModel<T>(args: CreateFormFromModelArgs<T>): FormGroup<T> {
  const { schema, ...rest } = args;
  return createFormFromCompiled({
    ...rest,
    ...(schema !== undefined ? { compiled: compileSchema(schema, args.model as object) } : {}),
  });
}

/**
 * Снять форму, собранную {@link createFormFromModel}: поведение формы и подписки нод (массивы
 * под-форм следят за моделью). Значения модели остаются. Идемпотентно.
 *
 * Сборку одним вызовом снимают целиком — `bundle.dispose()`: вместе с формой она снимает живую
 * проверку и отменяет идущие проверки. Этот вызов нужен своим слоям сборки поверх
 * {@link createFormFromModel}.
 *
 * @param form - Форма из {@link createFormFromModel}.
 *
 * @example
 * ```typescript
 * const form = createFormFromModel<Profile>({ model, schema, behavior });
 * // … форма больше не нужна
 * disposeForm(form);
 * ```
 *
 * @group Utilities
 */
export function disposeForm<T>(form: FormGroup<T>): void {
  rawNode(form).dispose();
}

/**
 * Аргументы {@link createFormFromCompiled}: вместо авторского дерева — его компиляция.
 *
 * @internal
 */
export interface CreateFormFromCompiledArgs<T> extends Omit<CreateFormFromModelArgs<T>, 'schema'> {
  /** Скомпилированная схема области модели; без неё у полей нет конфига из схемы. */
  compiled?: CompiledSchema;
  /**
   * Область нод сборки: в неё регистрируются ноды формы и её строк, через неё их находят проверка,
   * поведение и рендерер сборки. Без неё у формы своя новая область.
   */
  nodes?: NodeScope;
}

/**
 * Форма из модели и скомпилированной схемы. Её зовут {@link createFormFromModel}, сборка одним
 * вызовом (`createForm`) и форма строки массива — каждая со своей компиляцией.
 *
 * @internal
 */
export function createFormFromCompiled<T>(args: CreateFormFromCompiledArgs<T>): FormGroup<T> {
  const { model, compiled, behavior } = args;
  const nodes = args.nodes ?? createNodeScope();
  const context: BuildContext = compiled ?? EMPTY_CONTEXT;
  // Шаблон нового элемента из схемы — запасной: шаблон модели (`arrayOf`) главнее.
  for (const [handle, array] of context.arrays) {
    if (array.initialValue !== undefined) provideArrayBlank(handle, array.initialValue);
  }
  // Ноды строятся одним проходом по дереву `model.$`; реестр ручка→нода заполняется по ходу:
  // он нужен state-операциям поведения (enableWhen), подключению под-схем (apply, applyEach) и
  // разносу замечаний валидации. Ключ — идентичность ручки модели: сигнал листа, узел-массив (поле
  // над массивом целиком либо массив под-форм) или узел-группа.
  const groupNode = buildGroupNode(
    model.$ as unknown as Record<string, unknown>,
    context,
    nodes
  ) as FormGroupNode<T>;
  const form = groupNode.proxy;
  // Корень тоже регистрируется: у формы строки массива он — ручка этой строки.
  nodes.register(model.$ as object, form);

  // Декларативное поведение: запускаем ПОСЛЕ заполнения реестра (enableWhen резолвит ноды по сигналу),
  // cleanup отдаём форме — отпишется в dispose() группы.
  if (behavior) {
    try {
      groupNode.attachBehaviorCleanup(
        behavior.__run(model, form, args.schemaController, args.flow, nodes)
      );
    } catch (error) {
      // Поведение упало при запуске: свои effect'ы оно сняло само, а форму вызывающий не получит —
      // ноды (подписки массивов под-форм на модель) снять больше некому.
      groupNode.dispose();
      throw error;
    }
  }

  return form;
}

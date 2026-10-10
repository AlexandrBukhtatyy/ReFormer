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
import { isModelArraySignal, isModelContainerSignal } from '../model/model-signals-proxy';
import { modelOf, provideArrayBlank } from '../model/model-value-proxy';
import { compileSchema } from './schema/compile';
import type { CompiledArrayNode, CompiledFieldNode, CompiledSchema } from './schema/compiled';
import type { FormProxy, FieldConfig } from './types/index';
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
   * заполнения реестра сигнал→нода; cleanup живёт на форме и вызывается в `form.dispose()`.
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

/** Строитель формы строки массива под-форм: своя форма над скомпилированной схемой строки. */
const rowFormBuilder =
  (array: CompiledArrayNode) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (rowModel: any): FormProxy<any> =>
    createFormFromCompiled({ model: rowModel, compiled: array.row(rowModel) });

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
    const node = new FieldNode<unknown>({ ...config, valueSignal: signal });
    fields.set(key, node);
    registerSignalNode(signal, node);
    leaves.push([node, signal]);
  };

  for (const key of Object.keys(signals)) {
    const handle = signals[key];

    if (isModelArraySignal(handle)) {
      const array = context.arrays.get(handle as object);
      if (array) {
        const control = modelOf(handle as { peek(): unknown[] });
        const node = new ModelArrayNode(control as never, rowFormBuilder(array));
        fields.set(key, node as unknown as FormNode<unknown>);
        registerSignalNode(handle as object, node);
      } else if (context.fields.has(handle as object)) {
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
  // Связать листовую ноду с её сигналом модели на ВЛАДЕЮЩЕЙ группе, чтобы bulk-set/patch
  // (GroupNode.setValue/patchValue) сверял derived-guard с записываемым сигналом, а не с
  // computed-обёрткой field.value (которую markDerived никогда не помечает).
  for (const [node, signal] of leaves) group.registerFieldSignal(node, signal);
  return group;
}

/**
 * Собрать форму из {@link FormModel} и единой схемы (низкоуровневая фабрика).
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
export function createFormFromModel<T>(args: CreateFormFromModelArgs<T>): FormProxy<T> {
  const { schema, ...rest } = args;
  return createFormFromCompiled({
    ...rest,
    ...(schema !== undefined ? { compiled: compileSchema(schema, args.model as object) } : {}),
  });
}

/**
 * Аргументы {@link createFormFromCompiled}: вместо авторского дерева — его компиляция.
 *
 * @internal
 */
export interface CreateFormFromCompiledArgs<T> extends Omit<CreateFormFromModelArgs<T>, 'schema'> {
  /** Скомпилированная схема области модели; без неё у полей нет конфига из схемы. */
  compiled?: CompiledSchema;
}

/**
 * Форма из модели и скомпилированной схемы. Её зовут {@link createFormFromModel}, сборка одним
 * вызовом (`createForm`) и форма строки массива — каждая со своей компиляцией.
 *
 * @internal
 */
export function createFormFromCompiled<T>(args: CreateFormFromCompiledArgs<T>): FormProxy<T> {
  const { model, compiled, behavior } = args;
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
    context
  ) as GroupNode<T>;
  // Корень тоже регистрируется: у формы строки массива он — ручка этой строки.
  registerSignalNode(model.$ as object, groupNode);

  const proxy = groupNode.getProxy();

  // Декларативное поведение: запускаем ПОСЛЕ заполнения реестра (enableWhen резолвит ноды по сигналу),
  // cleanup отдаём форме — отпишется в groupNode.dispose().
  if (behavior) {
    groupNode.attachBehaviorCleanup(behavior.__run(model, proxy, args.schemaController, args.flow));
  }

  return proxy;
}

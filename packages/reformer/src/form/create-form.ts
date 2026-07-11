/**
 * Фабричная функция для создания формы с правильной типизацией
 *
 * Это рекомендуемый способ создания форм в ReFormer v2.0+.
 * Создаёт GroupNode и возвращает его Proxy для типобезопасного доступа к полям.
 *
 * @group Utilities
 *
 * @example
 * ```typescript
 * // Рекомендуемый способ:
 * const form = createForm<MyForm>(config);
 * form.email.setValue('test@mail.com');  // Типобезопасный доступ к полям
 *
 * // Если нужен именно GroupNode instance:
 * const groupNode = new GroupNode<MyForm>(config);
 * const proxy = groupNode.getProxy();  // Явно получаем Proxy
 * ```
 */

import { Signal } from '@preact/signals-core';
import { GroupNode } from './nodes/group-node';
import { ModelArrayNode } from './nodes/model-array-node';
import { registerSignalNode } from './signal-node-registry';
import type { FormProxy, GroupNodeConfig, FormSchema, FieldConfig } from './types/index';
import type { FormSchemaNode } from './types/schema-node';
import type { FormModel } from '../state/types';
import { validateFormModel } from './validate-model';
import type { FormBehavior } from './behaviors';

/**
 * Аргументы createForm под архитектуру M1: данные приходят из {@link FormModel},
 * конфиг полей (component/componentProps/validators) — из единой схемы.
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
}

const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof Date) &&
  !(typeof Blob !== 'undefined' && v instanceof Blob) &&
  !(typeof File !== 'undefined' && v instanceof File);

type HarvestedConfig = Map<Signal<unknown>, Partial<FieldConfig<unknown>>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArrayItemBuilders = Map<string, (item: any) => FormSchemaNode>;

/**
 * Глубокий обход схемы: собирает конфиг поля по сигналу + item-схемы массивов по пути.
 * Устойчив к разной вложенности (children / componentProps.steps / любые вложенные узлы).
 * Массив-узел: `{ array: <model-массив с __path>, item: (itemModel) => schemaNode }`.
 */
function harvestFieldConfig(
  schema: unknown,
  map: HarvestedConfig,
  arrayItems: ArrayItemBuilders
): void {
  if (schema == null || typeof schema !== 'object') return;
  if (Array.isArray(schema)) {
    for (const child of schema) harvestFieldConfig(child, map, arrayItems);
    return;
  }
  const node = schema as Record<string, unknown>;

  // Массив-узел модели: { array: model.<path>, item: (itemModel) => schema }
  const arr = node.array as { __path?: string } | undefined;
  if (arr && typeof arr.__path === 'string' && typeof node.item === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arrayItems.set(arr.__path, node.item as (item: any) => FormSchemaNode);
    return; // внутрь item-фабрики не идём (вызовется per-item при построении)
  }

  if (node.value instanceof Signal) {
    map.set(node.value as Signal<unknown>, {
      component: node.component as FieldConfig<unknown>['component'],
      componentProps: node.componentProps,
      validators: node.validators as FieldConfig<unknown>['validators'],
      asyncValidators: node.asyncValidators as FieldConfig<unknown>['asyncValidators'],
      updateOn: node.updateOn as FieldConfig<unknown>['updateOn'],
      disabled: node.disabled as boolean | undefined,
      debounce: node.debounce as number | undefined,
    });
  } else if (
    process.env.NODE_ENV !== 'production' &&
    node.component !== undefined &&
    ('valueSignal' in node || node.value != null)
  ) {
    // DEV-подсказка: узел похож на поле (есть `component`), но «ручка» value — не сигнал модели.
    // Частая ошибка: `value: model.<path>` (value-прокси) вместо `value: model.$.<path>`
    // (PathAwareSignal), либо `valueSignal:` (harvest его не разбирает). Без сигнала harvest молча
    // пропустит узел, и поле отрендерится без компонента/пропсов/валидаторов.
    console.warn(
      '[reformer] createForm({ schema }): узел с `component` не распознан как поле — ' +
        '`value` не является сигналом модели. Ожидается `value: model.$.<path>`; ' +
        'проверьте, что не передан `value: model.<path>` (value-прокси) или `valueSignal:`.'
    );
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === 'value') continue; // сам сигнал не разворачиваем
    harvestFieldConfig(child, map, arrayItems);
  }
}

/**
 * Строит data-shaped FieldConfig-дерево из структуры модели: листья → FieldConfig с valueSignal
 * (значение из модели) + конфиг из схемы; объекты → вложенный конфиг.
 */
function buildModelConfig<T>(
  model: FormModel<T>,
  shape: Record<string, unknown>,
  basePath: string,
  bySignal: HarvestedConfig
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(shape)) {
    const path = basePath === '' ? key : `${basePath}.${key}`;
    if (Array.isArray(val)) {
      // Массивы — model-owned (M1): данные принадлежат модели (push/removeAt/length реактивны),
      // элементы рендерятся через model.<path> + itemComponent, а форма КАЖДОГО элемента строится
      // per-item рекурсивно: createForm({ model: model.<path>.at(i), schema: itemComponent(item) }).
      // Родительская форма массив не материализует — отдельный ArrayNode-дубликат не нужен.
      continue;
    }
    if (isPlainObj(val)) {
      config[key] = buildModelConfig(model, val, path, bySignal);
      continue;
    }
    const sig = model.signalAt(path) as Signal<unknown> | undefined;
    if (!sig) throw new Error(`createForm({ model }): не найден сигнал для пути "${path}"`);
    // Валидаторы единой схемы имеют контракт (value, model) и исполняются движком
    // validateModel/validateFormModel (по схеме), а НЕ нодой (node.validate(value) вызвал бы их
    // с неверной арностью). Поэтому в FieldNode валидаторы не кладём — только UI/поведенческий конфиг.
    const harvested = bySignal.get(sig) ?? {};
    const { validators: _v, asyncValidators: _av, ...nodeCfg } = harvested;
    void _v;
    void _av;
    config[key] = { ...nodeCfg, valueSignal: sig };
  }
  return config;
}

/**
 * Создать форму из {@link FormModel} + единой схемы (архитектура M1).
 * Значения принадлежат модели; ноды держат UI/валидационное состояние и ссылаются на сигналы.
 *
 * @group Utilities
 * @remarks Массивы пока не поддержаны (следующий шаг). Валидаторы берутся как есть из схемы
 * (контракт `(value, model)` подключается на этапе движка валидации).
 */
/** Собрать пути листовых полей из формы данных (объекты+поля; массивы пропускаются). */
function collectLeafPaths(shape: Record<string, unknown>, basePath: string, out: string[]): void {
  for (const [key, val] of Object.entries(shape)) {
    const path = basePath === '' ? key : `${basePath}.${key}`;
    if (Array.isArray(val)) continue;
    if (isPlainObj(val)) collectLeafPaths(val, path, out);
    else out.push(path);
  }
}

/**
 * Собрать форму из {@link FormModel} и единой схемы (низкоуровневая фабрика архитектуры M1).
 *
 * Значения принадлежат модели (источник истины), ноды формы держат UI/валидационное состояние и
 * ссылаются на сигналы модели по идентичности (`node.value === model.$.path`). Обходит структуру
 * модели, привязывает конфиг поля (component/componentProps/validators) из схемы, материализует
 * top-level массивы как {@link ModelArrayNode}, заполняет реестр сигнал→нода (для `enableWhen`/
 * роутинга ошибок) и, при наличии, запускает декларативное поведение (cleanup живёт на форме).
 *
 * Обычно вызывается неявно через {@link createForm} с аргументом `{ model, schema }` — прямой вызов
 * нужен редко (например, для построения формы элемента массива).
 *
 * @typeParam T - Тип модели данных формы
 * @param args - Модель, единая схема и (опционально) декларативное поведение {@link CreateFormFromModelArgs}
 * @returns Типизированная форма с Proxy-доступом к полям {@link FormProxy}
 *
 * @example Форма из модели + схемы (эквивалент `createForm({ model, schema })`)
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
 *     { value: model.$.email, component: Input, validators: [required] },
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
 * @see {@link createForm} - основная фабрика (диспетчеризует сюда при аргументе `{ model, schema }`)
 * @group Utilities
 */
export function createFormFromModel<T>(args: CreateFormFromModelArgs<T>): FormProxy<T> {
  const { model, schema, behavior } = args;
  const bySignal: HarvestedConfig = new Map();
  const arrayItems: ArrayItemBuilders = new Map();
  if (schema !== undefined) harvestFieldConfig(schema, bySignal, arrayItems);
  const config = buildModelConfig(model, model.get() as Record<string, unknown>, '', bySignal);
  const groupNode = new GroupNode<T>(config as unknown as GroupNodeConfig<T>);

  // Материализация top-level массивов как ModelArrayNode (делегируют массиву модели).
  // Нужна item-схема из единой схемы (`{ array: model.<path>, item }`); без неё массив пропускается.
  const shape = model.get() as Record<string, unknown>;
  for (const [key, val] of Object.entries(shape)) {
    if (!Array.isArray(val)) continue;
    const itemFn = arrayItems.get(key);
    if (!itemFn) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const control = (model as any)[key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildItem = (im: any): FormProxy<any> =>
      createFormFromModel({ model: im, schema: itemFn(im) });
    const node = new ModelArrayNode(control, buildItem);
    groupNode.fields.set(key as keyof T, node as never);
  }

  const proxy = groupNode.getProxy();

  // Реестр сигнал→нода: для state-операций behavior (enableWhen) и in-form роутинга валидации.
  const leafPaths: string[] = [];
  collectLeafPaths(model.get() as Record<string, unknown>, '', leafPaths);
  for (const path of leafPaths) {
    const sig = model.signalAt(path);
    const node = groupNode.getFieldByPath(path);
    if (sig && node) {
      registerSignalNode(sig as Signal<unknown>, node);
      // F9: связать листовую ноду с её сигналом модели на ВЛАДЕЮЩЕЙ группе, чтобы bulk-set/patch
      // (GroupNode.setValue/patchValue) сверял derived-guard с записываемым сигналом, а не с
      // computed-обёрткой field.value (которую markDerived никогда не помечает).
      const dot = path.lastIndexOf('.');
      const owner = dot === -1 ? groupNode : groupNode.getFieldByPath(path.slice(0, dot));
      if (owner instanceof GroupNode) owner.registerFieldSignal(node, sig as Signal<unknown>);
    }
  }

  // M1: schema-валидаторы срезаны с FieldNode и живут на слое модели. Привязываем валидацию модели
  // к форме, чтобы form.validate()/submit() прогоняли их (validateFormModel роутит ошибки в ноды),
  // а не пропускали невалидные данные через всегда-true node-gate.
  if (schema !== undefined) {
    const validationSchema = schema;
    groupNode.attachModelValidator(async () => {
      const res = await validateFormModel(model, validationSchema);
      return res.valid;
    });
  }

  // Декларативное поведение: запускаем ПОСЛЕ заполнения реестра (enableWhen резолвит ноды по сигналу),
  // cleanup отдаём форме — отпишется в groupNode.dispose().
  if (behavior) {
    groupNode.attachBehaviorCleanup(behavior.__run(model, proxy));
  }

  return proxy;
}

const isFormModelArgs = <T>(arg: unknown): arg is CreateFormFromModelArgs<T> =>
  arg != null &&
  typeof arg === 'object' &&
  'model' in arg &&
  typeof (arg as { model?: { signalAt?: unknown } }).model?.signalAt === 'function';

/**
 * Создать форму из {@link FormModel} + единой схемы (архитектура M1, рекомендуемый путь).
 *
 * @group Utilities
 *
 * @param args - Модель данных, единая схема (component/componentProps/validators) и (опционально) поведение
 * @returns Типизированная форма с Proxy-доступом к полям
 *
 * @example Архитектура M1: `createModel` + единая схема + `createForm({ model, schema })`
 * ```typescript
 * import { createModel, createForm, validateFormModel } from '@reformer/core';
 * import { required, email, minLength } from '@reformer/core/validators';
 *
 * interface UserForm {
 *   email: string;
 *   password: string;
 * }
 *
 * const model = createModel<UserForm>({ email: '', password: '' });
 *
 * const schema = {
 *   children: [
 *     {
 *       value: model.$.email,
 *       component: Input,
 *       validators: [required(), email()],
 *     },
 *     {
 *       value: model.$.password,
 *       component: Input,
 *       validators: [required(), minLength(8)],
 *     },
 *   ],
 * };
 *
 * const form = createForm<UserForm>({ model, schema });
 *
 * // TypeScript знает о полях (нода привязана к сигналу модели):
 * form.email.setValue('test@mail.com');
 *
 * // Валидация всей модели по схеме (sync + async):
 * const { valid } = await validateFormModel(model, schema);
 * ```
 */
export function createForm<T>(args: CreateFormFromModelArgs<T>): FormProxy<T>;

export function createForm<T>(config: GroupNodeConfig<T>): FormProxy<T>;

/**
 * Создать форму только со схемой полей.
 *
 * @deprecated Legacy / back-compat: плоская `FormSchema` с инлайн-значениями (`value: ''`) — путь
 *   ДО архитектуры M1. Для нового кода используйте перегрузку `createForm({ model, schema })`
 *   (значения принадлежат {@link FormModel}, валидаторы — фабрики в `validators: [...]`).
 *
 * @param schema - Схема полей формы
 * @returns Типизированная форма с Proxy-доступом к полям
 *
 * @example Legacy (back-compat) — плоская схема без модели
 * ```typescript
 * const form = createForm<UserForm>({
 *   email: { value: '', component: Input },
 *   password: { value: '', component: Input },
 * });
 * ```
 */
export function createForm<T>(schema: FormSchema<T>): FormProxy<T>;

/**
 * Реализация фабричной функции
 */
export function createForm<T>(
  schemaOrConfig: FormSchema<T> | GroupNodeConfig<T> | CreateFormFromModelArgs<T>
): FormProxy<T> {
  // M1-путь: { model, schema } — данные из FormModel.
  if (isFormModelArgs<T>(schemaOrConfig)) {
    return createFormFromModel(schemaOrConfig);
  }
  const groupNode = new GroupNode<T>(schemaOrConfig as GroupNodeConfig<T>);
  return groupNode.getProxy();
}

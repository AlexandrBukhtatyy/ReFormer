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
import { GroupNode } from '../nodes/group-node';
import { ModelArrayNode } from '../nodes/model-array-node';
import { registerSignalNode } from './signal-node-registry';
import type { FormProxy, GroupNodeConfig, FormSchema, FieldConfig } from '../types';
import type { FormModel } from '../model/types';

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
   * Единая Schema (дерево узлов). createForm обходит её и привязывает конфиг поля к ноде
   * по идентичности сигнала (`node.value === model.$.path`). Опциональна.
   */
  schema?: unknown;
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
type ArrayItemBuilders = Map<string, (item: any) => unknown>;

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
    arrayItems.set(arr.__path, node.item as (item: unknown) => unknown);
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

export function createFormFromModel<T>(args: CreateFormFromModelArgs<T>): FormProxy<T> {
  const { model, schema } = args;
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
    if (sig && node) registerSignalNode(sig as Signal<unknown>, node);
  }

  return proxy;
}

const isFormModelArgs = <T>(arg: unknown): arg is CreateFormFromModelArgs<T> =>
  arg != null &&
  typeof arg === 'object' &&
  'model' in arg &&
  typeof (arg as { model?: { signalAt?: unknown } }).model?.signalAt === 'function';

/**
 * Создать форму с полной конфигурацией (form, behavior, validation)
 *
 * @group Utilities
 *
 * @param config - Конфигурация формы с полями, поведением и валидацией
 * @returns Типизированная форма с Proxy-доступом к полям
 *
 * @example
 * ```typescript
 * const form = createForm<UserForm>({
 *   form: {
 *     email: { value: '', component: Input },
 *     password: { value: '', component: Input },
 *   },
 *   validation: (path) => {
 *     required(path.email);
 *     email(path.email);
 *     required(path.password);
 *     minLength(path.password, 8);
 *   },
 * });
 *
 * // TypeScript знает о полях:
 * form.email.setValue('test@mail.com');
 * ```
 */
export function createForm<T>(args: CreateFormFromModelArgs<T>): FormProxy<T>;

export function createForm<T>(config: GroupNodeConfig<T>): FormProxy<T>;

/**
 * Создать форму только со схемой полей (обратная совместимость)
 *
 * @param schema - Схема полей формы
 * @returns Типизированная форма с Proxy-доступом к полям
 *
 * @example
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

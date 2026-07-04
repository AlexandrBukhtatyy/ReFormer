/**
 * Headless-валидация данных: `validateModel(model, schema)` (архитектура M1).
 *
 * Валидация — чистая функция ДАННЫХ: движок обходит field-узлы схемы, читает значение из сигнала
 * модели и прогоняет валидаторы `(value, model, root)`. Работает БЕЗ нод/UI (headless), а тот же
 * движок используется в форме (ошибки роутятся в ноды по пути).
 *
 * @group Model
 * @module core/model/validate-model
 */

import { Signal } from '@preact/signals-core';
import { getNodeForSignal } from '../utils/signal-node-registry';
import type { ValidationError } from '../types';
import type { FormSchemaNode } from '../types/schema-node';
import type { FormModel, PathAwareSignal } from './types';

/**
 * Валидатор слоя **данных**. `value` — значение поля; `model` — ближайший scope (под-модель элемента
 * массива или корень); `root` — корневая модель.
 *
 * Отличие от {@link Validator}: 2-й/3-й аргументы — сами данные ({@link FormModel}/scope), а не
 * `FormProxy`-узлы формы. Оба совместимы с полем `validators` узла схемы (см. {@link SchemaValidator}).
 *
 * @group Model
 */
export type ModelValidator<TValue = unknown, TModel = unknown, TRoot = unknown> = (
  value: TValue,
  model: TModel,
  root: TRoot
) => ValidationError | null | Promise<ValidationError | null>;

/**
 * Результат валидации: ошибки по пути поля.
 *
 * @group Model
 */
export interface ModelValidationResult {
  valid: boolean;
  /** Ключ — путь поля (`'coBorrowers.0.relationship'`). Только поля с ошибками. */
  errors: Record<string, ValidationError[]>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FieldTask {
  signal: PathAwareSignal<unknown>;
  validators: ModelValidator[];
  scope: unknown;
}

/** Результат обхода схемы: что валидировать и что очистить. */
interface CollectResult {
  /** Активные поля с валидаторами (прогоняются). */
  tasks: FieldTask[];
  /** Сигналы полей в ВЫКЛЮЧЕННЫХ ветках — их ошибки нужно очистить (`setErrors([])`). */
  clearSignals: PathAwareSignal<unknown>[];
}

const isArraySection = (n: Record<string, any>): boolean => {
  const cp = n.componentProps;
  return (
    cp != null &&
    typeof cp === 'object' &&
    typeof cp.itemComponent === 'function' &&
    cp.control != null &&
    typeof cp.control.at === 'function' &&
    typeof cp.control.length === 'number'
  );
};

/** Узел-ветка: `{ when: (scope, root) => boolean, children: [...] }` (условное поддерево). */
const isBranchNode = (n: Record<string, any>): boolean =>
  typeof n.when === 'function' && Array.isArray(n.children);

/**
 * Обходит дерево схемы, собирая задачи валидации (поле + его scope-модель).
 * - branch-узел (`{ when, children }`) → вычисляет условие ОДИН раз; при ложном поддерево становится
 *   `active=false` — его поля не валидируются, но их сигналы собираются для очистки ошибок;
 * - array-секция (`componentProps.itemComponent` + `control`) → для каждого элемента модели
 *   вызывает `itemComponent(itemModel)` и рекурсивно обходит поддерево со scope = под-модель;
 * - field-узел (есть `value`-сигнал) → активная задача (если `active`) либо сигнал на очистку;
 * - контейнер → рекурсия по всем свойствам.
 */
function walk(
  node: unknown,
  scope: unknown,
  root: unknown,
  active: boolean,
  out: CollectResult
): void {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, scope, root, active, out);
    return;
  }
  const n = node as Record<string, any>;

  if (isBranchNode(n)) {
    const childActive = active && Boolean(n.when(scope, root));
    for (const child of n.children) walk(child, scope, root, childActive, out);
    return;
  }

  if (isArraySection(n)) {
    const control = n.componentProps.control as { length: number; at: (i: number) => unknown };
    const itemComponent = n.componentProps.itemComponent as (item: unknown) => unknown;
    const len = control.length;
    for (let i = 0; i < len; i++) {
      const itemModel = control.at(i);
      walk(itemComponent(itemModel), itemModel, root, active, out);
    }
    return;
  }

  if (n.value instanceof Signal) {
    const validators = (n.validators as ModelValidator[] | undefined) ?? [];
    if (validators.length > 0) {
      if (active)
        out.tasks.push({ signal: n.value as PathAwareSignal<unknown>, validators, scope });
      else out.clearSignals.push(n.value as PathAwareSignal<unknown>);
    }
    for (const [key, child] of Object.entries(n)) {
      if (key === 'value' || key === 'validators') continue;
      walk(child, scope, root, active, out);
    }
    return;
  }

  for (const child of Object.values(n)) walk(child, scope, root, active, out);
}

/** Один обход схемы → задачи (активные) + сигналы на очистку (выключенные ветки). */
function collect(model: unknown, schema: unknown): CollectResult {
  const out: CollectResult = { tasks: [], clearSignals: [] };
  walk(schema, model, model, true, out);
  return out;
}

const pushError = (
  errors: Record<string, ValidationError[]>,
  path: string,
  err: ValidationError
) => {
  (errors[path] ??= []).push(err);
};

/**
 * Синхронная headless-валидация данных. Асинхронные валидаторы пропускаются.
 *
 * @group Model
 * @param model - Модель данных ({@link FormModel}), из сигналов которой читаются значения полей.
 * @param schema - Единая схема формы (дерево узлов с `value`/`validators`, `{ when, children }`,
 *   секциями массивов). Обходится один раз для сбора активных полей.
 * @returns {@link ModelValidationResult} — `valid` + ошибки по пути поля (без async-валидаторов).
 *
 * @example Быстрая синхронная проверка (например, для gate «можно ли перейти на след. шаг»)
 * ```typescript
 * const res = validateModelSync(model, schema);
 * if (!res.valid) console.log(res.errors); // { 'email': [{ code, message }], ... }
 * ```
 */
export function validateModelSync<T>(
  model: FormModel<T>,
  schema: FormSchemaNode
): ModelValidationResult {
  const { tasks } = collect(model, schema);
  const errors: Record<string, ValidationError[]> = {};
  for (const { signal, validators, scope } of tasks) {
    const value = signal.peek();
    for (const validator of validators) {
      const result = validator(value, scope, model);
      if (result && typeof (result as Promise<unknown>).then === 'function') continue; // async → пропуск
      if (result) pushError(errors, signal.__path, result as ValidationError);
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Headless-валидация данных (sync + async). Работает без UI/нод.
 *
 * @group Model
 * @example
 * ```typescript
 * const res = await validateModel(model, schema);
 * if (!res.valid) console.log(res.errors); // { 'email': [{ code, message }], ... }
 * ```
 */
export async function validateModel<T>(
  model: FormModel<T>,
  schema: FormSchemaNode
): Promise<ModelValidationResult> {
  const { tasks } = collect(model, schema);
  const errors = await runTasks(tasks, model);
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Прогон задач (sync + async): возвращает ошибки по пути. */
async function runTasks(
  tasks: FieldTask[],
  model: unknown
): Promise<Record<string, ValidationError[]>> {
  const errors: Record<string, ValidationError[]> = {};
  await Promise.all(
    tasks.map(async ({ signal, validators, scope }) => {
      const value = signal.peek();
      for (const validator of validators) {
        const result = await validator(value, scope, model);
        if (result) pushError(errors, signal.__path, result);
      }
    })
  );
  return errors;
}

/**
 * In-form валидация: прогоняет {@link validateModel} и роутит ошибки в ноды формы
 * (через реестр сигнал→нода): `node.setErrors(errors[path] ?? [])` — заодно очищает прошедшие поля
 * И поля выключенных веток (`{ when, children }` с ложным условием). Дерево обходится ОДИН раз.
 *
 * @group Model
 * @param model - Модель данных ({@link FormModel}) — источник значений полей.
 * @param schema - Единая схема формы (та же, что передавалась в `createForm`).
 * @returns {@link ModelValidationResult} — `valid` + ошибки по пути поля; побочный эффект — ошибки
 *   разведены по нодам формы.
 * @remarks Поля, не материализованные в форме (элементы массива — строятся per-item), не роутятся
 * в родительскую форму; их ошибки доступны в возвращаемом результате по пути.
 *
 * @example Валидация перед submit (ошибки показываются в UI автоматически)
 * ```typescript
 * const form = createForm({ model, schema });
 * form.touchAll();
 * const res = await validateFormModel(model, schema);
 * if (res.valid) await api.save(model.get());
 * ```
 */
export async function validateFormModel<T>(
  model: FormModel<T>,
  schema: FormSchemaNode
): Promise<ModelValidationResult> {
  const { tasks, clearSignals } = collect(model, schema);
  const errors = await runTasks(tasks, model);
  for (const { signal } of tasks) {
    getNodeForSignal(signal)?.setErrors(errors[signal.__path] ?? []);
  }
  for (const signal of clearSignals) {
    getNodeForSignal(signal)?.setErrors([]);
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

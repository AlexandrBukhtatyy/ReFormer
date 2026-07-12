/**
 * Headless-движок валидации данных (архитектура M1) — чистый **state**-слой.
 *
 * Валидация — чистая функция ДАННЫХ: движок обходит field-узлы схемы, читает значение из сигнала
 * модели и прогоняет валидаторы `(value, model, root)`. Работает БЕЗ нод/UI (headless) и не касается
 * реестра сигнал→нода. In-form вариант с роутингом ошибок в ноды (`validateFormModel`) живёт в
 * {@link module:core/model/validate-model} (form-слой) и переиспользует `collect`/`runTasks` отсюда.
 *
 * @group Model
 * @module core/model/validate-model-core
 */

import { Signal } from '@preact/signals-core';
import type { ValidationError } from './types/contracts';
import type { FormSchemaNode } from './types/schema-node';
import type { FormModel, PathAwareSignal } from '../state/types';

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

export interface FieldTask {
  signal: PathAwareSignal<unknown>;
  validators: ModelValidator[];
  scope: unknown;
}

/** Результат обхода схемы: что валидировать и что очистить. */
export interface CollectResult {
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
    // Оба списка имеют контракт `(value, model, root)`. `validateModel`/`validateFormModel`
    // дожидаются async в `runTasks`, а `validateModelSync` пропускает промисы. Раньше движок
    // читал только `validators`, из-за чего `asyncValidators` узла схемы молча игнорировались.
    const syncValidators = (n.validators as ModelValidator[] | undefined) ?? [];
    const asyncValidators = (n.asyncValidators as ModelValidator[] | undefined) ?? [];
    const validators = asyncValidators.length
      ? [...syncValidators, ...asyncValidators]
      : syncValidators;
    if (validators.length > 0) {
      if (active)
        out.tasks.push({ signal: n.value as PathAwareSignal<unknown>, validators, scope });
      else out.clearSignals.push(n.value as PathAwareSignal<unknown>);
    }
    for (const [key, child] of Object.entries(n)) {
      if (key === 'value' || key === 'validators' || key === 'asyncValidators') continue;
      walk(child, scope, root, active, out);
    }
    return;
  }

  for (const child of Object.values(n)) walk(child, scope, root, active, out);
}

/** Один обход схемы → задачи (активные) + сигналы на очистку (выключенные ветки). */
export function collect(model: unknown, schema: unknown): CollectResult {
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
 * Есть ли среди собранных ошибок блокирующие. Ошибка с `severity: 'warning'` показывается,
 * но НЕ блокирует submit (см. {@link ValidationError.severity} — 'warning' allows submission),
 * поэтому `valid` выводится из наличия блокирующих ошибок, а не из общего количества ошибок.
 */
export const hasBlockingErrors = (errors: Record<string, ValidationError[]>): boolean => {
  for (const list of Object.values(errors)) {
    for (const err of list) if (err.severity !== 'warning') return true;
  }
  return false;
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
  return { valid: !hasBlockingErrors(errors), errors };
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
  return { valid: !hasBlockingErrors(errors), errors };
}

/** Прогон задач (sync + async): возвращает ошибки по пути. */
export async function runTasks(
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

/* eslint-enable @typescript-eslint/no-explicit-any */

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
import type { FormModel, PathAwareSignal } from './types';

/**
 * Валидатор слоя данных. `value` — значение поля; `model` — ближайший scope (под-модель элемента
 * массива или корень); `root` — корневая модель.
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

/**
 * Обходит дерево схемы, собирая задачи валидации (поле + его scope-модель).
 * - field-узел (есть `value`-сигнал) → задача с его валидаторами;
 * - array-секция (`componentProps.itemComponent` + `control`) → для каждого элемента модели
 *   вызывает `itemComponent(itemModel)` и рекурсивно обходит поддерево со scope = под-модель;
 * - контейнер → рекурсия по всем свойствам.
 */
function walk(node: unknown, scope: unknown, root: unknown, out: FieldTask[]): void {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, scope, root, out);
    return;
  }
  const n = node as Record<string, any>;

  if (isArraySection(n)) {
    const control = n.componentProps.control as { length: number; at: (i: number) => unknown };
    const itemComponent = n.componentProps.itemComponent as (item: unknown) => unknown;
    const len = control.length;
    for (let i = 0; i < len; i++) {
      const itemModel = control.at(i);
      walk(itemComponent(itemModel), itemModel, root, out);
    }
    return;
  }

  if (n.value instanceof Signal) {
    const validators = (n.validators as ModelValidator[] | undefined) ?? [];
    if (validators.length > 0) {
      out.push({ signal: n.value as PathAwareSignal<unknown>, validators, scope });
    }
    for (const [key, child] of Object.entries(n)) {
      if (key === 'value' || key === 'validators') continue;
      walk(child, scope, root, out);
    }
    return;
  }

  for (const child of Object.values(n)) walk(child, scope, root, out);
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
 */
export function validateModelSync<T>(model: FormModel<T>, schema: unknown): ModelValidationResult {
  const tasks: FieldTask[] = [];
  walk(schema, model, model, tasks);
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
  schema: unknown
): Promise<ModelValidationResult> {
  const tasks: FieldTask[] = [];
  walk(schema, model, model, tasks);
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
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * In-form валидация: прогоняет {@link validateModel} и роутит ошибки в ноды формы
 * (через реестр сигнал→нода): `node.setErrors(errors[path] ?? [])` — заодно очищает прошедшие поля.
 *
 * @group Model
 * @remarks Поля, не материализованные в форме (элементы массива — строятся per-item), не роутятся
 * в родительскую форму; их ошибки доступны в возвращаемом результате по пути.
 */
export async function validateFormModel<T>(
  model: FormModel<T>,
  schema: unknown
): Promise<ModelValidationResult> {
  const result = await validateModel(model, schema);
  const tasks: FieldTask[] = [];
  walk(schema, model, model, tasks);
  for (const { signal } of tasks) {
    const node = getNodeForSignal(signal);
    if (node) node.setErrors(result.errors[signal.__path] ?? []);
  }
  return result;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Ambient-сток схемы поведения и низкоуровневый набор авторинга.
 *
 * Операторы регистрируют свои отписки не в переданный им массив, а в сток «активной схемы» —
 * поэтому автор не видит ни `cleanups`, ни `.push`. Окно открывает `defineFormBehavior.__run`,
 * который вызывает `createForm({ behavior })`; жизненным циклом владеет форма.
 *
 * `current` — состояние модуля, и писатель (`__run`) живёт здесь же: наружу торчат только две
 * двери — {@link onDispose} (сток) и {@link getScope} (доступ к model/form/schema).
 *
 * @group Behaviors
 * @module form/behaviors/context
 */

import { effect as preactEffect } from '@preact/signals-core';
import type { BehaviorCleanup } from '../../model/behaviors-value';
import { runOutsideEffect } from '../../model/safe-effect';
import { createSchemaController, type SchemaController } from '../schema-controller';
import type { BehaviorScope, FormBehavior } from './types';

interface RunContext {
  cleanups: BehaviorCleanup[];
  model: unknown;
  form: unknown;
  controller: SchemaController;
}
let current: RunContext | null = null;

function requireCtx(op: string): RunContext {
  if (!current) {
    throw new Error(
      `[@reformer/core/behaviors] "${op}" вызван вне defineFormBehavior(...) — операторы поведения ` +
        `можно вызывать только внутри схемы.`
    );
  }
  return current;
}

/** Зарегистрировать произвольную отписку в активной схеме. */
export function onDispose(cleanup: BehaviorCleanup): void {
  requireCtx('onDispose').cleanups.push(cleanup);
}

/**
 * Зарегистрировать отписку, если оператор вызван внутри схемы поведения; вне схемы — ничего.
 * Для операторов, которые работают и сами по себе (правила узлов схемы).
 *
 * @internal
 */
export function onDisposeIfActive(cleanup: BehaviorCleanup): void {
  current?.cleanups.push(cleanup);
}

/** Текущая область ({ model, form, schema }) активной схемы (escape hatch для кросс-операторов). */
export function getScope<T>(): BehaviorScope<T> {
  const ctx = requireCtx('getScope');
  return scopeOf(ctx) as BehaviorScope<T>;
}

/**
 * Схема-контроллер сборки, в которой идёт активная схема: под-схемы (`apply`, `applyEach`)
 * получают через него область своей под-модели.
 *
 * @internal
 */
export function getController(op = 'getController'): SchemaController {
  return requireCtx(op).controller;
}

const scopeOf = (ctx: RunContext): BehaviorScope<unknown> =>
  ({
    model: ctx.model,
    form: ctx.form,
    schema: ctx.controller.scopeOf(ctx.model as object),
  }) as BehaviorScope<unknown>;

/**
 * Описать поведение формы декларативно. Возвращает {@link FormBehavior} для `createForm({ behavior })`.
 *
 * @example
 * ```ts
 * export const myBehavior = defineFormBehavior<MyForm>(({ model, form, schema }) => {
 *   compute(model.$.total, () => model.price * model.qty);
 *   enableWhen([model.$.city], () => Boolean(model.country));
 *   onChange(model.$.country, async (c) => form.city.updateComponentProps({ options: await load(c) }));
 *   hideWhen(schema.node('delivery'), () => model.country === '');
 * });
 * ```
 */
export function defineFormBehavior<T>(setup: (scope: BehaviorScope<T>) => void): FormBehavior<T> {
  return {
    __run(model, form, controller = createSchemaController()) {
      const ctx: RunContext = { cleanups: [], model, form, controller };
      const prev = current;
      current = ctx;
      try {
        setup(scopeOf(ctx) as BehaviorScope<T>);
      } finally {
        current = prev;
      }
      return () => {
        for (const c of ctx.cleanups) c();
      };
    },
  };
}

// ============================================================================
// Низкоуровневый набор авторинга
// ============================================================================

/** Реактивный эффект (авто-dispose). Колбэк может вернуть собственный cleanup. */
export function effect(fn: () => void | (() => void)): void {
  onDispose(preactEffect(fn));
}

/** Отложенная запись вне effect-контекста (микротаск) — защита от «Cycle detected». */
export function defer(fn: () => void): void {
  runOutsideEffect(fn);
}

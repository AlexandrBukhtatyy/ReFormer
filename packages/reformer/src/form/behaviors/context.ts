/**
 * Ambient-сток схемы поведения и низкоуровневый набор авторинга.
 *
 * Операторы регистрируют свои отписки не в переданный им массив, а в сток «активной схемы» —
 * поэтому автор не видит ни `cleanups`, ни `.push`. Окно открывает `defineFormBehavior.__run`,
 * который вызывает `createForm({ behavior })`; жизненным циклом владеет форма.
 *
 * `current` — состояние модуля, и писатель (`__run`) живёт здесь же: наружу торчат только две
 * двери — {@link onDispose} (сток) и {@link getScope} (доступ к model/form).
 *
 * @group Behaviors
 * @module form/behaviors/context
 */

import { effect as preactEffect } from '@preact/signals-core';
import { runOutsideEffect, type BehaviorCleanup } from '../../index';
import type { BehaviorScope, FormBehavior } from './types';

interface RunContext {
  cleanups: BehaviorCleanup[];
  model: unknown;
  form: unknown;
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

/** Текущий scope ({ model, form }) активной схемы (escape hatch для кросс-операторов). */
export function getScope<T>(): BehaviorScope<T> {
  const ctx = requireCtx('getScope');
  return { model: ctx.model, form: ctx.form } as BehaviorScope<T>;
}

/**
 * Описать поведение формы декларативно. Возвращает {@link FormBehavior} для `createForm({ behavior })`.
 *
 * @example
 * ```ts
 * export const myBehavior = defineFormBehavior<MyForm>(({ model, form }) => {
 *   compute(model.$.total, () => model.price * model.qty);
 *   enableWhen([model.$.city], () => Boolean(model.country));
 *   onChange(model.$.country, async (c) => form.city.updateComponentProps({ options: await load(c) }));
 * });
 * ```
 */
export function defineFormBehavior<T>(setup: (scope: BehaviorScope<T>) => void): FormBehavior<T> {
  return {
    __run(model, form) {
      const ctx: RunContext = { cleanups: [], model, form };
      const prev = current;
      current = ctx;
      try {
        setup({ model, form });
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

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
import {
  createSchemaController,
  type SchemaController,
  type SchemaNodeControl,
  type SchemaScope,
} from '../schema-controller';
import type { BehaviorScope, FormBehavior } from './types';
import type { FormFlow } from '../flow/flow';

interface RunContext {
  cleanups: BehaviorCleanup[];
  /** Отменители ещё не выполненных отложенных записей ({@link defer}) этой схемы. */
  deferred: Set<() => void>;
  model: unknown;
  form: unknown;
  controller: SchemaController;
  flow: FormFlow | undefined;
  /**
   * Откат того, что поведение сделало с узлами императивно (`setHidden`, `patchProps`), — при
   * снятии, после всех его отписок. См. {@link behaviorSchema}.
   */
  rollback?: () => void;
  /** Область схемы поведения — одна на прогон, см. {@link behaviorSchema}. */
  schema?: SchemaScope;
}
let current: RunContext | null = null;

/**
 * Отложенные записи схемы, в которой сейчас идёт прогон effect'а или отложенного задания. Effect
 * перезапускается и вне окна `setup` (`current` уже снят), а его `defer` всё равно должен попасть
 * в отменяемые записи своей схемы.
 */
let deferSink: Set<() => void> | null = null;

/** Выполнить `fn`, направив её `defer` в отложенные записи `sink`. */
function withDeferSink<R>(sink: Set<() => void>, fn: () => R): R {
  const previous = deferSink;
  deferSink = sink;
  try {
    return fn();
  } finally {
    deferSink = previous;
  }
}

/** Снять схему: её отписки и ещё не выполненные отложенные записи. */
function disposeRun(ctx: RunContext): void {
  for (const cleanup of ctx.cleanups) cleanup();
  for (const cancel of ctx.deferred) cancel();
  ctx.deferred.clear();
  // Последним: то, что поведение записало в узлы в своём `onDispose`, тоже откатывается.
  ctx.rollback?.();
}

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
 * Оператор вызван внутри схемы поведения? Иначе — понятная ошибка с именем оператора ДО любых
 * побочных эффектов: effect, созданный до проверки, остался бы жить, а признак derived — висеть.
 *
 * @internal
 */
export function assertInsideSchema(op: string): void {
  requireCtx(op);
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

/**
 * Поток шагов текущего прогона схемы — его получают поведения подформ и строк массива.
 *
 * @internal
 */
export function getFlow(op = 'getFlow'): FormFlow | undefined {
  return requireCtx(op).flow;
}

/**
 * Область схемы для поведения. То, что поведение сделало с узлами императивно (`setHidden`,
 * `patchProps`), снимается вместе с ним — как правила операторов: иначе новое поведение получило
 * бы узел скрытым прежним. Откатывается только то, что с тех пор никто не переписал.
 */
function behaviorSchema(ctx: RunContext): SchemaScope {
  if (ctx.schema) return ctx.schema;
  const scope = ctx.controller.scopeOf(ctx.model as object);
  const maps = scope.__overrideMaps;
  // По записи на селектор: последнее значение `hidden` и каждого ключа пропсов от этого поведения.
  const records = new Map<string, { hidden?: boolean; props: Map<string, unknown> }>();
  const recordOf = (selector: string) => {
    let record = records.get(selector);
    if (!record) {
      record = { props: new Map<string, unknown>() };
      records.set(selector, record);
    }
    return record;
  };
  ctx.rollback = () => {
    for (const [selector, own] of records) {
      const node = scope.node(selector);
      if (own.hidden !== undefined && maps.hiddenOverrides.get(selector) === own.hidden) {
        node.resetHidden();
      }
      const props = maps.propsOverrides.get(selector);
      if (props == null || own.props.size === 0) continue;
      const kept = Object.entries(props).filter(
        ([key, value]) => !(own.props.has(key) && Object.is(own.props.get(key), value))
      );
      if (kept.length === Object.keys(props).length) continue;
      node.resetProps();
      if (kept.length > 0) node.patchProps(Object.fromEntries(kept));
    }
    records.clear();
  };
  ctx.schema = {
    ...scope,
    node(selector: string): SchemaNodeControl {
      const node = scope.node(selector);
      const control: SchemaNodeControl = {
        ...node,
        setHidden(value) {
          node.setHidden(value);
          recordOf(selector).hidden = value;
          return control;
        },
        patchProps(partial) {
          node.patchProps(partial);
          const record = recordOf(selector);
          for (const [key, value] of Object.entries(partial)) record.props.set(key, value);
          return control;
        },
        resetHidden() {
          node.resetHidden();
          const record = records.get(selector);
          if (record) record.hidden = undefined;
          return control;
        },
        resetProps() {
          node.resetProps();
          records.get(selector)?.props.clear();
          return control;
        },
      };
      return control;
    },
  };
  return ctx.schema;
}

const scopeOf = (ctx: RunContext): BehaviorScope<unknown> =>
  ({
    model: ctx.model,
    form: ctx.form,
    schema: behaviorSchema(ctx),
    flow: ctx.flow,
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
    __run(model, form, controller = createSchemaController(), flow) {
      const ctx: RunContext = {
        cleanups: [],
        deferred: new Set(),
        model,
        form,
        controller,
        flow,
      };
      const prev = current;
      current = ctx;
      try {
        withDeferSink(ctx.deferred, () => setup(scopeOf(ctx) as BehaviorScope<T>));
      } catch (error) {
        // Сборка упала — снять то, что setup успел создать: снять это потом некому.
        disposeRun(ctx);
        throw error;
      } finally {
        current = prev;
      }
      return () => disposeRun(ctx);
    },
  };
}

// ============================================================================
// Низкоуровневый набор авторинга
// ============================================================================

/** Реактивный эффект (авто-dispose). Колбэк может вернуть собственный cleanup. */
export function effect(fn: () => void | (() => void)): void {
  const ctx = requireCtx('effect');
  const sink = ctx.deferred;
  ctx.cleanups.push(preactEffect(() => withDeferSink(sink, fn)));
}

/**
 * Отложенная запись вне effect-контекста (микротаск) — защита от «Cycle detected». Внутри схемы
 * поведения (в `setup`, в её effect'ах и отложенных заданиях) запись отменяется снятием схемы.
 */
export function defer(fn: () => void): void {
  const sink = deferSink ?? current?.deferred;
  if (!sink) {
    runOutsideEffect(fn);
    return;
  }
  const cancel = runOutsideEffect(() => {
    sink.delete(cancel);
    withDeferSink(sink, fn);
  });
  sink.add(cancel);
}

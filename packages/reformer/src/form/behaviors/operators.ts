/**
 * Операторы поведения над скалярным полем и группой.
 *
 * Тонкие обёртки над примитивами слоя модели (`model/behaviors-value`): добавляют регистрацию
 * отписки в ambient-сток, guard циклов и ветвление «скаляр / группа». Операторы над массивами и
 * под-моделями живут в `./collections`.
 *
 * @group Behaviors
 * @module form/behaviors/operators
 */

import type { Signal, ReadonlySignal } from '@preact/signals-core';
import {
  copyFrom as coreCopyFrom,
  watchField as coreWatchField,
  enableWhen as coreEnableWhen,
  transformValue as coreTransformValue,
  resetWhen as coreResetWhen,
  syncFields as coreSyncFields,
  revalidateWhen as coreRevalidateWhen,
  runOutsideEffect,
  markDerived,
  unmarkDerived,
} from '../../index';
import { onDispose, getScope, effect, defer } from './context';
import {
  type GroupSignals,
  isLeafSignal,
  asArray,
  readGroup,
  writeGroup,
  makeCycleGuard,
} from './internals';
import type { ChangeContext } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface NodeOps {
  enable(): void;
  disable(): void;
  reset(): void;
}
function nodeByPath(path: string | undefined): NodeOps | undefined {
  if (!path) return undefined;
  const { form } = getScope();
  const node = (form as unknown as { getFieldByPath(p: string): unknown }).getFieldByPath(path);
  return node as NodeOps | undefined;
}

/** Вычисляемое поле с auto-tracking: `target = read()` при изменении прочитанных сигналов. */
export function compute<R>(
  target: Signal<R>,
  read: () => R,
  options?: { when?: () => boolean }
): void {
  markDerived(target); // F9: bulk-load (set/patch/patchValue) не затирает вычисляемое поле
  onDispose(() => unmarkDerived(target)); // при снятии behavior снова разрешаем bulk-set (refcount)
  const guard = makeCycleGuard(target as Signal<unknown>); // F7: детект расходящегося цикла
  effect(() => {
    if (options?.when && !options.when()) return;
    const next = read();
    if (target.peek() === next) return;
    guard(() => {
      target.value = next;
    });
  });
}

/** Вычисляемое поле с явным списком зависимостей (escape hatch). */
export function computeFrom<R>(
  sources: ReadonlySignal<unknown>[],
  target: Signal<R>,
  fn: (...values: any[]) => R,
  options?: { when?: (...values: any[]) => boolean }
): void {
  markDerived(target); // F9: см. compute
  onDispose(() => unmarkDerived(target)); // refcount: см. compute
  const guard = makeCycleGuard(target as Signal<unknown>); // F7
  effect(() => {
    const values = sources.map((s) => s.value); // подписка на источники
    if (options?.when && !options.when(...values)) return;
    const next = fn(...values);
    if (target.peek() === next) return;
    guard(() => {
      target.value = next;
    });
  });
}

/** Копирование `source → target` — скаляр или группа (объект целиком). */
export function copyFrom<T>(
  source: ReadonlySignal<T> | object,
  target: Signal<T> | object,
  options?: { when?: () => boolean; transform?: (value: T) => T }
): void {
  if (isLeafSignal(source) && isLeafSignal(target)) {
    onDispose(coreCopyFrom(source as ReadonlySignal<T>, target as Signal<T>, options));
    return;
  }
  const src = source as GroupSignals;
  const dst = target as GroupSignals;
  effect(() => {
    const snapshot = readGroup(src); // подписка на все листья источника
    if (options?.when && !options.when()) return;
    defer(() => writeGroup(dst, snapshot));
  });
}

/**
 * Реакция на изменение поля; `{ debounce, immediate }`.
 *
 * Колбэк выполняется ВНЕ effect-контекста (микротаск/таймер) — можно безопасно писать сигналы и ноды
 * (`updateComponentProps`/`reset`/`clear`) без ручного `defer` и без «Cycle detected».
 *
 * Для async-колбэков 2-м аргументом приходит `{ signal }` (AbortSignal): при следующей смене значения
 * предыдущий `signal` аннулируется. Передавай его в `fetch` (сетевая отмена) или проверяй
 * `signal.aborted` перед применением результата — это убирает гонки устаревших ответов (F2).
 */
export function onChange<T>(
  source: ReadonlySignal<T>,
  cb: (value: T, ctx: ChangeContext) => void,
  options?: { immediate?: boolean; debounce?: number }
): void {
  let controller: AbortController | undefined;
  const fire = (v: T): void => {
    controller?.abort(); // аннулируем предыдущий in-flight вызов
    controller = new AbortController();
    const { signal } = controller;
    runOutsideEffect(() => cb(v, { signal }));
  };

  if (!options?.debounce) {
    onDispose(coreWatchField(source, fire, { immediate: options?.immediate }));
  } else {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = coreWatchField(
      source,
      (v) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fire(v), options.debounce);
      },
      { immediate: options?.immediate }
    );
    onDispose(() => {
      if (timer) clearTimeout(timer);
      stop();
    });
  }
  onDispose(() => controller?.abort());
}

type EnableTarget = ReadonlySignal<unknown> | object;

/** Условное включение поля(ей) — скаляр, массив целей или группа. `resetOnDisable=false` по умолчанию. */
export function enableWhen(
  target: EnableTarget | EnableTarget[],
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  for (const t of asArray(target)) {
    if (isLeafSignal(t)) {
      onDispose(coreEnableWhen(t as ReadonlySignal<unknown>, condition, options));
    } else {
      enableGroup(t as GroupSignals, condition, options);
    }
  }
}

/** Условное выключение поля(ей) (инверсия {@link enableWhen}). */
export function disableWhen(
  target: EnableTarget | EnableTarget[],
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  enableWhen(target, () => !condition(), options);
}

function enableGroup(
  g: GroupSignals,
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  const node = nodeByPath(g.__path);
  if (!node) return;
  effect(() => {
    const enabled = condition();
    defer(() => {
      if (enabled) node.enable();
      else {
        node.disable();
        if (options?.resetOnDisable) node.reset();
      }
    });
  });
}

/** Трансформация значения поля (идемпотентная). */
export function transformValue<T>(target: Signal<T>, transformer: (value: T) => T): void {
  onDispose(coreTransformValue(target, transformer));
}

/** Сброс значения по условию. */
export function resetWhen<T>(
  target: Signal<T>,
  condition: () => boolean,
  options?: { resetValue?: T }
): void {
  onDispose(coreResetWhen(target, condition, options));
}

/** Двусторонняя синхронизация двух полей. */
export function syncFields<T>(
  a: Signal<T>,
  b: Signal<T>,
  options?: { transform?: (value: T) => T }
): void {
  onDispose(coreSyncFields(a, b, options));
}

/** Ревалидация при изменении зависимостей. */
export function revalidateWhen(deps: ReadonlySignal<unknown>[], revalidate: () => void): void {
  onDispose(coreRevalidateWhen(deps, revalidate));
}

/* eslint-enable @typescript-eslint/no-explicit-any */

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

import { untracked, type Signal, type ReadonlySignal } from '@preact/signals-core';
import {
  copyFrom as coreCopyFrom,
  watchField as coreWatchField,
  transformValue as coreTransformValue,
  resetWhen as coreResetWhen,
  syncFields as coreSyncFields,
  revalidateWhen as coreRevalidateWhen,
  type ResetWhenOptionsArg,
} from '../../model/behaviors-value';
import { markDerived, unmarkDerived } from '../../model/derived-registry';
import { deferredWrites } from '../../model/safe-effect';
import { availabilityWrites, enableWhen as coreEnableWhen, type AvailabilityTarget } from './node';
import { getNodeForSignal } from '../signal-node-registry';
import { assertInsideSchema, onDispose, effect } from './context';
import {
  type GroupSignals,
  isLeafSignal,
  isValueHandle,
  asArray,
  readGroup,
  writeGroup,
  makeCycleGuard,
} from './internals';
import type { ChangeContext } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Вычисляемое поле с auto-tracking: `target = read()` при изменении прочитанных сигналов. */
export function compute<R>(
  target: Signal<R>,
  read: () => NoInfer<R>,
  options?: { when?: () => boolean }
): void {
  assertInsideSchema('compute');
  markDerived(target); // групповая запись (set/patch, setValue группы) не затирает вычисляемое поле
  onDispose(() => unmarkDerived(target)); // при снятии behavior снова разрешаем bulk-set (refcount)
  const guard = makeCycleGuard(target as Signal<unknown>); // детект расходящегося цикла
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
  fn: (...values: any[]) => NoInfer<R>,
  options?: { when?: (...values: any[]) => boolean }
): void {
  assertInsideSchema('computeFrom');
  markDerived(target); // см. compute
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

/**
 * Копирование `source → target` — скаляр или группа (объект целиком).
 *
 * Группы разной формы копируются как `set` группы модели: поля цели, которых нет в значении,
 * остаются прежними; в dev об этом одно предупреждение на оператор. Значение цели целиком
 * собирает `transform`.
 */
export function copyFrom<T>(
  source: ReadonlySignal<T> | object,
  target: Signal<T> | object,
  options?: { when?: () => boolean; transform?: (value: T) => T }
): void {
  assertInsideSchema('copyFrom');
  // Скаляр — лист или массив целиком: массив копируется значением, а не обходом по ключам.
  if (isValueHandle(source) && isValueHandle(target)) {
    onDispose(coreCopyFrom(source as ReadonlySignal<T>, target as Signal<T>, options));
    return;
  }
  const src = source as GroupSignals;
  const dst = target as GroupSignals;
  const when = options?.when;
  const transform = options?.transform;
  // Снимок и условие — в момент записи, и побеждает последняя запись: снимок, снятый при прогоне
  // effect'а, иначе затёр бы данные, загруженные в том же тике, хотя копирование уже выключено.
  const writes = deferredWrites();
  // Группы разной формы: поля цели, которых нет в значении, остаются прежними (как у `set`
  // группы модели) — предупреждаем об этом один раз на оператор, а не на каждую запись.
  let warned = false;
  effect(() => {
    readGroup(src); // подписка на все листья источника
    writes.cancelAll();
    if (when && !when()) return;
    writes.schedule(() => {
      if (when && !untracked(when)) return;
      const snapshot = untracked(() => readGroup(src)) as unknown as T;
      const value = transform ? transform(snapshot) : snapshot;
      const missing: string[] = [];
      writeGroup(dst, value as unknown as Record<string, unknown>, missing);
      if (missing.length > 0 && !warned && process.env.NODE_ENV !== 'production') {
        warned = true;
        console.warn(
          `[@reformer/core/behaviors] copyFrom(…, "${dst.__path ?? '?'}"): в значении нет полей ` +
            `цели ${missing.map((path) => `«${path}»`).join(', ')} — они остались прежними. ` +
            'Для групп разной формы соберите значение цели целиком в `transform`.'
        );
      }
    });
  });
  onDispose(() => writes.cancelAll());
}

/**
 * Реакция на изменение поля; `{ debounce, immediate }`.
 *
 * Колбэк выполняется ВНЕ effect-контекста (микротаск/таймер) — можно безопасно писать сигналы и ноды
 * (`updateComponentProps`/`reset`/`clear`) без ручного `defer` и без «Cycle detected».
 *
 * Для async-колбэков 2-м аргументом приходит `{ signal }` (AbortSignal): при следующей смене значения
 * предыдущий `signal` аннулируется. Передавай его в `fetch` (сетевая отмена) или проверяй
 * `signal.aborted` перед применением результата — это убирает гонки устаревших ответов.
 */
export function onChange<T>(
  source: ReadonlySignal<T>,
  cb: (value: T, ctx: ChangeContext) => void,
  options?: { immediate?: boolean; debounce?: number }
): void {
  assertInsideSchema('onChange');
  let controller: AbortController | undefined;
  // Колбэк каждого значения выполняется (предыдущие не отменяются), но снятие отменяет ещё не
  // выполненные — колбэк после dispose не вызывается.
  const calls = deferredWrites();
  const fire = (v: T): void => {
    controller?.abort(); // аннулируем предыдущий in-flight вызов
    controller = new AbortController();
    const { signal } = controller;
    calls.schedule(() => cb(v, { signal }));
  };

  if (!options?.debounce) {
    onDispose(coreWatchField(source, fire, { immediate: options?.immediate }));
  } else {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = coreWatchField(
      source,
      (v) => {
        // Значение сменилось — ответ на прежнее устарел уже сейчас, а не через задержку.
        controller?.abort();
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
  onDispose(() => {
    calls.cancelAll();
    controller?.abort();
  });
}

type EnableTarget = ReadonlySignal<unknown> | object;

/** Условное включение поля(ей) — скаляр, массив целей или группа. `resetOnDisable=false` по умолчанию. */
export function enableWhen(
  target: EnableTarget | EnableTarget[],
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  assertInsideSchema('enableWhen');
  applyAvailability('enableWhen', target, condition, options);
}

/** Условное выключение поля(ей) (инверсия {@link enableWhen}). */
export function disableWhen(
  target: EnableTarget | EnableTarget[],
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  assertInsideSchema('disableWhen');
  applyAvailability('disableWhen', target, () => !condition(), options);
}

/**
 * У цели нет ноды формы — правило ничего не выключит. Почти всегда это поле, которого нет в схеме
 * формы, или ручка чужой модели; в dev об этом предупреждение.
 */
function warnWithoutNode(op: string, target: object): void {
  if (process.env.NODE_ENV === 'production' || getNodeForSignal(target)) return;
  const path = (target as { __path?: string }).__path ?? '?';
  console.warn(
    `[@reformer/core/behaviors] ${op}("${path}"): у поля нет ноды формы — правило ничего не ` +
      'сделает. Поле не описано в схеме формы, либо ручка взята из другой модели.'
  );
}

function applyAvailability(
  op: string,
  target: EnableTarget | EnableTarget[],
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  for (const t of asArray(target)) {
    warnWithoutNode(op, t);
    if (isLeafSignal(t)) {
      onDispose(coreEnableWhen(t as ReadonlySignal<unknown>, condition, options));
    } else {
      enableGroup(t as GroupSignals, condition, options);
    }
  }
}

function enableGroup(
  g: GroupSignals,
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  // Нода — по идентичности ручки, а не по пути: путь ручки абсолютный (`items.0.address`), а
  // форма строки массива — отдельный корень. Поиск по пути в схеме строки ничего не находил.
  const node = getNodeForSignal(g) as AvailabilityTarget | undefined;
  if (!node) return;
  const writes = availabilityWrites(condition, options);
  effect(() => {
    condition(); // подписка на сигналы условия
    writes.schedule(node);
  });
  onDispose(writes.cancel);
}

/** Трансформация значения поля (идемпотентная). */
export function transformValue<T>(target: Signal<T>, transformer: (value: T) => T): void {
  assertInsideSchema('transformValue');
  onDispose(coreTransformValue(target, transformer));
}

/**
 * Сброс значения по условию. Без `resetValue` поле сбрасывается в `null` — поэтому полю, в тип
 * которого `null` не входит, `resetValue` обязателен (см. {@link ResetWhenOptionsArg}).
 */
export function resetWhen<T>(
  target: Signal<T>,
  condition: () => boolean,
  ...options: ResetWhenOptionsArg<T>
): void {
  assertInsideSchema('resetWhen');
  onDispose(coreResetWhen(target, condition, ...options));
}

/** Двусторонняя синхронизация двух полей. */
export function syncFields<T>(
  a: Signal<T>,
  b: Signal<NoInfer<T>>,
  options?: { transform?: (value: T) => T }
): void {
  assertInsideSchema('syncFields');
  onDispose(coreSyncFields(a, b, options));
}

/** Ревалидация при изменении зависимостей. */
export function revalidateWhen(deps: ReadonlySignal<unknown>[], revalidate: () => void): void {
  assertInsideSchema('revalidateWhen');
  onDispose(coreRevalidateWhen(deps, revalidate));
}

/* eslint-enable @typescript-eslint/no-explicit-any */

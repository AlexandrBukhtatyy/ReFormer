/**
 * Behavior на сигналах модели (слой данных, M1, Ф5).
 *
 * Value-операции (`computeFrom`/`copyFrom`/`watchField`) под M1 чисто model-level: эффект читает
 * сигналы-источники и пишет сигнал-цель — ноды не нужны. Цель не входит в источники → цикла нет,
 * запись синхронная с peek-guard (idempotent).
 *
 * State-операции (`enableWhen`/`disableWhen`: enable/disable/reset) затрагивают состояние НОДЫ и
 * требуют реестра сигнал→нода из `createForm` — добавляются вместе с ним (вне этого модуля).
 *
 * @group Model
 * @module core/model/behaviors
 */

import { effect, type Signal, type ReadonlySignal } from '@preact/signals-core';
import { getNodeForSignal } from '../utils/signal-node-registry';
import { runOutsideEffect } from '../utils/safe-effect';

/** Функция отписки от behavior-эффекта. */
export type BehaviorCleanup = () => void;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Вычисляемое поле: `target = fn(...sourceValues)` при изменении источников.
 *
 * @group Model
 * @param sources Сигналы-источники (`model.$.a`, `model.$.b`).
 * @param target Сигнал-цель (`model.$.total`).
 * @param fn Функция вычисления значения.
 * @param options.when Опциональное условие (получает значения источников); если false — пропуск.
 * @returns Cleanup для отписки.
 *
 * @example
 * ```typescript
 * computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty);
 * ```
 */
export function computeFrom<R>(
  sources: ReadonlySignal<any>[],
  target: Signal<R>,
  fn: (...values: any[]) => R,
  options?: { when?: (...values: any[]) => boolean }
): BehaviorCleanup {
  return effect(() => {
    const values = sources.map((s) => s.value); // подписка на источники
    if (options?.when && !options.when(...values)) return;
    const next = fn(...values);
    if (target.peek() !== next) target.value = next;
  });
}

/**
 * Копирование значения `source → target` (опционально по условию/с трансформом).
 *
 * @group Model
 * @example
 * ```typescript
 * copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail });
 * ```
 */
export function copyFrom<T>(
  source: ReadonlySignal<T>,
  target: Signal<T>,
  options?: { when?: () => boolean; transform?: (value: T) => T }
): BehaviorCleanup {
  return effect(() => {
    const value = source.value; // подписка на источник
    if (options?.when && !options.when()) return; // условие тоже реактивно (читает свои сигналы)
    const next = options?.transform ? options.transform(value) : value;
    if (target.peek() !== next) target.value = next;
  });
}

/**
 * Реакция на изменение поля: вызывает `cb(value)` при каждом изменении (по умолчанию без вызова на
 * инициализации; `immediate: true` — вызвать сразу).
 *
 * @group Model
 * @example
 * ```typescript
 * watchField(model.$.country, async (country) => {
 *   model.city = '';
 *   // ... загрузить города
 * });
 * ```
 */
export function watchField<T>(
  source: ReadonlySignal<T>,
  cb: (value: T) => void,
  options?: { immediate?: boolean }
): BehaviorCleanup {
  let initial = true;
  return effect(() => {
    const value = source.value; // подписка
    if (initial) {
      initial = false;
      if (!options?.immediate) return;
    }
    cb(value);
  });
}

/**
 * Условное включение поля (state-операция). Резолвит ноду по сигналу-цели через реестр
 * сигнал→нода (заполняется `createForm`) и вызывает `enable()`/`disable()` (+`reset()` при
 * `resetOnDisable`). `condition` реактивен (читает свои сигналы модели).
 *
 * Запись состояния отложена через `runOutsideEffect` (микротаск) для защиты от «Cycle detected».
 * ⚠️ Поле должно быть материализовано в форме (`createForm`) — иначе ноды в реестре нет (например,
 * элемент массива, который строится per-item).
 *
 * @group Model
 * @example
 * ```typescript
 * enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', { resetOnDisable: true });
 * ```
 */
export function enableWhen(
  target: ReadonlySignal<unknown>,
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): BehaviorCleanup {
  return effect(() => {
    const enabled = condition(); // подписка на сигналы условия
    const node = getNodeForSignal(target as Signal<unknown>);
    if (!node) return;
    runOutsideEffect(() => {
      if (enabled) {
        node.enable();
      } else {
        node.disable();
        if (options?.resetOnDisable) node.reset();
      }
    });
  });
}

/**
 * Условное выключение поля (инверсия {@link enableWhen}). Резолвит ноду по сигналу-цели через реестр
 * сигнал→нода и вызывает `disable()`, когда `condition` истинно (+`reset()` при `resetOnDisable`).
 * `condition` реактивен (читает свои сигналы модели).
 *
 * @group Model
 * @param target Сигнал-цель поля (`model.$.<path>`).
 * @param condition Реактивное условие; при `true` поле выключается.
 * @param options.resetOnDisable Сбросить значение при выключении (по умолчанию `false`).
 * @returns Cleanup для отписки.
 *
 * @example
 * ```typescript
 * // Поле скидки недоступно, пока не выбран промо-тариф
 * disableWhen(model.$.discount, () => model.plan !== 'promo', { resetOnDisable: true });
 * ```
 */
export function disableWhen(
  target: ReadonlySignal<unknown>,
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): BehaviorCleanup {
  return enableWhen(target, () => !condition(), options);
}

/**
 * Трансформация значения поля (идемпотентная): при изменении пишет `transformer(value)` обратно.
 * Запись отложена (`runOutsideEffect`) во избежание «Cycle detected» (эффект читает и пишет один сигнал).
 *
 * @group Model
 * @example
 * ```typescript
 * transformValue(model.$.promoCode, (v) => (v ?? '').toUpperCase());
 * ```
 */
export function transformValue<T>(
  target: Signal<T>,
  transformer: (value: T) => T
): BehaviorCleanup {
  let applying = false;
  return effect(() => {
    const value = target.value;
    if (applying) return; // игнорируем собственную запись (не зацикливаемся)
    runOutsideEffect(() => {
      const next = transformer(value);
      if (target.peek() === next) return;
      applying = true;
      try {
        target.value = next;
      } finally {
        applying = false;
      }
    });
  });
}

/**
 * Сброс значения поля к `resetValue` (по умолчанию `null`), когда `condition` истинно.
 *
 * @group Model
 * @example
 * ```typescript
 * resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
 * ```
 */
export function resetWhen<T>(
  target: Signal<T>,
  condition: () => boolean,
  options?: { resetValue?: T }
): BehaviorCleanup {
  const resetValue = (options?.resetValue ?? null) as T;
  return effect(() => {
    const should = condition();
    runOutsideEffect(() => {
      if (should && target.peek() !== resetValue) target.value = resetValue;
    });
  });
}

/**
 * Двусторонняя синхронизация двух полей (опционально с трансформом `a → b`).
 * Сходимость обеспечивается peek-guard'ом; флаг предотвращает лишние круги.
 *
 * @group Model
 * @example
 * ```typescript
 * syncFields(model.$.field1, model.$.field2);
 * ```
 */
export function syncFields<T>(
  a: Signal<T>,
  b: Signal<T>,
  options?: { transform?: (value: T) => T }
): BehaviorCleanup {
  const transform = options?.transform;
  let updating = false;
  const d1 = effect(() => {
    const v = a.value;
    if (updating) return;
    runOutsideEffect(() => {
      updating = true;
      try {
        const next = transform ? transform(v) : v;
        if (b.peek() !== next) b.value = next;
      } finally {
        updating = false;
      }
    });
  });
  const d2 = effect(() => {
    const v = b.value;
    if (updating) return;
    runOutsideEffect(() => {
      updating = true;
      try {
        if (a.peek() !== v) a.value = v;
      } finally {
        updating = false;
      }
    });
  });
  return () => {
    d1();
    d2();
  };
}

/**
 * Вызывает `revalidate()` при изменении зависимостей (не на инициализации). Под M1 валидация
 * on-demand (`validateFormModel`), поэтому ревалидация выражается явным колбэком.
 *
 * @group Model
 * @example
 * ```typescript
 * revalidateWhen([model.$.maxAmount], () => validateFormModel(model, schema));
 * ```
 */
export function revalidateWhen(
  deps: ReadonlySignal<unknown>[],
  revalidate: () => void
): BehaviorCleanup {
  let initial = true;
  return effect(() => {
    deps.forEach((d) => d.value); // подписка на зависимости
    if (initial) {
      initial = false;
      return;
    }
    runOutsideEffect(() => revalidate());
  });
}

/* eslint-enable @typescript-eslint/no-explicit-any */

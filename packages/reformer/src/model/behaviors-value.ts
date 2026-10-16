/**
 * Value-операции behavior на сигналах модели — чистый слой данных.
 *
 * Эти операторы читают сигналы-источники и пишут сигнал-цель — НОДЫ не нужны, реестра сигнал→нода
 * они не касаются. Цель не входит в источники → цикла нет; запись синхронная/отложенная с peek-guard
 * (idempotent). Не зависят от form-слоя.
 *
 * Операции над состоянием ноды (`enableWhen`/`disableWhen`) вынесены в
 * {@link module:form/behaviors/node} — они резолвят ноду по сигналу через реестр из `createForm`.
 *
 * @group Model
 * @module model/behaviors-value
 */

import { effect, type Signal, type ReadonlySignal } from '@preact/signals-core';
import { deferredWrites } from './safe-effect';

/** Функция отписки от behavior-эффекта. */
export type BehaviorCleanup = () => void;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Вычисляемое поле: `target = fn(...sourceValues)` при изменении источников.
 *
 * Примитив модели: цель вычисляемой НЕ помечает. Поэтому массовая запись (`model.set`,
 * `model.patch`, `model.reset`) её перезаписывает, а `isDirty()` её учитывает — до следующей смены
 * источников. Оператор поведения `computeFrom` из `@reformer/core/behaviors` цель помечает
 * (`markDerived`) и защищён от циклов: массовая запись такую цель не трогает. В поведении формы
 * нужен оператор; примитив — для модели без формы.
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
  fn: (...values: any[]) => NoInfer<R>,
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
  const writes = deferredWrites();
  const stop = effect(() => {
    void target.value; // подписка
    if (applying) return; // игнорируем собственную запись (не зацикливаемся)
    writes.schedule(() => {
      // Текущее значение, а не замкнутое при прогоне: иначе подписчик увидел бы откат к
      // преобразованию старого значения ('abc' → 'AB' → 'ABC').
      const next = transformer(target.peek());
      if (target.peek() === next) return;
      applying = true;
      try {
        target.value = next;
      } finally {
        applying = false;
      }
    });
  });
  return () => {
    stop();
    writes.cancelAll();
  };
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
  options?: { resetValue?: NoInfer<T> }
): BehaviorCleanup {
  const resetValue = (options?.resetValue ?? null) as T;
  const writes = deferredWrites();
  const stop = effect(() => {
    condition(); // подписка на сигналы условия
    writes.schedule(() => {
      // Условие — в момент записи: если к нему оно снова ложно (сброс и загрузка данных в одном
      // обработчике), поле не стирается.
      if (condition() && target.peek() !== resetValue) target.value = resetValue;
    });
  });
  return () => {
    stop();
    writes.cancelAll();
  };
}

/**
 * Двусторонняя синхронизация двух полей (опционально с трансформом `a → b`).
 * Сходимость обеспечивается peek-guard'ом; флаг предотвращает лишние круги. При создании источник —
 * `a`: `b` получает его значение (через `transform`), обратной записи при создании нет. Записи в
 * оба поля в одном тике — побеждает последняя.
 *
 * @group Model
 * @example
 * ```typescript
 * syncFields(model.$.field1, model.$.field2);
 * ```
 */
export function syncFields<T>(
  a: Signal<T>,
  b: Signal<NoInfer<T>>,
  options?: { transform?: (value: T) => T }
): BehaviorCleanup {
  const transform = options?.transform;
  let updating = false;
  let initialB = true;
  const writes = deferredWrites();
  // Задания пишут текущее значение источника, а не замкнутое при прогоне: иначе две начальные
  // записи меняли поля местами и теряли данные. Побеждает последняя запись: новое задание
  // отменяет ожидающее — иначе начальное копирование a → b затёрло бы запись в b, сделанную в том
  // же тике сразу после создания связи.
  const d1 = effect(() => {
    void a.value;
    if (updating) return;
    writes.cancelAll();
    writes.schedule(() => {
      updating = true;
      try {
        const current = a.peek();
        const next = transform ? transform(current) : current;
        if (b.peek() !== next) b.value = next;
      } finally {
        updating = false;
      }
    });
  });
  const d2 = effect(() => {
    void b.value;
    // Первый прогон — только подписка: при создании направление одно, a → b.
    if (initialB) {
      initialB = false;
      return;
    }
    if (updating) return;
    writes.cancelAll();
    writes.schedule(() => {
      updating = true;
      try {
        const current = b.peek();
        if (a.peek() !== current) a.value = current;
      } finally {
        updating = false;
      }
    });
  });
  return () => {
    d1();
    d2();
    writes.cancelAll();
  };
}

/**
 * Вызывает `revalidate()` при изменении зависимостей (не на инициализации). Валидация on-demand
 * (`validateModel` из `@reformer/core/validation`), поэтому ревалидация выражается явным колбэком.
 *
 * @group Model
 * @example
 * ```typescript
 * revalidateWhen([model.$.maxAmount], () => void validateModel(model, schema));
 * ```
 */
export function revalidateWhen(
  deps: ReadonlySignal<unknown>[],
  revalidate: () => void
): BehaviorCleanup {
  let initial = true;
  const writes = deferredWrites();
  const stop = effect(() => {
    deps.forEach((d) => d.value); // подписка на зависимости
    if (initial) {
      initial = false;
      return;
    }
    writes.schedule(() => revalidate());
  });
  return () => {
    stop();
    writes.cancelAll();
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

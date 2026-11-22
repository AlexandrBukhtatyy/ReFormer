/**
 * Примеры ПОЛЬЗОВАТЕЛЬСКИХ операторов поверх контракта @reformer/core/behaviors.
 *
 * Это НЕ часть публичного API ядра — намеренно. Контракт держится тонким; такие операторы пишутся
 * в пользовательском коде (например, в app `schemas/operators.ts`) и неотличимы от встроенных на месте
 * вызова. Здесь — референсные реализации для F3 (throttle) и F4 (двусторонняя конвертация),
 * скопируйте к себе при необходимости.
 *
 * Каждый оператор — обычная функция, композиция встроенного `onChange`. Никакого ручного управления
 * cleanup'ами: их собирает активная `defineFormBehavior`.
 */

import { onChange, type ReadonlySignal, type Signal } from '../../src/form/behaviors';

/**
 * F4 — двусторонняя конвертация двух числовых полей (last-edited-wins).
 *
 * Правка `a` пересчитывает `b = aToB(a)`, правка `b` пересчитывает `a = bToA(b)`. Сравнение-перед-записью
 * с допуском `eps` гасит пинг-понг при потерях­ных конверсиях (округление валют/единиц). Для точных
 * конверсий (×100) допуск роли не играет.
 *
 * @example
 * convertBetween(model.$.meters, model.$.cm, (m) => m * 100, (c) => c / 100);
 */
export function convertBetween(
  a: Signal<number>,
  b: Signal<number>,
  aToB: (value: number) => number,
  bToA: (value: number) => number,
  eps = 1e-9
): void {
  let internal = false;
  onChange(a, (x) => {
    if (internal) return;
    const next = aToB(x);
    if (Math.abs(b.peek() - next) > eps) {
      internal = true;
      b.value = next;
      internal = false;
    }
  });
  onChange(b, (x) => {
    if (internal) return;
    const next = bToA(x);
    if (Math.abs(a.peek() - next) > eps) {
      internal = true;
      a.value = next;
      internal = false;
    }
  });
}

/**
 * F3 — throttle (leading-edge): реагирует на первое изменение, затем подавляет вызовы, пока не пройдёт
 * `ms`. Дополняет встроенный `{ debounce }` у `onChange` (debounce ждёт тишины, throttle ограничивает
 * частоту). `now` инъектируется для детерминизма в тестах (по умолчанию `Date.now`).
 *
 * @example
 * onChangeThrottled(model.$.term, (v) => search(v), 300);
 */
export function onChangeThrottled<T>(
  source: ReadonlySignal<T>,
  cb: (value: T) => void,
  ms: number,
  now: () => number = Date.now
): void {
  let last = -Infinity;
  onChange(source, (value) => {
    const t = now();
    if (t - last >= ms) {
      last = t;
      cb(value);
    }
  });
}

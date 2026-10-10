/**
 * State-операции behavior, затрагивающие НОДУ формы (слой формы).
 *
 * `enableWhen`/`disableWhen` меняют состояние ноды (enable/disable/reset), поэтому резолвят ноду по
 * сигналу-цели через реестр сигнал→нода (заполняется `createForm`). В отличие от чистых value-операций
 * ({@link module:model/behaviors-value}) эти операторы зависят от form-слоя — граница model⇏form
 * проходит здесь.
 *
 * @group Form
 * @module form/behaviors/node
 */

import { effect, untracked, type Signal, type ReadonlySignal } from '@preact/signals-core';
import { getNodeForSignal } from '../signal-node-registry';
import { deferredWrites } from '../../model/safe-effect';
import type { BehaviorCleanup } from '../../model/behaviors-value';

/** Нода, чьей доступностью управляет оператор: поле, группа или массив под-форм. */
export interface AvailabilityTarget {
  enable(): void;
  disable(): void;
  reset(): void;
}

/**
 * Отложенное применение доступности ноды по условию.
 *
 * Решение принимается в момент записи, а новое задание отменяет ожидающее (побеждает последнее):
 * иначе задание «выключить и стереть» первого прогона выполнилось бы после загрузки данных в том же
 * тике и стёрло их, хотя поле к этому моменту уже снова доступно. Снятие отменяет ожидающее
 * задание — запись после dispose не случится.
 *
 * @internal
 */
export function availabilityWrites(
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): { schedule(node: AvailabilityTarget): void; cancel(): void } {
  const writes = deferredWrites();
  return {
    schedule(node) {
      writes.cancelAll();
      writes.schedule(() => {
        if (untracked(condition)) {
          node.enable();
        } else {
          node.disable();
          if (options?.resetOnDisable) node.reset();
        }
      });
    },
    cancel: () => writes.cancelAll(),
  };
}

/**
 * Условное включение поля (state-операция). Резолвит ноду по сигналу-цели через реестр
 * сигнал→нода (заполняется `createForm`) и вызывает `enable()`/`disable()` (+`reset()` при
 * `resetOnDisable`). `condition` реактивен (читает свои сигналы модели).
 *
 * Запись состояния отложена на микротаск для защиты от «Cycle detected». Условие читается в момент
 * записи, и побеждает последнее решение: загрузка данных в том же тике, что и сборка, не стирается
 * заданием первого прогона. Снятие отменяет ещё не выполненную запись.
 * ⚠️ Поле должно быть материализовано в форме (`createForm`) — иначе ноды в реестре нет (например,
 * элемент массива, который строится per-item).
 *
 * ⚠️ Если то же поле одновременно является целью `compute`/`computeFrom`, обязательно ограничь
 * compute тем же условием (`when`), что и это `enableWhen`. Механизмы не согласованы: `enableWhen`
 * работает со статус-машиной ноды (enable/disable/reset), а `compute` пишет `target.value` напрямую
 * в сигнал модели и проверяет только собственный `options.when` — состояние `disabled` он НЕ смотрит.
 * Поэтому при выключенном поле любое изменение зависимости compute молча заново заполнит его (а с
 * `resetOnDisable` — перезапишет только что сброшенное значение), и так как `getValue()`/`submit`
 * включают disabled-поля, мусор утечёт в payload. Это аналог правила #13 гайда add-behavior,
 * которое сегодня сформулировано только для `copyFrom`; для `compute` то же ограничение обязательно.
 *
 * @group Form
 * @example
 * ```typescript
 * enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', { resetOnDisable: true });
 *
 * // Поле-цель compute, которое ТАКЖЕ в resetOnDisable enableWhen: compute обязан нести тот же when,
 * // иначе initialPayment заново заполнится в выключенном состоянии и утечёт в submit.
 * compute(model.$.initialPayment, () => model.propertyValue * 0.2, {
 *   when: () => model.loanType === 'mortgage',
 * });
 * ```
 */
export function enableWhen(
  target: ReadonlySignal<unknown>,
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): BehaviorCleanup {
  const writes = availabilityWrites(condition, options);
  const stop = effect(() => {
    condition(); // подписка на сигналы условия
    const node = getNodeForSignal(target as Signal<unknown>);
    if (node) writes.schedule(node);
  });
  return () => {
    stop();
    writes.cancel();
  };
}

/**
 * Условное выключение поля (инверсия {@link enableWhen}). Резолвит ноду по сигналу-цели через реестр
 * сигнал→нода и вызывает `disable()`, когда `condition` истинно (+`reset()` при `resetOnDisable`).
 * `condition` реактивен (читает свои сигналы модели).
 *
 * @group Form
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

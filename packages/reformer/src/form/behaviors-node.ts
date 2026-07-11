/**
 * State-операции behavior, затрагивающие НОДУ формы (слой формы, M1, Ф5).
 *
 * `enableWhen`/`disableWhen` меняют состояние ноды (enable/disable/reset), поэтому резолвят ноду по
 * сигналу-цели через реестр сигнал→нода (заполняется `createForm`). В отличие от чистых value-операций
 * ({@link module:core/model/behaviors-value}) эти операторы зависят от form-слоя — граница state⇏form
 * проходит здесь.
 *
 * @group Model
 * @module core/model/behaviors-node
 */

import { effect, type Signal, type ReadonlySignal } from '@preact/signals-core';
import { getNodeForSignal } from './signal-node-registry';
import { runOutsideEffect } from '../state/safe-effect';
import type { BehaviorCleanup } from '../state/behaviors-value';

/**
 * Условное включение поля (state-операция). Резолвит ноду по сигналу-цели через реестр
 * сигнал→нода (заполняется `createForm`) и вызывает `enable()`/`disable()` (+`reset()` при
 * `resetOnDisable`). `condition` реактивен (читает свои сигналы модели).
 *
 * Запись состояния отложена через `runOutsideEffect` (микротаск) для защиты от «Cycle detected».
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
 * @group Model
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

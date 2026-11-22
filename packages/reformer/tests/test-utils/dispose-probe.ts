/**
 * Зонд «правка → снятие в том же тике» для отложенных записей поведения.
 *
 * Часть операторов пишет не сразу, а на микротаске или таймере (`enableWhen`, `copyFrom` группы,
 * `syncFields`, `transformValue`, `onChange`, …). Сценарий зонда: источник изменился, и форму сразу
 * сняли — в том же тике (размонтирование, смена сборки). Снятое поведение больше ничего не пишет.
 *
 * Зонд идёт парой: контроль без снятия (запись есть — зонд не холостой) и сам зонд (правка и снятие
 * в одном тике — записи нет). Прогон один и тот же: собрать, дождаться начальных записей сборки,
 * поправить источник, при необходимости снять, дождаться — и спросить, была ли запись.
 *
 * @example
 * ```ts
 * const checks = disposeProbeChecks({
 *   build: () => createFormFromModel({ model: createModel({ code: '' }), behavior }),
 *   change: (form) => form.code.setValue('abc'),
 *   dispose: disposeForm,
 *   written: (form) => form.code.value.value === 'ABC',
 * });
 * it('transformValue: без снятия запись случается (контроль)', checks.control);
 * it('transformValue: снятие в том же тике отменяет запись', checks.disposed);
 * ```
 *
 * @module test-utils/dispose-probe
 */

import { expect } from 'vitest';
import { tick } from './async';

/** Сценарий зонда над объектом `TSubject` — формой, сборкой или тем, что их держит. */
export interface DisposeProbe<TSubject> {
  /** Собрать объект зонда — форму с поведением. */
  build(): TSubject;
  /** Правка источника: после неё поведение планирует отложенную запись. */
  change(subject: TSubject): void;
  /** Снять поведение — форму или сборку целиком. */
  dispose(subject: TSubject): void;
  /** Случилась ли отложенная запись. */
  written(subject: TSubject): boolean;
  /**
   * Дождаться отложенных записей; по умолчанию — макротаск (`tick()`). Под фейковыми часами —
   * свой способ: макротаск таймером тогда не наступит.
   */
  wait?(): Promise<void>;
}

/**
 * Прогнать зонд: собрать, дождаться начальных записей, поправить источник и, если надо, снять — в
 * том же тике; затем дождаться отложенных записей.
 *
 * @param probe - Сценарий.
 * @param disposeInSameTick - Снимать ли объект сразу после правки.
 * @returns Случилась ли отложенная запись.
 */
export async function runDisposeProbe<TSubject>(
  probe: DisposeProbe<TSubject>,
  disposeInSameTick: boolean
): Promise<boolean> {
  const wait = (): Promise<void> => (probe.wait ? probe.wait() : tick());
  const subject = probe.build();
  await wait();

  probe.change(subject);
  if (disposeInSameTick) probe.dispose(subject);
  await wait();

  return probe.written(subject);
}

/**
 * Пара проверок сценария — тела двух тестов.
 *
 * @returns `control` — без снятия запись случается; `disposed` — снятие в том же тике её отменяет.
 */
export function disposeProbeChecks<TSubject>(probe: DisposeProbe<TSubject>): {
  control(): Promise<void>;
  disposed(): Promise<void>;
} {
  return {
    async control() {
      expect(await runDisposeProbe(probe, false)).toBe(true);
    },
    async disposed() {
      expect(await runDisposeProbe(probe, true)).toBe(false);
    },
  };
}

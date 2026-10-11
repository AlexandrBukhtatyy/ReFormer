/**
 * Счёт живых effect'ов — инструмент тестов утечек.
 *
 * Все реактивные подписки ядра создаются через `effect` из `@preact/signals-core`. Обёртка над
 * этим экспортом считает созданные и ещё не снятые effect'ы; после `dispose` формы, размонтирования
 * хука или остановки стратегии число обязано вернуться к исходному. Подписки `Signal.subscribe`
 * идут мимо `effect` и в счёт не попадают — их проверяют поведенчески.
 *
 * Два счётчика: {@link liveEffects} — сколько effect'ов живо сейчас, {@link createdEffects} —
 * сколько создано за всё время. Пересоздание подписки (снять и тут же создать заново, например на
 * каждом рендере хука) число живых не меняет — его видно только по числу созданных.
 *
 * Подключение в тестовом файле (до импорта исходников):
 * ```ts
 * vi.mock('@preact/signals-core', async (importOriginal) =>
 *   (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
 * );
 * import { createdEffects, liveEffects } from '../test-utils/effect-tracker';
 * ```
 *
 * @module test-utils/effect-tracker
 */

import type * as Signals from '@preact/signals-core';

let live = 0;
let created = 0;

/** Сколько effect'ов создано и не снято. */
export const liveEffects = (): number => live;

/**
 * Сколько effect'ов создано за всё время (снятые тоже в счёте). Сравнивают разность «до» и
 * «после»: ререндер без новых effect'ов оставляет её нулевой, пересоздание подписки — нет.
 */
export const createdEffects = (): number => created;

/** Модуль `@preact/signals-core` с подсчитывающим `effect`; остальные экспорты — оригинальные. */
export function trackEffects(actual: typeof Signals): typeof Signals {
  const effect = ((fn: Parameters<typeof actual.effect>[0], options?: unknown) => {
    // Бросил на первом прогоне — effect не создан и в счёт не попадает.
    const dispose = (actual.effect as (f: unknown, o?: unknown) => () => void)(fn, options);
    live++;
    created++;
    let disposed = false;
    const tracked = (): void => {
      if (!disposed) {
        disposed = true;
        live--;
      }
      dispose();
    };
    return Object.assign(tracked, { [Symbol.dispose]: tracked });
  }) as typeof actual.effect;
  return { ...actual, effect };
}

/**
 * Замены целей генерации: цель, объявившая `overrides`, снимает заменённую с печати.
 *
 * ## Почему здесь
 *
 * Правило нужно двум сторонам из разных доменов: хозяину генерации — чтобы печатать модуль
 * и показывать отказы, стеку — чтобы его меню «Сгенерировать» перечисляло те же цели, что
 * печатаются. Разошлись бы два правила — меню предлагало бы файл, который печатает не он.
 *
 * ## Что знает стек
 *
 * Замена, написанная под ПРЕЖНИЙ контракт стека (заменяет цель, которой больше нет, или
 * печатает по пути прежней раскладки), не побеждает: печатать её нечем, а снятая ею встроенная
 * цель оставила бы модуль без файла, который он импортирует. Узнать такую замену может только
 * стек — он и отвечает крючком {@link StaleOverride}; здесь — только общее правило.
 *
 * @module @reformer/builder-toolkit/codegen/overrides
 */

/** Цель в объёме, нужном правилу замен. */
export interface OverridableTarget {
  readonly id: string;
  readonly path: string;
  readonly each?: 'step';
  readonly overrides?: string;
}

/**
 * Устарела ли замена: текст причины — замена не действует, и о ней говорит
 * {@link overrideDrift}; `null` — годна. `replaced` — заменяемая цель, `undefined` — её нет.
 */
export type StaleOverride<T extends OverridableTarget> = (
  target: T,
  replaced: T | undefined
) => string | null;

/** Предупреждение о замене: модуль печатается, но правки из шаблона не действуют. */
export interface OverrideDrift {
  readonly targetId: string;
  readonly path: string;
  readonly reason: 'override-path-drift';
  readonly message: string;
}

/** Причина устаревания замены либо `null` — у цели без `overrides` её не бывает. */
function staleOf<T extends OverridableTarget>(
  target: T,
  byId: ReadonlyMap<string, T>,
  stale: StaleOverride<T> | undefined
): string | null {
  if (target.overrides === undefined || stale === undefined) return null;
  return stale(target, byId.get(target.overrides));
}

/**
 * Снять цели, которые кто-то переопределил.
 *
 * Победитель — тот, кто объявил `overrides`. Забыть его нельзя незаметно: тогда обе цели
 * претендуют на один `path`, и отбор назовёт это `duplicate-path` с именем победителя.
 *
 * Устаревшая замена не побеждает и не печатается: модуль печатается заменяемой целью, а о шаблоне
 * говорит {@link overrideDrift}. Без замен список возвращается той же ссылкой.
 */
export function applyOverrides<T extends OverridableTarget>(
  targets: readonly T[],
  stale?: StaleOverride<T>
): readonly T[] {
  if (targets.every((target) => target.overrides === undefined)) return targets;
  const byId = new Map(targets.map((target) => [target.id, target]));
  const live = targets.filter((target) => staleOf(target, byId, stale) === null);
  const overridden = new Set(
    live.flatMap((target) => (target.overrides === undefined ? [] : [target.overrides]))
  );
  return live.filter((target) => !overridden.has(target.id));
}

/**
 * Замены, которые печатают НЕ то и НЕ туда, что печатала заменённая цель, и устаревшие замены.
 *
 * Генерация от этого не падает: модуль печатается, но человек обязан узнать, что его правки
 * перестали действовать, и что с этим делать. Отдельной функцией рядом с {@link applyOverrides},
 * а не внутри неё: та отвечает на вопрос «кто печатает», а предупреждение — другой канал. Смотрит
 * на полный список ДО снятия замен: после него заменённой цели в нём уже нет.
 */
export function overrideDrift<T extends OverridableTarget>(
  targets: readonly T[],
  stale?: StaleOverride<T>
): readonly OverrideDrift[] {
  const byId = new Map(targets.map((target) => [target.id, target]));
  const drift: OverrideDrift[] = [];
  const report = (target: T, message: string): void => {
    drift.push({ targetId: target.id, path: target.path, reason: 'override-path-drift', message });
  };

  for (const target of targets) {
    if (target.overrides === undefined) continue;
    const reason = staleOf(target, byId, stale);
    if (reason !== null) {
      report(target, reason);
      continue;
    }
    const replaced = byId.get(target.overrides);
    if (replaced === undefined) continue;
    const samePath = replaced.path === target.path;
    const sameEach = (replaced.each ?? null) === (target.each ?? null);
    if (samePath && sameEach) continue;
    report(
      target,
      !samePath
        ? `«${target.id}» заменяет «${replaced.id}», но печатает «${target.path}» вместо ` +
            `«${replaced.path}» — модуль импортирует второе. Поправьте «path» в заголовке шаблона.`
        : `«${target.id}» заменяет «${replaced.id}», но ` +
            (replaced.each === 'step'
              ? 'печатается один раз, а заменённая — по файлу на шаг: добавьте «"each": "step"».'
              : 'печатается по шагам, а заменённая — один раз.')
    );
  }
  return drift;
}

/**
 * Обнаружение расхождения с источником — «файл уехал у нас под ногами».
 *
 * ## Четыре момента, и ни одного таймера
 *
 * Наблюдения за файлами нет и не будет: File System Access его не даёт (`core-contracts.md`,
 * решение 4). Значит расхождение обнаруживается только тогда, когда мы сами спросили. Спрашиваем
 * в четырёх местах, и у каждого своя причина:
 *
 * | Момент                  | Чем вызван                     | Почему нужен                                                   |
 * | ----------------------- | ------------------------------ | -------------------------------------------------------------- |
 * | сохранение              | `save` вернул `conflict`       | Единственный ответ, который даёт САМ источник, а не наша догадка |
 * | возврат фокуса в окно   | `focus` / `visibilitychange`   | Человек уходил в другой инструмент — почти всегда правил файлы  |
 * | переоткрытие проекта    | восстановление сессии          | Между сессиями прошло произвольное время, ревизии из прошлой    |
 * | явная команда           | «проверить источник»           | Фоновая правка при НЕ терявшем фокус окне ничем иначе не видна  |
 *
 * Первые два записаны в контракте Э11. Третий и четвёртый добавлены здесь, и вот обоснование.
 *
 * **Переоткрытие проекта.** Множество materialized поднимается из IndexedDB вместе с ревизиями,
 * записанными в ПРОШЛОЙ сессии; браузер мог быть закрыт неделю. Без проверки первое, что человек
 * увидит после восстановления вкладок, — содержимое, которого в источнике давно нет, и узнает он
 * об этом только при сохранении. Механизм при этом тот же, что у возврата фокуса: перепроверка
 * `stat` у открытых. Это не новая машинерия, а тот же вызов в другой момент.
 *
 * **Явная команда.** Возврат фокуса покрывает «человек ушёл и вернулся», но не покрывает
 * «пока человек смотрел в окно билдера, по файлам прошёлся генератор, git или сборка». Окно
 * фокуса не теряло, событий не было, расхождение существует. Команда стоит ровно один вызов
 * того же `check` и даёт выход из положения, в котором иначе выхода нет.
 *
 * **Опроса по таймеру НЕТ.** Он ничего не добавляет к этим четырём: единственное, что можно
 * сделать со знанием о расхождении, — показать его человеку, а человек в этот момент либо
 * работает в окне (и тогда фоновая правка редка, а команда рядом), либо не работает (и тогда
 * узнает при возврате фокуса). Цена же реальна: `stat` у File System Access — это
 * `getFile()` на каждый открытый ресурс, то есть настоящее обращение к диску, повторяемое
 * вечно и в фоне.
 *
 * ## Что здесь хранится
 *
 * Только расхождения. «Всё совпало» — это отсутствие записи, а не запись со статусом: иначе
 * счётчик в строке состояния пришлось бы считать фильтрацией, а список расхождений — искать
 * среди совпадений.
 *
 * @module host/workspace/merge/divergence
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import type { ResourceId } from '@/shell/platform/primitives/resource';

/**
 * Чем кончилось сравнение с источником.
 *
 * `unknown` — не «ошибка», а честный ответ источника без ревизий: сказать «совпало» мы бы
 * не имели права, а сказать «разошлось» — тем более. Такой источник конфликты не ловит вовсе
 * (`capabilities.revisions === false`), и притворяться, что ловит, хуже, чем молчать.
 */
export type ExternalStatus = 'same' | 'diverged' | 'gone' | 'unknown';

/** Всё, что нужно знать, чтобы сравнить рабочую копию с источником. */
export interface DivergenceProbe {
  /** Ревизия, от которой мы правили. `undefined` — источник ревизий не даёт. */
  readonly expected?: string;
  /** Читали ли мы этот ресурс из источника (иначе он создан локально). */
  readonly hasBase: boolean;
  /** Есть ли ресурс в источнике сейчас. */
  readonly present: boolean;
  /** Ревизия источника сейчас. */
  readonly actual?: string;
}

/**
 * Сравнение — на РАВЕНСТВЕ ревизий, а не на «новее».
 *
 * Так записано в контракте Э3, и это не мелочь: ревизия непрозрачна (ETag, время правки, хеш),
 * и «новее» на ней не вычисляется в принципе. Отсюда же следствие, которое легко потерять:
 * откат файла в источнике к прошлой версии — тоже расхождение, и это правильно.
 *
 * Отдельный случай — локально созданный файл, у которого в источнике появился тёзка
 * ({@link DivergenceProbe.hasBase} `=== false`, но `present`). Ревизий сравнивать нечего,
 * а сохранение затрёт чужой файл целиком, и промолчать здесь — та же потеря работы, только
 * чужой. Поэтому это расхождение, хотя формально никакая ревизия не менялась.
 */
export function classifyDivergence(probe: DivergenceProbe): ExternalStatus {
  if (!probe.present) {
    // Локально созданного файла в источнике и не было — всё ровно так, как мы думали.
    return probe.hasBase ? 'gone' : 'same';
  }
  if (!probe.hasBase) return 'diverged';
  if (probe.expected === undefined || probe.actual === undefined) return 'unknown';
  return probe.expected === probe.actual ? 'same' : 'diverged';
}

/** Ответ на вопрос «что там с этим ресурсом в источнике». */
export interface ExternalCheck {
  readonly id: ResourceId;
  readonly status: ExternalStatus;
  /** Ревизия, от которой мы правили. */
  readonly expected?: string;
  /** Ревизия источника сейчас — то, с чем предстоит сливаться. */
  readonly actual?: string;
}

/** Откуда узнали о расхождении. Попадает в интерфейс: «когда» объясняет «почему сейчас». */
export type DivergenceReason = 'save' | 'focus' | 'reopen' | 'command';

/** Расхождение, о котором знаем. Совпадения здесь не хранятся — см. шапку модуля. */
export interface DivergenceRecord extends ExternalCheck {
  readonly status: 'diverged' | 'gone';
  readonly reason: DivergenceReason;
  readonly at: number;
}

/** Снимок для интерфейса. Ссылка стабильна между изменениями — условие `useSyncExternalStore`. */
export interface DivergenceState {
  readonly records: readonly DivergenceRecord[];
  /** Сколько ресурсов разошлись. То же число показывает строка состояния. */
  readonly count: number;
}

export const NO_DIVERGENCE: DivergenceState = Object.freeze({
  records: Object.freeze([]) as readonly DivergenceRecord[],
  count: 0,
});

/** Отказ-конфликт в объёме, который нужен наблюдению. Совпадает по форме с `SaveConflict`. */
export interface ConflictLike {
  readonly id: ResourceId;
  readonly expected?: string;
  readonly actual?: string;
}

/** Рабочая область в объёме, нужном наблюдению. */
export interface DivergenceWorkspace {
  checkSource(ids?: readonly ResourceId[]): Promise<readonly ExternalCheck[]>;
}

export interface DivergenceWatchOptions {
  readonly workspace: DivergenceWorkspace;
  readonly now?: () => number;
  /** Куда уходит отказ проверки. Без него — в консоль: молчащая проверка хуже шумной. */
  readonly onError?: (error: unknown) => void;
}

export interface DivergenceWatch extends Disposable {
  get(): DivergenceState;
  subscribe(listener: () => void): Disposable;
  /**
   * Спрашивает источник. Без списка — обо всех открытых ресурсах.
   *
   * Подметания без списка СХЛОПЫВАЮТСЯ: два события фокуса подряд не должны давать два обхода
   * диска. Второй вызов получает промис первого.
   */
  check(reason: DivergenceReason, ids?: readonly ResourceId[]): Promise<DivergenceState>;
  /** Заносит отказы-конфликты сохранения: источник сказал сам, спрашивать его незачем. */
  noteConflicts(conflicts: readonly ConflictLike[]): void;
  /** Расхождение снято: слияние завершено и записано. */
  resolve(id: ResourceId): void;
  /** Что известно про ресурс. `null` — расхождения за ним не числится. */
  recordOf(id: ResourceId): DivergenceRecord | null;
}

function sameRecords(a: readonly DivergenceRecord[], b: readonly DivergenceRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    // `reason` и `at` намеренно не сравниваются: повторное обнаружение того же расхождения
    // другим способом не должно двигать ссылку и перерисовывать интерфейс.
    if (x.id !== y.id || x.status !== y.status || x.expected !== y.expected) return false;
    if (x.actual !== y.actual) return false;
  }
  return true;
}

export function createDivergenceWatch(options: DivergenceWatchOptions): DivergenceWatch {
  const { workspace } = options;
  const now = options.now ?? ((): number => Date.now());
  const report =
    options.onError ??
    ((error: unknown): void => {
      console.error('[workspace] проверка источника не удалась', error);
    });

  const records = new Map<ResourceId, DivergenceRecord>();
  let snapshot: DivergenceState = NO_DIVERGENCE;
  const listeners = new Set<() => void>();
  let sweeping: Promise<DivergenceState> | null = null;

  const publish = (): DivergenceState => {
    const next = [...records.values()];
    if (sameRecords(snapshot.records, next)) return snapshot;
    snapshot = Object.freeze({ records: Object.freeze(next), count: next.length });
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Политика всех хранилищ оболочки: упавший подписчик не мешает остальным.
        console.error('[workspace] подписчик расхождений упал', error);
      }
    }
    return snapshot;
  };

  const absorb = (check: ExternalCheck, reason: DivergenceReason): void => {
    if (check.status === 'diverged' || check.status === 'gone') {
      records.set(check.id, { ...check, status: check.status, reason, at: now() });
      return;
    }
    // Совпало (или сказать нечего) — расхождения больше нет. Молчаливое удаление записи здесь
    // ничего не теряет: сторону никто не выбирал, файл просто перестал расходиться.
    records.delete(check.id);
  };

  const sweep = async (
    reason: DivergenceReason,
    ids?: readonly ResourceId[]
  ): Promise<DivergenceState> => {
    try {
      for (const check of await workspace.checkSource(ids)) absorb(check, reason);
    } catch (error) {
      report(error);
    }
    return publish();
  };

  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
    check(reason, ids) {
      if (ids !== undefined) return sweep(reason, ids);
      if (sweeping !== null) return sweeping;
      const run = sweep(reason).finally(() => {
        if (sweeping === run) sweeping = null;
      });
      sweeping = run;
      return run;
    },
    noteConflicts(conflicts) {
      for (const conflict of conflicts) {
        absorb({ ...conflict, status: 'diverged' }, 'save');
      }
      publish();
    },
    resolve(id) {
      if (!records.delete(id)) return;
      publish();
    },
    recordOf: (id) => records.get(id) ?? null,
    dispose() {
      listeners.clear();
      records.clear();
      snapshot = NO_DIVERGENCE;
    },
  };
}

/*
 * ─────────────────────────  привязка к окну  ─────────────────────────
 */

/** Кусочек `EventTarget`, который здесь нужен. Тип — не `Window`: окружение тестов `node`. */
export interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface FocusChecksOptions {
  /** Обычно `window`. Событие `focus` ловит возврат из другого приложения. */
  readonly window: EventTargetLike;
  /**
   * Обычно `document`. Событие `visibilitychange` ловит возврат с другой ВКЛАДКИ, которую
   * `focus` окна не всегда замечает. Оба нужны, и оба ведут в одну проверку.
   */
  readonly document?: EventTargetLike & { readonly visibilityState?: string };
  /**
   * Не чаще одного обхода за это время. Alt-Tab туда-сюда даёт очередь событий, а каждый
   * обход — это `getFile()` на каждый открытый ресурс.
   */
  readonly minIntervalMs?: number;
  readonly now?: () => number;
}

export const DEFAULT_FOCUS_INTERVAL_MS = 1_000;

/**
 * Привязывает проверку к возврату фокуса.
 *
 * Отдельная функция, а не часть наблюдения: наблюдение проверяется в `node` без окна, а вся
 * связь с браузером сводится к двум подпискам, которые видно целиком.
 */
export function attachFocusChecks(
  watch: Pick<DivergenceWatch, 'check'>,
  options: FocusChecksOptions
): Disposable {
  const interval = options.minIntervalMs ?? DEFAULT_FOCUS_INTERVAL_MS;
  const now = options.now ?? ((): number => Date.now());
  let last = Number.NEGATIVE_INFINITY;

  const trigger = (): void => {
    const at = now();
    if (at - last < interval) return;
    last = at;
    void watch.check('focus');
  };

  const onVisible = (): void => {
    // Уход со вкладки — тоже `visibilitychange`, и проверять на нём нечего: спрашивать
    // источник о файлах, на которые никто не смотрит, значит платить за то, что не видно.
    if (options.document?.visibilityState === 'hidden') return;
    trigger();
  };

  options.window.addEventListener('focus', trigger);
  options.document?.addEventListener('visibilitychange', onVisible);

  return toDisposable(() => {
    options.window.removeEventListener('focus', trigger);
    options.document?.removeEventListener('visibilitychange', onVisible);
  });
}

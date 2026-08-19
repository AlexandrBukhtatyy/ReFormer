/**
 * Двухуровневый кэш схем.
 *
 * L1 — в памяти: разобранные объекты и промисы «в полёте». L2 — сериализованные тела через
 * {@link StorageStrategy}. Чтение идёт L1 → L2 → сеть, запись — сеть → L2 → L1.
 *
 * Два уровня, а не один, потому что они решают разные задачи: L2 переживает перезагрузку страницы
 * (схема кредитной заявки весит 68 КБ, и тянуть её на каждый F5 расточительно), а L1 избавляет от
 * повторного `JSON.parse` того же тела при нескольких формах на странице.
 *
 * **Отмена НЕ пробрасывается в общий запрос.** Если два `FormOutlet` ждут одну схему и один из них
 * размонтировался, отменять загрузку нельзя — второй остался бы ни с чем. Учёт ведётся по числу
 * ожидающих, и запрос отменяется, только когда ушёл последний.
 *
 * **Метрики.** События образуют две независимые оси, и это не оформление, а условие того, что
 * счётчики сходятся: одна ось отвечает «нашли ли», вторая — «чем кончилась сеть». Свести их в один
 * список нельзя, потому что один вызов `get()` даёт событие либо из обеих (`stale` → `revalidated`),
 * либо только из первой (`l1-hit`). Проверяемые инварианты:
 *
 * ```text
 * l1Hit + l2Hit + dedup + stale + miss                === числу вызовов get()
 * fetched + refetched + revalidated + error + aborted === stale + miss
 * ```
 *
 * Правая часть второго — именно `stale + miss`, а не число заведённых запросов: попадание в L2
 * закрывает запрос ДО сети и события сетевой оси не даёт вовсе. В сеть уходят ровно те чтения,
 * которые не нашли свежего значения, — то есть `stale` (тело есть, но протухло) и `miss` (тела нет).
 *
 * @module reformer/form-registry/cache
 */

import type { StorageStrategy, StoredRecord } from './storage/types';
import { byteLength } from './storage/types';

export interface CacheEntry<T> {
  value: T;
  etag?: string;
}

/** Как получить свежее значение, если в кэше его нет или оно устарело. */
export interface Fetcher<T> {
  /**
   * @param etag - ETag того, что лежит в кэше (если есть) — для условного запроса.
   * @returns `notModified: true` — сервер подтвердил, что кэшированное ещё годно.
   */
  (
    etag: string | undefined,
    signal: AbortSignal
  ): Promise<{ data: T; etag?: string; notModified: boolean }>;
}

/**
 * Что произошло с запросом.
 *
 * Ось «исход поиска» — ровно одно событие на каждый вызов `get()`:
 * `l1-hit` — свежее из памяти; `l2-hit` — свежее из хранилища (пережило F5); `dedup` — присоединились
 * к запросу в полёте; `stale` — тело было, но протухло, идём в сеть с `If-None-Match`; `miss` — тела
 * не было вовсе.
 *
 * Ось «исход сети» — не больше одного на каждый заведённый запрос:
 * `fetched` — холодная загрузка; `refetched` — протухшее заменено новым телом; `revalidated` — сервер
 * подтвердил 304; `error` — отказ; `aborted` — запрос погасили мы сами, когда ушёл последний ждущий.
 */
export type CacheEventType =
  | 'l1-hit'
  | 'l2-hit'
  | 'dedup'
  | 'stale'
  | 'miss'
  | 'fetched'
  | 'refetched'
  | 'revalidated'
  | 'error'
  | 'aborted';

export interface CacheEvent {
  type: CacheEventType;
  key: string;
  /** Сколько заняла сетевая часть, мс. Только у терминальных событий сетевой оси. */
  durationMs?: number;
  /**
   * Размер тела ПОСЛЕ сериализации, байты. Только у `fetched` и `refetched`.
   *
   * Это не байты по проводу: сжатие и заголовки сюда не входят.
   */
  bytes?: number;
}

export interface CacheStats {
  // ── ось «исход поиска»
  l1Hit: number;
  l2Hit: number;
  dedup: number;
  stale: number;
  miss: number;
  // ── ось «исход сети»
  fetched: number;
  refetched: number;
  revalidated: number;
  error: number;
  aborted: number;
  // ── отказы L2: загрузку они не роняют, поэтому считаются ОТДЕЛЬНО от `error`
  l2ReadFailed: number;
  l2WriteFailed: number;
  l2Corrupt: number;
  /** Суммарный размер тел, приехавших по сети, после сериализации. */
  bytesFromNetwork: number;
}

export interface SchemaCacheOptions {
  storage?: StorageStrategy;
  /**
   * Считать кэшированное значение свежим столько миллисекунд. По истечении значение сразу НЕ
   * отдаётся: уходит условный запрос с `If-None-Match`, и вызывающий ждёт его исхода.
   */
  maxAgeMs?: number;
  /** Подменяемо в тестах. */
  now?: () => number;
  onDiagnostic?: (d: { code: string; message: string; key: string }) => void;
  /** Поток событий кэша. Счётчики по тем же событиям — через {@link SchemaCache.stats}. */
  onEvent?: (e: CacheEvent) => void;
}

interface InFlight<T> {
  promise: Promise<CacheEntry<T>>;
  controller: AbortController;
  /** Сколько вызывающих ждут этот запрос. Отмена — только когда счётчик дошёл до нуля. */
  waiters: number;
}

export interface SchemaCache {
  /**
   * Значение из кэша либо из сети. Параллельные вызовы с одним ключом делят один запрос.
   *
   * @param signal - Отмена ЭТОГО ожидания. Общий запрос прервётся, только если ждущих не осталось.
   */
  get<T>(key: string, fetcher: Fetcher<T>, signal?: AbortSignal): Promise<T>;
  /** Убрать из обоих уровней. */
  invalidate(key: string): Promise<void>;
  /** Полностью очистить. Кэш выбрасываемый: после этого всё просто перекачается. */
  clear(): Promise<void>;
  /** Сколько записей в памяти — для диагностики. */
  readonly memorySize: number;
  /**
   * Снимок счётчиков — всегда НОВЫЙ объект.
   *
   * Живой объект отдавать нельзя: потребитель, сравнивающий снимки по ссылке (`useMemo`,
   * `useSyncExternalStore`), не увидел бы ни одного изменения. Поток изменений — через `onEvent`.
   */
  stats(): CacheStats;
  /** Обнулить счётчики. Содержимое кэша НЕ трогает — это разные вещи. */
  resetStats(): void;
}

/** Куда какое событие пишется. Единая таблица — чтобы счётчик и событие не разошлись. */
const COUNTER_OF: Record<CacheEventType, keyof CacheStats> = {
  'l1-hit': 'l1Hit',
  'l2-hit': 'l2Hit',
  dedup: 'dedup',
  stale: 'stale',
  miss: 'miss',
  fetched: 'fetched',
  refetched: 'refetched',
  revalidated: 'revalidated',
  error: 'error',
  aborted: 'aborted',
};

type L2FailureCode = 'cache-read-failed' | 'cache-write-failed' | 'cache-corrupt';

const L2_COUNTER_OF: Record<L2FailureCode, keyof CacheStats> = {
  'cache-read-failed': 'l2ReadFailed',
  'cache-write-failed': 'l2WriteFailed',
  'cache-corrupt': 'l2Corrupt',
};

const emptyStats = (): CacheStats => ({
  l1Hit: 0,
  l2Hit: 0,
  dedup: 0,
  stale: 0,
  miss: 0,
  fetched: 0,
  refetched: 0,
  revalidated: 0,
  error: 0,
  aborted: 0,
  l2ReadFailed: 0,
  l2WriteFailed: 0,
  l2Corrupt: 0,
  bytesFromNetwork: 0,
});

export function createSchemaCache(opts: SchemaCacheOptions = {}): SchemaCache {
  const { storage, maxAgeMs = 5 * 60 * 1000, now = Date.now, onDiagnostic, onEvent } = opts;

  const l1 = new Map<string, { entry: CacheEntry<unknown>; storedAt: number }>();
  const inFlight = new Map<string, InFlight<unknown>>();

  let counters = emptyStats();

  /** Счётчик и событие одним вызовом — разойтись они так не могут. */
  const emit = (
    type: CacheEventType,
    key: string,
    extra?: { durationMs?: number; bytes?: number }
  ): void => {
    counters[COUNTER_OF[type]]++;
    if (extra?.bytes !== undefined) counters.bytesFromNetwork += extra.bytes;
    onEvent?.({ type, key, ...extra });
  };

  const report = (code: L2FailureCode, key: string, message: string): void => {
    // Отказы L2 намеренно не попадают в `error`: там счётчик неудач ЗАГРУЗКИ, а сорванный кэш
    // загрузку не срывает. Свести их в одну цифру — потерять смысл обеих.
    counters[L2_COUNTER_OF[code]]++;
    onDiagnostic?.({ code, key, message });
  };

  const readL2 = async (key: string): Promise<StoredRecord | undefined> => {
    if (!storage) return undefined;
    try {
      return await storage.get(key);
    } catch (e) {
      // Отказ кэша НИКОГДА не должен ронять загрузку формы: кэш — ускорение, а не источник истины.
      report('cache-read-failed', key, `L2 недоступен: ${String(e)}`);
      return undefined;
    }
  };

  const writeL2 = async (
    key: string,
    body: string,
    etag?: string,
    /** Уже посчитанный размер: на 68 КБ схеме лишний проход `TextEncoder` не бесплатен. */
    size?: number
  ): Promise<void> => {
    if (!storage) return;
    const t = now();
    try {
      await storage.set({
        key,
        body,
        etag,
        size: size ?? byteLength(body),
        storedAt: t,
        lastUsedAt: t,
      });
    } catch (e) {
      report('cache-write-failed', key, `не записалось в L2: ${String(e)}`);
    }
  };

  /**
   * ВАЖНО: функция НЕ async.
   *
   * Всё, что решает, заводить ли новый запрос, обязано выполниться синхронно относительно
   * вызывающего. Стоит поставить `await` (хотя бы чтение L2) перед регистрацией запроса
   * «в полёте» — и два одновременных вызова успевают проскочить мимо проверки и заводят два
   * запроса, а отмена, пришедшая сразу после вызова, не находит подписки. Оба случая закрыты
   * тестами в `cache.test.ts`.
   */
  function load<T>(key: string, fetcher: Fetcher<T>, signal?: AbortSignal): Promise<T> {
    // ── L1
    const hot = l1.get(key);
    if (hot && now() - hot.storedAt < maxAgeMs) {
      emit('l1-hit', key);
      return Promise.resolve(hot.entry.value as T);
    }

    // ── запрос «в полёте»: присоединяемся, а не заводим второй
    const running = inFlight.get(key) as InFlight<T> | undefined;
    if (running) {
      emit('dedup', key);
      return joinInFlight(key, running, signal);
    }

    return startLoad(key, fetcher, signal);
  }

  /** Заводит запрос: L2, затем сеть. Регистрация в `inFlight` — до первого `await`. */
  function startLoad<T>(key: string, fetcher: Fetcher<T>, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const state: InFlight<T> = {
      waiters: 1,
      controller,
      promise: undefined as unknown as Promise<CacheEntry<T>>,
    };
    inFlight.set(key, state as InFlight<unknown>);

    state.promise = (async () => {
      // ── L2
      const stored = await readL2(key);
      let known: CacheEntry<T> | undefined;
      if (stored) {
        try {
          known = { value: JSON.parse(stored.body) as T, etag: stored.etag };
        } catch {
          // Битое тело — не повод падать: считаем, что кэша нет, и уходим в сеть.
          report('cache-corrupt', key, 'тело в L2 не разобралось, запись отброшена');
          await storage?.delete(key).catch(() => undefined);
        }
        if (known && now() - stored.storedAt < maxAgeMs) {
          emit('l2-hit', key);
          l1.set(key, { entry: known, storedAt: stored.storedAt });
          return known;
        }
      }

      // Исход поиска фиксируется ДО сети. Считать его после `fetcher` значит терять событие на
      // каждом сетевом отказе — и разбиение по числу вызовов `get()` перестаёт сходиться.
      emit(known ? 'stale' : 'miss', key);

      // ── сеть (с условным запросом, если есть что подтверждать)
      const startedAt = now();
      try {
        const res = await fetcher(known?.etag, controller.signal);
        if (res.notModified) {
          if (!known) {
            // 304 без кэшированного тела — противоречие: мы не могли послать If-None-Match.
            throw new Error(
              `[form-registry] ${key}: сервер ответил 304, но кэшированного тела нет`
            );
          }
          emit('revalidated', key, { durationMs: now() - startedAt });
          // Подтверждённое значение снова свежее — обновляем отметку времени на обоих уровнях.
          l1.set(key, { entry: known, storedAt: now() });
          await writeL2(key, JSON.stringify(known.value), known.etag);
          return known;
        }
        const entry: CacheEntry<T> = { value: res.data, etag: res.etag };
        const body = JSON.stringify(res.data);
        const bytes = byteLength(body);
        emit(known ? 'refetched' : 'fetched', key, { durationMs: now() - startedAt, bytes });
        l1.set(key, { entry, storedAt: now() });
        await writeL2(key, body, res.etag, bytes);
        return entry;
      } catch (e) {
        // Отмену отделяем от отказа: запрос без ждущих гасим мы сами, и в счётчике ошибок это
        // выглядело бы сбоем сервера. Отличить их можно только здесь — снаружи `controller`
        // уже не виден.
        emit(controller.signal.aborted ? 'aborted' : 'error', key, {
          durationMs: now() - startedAt,
        });
        throw e;
      }
    })();

    const onAbort = (): void => {
      state.waiters--;
      if (state.waiters <= 0) controller.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    return state.promise
      .finally(() => {
        signal?.removeEventListener('abort', onAbort);
        if (inFlight.get(key) === (state as InFlight<unknown>)) inFlight.delete(key);
      })
      .then((e) => e.value);
  }

  /**
   * Присоединение к чужому запросу. Событий НЕ шлёт: `dedup` уже отправлен в `load`, а исход сети
   * считается внутри `startLoad` — ровно один раз на запрос, сколько бы ждущих ни присоединилось.
   */
  function joinInFlight<T>(
    key: string,
    running: InFlight<T>,
    signal?: AbortSignal
  ): Promise<CacheEntry<T>['value']> {
    running.waiters++;
    const onAbort = (): void => {
      running.waiters--;
      // Отменяем общий запрос ТОЛЬКО когда ушёл последний ожидающий.
      if (running.waiters <= 0) running.controller.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    return running.promise
      .then((e) => e.value)
      .finally(() => signal?.removeEventListener('abort', onAbort));
  }

  return {
    get: load,
    async invalidate(key) {
      l1.delete(key);
      await storage?.delete(key).catch(() => undefined);
    },
    async clear() {
      l1.clear();
      await storage?.clear().catch(() => undefined);
    },
    get memorySize() {
      return l1.size;
    },
    stats: () => ({ ...counters }),
    resetStats() {
      counters = emptyStats();
    },
  };
}

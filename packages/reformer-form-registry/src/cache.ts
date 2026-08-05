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

export interface SchemaCacheOptions {
  storage?: StorageStrategy;
  /**
   * Считать кэшированное значение свежим столько миллисекунд. По истечении значение ещё отдаётся,
   * но параллельно ревалидируется (stale-while-revalidate).
   */
  maxAgeMs?: number;
  /** Подменяемо в тестах. */
  now?: () => number;
  onDiagnostic?: (d: { code: string; message: string; key: string }) => void;
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
}

export function createSchemaCache(opts: SchemaCacheOptions = {}): SchemaCache {
  const { storage, maxAgeMs = 5 * 60 * 1000, now = Date.now, onDiagnostic } = opts;

  const l1 = new Map<string, { entry: CacheEntry<unknown>; storedAt: number }>();
  const inFlight = new Map<string, InFlight<unknown>>();

  const report = (code: string, key: string, message: string): void =>
    onDiagnostic?.({ code, key, message });

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

  const writeL2 = async (key: string, body: string, etag?: string): Promise<void> => {
    if (!storage) return;
    const t = now();
    try {
      await storage.set({ key, body, etag, size: byteLength(body), storedAt: t, lastUsedAt: t });
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
    if (hot && now() - hot.storedAt < maxAgeMs) return Promise.resolve(hot.entry.value as T);

    // ── запрос «в полёте»: присоединяемся, а не заводим второй
    const running = inFlight.get(key) as InFlight<T> | undefined;
    if (running) return joinInFlight(key, running, signal);

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
          l1.set(key, { entry: known, storedAt: stored.storedAt });
          return known;
        }
      }

      // ── сеть (с условным запросом, если есть что подтверждать)
      const res = await fetcher(known?.etag, controller.signal);
      if (res.notModified) {
        if (!known) {
          // 304 без кэшированного тела — противоречие: мы не могли послать If-None-Match.
          throw new Error(`[form-registry] ${key}: сервер ответил 304, но кэшированного тела нет`);
        }
        // Подтверждённое значение снова свежее — обновляем отметку времени на обоих уровнях.
        l1.set(key, { entry: known, storedAt: now() });
        await writeL2(key, JSON.stringify(known.value), known.etag);
        return known;
      }
      const entry: CacheEntry<T> = { value: res.data, etag: res.etag };
      l1.set(key, { entry, storedAt: now() });
      await writeL2(key, JSON.stringify(res.data), res.etag);
      return entry;
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
  };
}

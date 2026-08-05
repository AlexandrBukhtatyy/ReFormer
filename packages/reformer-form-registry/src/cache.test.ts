/**
 * Двухуровневый кэш: дедупликация, ревалидация, правило отмены, устойчивость к отказу L2.
 */
import { describe, it, expect, vi } from 'vitest';
import { createSchemaCache } from './cache';
import { createMemoryStorage } from './storage/memory';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('Кэш — дедупликация запросов', () => {
  it('два одновременных запроса одного ключа дают ОДИН вызов загрузчика', async () => {
    const d = deferred<{ data: string; notModified: boolean }>();
    const fetcher = vi.fn(() => d.promise);
    const cache = createSchemaCache();

    const a = cache.get('k', fetcher);
    const b = cache.get('k', fetcher);
    d.resolve({ data: 'схема', notModified: false });

    expect(await a).toBe('схема');
    expect(await b).toBe('схема');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('после завершения запроса ключ освобождается — следующий промах уходит в сеть', async () => {
    const fetcher = vi.fn(async () => ({ data: 'x', notModified: false }));
    const cache = createSchemaCache({ maxAgeMs: 0 });
    await cache.get('k', fetcher);
    await cache.get('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('отказ загрузчика не залипает в кэше — следующая попытка идёт заново', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => {
      n++;
      if (n === 1) throw new Error('503');
      return { data: 'ок', notModified: false };
    });
    const cache = createSchemaCache();
    await expect(cache.get('k', fetcher)).rejects.toThrow('503');
    await expect(cache.get('k', fetcher)).resolves.toBe('ок');
  });
});

describe('Кэш — правило отмены', () => {
  it('уход ОДНОГО из двух ожидающих НЕ отменяет общий запрос', async () => {
    // Сценарий: два FormOutlet ждут одну схему, один размонтировался. Отмена запроса
    // оставила бы второй без данных — поэтому считаем ожидающих.
    const d = deferred<{ data: string; notModified: boolean }>();
    let sawAbort = false;
    const fetcher = vi.fn((_etag: string | undefined, signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        sawAbort = true;
      });
      return d.promise;
    });
    const cache = createSchemaCache();

    const ac1 = new AbortController();
    const first = cache.get('k', fetcher, ac1.signal);
    const second = cache.get('k', fetcher);

    ac1.abort(); // первый ушёл
    d.resolve({ data: 'схема', notModified: false });

    expect(await second).toBe('схема');
    expect(sawAbort).toBe(false);
    await first.catch(() => undefined);
  });

  it('уход ПОСЛЕДНЕГО ожидающего отменяет общий запрос', async () => {
    // Проверяем сам сигнал, а не подписку внутри загрузчика: загрузчик стартует после чтения L2,
    // и к моменту отмены его ещё не вызвали — подписка просто не успела бы появиться.
    const d = deferred<{ data: string; notModified: boolean }>();
    let seen: AbortSignal | undefined;
    const fetcher = vi.fn((_e: string | undefined, signal: AbortSignal) => {
      seen = signal;
      return d.promise;
    });
    const cache = createSchemaCache();

    const ac = new AbortController();
    const p = cache.get('k', fetcher, ac.signal);
    ac.abort();

    d.resolve({ data: 'x', notModified: false });
    await p.catch(() => undefined);
    expect(seen?.aborted).toBe(true);
  });
});

describe('Кэш — уровни L1/L2', () => {
  it('повторное чтение в пределах maxAge не идёт ни в L2, ни в сеть', async () => {
    const storage = createMemoryStorage();
    const spy = vi.spyOn(storage, 'get');
    const fetcher = vi.fn(async () => ({ data: { root: {} }, notModified: false }));
    const cache = createSchemaCache({ storage, maxAgeMs: 10_000 });

    await cache.get('k', fetcher);
    spy.mockClear();
    await cache.get('k', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled(); // L1 закрыл запрос
  });

  it('после сброса L1 значение поднимается из L2, а не из сети', async () => {
    const storage = createMemoryStorage();
    const fetcher = vi.fn(async () => ({ data: { root: {} }, notModified: false }));
    const clock = 1000;
    const first = createSchemaCache({ storage, maxAgeMs: 10_000, now: () => clock });
    await first.get('k', fetcher);

    // Новый экземпляр кэша = новая страница после F5: L1 пуст, L2 общий.
    const second = createSchemaCache({ storage, maxAgeMs: 10_000, now: () => clock });
    expect(await second.get('k', fetcher)).toEqual({ root: {} });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('устаревшее в L2 ревалидируется условным запросом, 304 продлевает жизнь', async () => {
    const storage = createMemoryStorage();
    let clock = 1000;
    const cache = () => createSchemaCache({ storage, maxAgeMs: 100, now: () => clock });

    const initial = vi.fn(async () => ({ data: { v: 1 }, etag: 'W/"1"', notModified: false }));
    await cache().get('k', initial);

    clock += 500; // протухло
    const revalidate = vi.fn(async (etag?: string) => {
      expect(etag).toBe('W/"1"'); // условный запрос ушёл с известным etag
      return { data: undefined as never, etag, notModified: true };
    });
    expect(await cache().get('k', revalidate)).toEqual({ v: 1 });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('304 без кэшированного тела — явная ошибка, а не тихий undefined', async () => {
    const cache = createSchemaCache();
    const fetcher = vi.fn(async () => ({ data: undefined as never, notModified: true }));
    await expect(cache.get('k', fetcher)).rejects.toThrow(/304/);
  });
});

describe('Кэш — отказ L2 не ломает загрузку', () => {
  it('падение storage.get уводит в сеть, а не в исключение', async () => {
    const storage = createMemoryStorage();
    vi.spyOn(storage, 'get').mockRejectedValue(new Error('OPFS отвалился'));
    const diagnostics: string[] = [];
    const cache = createSchemaCache({ storage, onDiagnostic: (d) => diagnostics.push(d.code) });

    expect(await cache.get('k', async () => ({ data: 'ок', notModified: false }))).toBe('ок');
    expect(diagnostics).toContain('cache-read-failed');
  });

  it('падение storage.set не ломает выдачу значения', async () => {
    const storage = createMemoryStorage();
    vi.spyOn(storage, 'set').mockRejectedValue(new Error('квота'));
    const diagnostics: string[] = [];
    const cache = createSchemaCache({ storage, onDiagnostic: (d) => diagnostics.push(d.code) });

    expect(await cache.get('k', async () => ({ data: 'ок', notModified: false }))).toBe('ок');
    expect(diagnostics).toContain('cache-write-failed');
  });

  it('битое тело в L2 отбрасывается, значение перекачивается', async () => {
    const storage = createMemoryStorage();
    await storage.set({ key: 'k', body: '{битый', size: 6, storedAt: 1, lastUsedAt: 1 });
    const diagnostics: string[] = [];
    const cache = createSchemaCache({ storage, onDiagnostic: (d) => diagnostics.push(d.code) });

    expect(await cache.get('k', async () => ({ data: 'свежее', notModified: false }))).toBe(
      'свежее'
    );
    expect(diagnostics).toContain('cache-corrupt');
  });

  it('ИНВАРИАНТ: кэш выбрасываемый — clear() посреди работы переживается', async () => {
    const storage = createMemoryStorage();
    const cache = createSchemaCache({ storage, maxAgeMs: 10_000 });
    const fetcher = vi.fn(async () => ({ data: 'схема', notModified: false }));

    await cache.get('k', fetcher);
    await cache.clear(); // например, пользователь очистил данные сайта
    expect(await cache.get('k', fetcher)).toBe('схема'); // ушли в сеть и выжили
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate убирает из обоих уровней', async () => {
    const storage = createMemoryStorage();
    const cache = createSchemaCache({ storage, maxAgeMs: 10_000 });
    const fetcher = vi.fn(async () => ({ data: 'x', notModified: false }));
    await cache.get('k', fetcher);
    await cache.invalidate('k');
    expect(await storage.get('k')).toBeUndefined();
    expect(cache.memorySize).toBe(0);
  });
});

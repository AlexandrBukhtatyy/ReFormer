/**
 * Двухуровневый кэш: дедупликация, ревалидация, правило отмены, устойчивость к отказу L2.
 */
import { describe, it, expect, vi } from 'vitest';
import { createSchemaCache, type CacheEvent, type CacheStats } from './cache';
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

describe('Кэш — метрики', () => {
  /** Сумма по оси «исход поиска»: обязана совпадать с числом вызовов `get()`. */
  const lookups = (s: CacheStats): number => s.l1Hit + s.l2Hit + s.dedup + s.stale + s.miss;
  /**
   * Сумма по оси «исход сети»: обязана совпадать с `stale + miss`, а НЕ с числом заведённых
   * запросов — попадание в L2 закрывает запрос до сети и события сетевой оси не даёт.
   */
  const outcomes = (s: CacheStats): number =>
    s.fetched + s.refetched + s.revalidated + s.error + s.aborted;
  const wentToNetwork = (s: CacheStats): number => s.stale + s.miss;

  it('холодная загрузка: miss по оси поиска, fetched по оси сети', async () => {
    const cache = createSchemaCache();
    await cache.get('k', async () => ({ data: 'схема', notModified: false }));

    const s = cache.stats();
    expect(s.miss).toBe(1);
    expect(s.fetched).toBe(1);
    // Размер ПОСЛЕ сериализации, в байтах UTF-8: кавычки + пять кириллических символов по два.
    expect(s.bytesFromNetwork).toBe(12);
    expect(lookups(s)).toBe(1);
    expect(outcomes(s)).toBe(1);
  });

  it('повторное чтение в пределах maxAgeMs — l1-hit, в сеть не ходим', async () => {
    const cache = createSchemaCache({ maxAgeMs: 10_000 });
    const fetcher = vi.fn(async () => ({ data: 'x', notModified: false }));
    await cache.get('k', fetcher);
    await cache.get('k', fetcher);

    const s = cache.stats();
    expect(s.l1Hit).toBe(1);
    expect(s.miss).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(lookups(s)).toBe(2);
    expect(outcomes(s)).toBe(1); // второй раз запрос не заводился
  });

  it('свежее из L2 в новом экземпляре кэша — l2-hit, а не miss', async () => {
    const storage = createMemoryStorage();
    const fetcher = vi.fn(async () => ({ data: 'схема', notModified: false }));
    await createSchemaCache({ storage, maxAgeMs: 10_000 }).get('k', fetcher);

    // «F5»: память потеряна, хранилище осталось.
    const revived = createSchemaCache({ storage, maxAgeMs: 10_000 });
    await revived.get('k', fetcher);

    const s = revived.stats();
    expect(s.l2Hit).toBe(1);
    expect(s.miss).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(outcomes(s)).toBe(0); // сети не было вовсе
  });

  it('дедупликация даёт ОДИН miss и ОДИН dedup, а не два miss', async () => {
    // Разбиение держится именно здесь: присоединившийся не заводил запроса, и посчитать
    // ему промах значило бы удвоить сетевую статистику.
    const d = deferred<{ data: string; notModified: boolean }>();
    const cache = createSchemaCache();
    const a = cache.get('k', () => d.promise);
    const b = cache.get('k', () => d.promise);
    d.resolve({ data: 'x', notModified: false });
    await Promise.all([a, b]);

    const s = cache.stats();
    expect(s.miss).toBe(1);
    expect(s.dedup).toBe(1);
    expect(s.fetched).toBe(1);
    expect(lookups(s)).toBe(2);
    expect(outcomes(s)).toBe(1);
  });

  it('протухшее + 304: stale по оси поиска, revalidated по оси сети', async () => {
    const storage = createMemoryStorage();
    let clock = 0;
    const cache = createSchemaCache({ storage, maxAgeMs: 1000, now: () => clock });
    await cache.get('k', async () => ({ data: 'схема', etag: 'v1', notModified: false }));

    clock = 5000; // протухло
    const conditional = vi.fn(async (etag: string | undefined) => {
      expect(etag).toBe('v1'); // ушёл условный запрос, иначе 304 неоткуда взяться
      return { data: undefined as unknown as string, etag, notModified: true };
    });
    expect(await cache.get('k', conditional)).toBe('схема');

    const s = cache.stats();
    expect(s.stale).toBe(1);
    expect(s.revalidated).toBe(1);
    expect(s.refetched).toBe(0);
    expect(lookups(s)).toBe(2);
    expect(outcomes(s)).toBe(2);
  });

  it('протухшее + новое тело: stale и refetched, а НЕ miss и fetched', async () => {
    const storage = createMemoryStorage();
    let clock = 0;
    const cache = createSchemaCache({ storage, maxAgeMs: 1000, now: () => clock });
    await cache.get('k', async () => ({ data: 'старое', etag: 'v1', notModified: false }));

    clock = 5000;
    expect(
      await cache.get('k', async () => ({ data: 'новое', etag: 'v2', notModified: false }))
    ).toBe('новое');

    const s = cache.stats();
    expect(s.stale).toBe(1);
    expect(s.refetched).toBe(1);
    expect(s.miss).toBe(1); // только от первой, холодной загрузки
    expect(s.fetched).toBe(1);
    expect(lookups(s)).toBe(2);
    expect(outcomes(s)).toBe(2);
  });

  it('сетевой отказ считается один раз — и исход поиска не теряется', async () => {
    // Именно поэтому исход поиска фиксируется ДО сети: считай мы `miss` после `fetcher`,
    // при отказе он бы не посчитался никогда.
    const cache = createSchemaCache();
    await expect(
      cache.get('k', async () => {
        throw new Error('503');
      })
    ).rejects.toThrow('503');

    const s = cache.stats();
    expect(s.error).toBe(1);
    expect(s.miss).toBe(1);
    expect(lookups(s)).toBe(1);
    expect(outcomes(s)).toBe(1);
  });

  it('отмена считается как aborted, а не как error', async () => {
    // Запрос без ждущих гасим мы сами; в счётчике ошибок это выглядело бы сбоем сервера.
    const cache = createSchemaCache();
    const fetcher = (_etag: string | undefined, signal: AbortSignal) =>
      new Promise<{ data: string; notModified: boolean }>((_, reject) => {
        // Как в fetchJson: отменённый ДО старта запрос отваливается сразу. Ждать события
        // здесь нельзя — загрузчик вызывается после чтения L2, abort к этому моменту прошёл.
        if (signal.aborted) return reject(new Error('отменено'));
        signal.addEventListener('abort', () => reject(new Error('отменено')));
      });
    const ac = new AbortController();
    const p = cache.get('k', fetcher, ac.signal);
    ac.abort();
    await expect(p).rejects.toThrow('отменено');

    const s = cache.stats();
    expect(s.aborted).toBe(1);
    expect(s.error).toBe(0);
  });

  it('отказ L2 считается отдельно от error — загрузку он не срывает', async () => {
    const storage = createMemoryStorage();
    vi.spyOn(storage, 'get').mockRejectedValueOnce(new Error('квота'));
    const cache = createSchemaCache({ storage });

    expect(await cache.get('k', async () => ({ data: 'ок', notModified: false }))).toBe('ок');

    const s = cache.stats();
    expect(s.l2ReadFailed).toBe(1);
    expect(s.error).toBe(0); // форма собралась, сбоя загрузки не было
    expect(s.fetched).toBe(1);
  });

  it('stats() отдаёт КОПИЮ — иначе подписчик по ссылке не увидел бы изменений', async () => {
    const cache = createSchemaCache();
    const before = cache.stats();
    await cache.get('k', async () => ({ data: 'x', notModified: false }));

    expect(cache.stats()).not.toBe(before);
    expect(before.miss).toBe(0); // прошлый снимок не задним числом изменён
    expect(cache.stats().miss).toBe(1);
  });

  it('resetStats обнуляет счётчики, но НЕ трогает содержимое кэша', async () => {
    const cache = createSchemaCache({ maxAgeMs: 10_000 });
    const fetcher = vi.fn(async () => ({ data: 'x', notModified: false }));
    await cache.get('k', fetcher);
    cache.resetStats();

    expect(cache.stats().miss).toBe(0);
    expect(cache.memorySize).toBe(1); // значение на месте
    await cache.get('k', fetcher);
    expect(cache.stats().l1Hit).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('onEvent видит те же события, что и счётчики', async () => {
    const seen: CacheEvent[] = [];
    const cache = createSchemaCache({ maxAgeMs: 10_000, onEvent: (e) => seen.push(e) });
    const fetcher = async () => ({ data: 'x', notModified: false });
    await cache.get('k', fetcher);
    await cache.get('k', fetcher);

    expect(seen.map((e) => e.type)).toEqual(['miss', 'fetched', 'l1-hit']);
    expect(seen[1]?.bytes).toBe(3); // "x" в JSON
    expect(seen[2]?.bytes).toBeUndefined(); // из памяти байты не ехали
  });

  it('ИНВАРИАНТ: обе оси сходятся на смешанном сценарии', async () => {
    const storage = createMemoryStorage();
    let clock = 0;
    const cache = createSchemaCache({ storage, maxAgeMs: 1000, now: () => clock });
    const fresh = async () => ({ data: 'схема', etag: 'v1', notModified: false });

    await cache.get('k', fresh); // miss → fetched
    await cache.get('k', fresh); // l1-hit, сети нет
    clock = 5000; // протухло
    await cache.get('k', async (etag) => ({
      data: undefined as never,
      etag,
      notModified: true,
    })); // stale → revalidated
    await cache.invalidate('k');
    await Promise.all([cache.get('k', fresh), cache.get('k', fresh)]); // miss + dedup → fetched

    const s = cache.stats();
    expect(lookups(s)).toBe(5); // ровно пять вызовов get()
    expect(outcomes(s)).toBe(wentToNetwork(s)); // в сеть ушли ровно stale + miss
    expect(wentToNetwork(s)).toBe(3);
  });
});

describe('Кэш — известные ограничения', () => {
  it('get() сразу после отмены единственного ждущего цепляется к УЖЕ отменённому запросу', async () => {
    // Ровно этот сценарий даёт StrictMode (mount → cleanup → mount синхронно), поэтому
    // `useFormResource` НЕ прокидывает signal в loadForm. Тест фиксирует текущее поведение,
    // чтобы починка не потерялась — см. issue ReFormer-8l9.
    const cache = createSchemaCache();
    const fetcher = vi.fn(
      (_etag: string | undefined, signal: AbortSignal) =>
        new Promise<{ data: string; notModified: boolean }>((_, reject) => {
          if (signal.aborted) return reject(new Error('отменено'));
          signal.addEventListener('abort', () => reject(new Error('отменено')));
        })
    );

    const ac = new AbortController();
    const first = cache.get('k', fetcher, ac.signal);
    ac.abort(); // «размонтирование» первого прохода StrictMode
    const second = cache.get('k', fetcher); // «второй монтаж» — в том же коммите

    await expect(first).rejects.toThrow('отменено');
    await expect(second).rejects.toThrow('отменено'); // ← вот дефект: второй обречён
    expect(fetcher).toHaveBeenCalledTimes(1); // нового запроса так и не завелось
  });
});

/**
 * Загрузка схем по сети: коды, ретраи, content-type, отмена.
 *
 * Тесты детерминированы: `sleep` и `random` подменяются, поэтому джиттер не делает прогон
 * ни медленным, ни плавающим.
 */
import { describe, it, expect, vi } from 'vitest';
import { fetchJson, retryDelay, assertFormSchemaShape, FormFetchError } from './net';

const json = (body: unknown, init: ResponseInit = {}): Response =>
  // headers собираются ПОСЛЕ разворота init — иначе init.headers затирает content-type целиком.
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

const noSleep = async (): Promise<void> => undefined;
const fixedRandom = (): number => 0.5;
const base = { sleep: noSleep, random: fixedRandom, retryBaseMs: 1 };

describe('fetchJson — успешный путь', () => {
  it('разбирает JSON и отдаёт etag', async () => {
    const fetchImpl = vi.fn(async () => json({ root: {} }, { headers: { etag: 'W/"1"' } }));
    const res = await fetchJson<{ root: object }>('/s.json', { ...base, fetchImpl });
    expect(res.data).toEqual({ root: {} });
    expect(res.etag).toBe('W/"1"');
    expect(res.notModified).toBe(false);
  });

  it('шлёт If-None-Match, когда передан etag', async () => {
    const fetchImpl = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('if-none-match')).toBe('W/"1"');
      return new Response(null, { status: 304 });
    });
    const res = await fetchJson('/s.json', { ...base, fetchImpl, etag: 'W/"1"' });
    expect(res.notModified).toBe(true);
  });
});

describe('fetchJson — что ретраится, а что нет', () => {
  it('500 ретраится и в итоге проходит', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n++;
      return n < 3 ? new Response('', { status: 500 }) : json({ root: {} });
    });
    await expect(fetchJson('/s.json', { ...base, fetchImpl })).resolves.toMatchObject({
      data: { root: {} },
    });
    expect(n).toBe(3);
  });

  it('404 НЕ ретраится — повтор не изменит ответа', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));
    await expect(fetchJson('/s.json', { ...base, fetchImpl })).rejects.toMatchObject({
      kind: 'http-error',
      status: 404,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('429 ретраится', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n++;
      return n === 1 ? new Response('', { status: 429 }) : json({ root: {} });
    });
    await expect(fetchJson('/s.json', { ...base, fetchImpl })).resolves.toBeDefined();
    expect(n).toBe(2);
  });

  it('исчерпание попыток даёт http-error с последним кодом', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }));
    await expect(fetchJson('/s.json', { ...base, fetchImpl, retries: 2 })).rejects.toMatchObject({
      kind: 'http-error',
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3); // первая + два повтора
  });

  it('сетевой сбой ретраится, затем даёт kind=network', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchJson('/s.json', { ...base, fetchImpl, retries: 1 })).rejects.toMatchObject({
      kind: 'network',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('fetchJson — SPA-fallback и мусор вместо схемы', () => {
  it('content-type text/html → kind=not-json, а не ошибка разбора', async () => {
    // Сервер не нашёл файл и отдал index.html со статусом 200. Без проверки content-type
    // это всплывало бы как «Unexpected token <» далеко от причины.
    const fetchImpl = vi.fn(
      async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
    );
    const err = await fetchJson('/s.json', { ...base, fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FormFetchError);
    expect((err as FormFetchError).kind).toBe('not-json');
    expect((err as FormFetchError).message).toMatch(/index\.html|SPA/i);
  });

  it('битый JSON при верном content-type → kind=not-json', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{битый', { headers: { 'content-type': 'application/json' } })
    );
    await expect(fetchJson('/s.json', { ...base, fetchImpl })).rejects.toMatchObject({
      kind: 'not-json',
    });
  });
});

describe('fetchJson — отмена', () => {
  it('уже отменённый сигнал не идёт в сеть вовсе', async () => {
    const fetchImpl = vi.fn(async () => json({ root: {} }));
    const ac = new AbortController();
    ac.abort();
    await expect(
      fetchJson('/s.json', { ...base, fetchImpl, signal: ac.signal })
    ).rejects.toMatchObject({ kind: 'aborted' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('отмена во время запроса даёт kind=aborted, а не network', async () => {
    const ac = new AbortController();
    const fetchImpl = vi.fn(async () => {
      ac.abort();
      throw new DOMException('Aborted', 'AbortError');
    });
    await expect(
      fetchJson('/s.json', { ...base, fetchImpl, signal: ac.signal })
    ).rejects.toMatchObject({ kind: 'aborted' });
  });
});

describe('retryDelay', () => {
  it('растёт экспоненциально', () => {
    const a = retryDelay(0, 100, () => 1);
    const b = retryDelay(1, 100, () => 1);
    const c = retryDelay(2, 100, () => 1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('джиттер разводит клиентов: разная случайность — разная задержка', () => {
    // Без джиттера все, кто получил 503 одновременно, повторят тоже одновременно.
    expect(retryDelay(2, 100, () => 0)).not.toBe(retryDelay(2, 100, () => 1));
  });

  it('Retry-After в секундах уважается', () => {
    expect(retryDelay(0, 100, () => 1, '3')).toBe(3000);
  });

  it('Retry-After датой уважается', () => {
    const at = new Date(Date.now() + 2000).toUTCString();
    expect(retryDelay(0, 100, () => 1, at)).toBeGreaterThan(500);
  });

  it('мусор в Retry-After игнорируется, берётся экспонента', () => {
    expect(retryDelay(0, 100, () => 1, 'скоро')).toBe(100);
  });
});

describe('assertFormSchemaShape', () => {
  it('пропускает объект с root', () => {
    expect(() => assertFormSchemaShape('/s.json', { root: {} })).not.toThrow();
  });

  it.each([
    ['массив', []],
    ['строка', 'schema'],
    ['null', null],
    ['объект без root', { id: 'x' }],
  ])('отклоняет %s', (_n, value) => {
    expect(() => assertFormSchemaShape('/s.json', value)).toThrow(/не схема формы|объект схемы/);
  });
});

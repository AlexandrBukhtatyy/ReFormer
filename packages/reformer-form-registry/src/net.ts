/**
 * Загрузка схем по сети.
 *
 * Политика ошибок взята с работающего кода `projects/reformer-builder/src/config/load.ts`:
 * проверять `content-type` (SPA-fallback отдаёт `index.html` со статусом 200 вместо JSON, и без
 * проверки это всплывает как невнятная ошибка разбора), а невалидные данные — ронять громко,
 * а не подменять дефолтом.
 *
 * Ретраятся только те коды, повтор которых осмыслен: 5xx, 408, 429. Клиентские 4xx не ретраятся —
 * повторять запрос, на который сервер ответил «так нельзя», значит множить нагрузку без шанса
 * на успех.
 *
 * @module reformer/form-registry/net
 */

/** Причина отказа — машиночитаемо, чтобы вызывающий мог отличать «нет сети» от «не та схема». */
export type FetchFailureKind =
  | 'http-error'
  | 'not-json'
  | 'not-a-form-schema'
  | 'aborted'
  | 'network';

export class FormFetchError extends Error {
  constructor(
    readonly kind: FetchFailureKind,
    readonly url: string,
    message: string,
    readonly status?: number,
    override readonly cause?: unknown
  ) {
    super(`[form-registry] ${url}: ${message}`);
    this.name = 'FormFetchError';
  }
}

export interface FetchJsonResult<T> {
  data: T;
  etag?: string;
  /** 304: тело не менялось, данных нет — вызывающий берёт своё из кэша. */
  notModified: boolean;
}

export interface FetchJsonOptions {
  init?: RequestInit;
  signal?: AbortSignal;
  /** ETag прошлого ответа: включает условный запрос (`If-None-Match`). */
  etag?: string;
  /** Сколько раз ПОВТОРИТЬ после первой неудачи. */
  retries?: number;
  /** База экспоненциальной задержки, мс. */
  retryBaseMs?: number;
  /** Подменяемо для тестов. */
  fetchImpl?: typeof fetch;
  /** Подменяемо для тестов; по умолчанию — setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Источник случайности для джиттера; подменяемо для тестов. */
  random?: () => number;
}

const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Задержка перед повтором.
 *
 * Джиттер обязателен, а не косметичен: без него все клиенты, получившие 503 одновременно,
 * повторят запрос тоже одновременно и добьют сервер, который только начал подниматься.
 * `Retry-After` уважаем — сервер знает лучше.
 */
export function retryDelay(
  attempt: number,
  base: number,
  random: () => number,
  retryAfter?: string | null
): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
    const at = Date.parse(retryAfter);
    if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  }
  const exp = base * 2 ** attempt;
  return Math.round(exp * (0.5 + random() * 0.5)); // полный джиттер в [50%, 100%]
}

const looksLikeJson = (contentType: string | null): boolean =>
  !contentType || /\bjson\b/i.test(contentType);

/**
 * Загружает JSON с ретраями и условным запросом.
 *
 * @throws {FormFetchError} С разобранной причиной: `http-error`, `not-json`, `aborted`, `network`.
 */
export async function fetchJson<T>(
  url: string,
  opts: FetchJsonOptions = {}
): Promise<FetchJsonResult<T>> {
  const {
    init,
    signal,
    etag,
    retries = 2,
    retryBaseMs = 250,
    fetchImpl = fetch,
    sleep = defaultSleep,
    random = Math.random,
  } = opts;

  const headers = new Headers(init?.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (etag) headers.set('if-none-match', etag);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new FormFetchError('aborted', url, 'запрос отменён');
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, headers, signal });
    } catch (e) {
      if (signal?.aborted) throw new FormFetchError('aborted', url, 'запрос отменён', undefined, e);
      lastError = e;
      if (attempt === retries) {
        throw new FormFetchError('network', url, 'сеть недоступна', undefined, e);
      }
      await sleep(retryDelay(attempt, retryBaseMs, random));
      continue;
    }

    if (res.status === 304) return { data: undefined as T, etag, notModified: true };

    if (!res.ok) {
      if (RETRIABLE_STATUS.has(res.status) && attempt < retries) {
        await sleep(retryDelay(attempt, retryBaseMs, random, res.headers.get('retry-after')));
        continue;
      }
      throw new FormFetchError('http-error', url, `HTTP ${res.status}`, res.status);
    }

    const contentType = res.headers.get('content-type');
    if (!looksLikeJson(contentType)) {
      // Классика SPA: сервер не нашёл файл и отдал index.html со статусом 200. Без этой проверки
      // отказ всплывёт как «Unexpected token <» далеко от места причины.
      throw new FormFetchError(
        'not-json',
        url,
        `ожидался JSON, получен content-type "${contentType}" — похоже на SPA-fallback (index.html)`,
        res.status
      );
    }

    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      throw new FormFetchError('network', url, 'тело ответа не дочиталось', res.status, e);
    }

    try {
      return {
        data: JSON.parse(text) as T,
        etag: res.headers.get('etag') ?? undefined,
        notModified: false,
      };
    } catch (e) {
      throw new FormFetchError('not-json', url, 'тело не разобралось как JSON', res.status, e);
    }
  }

  throw new FormFetchError('network', url, 'исчерпаны попытки', undefined, lastError);
}

/**
 * Структурная проверка «это вообще схема формы».
 *
 * Дешёвая и без ajv: полная проверка мета-схемой — отдельный, куда более дорогой путь. Здесь
 * отсекается очевидно чужой JSON (чужой эндпоинт, ответ об ошибке в виде объекта), чтобы такой
 * ответ не поехал в конвертер и не всплыл там как `Component "..." not found`.
 */
export function assertFormSchemaShape(url: string, data: unknown): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new FormFetchError('not-a-form-schema', url, 'ожидался объект схемы');
  }
  if (!('root' in (data as Record<string, unknown>))) {
    throw new FormFetchError(
      'not-a-form-schema',
      url,
      'в объекте нет обязательного поля `root` — это не схема формы'
    );
  }
}

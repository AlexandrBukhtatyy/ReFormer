/**
 * Считающая обёртка `fetch` — главное доказательство стенда.
 *
 * Утверждение «повторный монтаж не пошёл в сеть» надо чем-то мерить, и `page.route()` для этого не
 * годится: запросы, обслуженные Service Worker'ом MSW, до перехватчика Playwright не доходят (в
 * репозитории это уже зафиксировано комментариями в `registration-form-json.spec.ts` и
 * `credit-form-page.pom.ts`). Обёртка же стоит ровно там, где загрузчик реестра обращается к сети,
 * и потому измеряет именно то утверждение, которое стенд делает, — независимо от Service Worker,
 * HTTP-кэша браузера и версии Playwright.
 *
 * Отдаётся провайдеру как `options.fetchImpl` и доезжает до `fetchJson` внутри загрузчика.
 *
 * @module react-playground/examples/form-registry-lab/lab-net
 */

import { createLogStore } from './lab-store';

export interface NetRecord {
  url: string;
  /** HTTP-код. `304` тут — нормальный исход: сервер подтвердил кэш. */
  status?: number;
  ms: number;
  error?: string;
}

export const netLog = createLogStore<NetRecord>();

declare global {
  interface Window {
    /** Плоский счётчик для e2e: длина = число сетевых обращений загрузчика. */
    __labNet?: NetRecord[];
  }
}

function record(entry: NetRecord): void {
  netLog.push(entry);
  if (typeof window !== 'undefined') (window.__labNet ??= []).push(entry);
}

export function resetNetLog(): void {
  netLog.clear();
  if (typeof window !== 'undefined') window.__labNet = [];
}

/** Считает КАЖДУЮ попытку, включая повторы после 500/429: их у одного отказа бывает три. */
export const countingFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const startedAt = performance.now();
  try {
    const response = await fetch(input, init);
    record({ url, status: response.status, ms: Math.round(performance.now() - startedAt) });
    return response;
  } catch (error) {
    record({ url, ms: Math.round(performance.now() - startedAt), error: String(error) });
    throw error;
  }
};

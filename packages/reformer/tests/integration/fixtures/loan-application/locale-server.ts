/**
 * Заглушка сервера словарей приложения — `fetch` для источника `fetchMessages`.
 *
 * Настоящее приложение держит тексты ядра чанком (`loadCoreLocale`), а свои ключи — файлами
 * `/locales/<код>.json` на сервере. Заглушка отвечает на такие адреса словарём заявки
 * ({@link LOAN_APP_MESSAGES}); языка, которого у заявки нет, на сервере нет — `404`. По умолчанию
 * ответ приходит сразу, в ручном режиме (`manual`) запрос ждёт, пока сценарий вызовет `answer`, —
 * так разыгрываются медленная сеть, устаревший ответ и отказ загрузки. Глобальный `fetch`
 * подменяет сценарий: `vi.stubGlobal('fetch', server.fetch)`.
 */

import { deferred, type Deferred } from '../../../test-utils/async';
import { LOAN_APP_MESSAGES } from './messages';

/** Ответ сервера в объёме, который читает `fetchMessages`. */
interface LocaleResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/** Запрос словаря в журнале заглушки. */
interface LocaleRequest {
  readonly address: string;
  readonly response: Deferred<LocaleResponse>;
  answered: boolean;
}

/** Заглушка сервера словарей: `fetch` для приложения и журнал запросов для сценария. */
export interface LocaleServer {
  /** Подмена глобального `fetch`. */
  readonly fetch: (address: string) => Promise<LocaleResponse>;
  /** Адреса запросов в порядке поступления. */
  readonly requested: readonly string[];
  /**
   * Ответить на ожидающий запрос словаря языка `code` (ручной режим). Без `status` — как ответил
   * бы сервер: словарём либо `404`; со `status` — этим статусом (сбой сервера).
   */
  answer(code: string, status?: number): void;
}

/** Настройки заглушки. */
interface LocaleServerOptions {
  /** Запросы ждут вызова `answer`; по умолчанию сервер отвечает сразу. */
  readonly manual?: boolean;
}

const hasDictionary = (code: string): code is keyof typeof LOAN_APP_MESSAGES =>
  Object.prototype.hasOwnProperty.call(LOAN_APP_MESSAGES, code);

/**
 * Заглушка сервера словарей заявки.
 *
 * @example
 * ```ts
 * const server = createLocaleServer({ manual: true });
 * vi.stubGlobal('fetch', server.fetch);
 * const load = createLocaleLoader([loadCoreLocale, fetchMessages((code) => `/locales/${code}.json`)]);
 * const pending = load('en');
 * server.answer('en');
 * await pending;
 * ```
 */
export function createLocaleServer(options: LocaleServerOptions = {}): LocaleServer {
  const requests: LocaleRequest[] = [];
  const requested: string[] = [];

  const respond = (request: LocaleRequest, code: string, status?: number): void => {
    const found = hasDictionary(code);
    const actual = status ?? (found ? 200 : 404);
    request.answered = true;
    request.response.resolve({
      ok: actual >= 200 && actual < 300,
      status: actual,
      json: async () => (found ? LOAN_APP_MESSAGES[code] : null),
    });
  };

  const codeOf = (address: string): string => /\/locales\/(.+)\.json$/.exec(address)?.[1] ?? '';

  return {
    requested,
    fetch(address) {
      const request: LocaleRequest = { address, response: deferred(), answered: false };
      requests.push(request);
      requested.push(address);
      if (options.manual !== true) respond(request, codeOf(address));
      return request.response.promise;
    },
    answer(code, status) {
      const request = requests.find(
        (candidate) => !candidate.answered && codeOf(candidate.address) === code
      );
      if (request === undefined) {
        throw new Error(`[locale-server] ожидающего запроса словаря «${code}» нет`);
      }
      respond(request, code, status);
    },
  };
}

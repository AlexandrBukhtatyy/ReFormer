/**
 * Валидатор URL (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/url
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/** Протоколы по умолчанию — когда `allowedProtocols` не задан или пуст. */
const DEFAULT_PROTOCOLS: readonly string[] = ['http', 'https'];

// Все проверки — без вложенных квантификаторов: время линейно по длине ввода. Домен проверяется
// по меткам, а не одной регуляркой — прежняя `([\da-z.-]+)\.([a-z.]{2,6})` перебирала точки
// квадратично на вводе вида `a.a.a.…`.
const SCHEME = /^([a-z][a-z\d+.-]*):\/\//i;
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`);
const IPV6 = /^\[[\da-f:.]+\]$/i;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
const ZONE = /^(?:\p{L}{2,}|xn--[a-z\d-]+)$/iu;
const PORT = /^\d{1,5}$/;
const WHITESPACE = /\s/;

/**
 * Опции валидатора {@link url}. Расширяют {@link RuleOptions} (`code`, `params`)
 * настройками проверки протокола.
 */
export interface UrlValidatorOptions extends RuleOptions {
  /** Требовать протокол (`схема://`). По умолчанию `false`: `example.com` допустим. */
  requireProtocol?: boolean;
  /**
   * Разрешённые протоколы (без `://`), сравнение без учёта регистра, например `['https']`. Не
   * задан или пуст — `http` и `https`. Значение с иным протоколом даёт замечание `url_protocol`;
   * при заданном списке — и значение без протокола.
   */
  allowedProtocols?: string[];
}

/** Хост из адреса: имя (`localhost`, домен с зоной, в том числе кириллический), IPv4 или `[IPv6]`. */
function isHost(host: string): boolean {
  if (host.toLowerCase() === 'localhost' || IPV4.test(host) || IPV6.test(host)) return true;
  const labels = host.split('.');
  return (
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label)) &&
    ZONE.test(labels[labels.length - 1])
  );
}

/**
 * Адрес с протоколом разобран: авторитет без userinfo, допустимый хост и порт, а целиком — то,
 * что принимает `new URL`. Хост проверяется по исходному тексту: парсер сам нормализует `1` в
 * `0.0.0.1`, и число прошло бы как IP-адрес.
 */
function isWellFormed(address: string, schemeLength: number): boolean {
  const rest = address.slice(schemeLength);
  const end = rest.search(/[/?#]/);
  const authority = end === -1 ? rest : rest.slice(0, end);
  if (authority.includes('@')) return false;
  let host = authority;
  let port: string | undefined;
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close === -1) return false;
    host = authority.slice(0, close + 1);
    const tail = authority.slice(close + 1);
    if (tail !== '') {
      if (!tail.startsWith(':')) return false;
      port = tail.slice(1);
    }
  } else {
    const colon = authority.lastIndexOf(':');
    if (colon !== -1) {
      host = authority.slice(0, colon);
      port = authority.slice(colon + 1);
    }
  }
  if (!isHost(host) || (port !== undefined && !PORT.test(port))) return false;
  try {
    new URL(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Фабрика валидатора URL.
 *
 * Пустые значения (`''`/`null`/`undefined`) пропускаются (используйте {@link required}
 * для обязательности).
 *
 * Контракт адреса: разбор — `new URL`; хост — `localhost`, домен с буквенной зоной (в том числе
 * кириллический и punycode), IPv4 или `[IPv6]`; порт допустим. Запрещены пробелы и userinfo
 * (`user:pass@`). Протокол необязателен (`example.com`), пока не задан `requireProtocol`; по
 * умолчанию разрешены `http` и `https`, чужой протокол — замечание `url_protocol` с
 * `params.allowedProtocols`. Свой `code` из опций заменяет оба встроенных кода.
 *
 * @param options - Опции валидатора {@link UrlValidatorOptions}
 * @returns Правило {@link Rule} для строкового поля
 *
 * @example Проверка URL
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, url } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.website, [required(), url({ code: 'website.url' })]);
 *   // Требовать протокол и ограничить схему только https:
 *   validate(model.$.homepage, [url({ requireProtocol: true, allowedProtocols: ['https'] })]);
 * });
 * ```
 */
export function url(options?: UrlValidatorOptions): Rule<string | null | undefined> {
  const explicit = options?.allowedProtocols !== undefined && options.allowedProtocols.length > 0;
  const allowed = (explicit ? options!.allowedProtocols! : DEFAULT_PROTOCOLS).map((protocol) =>
    protocol.toLowerCase()
  );
  const protocolIssue = () =>
    validationIssue('url_protocol', options, {
      allowedProtocols: explicit ? options!.allowedProtocols : [...DEFAULT_PROTOCOLS],
    });

  return (value) => {
    if (!value) {
      return null;
    }
    if (WHITESPACE.test(value)) return validationIssue('url', options);

    const scheme = SCHEME.exec(value);
    if (scheme === null) {
      // Без протокола: `//host` и прочее, что не начинается с хоста, — не адрес.
      if (options?.requireProtocol || value.startsWith('/')) return validationIssue('url', options);
      const prefixed = `http://${value}`;
      if (!isWellFormed(prefixed, 'http://'.length)) return validationIssue('url', options);
      return explicit ? protocolIssue() : null;
    }

    if (!isWellFormed(value, scheme[0].length)) return validationIssue('url', options);
    return allowed.includes(scheme[1].toLowerCase()) ? null : protocolIssue();
  };
}

/**
 * Подстановки `${VAR}` и `${VAR:-умолчание}` в адресе и заголовках удалённого сервера.
 *
 * Синтаксис — тот же, что у Claude Code в `.mcp.json`: файл лежит в git, и секрет в нём пишется
 * переменной, а не значением. У Claude Code значение берётся из окружения процесса; у браузера
 * окружения нет — значение вводит человек в панели MCP, и хранится оно в секретах плагина
 * (`../secrets`).
 *
 * Подставляется только в `url` и `headers`: больше у удалённого сервера строк нет.
 *
 * @module plugins/forms/mcp/config/interpolate
 */

import type { RemoteServerSpec } from './types';

const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

/** Переменные строки — по порядку появления, без повторов. */
function variablesIn(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(VARIABLE)) {
    const name = match[1]!;
    // У переменной с умолчанием значение не обязательно: без ввода действует умолчание.
    if (match[2] === undefined && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Переменные без умолчания, которым нужны значения, — адреса и заголовков сервера. */
export function variablesOf(spec: RemoteServerSpec): string[] {
  const names = [spec.url, ...Object.values(spec.headers)].flatMap(variablesIn);
  return names.filter((name, at) => names.indexOf(name) === at);
}

/**
 * Заголовки, где секрет, похоже, записан значением, а не переменной: имя говорит о ключе или
 * токене, а подстановки в значении нет. `.mcp.json` лежит в git — панель об этом предупреждает.
 */
export function literalSecretHeaders(spec: RemoteServerSpec): string[] {
  return Object.entries(spec.headers)
    .filter(
      ([name, value]) =>
        /authorization|token|key|secret|password/i.test(name) &&
        !value.includes('${') &&
        value.trim().length >= 8
    )
    .map(([name]) => name);
}

/** Строка с подставленными значениями либо список переменных, значений которых нет. */
export function interpolate(
  text: string,
  values: Readonly<Record<string, string | undefined>>
):
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly missing: string[] } {
  const missing: string[] = [];
  const result = text.replace(VARIABLE, (_whole, name: string, fallback: string | undefined) => {
    const value = values[name];
    if (value !== undefined && value !== '') return value;
    if (fallback !== undefined) return fallback;
    if (!missing.includes(name)) missing.push(name);
    return '';
  });
  return missing.length > 0 ? { ok: false, missing } : { ok: true, text: result };
}

/** Адрес и заголовки сервера с подставленными значениями либо недостающие переменные. */
export function resolveRemote(
  spec: RemoteServerSpec,
  values: Readonly<Record<string, string | undefined>>
):
  | { readonly ok: true; readonly url: string; readonly headers: Record<string, string> }
  | { readonly ok: false; readonly missing: string[] } {
  const missing: string[] = [];
  const take = (text: string): string => {
    const result = interpolate(text, values);
    if (result.ok) return result.text;
    for (const name of result.missing) if (!missing.includes(name)) missing.push(name);
    return '';
  };
  const url = take(spec.url);
  const headers = Object.fromEntries(
    Object.entries(spec.headers).map(([key, header]) => [key, take(header)])
  );
  return missing.length > 0 ? { ok: false, missing } : { ok: true, url, headers };
}

/**
 * Проверки полноты словаря — чистыми функциями, которые возвращают список промахов.
 *
 * Вынесены из теста, потому что проверяющих двое: билдер сверяет словари оболочки и встроенных
 * плагинов, а плагины, живущие вне билдера, — свои словари тем же правилом. Разойдись правила,
 * и перевод, принятый одной проверкой, показывал бы маркер ключа на экране у другой.
 *
 * @module shell/platform/services/i18n/dictionary-checks
 */

import { parseMessage, type MessagePattern } from '@reformer/core/i18n';
import { FALLBACK_LOCALE } from './i18n';

/** Словарь одного владельца: локаль → ключ → сообщение. */
export type Dictionary = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Локали, в которых обязан быть каждый ключ. Резервная — первой, потому что за ней нет никого. */
export const REQUIRED_LOCALES: readonly string[] = [FALLBACK_LOCALE, 'ru'];

/** Имена аргументов сообщения, включая те, что встречаются только внутри веток. */
function argumentsOf(pattern: MessagePattern, out = new Set<string>()): Set<string> {
  for (const node of pattern) {
    if (node.kind === 'text') continue;
    out.add(node.name);
    if (node.kind === 'plural' || node.kind === 'select') {
      for (const branch of node.branches.values()) argumentsOf(branch, out);
    }
  }
  return out;
}

/** `владелец · ключ` — адрес, по которому промах ищется в репозитории. */
const address = (owner: string, key: string): string => `${owner} · ${key}`;

/** Ключи, которых нет хотя бы в одной обязательной локали. */
export function missingKeys(owner: string, dictionary: Dictionary): string[] {
  // Объединение, а не «ключи основной локали»: иначе ключ, существующий ТОЛЬКО в английском,
  // не проверялся бы вовсе — а это ровно тот случай, когда перевод забыли в основную локаль.
  const all = new Set<string>();
  for (const locale of REQUIRED_LOCALES) {
    for (const key of Object.keys(dictionary[locale] ?? {})) all.add(key);
  }

  const missing: string[] = [];
  for (const key of [...all].sort()) {
    for (const locale of REQUIRED_LOCALES) {
      if (dictionary[locale]?.[key] === undefined) {
        missing.push(`${address(owner, key)}: нет в «${locale}»`);
      }
    }
  }
  return missing;
}

/**
 * Локали сверх обязательных. Лишняя локаль не ошибка сама по себе, но она не проверяется
 * на полноту ничем: список обязательных её не знает, и её ключи разъедутся молча.
 */
export function extraLocales(owner: string, dictionary: Dictionary): string[] {
  return Object.keys(dictionary)
    .filter((locale) => !REQUIRED_LOCALES.includes(locale))
    .map((locale) => `${owner}: локаль «${locale}»`);
}

/** Сообщения, которые не разбираются, и переводы, потерявшие подстановку. */
export function brokenMessages(
  owner: string,
  dictionary: Dictionary
): { readonly broken: string[]; readonly mismatched: string[] } {
  const broken: string[] = [];
  const patterns = new Map<string, MessagePattern>();

  for (const locale of REQUIRED_LOCALES) {
    for (const [key, message] of Object.entries(dictionary[locale] ?? {})) {
      try {
        patterns.set(`${locale}\u0000${key}`, parseMessage(message));
      } catch (error) {
        broken.push(
          `${address(owner, key)} [${locale}]: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // Имена аргументов сверяются с резервной локалью, а не попарно между всеми: пар было бы
  // больше, а адресат один — тот, кто перевёл и потерял подстановку.
  const mismatched: string[] = [];
  for (const locale of REQUIRED_LOCALES) {
    if (locale === FALLBACK_LOCALE) continue;
    for (const key of Object.keys(dictionary[locale] ?? {})) {
      const base = patterns.get(`${FALLBACK_LOCALE}\u0000${key}`);
      const other = patterns.get(`${locale}\u0000${key}`);
      if (base === undefined || other === undefined) continue;
      const expected = [...argumentsOf(base)].sort().join(', ');
      const actual = [...argumentsOf(other)].sort().join(', ');
      if (expected !== actual) {
        mismatched.push(
          `${address(owner, key)}: «${FALLBACK_LOCALE}» ждёт {${expected}}, «${locale}» — {${actual}}`
        );
      }
    }
  }
  return { broken, mismatched };
}

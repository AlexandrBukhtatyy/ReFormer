/**
 * Английское умолчание пропа-подписи из словаря кита — для props-компаньонов (`*.props.ts`).
 *
 * Модуль React-free: `*.props.ts` грузятся в голом Node (MCP-сервер, генератор каталога), поэтому
 * здесь только JSON словаря. Хук переводчика живёт отдельно — `./messages`.
 *
 * @module i18n/message-default
 */

import en from './en.json';

/** Ключ словаря кита. */
export type KitMessageKey = keyof typeof en;

/** Встроенная английская таблица кита — источник умолчаний и запасной язык переводчика. */
export const kitEn: Readonly<Record<KitMessageKey, string>> = en;

/**
 * Умолчание текстового пропа: английская строка из словаря и ключ, по которому её переводит
 * активная локаль. Один источник английского текста — `en.json`: литерал в схеме пропсов и
 * строка в компоненте разойтись не могут.
 *
 * @param key - Ключ словаря кита; сообщение должно быть простой строкой, без подстановок.
 * @returns Фрагмент JSON Schema: `default` для документации и инспектора, `x-messageKey` — чтобы
 *   инспектор мог показать умолчание на своём языке.
 *
 * @example
 * ```ts
 * placeholder: {
 *   type: 'string',
 *   ...messageDefault('kit.select.placeholder'),
 *   description: 'Подсказка в триггере.',
 * }
 * ```
 */
export function messageDefault<K extends KitMessageKey>(
  key: K
): { default: string; 'x-messageKey': K } {
  return { default: en[key], 'x-messageKey': key };
}

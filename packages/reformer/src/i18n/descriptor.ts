/**
 * Описатель сообщения — авторская подпись, которая превращается в текст при рендере.
 *
 * Автор схемы пишет `label: msg('profile.email.label')` вместо строки. Описатель лежит в
 * `componentProps` как есть и раскрывается там, где уже известна активная локаль. Узлы формы при
 * смене языка не пересоздаются, поэтому значения, `touched` и ошибки её переживают.
 *
 * @module i18n/descriptor
 */

import type { Messages } from './locale';

/**
 * Бренд описателя. `Symbol.for` — чтобы описатель узнавался и через границу двух копий модуля
 * (разные чанки, разные версии пакета на странице).
 */
export const MESSAGE_DESCRIPTOR: unique symbol = Symbol.for('reformer.i18n.message');

/**
 * Описатель сообщения. Намеренно без ключей `value`, `array`, `item`, `component`: обход схемы в
 * `createForm` узнаёт по ним узел, а описатель узлом не является.
 */
export interface MessageDescriptor {
  readonly [MESSAGE_DESCRIPTOR]: true;
  /** Ключ сообщения в словаре приложения. */
  readonly key: string;
  /** Значения подстановок. */
  readonly values?: Readonly<Record<string, unknown>>;
  /** Английский текст на случай, если ключа в локали нет. */
  readonly defaultMessage?: string;
}

/** Текст, который можно задать строкой или описателем. */
export type LocalizableText = string | MessageDescriptor;

/**
 * Создаёт описатель сообщения.
 *
 * @param key - Ключ в словаре приложения.
 * @param values - Значения подстановок.
 * @param defaultMessage - Английский текст на случай, если ключа в локали нет.
 *
 * @example
 * ```ts
 * { model: model.$.email, component: Input, componentProps: { label: msg('profile.email.label') } }
 * ```
 */
export function msg(
  key: string,
  values?: Readonly<Record<string, unknown>>,
  defaultMessage?: string
): MessageDescriptor {
  return Object.freeze({
    [MESSAGE_DESCRIPTOR]: true as const,
    key,
    ...(values === undefined ? {} : { values }),
    ...(defaultMessage === undefined ? {} : { defaultMessage }),
  });
}

/** Является ли значение описателем сообщения. */
export function isMessageDescriptor(value: unknown): value is MessageDescriptor {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as { [MESSAGE_DESCRIPTOR]?: unknown })[MESSAGE_DESCRIPTOR] === true
  );
}

/**
 * `msg` с типизированными ключами: принимает английский словарь приложения, проверяет ключ при
 * компиляции и подставляет английский текст как `defaultMessage` — без провайдера и при промахе
 * по локали форма покажет его, а не ключ.
 *
 * @param defaults - Английский словарь приложения.
 *
 * @example
 * ```ts
 * import appEn from './locales/en.json';
 *
 * export const { msg } = defineMessages(appEn);
 * msg('profile.email.label'); // опечатка в ключе — ошибка компиляции
 * ```
 */
export function defineMessages<D extends Messages>(
  defaults: D
): {
  msg(key: keyof D & string, values?: Readonly<Record<string, unknown>>): MessageDescriptor;
} {
  return { msg: (key, values) => msg(key, values, defaults[key]) };
}

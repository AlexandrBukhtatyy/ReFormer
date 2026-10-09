/**
 * Подпуть `@reformer/core/i18n` — локализация форм без React: объект локали, загрузка словарей,
 * перевод и форматирование, тексты ошибок, описатели авторских подписей.
 *
 * Провайдер и хуки (`I18nProvider`, `useI18n`, `useMessages`, `useValidationMessage`) отдаёт вход
 * `@reformer/core/react`. Из главной бочки `@reformer/core` этот модуль не реэкспортируется:
 * канонический импорт один.
 *
 * @group i18n
 * @module i18n
 */

// Формат сообщений (подмножество ICU).
export {
  parseMessage,
  formatPattern,
  createMessageFormatter,
  MessageSyntaxError,
} from './i18n/message-format';
export type {
  MessageNode,
  MessagePattern,
  MessageBranches,
  MessageValues,
  MessageFormatOptions,
} from './i18n/message-format';

// Локаль как данные.
export { DEFAULT_LOCALE, extendLocale, validateLocale, messageArguments } from './i18n/locale';
export type { FormLocale, Messages, WeekStart, LocaleIssue } from './i18n/locale';

// Загрузка локалей.
export { createLocaleLoader, fetchMessages, bundledLocaleSource } from './i18n/loader';
export type { LocaleLoader, LocaleSource, LocaleSourceResult } from './i18n/loader';
export { createLocaleStore } from './i18n/locale-store';
export type {
  LocaleLoad,
  LocaleStore,
  LocaleStoreState,
  LocaleStoreOptions,
} from './i18n/locale-store';

// Перевод и форматирование.
export { createI18n, translateBuiltin } from './i18n/translator';
export type { I18nHandle } from './i18n/translator';

// Тексты ошибок валидации.
export { resolveValidationError } from './i18n/validation-message';

// Авторские подписи.
export { msg, defineMessages, isMessageDescriptor, MESSAGE_DESCRIPTOR } from './i18n/descriptor';
export type { MessageDescriptor, LocalizableText } from './i18n/descriptor';
export { resolveLocalized } from './i18n/resolve-localized';

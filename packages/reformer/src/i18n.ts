/**
 * Подпуть `@reformer/core/i18n` — локализация форм: объект локали, загрузка словарей, провайдер,
 * перевод и форматирование, описатели авторских подписей.
 *
 * Вторая точка сшивки слоёв после корневого `index.ts`: чистая часть лежит в `src/i18n/`
 * (без React), привязка к React — в `src/platforms/react/i18n/`. Из главной бочки `@reformer/core`
 * этот модуль не реэкспортируется: канонический импорт один, а контекст обязан существовать в
 * единственном экземпляре на все пакеты `@reformer/*`.
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

// React.
export { I18nProvider } from './platforms/react/i18n/provider';
export type {
  I18nProviderProps,
  I18nStaticProviderProps,
  I18nLoadingProviderProps,
} from './platforms/react/i18n/provider';
export { useI18n, useMessages, useValidationMessage } from './platforms/react/i18n/hooks';
export { I18N_CONTEXT_MARKER } from './platforms/react/i18n/context';
export type { I18nContextValue } from './platforms/react/i18n/context';

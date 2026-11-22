/**
 * Подпуть `@reformer/core/locale` — загрузчик встроенных локалей ядра (тексты ошибок валидации,
 * единицы размера файла). Приложению с ui-kit он не нужен: `loadKitLocale` из
 * `@reformer/ui-kit/locale` уже включает словари ядра и cdk.
 *
 * @module locale
 */

import { bundledLocaleSource } from '../i18n/loader';

/** Языки, которые ядро поставляет само. */
export const CORE_LOCALES: readonly string[] = ['en', 'ru'];

/**
 * Источник локалей ядра для `createLocaleLoader`: чанк нужного языка по запросу.
 *
 * @example
 * ```ts
 * const loadLocale = createLocaleLoader([loadCoreLocale, fetchMessages((code) => `/locales/${code}.json`)]);
 * ```
 */
export const loadCoreLocale = bundledLocaleSource({
  en: () => import('./en').then((m) => m.en),
  ru: () => import('./ru').then((m) => m.ru),
});

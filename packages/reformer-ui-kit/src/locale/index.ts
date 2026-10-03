/**
 * Подпуть `@reformer/ui-kit/locale` — загрузчик встроенных локалей кита. Локаль накопительная:
 * словари ядра (ошибки валидации, размер файла) и cdk плюс подписи кита, поэтому `loadCoreLocale`
 * и `loadCdkLocale` рядом с ним в список источников ставить не нужно.
 *
 * @module locale
 */

import { bundledLocaleSource } from '@reformer/core/i18n';

/** Языки, которые кит поставляет сам. */
export const KIT_LOCALES: readonly string[] = ['en', 'ru'];

/**
 * Источник локалей кита для `createLocaleLoader`: чанк нужного языка по запросу.
 *
 * @example
 * ```ts
 * import { createLocaleLoader, fetchMessages } from '@reformer/core/i18n';
 * import { loadKitLocale } from '@reformer/ui-kit/locale';
 *
 * const loadLocale = createLocaleLoader([loadKitLocale, fetchMessages((code) => `/locales/${code}.json`)]);
 * ```
 */
export const loadKitLocale = bundledLocaleSource({
  en: () => import('./en').then((m) => m.en),
  ru: () => import('./ru').then((m) => m.ru),
});

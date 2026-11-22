/**
 * Подпуть `@reformer/cdk/locale` — загрузчик встроенных локалей cdk. Локаль накопительная: словарь
 * ядра (ошибки валидации, единицы размера файла) плюс строки cdk, поэтому `loadCoreLocale` рядом
 * с ним в список источников ставить не нужно.
 *
 * @module locale
 */

import { bundledLocaleSource } from '@reformer/core/i18n';

/** Языки, которые cdk поставляет сам. */
export const CDK_LOCALES: readonly string[] = ['en', 'ru'];

/**
 * Источник локалей cdk для `createLocaleLoader`: чанк нужного языка по запросу.
 *
 * @example
 * ```ts
 * import { createLocaleLoader, fetchMessages } from '@reformer/core/i18n';
 * import { loadCdkLocale } from '@reformer/cdk/locale';
 *
 * const loadLocale = createLocaleLoader([loadCdkLocale, fetchMessages((code) => `/locales/${code}.json`)]);
 * ```
 */
export const loadCdkLocale = bundledLocaleSource({
  en: () => import('./en').then((m) => m.en),
  ru: () => import('./ru').then((m) => m.ru),
});

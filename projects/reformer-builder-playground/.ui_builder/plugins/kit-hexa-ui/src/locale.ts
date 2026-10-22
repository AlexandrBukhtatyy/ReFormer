/**
 * Язык HexaUI по локали ReFormer.
 *
 * Свои строки у HexaUI — кнопки визарда, календарь, подписи «нет данных» — из её i18next, и по
 * умолчанию он английский (`en-us`). Провайдер кита передаёт ему язык активной локали ReFormer
 * (`useI18n().code`): в билдере это язык его интерфейса (`I18nProvider` оболочки), в приложении —
 * язык формы, который ставит её страница. Модуль — чистые данные, без HexaUI: проверяется в node.
 *
 * @module reformer/kit-hexa-ui/locale
 */

/**
 * Языки, словари которых есть у HexaUI (`LangVariants`), — в нижнем регистре: так их ждёт её
 * i18next (`lowerCaseLng`). Псевдоязык `hash-id` (ключи вместо строк) сюда не входит.
 */
export const HEXA_LOCALES: readonly string[] = [
  'en-us',
  'ru-ru',
  'ar-ae',
  'de-de',
  'es-es',
  'es-mx',
  'fr-fr',
  'it-it',
  'ja-jp',
  'kk-kz',
  'ko-kr',
  'pl-pl',
  'pt-br',
  'tr-tr',
  'zh-hans',
  'zh-hant',
];

/** Язык HexaUI по умолчанию — и тот, что достаётся языку, которого у неё нет. */
export const HEXA_DEFAULT_LOCALE = 'en-us';

/**
 * Язык HexaUI по коду BCP 47: точное совпадение (`pt-BR` → `pt-br`), иначе первый вариант того же
 * языка (`ru` → `ru-ru`, `es` → `es-es`, `zh` → `zh-hans`), иначе английский.
 */
export function hexaLocaleOf(code: string): string {
  const wanted = code.trim().toLowerCase().replace(/_/g, '-');
  if (HEXA_LOCALES.includes(wanted)) return wanted;
  const language = wanted.split('-')[0];
  return HEXA_LOCALES.find((locale) => locale.startsWith(`${language}-`)) ?? HEXA_DEFAULT_LOCALE;
}

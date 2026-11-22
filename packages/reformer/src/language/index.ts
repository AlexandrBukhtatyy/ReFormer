/**
 * `@reformer/core/language` — уровень языка над моделью приложения.
 *
 * - `createLanguage({ load, lang?, supported?, storage?, … })` — запрошенный и показанный язык,
 *   локаль, перевод (`t`, `i18n`), `pending`/`error`, направление письма — сигналами; команды
 *   `set`/`retry`. Загрузка — та же, что у `I18nProvider` (`createLocaleStore` из `/i18n`).
 * - Адаптеры: `browserLanguage` (язык браузера), `documentLang` (`<html lang dir>`),
 *   `textDirection`.
 * - Хранилище выбора: `webStorage()` и тип `StorageAdapter`.
 *
 * В React: `<I18nProvider language={language}>` из `@reformer/core/react` — компоненты cdk и
 * ui-kit переключают язык вместе с уровнем, а смена языка не требует перерисовки сверху.
 *
 * @group Language
 * @module language
 */

export { createLanguage } from './create-language';
export type { Language, LanguageOptions } from './create-language';
export { browserLanguage, documentLang, textDirection } from './adapters';
export type { LanguageTarget, TextDirection } from './adapters';
export { webStorage } from '../levels/storage';
export type { StorageAdapter } from '../levels/storage';

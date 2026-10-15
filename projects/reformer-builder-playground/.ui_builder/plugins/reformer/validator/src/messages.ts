/**
 * Словарь плагина: локаль → ключ → сообщение.
 *
 * Здесь тексты находок валидатора (`errors.<код>`) и подписи его быстрых исправлений
 * (`quickfix.*`). Раньше они лежали в словаре оболочки — последнее, что оболочка знала о формах.
 * Читает их не сам плагин — своего интерфейса у него нет, — а тот, кто находку показывает:
 * панель проблем, канвас, редактор кода. Код находки и ключ подписи несут владельца
 * (`pluginDiagnosticCode`, `pluginMessageKey`), и служба сообщений оболочки переводит их этим
 * словарём — одна ошибка по-прежнему звучит одинаково везде, где её видно.
 *
 * Файлы JSON, а не литералы в `.ts`: словарь правит переводчик, а не автор кода.
 *
 * ## Находка внутри части документа
 *
 * У находки, сделанной в разметке именованной части (`parts`), свой код — тот же с суффиксом
 * `.in-part` (см. `./codes`), и своя фраза: та же, но с именем части в начале. Фразы эти в файлах
 * НЕ записаны: их двадцать с лишним на локаль, и каждая — копия соседней. Копии разошлись бы на
 * первой же правке формулировки, поэтому вариант собирается здесь из начала фразы
 * ({@link PART_PREFIX_KEY}, его переводчик правит в том же файле) и фразы исходного кода.
 *
 * @module plugins/reformer/validator/messages
 */

import { inPart, PART_CODES } from './codes';
import en from './locales/en.json';
import ru from './locales/ru.json';

/**
 * Ключ начала фразы для находки внутри части: `«Часть «{part}»: »`. Строительный материал, а не
 * сообщение — в словарь, который уходит оболочке, он не попадает.
 */
export const PART_PREFIX_KEY = 'part.prefix';

/** Словарь локали с фразами находок внутри частей документа. */
function withPartPhrases(
  source: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
  const { [PART_PREFIX_KEY]: prefix = '', ...rest } = source;
  const messages: Record<string, string> = rest;
  for (const code of PART_CODES) {
    const phrase = messages[`errors.${code}`];
    if (phrase !== undefined) messages[`errors.${inPart(code)}`] = `${prefix}${phrase}`;
  }
  return Object.freeze(messages);
}

/** Локаль → ключ (без пространства имён) → сообщение. */
export const SCHEMA_VALIDATOR_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru: withPartPhrases(ru), en: withPartPhrases(en) });

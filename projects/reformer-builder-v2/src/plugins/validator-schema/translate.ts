/**
 * Перевод сообщений `validateFormSchema` в коды и параметры.
 *
 * Проверка схемы живёт в `@reformer/renderer-json` и отдаёт `string[]` — путь плюс английская
 * фраза. Кодов там нет и не будет: пакет обслуживает и рантайм, и MCP, и CLI, где строка —
 * законный выход. Значит, перевод обязан жить здесь, и он устроен как таблица образцов.
 *
 * **Это самое хрупкое место переноса, и прятать это не нужно.** Образец завязан на текст
 * чужого пакета: переформулируют сообщение — образец промахнётся. Поэтому промах не теряет
 * находку, а даёт {@link CODES.INVALID} с исходной фразой в `params.message`: человек прочтёт,
 * ассистент — нет. Тест на каждый образец фиксирует сегодняшние формулировки, и обновление
 * пакета уронит тест, а не самопочинку ассистента в бою.
 *
 * @module plugins/validator-schema/translate
 */

import { CODES, type DiagnosticCode } from './codes';

/** Код и разобранные из фразы данные. */
export interface TranslatedMessage {
  readonly code: DiagnosticCode;
  readonly params: Record<string, unknown>;
}

/**
 * Образцы сообщений. Порядок значим: более частные идут раньше общих.
 *
 * Каждый образец — обязательство перед `@reformer/renderer-json`; источник фразы указан
 * рядом, чтобы при обновлении пакета было понятно, куда смотреть.
 */
const PATTERNS: readonly {
  readonly test: RegExp;
  readonly code: DiagnosticCode;
  readonly params: (match: RegExpExecArray) => Record<string, unknown>;
}[] = [
  // validate.ts, walkOperatorNames — имена операторов.
  {
    test: /^unknown component "(.+)"$/,
    code: CODES.UNKNOWN_COMPONENT,
    params: (m) => ({ name: m[1] }),
  },
  {
    test: /^HTML tag "(.+)" is not allowed/,
    code: CODES.HTML_TAG_NOT_ALLOWED,
    params: (m) => ({ tag: m[1] }),
  },
  {
    test: /^unknown dataSource "(.+)"$/,
    code: CODES.UNKNOWN_DATA_SOURCE,
    params: (m) => ({ name: m[1] }),
  },
  { test: /^unknown fn "(.+)"$/, code: CODES.UNKNOWN_FN, params: (m) => ({ name: m[1] }) },
  {
    test: /^unknown locale key "(.+)"$/,
    code: CODES.UNKNOWN_LOCALE_KEY,
    params: (m) => ({ key: m[1] }),
  },
  // validate.ts, walkArrayInitialValue — молчаливо ломающиеся массивы.
  {
    test: /^array node "initialValue" is missing element keys \[(.*)\]/,
    code: CODES.ARRAY_INITIAL_VALUE_INCOMPLETE,
    params: (m) => ({ keys: m[1] }),
  },
  {
    test: /^array node is missing "initialValue"/,
    code: CODES.ARRAY_INITIAL_VALUE_MISSING,
    params: () => ({}),
  },
  // validate.ts, formatAjvErrors — структура узлов и componentProps.
  {
    test: /^has unknown property "(.+)"$/,
    code: CODES.UNKNOWN_PROPERTY,
    params: (m) => ({ property: m[1] }),
  },
  {
    test: /^must have required property '(.+)'$/,
    code: CODES.MISSING_PROPERTY,
    params: (m) => ({ property: m[1] }),
  },
  { test: /^must be (.+)$/, code: CODES.WRONG_TYPE, params: (m) => ({ expected: m[1] }) },
];

/**
 * Код и параметры по тексту сообщения (уже без адреса — его снял `splitLocation`).
 *
 * Неузнанное сообщение — не ошибка перевода, а его граница: {@link CODES.INVALID} доносит
 * фразу до человека, ничего не выдумывая за ассистента.
 */
export function translateMessage(message: string): TranslatedMessage {
  for (const pattern of PATTERNS) {
    const match = pattern.test.exec(message);
    if (match !== null) return { code: pattern.code, params: pattern.params(match) };
  }
  return { code: CODES.INVALID, params: { message } };
}

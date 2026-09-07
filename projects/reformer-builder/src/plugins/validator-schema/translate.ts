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
 * ## Что достижимо на самом деле — считано, а не предположено
 *
 * Источников сообщений два, и оба перебраны: мета-схема form-DSL и схемы пропсов каталога кита
 * (209 записей, как их видит валидатор — после слияния враппера с вариантом). Кроме `type`
 * и `required` там встречаются ровно `enum` (110 мест), `minimum` (23), `maximum` (1) и
 * `pattern` (4 регулярки мета-схемы: `$model(...)`, `$component(...)`, `$html(...)`, `$nodeId`).
 *
 * Ловушка, на которую легко попасться при подсчёте грепом: `maxItems`, `maxLength`, `minItems`
 * в каталоге ЕСТЬ — но как ИМЕНА ПРОПОВ (`ComboboxMulti.maxItems`, `InputOTP.maxLength`),
 * а не как ключевые слова. Сообщений вида `must NOT have more than N items` не бывает.
 *
 * Раньше ВСЁ это попадало под образец `must be (.+)`, то есть печаталось как ошибка ТИПА:
 * «Значение не того типа: ожидается equal to one of the allowed values». Ложно попадали ровно
 * три вида — `enum`, `minimum`, `maximum`, — и каждый теперь имеет свой код.
 *
 * Образцы шире достижимого: `const`, `>` и `<` (строгие границы) сегодня не рождаются ни одной
 * схемой. Они оставлены нарочно и стоят ноль: это те же два ключевых слова с той же фразой,
 * и добавление их в схему пропсов не должно ронять находку в общий код.
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
 * Регулярка мета-схемы → форма записи, которую она требует.
 *
 * Сырая регулярка в интерфейсе — это ответ на вопрос «что не так» языком, которым вопрос не
 * задавали: `^\$model\(.+\)$` не подсказывает написать `$model(price)`. Всех регулярок в
 * мета-схеме четыре, и каждая требует одной узнаваемой формы.
 *
 * Узнаётся ПОДСТРОКА, а не полное совпадение с литералом: правка регулярки в чужом пакете
 * (скажем, ужесточение того, что допустимо внутри скобок) не должна молча ронять образец
 * в общий код. Неузнанная регулярка отдаётся как есть — она хотя бы точна.
 */
function shapeOf(pattern: string): string {
  if (pattern.includes('$model')) return '$model(...)';
  if (pattern.includes('$component')) return '$component(...)';
  if (pattern.includes('$html')) return '$html(...)';
  if (pattern.includes('[0-9a-z]{8}')) return '$nodeId';
  return pattern;
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
  // Проверки значения, которые раньше все до одной притворялись ошибкой ТИПА — см. заметку
  // «Что остаётся общим кодом» в шапке модуля.
  {
    test: /^must be equal to (?:one of the allowed values|constant)$/,
    code: CODES.VALUE_NOT_ALLOWED,
    params: () => ({}),
  },
  // `>=` и `<=` раньше `>` и `<`: альтернатива в регулярном выражении упорядочена, и короткий
  // вариант, стоящий первым, откусил бы у длинного знак равенства.
  {
    test: /^must be (>=|<=|>|<) (.+)$/,
    code: CODES.OUT_OF_RANGE,
    params: (m) => ({ op: m[1], limit: m[2] }),
  },
  {
    test: /^must match pattern "(.+)"$/,
    code: CODES.PATTERN_MISMATCH,
    params: (m) => ({ expected: shapeOf(m[1]) }),
  },
  // Только НАСТОЯЩИЕ типы JSON Schema, а не всё, что начинается с «must be». Раньше здесь стоял
  // `(.+)`, и через него `must be equal to one of the allowed values` печаталось фразой
  // «Значение не того типа: ожидается equal to one of the allowed values»: для человека
  // бессмыслица, а `params.expected` для ассистента — обрывок английского, то есть ровно та
  // хрупкость, ради ухода от которой заводились коды. Перечисление допускает список
  // (`type: ['string','null']` даёт `must be string,null`).
  {
    test: /^must be ((?:string|number|integer|boolean|object|array|null)(?:,\s*(?:string|number|integer|boolean|object|array|null))*)$/,
    code: CODES.WRONG_TYPE,
    params: (m) => ({ expected: m[1] }),
  },
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

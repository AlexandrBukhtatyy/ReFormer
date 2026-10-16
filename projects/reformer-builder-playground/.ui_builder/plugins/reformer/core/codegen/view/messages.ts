/**
 * Тексты замечаний формы — модель `validation/messages.ts`.
 *
 * ## Зачем форме свой словарь
 *
 * Правило несёт только КОД замечания и параметры; строку по коду собирает резолвер: сначала
 * словарь формы, потом словарь активной локали, потом встроенная английская таблица ядра. У
 * сгенерированной формы словаря не было, локаль приложения по умолчанию английская — и человек
 * видел под полем «This field is required». Словарь формы закрывает это там же, где лежат сами
 * правила: тексты едут вместе с формой и не зависят от того, поставил ли хост русскую локаль.
 *
 * ## Откуда коды и тексты
 *
 * Код замечания у валидатора ядра фиксирован (`required()` → `required`, `minDate()` →
 * `date_min`) — таблица {@link VALIDATOR_CODES} повторяет то, что валидаторы передают в
 * `validationIssue`. Правило вправе дать свой код опцией (`required({ code: 'email.required' })`):
 * тогда запись заводится под ним, с тем же текстом по умолчанию.
 *
 * Тексты берутся из русской локали ядра (`@reformer/core/locale/ru`), а не пишутся здесь заново:
 * второй комплект тех же строк разошёлся бы с первым на первой же правке перевода.
 *
 * В словарь попадают коды только тех валидаторов, которыми пользуются правила формы. Без правил —
 * `required`, если в схеме есть обязательные поля: заготовка валидации печатает именно его.
 *
 * ## Язык формы — рядом со словарём
 *
 * Русских строк мало: шаблон словаря форматируется по ЯЗЫКУ активной локали. Склонение
 * (`{minLength, plural, …}`) и единицы размера файла берутся у неё, и в приложении с английской
 * локалью (или без провайдера локали) выходило «Не больше 3 символа», «больше 5 MB», а кнопки шагов
 * визарда — «Next →». Поэтому файл словаря объявляет и язык формы — `formLocale`, русскую локаль
 * кита ({@link MessagesView.localeModule}), — а страница задаёт его форме своим `I18nProvider`.
 * Форма говорит на языке, на котором написан её словарь, при любой локали приложения. Файл —
 * пользователя: `formLocale = undefined` возвращает форме язык приложения.
 *
 * @module plugins/reformer/core/codegen/view/messages
 */

import { ru } from '@reformer/core/locale/ru';
import { isFieldNode, parseOperator, type JsonFieldNode } from '@reformer/renderer-json';
import { fieldKindOf } from '../../form-mock';
import { walkDocumentNodes } from '../../form-model/query';
import { hasValidationRules, type FormRules } from '../../form-model/rules';
import type { EmitContext } from '../context';

/** Одно правило валидации формы. */
type ValidationRuleOf = FormRules['validation'][number];
import { printLiteral } from '../print/js';

/**
 * Валидатор ядра → коды его замечаний.
 *
 * Почти всегда код один и совпадает с именем; расходятся валидаторы дат (`date_*`) и адреса
 * (`url` даёт ещё `url_protocol`).
 */
const VALIDATOR_CODES: Readonly<Record<string, readonly string[]>> = {
  required: ['required'],
  email: ['email'],
  pattern: ['pattern'],
  url: ['url', 'url_protocol'],
  phone: ['phone'],
  min: ['min'],
  max: ['max'],
  minLength: ['minLength'],
  maxLength: ['maxLength'],
  isNumber: ['isNumber'],
  integer: ['integer'],
  multipleOf: ['multipleOf'],
  nonNegative: ['nonNegative'],
  nonZero: ['nonZero'],
  isDate: ['date_invalid'],
  minDate: ['date_min'],
  maxDate: ['date_max'],
  // Имена «перевёрнуты» относительно кодов намеренно: `futureDate` требует дату в будущем и
  // потому жалуется на прошлую.
  futureDate: ['date_past'],
  pastDate: ['date_future'],
  minAge: ['date_min_age'],
  maxAge: ['date_max_age'],
  fileType: ['fileType'],
  maxFileSize: ['maxFileSize'],
  minFileSize: ['minFileSize'],
  maxFiles: ['maxFiles'],
  minFiles: ['minFiles'],
  maxTotalFileSize: ['maxTotalFileSize'],
};

/**
 * Валидаторы длины, у которых код зависит от вида значения: у строки — символы (`maxLength`), у
 * массива — элементы (`maxItems`). Ядро различает это само, по значению; кодоген — по цели правила.
 */
const COLLECTION_CODES: Readonly<Record<string, string>> = {
  minLength: 'minItems',
  maxLength: 'maxItems',
};

/** Виды полей, значение которых — коллекция: мультивыбор, файлы и список дат. */
const COLLECTION_KINDS: ReadonlySet<string> = new Set(['multi', 'file', 'dates']);

/**
 * Пути модели, значение которых — коллекция: узлы-массивы и поля-коллекции. Пути — как записаны
 * в документе: у полей строки массива — от строки (так их и адресует правило строки).
 */
function collectionPaths(ctx: EmitContext): ReadonlySet<string> {
  const out = new Set(ctx.collected.arrayPaths);
  walkDocumentNodes(ctx.schema, (node) => {
    if (!isFieldNode(node) || !COLLECTION_KINDS.has(fieldKindOf(node as JsonFieldNode))) return;
    const parsed = parseOperator(node.model);
    if (parsed?.op === 'model') out.add(parsed.arg);
  });
  return out;
}

/** Цель правила — коллекция: сама или, у правила строки, её поле от строки. */
function targetsCollection(rule: ValidationRuleOf, collections: ReadonlySet<string>): boolean {
  if (collections.has(rule.target)) return true;
  const each = rule.each;
  return (
    each !== undefined &&
    rule.target.startsWith(`${each}.`) &&
    collections.has(rule.target.slice(each.length + 1))
  );
}

/** Имя валидатора в записи правила: `minLength(2)` → `minLength`. */
const VALIDATOR_NAME = /^\s*([A-Za-z_$][\w$]*)/;

/** Свой код замечания в опциях валидатора: `required({ code: 'email.required' })`. */
const CUSTOM_CODE = /\bcode\s*:\s*(['"])((?:(?!\1).)+)\1/;

/** Текст замечания по коду из русской локали ядра. */
function textOf(code: string): string | undefined {
  return (ru.messages as Readonly<Record<string, string>>)[`validation.${code}`];
}

/** Одна запись словаря. */
export interface MessageEntryView {
  /** Код замечания — ключ словаря. */
  readonly code: string;
  /** Текст по-русски; шаблон с параметрами (`{minLength}`) — как в словарях локали. */
  readonly text: string;
}

/** Словарь формы глазами шаблона. */
export interface MessagesView {
  /** Записи в порядке первого появления валидатора в правилах. */
  readonly entries: readonly MessageEntryView[];
  /** Объявление словаря целиком: `export const formMessages = defineIssueMessages({ … });`. */
  readonly code: string;
  /**
   * Модуль русской локали, на которой форма говорит (`formLocale`): у встроенного кита — его
   * локаль (ядро, cdk и подписи кита), у прочих — локаль ядра.
   */
  readonly localeModule: string;
}

/**
 * Русская локаль кита по его спецификатору импорта. Дескриптор кита локали не называет, поэтому
 * таблица: у встроенного кита она есть (`@reformer/ui-kit/locale/ru` — ядро, cdk и подписи кита),
 * а прочим достаётся локаль ядра — тексты замечаний, склонения и единицы размера по-русски.
 */
const KIT_LOCALES: Readonly<Record<string, string>> = {
  '@reformer/ui-kit': '@reformer/ui-kit/locale/ru',
};

/** Русская локаль ядра — запасная, когда у кита своей нет. */
const CORE_LOCALE = '@reformer/core/locale/ru';

/**
 * Записи словаря для одного правила валидатора.
 *
 * @param collection - Цель правила — коллекция: у валидаторов длины код тогда «элементный».
 */
function entriesOf(rule: string, collection = false): readonly MessageEntryView[] {
  const name = VALIDATOR_NAME.exec(rule)?.[1];
  const item = collection && name !== undefined ? COLLECTION_CODES[name] : undefined;
  const codes =
    item !== undefined ? [item] : name === undefined ? undefined : VALIDATOR_CODES[name];
  if (codes === undefined) return [];
  const custom = CUSTOM_CODE.exec(rule)?.[2];
  return codes.flatMap((code, index) => {
    const text = textOf(code);
    if (text === undefined) return [];
    // Свой код заменяет ОСНОВНОЙ код валидатора; побочные (`url_protocol`) остаются своими.
    return [{ code: index === 0 && custom !== undefined ? custom : code, text }];
  });
}

export function messagesView(ctx: EmitContext): MessagesView {
  const seen = new Set<string>();
  const entries: MessageEntryView[] = [];
  const add = (entry: MessageEntryView): void => {
    if (seen.has(entry.code)) return;
    seen.add(entry.code);
    entries.push(entry);
  };

  if (hasValidationRules(ctx.rules)) {
    const collections = collectionPaths(ctx);
    for (const rule of ctx.rules.validation) {
      const collection = targetsCollection(rule, collections);
      rule.rules.flatMap((entry) => entriesOf(entry, collection)).forEach(add);
    }
  } else if (ctx.collected.requiredPaths.length > 0) {
    entriesOf('required').forEach(add);
  }

  const dictionary = Object.fromEntries(entries.map((entry) => [entry.code, entry.text]));
  return {
    entries,
    code: printLiteral(dictionary, {
      prefix: 'export const formMessages = defineIssueMessages(',
      suffix: ');',
    }),
    localeModule: KIT_LOCALES[ctx.kit.kit.codegen.importSpecifier] ?? CORE_LOCALE,
  };
}

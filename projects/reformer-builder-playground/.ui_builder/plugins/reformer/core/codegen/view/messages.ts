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
 * @module plugins/reformer/core/codegen/view/messages
 */

import { ru } from '@reformer/core/locale/ru';
import { hasValidationRules } from '../../form-model/rules';
import type { EmitContext } from '../context';
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
}

/** Записи словаря для одного правила валидатора. */
function entriesOf(rule: string): readonly MessageEntryView[] {
  const name = VALIDATOR_NAME.exec(rule)?.[1];
  const codes = name === undefined ? undefined : VALIDATOR_CODES[name];
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
    for (const rule of ctx.rules.validation) rule.rules.flatMap(entriesOf).forEach(add);
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
  };
}

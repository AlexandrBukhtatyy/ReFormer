/**
 * Документ формы: что из intent он держит, а что нет.
 *
 * Документ — то, что хранит конструктор форм: схема формата 2 и правила формы рядом с ней.
 * Ассистент конструктора собирает его из того же intent (`build_form`), но модуля в документе нет:
 * код формы печатает кодогенерация конструктора, а читает обратно её читатель. Поэтому документ
 * держит только то, что переживает печать и обратное чтение.
 *
 * - **Ошибка `not-in-document`** — записи, которым в документе нет места. Свои операторы
 *   (`operators`), вызовы `call` у валидации и связей, хуки узлов, кроме события компонента
 *   (`renderEffect`, `onInit`, `onMount`, `onUnmount`), — это код модуля. У кросс-проверки читатель
 *   узнаёт только `{ code }`, поэтому `severity` и `params` пропали бы при первом чтении кода.
 *   Правило, которого не будет, хуже отказа: модель уберёт запись или пойдёт в код модуля.
 * - **Заметка `not-kept`** — то, без чего форма собирается, но что не сохранится: начальные
 *   значения полей, стартовые строки массивов (значение задаёт компонент) и справочник без
 *   значений (поле выбора останется без вариантов).
 *
 * Судья (`judgeIntent` с `forDocument`) зовёт эту проверку сам: вердикт один. Отдельно она нужна
 * грамматике документа и тестам.
 *
 * @module reformer-mcp/core/generate/document
 */

import type { FormIntent } from './form-intent.js';
import type { JudgeFinding } from './judge.js';

/** Хуки узлов, которым в документе нет места: событие компонента документ держит. */
const MODULE_ONLY_NODE_KINDS: ReadonlySet<string> = new Set([
  'renderEffect',
  'onInit',
  'onMount',
  'onUnmount',
]);

/** Подсказка для записи, место которой — код модуля. */
const MODULE_CODE_HINT =
  'remove the record, or write it in the code of the form module — a document holds no code';

export interface DocumentCapabilities {
  /** Записи, которым в документе нет места. */
  readonly errors: JudgeFinding<'not-in-document'>[];
  /** Что форма не сохранит, хотя собирается. */
  readonly notes: JudgeFinding<'not-kept'>[];
}

/** Значение, которое что-то задаёт: пустая строка и `null` — значение по умолчанию. */
const meaningful = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

/**
 * Стартовые строки массива целиком выражены `minItems`: их не больше минимума, и в них нет
 * значений — массив начнёт с тем же числом пустых строк.
 */
function keptByMinItems(array: FormIntent['arrays'][number]): boolean {
  const min = array.componentProps?.minItems;
  if (typeof min !== 'number' || min < array.initialValue.length) return false;
  return array.initialValue.every(
    (row) =>
      row === null ||
      typeof row !== 'object' ||
      Object.values(row as Record<string, unknown>).every((value) => !meaningful(value))
  );
}

/**
 * Что из intent документ не держит (ошибки) и что не сохранит (заметки).
 *
 * @param intent - Прочитанный intent (`readIntent`).
 */
export function documentCapabilities(intent: FormIntent): DocumentCapabilities {
  const errors: JudgeFinding<'not-in-document'>[] = [];
  const notes: JudgeFinding<'not-kept'>[] = [];
  const error = (at: string, message: string): void => {
    errors.push({ code: 'not-in-document', at, message, hint: MODULE_CODE_HINT });
  };

  const operators = Object.keys(intent.operators ?? {});
  if (operators.length > 0) {
    error(
      'operators',
      `own operators (${operators.join(', ')}) are module code; a form document holds none`
    );
  }
  intent.validation.forEach((rule, i) => {
    if (rule.call !== undefined) {
      error(
        `validation[${i}].call`,
        `the call \`${rule.call}\` is module code; a form document holds none`
      );
    }
    const extras = [
      rule.severity !== undefined && rule.severity !== 'error' ? 'severity' : null,
      rule.params !== undefined && Object.keys(rule.params).length > 0 ? 'params' : null,
    ].filter((key): key is string => key !== null);
    if (extras.length > 0) {
      error(
        `validation[${i}].${extras[0]}`,
        `${extras.join(' and ')} of the check on \`${rule.target}\` would be lost: a document ` +
          'reads a cross check back with its code only'
      );
    }
  });
  // Место — видом и целью, а не индексом: правила узлов чтение выносит из `behavior`, и индекс
  // прочитанной связи не совпал бы с индексом записи, которую писала модель.
  for (const link of intent.behavior) {
    if (link.kind !== 'call') continue;
    error(
      `behavior: call ${link.target}`,
      `the call \`${link.expr ?? ''}\` is module code; a form document holds none`
    );
  }
  for (const rule of intent.nodes ?? []) {
    if (!MODULE_ONLY_NODE_KINDS.has(rule.kind)) continue;
    error(
      `behavior: ${rule.kind}${rule.selector === undefined ? '' : ` ${rule.selector}`}`,
      `${rule.kind} is module code; a document holds only node events (onComponentEvent)`
    );
  }

  const initial = intent.fields.filter((f) => meaningful(f.initialValue)).map((f) => f.name);
  if (initial.length > 0) {
    notes.push({
      code: 'not-kept',
      at: 'fields',
      message:
        `initial values of ${initial.join(', ')} are not kept: a document keeps no start value, ` +
        'it follows the component',
    });
  }
  // Пустые стартовые строки документ держит числом — `minItems` у `FieldArray`: массив начинает с
  // этого числа пустых строк. Значения строк он не держит (ReFormer-11oe.24).
  const rows = intent.arrays
    .filter((a) => a.initialValue.length > 0 && !keptByMinItems(a))
    .map((a) => a.name);
  if (rows.length > 0) {
    notes.push({
      code: 'not-kept',
      at: 'arrays',
      message:
        `starting rows of ${rows.join(', ')} are not kept: an array starts empty — empty ` +
        'starting rows are "componentProps": { "minItems": N }, row values are not kept',
    });
  }
  intent.dataSources.forEach((source, i) => {
    if (Array.isArray(source.values) && source.values.length > 0) return;
    notes.push({
      code: 'not-kept',
      at: `dataSources[${i}]`,
      message:
        `the data source \`${source.name}\` has no values: nothing is kept, its choice field ` +
        'shows no options',
    });
  });
  return { errors, notes };
}

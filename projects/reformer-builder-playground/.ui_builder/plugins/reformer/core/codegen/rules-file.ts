/**
 * Файл правил формы — текст сайдкара рядом с документом ({@link rulesSidecarNameOf}).
 *
 * Правила хранятся файлом, а не в памяти того, кто их задал: иначе их не видят генерация кода,
 * валидатор и редактор, а перезагрузка страницы теряет их совсем. Словарь — тот же
 * {@link FormRules}, что у ассистента и кодогена, без пересказа: файл — его печать.
 *
 * **Битый файл — не «правил нет».** Ход, прочитавший испорченный JSON как пустой набор, при
 * записи затёр бы то, что человек правил руками. Поэтому разбор отвечает отказом, и решает,
 * что с ним делать, вызывающий.
 *
 * @module plugins/reformer/core/codegen/rules-file
 */

import { emptyRules, readRules, type FormRules } from '../form-model/rules';
import { printJson } from './print/js';

/** Версия формата файла правил. Растёт, только если старый файл нельзя прочитать новым кодом. */
export const RULES_FILE_VERSION = 1;

/** Итог разбора файла правил. */
export type RulesTextResult =
  | { readonly ok: true; readonly rules: FormRules }
  | { readonly ok: false; readonly error: string };

/**
 * Разобрать текст файла правил.
 *
 * Синтаксическая ошибка и корень не-объект — отказ. Неизвестные ключи и прежний ключ
 * `visibility` разбирает терпимый {@link readRules}: файл, записанный раньше, обязан открыться.
 */
export function parseRulesText(text: string): RulesTextResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'the rules file must be a JSON object' };
  }
  return { ok: true, rules: readRules(raw) };
}

/**
 * Напечатать правила файлом. Детерминированно: те же правила — байт в байт тот же текст, поэтому
 * сравнение текстов отвечает на вопрос «изменились ли правила».
 */
export function printRulesText(rules: FormRules): string {
  return printJson({
    version: RULES_FILE_VERSION,
    validation: rules.validation,
    behavior: rules.behavior,
    render: rules.render,
  });
}

/** Текст файла без единого правила — им отмена хода «удаляет» созданный ходом файл. */
export function emptyRulesText(): string {
  return printRulesText(emptyRules());
}

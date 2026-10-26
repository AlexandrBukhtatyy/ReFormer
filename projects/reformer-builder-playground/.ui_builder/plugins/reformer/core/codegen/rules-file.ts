/**
 * Прежний файл правил формы — JSON рядом с документом (`legacyRulesNameOf` в `./layout`), каким
 * правила жили до правил в коде модуля (`./rules-code`). Только чтение: модуль, в коде которого
 * правил ещё нет, получает правила из него один раз — генерацией или первым ходом ассистента,
 * записавшим правила, — а дальше они живут в коде, и файл можно удалить.
 *
 * **Битый файл — не «правил нет».** Прочитанный как пустой набор, он молча потерял бы правила,
 * которые человек видит в файле. Поэтому разбор отвечает отказом, и решает, что с ним делать,
 * вызывающий.
 *
 * @module plugins/reformer/core/codegen/rules-file
 */

import { readRules, type FormRules } from '../form-model/rules';

/** Итог разбора файла правил. */
export type RulesTextResult =
  | { readonly ok: true; readonly rules: FormRules }
  | { readonly ok: false; readonly error: string };

/**
 * Разобрать текст прежнего файла правил.
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

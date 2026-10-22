/**
 * Файл правил формы глазами хода: где он лежит, что в нём на начало хода и что записать в конце.
 *
 * Правила структурного режима (`set_form_rules`, `set_render_rules`) копятся в черновике хода
 * вместе со схемой и приземляются вместе с ней — схема в документ, правила в файл рядом
 * (`core/codegen/rules-file`). Файл главный: ход читает его каждый раз заново, потому что его
 * правят и мимо ассистента — руками, режимом файлов, быстрым исправлением.
 *
 * @module plugins/reformer/ai/session/rules-file
 */

import type { ResourceId } from '@reformer/builder-plugin-api';
import { rulesSidecarNameOf } from '../../../core/codegen/layout';
import { emptyRulesText, parseRulesText, printRulesText } from '../../../core/codegen/rules-file';
import { emptyRules, hasRules, type FormRules } from '../../../core/form-model';
import type { AiFiles } from '../host';

/** Файл правил на начало хода. */
export interface RulesFileBase {
  /** Адрес файла правил. */
  readonly id: ResourceId;
  /** Текст на начало хода; `null` — файла нет. */
  readonly text: string | null;
  /** Почему файл не разобрался; тогда правила хода начинаются с пустого набора. */
  readonly broken?: string;
}

/** Прочитанный файл правил: база для сверки и разобранные правила. */
export interface RulesFileRead extends RulesFileBase {
  readonly rules: FormRules;
}

/** Адрес файла правил документа формы — рядом с ним. */
export function rulesFileOf(
  files: AiFiles,
  document: ResourceId,
  documentPath: string
): ResourceId {
  return files.resolve(files.parentOf(document), rulesSidecarNameOf(documentPath));
}

/** Прочитать файл правил документа формы. */
export async function readRulesFile(
  files: AiFiles,
  document: ResourceId,
  documentPath: string
): Promise<RulesFileRead> {
  const id = rulesFileOf(files, document, documentPath);
  const text = await files.read(id);
  if (text === null) return { id, text, rules: emptyRules() };
  const parsed = parseRulesText(text);
  return parsed.ok
    ? { id, text, rules: parsed.rules }
    : { id, text, rules: emptyRules(), broken: parsed.error };
}

/**
 * Текст, который ход должен записать в файл правил, или `null` — писать нечего.
 *
 * Без правил файл не заводится: форма без правил — нормальное состояние, и пустой файл рядом с
 * каждой тронутой ассистентом формой был бы мусором.
 */
export function rulesTextToWrite(base: RulesFileBase, rules: FormRules): string | null {
  if (base.text === null) return hasRules(rules) ? printRulesText(rules) : null;
  const next = printRulesText(rules);
  return next === base.text ? null : next;
}

/**
 * Текст файла правил «до хода» для отмены: файл, которого не было, отмена не удаляет (удаления у
 * плагинов нет), а очищает — иначе правила хода пережили бы отмену.
 */
export function rulesTextBefore(base: RulesFileBase): string {
  return base.text ?? emptyRulesText();
}

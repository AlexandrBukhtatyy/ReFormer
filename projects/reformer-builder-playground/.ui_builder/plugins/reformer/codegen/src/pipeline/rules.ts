/**
 * Правила формы для прогона генерации — из файла правил рядом с документом.
 *
 * Файл пишет ассистент (структурный режим), правят руками и быстрые исправления; генерация
 * печатает из него `validation/*.ts` и `behavior/index.ts`. Нет файла — нет правил, и это
 * нормально. Битый файл — отказ прогона: заготовки вместо правил, которые человек видит в файле,
 * были бы молчаливой потерей.
 *
 * @module plugins/reformer/codegen/pipeline/rules
 */

import type { ResourceId } from '@reformer/builder-plugin-api';
import { rulesSidecarNameOf } from '../../../core/codegen/layout';
import { parseRulesText } from '../../../core/codegen/rules-file';
import type { FormRules } from '../../../core/form-model';

/** Файл правил есть, но не разбирается. */
export class RulesFileError extends Error {
  constructor(
    /** Адрес файла правил. */
    readonly id: ResourceId,
    detail: string
  ) {
    super(`${id}: ${detail}`);
    this.name = 'RulesFileError';
  }
}

/** Что нужно чтению файла правил от рабочей области. */
export interface RulesFilePort {
  parentOf(id: ResourceId): ResourceId;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  readText(id: ResourceId): Promise<string | null>;
}

/**
 * Прочитать правила документа формы.
 *
 * @returns Правила; `null` — файла правил нет.
 * @throws {RulesFileError} Файл есть, но не разбирается.
 */
export async function readFormRules(
  port: RulesFilePort,
  document: ResourceId,
  documentPath: string
): Promise<FormRules | null> {
  const id = port.resolve(port.parentOf(document), rulesSidecarNameOf(documentPath));
  const text = await port.readText(id);
  if (text === null) return null;
  const parsed = parseRulesText(text);
  if (!parsed.ok) throw new RulesFileError(id, parsed.error);
  return parsed.rules;
}

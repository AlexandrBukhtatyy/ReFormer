/**
 * Правила формы для прогона генерации — из кода её модуля.
 *
 * Правила живут в файлах модуля (`validation/*.ts`, `behavior/index.ts`, словарь текстов,
 * константы источников) и читаются оттуда читателем ядра (`core/codegen/rules-code`). Генерация
 * перепечатывает файлы правил из ПРАВИЛ НЕТРОНУТЫХ ФАЙЛОВ: правленный руками файл она не трогает,
 * и его правило, напечатанное ещё раз в соседнем файле, проверялось бы дважды.
 *
 * ## Прежний файл правил
 *
 * До правил в коде они лежали JSON-файлом рядом с документом (`schema/form.rules.json`). Модуль,
 * в коде которого правил ещё нет, получает их из этого файла — один раз: напечатанные, они дальше
 * живут в коде, а файл можно удалить. Битый прежний файл — отказ прогона: заготовки на месте
 * правил, которые человек видит в файле, были бы молчаливой потерей.
 *
 * @module plugins/reformer/codegen/pipeline/rules
 */

import type { CodegenReader, ResourceId } from '@reformer/builder-plugin-api';
import {
  FORM_RULES_NAME,
  loadRulesFromModule,
  regenerableRules,
  VALIDATION_DIR,
  type ModuleRuleSource,
  type RulesFromCode,
} from '../../../core/codegen';
import { legacyRulesNameOf, legacyRulesPathOf } from '../../../core/codegen/layout';
import { parseRulesText } from '../../../core/codegen/rules-file';
import { hasRules, type FormRules } from '../../../core/form-model/rules';

/** Прежний файл правил есть, но не разбирается. */
export class RulesFileError extends Error {
  /** Адрес файла правил. */
  readonly id: ResourceId;

  constructor(id: ResourceId, detail: string) {
    super(`${id}: ${detail}`);
    this.name = 'RulesFileError';
    this.id = id;
  }
}

/** Что нужно чтению прежнего файла правил от рабочей области. */
export interface RulesFilePort {
  parentOf(id: ResourceId): ResourceId;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  readText(id: ResourceId): Promise<string | null>;
}

/**
 * Прочитать прежний файл правил документа (`form.rules.json` рядом с ним).
 *
 * @returns Правила; `null` — файла нет.
 * @throws {RulesFileError} Файл есть, но не разбирается.
 */
export async function readFormRules(
  port: RulesFilePort,
  document: ResourceId,
  documentPath: string
): Promise<FormRules | null> {
  const id = legacyRulesIdOf(port, document, documentPath);
  const text = await port.readText(id);
  if (text === null) return null;
  const parsed = parseRulesText(text);
  if (!parsed.ok) throw new RulesFileError(id, parsed.error);
  return parsed.rules;
}

/** Адрес прежнего файла правил документа — рядом с ним. */
function legacyRulesIdOf(
  port: Pick<RulesFilePort, 'parentOf' | 'resolve'>,
  document: ResourceId,
  documentPath: string
): ResourceId {
  return port.resolve(port.parentOf(document), legacyRulesNameOf(documentPath));
}

/** Модуль формы — источником для читателя правил: пути от корня модуля. */
export function moduleRuleSource(reader: CodegenReader, root: ResourceId): ModuleRuleSource {
  const at = (path: string) => reader.resolve(root, ...path.split('/'));
  return {
    read: (path) => reader.readText(at(path)).catch(() => null),
    ...(reader.list === undefined
      ? {}
      : {
          list: async (dir: string) => {
            const entries = await reader.list!(at(dir)).catch(() => null);
            return entries === null
              ? null
              : entries.filter((entry) => entry.kind !== 'directory').map((entry) => entry.name);
          },
        }),
  };
}

/** Правила модуля для прогона: всё прочитанное и то, из чего печатать. */
export interface ModuleRules {
  /** Правила кода модуля — с происхождением каждого файла. */
  readonly code: RulesFromCode;
  /** Вход печати: правила нетронутых файлов либо перенесённые из прежнего файла. */
  readonly rules: FormRules;
  /** Правила взяты из прежнего файла правил — в коде их ещё не было. */
  readonly fromLegacyFile: boolean;
  /**
   * Прежний файл правил лежит рядом с документом — путь от корня модуля; `null` — его нет.
   * Генерация называет его устаревшим: правила живут в коде.
   */
  readonly legacyFile: string | null;
}

/** В коде модуля нет ни одного правила — только, может быть, значения источников. */
function noRuleCode(code: RulesFromCode): boolean {
  const { validation, behavior, render } = code.rules;
  return validation.length + behavior.length + render.length === 0;
}

/**
 * Правила модуля для прогона генерации.
 *
 * @throws {RulesFileError} Правил в коде нет, а прежний файл правил есть и битый.
 */
export async function readModuleRules(
  reader: CodegenReader,
  root: ResourceId,
  document: ResourceId,
  documentPath: string
): Promise<ModuleRules> {
  // Без листинга читается хотя бы файл правил формы: имена файлов шагов без него не узнать.
  const code = await loadRulesFromModule(moduleRuleSource(reader, root), {
    validation: [`${VALIDATION_DIR}/${FORM_RULES_NAME}.ts`],
  });
  const legacyFile = (await reader.exists(legacyRulesIdOf(reader, document, documentPath)))
    ? legacyRulesPathOf(documentPath)
    : null;
  if (noRuleCode(code)) {
    const legacy = await readFormRules(reader, document, documentPath);
    if (legacy !== null && hasRules(legacy)) {
      return { code, rules: legacy, fromLegacyFile: true, legacyFile };
    }
  }
  return { code, rules: regenerableRules(code), fromLegacyFile: false, legacyFile };
}

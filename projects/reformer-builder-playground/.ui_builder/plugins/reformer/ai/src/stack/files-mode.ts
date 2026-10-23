/**
 * Режим файлов стека ReFormer: модель правит файлы модуля формы, каждая принятая запись — сразу в
 * рабочей копии.
 *
 * Ассистент проводит попытки, держит журнал хода и отменяет ход по нему. Здесь — то, что знает
 * только ReFormer: где модуль формы, как собрать из файлов форму на начало попытки (база гейта
 * записи), что видит модель и как привести записанные схемы к виду, каким их пишут редактор и
 * генерация кода.
 *
 * @module plugins/reformer/ai/stack/files-mode
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type {
  FormFilesMode,
  FormStackFiles,
  FormToolSlot,
  FormTurn,
  FormWriteMark,
} from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../../core/catalog';
import { fileRoleOf } from '../../../core/codegen/layout';
import { printJson } from '../../../core/codegen/print/js';
import { emptyRules } from '../../../core/form-model';
import type { FileScope } from '../files/scope';
import type { KnowledgeLoader } from '../knowledge';
import { composeForm } from '../files/compose';
import type { FileJournal } from '@reformer/builder-toolkit';
import { createFileTurn, type FileToolContext, type FileTurn } from '../files/turn';
import { fileSystemPrompt } from '../loop/file-prompt';
import { parseSchemaText, printSchemaText } from '../model/schema-text';
import type { ValidateFormSchema } from '../model/validate';
import { fileSeed } from './seed';

/** Правила формы файлам не нужны: они лежат в коде модуля, а не в памяти стека. */
const NO_RULES = emptyRules();

/**
 * Попытка хода над файлами модуля: промпт, затравка модуля и контекст файловых инструментов.
 *
 * @param system - Переопределение системного промпта (тесты).
 */
export function createFilesTurn(
  turn: FileTurn,
  catalog: readonly CatalogEntry[],
  validateForm: ValidateFormSchema,
  system?: string
): FormTurn {
  return {
    system: () => system ?? fileSystemPrompt(catalog),
    seed: () => fileSeed(turn),
    context: (): FileToolContext => ({
      draft: turn.draft(),
      base: turn.base,
      rules: NO_RULES,
      catalog,
      validateForm,
      files: turn,
    }),
  };
}

/** Что нужно режиму от стека. */
export interface FilesModeOptions {
  readonly files: FormStackFiles;
  readonly tools: readonly FormToolSlot[];
  readonly catalog: () => readonly CatalogEntry[];
  /** Проверка, загруженная подготовкой сеанса — на ней стоит гейт записи. */
  readonly prepared: () => ValidateFormSchema;
  readonly knowledge?: KnowledgeLoader;
  readonly scopeOf: (id: string) => FileScope | null;
}

/** Режим файлов одного сеанса стека. */
export function createFilesMode(options: FilesModeOptions): FormFilesMode {
  const { files } = options;

  /** Чтение файла модуля по пути от его корня. */
  const readerOf =
    (scope: FileScope) =>
    (rel: string): Promise<string | null> =>
      files.read(files.resolve(scope.root, ...rel.split('/')));

  return {
    tools: options.tools,
    scopeOf: (document) => options.scopeOf(document),

    async baseline(scope) {
      // Ход по форме, которая не собирается, начинать нельзя: гейт сравнивает каждую запись с
      // формой на начало хода, и сравнивать было бы не с чем.
      const start = await composeForm(readerOf(scope), scope.schemaPath);
      return start.ok ? { ok: true, state: start.schema } : { ok: false, error: start.error };
    },

    begin(scope, base, io) {
      const turn = createFileTurn({
        files,
        scope,
        journal: io.journal as FileJournal,
        mark: io.mark,
        base: base as JsonFormSchema,
        ...(options.knowledge === undefined ? {} : { knowledge: options.knowledge }),
      });
      return createFilesTurn(turn, options.catalog(), options.prepared());
    },

    normalize: (scope, io) => normalizeSchemas(files, scope, io.journal as FileJournal, io.mark),
  };
}

/**
 * Перепечатать схемы, которые ход записал, принтером документа формы — один раз, в конце хода.
 *
 * Не после каждой записи: перепечатка меняет текст, который модель держит в контексте, и её
 * следующий `old_string` не нашёлся бы. Гейт проверяет смысл и от форматирования не зависит,
 * поэтому в пределах хода текст остаётся таким, каким его написала модель, а в конце хода —
 * таким, каким его пишут редактор и кодоген: иначе ход давал бы diff на весь файл.
 *
 * Файл, который после хода правил человек, не трогается: перепечатка стёрла бы его правку.
 */
async function normalizeSchemas(
  files: FormStackFiles,
  scope: FileScope,
  journal: FileJournal,
  mark: FormWriteMark
): Promise<void> {
  for (const [id, entry] of journal.entries()) {
    const role = fileRoleOf(entry.rel, scope.schemaPath);
    if (role !== 'form' && role !== 'step') continue;
    const current = await files.read(id);
    if (current !== entry.after) continue;
    let printed: string;
    try {
      printed =
        role === 'form'
          ? printSchemaText(parseSchemaText(current))
          : printJson(JSON.parse(current));
    } catch {
      continue;
    }
    if (printed === current) continue;
    await files.write(id, printed, mark);
    journal.record(id, entry.rel, entry.before, printed);
  }
}

/**
 * Двойники для тестов стека: файлы проекта с раскладкой модуля формы и попытка хода режима файлов.
 *
 * Файлы и документы — общие двойники (`.shared/assistant-fakes`); здесь к файлам добавлено то,
 * что знает только стек, — где у документа модуль формы.
 *
 * @module plugins/reformer/ai/stack/testing
 */

import type { ResourceId } from '@reformer/builder-plugin-api';
import { createFileJournal, type FileJournal } from '@reformer/builder-toolkit';
import {
  createFakeFiles as createProjectFiles,
  type FakeFiles as FakeProjectFiles,
} from '../../../../.shared/assistant-fakes';
import {
  moduleRootOfDocument,
  moduleRootPathOf,
  modulePlacementOf,
} from '../../../core/codegen/layout';
import type { FileScope } from '../files/scope';
import type { KnowledgeLoader } from '../knowledge';
import { composeForm } from '../files/compose';
import { createFileTurn, type FileTurn } from '../files/turn';

export { createFakeDocuments, type FakeDocuments } from '../../../../.shared/assistant-fakes';

/** Двойник файлов проекта, который знает раскладку модуля формы. */
export interface FakeFiles extends FakeProjectFiles {
  /**
   * Модуль формы документа — как его находит стек по раскладке; `null` — документа нет или у
   * него нет своей папки модуля.
   */
  scopeOf(id: ResourceId): FileScope | null;
}

/** Собрать двойник файлов проекта с раскладкой модуля формы. */
export function createFakeFiles(initial: Readonly<Record<string, string>> = {}): FakeFiles {
  const files = createProjectFiles(initial);
  return {
    ...files,
    scopeOf(id): FileScope | null {
      if (files.text(id) === undefined || modulePlacementOf(id).kind === 'detached') return null;
      const rootPath = moduleRootPathOf(id);
      return {
        root: moduleRootOfDocument(files, id, id),
        rootPath,
        document: id,
        schemaPath: rootPath === '' ? id : id.slice(rootPath.length + 1),
      };
    },
  };
}

/** Документ формы образцового модуля в двойнике файлов. */
export const FORM_PATH = 'forms/loan/schema/form.schema.json';

/**
 * Попытка хода над двойником файлов — так, как её собирает ассистент со стеком: модуль по
 * документу, база — форма, собранная из файлов на начало попытки.
 */
export async function createTestFileTurn(
  files: FakeFiles,
  options: {
    readonly documentPath?: string;
    readonly knowledge?: KnowledgeLoader;
    readonly journal?: FileJournal;
    readonly txId?: string;
  } = {}
): Promise<FileTurn> {
  const scope = files.scopeOf(options.documentPath ?? FORM_PATH);
  if (scope === null) throw new Error('createTestFileTurn: документ без модуля');
  const composed = await composeForm(
    (rel) => files.read(files.resolve(scope.root, ...rel.split('/'))),
    scope.schemaPath
  );
  if (!composed.ok) throw new Error(`createTestFileTurn: ${composed.error}`);
  return createFileTurn({
    files,
    scope,
    journal: options.journal ?? createFileJournal(),
    mark: { origin: 'agent', txId: options.txId ?? 'turn-1' },
    base: composed.schema,
    ...(options.knowledge ? { knowledge: options.knowledge } : {}),
  });
}

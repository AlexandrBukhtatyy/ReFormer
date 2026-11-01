/**
 * Формы проекта и форма файла для стека в интеграции — тем же поиском, что у плагина
 * (`ai/src/stack/project-forms`), над двойником файлов: у него адрес — путь от корня проекта.
 *
 * @module plugins/reformer/integration/project-forms-harness
 */

import type { FormListing, ResourceId } from '@reformer/builder-plugin-api';
import { formNameOfSchemaPath } from '../core/codegen/layout';
import { formPathOf, projectFormPaths, type ProjectFilesView } from '../ai/src/stack/project-forms';
import type { FakeFiles } from '../ai/src/stack/testing';

/** `formOf` и `forms` параметров стека (`createSchemaFormStack`) над двойником файлов. */
export function projectFormsOf(files: FakeFiles): {
  readonly formOf: (id: ResourceId) => Promise<ResourceId | null>;
  readonly forms: (recognizes: (text: string) => boolean) => Promise<readonly FormListing[]>;
} {
  const view: ProjectFilesView = {
    list: async (dir) => (await files.list(dir)).map((ref) => ({ name: ref.name, kind: ref.kind })),
    exists: (path) => files.exists(path),
    read: (path) => files.read(path),
  };
  return {
    formOf: (id) => formPathOf(files.pathOf(id), view),
    forms: async (recognizes) =>
      (await projectFormPaths(view, recognizes)).map((path) => ({
        resource: path,
        path,
        name: formNameOfSchemaPath(path),
      })),
  };
}

/**
 * Обвязка тестов обеих сторон: хозяин генерации с настоящим стеком ReFormer.
 *
 * Хозяин (`forms/codegen`) и стек (`reformer/codegen`) — разные домены: свои тесты хозяин гоняет
 * на двойнике стека, стек — без хозяина. Здесь — то, что проверяет их вместе: прогон панели,
 * генерацию из дерева, цели из проекта, напечатанные стеком.
 *
 * @module plugins/reformer/integration/codegen-harness
 */

import type { KitView } from '../core/codegen';
import { builtinKit } from '../core/testing';
import type {
  CodegenStack,
  GenerateRequest,
  ModuleGeneratorService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { BUILTIN_TARGETS, createCodegenStack } from '../codegen/src';
import { createFakeDocument, FAKE_KIT, stacksOf } from '../../forms/codegen/src/testing';
import type { Stacks } from '../../forms/codegen/src/stacks';
import type { CodegenHost } from '../../forms/codegen/src/host';
import { generateFor } from '../../forms/codegen/src/pipeline/generate-for';
import { createCodegenSessions } from '../../forms/codegen/src/pipeline/state';
import type { FakeFiles } from '../../.shared/assistant-fakes';

export { BUILTIN_TARGETS };

/** Стек ReFormer с китом; `kit: null` — кита нет. Перевод — сам ключ. */
export function reformerStack(options: { readonly kit?: KitView | null } = {}): CodegenStack {
  const view = options.kit === undefined ? builtinKit() : options.kit;
  return createCodegenStack({
    kit: () => view?.kit ?? null,
    catalog: () => view?.catalog ?? [],
    translate: (key) => key,
  });
}

/** Стеки хозяина — один стек ReFormer, от «плагина» `reformer.plugin`. */
export function reformerStacks(options: { readonly kit?: KitView | null } = {}): Stacks {
  return stacksOf(reformerStack(options));
}

/** Файлы и вкладки ассистента — то, поверх чего генерация печатает модуль в тестах хода. */
export interface AssistantWorkspace {
  readonly files: Pick<FakeFiles, 'read' | 'write' | 'list' | 'exists' | 'resolve' | 'parentOf'>;
  documentOf(id: ResourceId): { getText(): string } | null;
}

/**
 * Генерация кода, какой её видит ассистент (`ModuleGeneratorCapability`): хозяин с настоящим
 * стеком ReFormer поверх тех же файлов и вкладок, что у хода. Так тесты хода проверяют, что
 * правила ложатся в код модуля тем же прогоном, что у панели экспорта.
 *
 * `requests` — заказы по порядку: по ним видно, сколько прогонов сделал ход и с каким входом.
 */
export function generatorOver(
  workspace: AssistantWorkspace
): ModuleGeneratorService & { readonly requests: GenerateRequest[] } {
  const { files } = workspace;
  const host: CodegenHost = {
    useTranslate: () => (key) => key,
    useActiveDocument: () => null,
    documentOf: (id) => {
      const document = workspace.documentOf(id);
      return document === null
        ? null
        : createFakeDocument(id, document.getText(), id.slice(id.lastIndexOf('/') + 1));
    },
    sourceOf: () => ({ write: true }),
    kit: () => FAKE_KIT,
    onDidChangeKit: () => ({ dispose: () => {} }),
    parentOf: (id) => files.parentOf(id),
    resolve: (dir, ...segments) => files.resolve(dir, ...segments),
    exists: (id) => files.exists(id),
    list: (dir) => files.list(dir),
    readText: (id) => files.read(id),
    writeText: (id, text) => files.write(id, text),
  };
  const sessions = createCodegenSessions();
  const requests: GenerateRequest[] = [];
  return {
    requests,
    generate(documentId, request = {}) {
      requests.push(request);
      return generateFor(
        {
          host,
          stacks: reformerStacks(),
          targets: BUILTIN_TARGETS,
          store: sessions.storeFor(documentId),
          translate: (key) => key,
        },
        documentId,
        request
      );
    },
  };
}

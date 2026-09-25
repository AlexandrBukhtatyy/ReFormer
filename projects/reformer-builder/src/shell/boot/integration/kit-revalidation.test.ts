/**
 * Смена кита перепроверяет открытые схемы — на настоящих частях (ReFormer-3ybp).
 *
 * Сквозной путь: сессия проекта ставит документ под наблюдение оркестратора → оркестратор
 * подписывается на входы валидатора схемы (`onDidChangeInputs`) → валидатор следит
 * за возможностью `reformer.kit.catalog` через `ctx.capabilities` → служба китов появляется или
 * её каталог доезжает → документ перепроверяется без единой правки.
 *
 * Ломался именно этот путь. Каталог кита грузится лениво, документ из восстановленных вкладок
 * открывается раньше и проверяется с пустым каталогом (проверка имён при пустом каталоге
 * отключена — сверять не с чем), а `revalidate()` оркестратора не звал никто:
 * `schema.unknown-component` появлялся только после первой правки.
 *
 * Служба китов здесь — двойник в объёме, который читает валидатор (приведение к полному типу
 * службы — поэтому): настоящий реестр китов
 * проверяется своими тестами, а этот стережёт шов между ним, оркестратором и валидатором.
 *
 * @module shell/boot/integration/kit-revalidation.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProjectHost } from '@/shell/boot/project/project';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createPluginContext } from '@/shell/platform/plugin/context';
import {
  createMemoryStorageBackend,
  createSecretSessionStore,
} from '@/shell/platform/plugin/storage';
import { createDiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import { createValidationOrchestrator } from '@/shell/platform/services/validation/orchestrator';
import { createMemorySource } from '@/shell/platform/source/memory';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { Source } from '@/shell/platform/source/types';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import {
  DocumentModelPoint,
  KitsCapability,
  type CatalogJson,
  type Disposable,
  type KitsService,
} from '@reformer/builder-plugin-api/internal';
import { BUILTIN_CATALOG } from '@reformer/builder-stack-reformer/testing';
import { createSchemaModelProvider } from '@/plugins/reformer/editor/model/provider';
import {
  createSchemaValidatorPlugin,
  SCHEMA_VALIDATOR_PLUGIN_ID,
} from '@/plugins/reformer/validator/plugin';
import { CODES } from '@/plugins/reformer/validator/codes';

let seq = 0;

/** Форма с опечаткой в имени компонента: её видит только проверка по каталогу кита. */
const FORM_TEXT = JSON.stringify(
  {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          value: '$model(name)',
          component: '$component(Inpt)',
          componentProps: { label: 'Имя' },
        },
      ],
    },
  },
  null,
  2
);

/**
 * Служба китов, чей каталог «доезжает» по команде теста — как ленивый каталог встроенного кита:
 * до загрузки шапка без записей, после — каталог целиком.
 */
function lazyKit(): Pick<KitsService, 'catalogJson' | 'onDidChange'> & {
  arrive(catalog: CatalogJson): void;
} {
  let catalog: CatalogJson = { version: '2.1', components: [], kit: { id: 'reformer-ui-kit' } };
  const listeners = new Set<() => void>();
  return {
    catalogJson: () => catalog,
    onDidChange(cb) {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
    arrive(next) {
      catalog = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

const disposables: Disposable[] = [];

beforeEach(() => {
  // Команды быстрых исправлений вносит редактор схемы, которого здесь нет: валидатор честно
  // предупреждает об этом, и к проверяемому шву это отношения не имеет.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const item of disposables.splice(0).reverse()) item.dispose();
  vi.restoreAllMocks();
});

/**
 * Проект с одной формой, настоящий оркестратор и настоящий плагин валидатора, поднятый
 * настоящим контекстом плагина: `ctx.capabilities` — вид на тот же реестр служб.
 */
async function openForm() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-kit-revalidation-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();
  const extensions = createExtensionRegistry();
  const diagnostics = createDiagnosticsService();
  const services = createServiceRegistry();
  const validation = createValidationOrchestrator({ extensions, diagnostics });

  extensions
    .forPlugin('reformer.editor-schema')
    .contribute(DocumentModelPoint, createSchemaModelProvider());
  const ctx = createPluginContext(SCHEMA_VALIDATOR_PLUGIN_ID, {
    services,
    extensions,
    commands: createCommandRegistry(),
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    secrets: createSecretSessionStore(),
  });
  createSchemaValidatorPlugin({}).activate(ctx);

  const sourceId = `mem${seq}`;
  const source: Source = {
    ...createMemorySource(
      { 'form.json': FORM_TEXT },
      { id: sourceId, label: `src-${seq}`, writable: true }
    ),
    descriptor: { kind: 'fs', handleKey: sourceId },
  };
  sources.register({ kind: 'fs', restore: () => Promise.resolve(source) });

  const project = createProjectHost({
    sources,
    handles: { keys: () => Promise.resolve([]) } as never,
    meta,
    whenContext: createWhenContextStore(),
    extensions,
    isTextEditorFocused: () => false,
    diagnostics,
    validation,
    supported: () => true,
    createFiles: (workspaceId) =>
      createWorkspaceFileStore(workspaceId, {
        directory: opfs.directory,
        lock: (_name, body) => body(),
      }),
  });
  disposables.push(
    { dispose: () => meta.dispose() },
    { dispose: () => project.dispose() },
    { dispose: () => validation.dispose() },
    { dispose: () => ctx.subscriptions.forEach((item) => item.dispose()) }
  );

  await meta.putWorkspace({
    id: sourceId,
    sourceId,
    descriptor: { ...source.descriptor },
    createdAt: 1,
    lastOpenedAt: 1,
  });
  await project.restoreLast();
  const session = project.get();
  if (session === null) throw new Error('проект не открылся');
  const id = `${sourceId}:form.json`;
  await session.documents.open(id);

  return {
    services,
    codes: (): string[] => diagnostics.get(id).map((item) => item.code),
  };
}

describe('смена кита перепроверяет открытые схемы', () => {
  it('каталог кита доехал после открытия формы — опечатка видна без правки', async () => {
    const form = await openForm();
    const kit = lazyKit();
    disposables.push(form.services.register(KitsCapability, kit as unknown as KitsService));

    // Каталог в пути: сверять имена не с чем, и валидатор об именах молчит.
    expect(form.codes()).not.toContain(CODES.UNKNOWN_COMPONENT);

    kit.arrive(BUILTIN_CATALOG);

    expect(form.codes()).toContain(CODES.UNKNOWN_COMPONENT);
  });

  it('плагин китов поднялся после открытия формы — опечатка видна без правки', async () => {
    const form = await openForm();
    expect(form.codes()).not.toContain(CODES.UNKNOWN_COMPONENT);

    const kit = lazyKit();
    kit.arrive(BUILTIN_CATALOG);
    const registration = form.services.register(KitsCapability, kit as unknown as KitsService);

    expect(form.codes()).toContain(CODES.UNKNOWN_COMPONENT);

    // Плагин китов выключили: сверять снова не с чем, и устаревшая находка уходит.
    registration.dispose();

    expect(form.codes()).not.toContain(CODES.UNKNOWN_COMPONENT);
  });
});

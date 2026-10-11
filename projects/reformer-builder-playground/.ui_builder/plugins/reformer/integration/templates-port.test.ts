/**
 * Порт шаблонов — против НАСТОЯЩЕЙ сессии: рабочая область, дерево и файловый источник
 * поверх подставного каталога.
 *
 * Проверяется сквозняк, которого не видит ни один тест плагина: плагин доволен, когда службу
 * позвали, а человеку нужно, чтобы после «форма создана» каталог появился В ДЕРЕВЕ. Между
 * этими двумя утверждениями лежит весь путь — запись в рабочую копию, отправка в источник
 * и забывание прочитанного уровня, — и ломается он молча: операция сообщает об успехе
 * в любом случае.
 *
 * Рабочая область здесь собирается ТЕМ ЖЕ способом, что в приложении: службы регистрируются
 * в реестре, а плагин достаёт их оттуда (`plugins/reformer/templates/workspace`) — включая сохранение:
 * порта у шаблонов больше нет, дверь наружу стала привилегированной службой.
 *
 * @module shell/boot/integration/templates-port.test
 */

import { describe, expect, it } from 'vitest';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import { createFsAccessSource } from '@/shell/platform/source/fs-access';
import { createFakeDirectory } from '@/shell/platform/source/testing';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { DocumentsServiceToken } from '@reformer/builder-plugin-api/internal';
import { WorkspaceFilesServiceToken } from '@reformer/builder-plugin-api/internal';
import { WorkspaceSaveServiceToken } from '@reformer/builder-plugin-api/internal';
import type { PluginContext } from '@reformer/builder-plugin-api/internal';
import type { FormTemplate } from '../templates/src';
import {
  generateFormFromTemplate,
  TEMPLATES_PLUGIN_ID,
  templatesWorkspace,
} from '../templates/src';
import { createDocumentsService } from '@/shell/boot/ports/documents';
import { createWorkspaceFilesService } from '@/shell/boot/ports/workspace-files';
import {
  createWorkspaceSession,
  type WorkspaceSession,
} from '@/shell/boot/project/workspace-session';
import type { ProjectHost } from '@/shell/boot/project/project';
import { createWorkspaceSaveService } from '@/shell/boot/ports/workspace-save';

let seq = 0;

const TEMPLATE: FormTemplate = {
  id: 'credit',
  name: 'Кредит',
  source: 'builtin',
  files: [
    { path: 'form.schema.json', content: '{"root":{"component":"$html(div)"}}' },
    { path: 'model.ts', content: 'export const __formName__Model = 1;' },
  ],
};

/**
 * Шаблон в раскладке «папки по ролям» — так выглядит встроенный: документ формы в `schema/`,
 * шаги рядом с ним двумя уровнями глубже, файлы ролей названы именами модуля, фикстура — сверх
 * модуля.
 */
const MODULE_TEMPLATE: FormTemplate = {
  id: 'module',
  name: 'Модуль',
  source: 'builtin',
  files: [
    {
      path: 'schema/form.schema.json',
      content:
        '{"format":2,"root":{"component":"$component(Wizard)","children":[{"$ref":"./steps/dannye/form.schema.json"}]}}',
    },
    {
      path: 'schema/steps/dannye/form.schema.json',
      content: '{"node":{"component":"$component(Step)","children":[]}}',
    },
    { path: '__FormType__.tsx', content: 'export default function __FormType__() {}' },
    { path: 'types/__form-dir__.ts', content: 'export type __FormType__ = {};' },
    { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' },
  ],
};

/** Сессия над двойниками хранилищ — тот же приём, что в `./workspace-session.test`. */
function harness(files: Readonly<Record<string, string>>) {
  seq += 1;
  const workspaceId = `tpl-${seq}`;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `tpl-meta-${seq}` });
  const opfs = createMemoryOpfs();
  const store = createWorkspaceFileStore(workspaceId, {
    directory: opfs.directory,
    lock: (_name, body) => body(),
  });
  // Источник с НАСТОЯЩИМ деревом каталогов, а не плоский `memory`: у плоского каталоги
  // синтезируются при листинге, и запись файла по несуществующему пути в нём проходит —
  // то есть ровно тот отказ, на котором ломается создание формы на диске, он скрывает.
  const { root } = createFakeDirectory(files);
  const source = createFsAccessSource(root, { id: `tpl${seq}`, handleKey: `tpl-${seq}` });

  const session = createWorkspaceSession({
    workspaceId,
    source,
    files: store,
    meta,
    whenContext: createWhenContextStore(),
  });

  // Держатель проекта в объёме, которым пользуется порт: он спрашивает только `get`.
  const project = {
    get: (): WorkspaceSession | null => session,
    subscribe: () => ({ dispose: () => undefined }),
    canOpen: () => false,
    open: () => Promise.resolve(false),
    restoreLast: () => Promise.resolve(false),
    close: () => undefined,
    dispose: () => undefined,
  } as unknown as ProjectHost;

  // Рабочая область собирается ТАК ЖЕ, как в приложении: службы регистрируются в реестре,
  // плагин достаёт их оттуда. Порт даёт только сохранение — единственную дыру.
  const services = createServiceRegistry();
  services.register(DocumentsServiceToken, createDocumentsService({ project }));
  services.register(WorkspaceFilesServiceToken, createWorkspaceFilesService({ project }));
  // Сохранение — привилегированная служба: здесь она есть, потому что тест проверяет путь
  // ДО источника. Отказ по праву проверяется отдельно, на реестре и каталоге.
  services.register(WorkspaceSaveServiceToken, createWorkspaceSaveService({ project }));
  const ctx = {
    id: TEMPLATES_PLUGIN_ID,
    services,
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      contribute: () => {},
      onDidChangeLocale: () => ({ dispose: () => {} }),
    },
  } as unknown as PluginContext;
  const host = templatesWorkspace(ctx);

  return {
    session,
    host,
    id: (path: string): ResourceId => `${source.id}:${path}` as ResourceId,
    dispose: () => {
      session.dispose();
      meta.dispose();
    },
  };
}

/** Имена строк прочитанного уровня — то, что человек видит в панели. */
function level(session: WorkspaceSession, dir: ResourceId): readonly string[] {
  return (session.tree.get().children.get(dir) ?? []).map((ref) => ref.name);
}

describe('форма по шаблону доходит до дерева', () => {
  it('созданный каталог появляется в раскрытом уровне', async () => {
    const h = harness({ 'src/forms/old.json': '{}' });
    const forms = h.id('src/forms');
    await h.session.tree.expand(h.session.tree.get().rootId);
    await h.session.tree.expand(h.id('src'));
    await h.session.tree.expand(forms);
    expect(level(h.session, forms)).toEqual(['old.json']);

    const result = await generateFormFromTemplate(h.host, forms, 'credit', TEMPLATE, [
      'form.schema.json',
      'model.ts',
    ]);

    expect(result.ok).toBe(true);
    // Уровень прочитан ЗАНОВО: без этого он остался бы прежним, и «форма создана»
    // выглядело бы как несделанная работа.
    expect(level(h.session, forms)).toEqual(['credit', 'old.json']);
    h.dispose();
  });

  it('файлы формы уходят в источник, а не остаются рабочей копией', async () => {
    const h = harness({ 'src/forms/old.json': '{}' });
    const forms = h.id('src/forms');

    await generateFormFromTemplate(h.host, forms, 'credit', TEMPLATE, ['model.ts']);

    // Читаем МИМО рабочей копии: разница между «записано» и «сохранено» здесь и решает,
    // переживёт ли форма перезагрузку страницы.
    const written = await h.session.workspace.readSourceText(h.id('src/forms/credit/model.ts'));
    expect(written?.text).toBe('export const creditModel = 1;');
    h.dispose();
  });

  it('модуль в раскладке «папки по ролям» доходит до источника целиком, вместе с вложенными папками', async () => {
    // Папок ролей на диске ещё нет: `schema/steps/dannye/` — три уровня, которых источник
    // до записи не знает. Плоский двойник такую запись принял бы молча; настоящее дерево
    // каталогов — тот случай, на котором создание формы и ломалось бы.
    const h = harness({ 'src/forms/old.json': '{}' });
    const forms = h.id('src/forms');

    const result = await generateFormFromTemplate(
      h.host,
      forms,
      'loan request',
      MODULE_TEMPLATE,
      MODULE_TEMPLATE.files.map((file) => file.path)
    );

    expect(result.ok).toBe(true);
    // Открывается документ формы из `schema/`, а каталог формы — каталог модуля.
    expect(result.openId).toBe(h.id('src/forms/loan request/schema/form.schema.json'));
    const read = async (path: string): Promise<string | undefined> =>
      (await h.session.workspace.readSourceText(h.id(`src/forms/loan request/${path}`)))?.text;
    expect(await read('schema/steps/dannye/form.schema.json')).toContain('$component(Step)');
    // Имена файлов — те, что кодоген напечатал бы для этой формы.
    expect(await read('LoanRequestForm.tsx')).toBe('export default function LoanRequestForm() {}');
    expect(await read('types/loan-request.ts')).toBe('export type LoanRequestForm = {};');
    // Фикстура — в корне модуля, а не рядом со схемой.
    expect(await read('fixture.ts')).toBe('export const fixture = {};');
    expect(await read('schema/fixture.ts')).toBeUndefined();
    h.dispose();
  });
});

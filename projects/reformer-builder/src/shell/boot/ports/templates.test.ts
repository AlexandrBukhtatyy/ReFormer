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
 * в реестре, а плагин достаёт их оттуда (`plugins/templates/workspace`). Порт остался
 * единственной операцией — сохранением.
 *
 * @module shell/boot/ports/templates.test
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
import type { PluginContext } from '@reformer/builder-plugin-api/internal';
import type { FormTemplate } from '@/plugins/templates';
import {
  generateFormFromTemplate,
  TEMPLATES_PLUGIN_ID,
  templatesWorkspace,
} from '@/plugins/templates';
import { createDocumentsService } from './documents';
import { createWorkspaceFilesService } from './workspace-files';
import {
  createWorkspaceSession,
  type WorkspaceSession,
} from '@/shell/boot/project/workspace-session';
import type { ProjectHost } from '@/shell/boot/project/project';
import { createTemplatesGaps } from './templates';

let seq = 0;

const TEMPLATE: FormTemplate = {
  id: 'credit',
  name: 'Кредит',
  source: 'builtin',
  files: [
    { path: 'renderer.schema.json', content: '{"root":{"component":"$html(div)"}}' },
    { path: 'model.ts', content: 'export const __formName__Model = 1;' },
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
  const host = templatesWorkspace(ctx, createTemplatesGaps({ project }));

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
      'renderer.schema.json',
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
});

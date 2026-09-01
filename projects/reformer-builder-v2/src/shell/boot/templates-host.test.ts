/**
 * Порт шаблонов — против НАСТОЯЩЕЙ сессии: рабочая область, дерево и файловый источник
 * поверх подставного каталога.
 *
 * Проверяется сквозняк, которого не видит ни один тест плагина: плагин доволен, когда порт
 * позвали, а человеку нужно, чтобы после «форма создана» каталог появился В ДЕРЕВЕ. Между
 * этими двумя утверждениями лежит вся композиция — запись в рабочую копию, отправка
 * в источник и забывание прочитанного уровня, — и ломается она молча: операция сообщает
 * об успехе в любом случае.
 *
 * @module app/templates-host.test
 */

import { describe, expect, it } from 'vitest';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import { createFsAccessSource } from '@/shell/platform/source/fs-access';
import { createFakeDirectory } from '@/shell/platform/source/testing';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createWhenContextStore } from '@/shell/platform/ui/when-context-store';
import type { FormTemplate } from '@/plugins/templates';
import { generateFormFromTemplate } from '@/plugins/templates';
import { createWorkspaceSession, type WorkspaceSession } from './workspace-session';
import type { ProjectHost } from './project';
import { createTemplatesHost } from './templates-host';

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

  const host = createTemplatesHost({
    project,
    i18n: createI18nService(),
    services: createServiceRegistry(),
  });

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

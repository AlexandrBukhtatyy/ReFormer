/**
 * Рабочая область стека ReFormer: каталог кита, корпус знаний из проекта, модуль формы.
 *
 * @module plugins/reformer/ai/stack/workspace.test
 */

import { describe, expect, it } from 'vitest';
import {
  DocumentsServiceToken,
  KitsCapability,
  WorkspaceFilesServiceToken,
  type CatalogJson,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { schemaStackWorkspace } from './workspace';

/**
 * Службы, где адрес ресурса — путь: так видно, куда стек поднимается и что читает. Каждая помнит,
 * о чём её спросили.
 */
function harness(
  options: {
    readonly kit?: boolean;
    readonly project?: boolean;
    readonly open?: Readonly<Record<string, string>>;
  } = {}
) {
  const reads: string[] = [];
  const open = options.open ?? {};
  const documents = {
    documentOf: (id: ResourceId) =>
      id in open ? { ref: { id, path: id }, getText: () => open[id] } : null,
  };
  const files = {
    parentOf: (id: ResourceId) => id.slice(0, Math.max(0, id.lastIndexOf('/'))),
    resolve: (dir: ResourceId, ...segments: string[]) => [dir, ...segments].join('/'),
    fromRoot: (anchor: ResourceId, path: string) => `${anchor}${path}`,
    projectRoot: () => (options.project === false ? null : 'fs:'),
    readText: (id: ResourceId) => {
      reads.push(id);
      return Promise.resolve(id.endsWith('llms.txt') ? 'корпус' : null);
    },
  };

  // Сырой каталог службы — как у настоящего реестра китов: до загрузки шапка без записей.
  let catalog: CatalogJson = { version: '2.1', components: [], kit: { id: 'kit-a' } };
  const kits = { catalogJson: () => catalog, onDidChange: () => ({ dispose: () => {} }) };

  const ctx = {
    services: {
      get: (token: { id: string }) =>
        token.id === KitsCapability.id && options.kit !== false ? kits : undefined,
      require: (token: { id: string }) => {
        if (token.id === DocumentsServiceToken.id) return documents;
        if (token.id === WorkspaceFilesServiceToken.id) return files;
        throw new Error(`сервис «${token.id}» не зарегистрирован`);
      },
    },
  } as unknown as PluginContext;

  const arrive = (next: CatalogJson): void => {
    catalog = next;
  };
  return { workspace: schemaStackWorkspace(ctx), reads, arrive };
}

describe('каталог кита', () => {
  it('читается на КАЖДЫЙ вызов: кит переключают и поднимают позже', () => {
    const h = harness();

    expect(h.workspace.catalog()).toEqual([]);
    h.arrive({
      version: '2.1',
      kit: { id: 'kit-a' },
      components: [{ name: 'Text', role: 'container', propsSchema: {} }],
    });

    // Записи — ReFormer-проекция: запись кита плюс синтетика билдера.
    expect(h.workspace.catalog().map((entry) => entry.name)).toContain('Text');
  });

  it('без плагина китов каталог пуст, а не отсутствует', () => {
    expect(harness({ kit: false }).workspace.catalog()).toEqual([]);
  });
});

describe('корпус знаний читается из проекта', () => {
  it('путь считается ОТ КОРНЯ проекта, а не от активного документа', async () => {
    const h = harness();

    const files = h.workspace.projectFiles();
    await expect(files?.read('node_modules/@reformer/core/llms.txt')).resolves.toEqual({
      text: 'корпус',
    });
    expect(h.reads).toEqual(['fs:node_modules/@reformer/core/llms.txt']);
  });

  it('отсутствие файла — ОТКАЗ, а не пустая строка', async () => {
    // Покалеченный llms.txt нельзя принимать за «пакета нет»: тогда вместо версий проекта
    // ассистент молча возьмёт вшитый корпус и будет советовать не то, что стоит у человека.
    const files = harness().workspace.projectFiles();
    await expect(files?.read('node_modules/@reformer/core/package.json')).rejects.toThrow(
      /не прочитан/
    );
  });

  it('без проекта читать нечего, и корпус остаётся вшитым', () => {
    expect(harness({ project: false }).workspace.projectFiles()).toBeUndefined();
  });
});

describe('модуль формы', () => {
  it('по раскладке документа: папка schema/ поднимает к своему родителю', () => {
    const { workspace } = harness({ open: { 'forms/loan/schema/form.schema.json': '{}' } });
    expect(workspace.scopeOf('forms/loan/schema/form.schema.json')).toEqual({
      root: 'forms/loan',
      rootPath: 'forms/loan',
      document: 'forms/loan/schema/form.schema.json',
      schemaPath: 'schema/form.schema.json',
    });
  });

  it('документ со свободным именем своей папки модуля не имеет', () => {
    const { workspace } = harness({ open: { 'forms/credit.schema.json': '{}' } });
    expect(workspace.scopeOf('forms/credit.schema.json')).toBeNull();
  });

  it('форма одним файлом своей двери не имеет — ход правит её текст как есть', () => {
    const { workspace } = harness({ open: { 'forms/loan/schema/form.schema.json': '{}' } });
    expect(workspace.door('forms/loan/schema/form.schema.json')).toBeNull();
  });
});

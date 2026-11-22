import { describe, expect, it, vi } from 'vitest';

import { makeResourceId, type ResourceId } from '@reformer/builder-plugin-api/internal';
import { createFsAccessSource } from '@/shell/platform/source/fs-access';
import { createFakeDirectory } from '@/shell/platform/source/testing';
import type { Source } from '@/shell/platform/source/types';
import { createWorkspaceMetaStore } from './storage/idb';
import { createWorkspaceFileStore } from './storage/opfs';
import { createMemoryIndexedDb, createMemoryOpfs } from './storage/testing';
import { createWorkspace } from './workspace';
import {
  createResourceOperations,
  ResourceOperationError,
  type OperationsWorkspace,
  type ResourceOperations,
} from './resource-ops';

const SOURCE_ID = 'fs';

const FILES = {
  'package.json': '{"name":"demo"}',
  'src/forms/credit/schema.json': '{"root":{}}',
  'src/forms/credit/model.ts': 'export const model = 1;',
  'src/shared/util.ts': 'export const util = 2;',
};

function id(path: string): ResourceId {
  return makeResourceId(SOURCE_ID, path);
}

/** Рабочая область-двойник: помнит открытые вкладки и то, какие из них закрыли. */
function fakeWorkspace(opened: readonly ResourceId[] = []): OperationsWorkspace & {
  readonly closed: ResourceId[];
} {
  const live = [...opened];
  const closed: ResourceId[] = [];
  return {
    closed,
    openedResources: () => live,
    async close(target) {
      closed.push(target);
      const at = live.indexOf(target);
      if (at !== -1) live.splice(at, 1);
    },
  };
}

interface Harness {
  readonly ops: ResourceOperations;
  readonly source: Source;
  readonly textOf: (path: string) => string | undefined;
  readonly invalidated: ResourceId[];
}

function harness(
  options: {
    files?: Readonly<Record<string, string>>;
    workspace?: OperationsWorkspace;
    copyBudget?: number;
  } = {}
): Harness {
  const { root, controls } = createFakeDirectory(options.files ?? FILES);
  const source = createFsAccessSource(root, { id: SOURCE_ID });
  const invalidated: ResourceId[] = [];
  const ops = createResourceOperations({
    source,
    workspace: options.workspace,
    invalidate: (dir) => {
      invalidated.push(dir);
    },
    copyBudget: options.copyBudget,
  });
  return { ops, source, textOf: (path) => controls.textOf(path), invalidated };
}

let seq = 0;

/** Настоящая рабочая область над тем же источником: несохранённое живёт в ней, а не в двойнике. */
function withWorkspace(files: Readonly<Record<string, string>> = FILES) {
  seq += 1;
  const name = `ops-${seq}`;
  const { root, controls } = createFakeDirectory(files);
  const source = createFsAccessSource(root, { id: SOURCE_ID });
  const workspace = createWorkspace({
    id: name,
    source,
    files: createWorkspaceFileStore(name, { directory: createMemoryOpfs().directory }),
    meta: createWorkspaceMetaStore({
      factory: createMemoryIndexedDb().factory,
      databaseName: name,
    }),
  });
  const ops = createResourceOperations({ source, workspace });
  return {
    ops,
    workspace,
    textOf: (path: string) => controls.textOf(path),
    /** Имена уровня так, как их видит дерево: источник вместе с рабочей копией. */
    names: async (dir: string) => (await workspace.list(id(dir))).map((entry) => entry.name),
  };
}

describe('создание', () => {
  it('создаёт файл и сообщает его адрес', async () => {
    const { ops, textOf } = harness();

    const created = await ops.createFile(id('src'), 'notes.md', '# заметки');

    expect(created).toBe(id('src/notes.md'));
    expect(textOf('src/notes.md')).toBe('# заметки');
  });

  it('существующий файл НЕ перезаписывается — в v1 повтор имени обнулял чужой файл', async () => {
    const { ops, textOf } = harness();

    await expect(ops.createFile(id('src/shared'), 'util.ts')).rejects.toMatchObject({
      kind: 'name-taken',
    });
    expect(textOf('src/shared/util.ts')).toBe('export const util = 2;');
  });

  it('негодное имя отвергается ДО обращения к источнику', async () => {
    const { ops, source } = harness();
    const write = vi.spyOn(source, 'write' as never);

    await expect(ops.createFile(id('src'), 'a/b.ts')).rejects.toBeInstanceOf(
      ResourceOperationError
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('создаёт каталог и забывает уровень родителя', async () => {
    const { ops, invalidated } = harness();

    const created = await ops.createDirectory(id('src'), 'widgets');

    expect(created).toBe(id('src/widgets'));
    expect(await ops.createFile(created, 'index.ts')).toBe(id('src/widgets/index.ts'));
    expect(invalidated).toContain(id('src'));
  });
});

describe('переименование', () => {
  it('переносит запись под новым именем', async () => {
    const { ops, textOf } = harness();

    const next = await ops.rename(id('src/shared/util.ts'), 'helpers.ts');

    expect(next).toBe(id('src/shared/helpers.ts'));
    expect(textOf('src/shared/helpers.ts')).toBe('export const util = 2;');
    expect(textOf('src/shared/util.ts')).toBeUndefined();
  });

  it('закрывает вкладку: её содержимое больше не принадлежит этому адресу', async () => {
    const workspace = fakeWorkspace([id('src/shared/util.ts')]);
    const { ops } = harness({ workspace });

    await ops.rename(id('src/shared/util.ts'), 'helpers.ts');

    expect(workspace.closed).toEqual([id('src/shared/util.ts')]);
  });

  it('переименование каталога закрывает вкладки всего, что было внутри', async () => {
    const workspace = fakeWorkspace([id('src/forms/credit/schema.json'), id('src/shared/util.ts')]);
    const { ops } = harness({ workspace });

    await ops.rename(id('src/forms/credit'), 'loan');

    expect(workspace.closed).toEqual([id('src/forms/credit/schema.json')]);
  });

  it('занятое имя — отказ, а не молчаливая замена', async () => {
    const { ops } = harness();

    await expect(ops.rename(id('src/forms/credit/model.ts'), 'schema.json')).rejects.toMatchObject({
      kind: 'name-taken',
    });
  });

  it('то же самое имя ничего не делает', async () => {
    const workspace = fakeWorkspace([id('src/shared/util.ts')]);
    const { ops } = harness({ workspace });

    expect(await ops.rename(id('src/shared/util.ts'), 'util.ts')).toBe(id('src/shared/util.ts'));
    expect(workspace.closed).toEqual([]);
  });

  it('корень источника переименовать нельзя: у него нет ни имени, ни родителя', async () => {
    const { ops } = harness();

    await expect(ops.rename(id(''), 'project')).rejects.toMatchObject({ kind: 'root' });
  });
});

describe('удаление', () => {
  it('удаляет запись и закрывает её вкладку', async () => {
    const workspace = fakeWorkspace([id('src/shared/util.ts')]);
    const { ops, textOf } = harness({ workspace });

    const result = await ops.remove([id('src/shared/util.ts')]);

    expect(result.done).toEqual([id('src/shared/util.ts')]);
    expect(result.failed).toEqual([]);
    expect(textOf('src/shared/util.ts')).toBeUndefined();
    expect(workspace.closed).toEqual([id('src/shared/util.ts')]);
  });

  it('упавшее удаление не отменяет остальных: три выделенных файла — три решения', async () => {
    const { ops, textOf } = harness();

    const result = await ops.remove([id('missing/gone.ts'), id('src/shared/util.ts')]);

    expect(result.done).toEqual([id('src/shared/util.ts')]);
    expect(result.failed).toHaveLength(1);
    expect(textOf('src/shared/util.ts')).toBeUndefined();
  });

  it('файл только в рабочей копии удаляется: вкладка закрыта, копия забыта', async () => {
    const local = id('src/contact.rjsf.json');
    const forgotten: ResourceId[] = [];
    const workspace = {
      ...fakeWorkspace([local]),
      stat: async (target: ResourceId) =>
        target === local && forgotten.length === 0 ? { kind: 'file' as const } : null,
      forget: async (target: ResourceId) => {
        forgotten.push(target);
      },
    };
    const { ops, invalidated } = harness({ workspace });

    const result = await ops.remove([local]);

    expect(result).toEqual({ done: [local], failed: [] });
    expect(workspace.closed).toEqual([local]);
    expect(forgotten).toEqual([local]);
    expect(invalidated).toEqual([id('src')]);
  });

  it('несохранённый файл настоящей рабочей области исчезает из списка уровня', async () => {
    const { ops, workspace, names } = withWorkspace();
    const local = id('src/contact.rjsf.json');
    await workspace.writeText(local, '{}');
    await workspace.open(local);
    expect(await names('src')).toContain('contact.rjsf.json');

    const result = await ops.remove([local]);

    expect(result).toEqual({ done: [local], failed: [] });
    expect(await names('src')).not.toContain('contact.rjsf.json');
    expect(workspace.openedResources()).not.toContain(local);
    expect(await workspace.stat(local)).toBeNull();
  });

  it('корень источника не удаляется', async () => {
    const { ops } = harness();

    const result = await ops.remove([id('')]);

    expect(result.done).toEqual([]);
    expect(result.failed[0]?.error).toBeInstanceOf(ResourceOperationError);
  });
});

describe('копирование', () => {
  it('копия занятого имени разводится номером', async () => {
    const { ops, textOf } = harness();

    const result = await ops.copy([id('src/shared/util.ts')], id('src/shared'));

    expect(result.done).toEqual([id('src/shared/util-2.ts')]);
    expect(textOf('src/shared/util-2.ts')).toBe('export const util = 2;');
  });

  it('две вставки подряд не выбирают одно и то же свободное имя', async () => {
    const { ops } = harness();

    await ops.copy([id('src/shared/util.ts')], id('src/shared'));
    const second = await ops.copy([id('src/shared/util.ts')], id('src/shared'));

    expect(second.done).toEqual([id('src/shared/util-3.ts')]);
  });

  it('каталог копируется со всем содержимым', async () => {
    const { ops, textOf } = harness();

    const result = await ops.copy([id('src/forms/credit')], id('src/shared'));

    expect(result.done).toEqual([id('src/shared/credit')]);
    expect(textOf('src/shared/credit/schema.json')).toBe('{"root":{}}');
    expect(textOf('src/shared/credit/model.ts')).toBe('export const model = 1;');
  });

  it('каталог внутрь самого себя — отказ: обход не завершился бы', async () => {
    const { ops } = harness();

    const result = await ops.copy([id('src/forms')], id('src/forms/credit'));

    expect(result.done).toEqual([]);
    expect(result.failed[0]?.error).toMatchObject({ kind: 'inside-itself' });
  });

  it('потолок числа записей останавливает копирование дерева', async () => {
    const { ops } = harness({ copyBudget: 2 });

    const result = await ops.copy([id('src/forms')], id('src/shared'));

    expect(result.done).toEqual([]);
    expect(result.failed[0]?.error).toMatchObject({ kind: 'budget' });
  });

  it('байты копируются байтами, если источник это умеет', async () => {
    const { ops, source } = harness();
    const writeBytes = vi.spyOn(source, 'writeBytes' as never);

    await ops.copy([id('package.json')], id('src'));

    expect(writeBytes).toHaveBeenCalledTimes(1);
  });
});

describe('несохранённое в рабочей копии', () => {
  it('переименование файла с правкой: правка переезжает на новый адрес', async () => {
    // ReFormer-bvsl: источник переносил файл, рабочая копия старого адреса забывалась —
    // на диске под новым именем прежний текст, правки нет нигде.
    const { ops, workspace, textOf } = withWorkspace();
    const old = id('src/shared/util.ts');
    await workspace.open(old);
    await workspace.writeText(old, 'export const util = 3;');

    const next = await ops.rename(old, 'helpers.ts');

    expect(textOf('src/shared/helpers.ts')).toBe('export const util = 2;');
    expect(workspace.dirtyResources()).toEqual([next]);
    expect(await workspace.readText(next)).toBe('export const util = 3;');
    expect(workspace.openedResources()).not.toContain(old);
    // Ревизия переехала вместе с правкой: сохранение по новому адресу проходит без вопроса.
    expect((await workspace.save()).ok).toBe(true);
    expect(textOf('src/shared/helpers.ts')).toBe('export const util = 3;');
  });

  it('перенос каталога несёт правки всего, что внутри', async () => {
    const { ops, workspace, textOf, names } = withWorkspace();
    await workspace.writeText(id('src/forms/credit/model.ts'), 'export const model = 9;');

    const target = await ops.move(id('src/forms/credit'), id('src/shared'));

    expect(target).toBe(id('src/shared/credit'));
    expect(await names('src/forms')).toEqual([]);
    expect(textOf('src/shared/credit/model.ts')).toBe('export const model = 1;');
    expect(workspace.dirtyResources()).toEqual([id('src/shared/credit/model.ts')]);
    expect(await workspace.readText(id('src/shared/credit/model.ts'))).toBe(
      'export const model = 9;'
    );
  });

  it('файл, которого у источника нет, переименовывается в рабочей копии', async () => {
    // ReFormer-13j2: F2 на несохранённом файле кончался отказом источника «нет <путь>».
    const { ops, workspace, textOf, names } = withWorkspace();
    const local = id('src/forms/credit/types.ts');
    await workspace.writeText(local, 'export type Credit = {};');

    const next = await ops.rename(local, 'credit.types.ts');

    expect(next).toBe(id('src/forms/credit/credit.types.ts'));
    expect(textOf('src/forms/credit/credit.types.ts')).toBeUndefined();
    expect(await workspace.readText(next)).toBe('export type Credit = {};');
    expect(await names('src/forms/credit')).toEqual(['credit.types.ts', 'model.ts', 'schema.json']);
  });

  it('каталог, которого у источника нет, переименовывается со всем содержимым', async () => {
    const { ops, workspace, names } = withWorkspace();
    await workspace.writeText(id('src/forms/loan/schema.json'), '{}');
    await workspace.writeText(id('src/forms/loan/model/index.ts'), 'export {};');

    await ops.rename(id('src/forms/loan'), 'mortgage');

    expect(await names('src/forms')).toEqual(['credit', 'mortgage']);
    expect([...workspace.dirtyResources()].sort()).toEqual([
      id('src/forms/mortgage/model/index.ts'),
      id('src/forms/mortgage/schema.json'),
    ]);
  });

  it('имя, занятое несохранённым файлом, занято', async () => {
    const { ops, workspace, textOf } = withWorkspace();
    await workspace.writeText(id('src/shared/helpers.ts'), 'export {};');

    await expect(ops.rename(id('src/shared/util.ts'), 'helpers.ts')).rejects.toMatchObject({
      kind: 'name-taken',
    });
    expect(textOf('src/shared/util.ts')).toBe('export const util = 2;');
    expect(await workspace.readText(id('src/shared/helpers.ts'))).toBe('export {};');
  });

  it('файл с диска переносится в каталог, который есть только в рабочей копии', async () => {
    const { ops, workspace, textOf, names } = withWorkspace();
    await workspace.writeText(id('src/forms/loan/schema.json'), '{}');

    await ops.move(id('src/shared/util.ts'), id('src/forms/loan'));

    expect(textOf('src/forms/loan/util.ts')).toBe('export const util = 2;');
    expect(textOf('src/shared/util.ts')).toBeUndefined();
    expect(await names('src/forms/loan')).toEqual(['schema.json', 'util.ts']);
  });

  it('каталог, которого у источника нет, копируется в рабочую копию', async () => {
    // ReFormer-13j2: «нечего копировать» на модуле, напечатанном ходом ассистента до сохранения.
    const { ops, workspace, textOf } = withWorkspace();
    await workspace.writeText(id('src/forms/loan/schema.json'), '{"root":{}}');

    const result = await ops.copy([id('src/forms/loan')], id('src/shared'));

    expect(result).toEqual({ done: [id('src/shared/loan')], failed: [] });
    expect(textOf('src/shared/loan/schema.json')).toBeUndefined();
    expect(await workspace.readText(id('src/shared/loan/schema.json'))).toBe('{"root":{}}');
    // Оригинал на месте: копирование не перенос.
    expect(workspace.isDirty(id('src/forms/loan/schema.json'))).toBe(true);
  });

  it('копия частично сохранённого каталога повторяет и сохранённое, и несохранённое', async () => {
    const { ops, workspace, textOf } = withWorkspace();
    await workspace.writeText(id('src/forms/credit/model.ts'), 'export const model = 9;');
    await workspace.writeText(id('src/forms/credit/types.ts'), 'export type Credit = {};');

    const result = await ops.copy([id('src/forms/credit')], id('src/shared'));

    expect(result.done).toEqual([id('src/shared/credit')]);
    // Диск получает то, что на диске и было.
    expect(textOf('src/shared/credit/schema.json')).toBe('{"root":{}}');
    expect(textOf('src/shared/credit/model.ts')).toBe('export const model = 1;');
    expect(textOf('src/shared/credit/types.ts')).toBeUndefined();
    // Несохранённое остаётся несохранённым: правка — поверх скопированного основания.
    expect(await workspace.readText(id('src/shared/credit/model.ts'))).toBe(
      'export const model = 9;'
    );
    expect(await workspace.readBase(id('src/shared/credit/model.ts'))).toBe(
      'export const model = 1;'
    );
    expect(await workspace.readText(id('src/shared/credit/types.ts'))).toBe(
      'export type Credit = {};'
    );
    expect(workspace.isDirty(id('src/shared/credit/types.ts'))).toBe(true);
  });

  it('копия подбирает номер мимо имени, занятого несохранённым файлом', async () => {
    const { ops, workspace } = withWorkspace();
    await workspace.writeText(id('src/shared/util-2.ts'), 'export {};');

    const result = await ops.copy([id('src/shared/util.ts')], id('src/shared'));

    expect(result.done).toEqual([id('src/shared/util-3.ts')]);
  });
});

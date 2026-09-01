import { describe, expect, it, vi } from 'vitest';

import { makeResourceId, type ResourceId } from '@/shell/platform/primitives/resource';
import { createFsAccessSource } from '@/shell/platform/source/fs-access';
import { createFakeDirectory } from '@/shell/platform/source/testing';
import type { Source } from '@/shell/platform/source/types';
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

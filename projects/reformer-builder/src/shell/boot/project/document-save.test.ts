/**
 * Сохранение документа из нескольких файлов: корень сохраняется вместе с частями, выпавшие части
 * удаляются, и вкладка корня изменена, пока изменена любая его часть.
 *
 * @module shell/boot/project/document-save.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import type { ModelDocumentHandle } from '@/shell/platform/workspace/model/model-document';
import type { SaveResult } from '@/shell/platform/workspace/workspace';
import { createDocumentSave } from './document-save';

const ROOT = 'mem:form/form.schema.json' as ResourceId;
const PART = 'mem:form/steps/a/form.schema.json' as ResourceId;
const GONE = 'mem:form/steps/b/form.schema.json' as ResourceId;
const LOCAL = 'mem:form/steps/c/form.schema.json' as ResourceId;
const CODE = 'mem:form/types/form.ts' as ResourceId;
const NESTED_CODE = 'mem:form/validation/form.ts' as ResourceId;
const OTHER_FORM = 'mem:form-2/types/form.ts' as ResourceId;

function ok(id?: ResourceId): SaveResult {
  return { ok: true, saved: id === undefined ? [] : [id], conflicts: [], failures: [] };
}

function bench(
  options: {
    dirty?: readonly ResourceId[];
    removed?: readonly ResourceId[];
    companionsDir?: string | null;
  } = {}
) {
  const saved: (ResourceId | 'all')[] = [];
  /** Порядок событий: догон модели и записи — чтобы проверить, что одно раньше другого. */
  const log: string[] = [];
  const reverted: ResourceId[] = [];
  const removedInSource: ResourceId[] = [];
  let pending = [...(options.removed ?? [])];
  const handle = {
    parts: () => [PART],
    removedParts: () => pending,
    forgetRemoved: (ids: readonly ResourceId[]) => {
      pending = pending.filter((id) => !ids.includes(id));
    },
    flush: async () => {
      // Запись модели в буфер асинхронна: ответ — не сразу.
      await new Promise((resolve) => setTimeout(resolve, 1));
      log.push('flush');
    },
  } as unknown as ModelDocumentHandle<unknown>;

  const saving = createDocumentSave({
    workspace: {
      save: async (id) => {
        saved.push(id ?? 'all');
        log.push(id ?? 'all');
        return ok(id);
      },
      isDirty: (id) => (options.dirty ?? []).includes(id as ResourceId),
      dirtyResources: () => options.dirty ?? [],
      // Локально созданная часть основания не имеет.
      readBase: async (id) => (id === LOCAL ? null : 'base'),
      revert: async (id) => {
        reverted.push(id);
      },
      forget: async () => {},
    },
    models: {
      handleOf: (id) => (id === ROOT ? handle : null),
      opened: () => new Map([[ROOT, handle]]),
    },
    resources: {
      remove: async (ids) => {
        removedInSource.push(...ids);
        return { done: [...ids], failed: [] };
      },
    },
    companionsDirOf: () => options.companionsDir ?? null,
  });
  return { saving, saved, log, reverted, removedInSource, pending: () => pending };
}

describe('сохранение составного документа', () => {
  it('корень сохраняется вместе с частями', async () => {
    const b = bench();
    const result = await b.saving.save(ROOT);
    expect(b.saved).toEqual([ROOT, PART]);
    expect(result.saved).toEqual([ROOT, PART]);
  });

  it('выпавшие части удаляются: из источника — удалением, локальные — откатом', async () => {
    const b = bench({ removed: [GONE, LOCAL] });
    await b.saving.save(ROOT);
    expect(b.removedInSource).toEqual([GONE]);
    expect(b.reverted).toEqual([LOCAL]);
    expect(b.pending()).toEqual([]);
  });

  it('«сохранить всё» тоже удаляет выпавшее', async () => {
    const b = bench({ removed: [GONE] });
    await b.saving.save();
    expect(b.saved).toEqual(['all']);
    expect(b.removedInSource).toEqual([GONE]);
  });

  it('сначала модель догоняет буфер, потом запись: Ctrl+S сразу за правкой её не теряет', async () => {
    const one = bench();
    await one.saving.save(ROOT);
    expect(one.log).toEqual(['flush', ROOT, PART]);

    const all = bench();
    await all.saving.save();
    expect(all.log).toEqual(['flush', 'all']);
  });

  it('корень изменён, пока изменена часть или часть ждёт удаления', () => {
    expect(bench().saving.isDirty(ROOT)).toBe(false);
    expect(bench({ dirty: [PART] }).saving.isDirty(ROOT)).toBe(true);
    expect(bench({ removed: [GONE] }).saving.isDirty(ROOT)).toBe(true);
    expect(bench({ dirty: [ROOT] }).saving.isDirty(ROOT)).toBe(true);
  });
});

describe('сохранение с сопутствующими файлами', () => {
  const companions = { companions: true };

  it('по просьбе уезжают изменённые файлы каталога документа, и только его', async () => {
    const b = bench({ dirty: [CODE, NESTED_CODE, OTHER_FORM], companionsDir: 'form' });
    const result = await b.saving.save(ROOT, companions);
    expect(b.saved).toEqual([ROOT, PART, CODE, NESTED_CODE]);
    expect(result.saved).toEqual([ROOT, PART, CODE, NESTED_CODE]);
  });

  it('без просьбы документ сохраняется сам: плагин не решает за человека', async () => {
    const b = bench({ dirty: [CODE], companionsDir: 'form' });
    await b.saving.save(ROOT);
    expect(b.saved).toEqual([ROOT, PART]);
  });

  it('часть в каталоге сопутствующих пишется один раз', async () => {
    const b = bench({ dirty: [PART, CODE], companionsDir: 'form' });
    await b.saving.save(ROOT, companions);
    expect(b.saved).toEqual([ROOT, PART, CODE]);
  });

  it('документ в корне проекта не сохраняет весь проект', async () => {
    const b = bench({ dirty: [CODE, OTHER_FORM], companionsDir: '' });
    await b.saving.save(ROOT, companions);
    expect(b.saved).toEqual([ROOT, PART]);
  });

  it('документ без сопутствующих сохраняется как прежде', async () => {
    const b = bench({ dirty: [CODE], companionsDir: null });
    await b.saving.save(ROOT, companions);
    expect(b.saved).toEqual([ROOT, PART]);
  });

  it('звёздочка корня не зависит от сопутствующих', () => {
    expect(bench({ dirty: [CODE], companionsDir: 'form' }).saving.isDirty(ROOT)).toBe(false);
  });
});

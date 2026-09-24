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

function ok(id?: ResourceId): SaveResult {
  return { ok: true, saved: id === undefined ? [] : [id], conflicts: [], failures: [] };
}

function bench(options: { dirty?: readonly ResourceId[]; removed?: readonly ResourceId[] } = {}) {
  const saved: (ResourceId | 'all')[] = [];
  const reverted: ResourceId[] = [];
  const removedInSource: ResourceId[] = [];
  let pending = [...(options.removed ?? [])];
  const handle = {
    parts: () => [PART],
    removedParts: () => pending,
    forgetRemoved: (ids: readonly ResourceId[]) => {
      pending = pending.filter((id) => !ids.includes(id));
    },
  } as unknown as ModelDocumentHandle<unknown>;

  const saving = createDocumentSave({
    workspace: {
      save: async (id) => {
        saved.push(id ?? 'all');
        return ok(id);
      },
      isDirty: (id) => (options.dirty ?? []).includes(id as ResourceId),
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
  });
  return { saving, saved, reverted, removedInSource, pending: () => pending };
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

  it('корень изменён, пока изменена часть или часть ждёт удаления', () => {
    expect(bench().saving.isDirty(ROOT)).toBe(false);
    expect(bench({ dirty: [PART] }).saving.isDirty(ROOT)).toBe(true);
    expect(bench({ removed: [GONE] }).saving.isDirty(ROOT)).toBe(true);
    expect(bench({ dirty: [ROOT] }).saving.isDirty(ROOT)).toBe(true);
  });
});

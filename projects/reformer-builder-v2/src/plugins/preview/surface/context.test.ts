/**
 * Контекст поверхности: кэш схемы, оповещение о правке, проброс выделения и находок.
 *
 * @module plugins/preview/surface/context.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { createPreviewContext } from './context';
import type { PreviewDocument } from '../host';
import { createPreviewStore } from '../state/store';
import { fakeRef } from '../testing';

function document(initial: string) {
  let text = initial;
  const listeners = new Set<(value: string) => void>();
  const doc: PreviewDocument = {
    id: 'fake:form.json',
    ref: fakeRef('fake:form.json'),
    kind: 'text',
    getText: () => text,
    model: () => undefined,
    onDidChangeContent: (cb) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  };
  const write = (next: string): void => {
    text = next;
    for (const listener of [...listeners]) listener(next);
  };
  return { doc, write };
}

describe('createPreviewContext', () => {
  it('схема разбирается один раз и отдаётся той же ссылкой', () => {
    const { doc } = document(JSON.stringify(sampleSchema()));
    const ctx = createPreviewContext({ document: doc, store: createPreviewStore() });
    expect(ctx.schema()).toBe(ctx.schema());
  });

  it('правка буфера сбрасывает кэш и будит подписчиков', () => {
    const { doc, write } = document(JSON.stringify(sampleSchema()));
    const ctx = createPreviewContext({ document: doc, store: createPreviewStore() });
    const first = ctx.schema();
    let woken = 0;
    ctx.onDidChangeSchema(() => {
      woken += 1;
    });
    write(JSON.stringify({ ...sampleSchema(), version: '1.1' }));
    expect(woken).toBe(1);
    expect(ctx.schema()).not.toBe(first);
  });

  it('недописанный буфер даёт null, а не исключение', () => {
    const { doc, write } = document(JSON.stringify(sampleSchema()));
    const ctx = createPreviewContext({ document: doc, store: createPreviewStore() });
    write('{ "root": ');
    expect(ctx.schema()).toBeNull();
  });

  it('выделение и находки уходят в состояние документа', () => {
    const store = createPreviewStore();
    const { doc } = document('{}');
    const ctx = createPreviewContext({ document: doc, store });
    ctx.select(['a1b2c3d4']);
    ctx.report('preview.runtime', [{ file: '', phase: 'render', message: 'не собралось' }]);
    expect(store.get().selection).toEqual(['a1b2c3d4']);
    expect(store.get().problems).toHaveLength(1);
    expect(ctx.selection()).toEqual(['a1b2c3d4']);
  });

  it('освобождение снимает подписку на документ', () => {
    const { doc, write } = document(JSON.stringify(sampleSchema()));
    const ctx = createPreviewContext({ document: doc, store: createPreviewStore() });
    let woken = 0;
    ctx.onDidChangeSchema(() => {
      woken += 1;
    });
    ctx.dispose();
    write('{}');
    expect(woken).toBe(0);
  });
});

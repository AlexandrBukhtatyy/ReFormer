/**
 * Применимость превью к документу и добыча схемы из него.
 *
 * @module plugins/preview/document.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import type { DocumentRef } from '@/sdk';
import { isFormDocument, schemaOf } from './document';
import type { PreviewDocument } from './host';
import { fakeRef } from './testing';

function doc(kind: DocumentRef['kind'], mediaType: string): DocumentRef {
  return { id: 'fake:x', ref: fakeRef('fake:x', { mediaType }), kind };
}

function preview(text: string, model?: unknown): PreviewDocument {
  return {
    id: 'fake:form.json',
    ref: fakeRef('fake:form.json'),
    kind: model === undefined ? 'text' : 'model',
    getText: () => text,
    model: () => model,
    onDidChangeContent: () => ({ dispose: () => undefined }),
  };
}

describe('isFormDocument', () => {
  it('модельный документ берётся всегда: модель есть — значит провайдер его разобрал', () => {
    expect(isFormDocument(doc('model', 'text/markdown'))).toBe(true);
  });

  it('текстовый JSON берётся, пока композиция не подключила document.model', () => {
    expect(isFormDocument(doc('text', 'application/json'))).toBe(true);
  });

  it('прочий текст не берётся', () => {
    expect(isFormDocument(doc('text', 'text/typescript'))).toBe(false);
  });
});

describe('schemaOf', () => {
  it('модель предпочтительнее разбора: тот же объект, без второго прохода', () => {
    const model = sampleSchema();
    expect(schemaOf(preview('{}', model))).toBe(model);
  });

  it('текст разбирается, когда провайдера модели нет', () => {
    const schema = sampleSchema();
    expect(schemaOf(preview(JSON.stringify(schema)))).toEqual(schema);
  });

  it('недописанный JSON — это null, а не исключение', () => {
    expect(schemaOf(preview('{ "root": '))).toBeNull();
  });

  it('чужой JSON схемой не считается', () => {
    expect(schemaOf(preview('{"name":"пакет"}'))).toBeNull();
  });
});

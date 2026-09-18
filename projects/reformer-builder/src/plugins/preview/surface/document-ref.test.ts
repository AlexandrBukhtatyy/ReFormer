import { describe, expect, it } from 'vitest';
import { documentRefOf } from './document-ref';
import { fakeRef } from '../testing';

describe('documentRefOf', () => {
  it('провайдер модели доходит до адреса: по нему поверхность узнаёт свой стек', () => {
    const doc = documentRefOf({
      id: 'fake:form/form.json',
      ref: fakeRef('fake:form/form.json'),
      kind: 'model',
      providerId: 'form.schema',
    });

    expect(doc.providerId).toBe('form.schema');
    expect(doc.kind).toBe('model');
  });

  it('у текстового документа провайдера нет — и поле не появляется пустым', () => {
    const doc = documentRefOf({
      id: 'fake:notes.md',
      ref: fakeRef('fake:notes.md', { mediaType: 'text/markdown' }),
      kind: 'text',
    });

    expect('providerId' in doc).toBe(false);
  });
});

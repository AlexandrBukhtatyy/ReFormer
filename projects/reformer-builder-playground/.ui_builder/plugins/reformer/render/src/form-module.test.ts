import { describe, expect, it } from 'vitest';
import type { DocumentRef, ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import { FORM_SCHEMA_PROVIDER_ID } from '../../core/form-model';
import { createFormModuleLocator } from './form-module';

/** Адресная арифметика на строках — та, что делает платформа. */
const files = {
  parentOf: (id: ResourceId) =>
    (id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '') as ResourceId,
  resolve: (dir: ResourceId, ...segments: readonly string[]) =>
    [dir, ...segments].filter((part) => part !== '').join('/') as ResourceId,
};

const doc = (path: string, providerId: string | null = FORM_SCHEMA_PROVIDER_ID) =>
  ({
    id: path as ResourceId,
    ref: { id: path as ResourceId, path } as ResourceRef,
    kind: 'model',
    ...(providerId !== null ? { providerId } : {}),
  }) as DocumentRef;

describe('место модуля формы ReFormer', () => {
  const locator = createFormModuleLocator(() => files);

  it('отвечает раскладкой домена — для всех трёх раскладок', () => {
    expect(locator.moduleOf(doc('forms/loan/schema/form.schema.json'))).toBe('forms/loan');
    expect(locator.moduleOf(doc('forms/loan/form.schema.json'))).toBe('forms/loan');
    // Свободное имя: подкаталог по имени документа, а не каталог, где лежат модули других форм.
    expect(locator.moduleOf(doc('forms/credit.schema.json'))).toBe('forms/credit');
  });

  it('за чужой документ не берётся: .json бывает схемой любого стека', () => {
    expect(locator.moduleOf(doc('forms/credit.schema.json', 'rjsf.schema'))).toBeNull();
    expect(locator.moduleOf(doc('forms/credit.schema.json', null))).toBeNull();
  });

  it('без рабочей области не отвечает — документов нет', () => {
    expect(
      createFormModuleLocator(() => undefined).moduleOf(doc('forms/credit.schema.json'))
    ).toBeNull();
  });
});

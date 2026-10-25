/**
 * Контракт справки и манифест стека не расходятся.
 *
 * Возможность объявлена здесь копией (`./reference`), а требование к ней — в манифесте стека:
 * резолвер сверяет версии поставщиков именно по манифесту, а стек находит службу по
 * идентификатору копии. Поднятая старшая версия контракта без правки `requires` пустила бы
 * поставщиков прежней версии мимо резолвера, и разойтись этим двум местам молча нельзя.
 *
 * @module plugins/reformer/ai/reference.test
 */

import { describe, expect, it } from 'vitest';
import manifest from './manifest.json';
import { LibraryReferenceCapability } from './reference';

describe('LibraryReferenceCapability', () => {
  it('манифест стека требует справку той старшей версии, что объявляет контракт', () => {
    const requirement = manifest.requires.optional.find(
      (entry) => entry.id === LibraryReferenceCapability.id
    );
    const major = LibraryReferenceCapability.version.split('.')[0];
    expect(requirement?.range).toBe(`^${major}`);
  });

  it('стек справку только требует, но не обещает: слот оставлен поставщику', () => {
    // Объяви её стек в `provides` — резолвер видел бы двух поставщиков у первого же плагина
    // проекта со своей справкой.
    expect(JSON.stringify(manifest)).not.toContain('"provides"');
  });
});

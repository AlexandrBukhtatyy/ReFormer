import { describe, expect, it } from 'vitest';

import {
  describeCapabilityProblems,
  resolveCapabilities,
  type CapabilityPart,
} from './capability-resolver';

/** Провайдер китов — та же пара, что объявлена в карте состава. */
const kits: CapabilityPart = {
  id: 'kits',
  provides: [{ id: 'reformer.kit.catalog', version: '1.0.0' }],
};

const consumer = (range: string, kind: 'required' | 'optional' = 'required'): CapabilityPart => ({
  id: 'acme',
  requires: { [kind]: [{ id: 'reformer.kit.catalog', range }] },
});

describe('кто что даёт', () => {
  it('собирает объявления всех частей', () => {
    const result = resolveCapabilities({
      parts: [kits, { id: 'acme', provides: [{ id: 'acme.forms', version: '2.1.0' }] }],
    });

    expect(result.providers).toEqual([
      { id: 'reformer.kit.catalog', version: '1.0.0', by: 'kits' },
      { id: 'acme.forms', version: '2.1.0', by: 'acme' },
    ]);
  });

  it('состав без объявлений и требований разбирается пустым, а не отказом', () => {
    const result = resolveCapabilities({ parts: [{ id: 'files' }, { id: 'ai' }] });

    expect(result).toMatchObject({ providers: [], missing: [], conflicts: [], degraded: [] });
  });
});

describe('требования проверяются ДО загрузки кода', () => {
  it('выполненное обязательное требование не попадает никуда', () => {
    const result = resolveCapabilities({ parts: [kits, consumer('^1')] });

    expect(result.missing).toEqual([]);
    expect(result.degraded).toEqual([]);
  });

  it('невыполненное обязательное — в missing, вместе с тем, что есть на самом деле', () => {
    const result = resolveCapabilities({ parts: [kits, consumer('^2')] });

    expect(result.missing).toEqual([
      {
        by: 'acme',
        requirement: { id: 'reformer.kit.catalog', range: '^2' },
        available: [{ id: 'reformer.kit.catalog', version: '1.0.0', by: 'kits' }],
      },
    ]);
  });

  it('требование к тому, чего не даёт никто, отличимо от «версия не та»', () => {
    // Разница между «поставь новее» и «поставь вообще» — первое, что спрашивает человек.
    const result = resolveCapabilities({
      parts: [{ id: 'acme', requires: { required: [{ id: 'nobody.gives', range: '*' }] } }],
    });

    expect(result.missing[0].available).toEqual([]);
  });

  it('невыполненное НЕОБЯЗАТЕЛЬНОЕ — деградация, а не отказ', () => {
    const result = resolveCapabilities({ parts: [kits, consumer('^2', 'optional')] });

    expect(result.missing).toEqual([]);
    expect(result.degraded.map((item) => item.by)).toEqual(['acme']);
  });

  it('собственная возможность требование не удовлетворяет', () => {
    // Иначе плагин закрывал бы требование обещанием: провайдер он или нет, выяснится
    // только после activate.
    const result = resolveCapabilities({
      parts: [
        {
          id: 'acme',
          provides: [{ id: 'acme.forms', version: '1.0.0' }],
          requires: { required: [{ id: 'acme.forms', range: '^1' }] },
        },
      ],
    });

    expect(result.missing.map((item) => item.by)).toEqual(['acme']);
  });
});

describe('двое на одну возможность', () => {
  const twin: CapabilityPart = {
    id: 'kits-alt',
    provides: [{ id: 'reformer.kit.catalog', version: '1.4.0' }],
  };

  it('без выбора — конфликт, и провайдером не становится никто', () => {
    const result = resolveCapabilities({ parts: [kits, twin] });

    expect(result.conflicts).toEqual([
      {
        id: 'reformer.kit.catalog',
        providers: [
          { id: 'reformer.kit.catalog', version: '1.0.0', by: 'kits' },
          { id: 'reformer.kit.catalog', version: '1.4.0', by: 'kits-alt' },
        ],
      },
    ]);
    // «Возьмём любого» сделало бы состав зависимым от порядка карты.
    expect(result.providers).toEqual([]);
  });

  it('выбор снимает конфликт и отбрасывает остальных', () => {
    const result = resolveCapabilities({
      parts: [kits, twin],
      chosen: { 'reformer.kit.catalog': 'kits-alt' },
    });

    expect(result.conflicts).toEqual([]);
    expect(result.providers).toEqual([
      { id: 'reformer.kit.catalog', version: '1.4.0', by: 'kits-alt' },
    ]);
  });

  it('требование сверяется с ВЫБРАННЫМ провайдером, а не с любым подходящим', () => {
    // Отвергнутый провайдер подходил бы под `^1.4`, но его выбрали не тем — и требование
    // обязано остаться невыполненным, иначе выбор не значил бы ничего.
    const result = resolveCapabilities({
      parts: [
        kits,
        twin,
        { id: 'acme', requires: { required: [{ id: 'reformer.kit.catalog', range: '^1.4' }] } },
      ],
      chosen: { 'reformer.kit.catalog': 'kits' },
    });

    expect(result.missing.map((item) => item.by)).toEqual(['acme']);
  });

  it('выбор, называющий не объявлявшего, конфликт не снимает', () => {
    const result = resolveCapabilities({
      parts: [kits, twin],
      chosen: { 'reformer.kit.catalog': 'ai' },
    });

    expect(result.conflicts.map((item) => item.id)).toEqual(['reformer.kit.catalog']);
  });
});

describe('describeCapabilityProblems', () => {
  it('молчит, когда претензий нет', () => {
    expect(describeCapabilityProblems(resolveCapabilities({ parts: [kits, consumer('^1')] }))).toBe(
      ''
    );
  });

  it('называет и требование, и то, что есть', () => {
    const text = describeCapabilityProblems(resolveCapabilities({ parts: [kits, consumer('^2')] }));

    expect(text).toContain('«acme»');
    expect(text).toContain('«reformer.kit.catalog»');
    expect(text).toContain('^2');
    expect(text).toContain('1.0.0');
  });

  it('называет конфликтующих по именам', () => {
    const text = describeCapabilityProblems(
      resolveCapabilities({
        parts: [
          kits,
          { id: 'kits-alt', provides: [{ id: 'reformer.kit.catalog', version: '1.4.0' }] },
        ],
      })
    );

    expect(text).toContain('«kits»');
    expect(text).toContain('«kits-alt»');
  });

  it('деградация в текст отказа НЕ попадает', () => {
    // Она не «не соберётся», а «часть возможностей будет недоступна» — показывать её надо
    // иначе, и смешение двух списков сделало бы отказом то, что отказом не является.
    const text = describeCapabilityProblems(
      resolveCapabilities({ parts: [kits, consumer('^2', 'optional')] })
    );

    expect(text).toBe('');
  });
});

/**
 * Политика рендера: запрет проверяется до резолва, причина берётся у кита.
 *
 * @module plugins/preview/runtime/policy.test
 */

import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { KitDescriptor } from '@/lib/kits/types';
import { classifyEntry, isComponentLike, isRegistrable, resolveInfra } from './policy';

function entry(patch: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    name: 'Input',
    role: 'field',
    propsSchema: {},
    makeNode: () => ({ component: '$component(Input)' }) as never,
    ...patch,
  } as CatalogEntry;
}

function descriptor(patch: Partial<KitDescriptor> = {}): KitDescriptor {
  return {
    package: '@kit/test',
    previewPolicy: new Map(),
    unresolvedReason: new Map(),
    infra: { fieldWrapper: 'FormField', asyncBoundary: 'AsyncBoundary', list: 'List' },
    ...patch,
  } as KitDescriptor;
}

const Component = (): null => null;

describe('isRegistrable', () => {
  it('array-узлы и html-теги рендерятся мимо реестра', () => {
    expect(isRegistrable({ name: 'FormArray', role: 'array' })).toBe(false);
    expect(isRegistrable({ name: '$html(div)', role: 'container' })).toBe(false);
    expect(isRegistrable({ name: 'Input', role: 'field' })).toBe(true);
  });
});

describe('isComponentLike', () => {
  it('функция и forwardRef-подобный объект считаются компонентом', () => {
    expect(isComponentLike(Component)).toBe(true);
    expect(isComponentLike({ $$typeof: Symbol.for('react.forward_ref') })).toBe(true);
    expect(isComponentLike('Input')).toBe(false);
    expect(isComponentLike(null)).toBe(false);
  });
});

describe('classifyEntry', () => {
  it('нашёлся в namespace — рисуем вживую', () => {
    const decision = classifyEntry(entry(), { Input: Component }, descriptor());
    expect(decision).toEqual({ policy: 'live', component: Component });
  });

  it('запрет кита сильнее резолва: оверлей не рисуется, даже если он есть', () => {
    const kit = descriptor({
      previewPolicy: new Map([['Input', { mode: 'limited' as const, reason: 'оверлей' }]]),
    });
    expect(classifyEntry(entry(), { Input: Component }, kit)).toEqual({
      policy: 'limited',
      reason: 'оверлей',
    });
  });

  it('часть compound наследует запрет корня', () => {
    const kit = descriptor({
      previewPolicy: new Map([['Dialog', { mode: 'limited' as const, reason: 'нужен триггер' }]]),
    });
    const decision = classifyEntry(
      entry({ name: 'DialogTitle', compoundParent: 'Dialog' }),
      { DialogTitle: Component },
      kit
    );
    expect(decision).toEqual({ policy: 'limited', reason: 'нужен триггер' });
  });

  it('явный live у записи снимает унаследованный запрет', () => {
    const kit = descriptor({
      previewPolicy: new Map([
        ['Dialog', { mode: 'limited' as const }],
        ['DialogTitle', { mode: 'live' as const }],
      ]),
    });
    const decision = classifyEntry(
      entry({ name: 'DialogTitle', compoundParent: 'Dialog' }),
      { DialogTitle: Component },
      kit
    );
    expect(decision).toEqual({ policy: 'live', component: Component });
  });

  it('имя экспорта берётся из записи, а не угадывается', () => {
    const decision = classifyEntry(
      entry({ exportName: 'InputField' }),
      { InputField: Component },
      descriptor()
    );
    expect(decision).toEqual({ policy: 'live', component: Component });
  });

  it('не нашлось — причина кита, иначе общая с именем пакета', () => {
    const kit = descriptor({ unresolvedReason: new Map([['Table', 'лежит за subpath']]) });
    expect(classifyEntry(entry({ name: 'Table' }), {}, kit)).toEqual({
      policy: 'limited',
      reason: 'лежит за subpath',
    });
    expect(classifyEntry(entry(), {}, kit)).toEqual({
      policy: 'limited',
      reason: 'не резолвится в @kit/test',
    });
  });
});

describe('resolveInfra', () => {
  it('ключи реестра постоянны, значения приходят по именам дескриптора', () => {
    const kit = descriptor({
      infra: { fieldWrapper: 'Field', asyncBoundary: 'Suspense', list: 'Stack' },
    });
    expect(resolveInfra(kit, { Field: Component })).toEqual({
      FormField: Component,
      AsyncBoundary: undefined,
      List: undefined,
    });
  });
});

/**
 * Политика рендера: запрет проверяется до резолва, живой компонент — по факту наличия символа
 * в пространстве имён кита; подпуть записи заглушкой её не делает.
 *
 * @module plugins/reformer/render/runtime/policy.test
 */

import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../../../core/catalog';
import type { KitDescriptor } from '@reformer/builder-plugin-api';
import {
  classifyEntry,
  isComponentLike,
  isRegistrable,
  resolveInfra,
  unresolvedReason,
} from './policy';

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
    codegen: { importSpecifier: '@kit/test', needsShim: new Set<string>() },
    previewPolicy: new Map(),
    subpaths: new Map(),
    unresolvedReason: new Map(),
    infra: { fieldWrapper: 'FormField', asyncBoundary: 'AsyncBoundary', list: 'List' },
    ...patch,
  } as KitDescriptor;
}

const Component = (): null => null;

describe('isRegistrable', () => {
  it('array-узлы и html-теги рендерятся мимо реестра', () => {
    expect(isRegistrable({ name: 'FieldArray', role: 'array' })).toBe(false);
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
      entry({ name: 'Checkbox', exportName: 'CheckboxWithLabel' }),
      { Checkbox: () => null, CheckboxWithLabel: Component },
      descriptor()
    );
    expect(decision).toEqual({ policy: 'live', component: Component });
  });

  it('не нашлось — причина называет незагруженный подпуть, иначе общая с именем пакета', () => {
    const kit = descriptor({ subpaths: new Map([['Table', 'table']]) });
    expect(classifyEntry(entry({ name: 'Table' }), {}, kit)).toEqual({
      policy: 'limited',
      reason: 'лежит в @kit/test/table — этот подпуть в превью не загружен',
    });
    expect(classifyEntry(entry(), {}, kit)).toEqual({
      policy: 'limited',
      reason: 'не резолвится в @kit/test',
    });
  });

  it('подпуть заглушкой не делает: символ есть в namespace — компонент рисуется вживую', () => {
    // Отказ, который это удерживает: подпуть читался как «не резолвится», и объяви каталог его
    // комбобоксу, поле ушло бы в заглушку — хотя пространство имён встроенного кита собрано из
    // главного входа И полей с подпутей. Решает факт: символ в namespace есть.
    const kit = descriptor({
      subpaths: new Map([
        ['Combobox', 'combobox'],
        ['DatePicker', 'date-picker'],
      ]),
    });
    const namespace = { Combobox: Component, Input: Component };
    expect(classifyEntry(entry({ name: 'Combobox' }), namespace, kit)).toEqual({
      policy: 'live',
      component: Component,
    });
    // Тот же кит, тот же каталог, но этого подпутя в namespace не оказалось — заглушка с адресом.
    expect(classifyEntry(entry({ name: 'DatePicker' }), namespace, kit)).toEqual({
      policy: 'limited',
      reason: 'лежит в @kit/test/date-picker — этот подпуть в превью не загружен',
    });
  });

  it('запрет сильнее подпутя: оверлей за подпутём не рисуется, даже если символ загружен', () => {
    const kit = descriptor({
      subpaths: new Map([['Drawer', 'drawer']]),
      previewPolicy: new Map([['Drawer', { mode: 'limited' as const, reason: 'оверлей' }]]),
    });
    expect(classifyEntry(entry({ name: 'Drawer' }), { Drawer: Component }, kit)).toEqual({
      policy: 'limited',
      reason: 'оверлей',
    });
  });

  it('часть compound без своего подпутя объясняется подпутём корня', () => {
    const kit = descriptor({ subpaths: new Map([['Chart', 'chart']]) });
    expect(classifyEntry(entry({ name: 'ChartLegend', compoundParent: 'Chart' }), {}, kit)).toEqual(
      {
        policy: 'limited',
        reason: 'лежит в @kit/test/chart — этот подпуть в превью не загружен',
      }
    );
  });

  it('причину составляет спецификатор импорта кита, а не имя пакета', () => {
    // Кит вправе импортироваться не из корня пакета — адрес подпутя считается от спецификатора,
    // тем же правилом, каким кодоген печатает импорт.
    const kit = descriptor({
      codegen: { importSpecifier: '@kit/test/react', needsShim: new Set<string>() },
      subpaths: new Map([['Chart', 'chart']]),
    });
    expect(unresolvedReason(entry({ name: 'Chart' }), kit)).toBe(
      'лежит в @kit/test/react/chart — этот подпуть в превью не загружен'
    );
  });
});

describe('resolveInfra', () => {
  it('ключи реестра постоянны, значения приходят по именам дескриптора', () => {
    const kit = descriptor({
      infra: {
        fieldWrapper: 'Field',
        asyncBoundary: 'Suspense',
        list: 'Stack',
        fieldFrame: 'Frame',
      },
    });
    expect(resolveInfra(kit, { Field: Component })).toEqual({
      FormField: Component,
      AsyncBoundary: undefined,
      List: undefined,
    });
  });
});

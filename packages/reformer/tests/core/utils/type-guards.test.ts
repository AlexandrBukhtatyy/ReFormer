/**
 * Unit tests: гарды нод формы — isFormNode, isFormControl, isFormGroup, isFormArray.
 *
 * Гарды различают ноды по метке вида, а не по набору членов: объект с теми же методами, но без
 * метки, нодой не считается, а поле данных с именем члена ноды не путает гард группы.
 */

import { describe, it, expect } from 'vitest';
import { signal } from '@preact/signals-core';
import { FormControlNode } from '../../../src/form/nodes/form-control-node';
import { NODE_KIND } from '../../../src/form/nodes/node-kind';
import { isFormArray, isFormControl, isFormGroup, isFormNode } from '../../../src/form/type-guards';
import { ComponentInstance } from '../../test-utils/types';
import { arrayFromFields, formFromFields } from '../../test-utils/form-from-fields';

const control = () =>
  new FormControlNode({ valueSignal: signal('test'), component: null as ComponentInstance });

const group = () =>
  formFromFields({
    name: { value: '', component: null as ComponentInstance },
    email: { value: '', component: null as ComponentInstance },
  });

const array = () =>
  arrayFromFields({ name: { value: '', component: null as ComponentInstance } }, [{ name: 'a' }]);

describe('гарды нод формы', () => {
  it('isFormControl узнаёт только поле', () => {
    expect(isFormControl(control())).toBe(true);
    expect(isFormControl(group())).toBe(false);
    expect(isFormControl(array())).toBe(false);
  });

  it('isFormGroup узнаёт группу — её лицо с полями', () => {
    expect(isFormGroup(group())).toBe(true);
    expect(isFormGroup(control())).toBe(false);
    expect(isFormGroup(array())).toBe(false);
  });

  it('isFormArray узнаёт массив под-форм, строка массива — группа', () => {
    const rows = array();
    expect(isFormArray(rows)).toBe(true);
    expect(isFormArray(group())).toBe(false);
    expect(isFormArray(control())).toBe(false);
    expect(isFormGroup(rows.at(0))).toBe(true);
  });

  it('isFormNode узнаёт ноду любого вида', () => {
    expect(isFormNode(control())).toBe(true);
    expect(isFormNode(group())).toBe(true);
    expect(isFormNode(array())).toBe(true);
  });

  it('вложенные ноды: группа, поле в ней, массив и строка', () => {
    const form = formFromFields<{
      profile: { name: string };
      items: { title: string }[];
    }>({
      profile: { name: { value: '' } },
      items: [{ title: { value: '' } }],
    });

    expect(isFormGroup(form.profile)).toBe(true);
    expect(isFormControl(form.profile.name)).toBe(true);
    expect(isFormArray(form.items)).toBe(true);
    expect(isFormGroup(form.items.at(0))).toBe(true);
    expect(isFormControl(form.items.at(0)?.title)).toBe(true);
  });

  it('поле данных с именем члена ноды не путает гард группы', () => {
    const form = formFromFields<{ fields: string; items: string; push: string }>({
      fields: { value: '' },
      items: { value: '' },
      push: { value: '' },
    });

    expect(isFormGroup(form)).toBe(true);
    expect(isFormArray(form)).toBe(false);
    expect(isFormControl(form.fields)).toBe(true);
  });

  it('объект с членами ноды, но без метки, нодой не считается', () => {
    const lookalike = {
      value: signal(''),
      setValue: () => {},
      getValue: () => '',
      setIssues: () => {},
      componentProps: signal({}),
      updateComponentProps: () => {},
    };
    expect(isFormNode(lookalike)).toBe(false);
    expect(isFormControl(lookalike)).toBe(false);
  });

  it('метка общая для копий рантайма: Symbol.for', () => {
    const foreign = { [Symbol.for('@reformer/core/form-node-kind')]: 'control' };
    expect(NODE_KIND).toBe(Symbol.for('@reformer/core/form-node-kind'));
    expect(isFormControl(foreign)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['plain object', { value: 1 }],
    ['array', [1, 2]],
    ['string', 'field'],
    ['чужая метка', { [Symbol.for('@reformer/core/form-node-kind')]: 'other' }],
  ])('%s — не нода', (_label, value) => {
    expect(isFormNode(value)).toBe(false);
    expect(isFormControl(value)).toBe(false);
    expect(isFormGroup(value)).toBe(false);
    expect(isFormArray(value)).toBe(false);
  });

  it('сужение типа: union узлов', () => {
    const nodes: unknown[] = [control(), group(), array()];
    const kinds = nodes.map((node) => {
      if (isFormArray(node)) return `array:${node.length}`;
      if (isFormGroup(node)) return 'group';
      if (isFormControl(node)) return `control:${String(node.getValue())}`;
      return 'none';
    });
    expect(kinds).toEqual(['control:test', 'group', 'array:1']);
  });
});

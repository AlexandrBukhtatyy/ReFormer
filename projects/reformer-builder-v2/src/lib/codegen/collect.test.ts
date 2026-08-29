import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../form-model/__fixtures__/sample-schema';
import { plainSchema } from './__fixtures__/kit';
import { collect } from './collect';
import { synthMock } from '../form-mock';

function collectOf(schema = plainSchema()) {
  return collect(schema, synthMock(schema));
}

describe('collect', () => {
  it('строит дерево типов по видам контролов', () => {
    const c = collectOf();
    expect(c.root.fields.fullName).toEqual({ t: 'leaf', ts: 'string' });
    expect(c.root.fields.agreed).toEqual({ t: 'leaf', ts: 'boolean' });
  });

  it('собирает required только с верхнего уровня', () => {
    expect(collectOf().requiredPaths).toEqual(['fullName']);
  });

  it('вложенные пути становятся вложенными объектами', () => {
    const schema = plainSchema();
    (schema.root as { children: unknown[] }).children.push({
      value: '$model(contacts.phone)',
      component: '$component(Input)',
      componentProps: { label: 'Телефон' },
    });
    const contacts = collectOf(schema).root.fields.contacts;
    expect(contacts.t).toBe('obj');
    expect(contacts.t === 'obj' && contacts.fields.phone).toEqual({ t: 'leaf', ts: 'string' });
  });

  it('массив даёт тип элемента из item.$template, а сам путь — верхнеуровневый', () => {
    const schema = sampleSchema();
    const c = collect(schema, synthMock(schema));
    expect(c.arrayPaths).toEqual(['properties']);
    const properties = c.root.fields.properties;
    expect(properties.t).toBe('arr');
    expect(properties.t === 'arr' && properties.elem.t).toBe('obj');
  });

  it('select с известными опциями получает union строковых литералов', () => {
    const schema = sampleSchema();
    const mock = synthMock(schema);
    const c = collect(schema, mock);
    // Опции синтезированы моком по `$dataSource(LOAN_TYPES)`.
    expect(c.root.fields.loanType).toEqual({
      t: 'leaf',
      ts: "'option1' | 'option2' | 'option3'",
    });
  });

  it('поле type=number объявляется числом', () => {
    const schema = sampleSchema();
    const c = collect(schema, synthMock(schema));
    expect(c.root.fields.loanAmount).toEqual({ t: 'leaf', ts: 'number' });
  });
});

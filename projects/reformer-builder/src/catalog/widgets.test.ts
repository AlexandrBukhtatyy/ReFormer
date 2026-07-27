import { describe, expect, it } from 'vitest';
import { defaultPropSchemas, mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { toInspectorProps, inspectorGroups } from './widgets';

const inputProps = () => toInspectorProps(mergeFieldPropsSchema(defaultPropSchemas.Input));

describe('toInspectorProps', () => {
  it('виджет по x-doc.kind / выводу из типа', () => {
    const props = inputProps();
    const by = (k: string) => props.find((p) => p.key === k)!;
    expect(by('type').widget).toBe('enum');
    expect(by('type').options).toEqual(expect.arrayContaining(['text', 'number', 'date']));
    expect(by('min').widget).toBe('number');
    expect(by('placeholder').widget).toBe('text');
    expect(by('className').widget).toBe('className'); // override по ключу поверх x-doc.kind:'readonly'
    expect(by('required').widget).toBe('boolean'); // из wrapper, type: boolean
  });

  it('секции берутся из x-doc.group', () => {
    const props = inputProps();
    expect(props.find((p) => p.key === 'type')!.group).toBe('Textfield');
    expect(props.find((p) => p.key === 'min')!.group).toBe('Behavior');
  });

  it('x-runtimeProps (value/onChange) НЕ попадают в инспектор', () => {
    const keys = inputProps().map((p) => p.key);
    expect(keys).not.toContain('value');
    expect(keys).not.toContain('onChange');
  });

  it('человекочитаемые подписи', () => {
    const props = inputProps();
    expect(props.find((p) => p.key === 'className')!.label).toBe('Class Name');
    expect(props.find((p) => p.key === 'placeholder')!.label).toBe('Placeholder');
  });
});

describe('groupInspectorProps / inspectorGroups', () => {
  it('группирует и упорядочивает секции', () => {
    const groups = inspectorGroups(mergeFieldPropsSchema(defaultPropSchemas.Input));
    const order = groups.map((g) => g.group);
    // порядок из GROUP_ORDER: Control перед Textfield перед Behavior
    expect(order.indexOf('Control')).toBeLessThan(order.indexOf('Textfield'));
    expect(order.indexOf('Textfield')).toBeLessThan(order.indexOf('Behavior'));
    // каждая секция непустая
    expect(groups.every((g) => g.props.length > 0)).toBe(true);
  });
});

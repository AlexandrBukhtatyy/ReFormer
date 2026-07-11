/**
 * Regression tests for defect #32 (sub-issue 1).
 *
 * `component` в FieldConfig опционален (headless-ядро можно использовать без UI), но легаси-детекция
 * требовала одновременно `value` И `component`. Из-за этого headless-поле вида
 * `{ value, validators }` (без component) ошибочно классифицировалось как GroupConfig и
 * превращалось в GroupNode с `value`/`validators` в роли дочерних полей.
 */

import { describe, it, expect } from 'vitest';
import { NodeFactory } from '../../../src/form/factories/node-factory';
import { FieldNode } from '../../../src/form/nodes/field-node';
import { GroupNode } from '../../../src/form/nodes/group-node';

describe('NodeFactory.isFieldConfig — headless legacy fields (defect #32)', () => {
  const factory = new NodeFactory();

  it('распознаёт headless-поле { value, validators } без component как FieldConfig', () => {
    const config = { value: 0, validators: [] };
    expect(factory.isFieldConfig(config)).toBe(true);
    expect(factory.isGroupConfig(config)).toBe(false);
  });

  it('распознаёт другие headless-маркеры (updateOn / debounce / componentProps / asyncValidators)', () => {
    expect(factory.isFieldConfig({ value: '', updateOn: 'blur' })).toBe(true);
    expect(factory.isFieldConfig({ value: '', debounce: 300 })).toBe(true);
    expect(factory.isFieldConfig({ value: '', componentProps: {} })).toBe(true);
    expect(factory.isFieldConfig({ value: null, asyncValidators: [] })).toBe(true);
  });

  it('createNode строит FieldNode (а не ошибочный GroupNode) из headless-поля', () => {
    const node = factory.createNode({ value: 42, validators: [] });
    expect(node).toBeInstanceOf(FieldNode);
    expect(node).not.toBeInstanceOf(GroupNode);
    expect(node.value.value).toBe(42);
  });

  it('сохраняет прежнее поведение: голый { value } — не поле (неотличим от опечатки)', () => {
    expect(factory.isFieldConfig({ value: '' })).toBe(false);
    expect(factory.isGroupConfig({ value: '' })).toBe(true);
  });

  it('сохраняет прежнее поведение: { value, component } остаётся полем', () => {
    expect(factory.isFieldConfig({ value: '', component: null })).toBe(true);
  });

  it('не ломает M1-путь: { valueSignal } — поле', () => {
    // valueSignal-ветка независима от value/маркеров
    expect(factory.isFieldConfig({ valueSignal: { value: 'x' } })).toBe(true);
  });
});

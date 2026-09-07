/**
 * Сборка бандла рантайм-поверхности.
 *
 * Тест возможен в node потому, что сборка формы DOM не трогает: `createJsonForm` создаёт модель
 * и form-node'ы, а рисует их уже рендерер. Это же и делает проверку ценной — она ловит ровно
 * тот отказ, из-за которого в v1 форма рисовалась пустой: не собрались form-node'ы.
 *
 * @module plugins/preview/runtime/build.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, newNodeId } from '@/lib/form-model/node-id';
import { toDescriptor } from '@/lib/kits/descriptor';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { NODE_CLASS_PREFIX } from '../schema/node-token';
import { deepMerge } from '@/lib/form-fixture';
import { buildRuntimeBundle } from './build';

const DESCRIPTOR = toDescriptor({ version: '1.0', components: [] });

function bundleOf(schema: JsonFormSchema, extra: Record<string, unknown> = {}) {
  return buildRuntimeBundle({
    schema,
    catalog: [],
    descriptor: DESCRIPTOR,
    namespace: {},
    mock: null,
    ...extra,
  });
}

describe('buildRuntimeBundle', () => {
  it('собирает форму и модель по схеме', () => {
    const bundle = bundleOf(sampleSchema());
    expect(bundle.problems).toEqual([]);
    expect(bundle.form).not.toBeNull();
    expect(bundle.form?.model.get()).toMatchObject({ loanType: '', properties: [] });
  });

  it('в рендерер уходит АННОТИРОВАННАЯ копия, а исходная схема не тронута', () => {
    const schema = ensureNodeIds(sampleSchema(), newNodeId);
    const before = JSON.stringify(schema);
    const bundle = bundleOf(schema);
    expect(JSON.stringify(bundle.schema)).toContain(NODE_CLASS_PREFIX);
    expect(JSON.stringify(schema)).toBe(before);
  });

  it('значения model.ts перекрывают синтезированный мок', () => {
    const bundle = bundleOf(sampleSchema(), { initialOverride: { loanType: 'ипотека' } });
    expect(bundle.form?.model.get()).toMatchObject({ loanType: 'ипотека' });
  });

  it('введённые значения переносятся поверх мока и model.ts', () => {
    const bundle = bundleOf(sampleSchema(), {
      initialOverride: { loanType: 'ипотека' },
      carry: { loanType: 'автокредит' },
    });
    // Введённое человеком старше и мока, и объявленных начальных значений.
    expect(bundle.form?.model.get()).toMatchObject({ loanType: 'автокредит' });
  });

  it('перенос не создаёт путей, которых в схеме нет', () => {
    const bundle = bundleOf(sampleSchema(), { carry: { loanType: 'авто', сгинувшее: 'x' } });
    const model = bundle.form?.model.get() as Record<string, unknown>;
    expect(model).toMatchObject({ loanType: 'авто' });
    expect(Object.hasOwn(model, 'сгинувшее')).toBe(false);
  });

  it('битая схема — находка, а не исключение', () => {
    const bundle = bundleOf({ version: '1.0' } as unknown as JsonFormSchema);
    expect(bundle.form).toBeNull();
    expect(bundle.problems).toHaveLength(1);
  });
});

describe('deepMerge', () => {
  it('объекты сливаются вглубь, скаляры перекрываются', () => {
    expect(deepMerge({ a: { b: 1, c: 2 } }, { a: { c: 3 } })).toEqual({ a: { b: 1, c: 3 } });
  });
});

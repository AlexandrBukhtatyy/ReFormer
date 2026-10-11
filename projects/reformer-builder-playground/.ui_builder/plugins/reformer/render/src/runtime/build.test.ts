/**
 * Сборка бандла рантайм-поверхности.
 *
 * Тест возможен в node потому, что сборка формы DOM не трогает: `createForm` создаёт модель,
 * дерево узлов и form-node'ы, а рисует их уже рендерер. Это же и делает проверку ценной — она ловит ровно
 * тот отказ, из-за которого в v1 форма рисовалась пустой: не собрались form-node'ы.
 *
 * @module plugins/reformer/render/runtime/build.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../../../core/testing';
import { ensureNodeIds, newNodeId } from '../../../core/form-model';
import { toDescriptor } from '@reformer/builder-plugin-api';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { NODE_CLASS_PREFIX } from '../schema/node-token';
import { deepMerge } from '../../../core/form-fixture';
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

  it('форму собирает единая сборка: в бандле модель, ноды формы и дерево для рендерера', () => {
    const bundle = bundleOf(sampleSchema());
    expect(bundle.form?.form.getValue()).toMatchObject({ loanType: '' });
    expect(bundle.form?.render.tree).toBeDefined();
    // Шаги визарда — дети корня: дерево сборки строит их узлами, а не пропом.
    expect(bundle.form?.render.tree?.root).toBeDefined();
  });

  it('документ прежнего формата сборка не принимает — находка, а не пустая форма', () => {
    // На поверхность такой документ не попадает (его переводит `usePreviewSchema`), но если
    // попадёт, отказ обязан быть объяснён словами.
    const legacy = {
      version: '1.0',
      root: { component: '$component(Box)', children: [{ value: '$model(name)' }] },
    } as unknown as JsonFormSchema;
    const bundle = bundleOf(legacy);
    expect(bundle.form).toBeNull();
    expect(bundle.problems[0]?.message).toMatch(/migrateJsonSchema/);
  });

  it('правила узлов прежнего слоя применяются в setup сборки', () => {
    const seen: { form?: unknown; model?: unknown; hasNode?: boolean } = {};
    const bundle = bundleOf(sampleSchema(), {
      renderBehavior: (form: unknown, model: unknown) => {
        seen.form = form;
        seen.model = model;
        return (schema: { node?: unknown }) => {
          seen.hasNode = typeof schema.node === 'function';
        };
      },
    });
    expect(bundle.problems).toEqual([]);
    expect(seen.form).toBe(bundle.form?.form);
    expect(seen.model).toBe(bundle.form?.model);
    expect(seen.hasNode).toBe(true);
  });

  it('отказ прежнего слоя форму не роняет — он становится находкой', () => {
    const bundle = bundleOf(sampleSchema(), {
      renderBehavior: () => {
        throw new Error('старый слой сломан');
      },
    });
    expect(bundle.form).not.toBeNull();
    expect(bundle.problems).toEqual([
      { file: 'form.render.ts', phase: 'evaluate', message: 'старый слой сломан' },
    ]);
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

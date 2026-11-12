/**
 * Лестница сценариев в ассистенте конструктора (фаза 7 аудита, ReFormer-11oe.8): один верификатор и
 * одни контракты на оба канала.
 *
 * - загрузчик модуля конструктора: запись реестра форм (`FormEntry`) → те же части, что у модуля MCP;
 * - записи прогона лестницы годятся схеме записей и различают прогон без модели и живой;
 * - сравнение каналов сводит терминал и ассистента в ячейки одного сценария.
 */

import { describe, expect, it } from 'vitest';
import { loadRegistryEntry, REGISTRY_ENTRY_FILE } from '../eval/lib/form-runtime.mjs';
import { ladderRecords } from '../eval/records/import-builder.mjs';
import { compareBatches } from '../eval/records/compare.mjs';
import { collectSource } from '../eval/records/record.mjs';

const inline = (value: unknown) => ({ kind: 'inline', value });

/** Запись прогона в объёме, который трогает тест сравнения каналов. */
interface LadderRecord {
  readonly agent: Record<string, unknown>;
  readonly scenario: Record<string, unknown>;
  readonly [key: string]: unknown;
}

describe('loadRegistryEntry', () => {
  it('запись реестра форм → модель, схема, поведение, валидация, поток и правила', async () => {
    const formRules = () => undefined;
    const stepRules = () => undefined;
    const registry = { Input: 'Input' };
    const entry = {
      id: 'order',
      schema: inline({ format: 2, root: {} }),
      model: inline(() => ({ total: 0 })),
      // Поведение — фабрика настроек места монтирования: загрузчик зовёт её без них.
      behavior: inline((options: unknown) => ({ behaviorOf: options })),
      validation: inline({ rules: formRules, strategy: 'change' }),
      flow: inline({ steps: [{ id: 'one', rules: stepRules }] }),
      registry: inline(registry),
    };
    const files: string[] = [];
    const parts = await loadRegistryEntry(async (file: string) => {
      files.push(file);
      return { orderFormEntry: entry };
    });
    expect(files).toEqual([REGISTRY_ENTRY_FILE]);
    expect(parts.createFormModel()).toEqual({ total: 0 });
    expect(parts.formSchema).toEqual({ format: 2, root: {} });
    expect(parts.formBehavior).toEqual({ behaviorOf: {} });
    expect(parts.createRegistry()).toBe(registry);
    // Правила шагов и правила формы `{ rules }` — все схемы сразу.
    expect(parts.ruleSchemas).toEqual([stepRules, formRules]);
  });

  it('без записи FormEntry — исключение с именем файла', async () => {
    await expect(loadRegistryEntry(async () => ({ helper: () => 0 }))).rejects.toThrow(
      REGISTRY_ENTRY_FILE
    );
  });
});

/** Отчёт `verify.json` прогона лестницы. */
const report = (agent: string, model: string | null) => ({
  agent,
  model,
  results: [
    {
      id: 'L1-feedback',
      repeat: 1,
      level: 1,
      built: true,
      seconds: 3,
      tools: ['build_form'],
      verdict: 'pass',
      score: 1,
      gates: ['workspace.entry'],
      failedGates: [],
      checks: { 'workspace.entry': 'pass' },
    },
    {
      id: 'L1-feedback',
      repeat: 2,
      level: 1,
      built: false,
      seconds: 5,
      tools: ['build_form', 'build_form'],
      verdict: 'fail',
      score: 0,
      gates: ['builder.build'],
      failedGates: ['builder.build'],
      checks: { 'builder.build': ['fail', 'refused'] },
    },
  ],
});

const options = () => ({
  batchId: '20261112T000000Z-test',
  startedAt: new Date(),
  source: collectSource(),
});

describe('ladderRecords', () => {
  it('прогон без модели — builder-replay, повторы по сценарию', () => {
    const records = ladderRecords(report('replay', null), options());
    expect(records.map((record: { agent: { kind: string } }) => record.agent.kind)).toEqual([
      'builder-replay',
      'builder-replay',
    ]);
    expect(records.map((record: { repeat: unknown }) => record.repeat)).toEqual([
      { index: 1, of: 2 },
      { index: 2, of: 2 },
    ]);
    expect(records[1]).toMatchObject({
      harness: 'builder',
      verdict: 'fail',
      exitReason: 'error',
      approach: { id: 'bare' },
      scenario: { id: 'L1-feedback', target: 'renderer-json' },
    });
  });

  it('живая модель — builder-bridge с моделью', () => {
    const [record] = ladderRecords(report('builder', 'qwen3.5:4b'), options());
    expect(record.agent).toMatchObject({ kind: 'builder-bridge', model: 'qwen3.5:4b' });
  });
});

describe('сравнение каналов', () => {
  it('терминал и ассистент — ячейки одного сценария, канал и модель — оси сравнения', () => {
    const builder = ladderRecords(report('replay', null), options());
    const terminal = builder.map((record: LadderRecord) => ({
      ...record,
      harness: 'scenario',
      agent: { ...record.agent, kind: 'replay' },
      scenario: { ...record.scenario, target: 'renderer-react' },
      verdict: 'pass',
    }));
    const result = compareBatches(terminal, builder);
    expect(result.axes.map((axis: { name: string }) => axis.name)).toEqual(
      expect.arrayContaining(['канал', 'модель'])
    );
    expect(result.cells.map((cell: { key: string }) => cell.key)).toEqual(['L1-feedback | bare']);
    expect(result.cells[0].a.total).toBe(2);
    expect(result.cells[0].b.total).toBe(2);
  });
});

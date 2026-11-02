/**
 * Записи прогонов и их сравнение. Статистика проверяется на значениях, посчитанных независимо: это
 * измерительный прибор, а ошибка в нём выглядит как результат.
 */

import { describe, expect, it } from 'vitest';
import { compareBatches, renderComparison } from '../eval/records/compare.mjs';
import { createRecord, newBatchId, validateRecord } from '../eval/records/record.mjs';
import {
  fisherExact,
  median,
  passAtK,
  passPowerK,
  signTest,
  wilsonInterval,
} from '../eval/records/stats.mjs';

interface RecordOverrides {
  scenarioId?: string;
  verdict?: string;
  checks?: Record<string, unknown>;
  metrics?: unknown[];
  split?: string | null;
  harness?: string;
  index?: number;
}

function record(overrides: RecordOverrides = {}) {
  return createRecord({
    batchId: '20261102T120000Z-abcd',
    harness: overrides.harness ?? 'scenario',
    startedAt: '2026-11-02T12:00:00Z',
    durationMs: 1000,
    source: { gitSha: 'abc12345', branch: 'develop', dirty: false, dirtyDigest: null },
    server: { channel: 'node', version: '6.0.0', surfaceDigest: 's', buildDigest: 'b' },
    agent: { kind: 'ollama', model: 'qwen', auth: null, settings: {} },
    approach: { id: 'bare' },
    scenario: {
      id: overrides.scenarioId ?? 'L1-feedback',
      level: 1,
      target: 'core',
      split: overrides.split === undefined ? 'tuned' : overrides.split,
    },
    repeat: { index: overrides.index ?? 1, of: 1 },
    verdict: overrides.verdict ?? 'pass',
    gates: [],
    checks: overrides.checks ?? { 'static.tsc': 'pass' },
    metrics: overrides.metrics ?? [],
  });
}

describe('статистика', () => {
  it('интервал Уилсона совпадает с табличными значениями', () => {
    const [lowEmpty, highEmpty] = wilsonInterval(0, 5);
    expect(lowEmpty).toBe(0);
    expect(highEmpty).toBeCloseTo(0.4345, 3);
    const [lowHalf, highHalf] = wilsonInterval(5, 10);
    expect(lowHalf).toBeCloseTo(0.2366, 3);
    expect(highHalf).toBeCloseTo(0.7634, 3);
    expect(wilsonInterval(0, 0)).toEqual([0, 1]);
  });

  it('точный тест Фишера', () => {
    expect(fisherExact(0, 5, 5, 0)).toBeCloseTo(0.00794, 4);
    expect(fisherExact(3, 0, 0, 3)).toBeCloseTo(0.1, 6);
    expect(fisherExact(1, 9, 11, 3)).toBeCloseTo(0.00276, 4);
    expect(fisherExact(2, 2, 2, 2)).toBeCloseTo(1, 9);
  });

  it('pass@k и pass^k — несмещённые оценки без повторений', () => {
    expect(passAtK(1, 5, 3)).toBeCloseTo(0.6, 6);
    expect(passPowerK(4, 5, 3)).toBeCloseTo(0.4, 6);
    expect(passAtK(5, 5, 3)).toBe(1);
    expect(passPowerK(2, 5, 3)).toBe(0);
    expect(passAtK(1, 2, 3)).toBeNull();
  });

  it('знаковый тест и медиана', () => {
    expect(signTest(5, 0)).toBeCloseTo(0.0625, 6);
    expect(signTest(0, 0)).toBe(1);
    expect(signTest(3, 3)).toBe(1);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('запись прогона', () => {
  it('собранная запись проходит схему', () => {
    expect(validateRecord(record())).toEqual([]);
  });

  it('схема ловит пропущенное поле, неверный тип и неверный статус проверки', () => {
    const { verdict: _verdict, ...withoutVerdict } = record();
    expect(validateRecord(withoutVerdict).join()).toMatch(/verdict/);
    expect(validateRecord({ ...record(), durationMs: 'долго' }).join()).toMatch(/durationMs/);
    expect(validateRecord({ ...record(), verdict: 'maybe' }).join()).toMatch(/verdict/);
    expect(validateRecord(record({ checks: { broken: 1 } })).join()).toMatch(/broken/);
  });

  it('раздутая запись не проходит: в репозиторий кладётся сводка, а не сырьё', () => {
    const checks = Object.fromEntries(
      Array.from({ length: 400 }, (_, index) => [`check.${index}`, 'pass'])
    );
    expect(validateRecord(record({ checks })).join()).toMatch(/потолка/);
  });

  it('идентификаторы батчей не совпадают и начинаются со времени', () => {
    const now = new Date('2026-11-02T12:30:05.000Z');
    expect(newBatchId(now)).toMatch(/^20261102T123005Z-[0-9a-f]{4}$/);
    expect(newBatchId(now)).not.toBe(newBatchId(now));
  });
});

describe('сравнение прогонов', () => {
  const batch = (passed: number, total: number) =>
    Array.from({ length: total }, (_, index) =>
      record({ index: index + 1, verdict: index < passed ? 'pass' : 'fail' })
    );

  it('набор против себя — изменений нет', () => {
    const records = [record(), record({ scenarioId: 'L2', verdict: 'fail' })];
    const result = compareBatches(records, records);
    expect(result.regressions).toEqual([]);
    expect(renderComparison(result)).toMatch(/Изменений нет/);
  });

  it('значимое падение pass-rate — регрессия, незначимое — нет', () => {
    expect(compareBatches(batch(5, 5), batch(0, 5)).regressions).toHaveLength(1);
    expect(compareBatches(batch(3, 3), batch(2, 3)).regressions).toEqual([]);
  });

  it('прогоны invalid в статистику не входят', () => {
    const broken = [...batch(5, 5), record({ verdict: 'invalid' })];
    const result = compareBatches(batch(5, 5), broken);
    expect(result.regressions).toEqual([]);
    expect(result.cells[0].b.total).toBe(5);
    expect(result.cells[0].b.invalid).toBe(1);
  });

  it('детерминированный стенд: ухудшение метрики и переворот проверки — регрессии', () => {
    const before = record({
      harness: 'retrieval',
      checks: { 'task.a': 'pass' },
      metrics: [{ id: 'firstPassRate', value: 0.97, better: 'higher' }],
    });
    const after = record({
      harness: 'retrieval',
      checks: { 'task.a': 'partial' },
      metrics: [{ id: 'firstPassRate', value: 0.9, better: 'higher' }],
    });
    const { regressions } = compareBatches([before], [after]);
    expect(regressions.some((line: string) => line.includes('firstPassRate'))).toBe(true);
    expect(regressions.some((line: string) => line.includes('task.a pass → partial'))).toBe(true);
    expect(compareBatches([after], [before]).regressions).toEqual([]);
  });

  it('наборы на разных подходах сравниваются по сценариям, а не расходятся в разные ячейки', () => {
    const onApproach = (approach: string, verdict: string) => ({
      ...record({ verdict }),
      approach: { id: approach },
    });
    const bare = [
      onApproach('bare', 'fail'),
      onApproach('bare', 'fail'),
      onApproach('bare', 'fail'),
    ];
    const other = [
      onApproach('intent', 'pass'),
      onApproach('intent', 'pass'),
      onApproach('intent', 'pass'),
    ];
    const result = compareBatches(bare, other);
    expect(result.axes).toEqual([{ name: 'подход', from: 'bare', to: 'intent' }]);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].onlyIn).toBeUndefined();
    expect(result.improvedCells).toBe(1);
    expect(renderComparison(result)).toContain('Сравнивается подход: bare → intent.');
  });

  it('общий подход в обоих наборах остаётся осью ячейки', () => {
    const withApproach = (approach: string) => ({ ...record(), approach: { id: approach } });
    const result = compareBatches(
      [withApproach('bare'), withApproach('intent')],
      [withApproach('bare')]
    );
    expect(result.axes).toEqual([]);
    expect(result.cells).toHaveLength(2);
  });

  it('holdout виден только агрегатом и в регрессии не попадает', () => {
    const before = [record({ split: 'holdout', scenarioId: 'секретный' })];
    const after = [record({ split: 'holdout', scenarioId: 'секретный', verdict: 'fail' })];
    const result = compareBatches(before, after);
    expect(result.regressions).toEqual([]);
    expect(renderComparison(result)).not.toContain('секретный');
    expect(renderComparison(result)).toContain('split holdout');
    expect(renderComparison(result, { showHoldout: true })).toContain('секретный');
  });
});

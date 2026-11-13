/**
 * История метрик: точки батча, теги, файл по строке на точку. Это прибор — ошибка в агрегате
 * выглядит на графике как результат.
 */

import { describe, expect, it } from 'vitest';
import {
  addPoints,
  changedContracts,
  HISTORY_FORMAT,
  pointsFromRecords,
  serializeHistory,
  validateHistory,
} from '../eval/records/history.mjs';

interface RunOverrides {
  scenarioId?: string;
  target?: string;
  approach?: string;
  verdict?: string;
  score?: number;
  split?: string;
  contractDigest?: string | null;
  kind?: string;
  model?: string | null;
  dirty?: boolean;
  inputTokens?: number;
}

function run(overrides: RunOverrides = {}) {
  return {
    batchId: '20261113T010642Z-594a',
    harness: 'scenario',
    startedAt: '2026-11-13T01:10:00Z',
    durationMs: 120_000,
    source: { gitSha: 'abc12345', branch: 'develop', dirty: overrides.dirty ?? false },
    server: { version: '7.0.0', surfaceDigest: 's1', buildDigest: 'b1', knowledgeDigest: 'k1' },
    agent: {
      kind: overrides.kind ?? 'ollama',
      model: overrides.model === undefined ? 'qwen3.5:4b' : overrides.model,
    },
    approach: { id: overrides.approach ?? 'bare' },
    scenario: {
      id: overrides.scenarioId ?? 'L1-feedback',
      target: overrides.target ?? 'core',
      split: overrides.split ?? 'tuned',
      contractDigest:
        overrides.contractDigest === undefined ? 'aaaaaaaa11111111' : overrides.contractDigest,
    },
    verdict: overrides.verdict ?? 'pass',
    score: overrides.score ?? 1,
    checks: {},
    metrics: [{ id: 'process.mcpCalls', value: 4 }],
    usage: { turns: 10, inputTokens: overrides.inputTokens ?? 1000, outputTokens: 100 },
  };
}

describe('точки истории', () => {
  it('точка на серию: доля pass и счёт по настроечным ячейкам, holdout только агрегатом', () => {
    const points = pointsFromRecords([
      run({ verdict: 'pass', score: 1 }),
      run({ scenarioId: 'L2-profile', verdict: 'fail', score: 0.5 }),
      run({ scenarioId: 'L1-callback', split: 'holdout', verdict: 'pass' }),
      run({ scenarioId: 'L3-delivery', verdict: 'invalid', score: 0 }),
      run({ approach: 'code-mode', verdict: 'fail', score: 0.25 }),
    ]);
    expect(points).toHaveLength(2);
    const bare = points.find((point) => point.approach === 'bare');
    expect(bare).toMatchObject({
      date: '2026-11-13T01:06:42Z',
      runs: 4,
      invalid: 1,
      passed: 1,
      counted: 2,
      holdout: [1, 1],
    });
    expect(bare.metrics.passRate).toBe(0.5);
    expect(bare.metrics.score).toBe(0.75);
    expect(bare.metrics['process.mcpCalls']).toBe(4);
    expect(bare.metrics.minutes).toBe(2);
    expect(Object.keys(bare.cells)).toEqual(['L1-feedback.core', 'L2-profile.core']);
    expect(bare.cells['L1-feedback.core']).toEqual([1, 1, 1, 'aaaaaaaa']);
  });

  it('автотеги: replay — smoke, грязное дерево — dirty, восстановленный батч — reconstructed', () => {
    const [smoke] = pointsFromRecords([run({ kind: 'replay', model: null, dirty: true })], {
      reconstructed: true,
      tags: ['nightly'],
    });
    expect(smoke.agent).toBe('replay');
    expect(smoke.tags).toEqual(['dirty', 'nightly', 'reconstructed', 'smoke']);
  });

  it('у ячейки без контракта прибор неизвестен, а не другой', () => {
    const [known] = pointsFromRecords([run()]);
    const [unknown] = pointsFromRecords([run({ contractDigest: null })]);
    const [other] = pointsFromRecords([run({ contractDigest: 'bbbbbbbb22222222' })]);
    expect(unknown.cells['L1-feedback.core'][3]).toBeNull();
    expect(changedContracts(known, unknown)).toEqual([]);
    expect(changedContracts(known, other)).toEqual(['L1-feedback.core']);
  });

  it('повторный add заменяет точки батча и сохраняет свои теги, автотеги считает заново', () => {
    const history = { format: HISTORY_FORMAT, points: [], events: [] };
    addPoints(history, pointsFromRecords([run({ dirty: true })], { tags: ['code-mode-weak'] }));
    addPoints(history, pointsFromRecords([run({ dirty: false, inputTokens: 2000 })]));
    expect(history.points).toHaveLength(1);
    expect(history.points[0].tags).toEqual(['code-mode-weak']);
    expect(history.points[0].metrics.inputTokens).toBe(2000);
  });
});

describe('файл истории', () => {
  it('по строке на точку и событие, проходит проверку и читается обратно', () => {
    const history = {
      format: HISTORY_FORMAT,
      points: pointsFromRecords([run(), run({ approach: 'code-mode' })]),
      events: [
        {
          id: 'm-2026-11-13-1',
          date: '2026-11-13',
          kind: 'server',
          title: 'фикс',
          refs: ['ReFormer-ju84'],
          source: 'manual',
        },
      ],
    };
    const text = serializeHistory(history);
    expect(text.split('\n').filter((line) => line.startsWith('    {'))).toHaveLength(3);
    expect(validateHistory(JSON.parse(text))).toEqual([]);
    expect(serializeHistory(JSON.parse(text))).toBe(text);
  });

  it('проверка ловит повтор точки и неизвестный вид события', () => {
    const [point] = pointsFromRecords([run()]);
    const problems = validateHistory({
      format: HISTORY_FORMAT,
      points: [point, point],
      events: [{ id: 'x', date: '2026-11-13', kind: 'weather', title: 't' }],
    });
    expect(problems.join()).toMatch(/повторяется/);
    expect(problems.join()).toMatch(/вид weather/);
  });
});

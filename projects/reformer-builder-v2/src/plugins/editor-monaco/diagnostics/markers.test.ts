/**
 * Тесты раскладки диагностик по местам в тексте.
 *
 * @module plugins/editor-monaco/diagnostics/markers.test
 */

import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@/sdk';
import { hasNodeTargets, planMarkers } from './markers';
import { indexNodeRanges, type NodeLocation } from './node-ranges';

const NO_NODES: ReadonlyMap<string, NodeLocation> = new Map();

function diagnostic(target: Diagnostic['target'], code = 'schema.invalid'): Diagnostic {
  return { source: 'validator.schema', severity: 'error', code, target };
}

describe('hasNodeTargets', () => {
  it('отвечает «нет», когда узлами никто не адресуется: указатель строить незачем', () => {
    expect(hasNodeTargets([diagnostic({ kind: 'resource' })])).toBe(false);
  });

  it('отвечает «да» на первой же цели-узле', () => {
    expect(
      hasNodeTargets([diagnostic({ kind: 'resource' }), diagnostic({ kind: 'node', nodeId: 'x' })])
    ).toBe(true);
  });
});

describe('planMarkers', () => {
  it('пустой свод не даёт ни одного маркера', () => {
    expect(planMarkers([], 'что угодно', NO_NODES).markers).toEqual([]);
  });

  it('цель-диапазон переносится как есть', () => {
    const items = [diagnostic({ kind: 'range', range: { start: 2, end: 5 } })];
    expect(planMarkers(items, '0123456789', NO_NODES).markers[0].range).toEqual({
      start: 2,
      end: 5,
    });
  });

  it('диапазон зажимается в границы текста: буфер мог уехать вперёд диагностики', () => {
    const items = [diagnostic({ kind: 'range', range: { start: 100, end: 200 } })];
    expect(planMarkers(items, 'коротко', NO_NODES).markers[0].range).toEqual({
      start: 7,
      end: 7,
    });
  });

  it('перевёрнутый диапазон не роняет показ, а выправляется', () => {
    const items = [diagnostic({ kind: 'range', range: { start: 5, end: 1 } })];
    expect(planMarkers(items, '0123456789', NO_NODES).markers[0].range).toEqual({
      start: 5,
      end: 5,
    });
  });

  it('цель-узел переводится в место идентификатора', () => {
    const text = '{ "$nodeId": "aaaa0000", "component": "Input" }';
    const items = [diagnostic({ kind: 'node', nodeId: 'aaaa0000' })];
    const plan = planMarkers(items, text, indexNodeRanges(text));
    expect(text.slice(plan.markers[0].range.start, plan.markers[0].range.end)).toBe('"aaaa0000"');
  });

  it('узел, которого в тексте нет, попадает в нерешённые, а не теряется', () => {
    const items = [diagnostic({ kind: 'node', nodeId: 'missing0' })];
    const plan = planMarkers(items, '{}', NO_NODES);
    expect(plan.markers).toEqual([]);
    expect(plan.unresolved).toEqual(['missing0']);
  });

  it('проблема всего ресурса встаёт на первую строку, а не подчёркивает файл целиком', () => {
    const text = 'первая строка\nвторая строка';
    const plan = planMarkers([diagnostic({ kind: 'resource' })], text, NO_NODES);
    expect(plan.markers[0].range).toEqual({ start: 0, end: 13 });
  });

  it('несёт код и параметры, а не готовую фразу: переводит тот, кто рисует', () => {
    const items: Diagnostic[] = [
      {
        source: 'validator.schema',
        severity: 'warning',
        code: 'schema.unknown-component',
        params: { name: 'Inpt' },
        target: { kind: 'resource' },
      },
    ];
    const marker = planMarkers(items, 'x', NO_NODES).markers[0];
    expect(marker).toMatchObject({
      severity: 'warning',
      code: 'schema.unknown-component',
      params: { name: 'Inpt' },
      source: 'validator.schema',
    });
  });
});

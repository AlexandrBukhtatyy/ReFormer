/**
 * Тесты раскладки диагностик по местам в тексте.
 *
 * @module plugins/editor-monaco/diagnostics/markers.test
 */

import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@/sdk';
import { hasNodeTargets, planMarkers } from './markers';
import { indexNodeRanges, indexTextNodes, pathKey, type NodeLocation } from './node-ranges';

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

  it('узел без идентификатора в тексте находится по пути через запасной резолвер', () => {
    // Так выглядит форма из кодогена: идентификаторы выданы моделью, в файл ещё не записаны.
    const text =
      '{ "root": { "component": "$html(div)", "children": [{ "component": "$component(Inpit)" }] } }';
    const index = indexTextNodes(text);
    const paths = new Map([['child000', ['root', 'children', 0]]]);
    const items = [diagnostic({ kind: 'node', nodeId: 'child000' })];
    const plan = planMarkers(items, text, index.byId, (nodeId) => {
      const path = paths.get(nodeId);
      return path === undefined ? undefined : index.byPath.get(pathKey(path));
    });
    expect(plan.unresolved).toEqual([]);
    expect(text.slice(plan.markers[0].range.start, plan.markers[0].range.end)).toBe(
      '"$component(Inpit)"'
    );
  });

  it('идентификатор в тексте важнее запасного резолвера', () => {
    const text = '{ "$nodeId": "aaaa0000", "component": "Input" }';
    const items = [diagnostic({ kind: 'node', nodeId: 'aaaa0000' })];
    const fallback = (): NodeLocation => ({
      anchor: { start: 0, end: 1 },
      node: { start: 0, end: 1 },
    });
    const plan = planMarkers(items, text, indexNodeRanges(text), fallback);
    expect(text.slice(plan.markers[0].range.start, plan.markers[0].range.end)).toBe('"aaaa0000"');
  });

  it('резолвер, не знающий узла, оставляет его в нерешённых', () => {
    const items = [diagnostic({ kind: 'node', nodeId: 'unknown0' })];
    const plan = planMarkers(items, '{}', NO_NODES, () => undefined);
    expect(plan.markers).toEqual([]);
    expect(plan.unresolved).toEqual(['unknown0']);
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

describe('planMarkers: цель, суженная до свойства узла', () => {
  const TEXT = `{
  "root": {
    "$nodeId": "aaaa0000",
    "component": "$component(Inpit)",
    "componentProps": { "label": "Имя", "readOnly": true }
  }
}`;
  const at = (target: Diagnostic['target']): string => {
    const plan = planMarkers([diagnostic(target)], TEXT, indexNodeRanges(TEXT));
    return TEXT.slice(plan.markers[0].range.start, plan.markers[0].range.end);
  };

  it('подчёркивает имя свойства, а не идентификатор узла', () => {
    expect(at({ kind: 'node', nodeId: 'aaaa0000', within: ['componentProps', 'readOnly'] })).toBe(
      '"readOnly"'
    );
  });

  it('по просьбе подчёркивает значение: там, где виновато оно', () => {
    expect(at({ kind: 'node', nodeId: 'aaaa0000', within: ['component'], at: 'value' })).toBe(
      '"$component(Inpit)"'
    );
  });

  it('значение-поддерево не подчёркивается: это маркер на пол-файла', () => {
    expect(at({ kind: 'node', nodeId: 'aaaa0000', within: ['componentProps'], at: 'value' })).toBe(
      '"componentProps"'
    );
  });

  it('путь, которого в тексте нет, не теряет находку: подчёркивается узел', () => {
    expect(at({ kind: 'node', nodeId: 'aaaa0000', within: ['componentProps', 'readonly'] })).toBe(
      '"aaaa0000"'
    );
  });

  it('пустой путь — то же, что и его отсутствие', () => {
    expect(at({ kind: 'node', nodeId: 'aaaa0000', within: [] })).toBe('"aaaa0000"');
  });

  it('сужение работает и у узла, найденного запасным резолвером', () => {
    const text = '{ "root": { "component": "$html(div)", "componentProps": { "hint": 1 } } }';
    const index = indexTextNodes(text);
    const items = [
      diagnostic({ kind: 'node', nodeId: 'child000', within: ['componentProps', 'hint'] }),
    ];
    const plan = planMarkers(items, text, index.byId, () => index.byPath.get(pathKey(['root'])));
    expect(text.slice(plan.markers[0].range.start, plan.markers[0].range.end)).toBe('"hint"');
  });
});

describe('planMarkers: проблема приложенного файла', () => {
  it('маркера не получает: подчёркивать в этом тексте нечего', () => {
    const plan = planMarkers([diagnostic({ kind: 'attached' })], 'первая строка\nвторая', NO_NODES);
    expect(plan.markers).toEqual([]);
  });

  it('и в нерешённые не попадает: место не искали, его нет по природе находки', () => {
    const plan = planMarkers([diagnostic({ kind: 'attached' })], 'текст', NO_NODES);
    expect(plan.unresolved).toEqual([]);
  });

  it('соседние находки не теряются из-за неё', () => {
    const text = '{ "$nodeId": "aaaa0000", "component": "Input" }';
    const plan = planMarkers(
      [diagnostic({ kind: 'attached' }), diagnostic({ kind: 'node', nodeId: 'aaaa0000' })],
      text,
      indexNodeRanges(text)
    );
    expect(plan.markers).toHaveLength(1);
    expect(text.slice(plan.markers[0].range.start, plan.markers[0].range.end)).toBe('"aaaa0000"');
  });
});

/**
 * Находки в живой форме: контур по худшей находке узла, строки полосы, предел высоты.
 *
 * @module plugins/editor-schema/live/live-problems.test
 */

import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@/sdk';
import {
  liveProblemRows,
  MAX_LIVE_PROBLEMS,
  sameStrings,
  splitLiveProblems,
  worstByNode,
} from './live-problems';

const A = 'a1b2c3d4';
const B = 'b2c3d4e5';

function diagnostic(
  severity: Diagnostic['severity'],
  target: Diagnostic['target'],
  code = 'schema.invalid'
): Diagnostic {
  return { source: 'validator.schema', severity, code, target };
}

describe('worstByNode', () => {
  it('узел с ошибкой и предупреждением обводится как узел с ошибкой', () => {
    const severities = worstByNode([
      diagnostic('warning', { kind: 'node', nodeId: A }),
      diagnostic('error', { kind: 'node', nodeId: A }),
      diagnostic('info', { kind: 'node', nodeId: B }),
    ]);
    expect(severities.get(A)).toBe('error');
    expect(severities.get(B)).toBe('info');
  });

  it('находки без узла контура не получают: обводить нечего', () => {
    const severities = worstByNode([
      diagnostic('error', { kind: 'resource' }),
      diagnostic('error', { kind: 'range', range: { start: 0, end: 1 } }),
    ]);
    expect(severities.size).toBe(0);
  });

  it('чистая форма даёт одну и ту же пустую карту', () => {
    expect(worstByNode([])).toBe(worstByNode([]));
  });
});

describe('liveProblemRows', () => {
  const message = (code: string, params?: Record<string, unknown>): string =>
    `${code}${params === undefined ? '' : ` ${JSON.stringify(params)}`}`;

  it('свод идёт от строгих к мягким, порядок внутри строгости сохраняется', () => {
    const rows = liveProblemRows(
      [
        diagnostic('warning', { kind: 'resource' }, 'w1'),
        diagnostic('error', { kind: 'resource' }, 'e1'),
        diagnostic('warning', { kind: 'resource' }, 'w2'),
        diagnostic('info', { kind: 'resource' }, 'i1'),
      ],
      [],
      message
    );
    expect(rows.map((row) => row.text)).toEqual(['e1', 'w1', 'w2', 'i1']);
  });

  it('находки сборки идут после свода и считаются ошибками', () => {
    const rows = liveProblemRows(
      [diagnostic('warning', { kind: 'resource' }, 'w')],
      ['validation.ts: ожидалась «;»'],
      message
    );
    expect(rows.map((row) => [row.severity, row.text])).toEqual([
      ['warning', 'w'],
      ['error', 'validation.ts: ожидалась «;»'],
    ]);
  });

  it('текст переводится по коду с параметрами, а не берётся готовым', () => {
    const rows = liveProblemRows(
      [
        {
          source: 'validator.schema',
          severity: 'error',
          code: 'schema.unknown-component',
          params: { name: 'Inpit' },
          target: { kind: 'node', nodeId: A },
        },
      ],
      [],
      message
    );
    expect(rows[0].text).toBe('schema.unknown-component {"name":"Inpit"}');
  });

  it('ключи строк уникальны между сводом и сборкой', () => {
    const rows = liveProblemRows([diagnostic('error', { kind: 'resource' })], ['x'], message);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });
});

describe('splitLiveProblems', () => {
  it('показывает не больше предела, остальное — счётчиком', () => {
    const rows = liveProblemRows(
      Array.from({ length: MAX_LIVE_PROBLEMS + 3 }, (_, index) =>
        diagnostic('error', { kind: 'resource' }, `e${index}`)
      ),
      [],
      (code) => code
    );
    const split = splitLiveProblems(rows);
    expect(split.shown).toHaveLength(MAX_LIVE_PROBLEMS);
    expect(split.hidden).toBe(3);
  });

  it('в пределе счётчика нет', () => {
    const rows = liveProblemRows([diagnostic('error', { kind: 'resource' })], [], (code) => code);
    expect(splitLiveProblems(rows).hidden).toBe(0);
  });
});

describe('sameStrings', () => {
  it('одинаковый состав — тот же список, и перерисовывать нечего', () => {
    expect(sameStrings(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameStrings(['a'], ['a', 'b'])).toBe(false);
    expect(sameStrings(['a'], ['b'])).toBe(false);
  });
});

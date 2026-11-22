/**
 * Находки в живой форме: контур по худшей находке узла.
 *
 * @module plugins/reformer/editor/live/live-problems.test
 */

import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@reformer/builder-plugin-api';
import { worstByNode } from './live-problems';

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

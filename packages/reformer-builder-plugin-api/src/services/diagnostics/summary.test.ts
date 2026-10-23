import { describe, expect, it } from 'vitest';

import { summarizeDiagnostics } from './summary.js';
import type { Diagnostic, DiagnosticSeverity } from './types.js';

function at(severity: DiagnosticSeverity, code: string): Diagnostic {
  return {
    source: 'validator.schema',
    severity,
    code,
    target: { kind: 'node', nodeId: 'ab12cd34' },
  };
}

describe('summarizeDiagnostics: свод ресурса сжимается до того, что рисуется', () => {
  it('чистый ресурс — это null, а не «ноль ошибок»', () => {
    // Разница видна пользователю: у первого пометки нет вовсе, у второго был бы значок «0».
    expect(summarizeDiagnostics([])).toBeNull();
  });

  it('тон задаёт САМАЯ СТРОГАЯ находка, а не самая частая', () => {
    const summary = summarizeDiagnostics([
      at('warning', 'structure.tab-without-panel'),
      at('warning', 'structure.panel-without-tab'),
      at('error', 'schema.unknown-component'),
    ]);

    expect(summary?.worst).toBe('error');
  });

  it('счётчик считает всё, а не только ошибки', () => {
    const summary = summarizeDiagnostics([
      at('error', 'schema.unknown-component'),
      at('warning', 'structure.tab-without-panel'),
      at('info', 'schema.unknown-locale-key'),
    ]);

    expect(summary?.total).toBe(3);
    expect(summary?.counts).toEqual({ error: 1, warning: 1, info: 1 });
  });

  it('одни сообщения — тон сообщения', () => {
    expect(summarizeDiagnostics([at('info', 'a'), at('info', 'b')])?.worst).toBe('info');
  });
});

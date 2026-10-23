/**
 * Тесты правила пометки на файле: значок, тон и подсказка по своду находок.
 *
 * Свод ресурса считает SDK (`summarizeDiagnostics`), и его правила проверены там; список
 * находок показывает журнал (`base/journal`). Здесь — только то, что решает плагин файлов.
 *
 * @module plugins/base/files/diagnostics.test
 */

import { describe, expect, it } from 'vitest';

import type { Diagnostic, DiagnosticSeverity } from '@reformer/builder-plugin-api';
import { diagnosticDecoration } from './diagnostics';

function at(severity: DiagnosticSeverity, code: string, source = 'validator.schema'): Diagnostic {
  return { source, severity, code, target: { kind: 'node', nodeId: 'ab12cd34' } };
}

describe('пометка на файле', () => {
  it('файл без находок пометки не получает', () => {
    expect(diagnosticDecoration([])).toBeNull();
  });

  it('значок — число находок, тон — по худшей', () => {
    const decoration = diagnosticDecoration([
      at('warning', 'structure.tab-without-panel'),
      at('error', 'schema.unknown-component'),
    ]);

    expect(decoration).toMatchObject({ badge: '2', tone: 'danger' });
  });

  it('предупреждения без ошибок красным не красятся', () => {
    expect(diagnosticDecoration([at('warning', 'structure.tab-without-panel')])?.tone).toBe(
      'warning'
    );
  });

  it('счётчик уходит ПАРАМЕТРОМ подсказки, а не вклеивается в строку', () => {
    // Иначе перевод случился бы здесь, а не в момент показа, и смена локали оставила бы
    // на экране прежний язык.
    const decoration = diagnosticDecoration([at('error', 'a'), at('error', 'b')]);

    expect(decoration?.tooltipKey).toBe('tree.problems.error');
    expect(decoration?.tooltipParams).toEqual({ count: 2 });
  });
});

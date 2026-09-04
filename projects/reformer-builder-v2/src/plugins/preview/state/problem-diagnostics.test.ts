/**
 * Перевод находок сборки в диагностики: адрес, код, цель.
 *
 * @module plugins/preview/state/problem-diagnostics.test
 */

import { describe, expect, it } from 'vitest';
import type { PreviewProblem } from '../contract';
import {
  BUILD_DIAGNOSTICS_SOURCE,
  buildCode,
  groupByResource,
  problemResource,
  toDiagnostic,
} from './problem-diagnostics';

const DOC = 'fake:form/form.json';

describe('problemResource', () => {
  it('находка с файлом адресуется его ресурсом — чинить там', () => {
    const problem: PreviewProblem = {
      file: 'validation.ts',
      phase: 'transpile',
      message: 'x',
      resource: 'fake:form/validation.ts',
    };
    expect(problemResource(DOC, problem)).toBe('fake:form/validation.ts');
  });

  it('находка без ресурса относится к документу схемы — даже если файл назван', () => {
    // Имя без адреса — синтетическая точка входа или файл, которого среди сайдкаров нет:
    // адресовать нечем, и находка остаётся у документа, а не теряется.
    expect(problemResource(DOC, { file: '', phase: 'render', message: 'x' })).toBe(DOC);
    expect(
      problemResource(DOC, { file: '__preview-entry__.js', phase: 'evaluate', message: 'x' })
    ).toBe(DOC);
  });
});

describe('toDiagnostic', () => {
  it('код — по фазе, текст движка — параметром, источник — превью', () => {
    const diagnostic = toDiagnostic({ file: 'model.ts', phase: 'evaluate', message: 'бросил' });
    expect(diagnostic).toEqual({
      source: BUILD_DIAGNOSTICS_SOURCE,
      severity: 'error',
      code: 'build.evaluate',
      params: { file: 'model.ts', message: 'бросил' },
      target: { kind: 'resource' },
    });
  });

  it('место, названное движком, становится целью-диапазоном', () => {
    const diagnostic = toDiagnostic({
      file: 'validation.ts',
      phase: 'transpile',
      message: 'ожидалась «;»',
      range: { start: 40, end: 41 },
    });
    expect(diagnostic.target).toEqual({ kind: 'range', range: { start: 40, end: 41 } });
  });

  it('код читается словарём Host по ключу errors.build.<фаза>', () => {
    for (const phase of ['schema', 'resolve', 'transpile', 'evaluate', 'render'] as const) {
      expect(buildCode(phase)).toBe(`build.${phase}`);
    }
  });
});

describe('groupByResource', () => {
  it('раскладывает находки по адресам, сохраняя порядок внутри адреса', () => {
    const groups = groupByResource(DOC, [
      { file: 'validation.ts', phase: 'transpile', message: 'a', resource: 'r:validation.ts' },
      { file: '', phase: 'render', message: 'b' },
      { file: 'validation.ts', phase: 'evaluate', message: 'c', resource: 'r:validation.ts' },
    ]);
    expect([...groups.keys()]).toEqual(['r:validation.ts', DOC]);
    expect(groups.get('r:validation.ts')?.map((item) => item.params?.message)).toEqual(['a', 'c']);
    expect(groups.get(DOC)?.map((item) => item.code)).toEqual(['build.render']);
  });

  it('пустой список — пустая карта: снимать публикации решает тот, кто помнит прошлые', () => {
    expect(groupByResource(DOC, []).size).toBe(0);
  });
});

/**
 * Приборы контракта, добавленные после прогонов: агент подменил заданный стек, и контракт это
 * пропустил; межполевое правило автор вправе повесить на любое из его полей.
 */

import { describe, expect, it } from 'vitest';
import { summarize } from '../eval/verify/index.mjs';
import { runProbes } from '../eval/verify/probes.mjs';
import { stackProblem } from '../eval/verify/stack.mjs';

describe('стек формы по импортам', () => {
  const react = "import { FormRenderer } from '@reformer/renderer-react';";
  const json = "import { defineRegistry } from '@reformer/renderer-json';";
  const plain = "import { createForm } from '@reformer/core';";

  it('core не тянет рендерер, в том числе подпутём и динамически', () => {
    expect(stackProblem('core', [plain])).toBeNull();
    expect(stackProblem('core', [plain, react])).toContain('renderer-react');
    expect(stackProblem('core', ["import x from '@reformer/renderer-json/validate';"])).toContain(
      'renderer-json'
    );
    expect(stackProblem('core', ["const x = import('@reformer/renderer-react');"])).toContain(
      'renderer-react'
    );
  });

  it('упоминание пакета без импорта рендерером не считается', () => {
    expect(stackProblem('core', ['// форма без @reformer/renderer-react'])).toBeNull();
  });

  it('renderer-react обязан импортировать свой пакет и не брать чужой', () => {
    expect(stackProblem('renderer-react', [react])).toBeNull();
    expect(stackProblem('renderer-react', [plain])).toContain('нет импорта');
    expect(stackProblem('renderer-react', [react, json])).toContain('renderer-json');
  });

  it('renderer-json рисуется компонентом из renderer-react, это не чужой стек', () => {
    expect(stackProblem('renderer-json', [json, react])).toBeNull();
    expect(stackProblem('renderer-json', [react])).toContain('нет импорта');
  });

  it('стек — гейт, а пропущенная проверка у эталона на core гейтом не считается', () => {
    const passed = {
      'workspace.entry': 'pass',
      'static.tsc': 'pass',
      'runtime.load': 'pass',
      'runtime.structure.fields': 'pass',
    };
    expect(summarize({}, passed).verdict).toBe('pass');
    expect(summarize({}, { ...passed, 'static.stack': 'skip' }).verdict).toBe('pass');
    const wrong = summarize({}, { ...passed, 'static.stack': ['fail', 'чужой стек'] });
    expect(wrong.verdict).toBe('fail');
    expect(wrong.failedGates).toEqual(['static.stack']);
  });
});

describe('проба anyInvalid', () => {
  const instanceWithIssues = (paths: string[]) => async () => ({
    model: {},
    validate: async () => false,
    form: {
      first: { issues: { value: paths.includes('first') ? [{ code: 'x' }] : [] } },
      second: { issues: { value: paths.includes('second') ? [{ code: 'x' }] : [] } },
    },
  });
  const contract = { probes: [{ id: 'rule', expect: { anyInvalid: ['first', 'second'] } }] };

  it('замечание на любом из полей правила — проба пройдена', async () => {
    for (const path of ['first', 'second']) {
      const checks = await runProbes({
        contract,
        bound: {},
        createInstance: instanceWithIssues([path]),
      });
      expect(checks['runtime.probe.rule'], path).toBe('pass');
    }
  });

  it('замечания нет нигде — проба падает и называет поля', async () => {
    const checks = await runProbes({ contract, bound: {}, createInstance: instanceWithIssues([]) });
    expect(checks['runtime.probe.rule'][0]).toBe('fail');
    expect(checks['runtime.probe.rule'][1]).toContain('first, second');
  });
});

/**
 * Логика стендов качества, которую можно проверить без сети и модели: гейт калибровки, импорт
 * результатов конструктора, каталог сценариев, привязка и пробы верификатора, изоляция агента.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initProblems } from '../eval/agents/claude-code.mjs';
import { findTextualCall } from '../eval/agents/textual-call.mjs';
import { resolveInside, runWorkspaceTool } from '../eval/agents/workspace-tools.mjs';
import { compareCalibration } from '../eval/calibration/compare.mjs';
import { builderRecords } from '../eval/records/import-builder.mjs';
import { calibrationMetrics } from '../eval/records/adapters.mjs';
import { validateRecord } from '../eval/records/record.mjs';
import { renderReportHtml } from '../eval/records/report-html.mjs';
import { loadScenarios, matchesPattern } from '../eval/scenarios/catalog.mjs';
import { summarize } from '../eval/verify/index.mjs';
import { bindFields, checkStructure, modelPaths, runProbes } from '../eval/verify/probes.mjs';

describe('гейт калибровки', () => {
  const baseline = {
    smoke: { pass: 55, fail: [], info: 1 },
    t1: { credit: { validation: '103/191', fieldsExtra: 0, unparsed: 5 } },
    t2: [{ run: 'credit/golden/core', tscErrors: 0, warnings: 3 }],
    t3: { 'iter-core': '107/145' },
    t6: { choose_api: { keyInBudget: '100%', medianChars: 900 } },
  };

  it('те же метрики — без замечаний', () => {
    expect(compareCalibration(baseline, baseline)).toEqual({
      regressions: [],
      improvements: [],
      incomparable: [],
    });
  });

  it('падение дроби, рост ошибок и новое падение smoke — регрессии', () => {
    const current = structuredClone(baseline);
    current.t1.credit.validation = '100/191';
    current.t2[0].tscErrors = 2;
    (current.smoke.fail as string[]).push('S04/node');
    current.t6.choose_api.keyInBudget = '90%';
    const { regressions } = compareCalibration(current, baseline);
    expect(regressions.join('\n')).toContain('t1.credit.validation');
    expect(regressions.join('\n')).toContain('credit/golden/core.tscErrors');
    expect(regressions.join('\n')).toContain('S04/node');
    expect(regressions.join('\n')).toContain('keyInBudget');
  });

  it('другой знаменатель не сравнивается, но называется', () => {
    const current = structuredClone(baseline);
    current.t1.credit.validation = '90/150';
    const { regressions, incomparable } = compareCalibration(current, baseline);
    expect(regressions).toEqual([]);
    expect(incomparable.join()).toContain('t1.credit.validation');
  });

  it('прогон без T3 за отсутствие трека не наказывается', () => {
    const { t3: _t3, ...withoutT3 } = baseline;
    expect(compareCalibration(withoutT3, baseline).regressions).toEqual([]);
  });

  it('метрики записи: дроби и суммы ошибок, нулевой знаменатель отбрасывается', () => {
    const metrics = calibrationMetrics({
      t1: { credit: { fields: '75/75', arrays: '0/0' } },
      t2: [{ tscErrors: 1 }, { tscErrors: 2 }],
    });
    expect(metrics).toContainEqual({
      id: 't1.credit.fields',
      hit: 75,
      total: 75,
      better: 'higher',
    });
    expect(metrics).toContainEqual({ id: 't2.tscErrors', value: 3, better: 'lower' });
    expect(metrics.some((metric: { id: string }) => metric.id === 't1.credit.arrays')).toBe(false);
  });
});

describe('импорт результатов конструктора', () => {
  const report = {
    model: 'qwen3.8:27b-32k',
    results: [
      {
        id: '1.1',
        pass: true,
        reason: null,
        tools: ['create_form', 'insert_node'],
        failedTools: 1,
        seconds: 42,
        inputTokens: 1000,
        outputTokens: 200,
        timedOut: false,
        error: null,
      },
      {
        id: '5.3',
        pass: false,
        reason: 'нет шага',
        tools: [],
        failedTools: 0,
        seconds: 1500,
        timedOut: true,
        error: null,
      },
    ],
  };
  const records = builderRecords(report, {
    batchId: '20261102T000000Z-aaaa',
    startedAt: new Date('2026-11-02T00:00:00Z'),
    source: { gitSha: 'abc', branch: 'develop', dirty: false, dirtyDigest: null },
    reasoning: 'off',
  });

  it('записи проходят схему и помечены как импортированные', () => {
    for (const record of records) expect(validateRecord(record)).toEqual([]);
    expect(records[0].source.provenance).toBe('imported');
    expect(records[0].approach.id).toBe('structured-off');
  });

  it('переносит вердикт, причину и завершение по таймауту', () => {
    expect(records[0].verdict).toBe('pass');
    expect(records[1].verdict).toBe('fail');
    expect(records[1].checks['scenario.check']).toEqual(['fail', 'нет шага']);
    expect(records[1].exitReason).toBe('timeout');
  });

  it('сводка показывает holdout только агрегатом', () => {
    const html = renderReportHtml(records);
    expect(html).toContain('<title>Прогоны MCP</title>');
    expect(html).toContain('qwen3.8:27b-32k');
    const holdout = {
      ...records[0],
      runId: 'hold',
      scenario: { ...records[0].scenario, id: 'скрытый-сценарий', split: 'holdout' },
    };
    const withHoldout = renderReportHtml([...records, holdout]);
    expect(withHoldout).not.toContain('скрытый-сценарий');
    expect(withHoldout).toContain('Holdout');
  });
});

describe('каталог сценариев', () => {
  it('каждый сценарий ссылается на существующие задание и контракт, у контракта есть гейт', () => {
    const scenarios = loadScenarios({ includeHoldout: true });
    expect(scenarios.length).toBeGreaterThanOrEqual(12);
    for (const scenario of scenarios) {
      expect(scenario.level, scenario.id).toBeGreaterThanOrEqual(1);
      expect(scenario.targets.length, scenario.id).toBeGreaterThan(0);
    }
  });

  it('holdout без явной просьбы не берётся', () => {
    const ids = (includeHoldout: boolean) =>
      loadScenarios({ includeHoldout }).map((scenario: { id: string }) => scenario.id);
    expect(ids(true)).toContain('L5-insurance');
    expect(ids(false)).not.toContain('L5-insurance');
  });

  it('шаблон идентификаторов: звёздочка и список', () => {
    expect(matchesPattern('L3-delivery', 'L3-*')).toBe(true);
    expect(matchesPattern('L3-delivery', 'L1-*,L3-delivery')).toBe(true);
    expect(matchesPattern('L3-delivery', 'L3')).toBe(false);
  });
});

describe('вердикт верификатора', () => {
  const passedBase = {
    'workspace.entry': 'pass',
    'static.tsc': 'pass',
    'runtime.load': 'pass',
    'runtime.structure.fields': 'pass',
  };
  const contract = { probes: [{ id: 'gate', gate: true }, { id: 'score-only' }] };

  it('упавшая проба без gate снижает счёт, но не вердикт; упавший гейт роняет вердикт', () => {
    const withScoreOnly = summarize(contract, {
      ...passedBase,
      'runtime.probe.gate': 'pass',
      'runtime.probe.score-only': ['fail', 'x'],
    });
    expect(withScoreOnly.verdict).toBe('pass');
    expect(withScoreOnly.score).toBeLessThan(1);
    const withGate = summarize(contract, { ...passedBase, 'runtime.probe.gate': ['fail', 'x'] });
    expect(withGate.verdict).toBe('fail');
    expect(withGate.failedGates).toEqual(['runtime.probe.gate']);
  });

  it('пропущенная браузерная проверка не роняет вердикт, упавшая — роняет', () => {
    const checks = { ...passedBase, 'runtime.probe.gate': 'pass', 'browser.render': 'pass' };
    expect(summarize(contract, { ...checks, 'browser.aria': 'skip' }).verdict).toBe('pass');
    expect(summarize(contract, { ...checks, 'browser.aria': ['fail', 'x'] }).verdict).toBe('fail');
  });
});

describe('верификатор: привязка и пробы', () => {
  const contract = {
    fields: [
      { id: 'total', bind: { path: 'total' }, type: 'number' },
      { id: 'title', bind: { paths: ['title', 'name'], label: '/назван/i' }, type: 'string' },
      { id: 'note', bind: { label: '/заметк/i' } },
    ],
    sample: { total: 5 },
    probes: [
      { id: 'values', set: { title: 'x' }, expect: { values: { total: 5, title: 'x' } } },
      { id: 'wrong', expect: { values: { total: 6 } } },
      { id: 'invalid', expect: { valid: false, invalid: ['total'] } },
      { id: 'browser-only', where: 'browser', expect: { hidden: ['total'] } },
      { id: 'throws', set: { 'missing.path': 1 }, expect: { valid: true } },
    ],
  };
  const paths = modelPaths({ total: 0, name: '', notes: '', rows: [{ cell: 1 }] });

  it('modelPaths: листья, массивы и поля строк', () => {
    expect(paths.get('rows').kind).toBe('array');
    expect(paths.has('rows.cell')).toBe(true);
    expect(paths.get('total').kind).toBe('leaf');
  });

  it('поле находится по пути, затем по кандидатам, затем по подписи схемы', () => {
    const bound = bindFields(contract, paths, [{ label: 'Заметки', path: 'notes' }]);
    expect(bound).toEqual({ total: 'total', title: 'name', note: 'notes' });
    expect(bindFields(contract, paths, []).note).toBeNull();
  });

  it('структура называет ненайденные поля и не тот тип', () => {
    const checks = checkStructure(
      contract,
      paths,
      { total: 'total', title: 'name', note: null },
      []
    );
    expect(checks['runtime.structure.fields'][1]).toContain('note');
    const wrongType = checkStructure(
      contract,
      modelPaths({ total: 'строка', name: '' }),
      { total: 'total', title: 'name', note: 'name' },
      []
    );
    expect(wrongType['runtime.structure.types'][1]).toContain('total');
  });

  it('пробы судят результат, а исключение и браузерная проба не роняют прогон', async () => {
    const createInstance = async () => {
      const model = { total: 0, name: '' };
      return {
        model,
        form: { total: { issues: { value: [{ code: 'min' }] } } },
        validate: async () => false,
      };
    };
    const bound = { total: 'total', title: 'name', note: 'notes' };
    const checks = await runProbes({ contract, bound, createInstance });
    expect(checks['runtime.probe.values']).toBe('pass');
    expect(checks['runtime.probe.wrong'][0]).toBe('fail');
    expect(checks['runtime.probe.invalid']).toBe('pass');
    expect(checks['runtime.probe.browser-only']).toBeUndefined();
    expect(checks['runtime.probe.throws'][1]).toMatch(/исключение/);
  });
});

describe('изоляция агентов', () => {
  const workspaceDirectory = resolve(tmpdir(), 'reformer-mcp-runs', 'run');
  const goodInit = {
    cwd: workspaceDirectory,
    tools: ['Read', 'Write', 'mcp__reformer__plan_form'],
    mcp_servers: [{ name: 'reformer', status: 'connected' }],
  };

  it('чистый запуск без проблем', () => {
    expect(initProblems(goodInit, { workspaceDirectory })).toEqual([]);
  });

  it('Bash, чужой сервер, отключённый сервер и каталог репозитория — нарушения', () => {
    const problems = (init: object) =>
      initProblems({ ...goodInit, ...init }, { workspaceDirectory }).join('; ');
    expect(problems({ tools: ['Bash'] })).toContain('Bash');
    expect(
      problems({ mcp_servers: [...goodInit.mcp_servers, { name: 'github', status: 'connected' }] })
    ).toContain('github');
    expect(problems({ mcp_servers: [{ name: 'reformer', status: 'failed' }] })).toContain('failed');
    expect(problems({ cwd: process.cwd() })).toContain('внутри репозитория');
  });

  let directory: string | undefined;
  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('файловые инструменты не выходят за рабочий каталог', () => {
    directory = mkdtempSync(join(tmpdir(), 'reformer-tools-'));
    writeFileSync(join(directory, 'a.txt'), 'текст');
    expect(() => resolveInside(directory as string, '../outside.txt')).toThrow(/вне рабочего/);
    expect(runWorkspaceTool(directory, 'read_file', { path: 'a.txt' })).toEqual({
      ok: true,
      text: 'текст',
    });
    expect(runWorkspaceTool(directory, 'read_file', { path: '../../etc' }).ok).toBe(false);
    expect(runWorkspaceTool(directory, 'write_file', { path: 'form/x.ts', content: '1' }).ok).toBe(
      true
    );
    expect(runWorkspaceTool(directory, 'list_files', {}).text).toContain('form/x.ts');
  });

  it('вызов текстом находится только у известных инструментов', () => {
    const tools = ['write_file', 'plan_form'];
    expect(findTextualCall('call:write_file{path:"a"}', tools)).toBe('write_file');
    expect(findTextualCall('{"name": "plan_form", "arguments": {}}', tools)).toBe('plan_form');
    expect(findTextualCall('plan_form({ description: "x" })', tools)).toBe('plan_form');
    expect(findTextualCall('Я вызвал plan_form, всё готово', tools)).toBeNull();
    expect(findTextualCall('other_tool({ a: 1 })', tools)).toBeNull();
  });
});

describe('импорт прогона ассистента с build_form', () => {
  const report = {
    model: 'qwen3.8:27b-32k',
    buildForm: true,
    results: [
      {
        id: 'B.1',
        pass: true,
        reason: null,
        tools: ['create_form', 'build_form'],
        failedTools: 0,
        seconds: 90,
        timedOut: false,
        error: null,
        requests: 3,
        inputTokens: 2_000_000,
        outputTokens: 100_000,
        coverage: { fields: [24, 25], rules: [8, 9] },
      },
    ],
  };
  const [record] = builderRecords(report, {
    batchId: '20261103T000000Z-bbbb',
    startedAt: new Date('2026-11-03T00:00:00Z'),
    source: { gitSha: 'abc', branch: 'develop', dirty: false, dirtyDigest: null },
    price: { input: 3, output: 15 },
  });

  it('подход отличает эксперимент от базы, покрытие и запросы — метриками', () => {
    expect(validateRecord(record)).toEqual([]);
    expect(record.approach.id).toBe('structured-default-build-form');
    expect(record.metrics).toEqual(
      expect.arrayContaining([
        { id: 'process.requests', value: 3, better: 'lower' },
        { id: 'quality.fields', hit: 24, total: 25, better: 'higher' },
        { id: 'quality.rules', hit: 8, total: 9, better: 'higher' },
      ])
    );
  });

  it('цена — по тарифу за миллион токенов', () => {
    expect(record.usage.costUsd).toBeCloseTo(2 * 3 + 0.1 * 15);
  });
});

/**
 * Логика стендов качества, которую можно проверить без сети и модели: гейт калибровки, импорт
 * результатов конструктора, каталог сценариев, привязка и пробы верификатора, изоляция агента.
 */

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initProblems, missingFlags } from '../eval/agents/claude-code.mjs';
import {
  capResponse,
  KEEP_WHOLE_TOOLS,
  responseCap,
  truncateOldResults,
} from '../eval/agents/ollama.mjs';
import { findTextualCall } from '../eval/agents/textual-call.mjs';
import { resolveInside, runWorkspaceTool } from '../eval/agents/workspace-tools.mjs';
import { compareCalibration } from '../eval/calibration/compare.mjs';
import { builderRecords } from '../eval/records/import-builder.mjs';
import { calibrationMetrics } from '../eval/records/adapters.mjs';
import { pointsFromRecords } from '../eval/records/history.mjs';
import { validateRecord } from '../eval/records/record.mjs';
import { renderReportHtml } from '../eval/records/report-html.mjs';
import { loadScenarios, matchesPattern } from '../eval/scenarios/catalog.mjs';
import { mergeContract, probeFieldIds, readContract } from '../eval/verify/contract.mjs';
import { gatesFor, summarize } from '../eval/verify/index.mjs';
import {
  bindFields,
  checkStructure,
  modelPaths,
  runProbes,
  schemaSteps,
} from '../eval/verify/probes.mjs';

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
        createdForms: 1,
        extraFields: ['inn', 'price', 'note'],
        extraCount: 3,
        leakedExample: ['inn', 'price'],
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

  it('переносит лишние поля и поля образца; без заказа их метрик нет', () => {
    const metric = (index: number, id: string) =>
      records[index].metrics.find((m: { id: string }) => m.id === id);
    expect(metric(0, 'quality.extraFields')).toEqual({
      id: 'quality.extraFields',
      value: 3,
      better: 'lower',
    });
    expect(metric(0, 'quality.leakedExample')?.value).toBe(2);
    expect(metric(0, 'process.createdForms')?.value).toBe(1);
    expect(metric(1, 'quality.extraFields')).toBeUndefined();
  });

  it('переносит вердикт, причину и завершение по таймауту', () => {
    expect(records[0].verdict).toBe('pass');
    expect(records[1].verdict).toBe('fail');
    expect(records[1].checks['scenario.check']).toEqual(['fail', 'нет шага']);
    expect(records[1].exitReason).toBe('timeout');
  });

  it('дашборд по истории показывает holdout только агрегатом', () => {
    const html = renderReportHtml({ points: pointsFromRecords(records), events: [] });
    expect(html).toContain('<title>Метрики MCP</title>');
    expect(html).toContain('qwen3.8:27b-32k');
    const holdout = {
      ...records[0],
      runId: 'hold',
      scenario: { ...records[0].scenario, id: 'скрытый-сценарий', split: 'holdout' },
    };
    const withHoldout = renderReportHtml({
      points: pointsFromRecords([...records, holdout]),
      events: [],
    });
    expect(withHoldout).not.toContain('скрытый-сценарий');
    expect(withHoldout).toContain('"holdout":[1,1]');
  });
});

describe('каталог сценариев', () => {
  type Scenario = {
    id: string;
    level: number;
    operation?: string;
    targets: string[];
    seed?: string;
    seedScenario?: { id: string };
    contractFile: string;
  };
  const scenarios = loadScenarios({ includeHoldout: true }) as Scenario[];

  it('три формы × операции, каждая на трёх стеках', () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'registration-create',
      'registration-edit',
      'registration-delete',
      'order-create',
      'order-edit',
      'order-delete',
      'wizard-create',
      'wizard-split',
      'wizard-edit',
      'wizard-delete',
    ]);
    for (const scenario of scenarios) {
      expect(scenario.targets, scenario.id).toEqual(['core', 'renderer-react', 'renderer-json']);
      expect(scenario.level, scenario.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('правка начинается с эталона сценария создания, и только с затравкой', () => {
    for (const scenario of scenarios) {
      const fromScratch = (scenario.operation ?? 'create') === 'create';
      expect(Boolean(scenario.seed), scenario.id).toBe(!fromScratch);
      if (scenario.seed) expect(scenario.seedScenario?.id, scenario.id).toBe(scenario.seed);
    }
  });

  it('контракт каждого сценария читается, у правки и удаления есть свои проверки', () => {
    for (const scenario of scenarios) {
      const contract = readContract(scenario.contractFile);
      expect(
        contract.probes.some((probe: { gate?: boolean }) => probe.gate),
        scenario.id
      ).toBe(true);
      if (scenario.operation === 'delete') {
        expect(contract.absent?.length, scenario.id).toBeGreaterThan(0);
      }
    }
  });

  it('шаблон идентификаторов: звёздочка и список', () => {
    expect(matchesPattern('order-edit', 'order-*')).toBe(true);
    expect(matchesPattern('order-edit', 'registration-*,order-edit')).toBe(true);
    expect(matchesPattern('order-edit', 'order')).toBe(false);
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

describe('контракт правки: наследование', () => {
  const base = {
    case: 'base',
    fields: [
      { id: 'login', bind: { path: 'login' } },
      { id: 'email', bind: { path: 'email' } },
      { id: 'captcha', bind: { path: 'captcha' } },
    ],
    sample: { login: 'ivan', email: 'a@b.c', captcha: 'ABC123' },
    probes: [
      { id: 'sample-valid', expect: { valid: true } },
      { id: 'email-required', set: { email: '' }, expect: { invalid: ['email'] } },
      { id: 'captcha-wrong', set: { captcha: 'x' }, expect: { invalid: ['captcha'] } },
    ],
  };

  it('замена на месте, вставка после поля, снятие поля вместе с образцом', () => {
    const merged = mergeContract(base, {
      case: 'edit',
      drop: { fields: ['captcha'], probes: ['captcha-wrong'] },
      fields: [
        { id: 'login', bind: { path: 'username' } },
        { id: 'phone', after: 'email', bind: { path: 'phone' } },
      ],
      sample: { login: 'petr', phone: '' },
      probes: [{ id: 'sample-valid', expect: { valid: true, noIssues: ['phone'] } }],
      absent: [{ id: 'captcha', bind: { paths: ['captcha'] } }],
    });
    expect(merged.case).toBe('edit');
    expect(merged.fields.map((field: { id: string }) => field.id)).toEqual([
      'login',
      'email',
      'phone',
    ]);
    expect(merged.fields[0].bind.path).toBe('username');
    expect(merged.fields[2]).not.toHaveProperty('after');
    expect(merged.sample).toEqual({ login: 'petr', email: 'a@b.c', phone: '' });
    expect(merged.probes.map((probe: { id: string }) => probe.id)).toEqual([
      'sample-valid',
      'email-required',
    ]);
    expect(merged.probes[0].expect.noIssues).toEqual(['phone']);
    expect(merged.absent).toHaveLength(1);
  });

  it('проба базы со снятым полем — ошибка автора контракта, а не тихий провал', () => {
    expect(() => mergeContract(base, { drop: { fields: ['captcha'] } })).toThrow(/captcha-wrong/);
    expect(() => mergeContract(base, { drop: { fields: ['nope'] } })).toThrow(/нет поля nope/);
    expect(() =>
      mergeContract(base, { fields: [{ id: 'x', after: 'nope', bind: { path: 'x' } }] })
    ).toThrow(/after/);
  });

  it('id полей пробы: set, списки, словари и выражения — по первому сегменту пути', () => {
    expect(
      probeFieldIds({
        set: { 'items.0.price': 1 },
        expect: {
          invalid: ['email'],
          values: { total: 1 },
          expressions: [{ id: 'sum', expression: '1' }],
        },
      }).sort()
    ).toEqual(['email', 'items', 'sum', 'total']);
  });

  it('extends читается с диска цепочкой, путь — от файла наследника', () => {
    const directory = mkdtempSync(join(tmpdir(), 'contract-'));
    try {
      mkdirSync(join(directory, 'create'));
      mkdirSync(join(directory, 'edit'));
      writeFileSync(join(directory, 'create', 'contract.json'), JSON.stringify(base));
      writeFileSync(
        join(directory, 'edit', 'contract.json'),
        JSON.stringify({
          extends: '../create/contract.json',
          drop: { fields: ['captcha'], probes: ['captcha-wrong'] },
        })
      );
      const merged = readContract(join(directory, 'edit', 'contract.json'));
      expect(merged).not.toHaveProperty('extends');
      expect(merged).not.toHaveProperty('drop');
      expect(merged.fields).toHaveLength(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('верификатор: удалённые поля, шаги, предупреждения', () => {
  const paths = modelPaths({ username: '', email: '', items: [{ title: '' }], comment: '' });

  it('absent: поле нашлось по пути или по подписи — провал, иначе — проход; гейт', () => {
    const contract = {
      absent: [
        { id: 'captcha', bind: { paths: ['captcha'], label: '/капч|символ/i' } },
        { id: 'login', bind: { paths: ['login'] } },
      ],
    };
    expect(checkStructure(contract, paths, {}, [])['runtime.structure.absent']).toBe('pass');
    const byLabel = checkStructure(contract, paths, {}, [], {
      labels: [{ label: 'Символы с картинки', path: 'code' }],
    });
    expect(byLabel['runtime.structure.absent'][1]).toContain('captcha');
    const byPath = checkStructure(
      { absent: [{ id: 'email', bind: { paths: ['email'] } }] },
      paths,
      {},
      []
    );
    expect(byPath['runtime.structure.absent'][1]).toContain('путь email');
    expect(gatesFor(contract, {})).toContain('runtime.structure.absent');
  });

  it('шаги: число, заголовок и поля шага; поле массива — по пути массива', () => {
    const contract = {
      steps: [
        { title: '/товар/i', fields: ['items'] },
        { title: 'Оплата', fields: ['comment'] },
      ],
    };
    const bound = { items: 'items', comment: 'comment' };
    const flow = [{ id: 'step1' }, { id: 'step2' }];
    const good = [
      { id: 'step1', title: 'Товары', paths: ['items'] },
      { id: 'step2', title: 'Оплата', paths: ['comment'] },
    ];
    expect(
      checkStructure(contract, paths, bound, flow, { steps: good })['runtime.structure.steps']
    ).toBe('pass');
    const moved = [
      { id: 'step1', title: 'Товары', paths: ['items', 'comment'] },
      { id: 'step2', title: 'Оплата и скидки', paths: [] },
    ];
    const check = checkStructure(contract, paths, bound, flow, { steps: moved })[
      'runtime.structure.steps'
    ];
    expect(check[1]).toContain('шаг 2: нет comment');
    expect(checkStructure(contract, paths, bound, [flow[0]])['runtime.structure.steps'][1]).toBe(
      'шагов 1, в контракте 2'
    );
    expect(gatesFor(contract, {})).toContain('runtime.structure.steps');
  });

  it('schemaSteps: заголовок и пути полей — из узла схемы с селектором шага', () => {
    const schema = {
      selector: 'wizard',
      children: [
        {
          selector: 'step1',
          componentProps: { title: 'Покупатель' },
          children: [{ selector: 'email', model: '$model(email)', componentProps: {} }],
        },
      ],
    };
    expect(schemaSteps(schema, { $: {} }, [{ id: 'step1' }, { id: 'step9' }])).toEqual([
      { id: 'step1', title: 'Покупатель', paths: ['email'] },
      { id: 'step9', title: null, paths: [] },
    ]);
  });

  it('предупреждение не делает поле невалидным; проба шага валидирует только шаг', async () => {
    const contract = {
      probes: [
        { id: 'warning', expect: { valid: true, warnings: ['total'], noIssues: ['email'] } },
        { id: 'not-invalid', expect: { invalid: ['total'] } },
        { id: 'step', step: 2, expect: { valid: false } },
      ],
    };
    const calls: number[] = [];
    const createInstance = async () => ({
      model: { total: 0, email: '' },
      form: {
        total: { issues: { value: [{ code: 'big', severity: 'warning' }] } },
        email: { issues: { value: [] } },
      },
      validate: async () => true,
      validateStep: async (step: number) => {
        calls.push(step);
        return false;
      },
    });
    const checks = await runProbes({
      contract,
      bound: { total: 'total', email: 'email' },
      createInstance,
    });
    expect(checks['runtime.probe.warning']).toBe('pass');
    expect(checks['runtime.probe.not-invalid'][0]).toBe('fail');
    expect(checks['runtime.probe.step']).toBe('pass');
    expect(calls).toEqual([2]);
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

  it('каталог через симлинк — тот же каталог: Claude Code называет настоящий путь', () => {
    // macOS: os.tmpdir() — /var/folders/…, а init.cwd — /private/var/folders/….
    const real = mkdtempSync(join(tmpdir(), 'init-real-'));
    const link = `${real}-link`;
    try {
      mkdirSync(join(real, 'run'));
      symlinkSync(real, link);
      const init = { ...goodInit, cwd: realpathSync(join(real, 'run')) };
      expect(initProblems(init, { workspaceDirectory: join(link, 'run') })).toEqual([]);
      expect(initProblems(init, { workspaceDirectory: real }).join('; ')).toContain('не тот');
    } finally {
      unlinkSync(link);
      rmSync(real, { recursive: true, force: true });
    }
  });

  it('старый CLI без флагов запуска отсекается до батча, а не прогоном', () => {
    const fresh = [
      '  --restricted                          Restricted mode: removes the built-in',
      '  --tools <tools...>                    Specify the list of available tools',
      '  --permission-prompts <target>         Who answers permission prompts',
      '  --disable-slash-commands              Disable all skills and commands',
      '  --no-session-persistence              Disable session persistence',
      '  --max-budget-usd <amount>             Maximum dollar amount to spend on API',
      '  --strict-mcp-config                   Only use MCP servers from --mcp-config',
    ].join('\n');
    expect(missingFlags(fresh)).toEqual([]);
    // Claude Code 1.0.83: есть `--strict-mcp-config` и `--allowedTools`, но нет `--restricted` и
    // `--tools` — упоминание `--tools` внутри `--allowedTools` флагом не считается.
    const old = [
      '  --allowedTools <tools...>        Comma or space-separated list of tool names',
      '  --strict-mcp-config              Only use MCP servers from --mcp-config',
    ].join('\n');
    expect(missingFlags(old)).toEqual([
      '--restricted',
      '--tools',
      '--permission-prompts',
      '--disable-slash-commands',
      '--no-session-persistence',
      '--max-budget-usd',
    ]);
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

describe('адаптер Ollama: усечение старых ответов', () => {
  const tool = (name: string, chars: number) => ({
    role: 'tool',
    tool_name: name,
    content: 'x'.repeat(chars),
  });

  it('ответ сборки не усекается, прочие старые ответы — да [ReFormer-qo9b.31]', () => {
    const grammar = tool('form_build', 9000);
    const messages = [
      { role: 'user', content: 'задача' },
      tool('find_recipe', 5000),
      grammar,
      tool('plan_form', 6000),
      ...Array.from({ length: 4 }, () => tool('search_docs', 3000)),
    ];
    expect(truncateOldResults(messages)).toBe(1);
    expect(messages[1].content).toContain('ответ усечён стендом');
    expect(grammar.content).toHaveLength(9000);
    expect(messages[3].content).toHaveLength(6000);
    // Последние ответы остаются целыми: их модель читает прямо сейчас.
    expect(messages.slice(-4).every((m) => m.content.length === 3000)).toBe(true);
    expect([...KEEP_WHOLE_TOOLS].sort()).toEqual(['form_build', 'form_start', 'plan_form']);
  });

  it('ответ длиннее контекста модели усекается с пометкой [ReFormer-qo9b.36]', () => {
    const cap = responseCap(32768);
    expect(cap).toBeGreaterThan(9500); // грамматика целиком помещается
    expect(capResponse('x'.repeat(cap), cap)).toEqual({ text: 'x'.repeat(cap), cut: false });
    const long = capResponse('x'.repeat(70128), cap);
    expect(long.cut).toBe(true);
    expect(long.text.length).toBeLessThan(cap + 200);
    expect(long.text).toContain('70128');
  });
});

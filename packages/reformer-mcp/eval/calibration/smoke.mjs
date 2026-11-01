/**
 * Этап 0 калибровки — протокольный smoke обоих каналов через Inspector CLI.
 *
 * Проверяет то, что юнит-тесты пакета не видят: настоящий транспорт, собранный бинарник и бандл
 * воркера, коды ошибок, деградацию промптов без sampling у клиента, регистрацию из `.mcp.json`,
 * паритет ответов двух профилей и то, что процессы сервера после вызова завершаются.
 *
 * Каждая проверка — `{ id, channel, title, status: 'pass'|'fail'|'info', detail }`. `info` —
 * наблюдение без вердикта (например, как сервер отвечает на необъявленный метод).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CHANNELS, inspect, pkgDir, pool, repoRoot } from './lib/inspector.mjs';

const NODE_TOOLS = [
  'get_context',
  'choose_api',
  'get_symbol_docs',
  'find_recipe',
  'search_docs',
  'list_symbols',
  'validate_form',
  'plan_form',
  'generate_form',
  'report_issue',
];
const WORKER_TOOLS = NODE_TOOLS.filter((name) => name !== 'report_issue');
const NODE_PROMPTS = [
  'start-here',
  'discover-context',
  'review',
  'plan-form',
  'create-form',
  'add-feature',
  'to-renderer',
];
const GUIDE_FIRST_LINE = '> **Form file layout — read this even if you read nothing else here.**';
const LOAN_SPEC = path.join(pkgDir, 'tests', 'fixtures', 'spec-loan-request.md');

const SAMPLE_CODE = `import { createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';

interface Profile { email: string }

export const form = createForm<Profile>({
  model: { email: '' },
  validation: (path) => {
    required(path.email);
    email(path.email);
  },
});
`;

const SMALL_INTENT = {
  formName: 'ContactForm',
  target: 'core',
  fields: [
    { name: 'email', type: 'string', component: 'Input', label: 'Email' },
    { name: 'phone', type: 'string', component: 'Input', label: 'Телефон' },
  ],
  validation: [{ target: 'email', rules: ['required()', 'email()'] }],
};

/** Вызовы, ответы на которые обязаны совпасть в обоих профилях. */
const PARITY_CALLS = [
  ['choose_api', { requirement: 'поле B доступно только когда A заполнено' }],
  ['choose_api', { requirement: 'total = price * quantity' }],
  ['choose_api', { requirement: 'адрес проживания совпадает с адресом регистрации по флажку' }],
  ['find_recipe', { topic: 'wizard' }],
  ['get_symbol_docs', { symbol: 'useFormControl' }],
  ['search_docs', { query: 'conditional required validation' }],
  ['list_symbols', { nameContains: 'validate' }],
  [
    'validate_form',
    { kind: 'layout', files: ['index.tsx', 'model.ts', 'form.schema.ts', 'form.behavior.ts'] },
  ],
  ['validate_form', { kind: 'code', code: SAMPLE_CODE }],
  [
    'plan_form',
    { description: 'Форма обратной связи: имя (обязательно), email (обязательно), сообщение' },
  ],
  ['generate_form', { intent: SMALL_INTENT }],
];

export async function runSmoke({ outDir, channels }) {
  const dir = path.join(outDir, 'smoke');
  mkdirSync(dir, { recursive: true });
  const checks = [];
  const add = (id, channel, title, status, detail = '') => {
    checks.push({ id, channel, title, status, detail });
  };
  const save = (name, r) =>
    writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(r, null, 2));
  const pkgVersion = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;

  const before = serverProcesses();

  for (const ch of channels) {
    // S01 — рукопожатие
    const init = await inspect(ch, 'initialize');
    save(`S01-initialize-${ch}`, init);
    const info = init.result?.serverInfo;
    const caps = Object.keys(init.result?.capabilities ?? {}).sort();
    const wantCaps = ch === 'node' ? ['prompts', 'resources', 'tools'] : ['resources', 'tools'];
    add(
      'S01',
      ch,
      'initialize: имя, версия, возможности',
      init.ok &&
        info?.name === 'reformer-mcp' &&
        info?.version === pkgVersion &&
        caps.join() === wantCaps.join()
        ? 'pass'
        : 'fail',
      `${info?.name}@${info?.version} (package.json ${pkgVersion}); caps ${caps.join(', ')}; ` +
        `protocol ${init.result?.protocolVersion}; ${init.ms} мс`
    );

    // S02 — список инструментов и переносимость схем
    const tl = await inspect(ch, 'tools/list', { strict: true });
    save(`S02-tools-list-${ch}`, tl);
    const names = (tl.result?.tools ?? []).map((t) => t.name);
    const want = ch === 'node' ? NODE_TOOLS : WORKER_TOOLS;
    const planForm = tl.result?.tools?.find((t) => t.name === 'plan_form');
    const specPathOk =
      ch === 'node'
        ? 'specPath' in (planForm?.inputSchema?.properties ?? {})
        : !('specPath' in (planForm?.inputSchema?.properties ?? {}));
    const findings = tl.json?.schemaFindings ?? [];
    const warn = findings.flatMap((f) =>
      f.findings.map((x) => `${f.toolName}.${x.path}: ${x.rule}`)
    );
    add(
      'S02',
      ch,
      'tools/list --strict: состав, порядок, specPath, переносимость схем',
      tl.exit === 0 && names.join() === want.join() && specPathOk ? 'pass' : 'fail',
      `exit ${tl.exit}; ${names.length} инструментов; specPath у plan_form — ` +
        `${ch === 'node' ? 'есть' : 'нет'}: ${specPathOk ? 'да' : 'НЕТ'}; ` +
        `замечания схем: ${warn.length ? warn.join('; ') : 'нет'}`
    );
    const undocumented = (tl.result?.tools ?? []).filter(
      (t) => !t.description || t.inputSchema?.type !== 'object'
    );
    add(
      'S02b',
      ch,
      'у каждого инструмента описание и inputSchema.type=object',
      undocumented.length === 0 ? 'pass' : 'fail',
      undocumented.map((t) => t.name).join(', ') || 'все'
    );

    // S03–S07 — ресурсы
    const rl = await inspect(ch, 'resources/list');
    save(`S03-resources-list-${ch}`, rl);
    const uris = (rl.result?.resources ?? []).map((r) => r.uri);
    const docPkgs = uris.filter((u) => u.startsWith('reformer://docs/')).map((u) => u.slice(16));
    add(
      'S03',
      ch,
      'resources/list: guide, catalog, docs/<pkg>, без debug',
      rl.ok &&
        uris.includes('reformer://guide') &&
        uris.includes('reformer://catalog') &&
        docPkgs.length > 0 &&
        !uris.includes('reformer://debug') &&
        (rl.result?.resources ?? []).every((r) => r.mimeType)
        ? 'pass'
        : 'fail',
      `${uris.length} записей; пакеты: ${docPkgs.join(', ')}`
    );

    const guide = await inspect(ch, 'resources/read', { uri: 'reformer://guide' });
    save(`S04-guide-${ch}`, { ...guide, text: guide.text.slice(0, 2000) });
    add(
      'S04',
      ch,
      'reformer://guide начинается с правила раскладки',
      guide.ok && guide.text.startsWith(GUIDE_FIRST_LINE) ? 'pass' : 'fail',
      `${guide.text.length} символов`
    );

    const cat = await inspect(ch, 'resources/read', { uri: 'reformer://catalog' });
    let catalog = null;
    try {
      catalog = JSON.parse(cat.text);
    } catch {
      catalog = null;
    }
    const catPkgs = catalog?.packages ?? [];
    add(
      'S05',
      ch,
      'reformer://catalog — валидный JSON с пакетами и секциями',
      cat.ok && catPkgs.length > 0 && catPkgs.every((p) => p.sections.length > 0) ? 'pass' : 'fail',
      catPkgs.map((p) => `${p.id}: ${p.sections.length}`).join(', ')
    );

    // Первая и последняя секции каждого пакета — каталог и чтение согласованы.
    const sectionUris = catPkgs.flatMap((p) => {
      const first = p.sections[0]?.[0];
      const last = p.sections.at(-1)?.[0];
      return [...new Set([first, last])]
        .filter(Boolean)
        .map((slug) => `reformer://docs/${p.id}/${slug}`);
    });
    const allUris = [...sectionUris, ...docPkgs.map((p) => `reformer://docs/${p}`)];
    const reads = await pool(allUris, 4, (uri) => inspect(ch, 'resources/read', { uri }));
    const unread = allUris.filter((_, i) => !reads[i].ok || !reads[i].text.trim());
    add(
      'S06',
      ch,
      'секции из каталога и docs/<pkg> читаются',
      unread.length === 0 ? 'pass' : 'fail',
      `${allUris.length} адресов; не прочитались: ${unread.join(', ') || 'нет'}`
    );

    const negUris = [
      'reformer://docs/nope',
      'reformer://docs/core/no-such-slug',
      'reformer://unknown',
    ];
    const negs = await pool(negUris, 3, (uri) => inspect(ch, 'resources/read', { uri }));
    save(`S07-resource-negatives-${ch}`, negs);
    add(
      'S07',
      ch,
      'неизвестные ресурсы — ошибка с перечнем доступного',
      negs.every((r) => !r.ok && /Available|Expected/.test(r.error?.message ?? r.stderr))
        ? 'pass'
        : 'fail',
      negs
        .map((r, i) => `${negUris[i]} → exit ${r.exit} «${(r.error?.message ?? '').slice(0, 90)}»`)
        .join('; ')
    );

    const tpl = await inspect(ch, 'resources/templates/list');
    save(`S08-templates-${ch}`, tpl);
    const templates = (tpl.result?.resourceTemplates ?? []).map((t) => t.uriTemplate);
    add(
      'S08',
      ch,
      'resources/templates/list: шаблон адресов секций',
      tpl.ok && templates.includes('reformer://docs/{package}/{slug}') ? 'pass' : 'fail',
      tpl.ok
        ? `шаблоны: ${templates.join(', ') || 'нет'}`
        : `exit ${tpl.exit} «${(tpl.error?.message ?? '').slice(0, 120)}»`
    );

    // S09–S11 — промпты
    const pl = await inspect(ch, 'prompts/list');
    save(`S09-prompts-list-${ch}`, pl);
    const pnames = (pl.result?.prompts ?? []).map((p) => p.name);
    add(
      'S09',
      ch,
      ch === 'node' ? 'prompts/list: 7 промптов в порядке' : 'prompts/list: промптов нет',
      ch === 'node'
        ? pl.ok && pnames.join() === NODE_PROMPTS.join()
          ? 'pass'
          : 'fail'
        : pnames.length === 0
          ? 'pass'
          : 'fail',
      `exit ${pl.exit}; ${pnames.join(', ') || 'пусто'}`
    );

    if (ch === 'node') {
      const promptCalls = [
        ['start-here', {}],
        ['discover-context', { description: 'Анкета на кредит из трёх шагов' }],
        ['review', { code: SAMPLE_CODE }],
        ['plan-form', { specPath: LOAN_SPEC }],
        ['create-form', { description: 'Форма регистрации: email, пароль, повтор пароля' }],
        [
          'add-feature',
          { feature: 'validation', code: SAMPLE_CODE, requirements: 'email обязателен' },
        ],
        [
          'add-feature',
          { feature: 'behavior', code: SAMPLE_CODE, requirements: 'сумма = цена × количество' },
        ],
        ['add-feature', { feature: 'array', code: SAMPLE_CODE, requirements: 'список телефонов' }],
        [
          'add-feature',
          { feature: 'wizard', code: SAMPLE_CODE, requirements: 'шаг 1: email; шаг 2: телефон' },
        ],
        ['to-renderer', { code: SAMPLE_CODE }],
      ];
      const gets = await pool(promptCalls, 4, ([name, args]) =>
        inspect(ch, 'prompts/get', { promptName: name, promptArgs: args })
      );
      save(
        'S10-prompts-get-node',
        gets.map((g) => ({ ...g, text: g.text.slice(0, 1500) }))
      );
      const failed = gets
        .map((g, i) => (g.ok && g.text.trim() ? null : `${promptCalls[i][0]}(exit ${g.exit})`))
        .filter(Boolean);
      add(
        'S10',
        ch,
        'prompts/get каждого промпта без sampling у клиента',
        failed.length === 0 ? 'pass' : 'fail',
        `${gets.length} вызовов; ${failed.length ? `сбой: ${failed.join(', ')}` : 'все вернули messages'}; ` +
          `длины: ${gets.map((g, i) => `${promptCalls[i][0]}=${g.text.length}`).join(', ')}`
      );

      const unknownPrompt = await inspect(ch, 'prompts/get', { promptName: 'no-such-prompt' });
      const reviewNoCode = await inspect(ch, 'prompts/get', { promptName: 'review' });
      save('S11-prompt-negatives-node', [unknownPrompt, reviewNoCode]);
      add(
        'S11',
        ch,
        'неизвестный промпт — ошибка',
        !unknownPrompt.ok ? 'pass' : 'fail',
        `exit ${unknownPrompt.exit} «${(unknownPrompt.error?.message ?? '').slice(0, 100)}»`
      );
      add(
        'S11b',
        ch,
        'review без обязательного code — ошибка, а не «undefined» в тексте',
        !reviewNoCode.ok ? 'pass' : reviewNoCode.text.includes('undefined') ? 'fail' : 'info',
        reviewNoCode.ok
          ? `ответил без ошибки; «undefined» в тексте: ${reviewNoCode.text.includes('undefined')}`
          : `exit ${reviewNoCode.exit} «${(reviewNoCode.error?.message ?? '').slice(0, 100)}»`
      );
    }

    // S12 — негативы инструментов
    const toolNegs = [
      ['unknown tool', 'no_such_tool', {}],
      ['choose_api без requirement', 'choose_api', {}],
      ['get_symbol_docs без symbol', 'get_symbol_docs', {}],
      ['find_recipe без topic', 'find_recipe', {}],
      ['generate_form без intent', 'generate_form', {}],
      ['search_docs query числом', 'search_docs', { query: 123 }],
      ['validate_form kind=unknown', 'validate_form', { kind: 'unknown' }],
      ['validate_form без kind', 'validate_form', {}],
      ...(ch === 'node'
        ? [
            [
              'plan_form с несуществующим specPath',
              'plan_form',
              { specPath: 'D:/nope/missing-spec.md' },
            ],
          ]
        : []),
    ];
    const negCalls = await pool(toolNegs, 4, ([, name, args]) =>
      inspect(ch, 'tools/call', { toolName: name, toolArgs: args })
    );
    save(`S12-tool-negatives-${ch}`, negCalls);
    toolNegs.forEach(([label, name], i) => {
      const r = negCalls[i];
      const isToolError = r.exit === 5;
      const crashed = r.exit !== 5 && r.exit !== 1 && r.exit !== 0;
      const message = (r.text || r.error?.message || '').replace(/\s+/g, ' ').slice(0, 140);
      // Неизвестный инструмент — протокольная ошибка по спецификации; остальное — ошибка
      // выполнения (isError), чтобы модель могла поправить вызов (SEP-1303, 2025-11-25).
      const expectedOk = name === 'no_such_tool' ? r.exit !== 0 : isToolError;
      add(
        `S12.${i + 1}`,
        ch,
        `негатив: ${label}`,
        crashed ? 'fail' : expectedOk ? 'pass' : r.exit === 0 ? 'info' : 'fail',
        `exit ${r.exit} (${r.error?.code ?? (r.result?.isError ? 'isError' : 'ok')}) «${message}»`
      );
    });
  }

  if (channels.includes('node')) {
    // S13/S14 — debug-режим и его отсутствие
    const env = { REFORMER_DEBUG: 'true' };
    const [dTools, dRes, dPrompts, dCall, dRead, dGet] = await Promise.all([
      inspect('node', 'tools/list', { env }),
      inspect('node', 'resources/list', { env }),
      inspect('node', 'prompts/list', { env }),
      inspect('node', 'tools/call', { env, toolName: 'debug', toolArgs: {} }),
      inspect('node', 'resources/read', { env, uri: 'reformer://debug' }),
      inspect('node', 'prompts/get', {
        env,
        promptName: 'debug',
        promptArgs: { code: SAMPLE_CODE },
      }),
    ]);
    save('S13-debug-on', { dTools, dRes, dPrompts, dCall, dRead, dGet });
    const dToolNames = (dTools.result?.tools ?? []).map((t) => t.name);
    add(
      'S13',
      'node',
      'REFORMER_DEBUG=true: debug в tools (последним), resources, prompts — и вызывается',
      dToolNames.at(-1) === 'debug' &&
        (dRes.result?.resources ?? []).some((r) => r.uri === 'reformer://debug') &&
        (dPrompts.result?.prompts ?? []).some((p) => p.name === 'debug') &&
        dCall.ok &&
        dRead.ok &&
        dGet.ok
        ? 'pass'
        : 'fail',
      `tools: …${dToolNames.slice(-2).join(', ')}; вызов ${dCall.exit}, чтение ${dRead.exit}, промпт ${dGet.exit}`
    );
    const [nCall, nRead, nGet] = await Promise.all([
      inspect('node', 'tools/call', { toolName: 'debug', toolArgs: {} }),
      inspect('node', 'resources/read', { uri: 'reformer://debug' }),
      inspect('node', 'prompts/get', { promptName: 'debug', promptArgs: { code: SAMPLE_CODE } }),
    ]);
    add(
      'S14',
      'node',
      'без флага debug-инструмент, ресурс и промпт недоступны',
      !nCall.ok && !nRead.ok && !nGet.ok ? 'pass' : 'fail',
      `exit: tool ${nCall.exit}, resource ${nRead.exit}, prompt ${nGet.exit}`
    );

    // S15 — регистрация из .mcp.json (как её видит Claude Code)
    const cfg = await inspect('node', 'initialize', {
      target: ['--config', path.join(repoRoot, '.mcp.json'), '--server', 'reformer'],
    });
    save('S15-mcp-json', cfg);
    add(
      'S15',
      'node',
      'регистрация из .mcp.json (--config --server reformer)',
      cfg.ok && cfg.result?.serverInfo?.name === 'reformer-mcp' ? 'pass' : 'fail',
      `exit ${cfg.exit}; ${cfg.result?.serverInfo?.name ?? cfg.error?.message ?? ''}`
    );

    // S16 — report_issue пишет отчёт туда, куда сказано
    const issuesDir = path.join(outDir, 'issue-reports');
    rmSync(issuesDir, { recursive: true, force: true });
    const rep = await inspect('node', 'tools/call', {
      env: { REFORMER_ISSUE_REPORTS_DIR: issuesDir },
      toolName: 'report_issue',
      toolArgs: {
        error: 'calibration smoke: проверка записи отчёта',
        solution: 'не требуется — это проверка калибровки',
        tags: ['category:other', 'agent:calibration'],
      },
    });
    const written = existsSync(issuesDir) ? readdirSync(issuesDir) : [];
    add(
      'S16',
      'node',
      'report_issue пишет файл в REFORMER_ISSUE_REPORTS_DIR',
      rep.ok && written.length === 1 ? 'pass' : 'fail',
      `exit ${rep.exit}; файлов: ${written.length}`
    );
  }

  // S17 — паритет каналов
  if (channels.includes('node') && channels.includes('worker')) {
    const pairs = await pool(PARITY_CALLS, 3, async ([name, args]) => {
      const [n, w] = await Promise.all([
        inspect('node', 'tools/call', { toolName: name, toolArgs: args }),
        inspect('worker', 'tools/call', { toolName: name, toolArgs: args }),
      ]);
      return { name, args, node: n, worker: w, same: n.text === w.text && n.exit === w.exit };
    });
    save(
      'S17-parity',
      pairs.map((p) => ({
        name: p.name,
        args: p.args,
        same: p.same,
        node: p.node.text,
        worker: p.worker.text,
      }))
    );
    // Текст без строк-заголовков: рецепт воркера восстанавливается из llms.txt, где граница между
    // вводным текстом файла и его первой секцией не хранится, — заголовок первой секции встаёт над
    // вводным текстом. Такое расхождение — разметка, а не содержание (info, а не fail).
    const prose = (t) =>
      t
        .split('\n')
        .filter((l) => !/^#{1,6} /.test(l))
        .join('\n')
        .replace(/\n{2,}/g, '\n');
    pairs.forEach((p, i) => {
      const headingsOnly =
        !p.same && p.node.exit === p.worker.exit && prose(p.node.text) === prose(p.worker.text);
      add(
        `S17.${i + 1}`,
        'both',
        `паритет: ${p.name} ${JSON.stringify(p.args).slice(0, 60)}`,
        p.same ? 'pass' : headingsOnly ? 'info' : 'fail',
        p.same
          ? `${p.node.text.length} символов`
          : `${headingsOnly ? 'текст совпадает, расходится место заголовков; ' : ''}node ${p.node.text.length} / worker ${p.worker.text.length} символов; ${firstDiff(p.node.text, p.worker.text)}`
      );
    });
  }

  // S18 — после прогона нет живых процессов сервера
  const after = serverProcesses();
  const leaked = after.filter((p) => !before.includes(p));
  add(
    'S18',
    'both',
    'после вызовов не остаётся процессов сервера',
    leaked.length === 0 ? 'pass' : 'fail',
    leaked.length ? leaked.join(' | ').slice(0, 300) : 'нет'
  );

  writeFileSync(path.join(dir, 'checks.json'), JSON.stringify(checks, null, 2));
  return checks;
}

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return `первое расхождение на ${i}: «${a.slice(i, i + 60)}» / «${b.slice(i, i + 60)}»`;
}

/** Командные строки живых процессов сервера (обоих каналов). */
function serverProcesses() {
  const marks = [CHANNELS.node.script, CHANNELS.worker.script].map(
    (p) => path.basename(path.dirname(p)) + path.sep + path.basename(p)
  );
  let lines = [];
  if (process.platform === 'win32') {
    const r = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" | ForEach-Object { $_.CommandLine }',
      ],
      { encoding: 'utf8' }
    );
    lines = (r.stdout ?? '').split(/\r?\n/);
  } else {
    const r = spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8' });
    lines = (r.stdout ?? '').split('\n');
  }
  return lines
    .map((l) => l.trim())
    .filter((l) => marks.some((m) => l.replace(/\//g, path.sep).includes(m)));
}

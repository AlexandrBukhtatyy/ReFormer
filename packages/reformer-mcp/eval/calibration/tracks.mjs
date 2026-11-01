/**
 * Треки замера калибровки (кроме рантайма T3 — он в `runtime.mjs`).
 *
 *   T1 спека → intent        `plan_form` по спеке, сверка с эталонными фактами
 *   T2 intent → бандл         `generate_form` × 3 таргета, проверка типов, `validate_form` по файлам
 *   T4 подбор API             `choose_api` по `operators.json`, `askReformer` с бюджетом
 *                             `ask_reformer`, покрытие `get_symbol_docs`, рецепты
 *   T5 проверка кода          `validate_form` по коду эталонов: рабочий код → любая ошибка ложная
 *   T6 пригодность ответа     главное — в первых 1400 символах (бюджет `mcp_call`)
 *
 * Все вызовы сервера — через Inspector CLI (`lib/inspector.mjs`), кроме `askReformer`: это не
 * инструмент MCP, а функция ядра, которую ассистент зовёт напрямую (`ask_reformer`).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractIntent, parseGenerateForm, typecheck, writeBundle } from './lib/bundle.mjs';
import { calDir, inspect, pkgDir, pool, repoRoot, tmpDir } from './lib/inspector.mjs';
import { ANSWER_BUDGET, fitness, scoreIntent, warningsAt } from './lib/score.mjs';

export const TARGETS = ['core', 'renderer-react', 'renderer-json'];
const PLAYGROUND = path.join(repoRoot, 'projects/react-playground/src/pages/demo');
const GOLDEN_CODEGEN = path.join(
  repoRoot,
  'projects/reformer-builder-playground/.ui_builder/plugins/reformer/codegen/src/pipeline/__golden__'
);
/** Бюджет ответа `ask_reformer` (`packages/reformer-builder-toolkit/src/assistant/budget.ts`). */
const ASK_BUDGET = 1500;
const CONCURRENCY = 4;

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);

export const CASES = [
  {
    id: 'registration',
    role: 'простая: валидация + поведение',
    spec: path.join(calDir, 'cases/registration/spec.md'),
    facts: path.join(calDir, 'cases/registration/facts.json'),
    intent: path.join(calDir, 'cases/registration/intent.json'),
  },
  {
    id: 'credit',
    role: 'сложная многошаговая',
    spec: path.join(repoRoot, 'docs/specs/credit-application-form.md'),
    facts: path.join(calDir, 'cases/credit/facts.json'),
    intent: path.join(calDir, 'cases/credit/intent.json'),
  },
  {
    id: 'insurance',
    role: 'holdout',
    spec: path.join(repoRoot, 'docs/specs/insurance-application-form.md'),
  },
  {
    id: 'loan',
    role: 'регрессия',
    spec: path.join(pkgDir, 'tests/fixtures/spec-loan-request.md'),
  },
];

/** Тексты ответов по инструментам — сырьё T6. */
export function createTextLog() {
  const log = [];
  return {
    add: (track, channel, tool, text) => log.push({ track, channel, tool, text }),
    entries: () => log,
  };
}

function save(outDir, name, data) {
  const file = path.join(outDir, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

function counts(intent) {
  return {
    fields: intent?.fields?.length ?? 0,
    arrays: intent?.arrays?.length ?? 0,
    rules: (intent?.validation ?? []).reduce(
      (n, v) => n + (v.rules?.length ?? 0) + (v.async ? 1 : 0) + (v.cross ? 1 : 0),
      0
    ),
    behavior: intent?.behavior?.length ?? 0,
    visibility: intent?.visibility?.length ?? 0,
    warnings: intent?.warnings?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// T1 — спека → intent
// ---------------------------------------------------------------------------

export async function trackT1({ outDir, channels, texts }) {
  const result = {};
  for (const c of CASES) {
    const facts = readJson(c.facts ?? '');
    const specText = readFileSync(c.spec, 'utf8');
    const entry = { role: c.role, channels: {} };
    for (const ch of channels) {
      // node читает спеку по пути, worker — текстом: у профиля browser `specPath` нет.
      const args =
        ch === 'node'
          ? { specPath: c.spec, target: 'core' }
          : { description: specText, target: 'core' };
      const r = await inspect(ch, 'tools/call', { toolName: 'plan_form', toolArgs: args });
      texts.add('T1', ch, 'plan_form', r.text);
      save(outDir, `t1/${c.id}-${ch}.md`, r.text);
      const intent = extractIntent(r.text);
      entry.channels[ch] = {
        exit: r.exit,
        via: r.via,
        ms: r.ms,
        chars: r.text.length,
        warningsAt: warningsAt(r.text),
        intent,
        counts: counts(intent),
        score: facts && intent ? scoreIntent(facts, intent) : null,
      };
    }
    if (entry.channels.node && entry.channels.worker) {
      const a = JSON.stringify(entry.channels.node.intent);
      const b = JSON.stringify(entry.channels.worker.intent);
      entry.parity = a === b;
    }
    result[c.id] = entry;
  }
  save(
    outDir,
    't1.json',
    Object.fromEntries(
      Object.entries(result).map(([id, e]) => [
        id,
        {
          ...e,
          channels: Object.fromEntries(
            Object.entries(e.channels).map(([ch, v]) => [ch, { ...v, intent: undefined }])
          ),
        },
      ])
    )
  );
  return result;
}

// ---------------------------------------------------------------------------
// T2 — intent → бандл
// ---------------------------------------------------------------------------

/**
 * Ответ `validate_form` → число ошибок и коды находок.
 *
 * Заголовки у видов разные: `# validate_form (code) — ❌ ошибок 2`, а у `json-schema` —
 * `# JSON schema — ❌ invalid (2 errors)` и находки без кодов RF (`- <путь> has unknown property …`);
 * им код строится из текста без пути.
 */
export function parseValidate(text) {
  const t = String(text);
  const head = t.split('\n')[0] ?? '';
  const ok = /✅/.test(head);
  const n = t.match(/ошиб\S* (\d+)/)?.[1] ?? head.match(/\((\d+) errors?\)/)?.[1];
  const errors = n !== undefined ? Number(n) : ok ? 0 : null;
  const rf = [...t.matchAll(/^- \*\*(RF\d+)\*\*\s*([A-Z_]+)?/gm)].map(
    (m) => `${m[1]}${m[2] ? ` ${m[2]}` : ''}`
  );
  const plain = /^# JSON schema/.test(head)
    ? [...t.matchAll(/^- \S+ (.+)$/gm)].map((m) => m[1].replace(/"[^"]*"/g, '"…"'))
    : [];
  const warnings = [...section(t, 'Warnings').matchAll(/^- \*\*(RF\d+)\*\*/gm)].map((m) => m[1]);
  return { ok, errors, codes: [...rf, ...plain], warnings };
}

function section(text, heading) {
  const start = text.search(new RegExp(`^## ${heading}`, 'm'));
  if (start < 0) return '';
  const rest = text.slice(start + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

export async function trackT2({ outDir, texts }, t1) {
  const jobs = [];
  for (const c of CASES) {
    const planned = t1?.[c.id]?.channels?.node?.intent;
    const golden = readJson(c.intent ?? '');
    const sources = [
      ...(planned ? [['planned', planned]] : []),
      ...(golden ? [['golden', golden]] : []),
    ];
    for (const [source, intent] of sources) {
      for (const target of TARGETS) jobs.push({ c, source, intent: { ...intent, target }, target });
    }
  }

  const runs = await pool(jobs, 2, async ({ c, source, intent, target }) => {
    const r = await inspect('node', 'tools/call', {
      toolName: 'generate_form',
      toolArgs: { intent },
    });
    texts.add('T2', 'node', 'generate_form', r.text);
    const name = `${c.id}-${source}-${target}`;
    save(outDir, `t2/${name}.md`, r.text);
    const parsed = parseGenerateForm(r.text);
    const dir = path.join(outDir, 'bundles', name);
    writeBundle(dir, parsed);
    const tsc = typecheck(dir, parsed);

    // Раскладка — такой, какой её соберёт агент по манифесту: напечатанные файлы плюс те, что
    // манифест велит создать самому (`| \`types.ts\` | … | **создайте сами** |`). Без них
    // проверка всегда отвечала RF012 на файлы, которых сервер печатать и не обещал.
    const ownFiles = [...r.text.matchAll(/^\| `([^`]+)` \|.*\*\*создайте сами\*\*/gm)].map(
      (m) => m[1]
    );
    const layout = await inspect('node', 'tools/call', {
      toolName: 'validate_form',
      toolArgs: {
        kind: 'layout',
        target,
        files: [
          ...new Set([
            ...parsed.files.map((f) => f.path),
            ...(parsed.indexSample ? ['index.tsx'] : []),
            ...ownFiles,
          ]),
        ],
      },
    });
    texts.add('T2', 'node', 'validate_form', layout.text);
    const codeFiles = parsed.files.filter((f) => /\.tsx?$/.test(f.path));
    const code = await pool(codeFiles, CONCURRENCY, async (f) => {
      const v = await inspect('node', 'tools/call', {
        toolName: 'validate_form',
        toolArgs: { kind: 'code', code: f.content },
      });
      texts.add('T2', 'node', 'validate_form', v.text);
      return { file: f.path, ...parseValidate(v.text) };
    });

    return {
      case: c.id,
      source,
      target,
      exit: r.exit,
      via: r.via,
      ms: r.ms,
      chars: r.text.length,
      status: parsed.status,
      errors: parsed.errors,
      warnings: parsed.warnings,
      intentProblems: parsed.intentProblems,
      files: parsed.files.map((f) => f.path),
      tsc,
      layout: parseValidate(layout.text),
      code,
    };
  });
  save(outDir, 't2.json', runs);
  return runs;
}

// ---------------------------------------------------------------------------
// T4 — подбор API
// ---------------------------------------------------------------------------

/** Знание ассистента: корпус без рецептов, как у `ask_reformer` (`plugins/reformer/ai/src/knowledge`). */
async function assistantKnowledge() {
  const dir = path.join(tmpDir, 'knowledge');
  const indexFile = path.join(dir, 'knowledge-index.json');
  if (
    !existsSync(indexFile) ||
    statSync(indexFile).mtimeMs < statSync(path.join(pkgDir, 'dist/index.js')).mtimeMs
  ) {
    const r = spawnSync(
      process.execPath,
      [path.join(pkgDir, 'scripts/build-knowledge-bundle.mjs'), '--out', dir],
      {
        cwd: pkgDir,
        encoding: 'utf8',
      }
    );
    if (r.status !== 0) throw new Error(`build-knowledge-bundle: ${r.stderr}`);
  }
  const { createBrowserKnowledge } = await import(
    pathToFileURL(path.join(pkgDir, 'dist/platform/browser/knowledge.js')).href
  );
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  const docs = JSON.parse(readFileSync(path.join(dir, 'knowledge-docs.json'), 'utf8'));
  return createBrowserKnowledge({ index, docs }).knowledge;
}

/** Имена, импортируемые из `@reformer/*` в файлах. */
function reformerImports(files) {
  const names = new Set();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(
      /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'@reformer\/[^']+'/g
    )) {
      for (const part of m[1].split(',')) {
        const name = part
          .replace(/\btype\b/, '')
          .split(/\s+as\s+/)[0]
          .trim();
        if (name) names.add(name);
      }
    }
  }
  return [...names].sort();
}

function listFiles(dir, re) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (re.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export async function trackT4({ outDir, channels, texts }) {
  const operators = readJson(path.join(calDir, 'operators.json')).items;
  const chooseApi = {};
  for (const ch of channels) {
    chooseApi[ch] = await pool(operators, CONCURRENCY, async (item) => {
      const r = await inspect(ch, 'tools/call', {
        toolName: 'choose_api',
        toolArgs: { requirement: item.requirement },
      });
      texts.add('T4', ch, 'choose_api', r.text);
      const picked = r.text.match(/^# choose_api: `([^`]+)`/m)?.[1] ?? null;
      return {
        id: item.id,
        picked,
        hit: picked !== null && item.expectAny.some((e) => picked === e || picked.includes(e)),
        mentions: item.expectAny.some((e) => r.text.includes(e)),
        chars: r.text.length,
      };
    });
  }

  const knowledge = await assistantKnowledge();
  const { askReformer } = await import(
    pathToFileURL(path.join(pkgDir, 'dist/core/facade.js')).href
  );
  const ask = [];
  for (const item of operators) {
    const answer = await askReformer(knowledge, item.requirement, { maxChars: ASK_BUDGET });
    texts.add('T4', 'ask', 'askReformer', answer.text);
    ask.push({
      id: item.id,
      hit: item.expectAny.some((e) => answer.text.includes(e)),
      chars: answer.text.length,
      truncated: answer.truncated,
      trace: answer.trace.map((s) => `${s.tool}${s.hit ? '✓' : '·'}`).join(' '),
    });
  }

  const goldenFiles = [
    ...listFiles(path.join(PLAYGROUND, 'registration-form-renderer-json'), /\.tsx?$/),
    ...listFiles(path.join(PLAYGROUND, 'complex-multy-step-form'), /\.tsx?$/),
    ...listFiles(path.join(PLAYGROUND, 'behaviors'), /\.tsx?$/),
  ];
  const symbols = reformerImports(goldenFiles);
  const symbolDocs = await pool(symbols, CONCURRENCY, async (symbol) => {
    const r = await inspect('node', 'tools/call', {
      toolName: 'get_symbol_docs',
      toolArgs: { symbol },
    });
    texts.add('T4', 'node', 'get_symbol_docs', r.text);
    return {
      symbol,
      found: r.exit === 0 && !/not found/i.test(r.text.slice(0, 300)),
      chars: r.text.length,
    };
  });

  const topics = [
    'wizard',
    'form-array',
    'copy-from',
    'json-schema',
    'directory-layout',
    'validation',
    'computed',
  ];
  const recipes = {};
  for (const ch of channels) {
    recipes[ch] = await pool(topics, CONCURRENCY, async (topic) => {
      const r = await inspect(ch, 'tools/call', { toolName: 'find_recipe', toolArgs: { topic } });
      texts.add('T4', ch, 'find_recipe', r.text);
      return {
        topic,
        title: r.text.split('\n')[0],
        source: r.text.match(/\*\*Source:\*\* ([^\n]+)/)?.[1] ?? '',
        chars: r.text.length,
      };
    });
  }

  const result = { chooseApi, ask, symbolDocs, recipes };
  save(outDir, 't4.json', result);
  return result;
}

// ---------------------------------------------------------------------------
// T5 — ложные срабатывания проверки кода
// ---------------------------------------------------------------------------

function goldenCodegenSets() {
  if (!existsSync(GOLDEN_CODEGEN)) return [];
  return readdirSync(GOLDEN_CODEGEN, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const dir = path.join(GOLDEN_CODEGEN, e.name);
      const manifest = readFileSync(path.join(dir, '_manifest.txt'), 'utf8')
        .split('\n')
        .map((l) => l.split('\t')[0].trim())
        .filter(Boolean);
      return { id: e.name, dir, manifest };
    });
}

export async function trackT5({ outDir, channels, texts }) {
  const sources = [
    {
      set: 'playground/registration',
      dir: path.join(PLAYGROUND, 'registration-form-renderer-json'),
    },
    { set: 'playground/credit', dir: path.join(PLAYGROUND, 'complex-multy-step-form') },
  ];
  const codeJobs = [];
  for (const s of sources) {
    for (const file of listFiles(s.dir, /\.tsx?$/)) {
      codeJobs.push({
        set: s.set,
        file: path.relative(s.dir, file).replace(/\\/g, '/'),
        code: readFileSync(file, 'utf8'),
      });
    }
  }
  const golden = goldenCodegenSets();
  for (const g of golden) {
    for (const rel of g.manifest.filter((p) => /\.tsx?$/.test(p))) {
      const file = path.join(g.dir, `${rel}.snap`);
      if (existsSync(file))
        codeJobs.push({ set: `__golden__/${g.id}`, file: rel, code: readFileSync(file, 'utf8') });
    }
  }

  const code = {};
  for (const ch of channels) {
    code[ch] = await pool(codeJobs, CONCURRENCY, async (job) => {
      const r = await inspect(ch, 'tools/call', {
        toolName: 'validate_form',
        toolArgs: { kind: 'code', code: job.code },
      });
      texts.add('T5', ch, 'validate_form', r.text);
      const v = parseValidate(r.text);
      return {
        set: job.set,
        file: job.file,
        via: r.via,
        ...v,
        findings: v.errors
          ? section(r.text, 'Errors')
              .trim()
              .split('\n')
              .filter((l) => l.startsWith('- '))
              .slice(0, 6)
          : [],
      };
    });
  }

  const layoutJobs = [
    {
      set: 'playground/registration',
      target: 'renderer-json',
      files: listFiles(sources[0].dir, /./).map((f) =>
        path.relative(sources[0].dir, f).replace(/\\/g, '/')
      ),
    },
    {
      set: 'playground/credit',
      target: 'core',
      files: listFiles(sources[1].dir, /./).map((f) =>
        path.relative(sources[1].dir, f).replace(/\\/g, '/')
      ),
    },
    ...golden.map((g) => ({
      set: `__golden__/${g.id}`,
      target: 'renderer-json',
      files: g.manifest,
    })),
  ];
  const layout = await pool(layoutJobs, CONCURRENCY, async (job) => {
    const r = await inspect('node', 'tools/call', {
      toolName: 'validate_form',
      toolArgs: { kind: 'layout', target: job.target, files: job.files },
    });
    texts.add('T5', 'node', 'validate_form', r.text);
    save(outDir, `t5/layout-${job.set.replace(/[\\/]/g, '_')}.md`, r.text);
    return { set: job.set, files: job.files.length, ...parseValidate(r.text) };
  });

  const jsonSchemas = [
    {
      set: 'playground/credit-renderer-json',
      schema: path.join(PLAYGROUND, 'complex-multy-step-form-renderer-json/form.schema.json'),
      registry: path.join(PLAYGROUND, 'complex-multy-step-form-renderer-json/registry.ts'),
    },
    {
      set: 'playground/registration',
      schema: path.join(PLAYGROUND, 'registration-form-renderer-json/json-schema.json'),
      registry: path.join(PLAYGROUND, 'registration-form-renderer-json/registry.tsx'),
    },
    ...golden.map((g) => ({
      set: `__golden__/${g.id}`,
      schema: path.join(g.dir, 'schema/form.schema.json.snap'),
      registry: path.join(g.dir, 'schema/registry.ts.snap'),
    })),
  ].filter((j) => existsSync(j.schema));
  const jsonSchema = await pool(jsonSchemas, CONCURRENCY, async (job) => {
    const componentNames = existsSync(job.registry)
      ? [
          ...readFileSync(job.registry, 'utf8').matchAll(
            /(?:reg\.component|component)\(\s*['"]([\w.$-]+)['"]/g
          ),
        ].map((m) => m[1])
      : undefined;
    const r = await inspect('node', 'tools/call', {
      toolName: 'validate_form',
      toolArgs: {
        kind: 'json-schema',
        schema: readFileSync(job.schema, 'utf8'),
        ...(componentNames?.length ? { componentNames } : {}),
      },
    });
    texts.add('T5', 'node', 'validate_form', r.text);
    save(outDir, `t5/json-schema-${job.set.replace(/[\\/]/g, '_')}.md`, r.text);
    return {
      set: job.set,
      via: r.via,
      components: componentNames?.length ?? 0,
      ...parseValidate(r.text),
    };
  });

  const result = { code, layout, jsonSchema };
  save(outDir, 't5.json', result);
  return result;
}

// ---------------------------------------------------------------------------
// T6 — пригодность ответа агенту
// ---------------------------------------------------------------------------

export function trackT6({ outDir, texts }) {
  const byTool = {};
  for (const e of texts.entries()) {
    const f = fitness(e.tool, e.text);
    const s = (byTool[e.tool] ??= { n: 0, fits: 0, keyInBudget: 0, chars: [], misses: [] });
    s.n++;
    s.chars.push(f.chars);
    if (f.fits) s.fits++;
    if (f.ok) s.keyInBudget++;
    else if (s.misses.length < 5)
      s.misses.push(`${e.track}/${e.channel}: ключ «${f.key}» на ${f.keyAt}`);
  }
  const summary = Object.fromEntries(
    Object.entries(byTool).map(([tool, s]) => {
      const sorted = [...s.chars].sort((a, b) => a - b);
      return [
        tool,
        {
          n: s.n,
          medianChars: sorted[Math.floor(sorted.length / 2)],
          maxChars: sorted.at(-1),
          fitsShare: s.fits / s.n,
          keyInBudgetShare: s.keyInBudget / s.n,
          misses: s.misses,
        },
      ];
    })
  );
  const plan = texts.entries().filter((e) => e.tool === 'plan_form');
  summary.plan_form_warnings = {
    n: plan.length,
    beyondBudget: plan.filter((e) => warningsAt(e.text) > ANSWER_BUDGET).length,
    positions: plan.map((e) => warningsAt(e.text)),
  };
  save(outDir, 't6.json', summary);
  return summary;
}

/**
 * A/B-замер: режим структурных инструментов против режима файлов на одних и тех же задачах.
 *
 * Отвечает на вопрос, ради которого режим файлов заведён рядом с прежним, а не вместо него:
 * упрощение схемы окупается или модель, пишущая файлы сама, собирает формы хуже. Сценарии:
 *
 * - **spec** — форма кредитной заявки с нуля по спецификации (задание дословно из прошлого замера,
 *   `.tmp/builder-spec-run/full.run.ts`): шесть шагов мастера и поля из таблиц;
 * - **rules** — правила на готовой форме шаблона `reformer-multi-step-form`: обязательное поле и
 *   условная видимость. Здесь режимы расходятся сильнее всего: структурный пишет правила в память
 *   моста, файловый — в код модуля, который исполняет превью.
 *
 * Детерминированный эталон «мастер 3×4» живёт в обычных тестах (`./file-loop.test.ts`).
 *
 * По умолчанию НЕ запускается: нужен живой канал. Запуск из каталога плагина — `npx vitest run`
 * НАПРЯМУЮ, а не через `scripts/run-vitest.mjs`: обёртка считает минуту тишины зависанием и
 * обрывает прогон, а живой ход модели молчит дольше (ReFormer-23l1).
 *
 * `EVAL_MODEL=qwen3.8:27b npx vitest run src/loop/modes-ab-eval.test.ts`
 *
 * Переменные: `EVAL_KIND` (`openai-compatible` | `anthropic` | `openai`), `EVAL_BASE_URL`,
 * `EVAL_API_KEY`, `EVAL_MODES` (`structured,files`), `EVAL_SCENARIOS` (`spec,rules`),
 * `EVAL_RUNS` (1), `EVAL_SPEC`, `EVAL_OUT` (`.tmp/ab-eval`).
 *
 * @module plugins/reformer/ai/loop/modes-ab-eval.test
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { describe, expect, it } from 'vitest';
import { emptyRules, emptySchema, type FormRules } from '../../../core/form-model';
import { builtinEntries } from '../../../core/testing';
import { composeForm } from '../files/compose';
import { createKnowledgeLoader } from '../knowledge';
import { printSchemaText } from '../model/schema-text';
import { validateSchema } from '../model/validate';
import { createByokProvider } from '../providers/byok';
import type { ProviderKind } from '../session/config';
import { createFakeFiles, createTestFileTurn, type FakeFiles } from '../testing';
import { createEditorToolRegistry } from '../tools';
import { createFileToolRegistry } from '../tools/files';
import type { TurnStats } from './drive';
import { runFileTurn } from './file-loop';
import { runAgentTurn } from './loop';

const MODEL = process.env.EVAL_MODEL;
const KIND = (process.env.EVAL_KIND ?? 'openai-compatible') as ProviderKind;
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:11434/v1';
const API_KEY = process.env.EVAL_API_KEY ?? (KIND === 'openai-compatible' ? 'ollama' : '');
const MODES = (process.env.EVAL_MODES ?? 'structured,files').split(',') as Mode[];
const SCENARIOS = (process.env.EVAL_SCENARIOS ?? 'spec,rules').split(',');
const RUNS = Number(process.env.EVAL_RUNS ?? 1);

// src/loop → src → ai → reformer → plugins → .ui_builder → reformer-builder-playground → projects → корень.
const REPO = fileURLToPath(new URL('../../../../../../../../', import.meta.url));
const SPEC = process.env.EVAL_SPEC ?? join(REPO, '.tmp/builder-spec-run/spec-slice.md');
const OUT = process.env.EVAL_OUT ?? join(REPO, '.tmp/ab-eval');
const TEMPLATE = join(
  REPO,
  'projects/reformer-builder-playground/forms/templates/reformer-multi-step-form'
);

type Mode = 'structured' | 'files';

const catalog = builtinEntries();
const knowledge = createKnowledgeLoader();

/** Итог одного прогона — строка отчёта. */
interface RunReport {
  scenario: string;
  mode: Mode;
  run: number;
  model: string;
  seconds: number;
  reason: string;
  stop?: unknown;
  stats: TurnStats;
  calls: Record<string, number>;
  refusals: Record<string, number>;
  form: { valid: boolean; errors: number; steps: number; fields: number; firstErrors: string[] };
  /** Сценарий spec: сколько ключей спеки нашлось среди путей модели формы. */
  coverage?: { expected: number; found: number };
  /** Сценарий rules: попала ли каждая просьба в форму. */
  rules?: { required: boolean; visibility: boolean; codeErrors?: number };
  /** Режим файлов: какие файлы записаны. */
  touched?: readonly string[];
}

// ── Сценарии ─────────────────────────────────────────────────────────────────

const SPEC_TASK = (spec: string): string => `Собери форму по спецификации ниже.

Что нужно сделать:
- шесть шагов мастера, названия шагов взять из заголовков «Шаг N: …»;
- все поля из таблиц: колонка «Ключ в форме» — путь модели, «Название поля» — подпись,
  «Тип поля» — компонент, «Значение» — значение по умолчанию;
- маски из колонки «Валидация» (записаны как mask: '...') поставить пропом компонента;
- составные ключи (например personalData.lastName) сохранить как есть, через точку.

Чего делать НЕ нужно:
- правила валидации;
- условную видимость полей;
- формулы вычисляемых полей (раздел «Вычисляемые поля» пропусти целиком).

Спецификация:

${spec}`;

const RULES_TASK =
  'Сделай поле «Город» обязательным. Поле «Должность» показывай только тогда, когда город ' +
  'заполнен. Больше ничего не меняй.';

/** Ключи модели из таблиц спеки: колонка «Ключ в форме». */
function specKeys(spec: string): string[] {
  const keys = new Set<string>();
  for (const table of spec.split('<table>').slice(1)) {
    // Заголовок — первая строка таблицы с ячейками `<th>`; `<thead>` в спеке нет.
    const rows = table.split('</table>')[0].split('<tr>').slice(1);
    const head = rows.find((row) => row.includes('<th>')) ?? '';
    const columns = [...head.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => m[1].trim());
    const at = columns.indexOf('Ключ в форме');
    if (at < 0) continue;
    for (const row of rows) {
      const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, '').trim()
      );
      const key = cells[at];
      if (key && /^[A-Za-z][\w.[\]]*$/.test(key)) keys.add(key);
    }
  }
  return [...keys];
}

/** Файлы шаблона — как они лежат в проекте, под корнем модуля `forms/ms/`. */
function templateFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        out[`forms/ms/${relative(TEMPLATE, full).replace(/\\/g, '/')}`] = readFileSync(
          full,
          'utf8'
        );
      }
    }
  };
  walk(TEMPLATE);
  return out;
}

// ── Прогон ───────────────────────────────────────────────────────────────────

function provider() {
  return createByokProvider({
    kind: KIND,
    ...(KIND === 'openai-compatible' ? { baseUrl: BASE_URL } : {}),
    model: MODEL ?? '',
    ...(API_KEY ? { apiKey: API_KEY } : {}),
  });
}

/** Что получилось у формы: валидность, шаги, поля. */
function formFacts(schema: JsonFormSchema | null): RunReport['form'] & { paths: string[] } {
  if (schema === null) {
    return {
      valid: false,
      errors: 1,
      steps: 0,
      fields: 0,
      firstErrors: ['form missing'],
      paths: [],
    };
  }
  const text = JSON.stringify(schema);
  const paths = [...text.matchAll(/\$model\(([^)]+)\)/g)].map((m) => m[1]);
  const { errors } = validateSchema(schema, { catalog, validateForm: validateFormSchema });
  return {
    valid: errors.length === 0,
    errors: errors.length,
    steps: (text.match(/\$component\(Step\)/g) ?? []).length,
    fields: paths.length,
    firstErrors: errors.slice(0, 3),
    paths,
  };
}

interface Turn {
  seconds: number;
  reason: string;
  stop?: unknown;
  stats: TurnStats;
  calls: Record<string, number>;
  refusals: Record<string, number>;
}

const EMPTY_STATS: TurnStats = {
  steps: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  peakStepInputTokens: 0,
};

/** Посчитать вызовы и отказы по событиям `tool`. */
function counter() {
  const calls: Record<string, number> = {};
  const refusals: Record<string, number> = {};
  return {
    calls,
    refusals,
    tool(event: { name: string; ok: boolean; error?: { code: string } }) {
      calls[event.name] = (calls[event.name] ?? 0) + 1;
      if (!event.ok) {
        const code = event.error?.code ?? 'UNKNOWN';
        refusals[code] = (refusals[code] ?? 0) + 1;
      }
    },
  };
}

/** Ход структурного режима над схемой. */
async function structuredTurn(
  base: JsonFormSchema,
  task: string
): Promise<Turn & { schema: JsonFormSchema; rules: FormRules }> {
  const started = Date.now();
  const count = counter();
  let result: Turn & { schema: JsonFormSchema; rules: FormRules } = {
    seconds: 0,
    reason: 'none',
    stats: EMPTY_STATS,
    calls: count.calls,
    refusals: count.refusals,
    schema: base,
    rules: emptyRules(),
  };
  for await (const event of runAgentTurn({
    provider: provider(),
    registry: createEditorToolRegistry({ knowledge }),
    catalog,
    validateForm: validateFormSchema,
    base,
    baseRules: emptyRules(),
    messages: [{ role: 'user', content: task }],
  })) {
    if (event.type === 'tool') {
      count.tool(event);
      console.info(`[ab]   ${event.name} ${event.ok ? 'ok' : `✗ ${event.error?.code ?? ''}`}`);
    }
    if (event.type === 'done') {
      result = {
        ...result,
        reason: event.reason,
        ...(event.stop ? { stop: event.stop } : {}),
        stats: event.stats,
        schema: event.changeSet.draft,
        rules: event.changeSet.draftRules,
      };
    }
  }
  return { ...result, seconds: Math.round((Date.now() - started) / 1000) };
}

/** Ход режима файлов над двойником модуля. */
async function filesTurn(
  files: FakeFiles,
  documentPath: string,
  task: string
): Promise<Turn & { touched: readonly string[] }> {
  const started = Date.now();
  const count = counter();
  const turn = await createTestFileTurn(files, { documentPath, knowledge });
  let result: Turn & { touched: readonly string[] } = {
    seconds: 0,
    reason: 'none',
    stats: EMPTY_STATS,
    calls: count.calls,
    refusals: count.refusals,
    touched: [],
  };
  for await (const event of runFileTurn({
    provider: provider(),
    registry: createFileToolRegistry({ knowledge }),
    turn,
    catalog,
    validateForm: validateFormSchema,
    messages: [{ role: 'user', content: task }],
  })) {
    if (event.type === 'tool') {
      count.tool(event);
      console.info(`[ab]   ${event.name} ${event.ok ? 'ok' : `✗ ${event.error?.code ?? ''}`}`);
    }
    if (event.type === 'done') {
      result = {
        ...result,
        reason: event.reason,
        ...(event.stop ? { stop: event.stop } : {}),
        stats: event.stats,
        touched: event.touched,
      };
    }
  }
  return { ...result, seconds: Math.round((Date.now() - started) / 1000) };
}

/** Форма, собранная из файлов модуля после хода. */
async function composedFrom(
  files: FakeFiles,
  documentPath: string
): Promise<JsonFormSchema | null> {
  const scope = files.scopeOf(documentPath);
  if (scope === null) return null;
  const composed = await composeForm(
    (rel) => files.read(files.resolve(scope.root, ...rel.split('/'))),
    scope.schemaPath
  );
  return composed.ok ? composed.schema : null;
}

/** Проверка кода правил модуля после хода — те же правила, что у гейта. */
async function codeErrors(files: FakeFiles, paths: readonly string[]): Promise<number> {
  const source = await knowledge();
  if (!source) return -1;
  const { validateCode } = await import('@reformer/mcp/dist/core/validate/code.js');
  let errors = 0;
  for (const path of paths) {
    const text = files.text(path);
    if (text === undefined) continue;
    const { diagnostics } = await validateCode(source.knowledge, text);
    errors += diagnostics.filter((d) => d.severity === 'error').length;
  }
  return errors;
}

function save(report: RunReport): void {
  mkdirSync(OUT, { recursive: true });
  const name = `${report.scenario}-${report.mode}-${report.run}`;
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(report, null, 2));
  console.info(
    `[ab] ${report.scenario}/${report.mode}#${report.run}: ${report.seconds}s, шагов ${report.stats.steps}, ` +
      `вход ${report.stats.inputTokens}, вызовы ${JSON.stringify(report.calls)}, отказы ` +
      `${JSON.stringify(report.refusals)}, форма ${JSON.stringify(report.form)}` +
      (report.coverage ? `, ключей ${report.coverage.found}/${report.coverage.expected}` : '') +
      (report.rules ? `, правила ${JSON.stringify(report.rules)}` : '')
  );
}

/**
 * Сохранить записанные ходом файлы модуля рядом с отчётом прогона — чтобы результат можно было
 * открыть глазами, а не только прочитать счётом.
 */
function dumpModule(files: FakeFiles, prefix: string, name: string): void {
  mkdirSync(join(OUT, name), { recursive: true });
  for (const path of new Set(files.writes.map((write) => write.path))) {
    const text = files.text(path);
    if (text === undefined || !path.startsWith(prefix)) continue;
    writeFileSync(join(OUT, name, path.slice(prefix.length).replace(/\//g, '__')), text);
  }
}

// ── Замер ────────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;

describe.skipIf(!MODEL)('A/B: структурный режим против режима файлов', () => {
  for (const mode of MODES) {
    for (let run = 1; run <= RUNS; run += 1) {
      it.runIf(SCENARIOS.includes('spec'))(
        `spec — ${mode} #${run}`,
        async () => {
          const spec = readFileSync(SPEC, 'utf8');
          const expected = specKeys(spec);
          const task = SPEC_TASK(spec);
          const base = emptySchema();

          let turn: Turn;
          let schema: JsonFormSchema | null;
          let touched: readonly string[] | undefined;
          if (mode === 'structured') {
            const result = await structuredTurn(base, task);
            turn = result;
            schema = result.schema;
            mkdirSync(OUT, { recursive: true });
            writeFileSync(join(OUT, `spec-structured-${run}.schema.json`), printSchemaText(schema));
          } else {
            const document = 'forms/credit/schema/form.schema.json';
            const files = createFakeFiles({ [document]: printSchemaText(base) });
            const result = await filesTurn(files, document, task);
            turn = result;
            touched = result.touched;
            schema = await composedFrom(files, document);
            dumpModule(files, 'forms/credit/', `spec-files-${run}`);
          }

          const facts = formFacts(schema);
          const found = expected.filter((key) => facts.paths.includes(key)).length;
          const { paths: _paths, ...form } = facts;
          save({
            scenario: 'spec',
            mode,
            run,
            model: MODEL ?? '',
            ...turn,
            form,
            coverage: { expected: expected.length, found },
            ...(touched ? { touched } : {}),
          });
          // Замер, а не приёмка: падает только на том, чего режим обещает не допускать.
          if (mode === 'files') expect(form.valid).toBe(true);
        },
        HOUR
      );

      it.runIf(SCENARIOS.includes('rules'))(
        `rules — ${mode} #${run}`,
        async () => {
          const initial = templateFiles();
          const document = 'forms/ms/schema/form.schema.json';
          const files = createFakeFiles(initial);

          let turn: Turn;
          let schema: JsonFormSchema | null;
          let rules: RunReport['rules'];
          let touched: readonly string[] | undefined;
          if (mode === 'structured') {
            const base = await composedFrom(files, document);
            if (base === null) throw new Error('шаблон не собрался');
            const result = await structuredTurn(base, RULES_TASK);
            turn = result;
            schema = result.schema;
            const required = result.rules.validation.some(
              (rule) => rule.target === 'city' && rule.rules.some((r) => r.startsWith('required'))
            );
            const visibility =
              result.rules.render.some(
                (rule) => rule.kind === 'hideWhen' && /city/.test(rule.condition)
              ) ||
              result.rules.behavior.some(
                (rule) => rule.target === 'position' && rule.sources.includes('city')
              );
            rules = { required, visibility };
            mkdirSync(OUT, { recursive: true });
            writeFileSync(
              join(OUT, `rules-structured-${run}.rules.json`),
              JSON.stringify(result.rules, null, 2)
            );
          } else {
            const result = await filesTurn(files, document, RULES_TASK);
            turn = result;
            touched = result.touched;
            schema = await composedFrom(files, document);
            dumpModule(files, 'forms/ms/', `rules-files-${run}`);
            const rulesFiles = Object.keys(initial).filter((path) =>
              /\/(validation|behavior)\/.*\.ts$/.test(path)
            );
            const code = rulesFiles
              .map((path) => files.text(path) ?? '')
              .join('\n')
              .replace(/\/\/.*$/gm, '');
            const required = /validate\(model\.\$\.city,\s*\[[^\]]*required\(/.test(code);
            const visibility =
              /(hideWhen|showWhen|visibleWhen|enableWhen)\([^;]*position[^;]*city/s.test(code) ||
              /(hideWhen|showWhen|visibleWhen|enableWhen)\([^;]*city[^;]*position/s.test(code);
            rules = { required, visibility, codeErrors: await codeErrors(files, rulesFiles) };
          }

          const { paths: _paths, ...form } = formFacts(schema);
          save({
            scenario: 'rules',
            mode,
            run,
            model: MODEL ?? '',
            ...turn,
            form,
            rules,
            ...(touched ? { touched } : {}),
          });
          if (mode === 'files') expect(form.valid).toBe(true);
        },
        HOUR
      );
    }
  }
});

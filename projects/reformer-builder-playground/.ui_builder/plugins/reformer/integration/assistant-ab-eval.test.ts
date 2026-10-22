/**
 * A/B-замер ассистента: режим структурных инструментов против режима файлов — с живой моделью и
 * с РАБОЧЕЙ формой на выходе.
 *
 * Каждый прогон кончается не только счётом, но и модулем формы, который можно открыть: итог хода
 * печатается кодогеном домена (той же доставкой, что «Сгенерировать» в билдере) в
 * `projects/react-playground/src/pages/debug/builder-ab/<сценарий>-<режим>/`, а страница
 * `/debug/builder-ab` стенда собирает все такие модули и показывает их рядом со счётом прогона.
 *
 * Сценарии:
 * - **spec** — форма кредитной заявки с нуля по спецификации (задание дословно из прошлого замера,
 *   `.tmp/builder-spec-run/full.run.ts`): шесть шагов мастера и поля из таблиц;
 * - **rules** — правила на готовой форме шаблона `reformer-multi-step-form`: обязательное поле и
 *   условная видимость. Структурный режим пишет правила в память моста — модуль печатается с ними,
 *   то есть в лучшем для него случае; файловый пишет их в код модуля сам. Оба начинают с правил
 *   затравки шаблона ({@link templateSeed}): иначе печать сняла бы с формы её собственные правила.
 *
 * Живёт в `integration/`, а не в плагине ассистента: печать модуля — кодоген, соседний плагин, а
 * плагины домена друг друга не импортируют. Каталог `integration/` видит их все.
 *
 * По умолчанию НЕ запускается: нужен живой канал. Запуск из этого каталога — `npx vitest run`
 * напрямую, мимо `scripts/run-vitest.mjs` (минута тишины для обёртки — зависание):
 *
 * `EVAL_MODEL=qwen3.8:27b-32k npx vitest run assistant-ab-eval.test.ts`
 *
 * Переменные: `EVAL_KIND` (`openai-compatible` | `anthropic` | `openai`), `EVAL_BASE_URL`,
 * `EVAL_API_KEY`, `EVAL_MODES` (`structured,files`), `EVAL_SCENARIOS` (`spec,rules`),
 * `EVAL_RUNS` (1), `EVAL_SPEC`, `EVAL_OUT` (`.tmp/ab-eval`), `EVAL_DRY` (`1` — без модели),
 * `EVAL_PAGES` (`1` — печатать модули в стенд; `0` — только счёт).
 *
 * @module plugins/reformer/integration/assistant-ab-eval.test
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { isGenerated } from '@reformer/builder-toolkit';
import { Agent, setGlobalDispatcher } from 'undici';
import { describe, expect, it } from 'vitest';
import { BUILTIN_TARGETS, generateModule } from '../codegen/src';
import { makeNames } from '../core/codegen';
import { emptyRules, emptySchema, type FormRules, type StepOrigins } from '../core/form-model';
import { builtinEntries, builtinKit } from '../core/testing';
import { composeForm } from '../ai/src/files/compose';
import { createKnowledgeLoader } from '../ai/src/knowledge';
import type { TurnStats } from '../ai/src/loop/drive';
import { runFileTurn } from '../ai/src/loop/file-loop';
import { runAgentTurn } from '../ai/src/loop/loop';
import { printSchemaText } from '../ai/src/model/schema-text';
import { validateSchema } from '../ai/src/model/validate';
import { createByokProvider } from '../ai/src/providers/byok';
import { createFakeProvider } from '../ai/src/providers/fake';
import type { AiProvider } from '../ai/src/providers/types';
import type { ProviderKind } from '../ai/src/session/config';
import { createFakeFiles, createTestFileTurn, type FakeFiles } from '../ai/src/testing';
import { createEditorToolRegistry } from '../ai/src/tools';
import { createFileToolRegistry } from '../ai/src/tools/files';
import { createBuiltinStore, WIZARD_TEMPLATE_ID, type SeedExtras } from '../templates/src';

const MODEL = process.env.EVAL_MODEL;
const KIND = (process.env.EVAL_KIND ?? 'openai-compatible') as ProviderKind;
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:11434/v1';
const API_KEY = process.env.EVAL_API_KEY ?? (KIND === 'openai-compatible' ? 'ollama' : '');
const MODES = (process.env.EVAL_MODES ?? 'structured,files').split(',') as Mode[];
const SCENARIOS = (process.env.EVAL_SCENARIOS ?? 'spec,rules').split(',');
const RUNS = Number(process.env.EVAL_RUNS ?? 1);
const PAGES = process.env.EVAL_PAGES !== '0';
/** Сухой прогон без модели — `EVAL_DRY=1`. */
const DRY = process.env.EVAL_DRY === '1';

// Живой канал — без таймаутов `fetch` Node. У его undici по умолчанию `bodyTimeout` и
// `headersTimeout` по пять минут, а Ollama отдаёт аргументы вызова инструмента одним куском, когда
// вызов дописан: запись файла шага на пяти токенах в секунду молчит дольше, и замер обрывался на
// первой же записи ошибкой, которой в браузере, где работает билдер, нет вовсе (ReFormer-lhvk.5).
if (MODEL && !DRY) setGlobalDispatcher(new Agent({ bodyTimeout: 0, headersTimeout: 0 }));

// integration → reformer → plugins → .ui_builder → reformer-builder-playground → projects → корень.
const REPO = fileURLToPath(new URL('../../../../../../', import.meta.url));
const SPEC = process.env.EVAL_SPEC ?? join(REPO, '.tmp/builder-spec-run/spec-slice.md');
const OUT = process.env.EVAL_OUT ?? join(REPO, '.tmp/ab-eval');
const TEMPLATE = join(
  REPO,
  'projects/reformer-builder-playground/forms/templates/reformer-multi-step-form'
);
/** Каталог стенда, куда печатаются модули прогонов. */
const PAGES_DIR = resolve(REPO, 'projects/react-playground/src/pages/debug/builder-ab');

/** Имя формы шаблона: авторские файлы шаблона импортируют типы под этим именем. */
const TEMPLATE_FORM = 'reformer-multi-step-form';
/** Имя формы кредитной заявки. */
const SPEC_FORM = 'credit-application';

type Mode = 'structured' | 'files';

const catalog = builtinEntries();
const knowledge = createKnowledgeLoader();

/** Итог одного прогона — строка отчёта; она же `meta.json` модуля в стенде. */
interface RunReport {
  scenario: string;
  mode: Mode;
  run: number;
  model: string;
  date: string;
  seconds: number;
  reason: string;
  stop?: unknown;
  /** Текст ошибки, которой кончился ход. */
  message?: string;
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
  /** Ответ модели пользователю — последним текстом хода. */
  answer: string;
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

/** Файлы под каталогом `root` — пути от него через `/`; каталога нет — пусто. */
function filesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full).replace(/\\/g, '/'));
    }
  };
  if (existsSync(root)) walk(root);
  return out;
}

/** Файлы шаблона — пути от корня модуля. */
function templateFiles(): Map<string, string> {
  return new Map(
    filesUnder(TEMPLATE).map((path) => [path, readFileSync(join(TEMPLATE, path), 'utf8')])
  );
}

/**
 * Затравка встроенного шаблона «Пошаговая форма»: правила и мок, из которых напечатан шаблон.
 *
 * Файлы правил шаблона (`validation/*.ts`, `behavior/index.ts`) несут маркер кодогена, то есть
 * при печати модуля перепечатываются из ПРАВИЛ. Без правил затравки они уехали бы заготовками —
 * форма потеряла бы и обязательные поля шаблона, и скрытие поручителей, а типы источников
 * стали бы синтезированными `option1/2/3`. Берётся тем же путём, что в тесте встроенных
 * шаблонов: хранилище печатает шаблоны, печатник запоминает свой вход.
 */
async function templateSeed(): Promise<SeedExtras> {
  const view = builtinKit();
  const seeds: (SeedExtras | undefined)[] = [];
  const templates = await createBuiltinStore({
    print: async (schema, formName, seed) => {
      seeds.push(seed);
      const built = await generateModule(BUILTIN_TARGETS, {
        schema,
        formName,
        rules: seed?.rules,
        mock: seed?.mock,
        splitSteps: seed?.splitSteps,
        kit: view,
      });
      return built.files.map(({ path, content }) => ({ path, content }));
    },
    catalog: () => view.catalog,
    kit: () => view.kit,
  }).list();
  const seed = seeds[templates.findIndex((template) => template.id === WIZARD_TEMPLATE_ID)];
  if (seed?.rules === undefined) throw new Error('у шаблона «Пошаговая форма» нет правил');
  return seed;
}

/** Файлы модуля под корнем `root` двойника — как они лежат после хода. */
function moduleFilesOfFake(
  files: FakeFiles,
  root: string,
  known: Iterable<string>
): Map<string, string> {
  const paths = new Set([...known, ...files.writes.map((write) => write.path)]);
  const out = new Map<string, string>();
  for (const path of paths) {
    if (!path.startsWith(`${root}/`)) continue;
    const text = files.text(path);
    if (text !== undefined) out.set(path.slice(root.length + 1), text);
  }
  return out;
}

// ── Прогон ───────────────────────────────────────────────────────────────────

function provider(): AiProvider {
  // Сухой прогон: модель «ничего не делает», и модуль печатается из исходной формы. Проверяет
  // цепочку печати в стенд без живого канала — и что напечатанное собирается в приложении.
  if (DRY) return createFakeProvider([{ text: '(сухой прогон: модель не вызывалась)' }]);
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
  message?: string;
  stats: TurnStats;
  calls: Record<string, number>;
  refusals: Record<string, number>;
  answer: string;
}

/** Только поля хода — без схемы и правил, которые несёт исход структурного режима. */
function turnOf(outcome: Turn): Turn {
  const { seconds, reason, stop, message, stats, calls, refusals, answer } = outcome;
  return {
    seconds,
    reason,
    ...(stop ? { stop } : {}),
    ...(message ? { message } : {}),
    stats,
    calls,
    refusals,
    answer,
  };
}

const EMPTY_STATS: TurnStats = {
  steps: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  peakStepInputTokens: 0,
};

/** Счётчик вызовов, отказов и ответа модели по событиям хода. */
function recorder() {
  const calls: Record<string, number> = {};
  const refusals: Record<string, number> = {};
  let answer = '';
  return {
    calls,
    refusals,
    answer: () => answer.trim(),
    event(event: {
      type: string;
      name?: string;
      ok?: boolean;
      text?: string;
      error?: { code: string };
    }) {
      if (event.type === 'text') answer += event.text ?? '';
      if (event.type !== 'tool' || event.name === undefined) return;
      calls[event.name] = (calls[event.name] ?? 0) + 1;
      if (!event.ok) {
        const code = event.error?.code ?? 'UNKNOWN';
        refusals[code] = (refusals[code] ?? 0) + 1;
      }
      console.info(`[ab]   ${event.name} ${event.ok ? 'ok' : `✗ ${event.error?.code ?? ''}`}`);
    },
  };
}

/**
 * Ход структурного режима над схемой.
 *
 * @param baseRules - Правила формы на начало хода: у шаблона — правила его затравки.
 */
async function structuredTurn(
  base: JsonFormSchema,
  task: string,
  baseRules: FormRules = emptyRules()
): Promise<Turn & { schema: JsonFormSchema; rules: FormRules }> {
  const started = Date.now();
  const record = recorder();
  let result = {
    reason: 'none',
    stats: EMPTY_STATS,
    schema: base,
    rules: baseRules,
  } as {
    reason: string;
    stop?: unknown;
    message?: string;
    stats: TurnStats;
    schema: JsonFormSchema;
    rules: FormRules;
  };
  for await (const event of runAgentTurn({
    provider: provider(),
    registry: createEditorToolRegistry({ knowledge }),
    catalog,
    validateForm: validateFormSchema,
    base,
    baseRules,
    messages: [{ role: 'user', content: task }],
  })) {
    if (event.type !== 'done') record.event(event);
    else {
      result = {
        reason: event.reason,
        ...(event.stop ? { stop: event.stop } : {}),
        ...(event.message ? { message: event.message } : {}),
        stats: event.stats,
        schema: event.changeSet.draft,
        rules: event.changeSet.draftRules,
      };
    }
  }
  return {
    ...result,
    calls: record.calls,
    refusals: record.refusals,
    answer: record.answer(),
    seconds: Math.round((Date.now() - started) / 1000),
  };
}

/** Ход режима файлов над двойником модуля. */
async function filesTurn(
  files: FakeFiles,
  documentPath: string,
  task: string
): Promise<Turn & { touched: readonly string[] }> {
  const started = Date.now();
  const record = recorder();
  const turn = await createTestFileTurn(files, { documentPath, knowledge });
  let result = { reason: 'none', stats: EMPTY_STATS, touched: [] } as {
    reason: string;
    stop?: unknown;
    message?: string;
    stats: TurnStats;
    touched: readonly string[];
  };
  for await (const event of runFileTurn({
    provider: provider(),
    registry: createFileToolRegistry({ knowledge }),
    turn,
    catalog,
    validateForm: validateFormSchema,
    messages: [{ role: 'user', content: task }],
  })) {
    if (event.type !== 'done') record.event(event);
    else {
      result = {
        reason: event.reason,
        ...(event.stop ? { stop: event.stop } : {}),
        ...(event.message ? { message: event.message } : {}),
        stats: event.stats,
        touched: event.touched,
      };
    }
  }
  return {
    ...result,
    calls: record.calls,
    refusals: record.refusals,
    answer: record.answer(),
    seconds: Math.round((Date.now() - started) / 1000),
  };
}

/** Форма, собранная из файлов модуля после хода, — вместе с происхождением шагов. */
async function composedFrom(
  files: FakeFiles,
  documentPath: string
): Promise<{ schema: JsonFormSchema; origins?: StepOrigins } | null> {
  const scope = files.scopeOf(documentPath);
  if (scope === null) return null;
  const composed = await composeForm(
    (rel) => files.read(files.resolve(scope.root, ...rel.split('/'))),
    scope.schemaPath
  );
  if (!composed.ok) return null;
  return { schema: composed.schema, ...(composed.origins ? { origins: composed.origins } : {}) };
}

/** Проверка кода правил модуля после хода — те же правила, что у гейта. */
async function codeErrors(files: ReadonlyMap<string, string>): Promise<number> {
  const source = await knowledge();
  if (!source) return -1;
  const { validateCode } = await import('@reformer/mcp/dist/core/validate/code.js');
  let errors = 0;
  for (const [path, text] of files) {
    if (!/^(validation|behavior)\/.*\.ts$/.test(path)) continue;
    const { diagnostics } = await validateCode(source.knowledge, text);
    errors += diagnostics.filter((d) => d.severity === 'error').length;
  }
  return errors;
}

/**
 * Напечатать модуль прогона в стенд — доставкой, как «Сгенерировать» в билдере.
 *
 * Производный файл печатается всегда; авторский — если его нет или он всё ещё несёт маркер
 * кодогена; авторский, который правили (модель или человек), остаётся как есть. Так модуль
 * режима файлов сохраняет код правил, который модель написала сама, а производные файлы
 * (модель, типы, страница) печатаются по итоговой схеме.
 */
async function exportModule(
  name: string,
  formName: string,
  input: {
    schema: JsonFormSchema;
    origins?: StepOrigins;
    rules?: FormRules;
    mock?: SeedExtras['mock'];
    existing?: ReadonlyMap<string, string>;
  },
  report: RunReport
): Promise<void> {
  const generated = await generateModule(BUILTIN_TARGETS, {
    schema: input.schema,
    formName,
    kit: builtinKit(),
    ...(input.rules ? { rules: input.rules } : {}),
    ...(input.mock ? { mock: input.mock } : {}),
    ...(input.origins ? { origins: input.origins } : {}),
  });
  const files = new Map(input.existing ?? []);
  // Фикстура — данные предпросмотра билдера; странице стенда она не нужна.
  files.delete('fixture.ts');
  for (const file of generated.files) {
    const current = files.get(file.path);
    if (
      file.cls === 'derived' ||
      current === undefined ||
      (file.regenerable && isGenerated(current))
    ) {
      files.set(file.path, file.content);
    }
  }

  const dir = resolve(PAGES_DIR, name);
  if (!dir.startsWith(`${PAGES_DIR}`) || dir === PAGES_DIR) {
    throw new Error(`каталог модуля вне стенда: ${dir}`);
  }
  files.set(
    'meta.json',
    `${JSON.stringify({ ...report, page: `${makeNames(formName).TypeName}.tsx` }, null, 2)}\n`
  );
  // Каталог прогона НЕ удаляется целиком: запущенный dev-сервер стенда на Windows пропускает
  // пересоздание каталога и продолжает отдавать прежние модули. Поэтому лишние файлы удаляются
  // по одному, а изменившиеся переписываются на месте — наблюдатель видит обычные правки.
  for (const path of filesUnder(dir)) {
    if (!files.has(path)) rmSync(join(dir, path));
  }
  for (const [path, text] of files) {
    const target = join(dir, path);
    if (existsSync(target) && readFileSync(target, 'utf8') === text) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  if (generated.problems.length) {
    console.warn(`[ab] кодоген ${name}:`, generated.problems);
  }
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
      (report.rules ? `, правила ${JSON.stringify(report.rules)}` : '') +
      (report.message ? `, ошибка: ${report.message}` : '')
  );
}

/** Имя каталога прогона в стенде: номер прогона — только если прогонов несколько. */
const pageName = (scenario: string, mode: Mode, run: number): string =>
  RUNS > 1 ? `${scenario}-${mode}-${run}` : `${scenario}-${mode}`;

// ── Замер ────────────────────────────────────────────────────────────────────

/**
 * Предел одного прогона. Это не оценка, а страховка от вечного теста: на локальной модели в пять
 * токенов в секунду форма на 82 поля — часы, и обрезанный vitest-ом ход не напечатал бы ничего.
 */
const RUN_LIMIT = 4 * 3_600_000;

describe.skipIf(!MODEL && !DRY)('A/B ассистента: структурный режим против режима файлов', () => {
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
          let result: { schema: JsonFormSchema; origins?: StepOrigins } | null;
          let rules: FormRules | undefined;
          let existing: Map<string, string> | undefined;
          let touched: readonly string[] | undefined;
          if (mode === 'structured') {
            const outcome = await structuredTurn(base, task);
            turn = turnOf(outcome);
            result = { schema: outcome.schema };
            rules = outcome.rules;
          } else {
            const root = `forms/${SPEC_FORM}`;
            const document = `${root}/schema/form.schema.json`;
            const files = createFakeFiles({ [document]: printSchemaText(base) });
            const outcome = await filesTurn(files, document, task);
            turn = turnOf(outcome);
            touched = outcome.touched;
            result = await composedFrom(files, document);
            existing = moduleFilesOfFake(files, root, [document]);
          }

          const { paths, ...form } = formFacts(result?.schema ?? null);
          const report: RunReport = {
            scenario: 'spec',
            mode,
            run,
            model: DRY ? 'dry-run' : (MODEL ?? ''),
            date: new Date().toISOString(),
            ...turn,
            form,
            coverage: {
              expected: expected.length,
              found: expected.filter((key) => paths.includes(key)).length,
            },
            ...(touched ? { touched } : {}),
          };
          save(report);
          if (PAGES && result) {
            await exportModule(
              pageName('spec', mode, run),
              SPEC_FORM,
              { ...result, ...(rules ? { rules } : {}), ...(existing ? { existing } : {}) },
              report
            );
          }
          // Замер, а не приёмка: падает только на том, чего режим обещает не допускать.
          if (mode === 'files') expect(form.valid).toBe(true);
        },
        RUN_LIMIT
      );

      it.runIf(SCENARIOS.includes('rules'))(
        `rules — ${mode} #${run}`,
        async () => {
          const template = templateFiles();
          const root = `forms/${TEMPLATE_FORM}`;
          const document = `${root}/schema/form.schema.json`;
          const files = createFakeFiles(
            Object.fromEntries([...template].map(([path, text]) => [`${root}/${path}`, text]))
          );
          const start = await composedFrom(files, document);
          if (start === null) throw new Error('шаблон не собрался');
          const seed = await templateSeed();

          let turn: Turn;
          let result: { schema: JsonFormSchema; origins?: StepOrigins } | null;
          // Правила формы для печати: у режима файлов — правила шаблона (файлы, которые модель не
          // тронула, перепечатаются ровно такими, какими были), у структурного — итог хода.
          let rules: FormRules | undefined = seed.rules;
          let flags: RunReport['rules'];
          let existing: Map<string, string>;
          let touched: readonly string[] | undefined;
          if (mode === 'structured') {
            const outcome = await structuredTurn(start.schema, RULES_TASK, seed.rules);
            turn = turnOf(outcome);
            // Шаги сохраняют идентификаторы — происхождение базы годится и для итога.
            result = {
              schema: outcome.schema,
              ...(start.origins ? { origins: start.origins } : {}),
            };
            rules = outcome.rules;
            existing = template;
            flags = {
              required: outcome.rules.validation.some(
                (rule) => rule.target === 'city' && rule.rules.some((r) => r.startsWith('required'))
              ),
              visibility:
                outcome.rules.render.some(
                  (rule) => rule.kind === 'hideWhen' && /city/.test(rule.condition)
                ) ||
                outcome.rules.behavior.some(
                  (rule) => rule.target === 'position' && rule.sources.includes('city')
                ),
            };
          } else {
            const outcome = await filesTurn(files, document, RULES_TASK);
            turn = turnOf(outcome);
            touched = outcome.touched;
            result = await composedFrom(files, document);
            existing = moduleFilesOfFake(
              files,
              root,
              [...template.keys()].map((path) => `${root}/${path}`)
            );
            const code = [...existing]
              .filter(([path]) => /^(validation|behavior)\//.test(path))
              .map(([, text]) => text)
              .join('\n')
              .replace(/\/\/.*$/gm, '');
            flags = {
              required: /validate\(model\.\$\.city,\s*\[[^\]]*required\(/.test(code),
              visibility:
                /(hideWhen|showWhen|visibleWhen|enableWhen)\([^;]*position[^;]*city/s.test(code) ||
                /(hideWhen|showWhen|visibleWhen|enableWhen)\([^;]*city[^;]*position/s.test(code),
              codeErrors: await codeErrors(existing),
            };
          }

          const { paths: _paths, ...form } = formFacts(result?.schema ?? null);
          const report: RunReport = {
            scenario: 'rules',
            mode,
            run,
            model: DRY ? 'dry-run' : (MODEL ?? ''),
            date: new Date().toISOString(),
            ...turn,
            form,
            rules: flags,
            ...(touched ? { touched } : {}),
          };
          save(report);
          if (PAGES && result) {
            await exportModule(
              pageName('rules', mode, run),
              TEMPLATE_FORM,
              {
                ...result,
                ...(rules ? { rules } : {}),
                ...(seed.mock ? { mock: seed.mock } : {}),
                existing,
              },
              report
            );
          }
          if (mode === 'files') expect(form.valid).toBe(true);
        },
        RUN_LIMIT
      );
    }
  }
});

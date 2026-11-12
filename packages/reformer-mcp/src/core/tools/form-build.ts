/**
 * Tool `form_build`: собрать модуль формы на диск из `form.intent.json`.
 *
 * Единственный путь создания формы в профиле node (с 7.0). Прежний `generate_form` возвращал файлы
 * текстом, и агент печатал их заново: форма кредита стоила два вывода вместо одного, поэтому на
 * больших формах агенты его обходили и писали код вручную, читая справку. Здесь агент правит только
 * intent своими Write и Edit, а сервер компилирует, проверяет и пишет сам, отвечая одной
 * диагностикой. Замер и критерии — `docs/plans/mcp-misty-graham.md`, единый путь —
 * `docs/plans/mcp-audit-one-path.md`.
 *
 * Грамматику intent инструмент отдаёт по запросу `grammar` — без диска — и вместо сборки, пока файла
 * intent нет.
 *
 * Запись — «всё или ничего»: при любой ошибке диск не меняется. Запись на диск отдана порту
 * `FormWorkspace`, поэтому в браузерном профиле инструмента нет.
 *
 * @module reformer-mcp/core/tools/form-build
 */

import { buildAssemblyTsx, buildOperatorStubs, OPERATOR_STUB_MARK } from '../generate/builders.js';
import { catalogsOf } from '../generate/catalogs.js';
import { originOf, withMarker } from '../generate/generated-marker.js';
import { GRAMMAR_SECTIONS, intentGrammar, readGrammarRequest } from '../generate/intent-grammar.js';
import { judgeIntent, type IntentVerdict, type JudgeFinding } from '../generate/judge.js';
import type { Knowledge } from '../knowledge.js';
import { unindexedLimitation, validateCode } from '../validate/code.js';
import type { FormDirectory, FormFile, TypeDiagnostic } from '../workspace/form-workspace.js';
import { invalidCall, type ToolTextResult } from './tool-result.js';

export const INTENT_FILE = 'form.intent.json';

/** Необязательные файлы сборки: исчезли из бандла — их нетронутая копия удаляется с диска. */
/**
 * Производные файлы, которых сборка может и не выпустить: шагов нет, текстов нет, другой таргет.
 * Невыпущенный и нетронутый руками убирается. Схема — в обоих видах: renderer-json пишет её
 * данными (`form.schema.json`), остальные таргеты — кодом (`form.schema.ts`), и прежний вид при
 * смене таргета или сборкой до 2026-11-11 остался бы лежать рядом.
 */
const OPTIONAL_DERIVED = [
  'form.flow.ts',
  'form.messages.ts',
  'registry.ts',
  'form.schema.ts',
  'form.schema.json',
];

/*
 * Строки ответа — контракт стендов: `eval/calibration/lib/bundle.mjs` (`parseFormBuild`) и
 * `eval/scenarios/catalog.mjs` разбирают первую строку `✓`/`✗ form_build`, `Types checked`,
 * `Warnings: N.` и пункты `- …`. Формат описан в `docs/llms/02-tools.md` § form_build и закреплён
 * тестом «ответ — контракт стендов» в `tests/form-build.test.ts`: правка строки здесь без правки
 * разборщика молча ломала бы замеры.
 */

/** Сколько ошибок печатать: дальше агент всё равно правит и собирает заново. */
export const MAX_ERRORS = 12;
/** Потолок предупреждений: судья ставит меняющие смысл первыми, за потолком — их число. */
export const MAX_WARNINGS = 20;

/** Пункты списка ответа: не больше `max`, за потолком — строка `… and N more.`. */
function bullets(items: readonly string[], max: number): string[] {
  return [
    ...items.slice(0, max).map((item) => `- ${item}`),
    ...(items.length > max ? [`… and ${items.length - max} more.`] : []),
  ];
}

export const formBuildToolDefinition = {
  name: 'form_build',
  description:
    'Build a form module on disk from <dir>/form.intent.json: compiles it, cross-checks it, type-checks the result and WRITES all module files itself, returning only diagnostics. You author and edit only form.intent.json with your own Write/Edit; nothing is written while errors remain. Start with {"grammar":"base"} — the intent grammar, no project or file needed; further sections on demand. Keep the requested stack in "target": on core you also write the JSX markup in index.tsx.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: {
        type: 'string',
        description:
          'Form folder, relative to the working directory (default "form"; required at a monorepo root).',
      },
      grammar: {
        type: 'string',
        description: `Return the intent grammar instead of building: "base", a section (${GRAMMAR_SECTIONS.join(', ')}), several comma-separated, or "all"; "components:Card,Tabs" — parts and props of kit components.`,
      },
    },
    required: [],
  },
};

export interface FormBuildArgs {
  dir?: unknown;
  grammar?: unknown;
}

function failure(heading: string, items: readonly string[]): ToolTextResult {
  return invalidCall(
    [`✗ form_build: ${heading} — nothing written.`, ...bullets(items, MAX_ERRORS)].join('\n')
  );
}

/** Находка судьи строкой ответа: код, место, что не так и что сделать. */
export function renderFinding(finding: JudgeFinding<string>): string {
  const where = finding.at ? ` at \`${finding.at}\`` : '';
  const hint = finding.hint ? ` → ${finding.hint}` : '';
  return `${finding.code}${where}: ${finding.message}${hint}`;
}

/** Заголовок отказа по вердикту: что за ошибки — чтение, окружение или сама форма. */
function verdictHeading(verdict: IntentVerdict): string {
  const { errors } = verdict;
  if (errors.every((error) => error.code === 'environment')) return 'the environment';
  const read = errors.filter((error) => error.at !== undefined && READ_CODES.has(error.code));
  if (read.length === errors.length) return `${INTENT_FILE} is not read in full`;
  return `${errors.length} error${errors.length === 1 ? '' : 's'}`;
}

/** Коды проблем чтения: отказ по ним — «intent не прочитан», а не ошибки формы. */
const READ_CODES: ReadonlySet<string> = new Set([
  'intent-unreadable',
  'not-an-object',
  'missing-key',
  'unknown-key',
  'key-conflict',
  'prop-unsupported',
  'invalid-value',
  'unknown-kind',
  'duplicate',
  'inert-behavior',
]);

/**
 * Ошибка типов с тем, где её править. Сгенерированный файл правят через intent: сборка перепишет
 * его следующим вызовом. Файл агента — `index.tsx` на core, свои операторы, `types.ts`, `api.ts`,
 * отсоединённые правкой — правят в нём самом. Раньше на всё был один совет «правь intent», и ошибку в
 * своей разметке агент искал в intent.
 */
function renderTypeError(diagnostic: TypeDiagnostic, own: ReadonlySet<string>): string {
  const place =
    diagnostic.line === null ? diagnostic.file : `${diagnostic.file}:${diagnostic.line}`;
  const fix = own.has(diagnostic.file)
    ? `fix ${diagnostic.file} — it is your file`
    : `fix ${INTENT_FILE} — the build writes ${diagnostic.file}`;
  const line = diagnostic.source ? `\n  in line: ${diagnostic.source}` : '';
  return `${place} ${diagnostic.message} → ${fix}${line}`;
}

/** Модуль `@reformer/*`, который компилятор не нашёл (TS2307): это окружение, а не форма. */
function missingReformerModule(diagnostic: TypeDiagnostic): string | null {
  if (diagnostic.code !== 2307) return null;
  return /['"](@reformer\/[^'"]+)['"]/.exec(diagnostic.message)?.[1] ?? null;
}

/** Что и как лежит на диске после сборки: решение принимается до записи. */
interface BuildPlan {
  /** Модуль целиком, как его увидит компилятор: с файлами, правленными руками. */
  module: FormFile[];
  writes: FormFile[];
  removes: string[];
  unchanged: number;
  /** Файлы с правками: сборка их не трогает и об этом говорит. */
  detached: string[];
  /**
   * Правленные руками файлы, которых эта сборка больше не выпускает: модуль их не читает. Так
   * осталась правка `form.schema.ts` после перехода renderer-json на `form.schema.json` — молча она
   * перестала бы действовать.
   */
  orphaned: string[];
}

/**
 * Решить судьбу каждого файла.
 *
 * Производные файлы, включая `index.tsx`, собираются при каждом вызове: иначе точка входа, созданная
 * до появления правил, навсегда осталась бы без провайдера текстов. Файл, правленный руками,
 * отсоединяется. `types.ts` и `api.ts` принадлежат потребителю с первого дня.
 */
function planBuild(directory: FormDirectory, derived: FormFile[], owned: FormFile[]): BuildPlan {
  const plan: BuildPlan = {
    module: [],
    writes: [],
    removes: [],
    unchanged: 0,
    detached: [],
    orphaned: [],
  };
  for (const file of derived) {
    const next = withMarker(file.content, file.path);
    const existing = directory.read(file.path);
    if (existing === null) {
      plan.writes.push({ path: file.path, content: next });
      plan.module.push({ path: file.path, content: next });
    } else if (originOf(existing, file.path) !== 'generated') {
      plan.detached.push(file.path);
      plan.module.push({ path: file.path, content: existing });
    } else if (existing === next) {
      plan.unchanged += 1;
      plan.module.push({ path: file.path, content: next });
    } else {
      plan.writes.push({ path: file.path, content: next });
      plan.module.push({ path: file.path, content: next });
    }
  }
  for (const file of owned) {
    const existing = directory.read(file.path);
    if (existing === null) plan.writes.push(file);
    plan.module.push({ path: file.path, content: existing ?? file.content });
  }
  const produced = new Set(derived.map((file) => file.path));
  for (const name of OPTIONAL_DERIVED) {
    const existing = produced.has(name) ? null : directory.read(name);
    if (existing === null) continue;
    const origin = originOf(existing, name);
    if (origin === 'generated') plan.removes.push(name);
    else if (origin === 'edited') plan.orphaned.push(name);
  }
  return plan;
}

/**
 * Запасная проверка без компилятора: импорты несуществующих символов.
 *
 * @returns Ошибки и пакеты, импорты из которых проверить нечем (у сервера нет их индекса).
 */
async function checkImports(
  k: Knowledge,
  files: readonly FormFile[]
): Promise<{ errors: string[]; unchecked: string[] }> {
  const errors: string[] = [];
  const unchecked = new Set<string>();
  for (const file of files) {
    if (!/\.tsx?$/.test(file.path)) continue;
    const { diagnostics, unindexed } = await validateCode(k, file.content);
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity !== 'error') continue;
      const place = diagnostic.line ? `${file.path}:${diagnostic.line}` : file.path;
      errors.push(`${place} ${diagnostic.code} ${diagnostic.message}`);
    }
    for (const pkg of unindexed) unchecked.add(pkg);
  }
  return { errors, unchecked: [...unchecked].sort() };
}

/**
 * Инструмент никогда не бросает: непойманное исключение доезжает до клиента как `-32603` без поля,
 * причины и следующего шага — для агента это тупик. Дефект сборки выходит объяснённым текстом.
 */
export async function formBuildTool(args: FormBuildArgs, k: Knowledge): Promise<ToolTextResult> {
  try {
    return await runFormBuild(args, k);
  } catch (error) {
    return failure('an internal build error — a defect of the server, not of the intent', [
      error instanceof Error ? error.message : String(error),
      'Send the intent with report_issue: the build must answer with diagnostics, not crash.',
    ]);
  }
}

async function runFormBuild(args: FormBuildArgs, k: Knowledge): Promise<ToolTextResult> {
  // Грамматика — без диска и без проекта: её спрашивают до того, как появился каталог формы, и там,
  // где каталога нет вовсе (аудит 2026-11, A6).
  if (args?.grammar !== undefined && args.grammar !== false) {
    const request = readGrammarRequest(args.grammar);
    if (request === null) {
      return invalidCall(
        `✗ form_build: unknown grammar section ${JSON.stringify(args.grammar)}. Use "base", ` +
          `"all", a section or a comma-separated list ("base,arrays"): ` +
          `${GRAMMAR_SECTIONS.join(', ')}.`
      );
    }
    const grammar = intentGrammar(await catalogsOf(k), { sections: request });
    return { content: [{ type: 'text', text: grammar }] };
  }

  const dir = args?.dir;
  if (dir !== undefined && (typeof dir !== 'string' || !dir.trim())) {
    return invalidCall(
      '✗ form_build: `dir` is a non-empty path of the form folder in the project.'
    );
  }
  const opened = k.forms.open(dir ?? null);
  if (!opened.ok) return failure(`the folder «${dir ?? 'form'}»`, [opened.reason]);
  const { directory } = opened;
  // Компоненты и правила — из каталога установленного кита и индекса установленного ядра.
  const catalogs = await catalogsOf(k);

  const source = directory.read(INTENT_FILE);
  if (source === null) {
    return { content: [{ type: 'text', text: intentGrammar(catalogs) }] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    return failure(`${INTENT_FILE} is not JSON`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }

  // Вердикт — у судьи: тот же, что у `validate_form kind="bundle"` и у ассистента билдера.
  const verdict = judgeIntent(raw, catalogs);
  if (!verdict.ok || !verdict.bundle) {
    return failure(verdictHeading(verdict), verdict.errors.map(renderFinding));
  }
  const { intent } = verdict;
  const { files } = verdict.bundle;

  // `index.tsx` — производный файл на всех таргетах, с меткой сборки. На core это заготовка разметки:
  // пока её не правили, сборка держит её в ладу с intent; первая правка (разметка агента)
  // отсоединяет файл, дальше он принадлежит агенту. Метка нужна и при смене таргета: нетронутую
  // заготовку core рендерер заменяет своей сборкой, а без метки она считалась правленной руками и
  // оставалась — форма рисовала `null` (аудит 2026-11, B6).
  const assembly: FormFile = { path: 'index.tsx', content: buildAssemblyTsx(intent) };
  const handMarkup = intent.target === 'core';
  // Заготовка своих операторов — производный файл: пока её не правили, сборка держит её в ладу с
  // intent (форму пишут частями, и оператор из `operators` становится правилом позже). Первая
  // правка — тела операторов — отсоединяет файл, дальше он принадлежит автору.
  const stubs = buildOperatorStubs(intent);
  const derived: FormFile[] = [
    ...files,
    assembly,
    ...stubs,
    ...(files.some((file) => file.path === 'data-sources.ts')
      ? []
      : [{ path: 'data-sources.ts', content: '// Справочники формы.\nexport {};\n' }]),
  ];
  const owned: FormFile[] = [
    { path: 'types.ts', content: '// Локальные типы модуля.\nexport {};\n' },
    { path: 'api.ts', content: '// Загрузка и отправка данных.\nexport {};\n' },
  ].filter((file) => !stubs.some((stub) => stub.path === file.path));
  const plan = planBuild(directory, derived, owned);

  // На рендерере `index.tsx` пишет сборка. Отсоединённый файл без FormRenderer — разметка, написанная
  // руками для core: с ней модуль рисовал бы не ту форму, и молча её оставить нельзя.
  if (!handMarkup && plan.detached.includes('index.tsx')) {
    const own = plan.module.find((file) => file.path === 'index.tsx')?.content ?? '';
    if (!own.includes('FormRenderer')) {
      return failure(`index.tsx is not a ${intent.target} assembly`, [
        'index.tsx holds markup written by hand (it draws no FormRenderer) — on ' +
          `${intent.target} the build writes index.tsx itself. Move your markup to another ` +
          'file, or delete index.tsx, and build again.',
      ]);
    }
  }

  const types = await directory.typecheck(plan.module);
  if (types.status === 'checked' && types.diagnostics.length > 0) {
    const missing = [
      ...new Set(types.diagnostics.map(missingReformerModule).filter((m) => m !== null)),
    ];
    if (missing.length > 0) {
      return failure(
        'the environment',
        missing.map(
          (module) =>
            `environment: ${module} does not resolve from the form folder → install it in the ` +
            'project; what the server found: resource reformer://status'
        )
      );
    }
    // Файлы агента: всё, что сборка не пишет, и всё, что она отсоединила после правки руками.
    const own = new Set([...owned.map((file) => file.path), ...plan.detached]);
    return failure(
      `type errors: ${types.diagnostics.length}`,
      types.diagnostics.map((diagnostic) => renderTypeError(diagnostic, own))
    );
  }
  // Пакеты, которые модуль импортирует, а проект их не даёт: модуль здесь не соберётся (B3).
  if (types.status === 'unavailable' && types.missing && types.missing.length > 0) {
    return failure('the environment', [
      `environment: ${types.reason} → install the packages in the project; what the server ` +
        'found: resource reformer://status',
    ]);
  }
  let uncheckedImports: string[] = [];
  if (types.status === 'unavailable') {
    const imports = await checkImports(k, plan.module);
    if (imports.errors.length > 0) return failure('wrong imports', imports.errors);
    uncheckedImports = imports.unchecked;
  }

  for (const file of plan.writes) directory.write(file.path, file.content);
  for (const name of plan.removes) directory.remove(name);

  const notes = verdict.warnings.map((warning) =>
    warning.code === 'module-note' || warning.code === 'component-props'
      ? warning.message
      : `${warning.code}: ${warning.message}`
  );
  const lines = [
    `✓ form_build: written ${plan.writes.length}, unchanged ${plan.unchanged}. ` +
      `Fields ${intent.fields.length}, arrays ${intent.arrays.length}, ` +
      `rules ${intent.validation.length}, behaviors ${intent.behavior.length}.`,
    types.status === 'checked'
      ? 'Types checked, no errors.'
      : uncheckedImports.length > 0
        ? `⚠️ Types NOT checked: ${types.reason}. ${unindexedLimitation(uncheckedImports)}`
        : `⚠️ Types NOT checked: ${types.reason}. Only the imports were checked.`,
    `Folder ${directory.label}: ${directory.list().join(', ')}.`,
    // Полноту сборка не проверяет: без этой строки агенты заканчивали на ✓, не дописав правила из
    // таблицы зависимостей спеки (ReFormer-w0bo.3).
    'The build does not know the task: check the intent against it, especially cross-field rules ' +
      'and dependency tables.',
  ];
  if (
    handMarkup &&
    plan.module.some((file) => file.path === 'index.tsx' && file.content.includes('return null;'))
  ) {
    lines.push(
      '⚠️ No markup yet: index.tsx renders `null`. On core write it there yourself (Edit) and ' +
        'build again: the build does not overwrite this file and type-checks it.'
    );
  }
  const unwritten = stubs
    .map((stub) => plan.module.find((file) => file.path === stub.path))
    .filter((file): file is FormFile => file?.content.includes(OPERATOR_STUB_MARK) === true)
    .map((file) => file.path);
  if (unwritten.length > 0) {
    lines.push(
      `⚠️ Your operators are still stubs: ${unwritten.join(', ')}. A stub rule passes any value, ` +
        'a stub operator does nothing. Write the bodies there yourself (Edit), remove the ' +
        `${OPERATOR_STUB_MARK} marks and build again: after an edit the build leaves the file ` +
        'alone, but type-checks it.'
    );
  }
  // Файл своих операторов и разметка на core и должны быть правлены руками — о них это не новость.
  const detached = plan.detached.filter(
    (path) => !stubs.some((stub) => stub.path === path) && !(handMarkup && path === 'index.tsx')
  );
  if (detached.length > 0) {
    lines.push(
      `Edited by hand and left as is: ${detached.join(', ')}. The build no longer updates them; ` +
        'delete a file to put it back under the build.'
    );
  }
  if (plan.orphaned.length > 0) {
    const schema = plan.orphaned.includes('form.schema.ts') && intent.target === 'renderer-json';
    lines.push(
      `⚠️ Edited by hand, but this build no longer produces them: ${plan.orphaned.join(', ')}. ` +
        'Nothing in the module reads them now' +
        (schema
          ? ' — the schema of renderer-json is form.schema.json, and index.tsx imports it'
          : '') +
        '. Carry your edits over (into form.intent.json or the new file) and delete the old one.'
    );
  }
  if (notes.length > 0) {
    lines.push(`Warnings: ${notes.length}.`, ...bullets(notes, MAX_WARNINGS));
  }
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

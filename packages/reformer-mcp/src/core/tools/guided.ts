/**
 * Инструменты профиля guided (`REFORMER_SURFACE=guided`): `form_start`, `form_edit`, `form_status`.
 *
 * Профиль — для малых локальных моделей. Сервер ведёт процесс, модель исполняет шаги:
 *
 * - `form_start` — план этапов по заданию или спеке, файлом `form.plan.json` в каталоге формы;
 * - `form_edit` — плоские правки intent; сервер пишет `form.intent.json` и сразу собирает модуль
 *   той же сборкой, что `form_build`;
 * - `form_status` — состояние плана и пропуск ненужного этапа.
 *
 * Каждый ответ кончается строкой `Next:` с одним готовым вызовом: план, выданный в начале, малая
 * модель теряет, а стенд держит целиком только четыре последних ответа. Замысел и источники — план
 * `docs/plans/lucky-popping-wall.md`.
 *
 * @module reformer-mcp/core/tools/guided
 */

import { catalogsOf, type FormCatalogs } from '../generate/catalogs.js';
import {
  readIntent,
  readTargetStack,
  type FormIntent,
  type ReformerTargetStack,
} from '../generate/form-intent.js';
import { originOf } from '../generate/generated-marker.js';
import { formatIntentJson } from '../generate/intent-format.js';
import { judgeIntent } from '../generate/judge.js';
import { editDeclaration, editItemSchema, EDIT_KEYS, editSummary } from '../guided/edit-spec.js';
import { applyEdits, type EditOutcome } from '../guided/edits.js';
import {
  behaviorWord,
  crossWord,
  featuresFromSpec,
  featuresFromText,
  mergeFeatures,
  validationWord,
} from '../guided/features.js';
import { coreAssembly, MARKUP_MARK } from '../guided/markup.js';
import {
  baselineOf,
  editCall,
  editGaps,
  fieldsSummary,
  fingerprint,
  intentOf,
  nextLines,
  OPTIONAL_STAGES,
  parsePlan,
  PLAN_FILE,
  planState,
  progressLine,
  serializePlan,
  stageGoal,
  stagesFor,
  STAGE_ORDER,
  TASK_LIMIT,
  TASK_LIMIT_EDIT,
  taskGaps,
  validationStarted,
  type GuidedPlan,
  type StageId,
} from '../guided/plan.js';
import type { Knowledge } from '../knowledge.js';
import { analyzeSpec } from '../spec/analyze.js';
import type { FormDirectory } from '../workspace/form-workspace.js';
import { formBuildTool, INTENT_FILE } from './form-build.js';
import { draftFromSpec, planFormTool } from './plan-form.js';
import { invalidCall, type ToolTextResult } from './tool-result.js';

const TARGETS = 'core | renderer-react | renderer-json';

export const formStartToolDefinition = {
  name: 'form_start',
  description:
    'Start a form: the server plans the stages of the work (fields, rows, steps, validation, reactions, markup) and saves the plan to <dir>/form.plan.json. Call it first, once per form. Then change the form only with form_edit — every answer ends with the exact next call.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: { type: 'string', description: 'Form folder (default "form").' },
      target: {
        type: 'string',
        enum: ['core', 'renderer-react', 'renderer-json'],
        description: 'The stack named in the task.',
      },
      task: {
        type: 'string',
        description:
          'The task text word for word, in its own language: do not translate or retell it.',
      },
      specPath: {
        type: 'string',
        description:
          'A markdown spec of the form, if the task has one: the server drafts the form from it.',
      },
      formName: { type: 'string', description: 'Form title in the language of the task.' },
    },
    required: ['target'],
  },
};

export const formEditToolDefinition = {
  name: 'form_edit',
  description:
    'Change the form with small edits; the server keeps the form and builds the module — never write files of the form folder yourself. Edits are applied one by one: a rejected edit says how to fix it, the others still apply. "edits":[] just builds. Names, labels and texts come from the task.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: { type: 'string', description: 'Form folder (default "form").' },
      edits: {
        type: 'array',
        description: editSummary(),
        items: editItemSchema(),
      },
    },
    required: ['edits'],
  },
};

export const formStatusToolDefinition = {
  name: 'form_status',
  description:
    'The plan of the form: which stages are done, whether the last build passed, the next call. "skip" drops a stage the task does not need, "add" adds one it needs (validation, cross, behavior, arrays, wizard).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: { type: 'string', description: 'Form folder (default "form").' },
      skip: { type: 'string', enum: [...OPTIONAL_STAGES] },
      add: { type: 'string', enum: [...OPTIONAL_STAGES] },
      confirm: {
        type: 'string',
        enum: ['validation', 'edit'],
        description:
          'The form was checked against the task: "validation" — every limit it names has a rule; "edit" — every change it names is made.',
      },
    },
    required: [],
  },
};

interface Opened {
  readonly directory: FormDirectory;
  /** Каталог для готовых вызовов — как его назвала модель, иначе `form`. */
  readonly dir: string;
}

function openDir(args: { dir?: unknown }, k: Knowledge, tool: string): Opened | ToolTextResult {
  const dir = args?.dir;
  if (dir !== undefined && (typeof dir !== 'string' || !dir.trim())) {
    return invalidCall(`✗ ${tool}: "dir" is a non-empty path of the form folder.`);
  }
  const opened = k.forms.open(dir ?? null);
  if (!opened.ok) return invalidCall(`✗ ${tool}: the form folder — ${opened.reason}`);
  return { directory: opened.directory, dir: typeof dir === 'string' ? dir : 'form' };
}

const isOpened = (value: Opened | ToolTextResult): value is Opened => 'directory' in value;

function noPlan(tool: string, dir: string, directory?: FormDirectory): ToolTextResult {
  return invalidCall(noPlanLines(tool, dir, directory).join('\n'));
}

/** Плана нет: вызов `form_start` — с заданием формы или, если форма уже в каталоге, с заданием правки. */
function noPlanLines(tool: string, dir: string, directory?: FormDirectory): string[] {
  const existing = directory !== undefined && directory.read(INTENT_FILE) !== null;
  return existing
    ? [
        `✗ ${tool}: no plan yet — the form is already in ${dir}: start the change first, with the text of the change:`,
        `Next: form_start {"dir":${JSON.stringify(dir)},"target":"<${TARGETS}>","task":"<the task text of the change, word for word>"}`,
      ]
    : [
        `✗ ${tool}: no plan yet — start the form first:`,
        `Next: form_start {"dir":${JSON.stringify(dir)},"target":"<${TARGETS}>","task":"<the task text, word for word>"}`,
      ];
}

function statusLines(plan: GuidedPlan, directory: FormDirectory, dir: string): string[] {
  const index = directory.read('index.tsx');
  const state = planState(plan, directory.read(INTENT_FILE), index);
  // Правка: «каждое поле задания здесь?» — вопрос создания формы; поля называет сверка правки.
  const fields = plan.mode === 'edit' ? [] : fieldsLine(state.intent);
  const next = nextLines(plan, state, dir);
  const entry = entryOf(index);
  return [
    progressLine(state),
    ...fields,
    ...next.map((line) =>
      line.startsWith('Done:') && entry
        ? `${line} The entry ${dir}/index.tsx is written by the server and exports ${entry} — the form component a task asks for; nothing is left to write.`
        : line
    ),
  ];
}

/**
 * Компонент, который экспортирует `index.tsx`. Задание сценария просит «точку входа form/index.tsx с
 * компонентом формы»: после `Done` модель писала её сама поверх серверной — и `Form.tsx` с выдуманным
 * API (батч 20261114T215823Z-1be3, registration-create на renderer-json). Ответ называет готовое.
 */
function entryOf(index: string | null): string | null {
  if (index === null) return null;
  const named = /export\s+(?:function|const)\s+([A-Z][\w$]*)/.exec(index)?.[1];
  if (named) return `\`${named}\``;
  return /export\s+default\b/.test(index) ? 'the form component as default' : null;
}

/**
 * Поля формы одной строкой: сверить с заданием. Этап полей засчитывался по первому полю, и
 * «готово» приходило, пока половина полей задания не была добавлена (L2-profile-json).
 */
function fieldsLine(intent: FormIntent | null): string[] {
  if (!intent || intent.fields.length + intent.arrays.length === 0) return [];
  const fields = intent.fields.map(
    (field) => `${field.label ?? field.name} (${field.modelPath ?? field.name})`
  );
  const rows = intent.arrays.map(
    (array) => `${array.name}[]: ${array.itemFields.map((item) => item.name).join(', ')}`
  );
  return [
    `Form fields: ${[...fields, ...rows].join(', ')} — every input of the task is here? A missing one: add_field.`,
  ];
}

/**
 * Ответ сборки в профиле guided. Совет сборки «на core пиши разметку сам» противоречит плану: её
 * пишет сервер на этапе markup — строка убирается, этап назовёт `Next:`.
 */
export function guidedBuildText(text: string, serverMarkup = false): string {
  return (
    text
      .split('\n')
      .filter((line) => !BUILD_LINES_DROPPED.some((start) => line.startsWith(start)))
      // Тексты и кнопку раскладки разметка сервера рисует сама: совет «write them there too» звал
      // переписывать её index.tsx руками (order-delete на core, ReFormer-f2fs.22).
      .filter((line) => !(serverMarkup && /^- texts in the layout .*draws the markup/.test(line)))
      .map(guidedBuildLine)
      .join('\n')
  );
}

/** `index.tsx` каталога — разметка сервера (`{"op":"markup"}`). */
const serverMarkupIn = (directory: FormDirectory): boolean =>
  directory.read('index.tsx')?.includes(MARKUP_MARK) === true;

/**
 * Строки ответа обычной сборки, которых в профиле нет. Каждая звала модель к файлам: список файлов
 * каталога с intent, «сверь intent с заданием», «правлено руками — удали файл», «пришли intent в
 * report_issue» (инструмента в профиле нет). Прогон registration-create на core ушёл писать intent
 * руками сразу после такого ответа (батч 20261114T183644Z-ab51).
 */
const BUILD_LINES_DROPPED = [
  '⚠️ No markup yet',
  'Folder ',
  'The build does not know the task',
  'Edited by hand and left as is',
  '⚠️ Edited by hand, but this build',
  '- Send the intent with report_issue',
];

/** Чем правится то, что сборка пишет в файл модуля. */
const EDIT_FOR_FILE: Readonly<Record<string, string>> = {
  'form.validation.ts': 'add_rule again with the fixed check, or remove_rule',
  'form.behavior.ts': 'add_behavior again with the fixed expr, or remove_behavior',
  'form.schema.ts': 'set_field',
  'form.schema.json': 'set_field',
  'model.ts': 'set_field',
  'form.messages.ts': 'add_rule again with the fixed message',
  'index.tsx': 'set_field, or {"op":"markup"} on core',
};

/** Строка ответа сборки в словах профиля: правят правкой, а не файлом. */
function guidedBuildLine(line: string): string {
  const typeError = / → fix form\.intent\.json — the build writes (\S+)$/.exec(line);
  if (typeError) {
    const fix = EDIT_FOR_FILE[typeError[1]] ?? 'form_edit';
    return `${line.slice(0, typeError.index)} → fix it with form_edit: ${fix}`;
  }
  if (line.startsWith('⚠️ Your operators are still stubs')) {
    return '⚠️ The form has operators that are stubs: a stub rule passes any value. This profile does not write their bodies.';
  }
  return line
    .replace(/form\.intent\.json is not read in full/, 'the form is not read in full')
    .replace(/form\.intent\.json is not JSON/, 'the form is not readable');
}

/** Итог сборки — в план: «готово» сервер ставит только по сборке на текущих файлах. */
/** Файлы модуля, которые в профиле guided пишет только сервер. */
const SERVER_FILES = ['form.schema.ts', 'form.validation.ts', 'form.behavior.ts', 'model.ts'];

/**
 * Файлы сервера, правленные руками, — заново из intent. Обычная сборка отсоединяет такой файл и
 * оставляет автору; в guided у модели нет иного пути, кроме `form_edit`, а её `index.tsx` на
 * renderer-react ломал сборку ошибками типов, которые ответ советовал чинить через `form_edit`
 * (L3-delivery, 20261113T230859Z-f59e). На core `index.tsx` — разметка, его не трогаем.
 */
interface RemovedFile {
  readonly name: string;
  readonly content: string;
}

function restoreServerFiles(directory: FormDirectory, target: string): RemovedFile[] {
  const files = target === 'core' ? SERVER_FILES : [...SERVER_FILES, 'index.tsx'];
  const removed: RemovedFile[] = [];
  for (const file of files) {
    const content = directory.read(file);
    if (content === null || originOf(content, file) === 'generated') continue;
    directory.remove(file);
    removed.push({ name: file, content });
  }
  return removed;
}

/**
 * Сборка не прошла — файлы, убранные перед ней, на место: без них модуль терял `model.ts`, и следующая
 * сборка падала уже на импорте (батч 20261114T211434Z-bca8, registration-edit). Сборка, которая
 * прошла, пишет их сама — тогда ничего не возвращаем.
 */
function putBack(directory: FormDirectory, removed: readonly RemovedFile[]): void {
  for (const file of removed) {
    if (directory.read(file.name) === null) directory.write(file.name, file.content);
  }
}

const restoredLine = (files: readonly RemovedFile[], ok: boolean): string[] =>
  files.length === 0
    ? []
    : ok
      ? [
          `Written by hand and replaced by the build: ${files.map((file) => file.name).join(', ')} — the server writes the module; change the form only with form_edit.`,
        ]
      : [
          `Written by hand: ${files.map((file) => file.name).join(', ')} — left as it was, the build did not pass; the server replaces it with the next build that passes. Change the form only with form_edit.`,
        ];

/** Код проблемы чтения, которую сервер снимает сам: ключ, которого intent не знает. */
const UNREADABLE = new Set(['unknown-key', 'prop-unsupported']);

/** Путь проблемы (`fields[0].componentProps.x`, `intent.cross`) — сегментами. */
function problemPath(at: string): Array<string | number> {
  const segments: Array<string | number> = [];
  for (const match of at.replace(/^intent\./, '').matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    segments.push(match[2] === undefined ? (match[1] as string) : Number(match[2]));
  }
  return segments;
}

/**
 * Ключи, которых intent не знает, — прочь из формы, с похожим ключом — под ним. Модель писала intent
 * руками до `form_start`, план правки брал его за основу, и каждая сборка падала на `unknown-key`,
 * который `form_edit` убрать не может (батч 20261114T211434Z-bca8). Путь, которого в файле нет
 * (ключ прочитан как синоним), не трогаем: сборка назовёт его сама.
 */
export function dropUnreadable(
  file: Record<string, unknown>,
  catalogs: Pick<FormCatalogs, 'uiKit' | 'uiKitProps'>
): string[] {
  const dropped: string[] = [];
  for (let round = 0; round < 3; round += 1) {
    const { problems } = readIntent(file, {
      uiKit: catalogs.uiKit,
      ...(catalogs.uiKitProps ? { uiKitProps: catalogs.uiKitProps } : {}),
    });
    let changed = false;
    for (const problem of problems) {
      if (!UNREADABLE.has(problem.code)) continue;
      const path = problemPath(problem.at);
      const key = path.pop();
      if (typeof key !== 'string') continue;
      let holder: unknown = file;
      for (const segment of path) {
        holder =
          holder !== null && typeof holder === 'object'
            ? (holder as Record<string | number, unknown>)[segment]
            : undefined;
      }
      if (holder === null || typeof holder !== 'object' || Array.isArray(holder)) continue;
      const record = holder as Record<string, unknown>;
      if (!(key in record)) continue;
      const near = /did you mean `([^`]+)`\?/.exec(problem.message)?.[1];
      const at = problem.at.replace(/^intent\./, '');
      if (near && !(near in record)) {
        record[near] = record[key];
        dropped.push(`${at} → ${near}`);
      } else {
        dropped.push(at);
      }
      delete record[key];
      changed = true;
    }
    if (!changed) break;
  }
  return dropped;
}

/** Запомнить форму, которую сейчас держит сервер: её он вернёт, если файл перепишут руками. */
function withIntent(plan: GuidedPlan, directory: FormDirectory): GuidedPlan {
  const text = directory.read(INTENT_FILE);
  return { ...plan, intentPrint: fingerprint(text), intentCopy: text };
}

/**
 * Intent, написанный руками, — назад к версии сервера; файл, которого сервер не писал, — прочь.
 * Модель уходила писать intent сама и теряла правила, а сборка молча его принимала (батч
 * 20261114T183644Z-ab51). Возвращает строку ответа или ничего.
 */
function guardIntent(plan: GuidedPlan, directory: FormDirectory): string[] {
  if (plan.intentPrint === undefined) return [];
  const now = directory.read(INTENT_FILE);
  if (fingerprint(now) === plan.intentPrint) return [];
  if (typeof plan.intentCopy === 'string') directory.write(INTENT_FILE, plan.intentCopy);
  else directory.remove(INTENT_FILE);
  return [
    'form.intent.json was written by hand — the server put its own version back. The form changes only with form_edit.',
  ];
}

function withBuild(
  plan: GuidedPlan,
  directory: FormDirectory,
  buildText: string,
  ok: boolean
): GuidedPlan {
  return {
    ...plan,
    lastBuild: {
      ok,
      typesChecked: ok && buildText.includes('Types checked, no errors.'),
      intent: fingerprint(directory.read(INTENT_FILE)),
      index: fingerprint(directory.read('index.tsx')),
    },
  };
}

const NOT_AN_OBJECT = 'an edit is an object';

/** Начало отказа `add_array`, когда в плане нет этапа строк (`edits.ts`). */
const NO_ROWS = 'the plan has no rows';

/**
 * Строки отчёта о правках. Подряд идущие «не объекты» — одной строкой: пропущенная `{` в списке
 * превращала одну правку в восемь строк-отказов (L1-login, батч 20261113T164411Z-e818).
 */
function reportLines(outcomes: readonly EditOutcome[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (!outcome.ok && outcome.message.startsWith(NOT_AN_OBJECT)) {
      let end = i;
      while (
        end + 1 < outcomes.length &&
        !outcomes[end + 1].ok &&
        outcomes[end + 1].message.startsWith(NOT_AN_OBJECT)
      )
        end++;
      if (end > i) {
        lines.push(
          `- ✗ edits ${i + 1}–${end + 1}: not objects — each edit is an object {"op":…}; check the brackets: [{…}, {…}]`
        );
        i = end;
        continue;
      }
    }
    lines.push(
      `- ${outcome.ok ? '✓' : `✗ edit ${outcome.index + 1}`} ${outcome.op}: ${outcome.message}`
    );
  }
  return lines;
}

/**
 * Файл спецификации, который называет задание (`spec.md`, `docs/order.md`): путь как написан или
 * внутри каталога формы — затравка правки кладёт спеку туда. Ровно один найденный файл, иначе `null`.
 */
function specIn(task: string, dir: string, k: Knowledge): string | null {
  const candidates = [...new Set([...task.matchAll(/[\w./-]+\.md\b/g)].map((match) => match[0]))];
  const found = new Set<string>();
  for (const candidate of candidates) {
    for (const path of [candidate, `${dir}/${candidate}`]) {
      if (k.spec.read(path) !== null) {
        found.add(path);
        break;
      }
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

/**
 * Строка ответа `plan_form` в словах профиля: черновик держит сервер, дописывают правками. Как есть
 * она называла файл intent и звала «дописать руками».
 */
function draftLine(line: string): string {
  return line
    .replace(/^✓ plan_form: drafted \S+ from /, '✓ the server drafted the form from ')
    .replace(/^Finish by hand \((\d+)\):/, 'Still to do with form_edit ($1):')
    .replace(/ — add them by the spec\.$/, ' — add them with form_edit by the spec.')
    .replace(
      /^The draft does not read cleanly \((\d+)\) — fix these records:/,
      'The draft does not read cleanly ($1) — fix these with form_edit:'
    );
}

/**
 * Имя формы по заданию: заголовок до двоеточия или первая фраза, не длиннее пяти слов, без глагола
 * просьбы и хвоста «с полями». Из «Сделать форму регистрации с полями» выходил компонент
 * `SdelatFormuRegistratsiiSPolyamiForm`, и модель переименовывала его в разметке руками (батч
 * 20261114T215823Z-1be3).
 */
/**
 * Задание, которое само — спецификация: заголовок `# …`, разделы `## …` и таблица полей. Модель
 * вставляла текст spec.md в «task» вместо `specPath`: черновика не было, имя формы выходило
 * «# Форма» (order-create, батч 20261114T235104Z-4e30, ReFormer-f2fs.20).
 */
export function isSpecText(task: string): boolean {
  const lines = task.split('\n').map((line) => line.trim());
  const first = lines.find((line) => line !== '') ?? '';
  return (
    /^#\s+\S/.test(first) &&
    lines.some((line) => /^##\s+\S/.test(line)) &&
    lines.filter((line) => /^\|.*\|$/.test(line)).length >= 3 &&
    analyzeSpec(task).fields.length >= 2
  );
}

export function formNameOf(task: string): string {
  // Заголовок markdown: «# Форма: Оформление заказа» — имя после «Форма:», без решёток.
  const heading = /^\s*#{1,6}\s+(?:(?:форма|form)\s*:\s*)?([^\n]+)/i.exec(task)?.[1];
  const head = (
    heading?.replace(/\s*\(`[^`]*`\)\s*$/, '').trim() ??
    task.split(/[:.!?\n]/)[0]?.trim() ??
    ''
  )
    .replace(
      /^(?:сделай(?:те)?|сделать|создай(?:те)?|создать|собери(?:те)?|собрать)\s+форму(?![а-яё])/i,
      'Форма'
    )
    .replace(/^(?:make|create|build)\s+(?:a|an|the)\s+/i, '')
    .replace(/\s+(?:с полями|with (?:the )?fields)(?![а-яёa-z]).*$/i, '');
  const words = head.split(/\s+/).filter(Boolean);
  const name = words.slice(0, 5).join(' ');
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : 'Form';
}

// ---------- form_start ----------

export async function formStartTool(
  args: Record<string, unknown>,
  k: Knowledge
): Promise<ToolTextResult> {
  const given = readTargetStack(args?.target);
  // Стек, названный в задании пакетом, сильнее аргумента: модель ставила renderer-react при
  // «Стек: @reformer/core, разметку пишешь сам в JSX» (L1-login, 20261113T224423Z-b31c).
  const named = [
    ...new Set(
      [
        ...String(args?.task ?? '').matchAll(/@reformer\/(core|renderer-react|renderer-json)\b/g),
      ].map((match) => match[1])
    ),
  ];
  const target = named.length === 1 ? readTargetStack(named[0]) : given;
  if (!target) {
    return invalidCall(`✗ form_start: "target" is the stack from the task — one of ${TARGETS}.`);
  }
  const opened = openDir(args, k, 'form_start');
  if (!isOpened(opened)) return opened;
  const { directory, dir } = opened;
  const task = typeof args.task === 'string' ? args.task.trim() : '';
  let specPath = typeof args.specPath === 'string' ? args.specPath.trim() : '';
  if (!task && !specPath) {
    return invalidCall(
      '✗ form_start: give "task" (the task text) or "specPath" (a markdown spec of the form).'
    );
  }

  const lines: string[] = [];
  if (given && target !== given) {
    lines.push(`"target" taken from the task: @reformer/${target} → "${target}" (not "${given}").`);
  }
  // Спецификация, названная в задании файлом, — `specPath`: модель читала spec.md сама и вызывала
  // form_start одним текстом задания, черновика по спеке не было ни в одном прогоне из трёх, и ~30
  // полей она вводила правками по одной до лимита шагов (order-create, 20261114T113832Z-68e8).
  if (!specPath) {
    const found = specIn(task, dir, k);
    if (found) {
      specPath = found;
      lines.push(`"specPath" taken from the task: ${found} — the server drafts the form from it.`);
    }
  }
  // Задание — сама спецификация (текст spec.md вместо `specPath`): черновик из него.
  const specText = !specPath && isSpecText(task) ? task : null;
  // Форма уже лежит в каталоге, а плана нет (или он — план правки): задание её меняет. План — один
  // этап правки со сверкой по дельте; иначе проверки создания формы шли по тексту правки.
  const previous = parsePlan(directory.read(PLAN_FILE));
  // Форма, переписанная руками после прошлого плана, — назад к версии сервера до нового плана.
  if (previous) lines.push(...guardIntent(previous, directory));
  const existing = intentOf(directory.read(INTENT_FILE));
  const editing =
    existing !== null &&
    existing.fields.length + existing.arrays.length > 0 &&
    (previous === null || previous.mode === 'edit');
  if (editing) {
    const plan: GuidedPlan = withIntent(
      {
        version: 1,
        formName: existing.formName,
        target,
        source: 'task',
        ...(specPath ? { specPath } : {}),
        ...(task
          ? { task: task.length > TASK_LIMIT_EDIT ? `${task.slice(0, TASK_LIMIT_EDIT)}…` : task }
          : {}),
        stages: ['edit'],
        skipped: [],
        mode: 'edit',
        baseline: previous?.baseline ?? baselineOf(existing),
        ...(previous?.lastBuild ? { lastBuild: previous.lastBuild } : {}),
      },
      directory
    );
    directory.write(PLAN_FILE, serializePlan(plan));
    const head = [
      `✓ form_start: the form in ${dir} is already built — the plan of the change on ${target} is saved.`,
      'Change the form ONLY with form_edit: the server rewrites the form and its module. Never write files of the form folder yourself.',
      `Fields now: ${fieldsSummary(existing)}`,
      '',
    ];
    return {
      content: [
        {
          type: 'text',
          text: [...head, ...lines, ...statusLines(plan, directory, dir)].join('\n'),
        },
      ],
    };
  }
  let features = featuresFromText(task);
  let source: GuidedPlan['source'] = 'task';
  let specSubmit: GuidedPlan['specSubmit'];
  let specOptional: string[] | undefined;
  let formName =
    typeof args.formName === 'string' && args.formName.trim()
      ? args.formName.trim()
      : formNameOf(task);
  if (specPath || specText !== null) {
    const spec = specText ?? k.spec.read(specPath);
    if (spec === null) {
      return invalidCall(
        `✗ form_start: spec not found — \`${specPath}\`. The task is in the message? Call form_start with "task" instead.`
      );
    }
    const analysis = analyzeSpec(spec);
    // Задание поверх спеки («по spec.md, но мастером») добавляет свои признаки; задание, которое само
    // спека, — нет: «шаг 5» слайдера в ней не мастер.
    features =
      specText === null
        ? mergeFeatures(featuresFromSpec(analysis, spec), featuresFromText(task))
        : featuresFromSpec(analysis, spec);
    // «Необязательное» спеки — сразу в план: этап валидации таких полей не ждёт, а обрезанный текст
    // задания строк спеки уже не держит (ReFormer-f2fs.20).
    const unrequired = analysis.fields.filter((field) => field.optional).map((field) => field.name);
    if (unrequired.length > 0) specOptional = unrequired;
    if (analysis.submitLabel || analysis.submitHandler) {
      specSubmit = {
        ...(analysis.submitLabel ? { label: analysis.submitLabel } : {}),
        ...(analysis.submitHandler ? { handler: analysis.submitHandler } : {}),
      };
    }
    source = 'spec';
    if (!(typeof args.formName === 'string' && args.formName.trim()))
      formName = analysis.formName || formName;
    if (specText !== null)
      lines.push('The task is a spec itself — the server drafts the form from it.');
    if (directory.read(INTENT_FILE) === null) {
      const drafted =
        specText !== null
          ? await draftFromSpec(specText, 'the task', { dir: args.dir, target }, k)
          : await planFormTool({ specPath, dir: args.dir, target }, k);
      const draft = drafted.content[0].text.split('\n');
      // Черновик и что дописать руками — из ответа plan_form, без его «Next»: следующий шаг здесь свой.
      lines.push(
        ...draft
          .filter((line) => line.trim() && !line.startsWith('Next:'))
          .slice(0, 16)
          .map(draftLine),
        ''
      );
    } else {
      lines.push('The form already exists — the plan continues it.', '');
    }
  }

  const stages = stagesFor(features, target);
  // Форма на старте — то, что сервер держит: черновик спеки или ничего (файл, написанный руками до
  // первой правки, сервер уберёт).
  const plan: GuidedPlan = withIntent(
    {
      version: 1,
      formName,
      target,
      source,
      ...(specPath ? { specPath } : {}),
      ...(specSubmit ? { specSubmit } : {}),
      ...(specOptional ? { optional: specOptional } : {}),
      ...(task ? { task: task.length > TASK_LIMIT ? `${task.slice(0, TASK_LIMIT)}…` : task } : {}),
      stages,
      skipped: [],
      ...(previous?.lastBuild ? { lastBuild: previous.lastBuild } : {}),
    },
    directory
  );
  directory.write(PLAN_FILE, serializePlan(plan));

  const head = [
    `✓ form_start: the plan of «${formName}» on ${target} is saved.`,
    'Change the form ONLY with form_edit: the server keeps the form and builds its module. Never write files of the form folder yourself.',
    'Stages:',
    ...stages.map((stage, index) => `${index + 1}. ${stage} — ${stageGoal(stage, target)}`),
    'Names, labels and texts come from the task; the samples below show syntax only.',
    '',
  ];
  return {
    content: [
      { type: 'text', text: [...head, ...lines, ...statusLines(plan, directory, dir)].join('\n') },
    ],
  };
}

// ---------- Подача в Code Mode (`code-guided`) ----------

/**
 * Вводный абзац `run_script` связки. Общий абзац Code Mode говорил «write files with your own file
 * tools» — в guided это прямо против «никогда не пиши файлы модуля»: в 8 из 9 правок модель
 * переписывала файлы формы руками (батч 20261114T113832Z-68e8). Здесь — ни одного файла в каталоге
 * формы, все правки этапа одним вызовом (модель слала по одной и упиралась в лимит шагов).
 */
const GUIDED_PREAMBLE =
  'Run a script against the ReFormer form API. The global `reformer` (declared below) has async functions; each takes ONE object and returns the answer of the server as text. Write the BODY of an async function: `await` the calls and print every answer with `console.log` — only printed text and a `return`ed value come back to you. The server writes every file in the form folder: never write or rewrite them with file tools — change the form only with `reformer.formEdit`, every edit of a stage in ONE call. Plain JavaScript: no import, require, fs or network. A call does not throw: its answer says ✓ or ✗ and what to do next.';

const STAGE_TYPE = OPTIONAL_STAGES.map((stage) => JSON.stringify(stage)).join(' | ');

const FORM_DIR_DOC = '  /** Form folder (default "form"). */\n  dir?: string;';

/** Объявления четырёх функций связки: doc-комментарий, `@returns`, `@example` и сигнатура. */
const GUIDED_MEMBERS: Readonly<Record<string, string>> = {
  form_start: `/**
 * Start the work on a form — the first call, once. Pass the task text word for word, in its language. Three cases:
 * - a new form: { dir, target, task };
 * - the task names a markdown spec file: add specPath — the server drafts the whole form from it;
 * - a form already lies in dir and the task changes it: { dir, target, task } with the text of the change — the plan is that change.
 * @returns the plan, then "Next:" with the code of the next call.
 * @example console.log(await reformer.formStart({ dir: "form", target: "renderer-react", task: "<the task text, word for word>" }))
 * @example console.log(await reformer.formStart({ dir: "form", target: "core", task: "<the task text>", specPath: "<the .md file the task names>" }))
 */
formStart(args: {
${FORM_DIR_DOC}
  /** The stack named in the task. */
  target: "core" | "renderer-react" | "renderer-json";
  /** The task text word for word, in its own language, with the stack line: do not translate or retell it. */
  task: string;
  /** The markdown spec file the task names. */
  specPath?: string;
}): Promise<string>;`,
  form_edit: `/**
 * Change the form with a list of edits — every edit of a stage in ONE call. The server applies them one by one and builds the module.
 * @returns a line per edit — "✓ …" or "✗ … how to fix it" (the other edits still apply) — then "✓ form_build …" or the build errors, "Plan: …" and "Next:" with the code of the next call, or "Done: …" when the form is complete.
 * @example console.log(await reformer.formEdit({ dir: "form", edits: [
 *   { op: "add_field", name: "<key>", label: "<label of the task>", required: true },
 *   { op: "add_field", name: "<key>", label: "<label>", options: ["<choice>", "<choice>"] },
 *   { op: "add_rule", field: "<key>", minLength: 2, message: "<text of the task>" },
 * ] }))
 */
formEdit(args: {
${FORM_DIR_DOC}
  /** The edits; [] just builds the current files. */
  edits: Edit[];
}): Promise<string>;`,
  form_status: `/**
 * The plan of the form: which stages are done, whether the last build passed, the next call.
 * @returns "Plan: …", then "Next:" with the code of the next call, or "Done: …".
 */
formStatus(args?: {
${FORM_DIR_DOC}
  /** Drop a stage the task does not need. */
  skip?: Stage;
  /** Add a stage the task needs. */
  add?: Stage;
  /** The form was checked against the task: "validation" — every limit of the task has a rule; "edit" — every change of the task is made. */
  confirm?: "validation" | "edit";
}): Promise<string>;`,
  form_build: `/**
 * Build the module again from the current form files. formEdit already builds after every edit — call it only when an answer asks to build.
 * @returns the build result, "Plan: …" and "Next:".
 */
formBuild(args?: {
${FORM_DIR_DOC}
}): Promise<string>;`,
};

/** Подача `run_script` в связке `code-guided`. */
export const GUIDED_SCRIPT_SURFACE = {
  preamble: GUIDED_PREAMBLE,
  codeExample:
    'console.log(await reformer.formStart({ dir: "form", target: "renderer-react", task: "<the task text, word for word>" }))',
  declarations: {
    types: `/** A stage of the plan. */\ntype Stage = ${STAGE_TYPE};\n\n${editDeclaration()}`,
    members: GUIDED_MEMBERS,
  },
} as const;

// ---------- form_status ----------

export async function formStatusTool(
  args: Record<string, unknown>,
  k: Knowledge
): Promise<ToolTextResult> {
  const opened = openDir(args, k, 'form_status');
  if (!isOpened(opened)) return opened;
  const { directory, dir } = opened;
  let plan = parsePlan(directory.read(PLAN_FILE));
  if (!plan) return noPlan('form_status', dir, directory);
  const lines: string[] = [...guardIntent(plan, directory)];
  const optional = (stage: string): stage is StageId =>
    (OPTIONAL_STAGES as readonly string[]).includes(stage);
  // Этапы списком через запятую: модель снимала два сразу и получала отказ.
  const stagesIn = (value: unknown): string[] =>
    (Array.isArray(value) ? value : String(value).split(','))
      .map((stage) => String(stage).trim())
      .filter(Boolean);
  if (args.add !== undefined) {
    const added = stagesIn(args.add);
    const wrong = added.filter((stage) => !optional(stage));
    if (wrong.length > 0) {
      return invalidCall(
        `✗ form_status: "add" is one of ${OPTIONAL_STAGES.join(', ')}, not ${wrong.join(', ')}.`
      );
    }
    const stages = new Set<string>([...plan.stages, ...added]);
    plan = {
      ...plan,
      stages: STAGE_ORDER.filter((stage) => stages.has(stage)),
      skipped: plan.skipped.filter((stage) => !added.includes(stage)),
    };
    directory.write(PLAN_FILE, serializePlan(plan));
    lines.push(`Stage ${added.join(', ')} added to the plan.`);
  }
  if (args.confirm !== undefined) {
    const confirmed = stagesIn(args.confirm).filter((stage): stage is StageId =>
      plan!.stages.includes(stage as StageId)
    );
    if (confirmed.length === 0) {
      return invalidCall(
        `✗ form_status: "confirm" is a stage of this plan: ${plan.mode === 'edit' ? '"edit"' : '"validation"'}.`
      );
    }
    const intent = planState(plan, directory.read(INTENT_FILE), null).intent;
    // Правка сверяется только по дельте: проверки создания формы на тексте правки ложны.
    const gaps = intent
      ? plan.mode === 'edit'
        ? editGaps(plan.task, intent, plan.baseline)
        : taskGaps(plan.task, intent, plan.specSubmit?.label)
      : [];
    if (gaps.length > 0 && plan.confirmTried !== true) {
      plan = { ...plan, confirmTried: true };
      directory.write(PLAN_FILE, serializePlan(plan));
      return {
        content: [
          {
            type: 'text',
            text: [
              'Not confirmed yet — the form differs from the task:',
              ...gaps.map((gap) => `- ${gap}`),
              plan.mode === 'edit'
                ? 'Make the missing changes with form_edit. The difference is not real? Send the same confirm again.'
                : 'Add the missing fields and rules with form_edit. These are not limits of the form? Send the same confirm again.',
              ...statusLines(plan, directory, dir),
            ].join('\n'),
          },
        ],
      };
    }
    plan = { ...plan, confirmed: [...new Set([...(plan.confirmed ?? []), ...confirmed])] };
    directory.write(PLAN_FILE, serializePlan(plan));
    lines.push(`Stage ${confirmed.join(', ')} checked against the task.`);
  }
  if (args.skip !== undefined) {
    let skips = stagesIn(args.skip);
    // Валидацию с правилами не пропускают — её сверяют с заданием (ответ ниже ведёт к сверке).
    // И ту, что задание называет словами: ответ ниже ведёт к add_rule.
    const word = plan.task ? validationWord(plan.task) : undefined;
    const started = validationStarted(planState(plan, directory.read(INTENT_FILE), null).intent);
    if (skips.includes('validation') && (started || word)) {
      skips = skips.filter((stage) => stage !== 'validation');
      lines.push(
        started
          ? 'Validation is not skipped: the form has rules — check them against the task instead.'
          : `Validation is not skipped: the task names checks («${word}») — add_rule for each.`
      );
      if (skips.length === 0) {
        return {
          content: [
            { type: 'text', text: [...lines, ...statusLines(plan, directory, dir)].join('\n') },
          ],
        };
      }
    }
    // Поведение, которое задание называет однозначно (формула, видимость), тоже не пропускают.
    const reaction = plan.task ? behaviorWord(plan.task) : undefined;
    const match = plan.task ? crossWord(plan.task) : undefined;
    if ((skips.includes('behavior') && reaction) || (skips.includes('cross') && match)) {
      if (skips.includes('behavior') && reaction) {
        skips = skips.filter((stage) => stage !== 'behavior');
        lines.push(
          `Behavior is not skipped: the task names a reaction («${reaction}») — add_behavior or add_visibility for it.`
        );
      }
      if (skips.includes('cross') && match) {
        skips = skips.filter((stage) => stage !== 'cross');
        lines.push(
          `Cross-field rules are not skipped: the task names one («${match}») — add_rule with "equals":"<other field>" or "cross".`
        );
      }
      if (skips.length === 0) {
        return {
          content: [
            { type: 'text', text: [...lines, ...statusLines(plan, directory, dir)].join('\n') },
          ],
        };
      }
    }
    const wrong = skips.filter(
      (stage) => !optional(stage) || !plan!.stages.includes(stage as StageId)
    );
    if (wrong.length > 0 || skips.length === 0) {
      return invalidCall(
        `✗ form_status: "skip" is a stage of this plan other than fields and markup: ${
          plan.stages.filter((s) => optional(s)).join(', ') || 'none'
        }.`
      );
    }
    plan = { ...plan, skipped: [...new Set([...plan.skipped, ...(skips as StageId[])])] };
    directory.write(PLAN_FILE, serializePlan(plan));
    lines.push(`Stage ${skips.join(', ')} skipped.`);
  }
  return {
    content: [{ type: 'text', text: [...lines, ...statusLines(plan, directory, dir)].join('\n') }],
  };
}

// ---------- form_edit ----------

/** Разметку сервера можно переписать: её нет, это заготовка сборки или её писал `markup`. */
function markupReplaceable(index: string | null): boolean {
  return index === null || index.includes('return null;') || index.includes(MARKUP_MARK);
}

export async function formEditTool(
  args: Record<string, unknown>,
  k: Knowledge
): Promise<ToolTextResult> {
  const opened = openDir(args, k, 'form_edit');
  if (!isOpened(opened)) return opened;
  const { directory, dir } = opened;
  let plan = parsePlan(directory.read(PLAN_FILE));
  if (!plan) return noPlan('form_edit', dir, directory);
  // Список правок строкой — частый сбой вызова у малых моделей: строка с JSON-списком читается как
  // список, иначе — отказ с образцом.
  let edits: unknown = args.edits;
  let editsNote: string | undefined;
  if (typeof edits === 'string') {
    try {
      const parsed: unknown = JSON.parse(edits);
      if (Array.isArray(parsed)) {
        edits = parsed;
        editsNote = '"edits" came as a string — read as a list; pass a list, not a string.';
      }
    } catch {
      // не JSON — отказ ниже
    }
  }
  // Списки правок под другими ключами («cross», «validation», «rules») — тоже правки: модель
  // раскладывала их по разделам, сервер их не читал, а ответ был «✓» (L2-registration-lite).
  const extra: string[] = [];
  const more: unknown[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (key === 'dir' || key === 'edits' || !Array.isArray(value)) continue;
    const listed = value.filter(
      (item) => item !== null && typeof item === 'object' && 'op' in (item as object)
    );
    if (listed.length === 0) continue;
    more.push(...listed);
    extra.push(key);
  }
  if (more.length > 0) {
    edits = [...(Array.isArray(edits) ? edits : []), ...more];
    editsNote = `${editsNote ? `${editsNote} ` : ''}Edits under ${extra.map((key) => `"${key}"`).join(', ')} read as edits — put every edit into "edits".`;
  }
  // Ключи правки за скобкой списка: `"edits":[{…}], "required":true` — скобка закрыта раньше времени,
  // и «required» терялся (L3-delivery, 20261113T230859Z-f59e). Правка одна — ключи её.
  const loose = Object.entries(args).filter(
    ([key, value]) =>
      key !== 'dir' &&
      key !== 'edits' &&
      EDIT_KEYS.has(key) &&
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
  );
  if (loose.length > 0 && Array.isArray(edits) && edits.length === 1) {
    const [only] = edits as unknown[];
    if (only !== null && typeof only === 'object' && !Array.isArray(only)) {
      edits = [{ ...Object.fromEntries(loose), ...(only as Record<string, unknown>) }];
      editsNote = `${editsNote ? `${editsNote} ` : ''}Keys outside the edit (${loose.map(([key]) => `"${key}"`).join(', ')}) read as keys of it — check the brackets.`;
    }
  }
  if (!Array.isArray(edits)) {
    return invalidCall(
      '✗ form_edit: "edits" is a list of edits, e.g. "edits":[{"op":"add_field","name":"email","label":"Email"}]; "edits":[] just builds.'
    );
  }

  const guarded = guardIntent(plan, directory);
  const source = directory.read(INTENT_FILE);
  let raw: Record<string, unknown> = {};
  if (source !== null) {
    try {
      const parsed: unknown = JSON.parse(source);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        raw = parsed as Record<string, unknown>;
    } catch {
      return invalidCall(
        `✗ form_edit: the form file in ${dir} is not JSON — it was written by hand. The form changes only with form_edit; start again with form_start.`
      );
    }
  }
  const notes: string[] = [...guarded, ...(editsNote ? [editsNote] : [])];
  if (raw.formName === undefined) raw.formName = plan.formName;
  // Стек — из плана: модель, писавшая форму на core, ставила другой таргет и получала один отказ раз
  // за разом (батч 20261112T163051Z-ad08). Аргумент, который сервер знает, у модели не спрашивают.
  if (raw.target !== plan.target) {
    if (raw.target !== undefined)
      notes.push(`target set back to ${plan.target} — the stack of the plan.`);
    raw.target = plan.target;
  }

  const catalogs = await catalogsOf(k);
  const editing = plan.mode === 'edit';
  // Повтор add_array после отказа «в плане нет строк» — этап строк в план, правка принимается: модель
  // на core получила этот отказ 10 раз подряд и не вызвала form_status {"add":"arrays"} (order-create,
  // 20261114T113832Z-68e8).
  const asksRows = edits.some(
    (edit) =>
      edit !== null &&
      typeof edit === 'object' &&
      (edit as Record<string, unknown>).op === 'add_array'
  );
  if (!editing && asksRows && plan.rowsTried === true && !plan.stages.includes('arrays')) {
    const stages = new Set<StageId>([...plan.stages, 'arrays']);
    plan = { ...plan, stages: STAGE_ORDER.filter((stage) => stages.has(stage)) };
    notes.push('Stage arrays added to the plan: add_array came again.');
  }
  if (plan.skipped.includes('arrays') && asksRows && plan.rowsTried === true) {
    plan = { ...plan, skipped: plan.skipped.filter((stage) => stage !== 'arrays') };
  }
  const applied = applyEdits(raw, edits, {
    uiKit: catalogs.uiKit,
    rules: new Set(catalogs.core.found ? catalogs.core.rules.keys() : []),
    target: plan.target as ReformerTargetStack,
    // Правка готовой формы: в плане нет этапов строк и шагов — гейты плана не действуют.
    ...(editing
      ? { edit: true }
      : {
          rows: plan.stages.includes('arrays') && !plan.skipped.includes('arrays'),
          wizard: plan.stages.includes('wizard') && !plan.skipped.includes('wizard'),
        }),
    ...(plan.task ? { task: plan.task } : {}),
    ...(plan.specSubmit?.handler ? { submitHandler: plan.specSubmit.handler } : {}),
  });
  if (
    applied.outcomes.some((outcome) => !outcome.ok && outcome.message.startsWith(NO_ROWS)) &&
    plan.rowsTried !== true
  ) {
    plan = { ...plan, rowsTried: true };
    directory.write(PLAN_FILE, serializePlan(plan));
  }
  const accepted = applied.outcomes.filter((outcome) => outcome.ok).length;
  if (editing && accepted > 0 && plan.edited !== true) plan = { ...plan, edited: true };
  // Поля, объявленные необязательными (`required:false`), — в план: этап валидации их не ждёт.
  if (applied.optional.length > 0) {
    plan = { ...plan, optional: [...new Set([...(plan.optional ?? []), ...applied.optional])] };
  }
  const report = [
    `form_edit: ${accepted} of ${applied.outcomes.length} edits applied.`,
    ...reportLines(applied.outcomes),
    ...notes.map((note) => `- ${note}`),
  ];
  if (applied.outcomes.length > 0 && accepted === 0) {
    return invalidCall(
      [...report, 'Nothing changed, nothing built.', ...statusLines(plan, directory, dir)].join(
        '\n'
      )
    );
  }

  const unreadable = dropUnreadable(applied.file, catalogs);
  if (unreadable.length > 0) {
    report.push(
      `- the server dropped keys the form cannot read: ${unreadable.join(', ')} — what they meant goes in with form_edit.`
    );
  }
  directory.write(INTENT_FILE, formatIntentJson(applied.file));
  plan = withIntent(plan, directory);
  directory.write(PLAN_FILE, serializePlan(plan));

  // Разметка core: по операции `markup` и при каждой правке, пока index.tsx — разметка сервера,
  // иначе новое поле не появилось бы на странице.
  if (plan.target === 'core') {
    const index = directory.read('index.tsx');
    const ours = index !== null && index.includes(MARKUP_MARK);
    if (applied.markup || ours) {
      const verdict = judgeIntent(applied.file, catalogs);
      if (!verdict.ok) {
        if (applied.markup)
          report.push('- markup waits for an intent without errors — fix the errors below first.');
      } else if (!markupReplaceable(index)) {
        report.push(
          '- markup: index.tsx was edited by hand, the server does not overwrite it. Delete index.tsx and add {"op":"markup"} again to get the server markup.'
        );
      } else {
        directory.write('index.tsx', coreAssembly(verdict.intent, plan.task));
        if (applied.markup)
          report.push(
            // Разметка сервера — готовый этап: модель на core читала её и переписывала руками с
            // выдуманным API, ломая типы (батч 20261114T192434Z-731c, registration-create).
            '- markup: index.tsx written — fields, rows and steps of the layout, a submit button. The markup is done and belongs to the server: do not rewrite index.tsx — every later edit updates it.'
          );
      }
    }
  }

  const removed = restoreServerFiles(directory, plan.target);
  const built = await formBuildTool({ dir: args.dir }, k);
  const buildText = guidedBuildText(built.content[0]?.text ?? '', serverMarkupIn(directory));
  const ok = built.isError !== true && buildText.startsWith('✓ form_build');
  if (!ok) putBack(directory, removed);
  report.push(...restoredLine(removed, ok));
  plan = withBuild(plan, directory, buildText, ok);
  directory.write(PLAN_FILE, serializePlan(plan));
  // Отклонённые правки — раньше следующего этапа: иначе этап считался сделанным по одной принятой
  // правке, и план уходил дальше без остальных (L1-login: пароль остался необязательным).
  let status = statusLines(plan, directory, dir);
  const rejected = applied.outcomes.filter((outcome) => !outcome.ok).length;
  if (ok && rejected > 0) {
    const op = applied.outcomes.find((outcome) => outcome.op !== '?')?.op ?? 'add_field';
    status = [
      status[0],
      `Next: ${rejected === 1 ? 'one edit was' : `${rejected} edits were`} rejected — send ${rejected === 1 ? 'it' : 'them'} again, fixed as the ✗ lines say (or leave ${rejected === 1 ? 'that edit' : 'those edits'} out, if the task does not need ${rejected === 1 ? 'it' : 'them'} — the fields stay); the plan moves on after that:`,
      editCall(dir, `[{"op":"${op}", …}]`),
    ];
  }
  const text = [...report, buildText, ...status].join('\n');
  return { content: [{ type: 'text', text }], ...(ok ? {} : { isError: true }) };
}

// ---------- form_build в профиле guided ----------

/**
 * `form_build` профиля: без грамматики — она уводила модель писать intent руками. Сборка и так идёт
 * после каждой правки; вызов нужен, чтобы пересобрать текущие файлы.
 */
export const formBuildGuidedToolDefinition = {
  name: 'form_build',
  description:
    'Build the module again from the current form files. form_edit already builds after every edit — call this only when an answer asks to build. The answer ends with the plan and "Next:".',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: { type: 'string', description: 'Form folder (default "form").' },
    },
    required: [],
  },
};

/**
 * `form_build` профиля guided: та же сборка, но ответ кончается планом и `Next:`. Иначе ✓ сборки
 * читался как конец работы: модель собирала форму с несделанной валидацией и останавливалась без
 * «Done» (L1-login, батч 20261113T143135Z-5a33).
 */
export async function formBuildGuidedTool(
  args: Record<string, unknown>,
  k: Knowledge
): Promise<ToolTextResult> {
  // Грамматика уводила модель писать intent руками: девять запросов грамматики подряд, затем
  // index.tsx от руки и 12 ошибок типов (L3-order-total, 20261113T202828Z-32b0). В профиле форма
  // меняется только правками.
  if (args.grammar !== undefined) {
    const opened = openDir({ ...args, dir: args.dir ?? 'form' }, k, 'form_build');
    const plan = isOpened(opened) ? parsePlan(opened.directory.read(PLAN_FILE)) : null;
    const lines = [
      'form_build: no grammar here — in this profile the form changes only with form_edit (flat edits); the server writes every file of the form.',
    ];
    return {
      content: [
        {
          type: 'text',
          text: [
            ...lines,
            ...(plan && isOpened(opened) ? statusLines(plan, opened.directory, opened.dir) : []),
          ].join('\n'),
        },
      ],
    };
  }
  const opened = openDir(args, k, 'form_build');
  if (!isOpened(opened)) return opened;
  const { directory, dir } = opened;
  let plan = parsePlan(directory.read(PLAN_FILE));
  if (!plan) {
    // Ни плана, ни формы: обычная сборка ответила бы грамматикой с «напиши intent по ней» — в
    // профиле это путь мимо правок. Форма есть (затравка, replay стенда) — собрать и назвать formStart.
    if (directory.read(INTENT_FILE) === null) return noPlan('form_build', dir, directory);
    const built = await formBuildTool(args, k);
    const text = [
      guidedBuildText(built.content[0]?.text ?? '', serverMarkupIn(directory)),
      ...noPlanLines('form_build', dir, directory).slice(1),
    ].join('\n');
    return { ...built, content: [{ type: 'text', text }] };
  }
  const guarded = guardIntent(plan, directory);
  const restored = restoreServerFiles(directory, plan.target);
  const built = await formBuildTool(args, k);
  const buildText = guidedBuildText(built.content[0]?.text ?? '', serverMarkupIn(directory));
  const ok = built.isError !== true && buildText.startsWith('✓ form_build');
  if (!ok) putBack(directory, restored);
  plan = withBuild(plan, directory, buildText, ok);
  directory.write(PLAN_FILE, serializePlan(plan));
  const text = [
    ...guarded,
    ...restoredLine(restored, ok),
    buildText,
    ...statusLines(plan, directory, dir),
  ].join('\n');
  return { ...built, content: [{ type: 'text', text }] };
}

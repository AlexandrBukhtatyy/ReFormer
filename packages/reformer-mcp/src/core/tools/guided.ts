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

import { buildAssemblyTsx, buildMessagesTs } from '../generate/builders.js';
import { catalogsOf } from '../generate/catalogs.js';
import {
  readTargetStack,
  type FormIntent,
  type ReformerTargetStack,
} from '../generate/form-intent.js';
import { originOf } from '../generate/generated-marker.js';
import { formatIntentJson } from '../generate/intent-format.js';
import { judgeIntent } from '../generate/judge.js';
import { MODEL_BEHAVIOR_KINDS } from '../generate/operator-catalog.js';
import { applyEdits, EDIT_OPS, type EditOutcome } from '../guided/edits.js';
import {
  behaviorWord,
  crossWord,
  featuresFromSpec,
  featuresFromText,
  validationWord,
} from '../guided/features.js';
import { buildCoreMarkup, MARKUP_MARK } from '../guided/markup.js';
import {
  editCall,
  fingerprint,
  nextLines,
  parsePlan,
  PLAN_FILE,
  planState,
  progressLine,
  serializePlan,
  stageGoal,
  stagesFor,
  STAGE_ORDER,
  TASK_LIMIT,
  taskGaps,
  validationStarted,
  type GuidedPlan,
  type StageId,
} from '../guided/plan.js';
import type { Knowledge } from '../knowledge.js';
import { analyzeSpec } from '../spec/analyze.js';
import type { FormDirectory } from '../workspace/form-workspace.js';
import { formBuildTool, INTENT_FILE } from './form-build.js';
import { planFormTool } from './plan-form.js';
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
    'Change the form with small edits; the server writes form.intent.json and builds the module (never write module files yourself). Edits are applied one by one: a rejected edit says how to fix it, the others still apply. "edits":[] just builds. Names, labels and texts come from the task.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: { type: 'string', description: 'Form folder (default "form").' },
      edits: {
        type: 'array',
        description:
          'add_field {name,label,type?,options?,mask?,placeholder?,readonly?,step?} · set_field {name,…} · remove_field {name} · add_array {name,label,minItems?,maxItems?} · add_item_field {array,name,label,type?} · add_step {title,fields} · place {name,step} · add_rule {field,array?,required?,email?,min?,max?,minLength?,maxLength?,pattern?,rule?,cross?,when?,message?} · remove_rule {field,rule?} · add_behavior {kind,target,expr,array?,when?,resetOnDisable?} · remove_behavior {target,kind?} · add_visibility {field,showWhen|hideWhen} · set_form {formName} · markup (core: the server writes index.tsx)',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: [...EDIT_OPS] },
            name: { type: 'string' },
            field: { type: 'string' },
            label: { type: 'string' },
            type: { type: 'string', enum: ['string', 'number', 'boolean', 'date'] },
            component: { type: 'string' },
            options: { type: 'array', items: { type: ['string', 'number', 'object'] } },
            mask: { type: 'string' },
            placeholder: { type: 'string' },
            readonly: { type: 'boolean' },
            initialValue: {},
            step: { type: 'string' },
            array: { type: 'string' },
            minItems: { type: 'number' },
            maxItems: { type: 'number' },
            title: { type: 'string' },
            fields: { type: 'array', items: { type: 'string' } },
            required: { type: 'boolean' },
            email: { type: 'boolean' },
            min: { type: 'number' },
            max: { type: 'number' },
            minLength: { type: 'number' },
            maxLength: { type: 'number' },
            pattern: { type: 'string' },
            rule: { type: 'string' },
            cross: { type: 'string' },
            equals: { type: 'string' },
            when: { type: 'string' },
            message: { type: 'string' },
            kind: { type: 'string', enum: [...MODEL_BEHAVIOR_KINDS] },
            target: { type: 'string' },
            expr: { type: 'string' },
            resetOnDisable: { type: 'boolean' },
            showWhen: { type: 'string' },
            hideWhen: { type: 'string' },
            formName: { type: 'string' },
          },
          required: ['op'],
        },
      },
    },
    required: ['edits'],
  },
};

/** Ключи одной правки (кроме `op`): по ним ключи за скобкой списка узнаются как ключи правки. */
const EDIT_KEYS: ReadonlySet<string> = new Set(
  Object.keys(formEditToolDefinition.inputSchema.properties.edits.items.properties).filter(
    (key) => key !== 'op'
  )
);

export const formStatusToolDefinition = {
  name: 'form_status',
  description:
    'The plan of the form: which stages are done, whether the last build passed, the next call. "skip" drops a stage the task does not need, "add" adds one it needs (validation, cross, behavior, arrays, wizard).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: { type: 'string', description: 'Form folder (default "form").' },
      skip: { type: 'string', enum: STAGE_ORDER.filter((s) => s !== 'fields' && s !== 'markup') },
      add: { type: 'string', enum: STAGE_ORDER.filter((s) => s !== 'fields' && s !== 'markup') },
      confirm: {
        type: 'string',
        enum: ['validation'],
        description: 'The rules were checked against the task: every limit it names has a rule.',
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

function noPlan(tool: string, dir: string): ToolTextResult {
  return invalidCall(
    `✗ ${tool}: no plan in ${dir}/${PLAN_FILE} — start the form first:\n` +
      `Next: form_start {"dir":${JSON.stringify(dir)},"target":"<${TARGETS}>","task":"<the task text, word for word>"}`
  );
}

function statusLines(plan: GuidedPlan, directory: FormDirectory, dir: string): string[] {
  const state = planState(plan, directory.read(INTENT_FILE), directory.read('index.tsx'));
  return [progressLine(state), ...fieldsLine(state.intent), ...nextLines(plan, state, dir)];
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
function guidedBuildText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.startsWith('⚠️ No markup yet'))
    .join('\n');
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
function restoreServerFiles(directory: FormDirectory, target: string): string[] {
  const files = target === 'core' ? SERVER_FILES : [...SERVER_FILES, 'index.tsx'];
  const restored: string[] = [];
  for (const file of files) {
    const content = directory.read(file);
    if (content === null || originOf(content, file) === 'generated') continue;
    directory.remove(file);
    restored.push(file);
  }
  return restored;
}

const restoredLine = (files: readonly string[]): string[] =>
  files.length > 0
    ? [
        `Written by hand and replaced by the build: ${files.join(', ')} — the server writes the module; change the form only with form_edit.`,
      ]
    : [];

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

/** Имя формы по заданию: заголовок до двоеточия или первая фраза, не длиннее пяти слов. */
function formNameOf(task: string): string {
  const head = task.split(/[:.!?\n]/)[0]?.trim() ?? '';
  const words = head.split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(' ') || 'Form';
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
  const specPath = typeof args.specPath === 'string' ? args.specPath.trim() : '';
  if (!task && !specPath) {
    return invalidCall(
      '✗ form_start: give "task" (the task text) or "specPath" (a markdown spec of the form).'
    );
  }

  const lines: string[] = [];
  if (given && target !== given) {
    lines.push(`"target" taken from the task: @reformer/${target} → "${target}" (not "${given}").`);
  }
  let features = featuresFromText(task);
  let source: GuidedPlan['source'] = 'task';
  let formName =
    typeof args.formName === 'string' && args.formName.trim()
      ? args.formName.trim()
      : formNameOf(task);
  if (specPath) {
    const spec = k.spec.read(specPath);
    if (spec === null) {
      return invalidCall(
        `✗ form_start: spec not found — \`${specPath}\`. The task is in the message? Call form_start with "task" instead.`
      );
    }
    const analysis = analyzeSpec(spec);
    features = featuresFromSpec(analysis, spec);
    source = 'spec';
    if (!(typeof args.formName === 'string' && args.formName.trim()))
      formName = analysis.formName || formName;
    if (directory.read(INTENT_FILE) === null) {
      const drafted = await planFormTool({ specPath, dir: args.dir, target }, k);
      const draft = drafted.content[0].text.split('\n');
      // Черновик и что дописать руками — из ответа plan_form, без его «Next»: следующий шаг здесь свой.
      lines.push(
        ...draft.filter((line) => line.trim() && !line.startsWith('Next:')).slice(0, 16),
        ''
      );
    } else {
      lines.push(`${dir}/${INTENT_FILE} already exists — the plan continues it.`, '');
    }
  }

  const stages = stagesFor(features, target);
  const previous = parsePlan(directory.read(PLAN_FILE));
  const plan: GuidedPlan = {
    version: 1,
    formName,
    target,
    source,
    ...(specPath ? { specPath } : {}),
    ...(task ? { task: task.length > TASK_LIMIT ? `${task.slice(0, TASK_LIMIT)}…` : task } : {}),
    stages,
    skipped: [],
    ...(previous?.lastBuild ? { lastBuild: previous.lastBuild } : {}),
  };
  directory.write(PLAN_FILE, serializePlan(plan));

  const head = [
    `✓ form_start: the plan of «${formName}» on ${target} is saved to ${dir}/${PLAN_FILE}.`,
    'Change the form ONLY with form_edit: it writes form.intent.json and builds the module. Do not write module files yourself.',
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

// ---------- form_status ----------

export async function formStatusTool(
  args: Record<string, unknown>,
  k: Knowledge
): Promise<ToolTextResult> {
  const opened = openDir(args, k, 'form_status');
  if (!isOpened(opened)) return opened;
  const { directory, dir } = opened;
  let plan = parsePlan(directory.read(PLAN_FILE));
  if (!plan) return noPlan('form_status', dir);
  const lines: string[] = [];
  const optional = (stage: string): stage is StageId =>
    (STAGE_ORDER as readonly string[]).includes(stage) && stage !== 'fields' && stage !== 'markup';
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
        `✗ form_status: "add" is one of ${STAGE_ORDER.filter(optional).join(', ')}, not ${wrong.join(', ')}.`
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
      return invalidCall('✗ form_status: "confirm" is a stage of this plan, e.g. "validation".');
    }
    const intent = planState(plan, directory.read(INTENT_FILE), null).intent;
    const gaps = intent ? taskGaps(plan.task, intent) : [];
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
              'Add the missing fields and rules with form_edit. These are not limits of the form? Send the same confirm again.',
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
          plan.stages.filter((s) => s !== 'fields' && s !== 'markup').join(', ') || 'none'
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
  if (!plan) return noPlan('form_edit', dir);
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

  const source = directory.read(INTENT_FILE);
  let raw: Record<string, unknown> = {};
  if (source !== null) {
    try {
      const parsed: unknown = JSON.parse(source);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        raw = parsed as Record<string, unknown>;
    } catch {
      return invalidCall(
        `✗ form_edit: ${dir}/${INTENT_FILE} is not JSON — it was written by hand. Delete it and repeat the edits: form_edit writes it itself.`
      );
    }
  }
  const notes: string[] = editsNote ? [editsNote] : [];
  if (raw.formName === undefined) raw.formName = plan.formName;
  // Стек — из плана: модель, писавшая форму на core, ставила другой таргет и получала один отказ раз
  // за разом (батч 20261112T163051Z-ad08). Аргумент, который сервер знает, у модели не спрашивают.
  if (raw.target !== plan.target) {
    if (raw.target !== undefined)
      notes.push(`target set back to ${plan.target} — the stack of the plan.`);
    raw.target = plan.target;
  }

  const catalogs = await catalogsOf(k);
  const applied = applyEdits(raw, edits, {
    uiKit: catalogs.uiKit,
    rules: new Set(catalogs.core.found ? catalogs.core.rules.keys() : []),
    target: plan.target as ReformerTargetStack,
    rows: plan.stages.includes('arrays') && !plan.skipped.includes('arrays'),
    wizard: plan.stages.includes('wizard') && !plan.skipped.includes('wizard'),
    ...(plan.task ? { task: plan.task } : {}),
  });
  const accepted = applied.outcomes.filter((outcome) => outcome.ok).length;
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

  directory.write(INTENT_FILE, formatIntentJson(applied.file));

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
        const messages = buildMessagesTs(verdict.intent).content !== null;
        directory.write(
          'index.tsx',
          buildAssemblyTsx(verdict.intent, buildCoreMarkup(verdict.intent, messages))
        );
        if (applied.markup)
          report.push(
            '- markup: index.tsx written — fields, rows and steps of the layout, a submit button.'
          );
      }
    }
  }

  report.push(...restoredLine(restoreServerFiles(directory, plan.target)));
  const built = await formBuildTool({ dir: args.dir }, k);
  const buildText = guidedBuildText(built.content[0]?.text ?? '');
  const ok = built.isError !== true && buildText.startsWith('✓ form_build');
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
      'form_build: no grammar here — in this profile the form changes only with form_edit (flat edits); the server writes form.intent.json and the module.',
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
  const before = openDir(args, k, 'form_build');
  const planned = isOpened(before) ? parsePlan(before.directory.read(PLAN_FILE)) : null;
  const restored =
    planned && isOpened(before) ? restoreServerFiles(before.directory, planned.target) : [];
  const built = await formBuildTool(args, k);
  const opened = openDir(args, k, 'form_build');
  if (!isOpened(opened)) return built;
  const { directory, dir } = opened;
  let plan = parsePlan(directory.read(PLAN_FILE));
  if (!plan) return built;
  const buildText = guidedBuildText(built.content[0]?.text ?? '');
  const ok = built.isError !== true && buildText.startsWith('✓ form_build');
  plan = withBuild(plan, directory, buildText, ok);
  directory.write(PLAN_FILE, serializePlan(plan));
  const text = [...restoredLine(restored), buildText, ...statusLines(plan, directory, dir)].join(
    '\n'
  );
  return { ...built, content: [{ type: 'text', text }] };
}

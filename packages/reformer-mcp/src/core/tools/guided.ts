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
import { readTargetStack, type ReformerTargetStack } from '../generate/form-intent.js';
import { formatIntentJson } from '../generate/intent-format.js';
import { judgeIntent } from '../generate/judge.js';
import { MODEL_BEHAVIOR_KINDS } from '../generate/operator-catalog.js';
import { applyEdits, EDIT_OPS } from '../guided/edits.js';
import { featuresFromSpec, featuresFromText } from '../guided/features.js';
import { buildCoreMarkup, MARKUP_MARK } from '../guided/markup.js';
import {
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
      task: { type: 'string', description: 'The task text, as given.' },
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
          'add_field {name,label,type?,options?,mask?,placeholder?,readonly?,step?} · set_field {name,…} · remove_field {name} · add_array {name,label,minItems?,maxItems?} · add_item_field {array,name,label,type?} · add_step {title,fields} · place {name,step} · add_rule {field,array?,required?,email?,min?,max?,minLength?,maxLength?,pattern?,rule?,cross?,when?,message?} · add_behavior {kind,target,expr,array?,when?,resetOnDisable?} · add_visibility {field,showWhen|hideWhen} · set_form {formName} · markup (core: the server writes index.tsx)',
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

export const formStatusToolDefinition = {
  name: 'form_status',
  description:
    'The plan of the form: which stages are done, whether the last build passed, the next call. "skip" drops a stage the task does not need (validation, cross, behavior, arrays, wizard).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: { type: 'string', description: 'Form folder (default "form").' },
      skip: { type: 'string', enum: STAGE_ORDER.filter((s) => s !== 'fields' && s !== 'markup') },
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
      `Next: form_start {"dir":${JSON.stringify(dir)},"target":"<${TARGETS}>","task":"<the task text>"}`
  );
}

function statusLines(plan: GuidedPlan, directory: FormDirectory, dir: string): string[] {
  const state = planState(plan, directory.read(INTENT_FILE), directory.read('index.tsx'));
  return [progressLine(state), ...nextLines(plan, state, dir)];
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
  const target = readTargetStack(args?.target);
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
  if (args.skip !== undefined) {
    const skip = args.skip as StageId;
    if (skip === 'fields' || skip === 'markup' || !plan.stages.includes(skip)) {
      return invalidCall(
        `✗ form_status: "skip" is a stage of this plan other than fields and markup: ${
          plan.stages.filter((s) => s !== 'fields' && s !== 'markup').join(', ') || 'none'
        }.`
      );
    }
    plan = { ...plan, skipped: [...new Set([...plan.skipped, skip])] };
    directory.write(PLAN_FILE, serializePlan(plan));
    lines.push(`Stage ${skip} skipped.`);
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
  if (!Array.isArray(args.edits)) {
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
  const notes: string[] = [];
  if (raw.formName === undefined) raw.formName = plan.formName;
  // Стек — из плана: модель, писавшая форму на core, ставила другой таргет и получала один отказ раз
  // за разом (батч 20261112T163051Z-ad08). Аргумент, который сервер знает, у модели не спрашивают.
  if (raw.target !== plan.target) {
    if (raw.target !== undefined)
      notes.push(`target set back to ${plan.target} — the stack of the plan.`);
    raw.target = plan.target;
  }

  const catalogs = await catalogsOf(k);
  const applied = applyEdits(raw, args.edits, {
    uiKit: catalogs.uiKit,
    rules: new Set(catalogs.core.found ? catalogs.core.rules.keys() : []),
    target: plan.target as ReformerTargetStack,
  });
  const accepted = applied.outcomes.filter((outcome) => outcome.ok).length;
  const report = [
    `form_edit: ${accepted} of ${applied.outcomes.length} edits applied.`,
    ...applied.outcomes.map(
      (outcome) =>
        `- ${outcome.ok ? '✓' : `✗ edit ${outcome.index + 1}`} ${outcome.op}: ${outcome.message}`
    ),
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

  const built = await formBuildTool({ dir: args.dir }, k);
  const buildText = built.content[0]?.text ?? '';
  const ok = built.isError !== true && buildText.startsWith('✓ form_build');
  plan = {
    ...plan,
    lastBuild: {
      ok,
      typesChecked: ok && buildText.includes('Types checked, no errors.'),
      intent: fingerprint(directory.read(INTENT_FILE)),
      index: fingerprint(directory.read('index.tsx')),
    },
  };
  directory.write(PLAN_FILE, serializePlan(plan));
  const text = [...report, buildText, ...statusLines(plan, directory, dir)].join('\n');
  return { content: [{ type: 'text', text }], ...(ok ? {} : { isError: true }) };
}

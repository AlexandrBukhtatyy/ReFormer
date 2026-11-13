/**
 * План профиля guided: этапы сборки формы, их состояние и один следующий вызов.
 *
 * План лежит файлом `form.plan.json` в каталоге формы, а не в памяти сервера и не в контексте
 * модели. Стенд держит целиком только четыре последних ответа инструментов, а малая модель теряет
 * маршрут через несколько шагов. Поэтому каждый ответ профиля заново вычисляет состояние с диска и
 * кончается строкой `Next:` с одним готовым вызовом.
 *
 * Готовность этапа решает сервер по содержимому intent, а не модель. «Готово» (`Done`) ставится,
 * только когда все этапы сделаны или пропущены, последняя сборка прошла на текущих файлах и типы
 * проверены. Так закрывается ложный успех: 7 из 14 проваленных прогонов qwen3.5:4b кончались
 * словами «форма успешно собрана» (аудит 2026-11).
 *
 * @module reformer-mcp/core/guided/plan
 */

import { readIntent, type FormIntent, type ReformerTargetStack } from '../generate/form-intent.js';
import { collectSteps } from '../generate/schema-emit.js';
import type { TaskFeatures } from './features.js';

export const PLAN_FILE = 'form.plan.json';

/** Этапы в порядке исполнения. */
export const STAGE_ORDER = [
  'fields',
  'arrays',
  'wizard',
  'validation',
  'cross',
  'behavior',
  'markup',
] as const;
export type StageId = (typeof STAGE_ORDER)[number];

/** Последняя сборка: прошла ли она и на каких файлах. */
export interface BuildMark {
  readonly ok: boolean;
  readonly typesChecked: boolean;
  /** Отпечаток `form.intent.json`, на котором шла сборка. */
  readonly intent: string;
  /** Отпечаток `index.tsx` после сборки — на core разметку меняют и без intent. */
  readonly index: string;
}

export interface GuidedPlan {
  readonly version: 1;
  readonly formName: string;
  readonly target: ReformerTargetStack;
  readonly source: 'task' | 'spec';
  readonly specPath?: string;
  readonly stages: readonly StageId[];
  readonly skipped: readonly StageId[];
  readonly lastBuild?: BuildMark;
}

/** Этапы под признаки задачи: поля всегда, разметка — только на core. */
export function stagesFor(features: TaskFeatures, target: ReformerTargetStack): StageId[] {
  return STAGE_ORDER.filter((stage) => {
    switch (stage) {
      case 'fields':
        return true;
      case 'markup':
        return target === 'core';
      default:
        return features[stage];
    }
  });
}

/** Отпечаток текста: FNV-1a, 32 бита. В `core/` нет node-глобалов, поэтому без `crypto`. */
export function fingerprint(text: string | null): string {
  let hash = 0x811c9dc5;
  for (const char of text ?? '') {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const isStage = (value: unknown): value is StageId =>
  typeof value === 'string' && (STAGE_ORDER as readonly string[]).includes(value);

/** План из файла; битый или чужой файл — `null`, как если бы плана не было. */
export function parsePlan(text: string | null): GuidedPlan | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const plan = raw as Partial<GuidedPlan> | null;
  if (!plan || plan.version !== 1 || !Array.isArray(plan.stages)) return null;
  if (!plan.stages.every(isStage) || typeof plan.target !== 'string') return null;
  return {
    version: 1,
    formName: typeof plan.formName === 'string' ? plan.formName : 'Form',
    target: plan.target,
    source: plan.source === 'spec' ? 'spec' : 'task',
    ...(typeof plan.specPath === 'string' ? { specPath: plan.specPath } : {}),
    stages: plan.stages,
    skipped: Array.isArray(plan.skipped) ? plan.skipped.filter(isStage) : [],
    ...(plan.lastBuild ? { lastBuild: plan.lastBuild } : {}),
  };
}

export function serializePlan(plan: GuidedPlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}

/** Intent с диска, прочитанный без справочников: для подсчёта этапов их не нужно. */
function intentOf(text: string | null): FormIntent | null {
  if (text === null) return null;
  try {
    return readIntent(JSON.parse(text)).intent;
  } catch {
    return null;
  }
}

/** Сделан ли этап по содержимому формы. */
function stageDone(stage: StageId, intent: FormIntent | null, index: string | null): boolean {
  if (stage === 'markup') return index !== null && !index.includes('return null;');
  if (!intent) return false;
  switch (stage) {
    case 'fields':
      return intent.fields.length + intent.arrays.length > 0;
    case 'arrays':
      return intent.arrays.length > 0 && intent.arrays.every((a) => a.itemFields.length > 0);
    case 'wizard':
      return collectSteps(intent.layoutRoot).length > 0;
    case 'validation':
      return intent.validation.some((row) => !row.cross && row.rules.length > 0);
    case 'cross':
      return intent.validation.some((row) => Boolean(row.cross));
    case 'behavior':
      return intent.behavior.length + intent.visibility.length > 0;
  }
}

export interface StageState {
  readonly id: StageId;
  readonly done: boolean;
  readonly skipped: boolean;
}

export interface PlanState {
  readonly stages: readonly StageState[];
  /** Последняя сборка прошла на текущих файлах. */
  readonly built: boolean;
  /** Последняя сборка шла на текущих файлах и упала. */
  readonly failed: boolean;
  readonly typesChecked: boolean;
  /** Первый несделанный этап. */
  readonly pending: StageId | null;
  readonly complete: boolean;
  /** Intent ещё не записан: собирать нечего, первым идёт этап плана. */
  readonly fresh: boolean;
  /** Intent с диска, прочитанный без справочников; `null` — его нет или он не читается. */
  readonly intent: FormIntent | null;
}

/** Состояние плана по файлам каталога формы. */
export function planState(
  plan: GuidedPlan,
  intentText: string | null,
  indexText: string | null
): PlanState {
  const intent = intentOf(intentText);
  const stages = plan.stages.map((id) => ({
    id,
    done: stageDone(id, intent, indexText),
    skipped: plan.skipped.includes(id),
  }));
  const last = plan.lastBuild;
  const current =
    last !== undefined &&
    last.intent === fingerprint(intentText) &&
    last.index === fingerprint(indexText);
  const built = current && last.ok;
  const pending = stages.find((stage) => !stage.done && !stage.skipped)?.id ?? null;
  const typesChecked = built && last.typesChecked;
  return {
    stages,
    built,
    failed: current && !last.ok,
    typesChecked,
    pending,
    complete: built && typesChecked && pending === null,
    fresh: intentText === null,
    intent,
  };
}

/** Строка хода плана: `✓` — сделан, `⊘` — пропущен, `→` — текущий, `○` — впереди. */
export function progressLine(state: PlanState): string {
  const marks = state.stages.map((stage) => {
    const mark = stage.done ? '✓' : stage.skipped ? '⊘' : stage.id === state.pending ? '→' : '○';
    return `${mark} ${stage.id}`;
  });
  const build = state.built
    ? state.typesChecked
      ? 'built, types checked'
      : 'built, types NOT checked'
    : state.failed
      ? 'build failed'
      : 'not built since the last change';
  return `Plan: ${marks.join(' · ')} | ${build}`;
}

/** Что делается на этапе: для ответа `form_start`. */
export function stageGoal(stage: StageId, target: ReformerTargetStack): string {
  switch (stage) {
    case 'fields':
      return 'every input of the task: one add_field each, all in one call; a choice: "options"; a computed or read-only field: "readonly":true';
    case 'arrays':
      return 'repeating rows: add_array (min/max rows), then add_item_field for each column of a row';
    case 'wizard':
      return 'steps in order: add_step with the names of its fields and arrays; every field goes to a step';
    case 'validation':
      return 'add_rule per field: required, email, min/max, minLength/maxLength, pattern; "message" — its text; "when" — only on a condition';
    case 'cross':
      return 'rules across fields: add_rule with "cross" — an expression over values, TRUE when valid';
    case 'behavior':
      return target === 'core'
        ? 'reactions: add_behavior compute (a calculated field), enableWhen (a field active only on a condition)'
        : 'reactions: add_behavior compute (a calculated field); a field shown only on a condition: add_visibility showWhen';
    case 'markup':
      return 'on core the form needs JSX markup: {"op":"markup"} — the server writes index.tsx';
  }
}

/**
 * Правки этапа на полях самой формы. Малая модель копирует пример дословно, и пример с чужими
 * именами (`email`, `age`) давал отказ «нет поля» (прогон MCP профиля, 2026-11-13). Имена полей
 * сервер знает — их и подставляет; содержание (обязательность, тексты) модель берёт из задания.
 */
function examplesOn(
  stage: StageId,
  target: ReformerTargetStack,
  intent: FormIntent
): Array<Record<string, unknown>> | null {
  const names = intent.fields.map((field) => field.modelPath ?? field.name);
  if (names.length === 0) return null;
  const numbers = intent.fields.filter((field) => field.type === 'number');
  const choice = intent.fields.find((field) => Array.isArray(field.componentProps?.options));
  switch (stage) {
    case 'validation':
      return names.slice(0, 2).map((field) => ({ op: 'add_rule', field, required: true }));
    case 'cross':
      return names.length < 2
        ? null
        : [{ op: 'add_rule', field: names[1], cross: `values.${names[1]} === values.${names[0]}` }];
    case 'wizard': {
      const half = Math.ceil(names.length / 2);
      return [
        { op: 'add_step', title: 'Step 1', fields: names.slice(0, half) },
        ...(names.length > 1
          ? [{ op: 'add_step', title: 'Step 2', fields: names.slice(half) }]
          : []),
      ];
    }
    case 'behavior': {
      const edits: Array<Record<string, unknown>> = [];
      const computed = numbers.find((field) => field.componentProps?.readOnly === true);
      const inputs = numbers.filter((field) => field !== computed).slice(0, 2);
      if (computed && inputs.length > 0) {
        edits.push({
          op: 'add_behavior',
          kind: 'compute',
          target: computed.name,
          expr: inputs.map((field) => `(model.${field.name} ?? 0)`).join(' * '),
        });
      }
      const options = choice?.componentProps?.options as Array<{ value?: unknown }> | undefined;
      const dependent = names.find((name) => name !== choice?.name && name !== computed?.name);
      if (choice && dependent && options?.[0]?.value !== undefined) {
        const condition = `model.${choice.name} === ${JSON.stringify(options[0].value).replace(/"/g, "'")}`;
        edits.push(
          target === 'core'
            ? { op: 'add_behavior', kind: 'enableWhen', target: dependent, expr: condition }
            : { op: 'add_visibility', field: dependent, showWhen: condition }
        );
      }
      return edits.length > 0 ? edits : null;
    }
    default:
      return null;
  }
}

/** Пример правок этапа: на полях формы, когда они есть; иначе — синтаксис на условных именах. */
export function stageExample(
  stage: StageId,
  target: ReformerTargetStack,
  intent: FormIntent | null = null
): string {
  const own = intent ? examplesOn(stage, target, intent) : null;
  if (own) return JSON.stringify(own);
  switch (stage) {
    case 'fields':
      return '[{"op":"add_field","name":"email","label":"Email"},{"op":"add_field","name":"age","type":"number","label":"Age"},{"op":"add_field","name":"city","label":"City","options":["Moscow","Kazan"]}]';
    case 'arrays':
      return '[{"op":"add_array","name":"contacts","label":"Contacts","minItems":1,"maxItems":5},{"op":"add_item_field","array":"contacts","name":"phone","label":"Phone"}]';
    case 'wizard':
      return '[{"op":"add_step","title":"Contacts","fields":["email","phone"]},{"op":"add_step","title":"Details","fields":["age","contacts"]}]';
    case 'validation':
      return '[{"op":"add_rule","field":"email","required":true,"email":true,"message":"Enter a valid email"},{"op":"add_rule","field":"age","min":18,"max":120,"message":"Age 18 to 120"}]';
    case 'cross':
      return '[{"op":"add_rule","field":"confirmPassword","cross":"values.confirmPassword === values.password","message":"Passwords do not match"}]';
    case 'behavior':
      return target === 'core'
        ? '[{"op":"add_behavior","kind":"compute","target":"total","expr":"(model.price ?? 0) * (model.quantity ?? 0)"},{"op":"add_behavior","kind":"enableWhen","target":"address","expr":"model.method === \'delivery\'"}]'
        : '[{"op":"add_behavior","kind":"compute","target":"total","expr":"(model.price ?? 0) * (model.quantity ?? 0)"},{"op":"add_visibility","field":"address","showWhen":"model.method === \'delivery\'"}]';
    case 'markup':
      return '[{"op":"markup"}]';
  }
}

/** Готовый вызов `form_edit` с правками. */
export function editCall(dir: string, edits: string): string {
  return `form_edit {"dir":${JSON.stringify(dir)},"edits":${edits}}`;
}

/** Блок следующего шага: ровно один вызов или «готово». */
export function nextLines(plan: GuidedPlan, state: PlanState, dir: string): string[] {
  if (state.failed) {
    return [
      'Next: fix the errors above with form_edit (set_field, remove_field, add_rule …) — the build runs again after the edits:',
      editCall(dir, '[{"op":"set_field","name":"…"}]'),
    ];
  }
  if (!state.built && !state.fresh) {
    return ['Next: build the current files:', editCall(dir, '[]')];
  }
  if (state.pending !== null) {
    const skip = state.pending === 'fields' || state.pending === 'markup';
    return [
      `Next — ${state.pending}: ${stageGoal(state.pending, plan.target)}.`,
      editCall(dir, stageExample(state.pending, plan.target, state.intent)),
      ...(skip
        ? []
        : [
            `The task has no ${state.pending}? form_status {"dir":${JSON.stringify(dir)},"skip":"${state.pending}"}`,
          ]),
    ];
  }
  if (!state.typesChecked) {
    return [
      'Not done: the types were not checked — the project lacks a TypeScript setup the server can use. Check the module yourself.',
    ];
  }
  return [
    'Done: the form is built, every stage of the plan is complete and the types are checked. Stop here and do not edit module files.',
  ];
}

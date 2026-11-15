/**
 * Инструмент `search` профиля `code-guided-dsl` — код над данными формы, только чтение. Метод — из
 * Code Mode MCP Cloudflare (blog.cloudflare.com/code-mode-mcp): данные в контекст модели не
 * попадают целиком, модель видит только то, что вернул её код.
 *
 * Данные — замороженные глобальные объекты песочницы:
 * - `form` — текущая форма: поля с правилами и шагом, массивы с колонками, шаги, реакции, видимость,
 *   кнопка отправки;
 * - `task` — текст задания плана и разбор спецификации, если она есть;
 * - `api` — методы конструктора с сигнатурой, описанием и примером;
 * - `plan` — этапы, текущий этап, прошла ли сборка.
 *
 * Малой модели не хватало как раз данных: состав формы приходил только текстом ответов и терялся,
 * когда стенд усекал старые ответы. Ответ `search` ведёт обратно в `execute`: справку в guided убрали,
 * потому что малая модель бродила по ней вместо сборки.
 *
 * @module reformer-mcp/core/codemode/dsl/search
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { FormIntent, LayoutNode } from '../../generate/form-intent.js';
import { collectSteps } from '../../generate/schema-emit.js';
import { formSubmitLabel } from '../../guided/markup.js';
import { intentOf, parsePlan, planState, PLAN_FILE, type GuidedPlan } from '../../guided/plan.js';
import type { Knowledge } from '../../knowledge.js';
import { analyzeSpec, type SpecField } from '../../spec/analyze.js';
import { INTENT_FILE } from '../../tools/form-build.js';
import type { ScriptSandbox } from '../run-script.js';
import { asBody } from './host.js';
import { BUILDER_METHODS, signatureOf } from './methods.js';

export const SEARCH_TOOL = 'search';

/** Предел ответа `search`, символы: длиннее — обрезка с советом сузить запрос. */
export const SEARCH_LIMIT = 4000;

/** Вызов `formStart` в ответах, когда плана ещё нет. */
export const START_CALL =
  'console.log(await reformer.formStart({ dir: "form", target: "<stack from the task>", task: "<the task text, word for word, with the stack line>" }))';

const TAIL =
  'search only reads. Change the form with execute — run the code of the last "Next:" or your builder chains.';

type Rec = Record<string, unknown>;

/** Поле формы для `search`: что это за ввод и какие у него проверки. */
interface FieldView {
  readonly name: string;
  readonly label?: string;
  readonly type: string;
  readonly component: string;
  readonly mask?: string;
  readonly options?: unknown;
  readonly readonly?: boolean;
  readonly initial?: unknown;
  readonly step?: string;
  readonly rules: string[];
}

/** Ссылки раскладки внутри узла: поля и массивы. */
function refsOf(node: LayoutNode): string[] {
  if (node.kind === 'field' || node.kind === 'array' || node.kind === 'part') return [node.ref];
  if (node.kind === 'container' || node.kind === 'step') return node.children.flatMap(refsOf);
  return [];
}

/** Проверки поля строками: `required()`, `cross: values.a === values.b`, `… when model.x`. */
function rulesOf(intent: FormIntent, target: string, each?: string): string[] {
  return intent.validation
    .filter((row) => row.target === target && row.each === each)
    .flatMap((row) => {
      const when = row.when ? ` (when ${row.when})` : '';
      return [
        ...row.rules.map((rule) => `${rule}${when}`),
        ...(row.cross ? [`cross: ${row.cross}${when}`] : []),
        ...(row.async ? [`async check${when}`] : []),
        ...(row.call ? [`${row.call}${when}`] : []),
      ];
    });
}

function fieldView(
  field: FormIntent['fields'][number],
  rules: string[],
  step: string | undefined
): FieldView {
  const props = (field.componentProps ?? {}) as Rec;
  return {
    name: field.modelPath ?? field.name,
    ...(field.label ? { label: field.label } : {}),
    type: field.type,
    component: field.component,
    ...(typeof props.mask === 'string' ? { mask: props.mask } : {}),
    ...(props.options !== undefined ? { options: props.options } : {}),
    ...(props.readOnly === true || props.readonly === true ? { readonly: true } : {}),
    ...(field.initialValue !== undefined ? { initial: field.initialValue } : {}),
    ...(step ? { step } : {}),
    rules,
  };
}

/** Снимок текущей формы. */
export function formSnapshot(intent: FormIntent | null): Rec | null {
  if (!intent) return null;
  const steps = collectSteps(intent.layoutRoot).map((step) => ({
    title: step.title,
    fields: step.children.flatMap(refsOf),
  }));
  const stepOf = new Map<string, string>();
  for (const step of steps) for (const ref of step.fields) stepOf.set(ref, step.title);
  const fields = intent.fields.map((field) => {
    const path = field.modelPath ?? field.name;
    return fieldView(field, rulesOf(intent, path), stepOf.get(path));
  });
  const arrays = intent.arrays.map((array) => {
    const path = array.modelPath ?? array.name;
    const props = (array.componentProps ?? {}) as Rec;
    return {
      name: path,
      ...(typeof props.title === 'string' ? { label: props.title } : {}),
      ...(stepOf.get(path) ? { step: stepOf.get(path) } : {}),
      rules: rulesOf(intent, path),
      columns: array.itemFields.map((column) =>
        fieldView(column, rulesOf(intent, path, column.name), undefined)
      ),
    };
  });
  const submit = formSubmitLabel(intent);
  return {
    title: intent.formName,
    target: intent.target,
    fields,
    arrays,
    steps,
    behaviors: intent.behavior.map((row) => ({
      kind: row.kind,
      target: row.each ? `${row.target}[].${row.each}` : row.target,
      ...(row.expr ? { expr: row.expr } : {}),
      ...(row.when ? { when: row.when } : {}),
      sources: row.sources,
    })),
    visibility: intent.visibility.map((row) => ({ field: row.selector, condition: row.condition })),
    ...(submit ? { submit } : {}),
  };
}

const specField = (field: SpecField): Rec => ({
  name: field.name,
  ...(field.label ? { label: field.label } : {}),
  type: field.type,
  component: field.component,
  rules: field.rules,
  ...(field.when ? { when: field.when } : {}),
  ...(field.mask ? { mask: field.mask } : {}),
  ...(field.initialValue !== undefined ? { initial: field.initialValue } : {}),
  ...(field.readOnly ? { readonly: true } : {}),
  ...(field.optional ? { optional: true } : {}),
  ...(field.step !== undefined ? { step: field.step } : {}),
});

/** Снимок задания: текст и разбор спецификации. */
export function taskSnapshot(plan: GuidedPlan, k: Knowledge): Rec {
  const text = plan.task ?? '';
  if (!plan.specPath) return { text };
  const content = k.spec.read(plan.specPath);
  if (content === null) return { text, specPath: plan.specPath };
  const spec = analyzeSpec(content);
  return {
    text,
    specPath: plan.specPath,
    spec: {
      title: spec.formName,
      steps: spec.stepList.map((step) => step.title),
      fields: spec.fields.map(specField),
      arrays: spec.arrayDefs.map((array) => ({
        name: array.name,
        ...(array.label ? { label: array.label } : {}),
        columns: array.itemFields.map(specField),
      })),
      computed: spec.computedFields,
      conditional: spec.conditionalFields,
    },
  };
}

/** Методы конструктора для `search`. */
export function apiSnapshot(): Rec[] {
  return [
    {
      name: 'formStart',
      on: 'reformer',
      signature:
        'formStart(args: { dir?: string; target: "core" | "renderer-react" | "renderer-json"; task: string; specPath?: string }): Promise<string>',
      doc: 'Start the work on a form — the first call, once; the task text word for word.',
      example: START_CALL,
    },
    ...BUILDER_METHODS.map((method) => ({
      name: method.name,
      on: method.on,
      signature: signatureOf(method),
      doc: method.doc,
      ...(method.example ? { example: method.example } : {}),
    })),
  ];
}

/** Снимок плана. */
export function planSnapshot(
  plan: GuidedPlan,
  intentText: string | null,
  indexText: string | null
): Rec {
  const state = planState(plan, intentText, indexText);
  return {
    target: plan.target,
    mode: plan.mode ?? 'create',
    stages: state.stages.map((stage) => ({
      id: stage.id,
      done: stage.done,
      skipped: stage.skipped,
    })),
    pending: state.pending,
    built: state.built,
    complete: state.complete,
  };
}

/** Прелюдия песочницы: данные — замороженными глобальными объектами. */
function dataPrelude(data: Rec): string {
  return `(function () {
  var freeze = function (value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(function (key) { freeze(value[key]); });
    }
    return value;
  };
  var data = JSON.parse(${JSON.stringify(JSON.stringify(data))});
  Object.keys(data).forEach(function (key) {
    Object.defineProperty(globalThis, key, { value: freeze(data[key]), writable: false, configurable: false });
  });
})();`;
}

const answer = (text: string, isError = false): CallToolResult => ({
  content: [{ type: 'text', text }],
  ...(isError ? { isError: true } : {}),
});

/**
 * Исполнить `search`: код модели над снимками формы, задания, API и плана.
 *
 * @param args - `{ code, dir? }`
 */
export async function runSearch(
  args: Rec | undefined,
  k: Knowledge,
  sandbox: ScriptSandbox
): Promise<CallToolResult> {
  const code = args?.code;
  if (typeof code !== 'string' || code.trim() === '') {
    return answer(
      'search: pass code that reads the data and returns what you need, e.g. {"code": "return form.fields.map(f => f.name + \': \' + f.rules.join(\', \'))"}',
      true
    );
  }
  const dir = typeof args?.dir === 'string' && args.dir.trim() ? args.dir : null;
  const opened = k.forms.open(dir);
  if (!opened.ok) return answer(`✗ search: the form folder — ${opened.reason}`, true);
  const { directory } = opened;
  const plan = parsePlan(directory.read(PLAN_FILE));
  if (!plan) {
    return answer(
      [
        'search: no plan yet — there is nothing to read. Start the form with execute (also for a form that already lies in the folder):',
        START_CALL,
      ].join('\n')
    );
  }
  const intentText = directory.read(INTENT_FILE);
  const indexText = directory.read('index.tsx');
  const data = {
    form: formSnapshot(intentOf(intentText)),
    task: taskSnapshot(plan, k),
    api: apiSnapshot(),
    plan: planSnapshot(plan, intentText, indexText),
  };
  const outcome = await sandbox.run(asBody(code), {}, { prelude: dataPrelude(data) });
  const parts = [...outcome.logs];
  if (outcome.returned !== undefined) parts.push(outcome.returned);
  if (outcome.error !== undefined) parts.push(`✗ search error: ${outcome.error}`);
  let text =
    parts.length > 0
      ? parts.join('\n')
      : '(the code printed nothing — return a value or print it with console.log)';
  if (text.length > SEARCH_LIMIT) {
    text = `${text.slice(0, SEARCH_LIMIT)}\n… [cut at ${SEARCH_LIMIT} characters — return only what you need: filter, then map to names]`;
  }
  return answer(`${text}\n${TAIL}`, outcome.error !== undefined);
}

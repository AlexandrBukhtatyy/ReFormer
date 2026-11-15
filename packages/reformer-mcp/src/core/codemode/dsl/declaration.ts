/**
 * Подача профиля `code-guided-dsl`: два инструмента, оба принимают код.
 *
 * - `execute` — правки: `reformer.formStart` и конструктор `reformer.form()`; объявление методов
 *   строится из реестра `methods.ts`, объявление `formStart` — то же, что у `code-guided`.
 * - `search` — только чтение данных формы (`search.ts`).
 *
 * @module reformer-mcp/core/codemode/dsl/declaration
 */

import { OPTIONAL_STAGES } from '../../guided/plan.js';
import type { ToolDefinition } from '../../server/tool-catalog.js';
import { GUIDED_SCRIPT_SURFACE } from '../../tools/guided.js';
import { BUILDER_METHODS, type BuilderOn } from './methods.js';
import { SEARCH_LIMIT, SEARCH_TOOL, START_CALL } from './search.js';

export const EXECUTE_TOOL = 'execute';

const STAGE_TYPE = OPTIONAL_STAGES.map((stage) => JSON.stringify(stage)).join(' | ');

const docLine = (text: string, indent: string): string =>
  `${indent}/** ${text.replace(/\*\//g, '*\\/')} */\n`;

/** Методы одного объекта конструктора строками объявления. */
function members(on: BuilderOn, indent: string): string {
  return BUILDER_METHODS.filter((method) => method.on === on)
    .map(
      (method) =>
        `${docLine(method.doc, indent)}${indent}${method.name}(${method.params}): ${method.returns};\n`
    )
    .join('');
}

const INTERFACES: ReadonlyArray<readonly [Exclude<BuilderOn, 'reformer'>, string]> = [
  [
    'Field',
    'An input of the form (or a column of rows). Every method records an edit and returns the same Field.',
  ],
  ['Rows', 'Repeating rows of the form.'],
  ['Step', 'A wizard step.'],
  ['Form', 'The builder of one form: chains record edits, save() applies them.'],
];

/** TS-объявление `execute`: типы, интерфейсы конструктора и глобальный `reformer`. */
export function executeDeclaration(): string {
  const formStart = GUIDED_SCRIPT_SURFACE.declarations.members.form_start
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
  const types = [
    `/** A stage of the plan. */\ntype Stage = ${STAGE_TYPE};`,
    '/** The form inside a condition or a formula: m.<field> is the value of a field. */\ntype Model = Record<string, any>;',
    '/** A condition or a formula: an arrow with ONE parameter and one expression — m => m.method === "courier". The server reads its text: use only the parameter, literals, Math, Number, String. */\ntype Fn<T> = ((it: T) => unknown) | string;',
  ].join('\n\n');
  const interfaces = INTERFACES.map(
    ([on, doc]) => `${docLine(doc, '')}interface ${on} {\n${members(on, '  ')}}`
  ).join('\n\n');
  return `${types}\n\n${interfaces}\n\ndeclare const reformer: {\n${formStart}\n${members('reformer', '  ')}};`;
}

const EXECUTE_PREAMBLE =
  'Change a ReFormer form with code: the body of an async function (an async arrow works too). The global `reformer` (declared below): `reformer.formStart({…})` once, then the builder — `const f = reformer.form(); f.add("key", "Label").required().minLength(2); console.log(await f.save())`. Chains only record edits; save() applies them in ONE call and builds, and edits left unsaved are saved at the end of the script. A condition or a formula is an arrow over the form: `m => m.method === "courier"`; a check across fields — over its values: `v => v.end >= v.start`. Print every answer with console.log: a line per chain (✓, or ✗ with the fix), then "Next:" with code to run, or "Done:". The server writes every file of the form folder — never write them yourself. Plain JavaScript: no import, require, fs or network. To look at the current form, the task or this API, use the search tool.';

// `target` — заглушка: конкретный стек в примере sonnet переносил в задачу на другом стеке (ad6e,
// registration-create.core: `renderer-react` при «Стек: @reformer/core»).
const EXECUTE_EXAMPLE = START_CALL;

/** Определение `execute` для `tools/list`. */
export function executeToolDefinition(): ToolDefinition {
  return {
    name: EXECUTE_TOOL,
    description: `${EXECUTE_PREAMBLE}\n\n${executeDeclaration()}`,
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: `JavaScript: the body of an async function, e.g. \`${EXECUTE_EXAMPLE}\`.`,
        },
      },
      required: ['code'],
    },
  };
}

const SEARCH_DECLARATION = `/** A field of the form; rules are the checks as code: "required()", "minLength(3)", "cross: …". */
interface FieldView { name: string; label?: string; type: string; component: string; mask?: string; options?: unknown[]; readonly?: boolean; initial?: unknown; step?: string; rules: string[] }

/** The form now; null — nothing is built yet. */
declare const form: null | {
  title: string; target: string;
  fields: FieldView[];
  arrays: Array<{ name: string; label?: string; step?: string; rules: string[]; columns: FieldView[] }>;
  steps: Array<{ title: string; fields: string[] }>;
  behaviors: Array<{ kind: string; target: string; expr?: string; when?: string; sources: string[] }>;
  visibility: Array<{ field: string; condition: string }>;
  submit?: string;
};

/** The task of the plan; spec — the parsed markdown spec when the task has one. */
declare const task: {
  text: string; specPath?: string;
  spec?: { title: string; steps: string[]; fields: object[]; arrays: object[]; computed: string[]; conditional: string[] };
};

/** The builder API: every method with its signature, what it does and an example. */
declare const api: Array<{ name: string; on: string; signature: string; doc: string; example?: string }>;

/** The plan: stages, the current one, the last build. */
declare const plan: {
  target: string; mode: "create" | "edit";
  stages: Array<{ id: string; done: boolean; skipped: boolean }>;
  pending: string | null; built: boolean; complete: boolean;
};`;

const SEARCH_PREAMBLE = `Read-only look at the form with code: the body of an async function (an async arrow works too) over the frozen data declared below. Return or console.log only what you need — at most ${SEARCH_LIMIT} characters come back. It changes nothing: change the form with execute.`;

const SEARCH_EXAMPLE = 'return form.fields.filter(f => f.rules.length === 0).map(f => f.name)';

/** Определение `search` для `tools/list`. */
export function searchToolDefinition(): ToolDefinition {
  return {
    name: SEARCH_TOOL,
    description: `${SEARCH_PREAMBLE}\n\n${SEARCH_DECLARATION}`,
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: `JavaScript over form, task, api and plan, e.g. \`${SEARCH_EXAMPLE}\`.`,
        },
        dir: { type: 'string', description: 'Form folder (default "form").' },
      },
      required: ['code'],
    },
  };
}

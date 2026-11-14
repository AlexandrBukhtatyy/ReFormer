/**
 * Реестр правок `form_edit` — один источник для трёх представлений одного контракта:
 *
 * - плоская JSON Schema правки (`form_edit` в профиле guided): все ключи в одном объекте, без
 *   вложенности — так её разбирают малые модели в Ollama;
 * - однострочная сводка операций в описании `edits`;
 * - TS-объявление для Code Mode (`code-guided`): размеченное объединение по `op`, у каждой операции и
 *   каждого ключа — описание.
 *
 * Объявление появилось после замера на новом наборе сценариев (батч 20261114T113832Z-68e8): модель
 * видела один объект с 38 необязательными ключами и не знала, какие ключи у какой операции, а у
 * `rule`, `when`, `component`, `options` не было ни слова описания. Отсюда фраза в `rule`, ставшая
 * регуляркой, `component: "input"` и `options: ["textInput"]`.
 *
 * @module reformer-mcp/core/guided/edit-spec
 */

import { MODEL_BEHAVIOR_KINDS } from '../generate/operator-catalog.js';

export const EDIT_OPS = [
  'add_field',
  'set_field',
  'rename_field',
  'remove_field',
  'add_array',
  'add_item_field',
  'add_step',
  'rename_step',
  'remove_step',
  'place',
  'add_rule',
  'remove_rule',
  'add_behavior',
  'remove_behavior',
  'add_visibility',
  'set_form',
  'markup',
] as const;
export type EditOp = (typeof EDIT_OPS)[number];

interface KeySpec {
  /** Схема ключа в плоской JSON Schema — та же, что была до реестра. */
  readonly schema: Record<string, unknown>;
  /** Тип ключа в TS-объявлении. */
  readonly ts: string;
  /** Описание ключа в TS-объявлении. */
  readonly doc: string;
}

const STRING = { type: 'string' };

/** Ключи правки в порядке плоской схемы. */
const KEYS = {
  name: {
    schema: STRING,
    ts: 'string',
    doc: 'Key of the field: latin camelCase (`firstName`); a group path is allowed (`contact.email`).',
  },
  field: { schema: STRING, ts: 'string', doc: 'An existing field of the form (its key).' },
  label: {
    schema: STRING,
    ts: 'string',
    doc: 'The label: the words of the task, in its language.',
  },
  type: {
    schema: { type: 'string', enum: ['string', 'number', 'boolean', 'date'] },
    ts: '"string" | "number" | "boolean" | "date"',
    doc: '"string" by default; "number"; "boolean" — a checkbox or switch; "date".',
  },
  component: {
    schema: STRING,
    ts: 'string',
    doc: 'Leave it out: the server picks it by type. Override only: Textarea, RadioGroup, Switch, Slider, SelectMulti, InputPassword (a hidden password), DatePicker.',
  },
  options: {
    schema: { type: 'array', items: { type: ['string', 'number', 'object'] } },
    ts: 'Array<string | number | { value: string | number; label: string }>',
    doc: 'The choices the task lists, 2 or more. A length or a range is a check (minLength, min), not options.',
  },
  mask: {
    schema: STRING,
    ts: 'string',
    doc: 'An input format the task gives, 9 for a digit: "+7 (999) 999-99-99". No format in the task — no mask.',
  },
  placeholder: { schema: STRING, ts: 'string', doc: 'A hint inside the empty input.' },
  readonly: {
    schema: { type: 'boolean' },
    ts: 'boolean',
    doc: 'true — the form computes the value or only shows it.',
  },
  initialValue: {
    schema: {},
    ts: 'string | number | boolean',
    doc: 'The default value the task names (for a choice — its value).',
  },
  step: {
    schema: STRING,
    ts: 'string',
    doc: 'Title or number of the wizard step to put it in.',
  },
  array: {
    schema: STRING,
    ts: 'string',
    doc: 'An array of the form: the edit is about a column of its rows.',
  },
  minItems: { schema: { type: 'number' }, ts: 'number', doc: 'At least this many rows.' },
  maxItems: { schema: { type: 'number' }, ts: 'number', doc: 'At most this many rows.' },
  title: { schema: STRING, ts: 'string', doc: 'Title of the step: the words of the task.' },
  fields: {
    schema: { type: 'array', items: { type: 'string' } },
    ts: 'string[]',
    doc: 'Keys of the fields and arrays of the step, in order.',
  },
  required: { schema: { type: 'boolean' }, ts: 'boolean', doc: 'true — the value is required.' },
  email: { schema: { type: 'boolean' }, ts: 'boolean', doc: 'true — the value must be an email.' },
  min: {
    schema: { type: 'number' },
    ts: 'number',
    doc: 'The smallest number the task allows (for a text — its shortest length).',
  },
  max: {
    schema: { type: 'number' },
    ts: 'number',
    doc: 'The largest number the task allows (for a text — its longest length).',
  },
  minLength: {
    schema: { type: 'number' },
    ts: 'number',
    doc: 'The shortest text the task allows.',
  },
  maxLength: { schema: { type: 'number' }, ts: 'number', doc: 'The longest text the task allows.' },
  pattern: {
    schema: STRING,
    ts: 'string',
    doc: 'A regular expression the whole value must match, without slashes: "^[A-Za-z0-9_]+$".',
  },
  rule: {
    schema: STRING,
    ts: 'string',
    doc: 'Only a validator call: "minLength(2)", "pattern(/^\\\\d{6}$/)". A sentence is not a rule — its text goes to "message".',
  },
  cross: {
    schema: STRING,
    ts: 'string',
    doc: 'An expression over values.<field>, TRUE when the value is valid: "values.end >= values.start".',
  },
  equals: {
    schema: STRING,
    ts: 'string',
    doc: 'The key of the field this one must match (a repeated password).',
  },
  when: {
    schema: STRING,
    ts: 'string',
    doc: 'Only while this condition over model.<field> holds: "model.method === \'courier\'".',
  },
  message: { schema: STRING, ts: 'string', doc: 'The error text from the task, in its language.' },
  kind: {
    schema: { type: 'string', enum: [...MODEL_BEHAVIOR_KINDS] },
    ts: MODEL_BEHAVIOR_KINDS.map((kind) => JSON.stringify(kind)).join(' | '),
    doc: 'compute — a formula; enableWhen / disableWhen — the field is active only on a condition; resetWhen — cleared on a condition; the rest as named.',
  },
  target: { schema: STRING, ts: 'string', doc: 'The field the behavior changes.' },
  expr: {
    schema: STRING,
    ts: 'string',
    doc: 'JS over model.<field>: the formula of compute ("(model.price ?? 0) * (model.qty ?? 0)"), the condition of enableWhen, disableWhen, resetWhen.',
  },
  resetOnDisable: {
    schema: { type: 'boolean' },
    ts: 'boolean',
    doc: 'true — the value is cleared when the field gets disabled.',
  },
  showWhen: {
    schema: STRING,
    ts: 'string',
    doc: 'Show the field only while this condition over model.<field> holds.',
  },
  hideWhen: {
    schema: STRING,
    ts: 'string',
    doc: 'Hide the field while this condition over model.<field> holds.',
  },
  formName: { schema: STRING, ts: 'string', doc: 'Title of the form in the language of the task.' },
  to: { schema: STRING, ts: 'string', doc: 'The new key or title.' },
} as const satisfies Record<string, KeySpec>;

export type EditKey = keyof typeof KEYS;

/** Общие группы ключей: в объявлении — базовые интерфейсы, описанные один раз. */
const GROUPS = {
  FieldProps: [
    'type',
    'component',
    'options',
    'mask',
    'placeholder',
    'readonly',
    'initialValue',
  ] as const satisfies readonly EditKey[],
  Checks: [
    'required',
    'email',
    'min',
    'max',
    'minLength',
    'maxLength',
    'pattern',
    'message',
  ] as const satisfies readonly EditKey[],
} as const;
type Group = keyof typeof GROUPS;

const GROUP_DOCS: Record<Group, string> = {
  FieldProps: 'What the input is. Give only what the task says.',
  Checks: 'Checks of the task; a check written on a field becomes its rule.',
};

interface OpSpec {
  readonly op: EditOp;
  readonly doc: string;
  /** Строка сводки в описании `edits` плоской схемы. */
  readonly signature: string;
  readonly required?: readonly EditKey[];
  readonly optional?: readonly EditKey[];
  readonly groups?: readonly Group[];
  /** Описание ключа в этой операции, если оно другое, чем общее. */
  readonly docs?: Partial<Record<EditKey, string>>;
}

export const EDIT_SPECS: readonly OpSpec[] = [
  {
    op: 'add_field',
    doc: 'A new input of the task.',
    signature: 'add_field {name,label,type?,options?,mask?,placeholder?,readonly?,step?}',
    required: ['name', 'label'],
    optional: ['step'],
    groups: ['FieldProps', 'Checks'],
  },
  {
    op: 'set_field',
    doc: 'Change a field: only the keys you give change.',
    signature: 'set_field {name,…}',
    required: ['name'],
    optional: ['label', 'step'],
    groups: ['FieldProps', 'Checks'],
    docs: { name: 'An existing field (its key).' },
  },
  {
    op: 'rename_field',
    doc: 'Rename a field, a group or an array: the server rewrites its rules, behaviors, conditions and the layout.',
    signature: 'rename_field {name,to,label?}',
    required: ['name', 'to'],
    optional: ['label'],
    docs: {
      name: 'The key it has now.',
      to: 'The new key: latin camelCase.',
      label: 'A new label, if the task gives one.',
    },
  },
  {
    op: 'remove_field',
    doc: 'Remove a field or an array with its rules, behaviors and visibility.',
    signature: 'remove_field {name}',
    required: ['name'],
    docs: { name: 'The field or array to remove (its key).' },
  },
  {
    op: 'add_array',
    doc: 'Repeating rows the user adds; then add_item_field for each column of a row.',
    signature: 'add_array {name,label,minItems?,maxItems?}',
    required: ['name', 'label'],
    optional: ['minItems', 'maxItems', 'step'],
    docs: { name: 'Key of the array: one latin camelCase word.' },
  },
  {
    op: 'add_item_field',
    doc: 'A column of the rows of an array.',
    signature: 'add_item_field {array,name,label,type?}',
    required: ['array', 'name', 'label'],
    groups: ['FieldProps', 'Checks'],
    docs: { name: 'Key of the column: latin camelCase.' },
  },
  {
    op: 'add_step',
    doc: 'A wizard step with its fields, in order.',
    signature: 'add_step {title,fields}',
    required: ['title', 'fields'],
  },
  {
    op: 'rename_step',
    doc: 'Change the title of a wizard step.',
    signature: 'rename_step {title,to}',
    required: ['title', 'to'],
    docs: {
      title: 'The title it has now (or its number).',
      to: 'The new title: the words of the task.',
    },
  },
  {
    op: 'remove_step',
    doc: 'Remove a wizard step with every field, rule and behavior in it.',
    signature: 'remove_step {title}',
    required: ['title'],
    docs: { title: 'The title of the step (or its number).' },
  },
  {
    op: 'place',
    doc: 'Move a field or an array to a step.',
    signature: 'place {name,step}',
    required: ['name', 'step'],
    docs: { name: 'The field or array to move.' },
  },
  {
    op: 'add_rule',
    doc: 'Checks of a field: all checks of one field may go into one add_rule.',
    signature:
      'add_rule {field,array?,required?,email?,min?,max?,minLength?,maxLength?,pattern?,rule?,cross?,when?,message?}',
    required: ['field'],
    optional: ['array', 'rule', 'cross', 'equals', 'when'],
    groups: ['Checks'],
  },
  {
    op: 'remove_rule',
    doc: 'Remove checks of a field.',
    signature: 'remove_rule {field,rule?}',
    required: ['field'],
    optional: ['rule'],
    docs: {
      rule: 'The check to remove by its name ("minLength"); none — every check of the field.',
    },
  },
  {
    op: 'add_behavior',
    doc: 'A reaction: a computed value, a field active only on a condition, a value cleared on a condition…',
    signature: 'add_behavior {kind,target,expr,array?,when?,resetOnDisable?}',
    required: ['kind', 'target'],
    optional: ['expr', 'array', 'when', 'resetOnDisable'],
  },
  {
    op: 'remove_behavior',
    doc: 'Remove reactions of a field.',
    signature: 'remove_behavior {target,kind?}',
    required: ['target'],
    optional: ['kind'],
    docs: { kind: 'Which reaction to remove; none — every reaction of the field.' },
  },
  {
    op: 'add_visibility',
    doc: 'Show or hide a field on a condition: give showWhen or hideWhen.',
    signature: 'add_visibility {field,showWhen|hideWhen}',
    required: ['field'],
    optional: ['showWhen', 'hideWhen'],
  },
  {
    op: 'set_form',
    doc: 'The title of the form.',
    signature: 'set_form {formName}',
    required: ['formName'],
  },
  {
    op: 'markup',
    doc: 'core only: the server writes the JSX markup of index.tsx.',
    signature: 'markup (core: the server writes index.tsx)',
  },
];

/** Ключи одной правки (кроме `op`). */
export const EDIT_KEYS: ReadonlySet<string> = new Set(Object.keys(KEYS));

/** Схема одной правки для плоской JSON Schema `form_edit`. */
export function editItemSchema(): {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required: string[];
} {
  return {
    type: 'object',
    properties: {
      op: { type: 'string', enum: [...EDIT_OPS] },
      ...Object.fromEntries(
        Object.entries(KEYS).map(([key, spec]) => [key, spec.schema as Record<string, unknown>])
      ),
    },
    required: ['op'],
  };
}

/** Сводка операций одной строкой — описание `edits` плоской схемы. */
export function editSummary(): string {
  return EDIT_SPECS.map((spec) => spec.signature).join(' · ');
}

/** Ключи операции: свои и из групп. */
export function opKeys(spec: OpSpec): EditKey[] {
  return [
    ...(spec.required ?? []),
    ...(spec.optional ?? []),
    ...(spec.groups ?? []).flatMap((group) => GROUPS[group]),
  ];
}

const pascal = (op: string): string =>
  op.replace(/(^|_)([a-z])/g, (_match, _sep: string, char: string) => char.toUpperCase());

const doc = (text: string, indent: string): string => `${indent}/** ${text} */\n`;

function member(key: EditKey, optional: boolean, indent: string, override?: string): string {
  const spec = KEYS[key];
  return `${doc(override ?? spec.doc, indent)}${indent}${key}${optional ? '?' : ''}: ${spec.ts};\n`;
}

/**
 * TS-объявление правок для Code Mode: группы ключей, интерфейс на каждую операцию и `type Edit`.
 * Ключи группы, которые операция описывает по-своему, переопределены в её интерфейсе.
 */
export function editDeclaration(): string {
  const groups = (Object.keys(GROUPS) as Group[])
    .map(
      (group) =>
        `${doc(GROUP_DOCS[group], '')}interface ${group} {\n${GROUPS[group]
          .map((key) => member(key, true, '  '))
          .join('')}}\n`
    )
    .join('\n');
  const ops = EDIT_SPECS.map((spec) => {
    const extend =
      spec.groups && spec.groups.length > 0 ? ` extends ${spec.groups.join(', ')}` : '';
    const own = [
      `  op: ${JSON.stringify(spec.op)};\n`,
      ...(spec.required ?? []).map((key) => member(key, false, '  ', spec.docs?.[key])),
      ...(spec.optional ?? []).map((key) => member(key, true, '  ', spec.docs?.[key])),
    ].join('');
    return `${doc(`${spec.op} — ${spec.doc}`, '')}interface ${pascal(spec.op)}${extend} {\n${own}}\n`;
  }).join('\n');
  const union = EDIT_SPECS.map((spec) => pascal(spec.op)).join(' | ');
  return `${groups}\n${ops}\n/** One edit of the form: "op" says which. */\ntype Edit = ${union};\n`;
}

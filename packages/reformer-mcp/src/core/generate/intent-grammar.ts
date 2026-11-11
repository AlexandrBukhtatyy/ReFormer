/**
 * Грамматика `form.intent.json`: её отдаёт `form_build` — по запросу `grammar` и пока файла нет.
 *
 * Примеры строк берутся из {@link GRAMMAR_EXAMPLE}, а тест собирает этот intent настоящей сборкой.
 * Текст-образец без такой проверки уже подводил: пример `copyFrom` на группу выглядел правдоподобно,
 * и агенты споткнулись о него в каждом прогоне прототипа.
 *
 * Компоненты и правила грамматика называет по справочникам ({@link FormCatalogs}): поля — из
 * каталога установленного кита, правила — из индекса установленного ядра. Чего не нашлось, о том
 * грамматика говорит прямо, а не подставляет список, которого у потребителя нет.
 *
 * ## База и секции
 *
 * Грамматика целиком не помещалась в контекст малых локальных моделей (аудит 2026-11, A5/A7), а
 * простой форме нужна лишь её часть. Поэтому она делится: база — поля, раскладка, валидация и
 * поведение простой формы, не длиннее {@link GRAMMAR_BASE_LIMIT}; остальное — секции по запросу
 * (`form_build {grammar: "arrays"}`), и база их перечисляет. Текст английский: это язык модели, а
 * тексты самой формы (подписи, сообщения) остаются на языке задания.
 *
 * @module reformer-mcp/core/generate/intent-grammar
 */

import type { FormCatalogs } from './catalogs.js';
import { renderRuleList } from './core-operators.js';
import { operatorsWithoutIntentKey } from './operator-catalog.js';

/** Рабочая форма, на которой показана вся грамматика. */
export const GRAMMAR_EXAMPLE = {
  formName: 'Loan application',
  interfaceName: 'LoanApplication',
  target: 'renderer-react',
  fields: [
    {
      name: 'loanType',
      type: 'string',
      component: 'Select',
      label: 'Loan type',
      initialValue: 'consumer',
      optionsSource: 'LOAN_TYPES',
    },
    {
      name: 'price',
      type: 'number',
      component: 'InputNumber',
      label: 'Price',
      initialValue: null,
      componentProps: { placeholder: 'Enter the price', min: 1 },
    },
    {
      name: 'quantity',
      type: 'number',
      component: 'InputNumber',
      label: 'Quantity',
      initialValue: 1,
    },
    { name: 'total', type: 'number', component: 'InputNumber', label: 'Total', initialValue: 0 },
    { name: 'vat', type: 'number', component: 'InputNumber', label: 'VAT', initialValue: 0 },
    {
      name: 'propertyValue',
      type: 'number',
      component: 'InputNumber',
      label: 'Property value',
      initialValue: null,
    },
    {
      name: 'password',
      type: 'string',
      component: 'InputPassword',
      label: 'Password',
      initialValue: '',
    },
    {
      name: 'confirm',
      type: 'string',
      component: 'InputPassword',
      label: 'Repeat password',
      initialValue: '',
    },
    { name: 'smsCode', type: 'string', component: 'Input', label: 'SMS code', initialValue: '' },
    {
      name: 'birthDate',
      type: 'date',
      component: 'Input',
      label: 'Birth date',
      initialValue: '',
      componentProps: { type: 'date' },
    },
    {
      name: 'phone',
      type: 'string',
      component: 'InputMask',
      label: 'Phone',
      initialValue: '',
      componentProps: { mask: '+7 (999) 999-99-99' },
    },
    {
      name: 'postalCode',
      type: 'string',
      component: 'Input',
      label: 'Postal code',
      initialValue: '',
    },
    {
      name: 'sameAddress',
      type: 'boolean',
      component: 'Checkbox',
      label: 'Same as registration',
      initialValue: false,
    },
    {
      name: 'registrationAddress.city',
      type: 'string',
      component: 'Input',
      label: 'City',
      initialValue: '',
    },
    {
      name: 'residenceAddress.city',
      type: 'string',
      component: 'Input',
      label: 'City',
      initialValue: '',
    },
    {
      name: 'hasContacts',
      type: 'boolean',
      component: 'Checkbox',
      label: 'Has contacts',
      initialValue: false,
    },
    {
      name: 'income',
      type: 'number',
      component: 'InputNumber',
      label: 'Total income',
      initialValue: 0,
    },
    { name: 'email', type: 'string', component: 'Input', label: 'Email', initialValue: '' },
    { name: 'login', type: 'string', component: 'Input', label: 'Login', initialValue: '' },
  ],
  arrays: [
    {
      name: 'contacts',
      itemInterfaceName: 'Contact',
      initialValue: [],
      component: 'FieldArray',
      componentProps: { title: 'Contacts', addButtonLabel: '+ Add', itemLabel: 'Contact' },
      itemFields: [
        { name: 'phone', type: 'string', component: 'Input', label: 'Phone', initialValue: '' },
        {
          name: 'income',
          type: 'number',
          component: 'InputNumber',
          label: 'Income',
          initialValue: 0,
        },
        {
          name: 'primary',
          type: 'boolean',
          component: 'Checkbox',
          label: 'Primary',
          initialValue: false,
        },
      ],
    },
  ],
  parts: {
    address: { kind: 'container', component: 'Box', children: ['city'] },
  },
  layoutRoot: {
    kind: 'container',
    component: 'FormWizard',
    selector: 'wizard',
    componentProps: { submitLabel: 'Send' },
    children: [
      {
        kind: 'step',
        title: 'Loan',
        selector: 'loan',
        children: [
          'loanType',
          'price',
          'quantity',
          'total',
          'vat',
          {
            kind: 'container',
            component: 'Section',
            selector: 'mortgage-section',
            componentProps: { title: 'Mortgage' },
            children: ['propertyValue'],
          },
        ],
      },
      {
        kind: 'step',
        title: 'Applicant',
        selector: 'person',
        children: [
          'password',
          'confirm',
          'smsCode',
          'birthDate',
          'phone',
          'postalCode',
          'sameAddress',
          { kind: 'part', ref: 'registrationAddress', part: 'address' },
          { kind: 'part', ref: 'residenceAddress', part: 'address' },
          'hasContacts',
          'income',
          'email',
          'login',
          { kind: 'array', ref: 'contacts' },
        ],
      },
    ],
  },
  validation: [
    {
      target: 'price',
      rules: ["required({ code: 'price.required' })"],
      message: 'Enter the price',
    },
    {
      target: 'price',
      rules: ["min(1, { code: 'price.min' })"],
      message: 'The price is at least 1',
    },
    {
      target: 'propertyValue',
      when: "model.loanType === 'mortgage'",
      rules: ["required({ code: 'propertyValue.required' })"],
      message: 'Enter the property value',
    },
    {
      target: 'phone',
      each: 'contacts',
      rules: ["required({ code: 'contact.phone.required' })"],
      message: 'Enter the phone',
    },
    {
      target: 'confirm',
      cross: 'values.confirm === values.password',
      code: 'mismatch',
      message: 'Passwords do not match',
    },
    {
      target: 'smsCode',
      async: "async (value) => (value === '1' ? null : { code: 'bad' })",
      code: 'bad',
      message: 'Wrong code',
    },
    {
      target: 'income',
      each: 'contacts',
      cross: '(values.income ?? 0) >= 0',
      code: 'contact.income.negative',
      message: 'Income cannot be negative',
    },
    {
      target: 'postalCode',
      rules: ["postalCodeRu({ code: 'postalCode.format' })"],
      message: 'A postal code is 6 digits',
    },
    {
      target: 'phone',
      call: 'phoneOrEmail(model.$.phone, model.$.email)',
      code: 'contact.missing',
      message: 'Enter a phone or an email',
    },
  ],
  behavior: [
    {
      kind: 'compute',
      target: 'total',
      sources: ['price', 'quantity'],
      expr: '(model.price ?? 0) * (model.quantity ?? 0)',
    },
    {
      kind: 'enableWhen',
      target: 'propertyValue',
      sources: ['loanType'],
      expr: "model.loanType === 'mortgage'",
      options: { resetOnDisable: true },
    },
    {
      kind: 'onChange',
      target: 'hasContacts',
      expr: 'if (!value) model.contacts.clear();',
    },
    {
      kind: 'transformValue',
      target: 'postalCode',
      expr: "(value ?? '').replace(/\\D/g, '').slice(0, 6)",
    },
    {
      kind: 'copyFrom',
      target: 'residenceAddress.city',
      sources: ['registrationAddress.city'],
      expr: 'model.sameAddress === true',
    },
    {
      kind: 'compute',
      target: 'income',
      sources: ['contacts', 'contacts.income'],
      expr: 'model.contacts.map((row) => row.income).reduce((sum, income) => sum + (income || 0), 0)',
    },
    {
      kind: 'disableWhen',
      target: 'residenceAddress',
      sources: ['sameAddress'],
      expr: 'model.sameAddress === true',
    },
    { kind: 'computeFrom', target: 'vat', sources: ['total'], expr: 'Math.round(total * 0.2)' },
    { kind: 'syncFields', target: 'login', sources: ['email'] },
    {
      kind: 'resetWhen',
      target: 'smsCode',
      sources: ['phone'],
      expr: '!model.phone',
      options: { resetValue: '' },
    },
    {
      kind: 'revalidateWhen',
      target: 'confirm',
      sources: ['password'],
      expr: 'form.confirm.markAsTouched()',
    },
    { kind: 'exclusiveFlag', target: 'primary', each: 'contacts' },
    {
      kind: 'aggregateInto',
      target: 'contacts',
      expr: 'rows.some((row) => row.primary) ? [] : [{ index: 0, patch: { primary: true } }]',
    },
    { kind: 'call', target: 'price', expr: 'roundTo(model.$.price, 100)' },
    {
      kind: 'onComponentEvent',
      selector: 'wizard',
      event: 'onSubmit',
      expr: 'await submitApplication(model.get())',
    },
    {
      kind: 'renderEffect',
      expr: "schema.node('mortgage-section').getRef<HTMLElement>().current?.focus();",
    },
    {
      kind: 'onInit',
      selector: 'mortgage-section',
      expr: "schema.node('mortgage-section').patchProps({ title: 'Mortgage loan' })",
    },
    {
      kind: 'onMount',
      selector: 'wizard',
      expr: 'const t = setInterval(() => saveDraft(model.get()), 30000); return () => clearInterval(t);',
    },
    { kind: 'onUnmount', selector: 'wizard', expr: 'saveDraft(model.get())' },
  ],
  operators: {
    postalCodeRu: './operators',
    phoneOrEmail: './operators',
    roundTo: './operators',
    saveDraft: './operators',
    submitApplication: './api',
  },
  visibility: [{ selector: 'mortgage-section', condition: "model.loanType !== 'mortgage'" }],
  dataSources: [
    {
      name: 'LOAN_TYPES',
      values: [
        { value: 'consumer', label: 'Consumer' },
        { value: 'mortgage', label: 'Mortgage' },
      ],
    },
  ],
};

const json = (value: unknown): string => JSON.stringify(value);
const { fields, arrays, validation, behavior } = GRAMMAR_EXAMPLE;

/**
 * Потолок базы в символах: её читает каждая модель, включая малые локальные. Сама база — около
 * 4000; запас нужен на рост каталога кита и индекса ядра, из которых она печатает списки.
 */
export const GRAMMAR_BASE_LIMIT = 4200;
/**
 * Потолок грамматики целиком (`grammar: "all"`). План задавал 8000, но ниже уже пришлось бы
 * убирать образцы записей, а целиком грамматику просят модели с большим контекстом: малые берут
 * секции по одной.
 */
export const GRAMMAR_ALL_LIMIT = 9500;

/** Секции грамматики, которые приходят по запросу. Порядок — порядок в `grammar: "all"`. */
export const GRAMMAR_SECTIONS = [
  'behavior',
  'arrays',
  'wizard',
  'cross',
  'async',
  'parts',
  'operators',
  'nodes',
] as const;

export type GrammarSection = (typeof GRAMMAR_SECTIONS)[number];

/** Что вернуть: базу, все секции сразу или выбранные секции. */
export type GrammarRequest = 'base' | 'all' | readonly GrammarSection[];

export interface IntentGrammarOptions {
  /** По умолчанию — база. У профиля `document` секций нет: его текст один. */
  readonly sections?: GrammarRequest;
  /**
   * Для кого грамматика: `module` (по умолчанию) — `form.intent.json`, из которого `form_build`
   * пишет модуль; `document` — intent документа формы (ассистент конструктора, `build_form`): без
   * таргета, разметки JSX, начальных значений и того, что живёт только в коде модуля (`./document`).
   */
  readonly profile?: 'module' | 'document';
}

/** Строка секции в перечне базы: что в ней. */
const SECTION_SUMMARY: Readonly<Record<GrammarSection, string>> = {
  behavior: 'more operators',
  arrays: 'rows',
  wizard: 'steps',
  cross: 'across fields',
  async: '',
  parts: 'sub-forms',
  operators: 'own code',
  nodes: 'submit, mount',
};

const isSection = (value: string): value is GrammarSection =>
  (GRAMMAR_SECTIONS as readonly string[]).includes(value);

/**
 * Запрос грамматики из аргумента инструмента: `true` и `"base"` — база, `"all"` — всё,
 * `"arrays"` или `"arrays,wizard"` — секции. Незнакомое имя — `null`: вызывающий отвечает отказом
 * со списком, а не молча отдаёт базу.
 */
export function readGrammarRequest(value: unknown): GrammarRequest | null {
  if (value === true) return 'base';
  if (typeof value !== 'string') return null;
  const names = value
    .split(/[\s,]+/)
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  if (names.length === 0 || (names.length === 1 && names[0] === 'base')) return 'base';
  if (names.length === 1 && names[0] === 'all') return 'all';
  return names.every(isSection) ? [...new Set(names)] : null;
}

/** Поле примера по имени: индекс сдвигается, когда в пример добавляют поле. */
const field = (name: string) => {
  const found = fields.find((f) => f.name === name);
  if (!found) throw new Error(`В GRAMMAR_EXAMPLE нет поля ${name}`);
  return found;
};

/** Запись `behavior` примера по её `kind` (у `compute` — первая). */
const behaviorRow = (kind: string, nth = 0): string =>
  json(behavior.filter((row) => row.kind === kind)[nth]);

const [loanStep, personStep] = GRAMMAR_EXAMPLE.layoutRoot.children;

/** Раскладка без шагов — контейнер с частью детей первого шага примера (поля и секция). */
const plainLayout = {
  kind: 'container',
  component: 'Box',
  children: [...loanStep.children.slice(0, 2), loanStep.children[loanStep.children.length - 1]],
};

/** Массив примера с двумя полями строки и без `component`: `FieldArray` — значение по умолчанию. */
const { component: _arrayComponent, ...arrayWithoutComponent } = arrays[0];
const arraySample = { ...arrayWithoutComponent, itemFields: arrays[0].itemFields.slice(0, 2) };

/** Визард примера с укороченными шагами: синтаксис тот же, строк меньше. */
const wizardLayout = {
  ...GRAMMAR_EXAMPLE.layoutRoot,
  children: [
    { ...loanStep, children: loanStep.children.slice(0, 2) },
    { ...personStep, children: [personStep.children[0], { kind: 'array', ref: 'contacts' }] },
  ],
};

/** Строка о компонентах полей: поля кита из его каталога. */
function componentLine({ uiKit }: FormCatalogs): string {
  return uiKit.found
    ? `- component: ${Object.keys(uiKit.fields).join(' ')}.`
    : '- component: the @reformer/ui-kit catalog was not found, use a name from your registry.';
}

/** Строка о правилах: фабрики ядра из его индекса. */
function rulesLine({ core }: FormCatalogs): string {
  const list = core.found
    ? renderRuleList(core)
    : 'the @reformer/core index was not found, rule names are not checked';
  return `- rules — @reformer/core/validators: ${list}; last argument { code: '…' }.`;
}

function base(catalogs: FormCatalogs): string {
  const more = GRAMMAR_SECTIONS.map((name) =>
    SECTION_SUMMARY[name] ? `${name} (${SECTION_SUMMARY[name]})` : name
  ).join(', ');
  const sources = GRAMMAR_EXAMPLE.dataSources[0];
  return `# form.intent.json — grammar

You write only this file; form_build compiles it and writes the module. The form is done when form_build answers ✓. Compact JSON, one record per line. Large form: fields + layoutRoot, then validation, then behavior, form_build after each.

{"formName":"<from the task>","interfaceName":"<TypeName>","target":"renderer-react","fields":[…],"arrays":[…],"layoutRoot":{…},"validation":[…],"behavior":[…],"visibility":[…],"dataSources":[…]}

Samples show syntax only: fields come from the task, texts keep its language.
target — the task's stack, keep it: core | renderer-react | renderer-json. On core you write the markup in index.tsx (<FormField control={bundle.form.price} /> from @reformer/ui-kit), then build again; visibility and node rules go to that JSX too. An unknown key is an error naming the nearest one.

## fields
${json(field('price'))}
- Group field: "address.city". type: string | number | boolean | date | array (files).
${componentLine(catalogs)}
- Choices: "optionsSource":"LOAN_TYPES" + a dataSources record, or componentProps.options:[{"value":"a","label":"A"}]; free-input hints: "suggestionsSource".
- Date string: "type":"date", Input, componentProps {"type":"date"}; DatePicker holds a Date. Mask: InputMask, componentProps ${json(field('phone').componentProps)}.

## layoutRoot — every field and array stands in it
${json(plainLayout)}
- A string child is a field ref; an array: {"kind":"array","ref":"contacts"}; selector names a node.

## validation — one row per rule, its text in message
${json(validation[0])}
${rulesLine(catalogs)}
- message covers every check of the row; a check with its own text needs its own row.
- Condition: "when":${json(validation[2].when)} in the row.

## behavior — kind: core operator, expr: TypeScript, sources: fields read
${behaviorRow('compute')}
${behaviorRow('enableWhen')} — disableWhen: inverse, also for a group.
${behaviorRow('copyFrom')} — expr: when to copy.
${behaviorRow('onChange')} — value: new value.
target, sources: leaf fields and arrays; compute must handle null (an empty number).

## visibility, dataSources
${json(GRAMMAR_EXAMPLE.visibility[0])} — the node is HIDDEN while true.
${json({ ...sources, values: sources.values.slice(0, 1) })}

## More: form_build {"grammar":"<section>"}
${more}, all.
`;
}

/** Секции по запросу: каждая — самостоятельный текст, без повтора базы. */
const SECTION_TEXT: Readonly<Record<GrammarSection, (catalogs: FormCatalogs) => string>> = {
  behavior: () => `## behavior — other model operators
${behaviorRow('computeFrom')} — expr parameters: sources by their last segment.
${behaviorRow('disableWhen')} — a whole group.
${behaviorRow('transformValue')}
${behaviorRow('syncFields')} — both ways.
${behaviorRow('resetWhen')} — without resetValue: null.
${behaviorRow('revalidateWhen')} — expr runs when sources change.
- compute and computeFrom recompute only while "when":"<condition>" holds; a compute target is read-only. A form node (errors, touched): form.<field>.
`,

  arrays: () => `## arrays — repeating rows
${json(arraySample)}
- In layoutRoot: {"kind":"array","ref":"contacts"}. Row rule: ${json(validation[3])}
- Row behavior: "each":"contacts", the row in expr is item. ${behaviorRow('exclusiveFlag')} — true in one row only.
${behaviorRow('aggregateInto')} — answer [{ index, patch }].
- A model array is NOT a plain array: length, at(i), map(fn), forEach(fn), toArray(), push(), removeAt(i), clear(); reduce or filter only after map(...) or toArray(). Sum:
${behaviorRow('compute', 1)}
`,

  wizard: () => `## wizard — steps
${json(wizardLayout)}
- Every child of FormWizard is a step; a step holds fields, arrays, containers; "icon":"💰".
- The step selector keys the step's validation (default step<N>). Shorthand: "steps":[{"title":"Loan","fields":["loanType","price"]}] instead of layoutRoot.
- Submit: section nodes. On core write the steps in index.tsx (find_recipe wizard).
`,

  cross: () => `## cross — across fields, the expression is TRUE when valid
${json(validation[4])}
- In a row: "each":"contacts", values is the row. "severity":"warning" does not block submit; "params":{"max":"values.income * 10"} fills {max} in message.
`,

  async: () => `## async — null when valid, else { code }
${json(validation[5])}
`,

  parts: () => `## parts — one sub-form layout for several groups
"parts":${json(GRAMMAR_EXAMPLE.parts)}, node {"kind":"part","ref":"registrationAddress","part":"address"}; refs in a part are relative to the group.
`,

  operators: ({ core }) => {
    const unkeyed = operatorsWithoutIntentKey(core.operatorNames);
    return `## operators — own code: name → module
${json(GRAMMAR_EXAMPLE.operators)}
- Own rule: "rules":${json(validation[7].rules)} — returns Rule<T> (@reformer/core/validation).
- Own validation operator instead of rules, printed as is: "call":${json(validation[8].call)}; with each, model is the row.
- Own behavior operator: ${behaviorRow('call')} — on @reformer/core/behaviors or effect + onDispose.
- "./operators" → operators.ts, "./api" → api.ts get a stub; write the bodies (Edit): then the file is yours, type-checked but not rewritten. A project module ("@/shared/x") is imported as is.
- revalidateWhen with your schema: void validateModel(model, schema), the schema in operators.${
      unkeyed.length > 0
        ? `\n- Core operators without an intent key: ${unkeyed.join(', ')} — call them with "kind":"call".`
        : ''
    }
`;
  },

  nodes: () => `## nodes — node events by selector, expr has schema; not printed on core
${behaviorRow('onComponentEvent')} — args: the event arguments; this wires submit.
${behaviorRow('renderEffect')} — the node ref: getRef().
${behaviorRow('onMount')} — may return a cleanup. Same shape: "kind":"onInit" (before the first render), "kind":"onUnmount".
`,
};

/** Поле примера без того, чего документ не держит: типа значения и начального значения. */
function documentField<F extends { type?: unknown; initialValue?: unknown }>(
  record: F
): Omit<F, 'type' | 'initialValue'> {
  const { type: _type, initialValue: _initial, ...rest } = record;
  return rest;
}

const [contacts] = arrays;

/**
 * Рабочая форма грамматики документа: то же, что у {@link GRAMMAR_EXAMPLE}, без шагов, частей,
 * своих операторов и хуков модуля. Строки грамматики берутся отсюда, а потребитель собирает этот
 * intent своей сборкой — ассистент конструктора проверяет так `build_form` на своём ките.
 */
export const DOCUMENT_GRAMMAR_EXAMPLE = {
  fields: [
    'loanType',
    'price',
    'quantity',
    'total',
    'propertyValue',
    'password',
    'confirm',
    'sameAddress',
    'registrationAddress.city',
    'residenceAddress.city',
    'hasContacts',
  ].map((name) => documentField(field(name))),
  arrays: [
    {
      name: contacts.name,
      componentProps: { title: contacts.componentProps.title },
      itemFields: contacts.itemFields.slice(0, 2).map(documentField),
    },
  ],
  layoutRoot: {
    kind: 'container',
    component: 'Box',
    children: [
      ...plainLayout.children.slice(0, 2),
      'quantity',
      'total',
      plainLayout.children[plainLayout.children.length - 1],
      'password',
      'confirm',
      'sameAddress',
      'registrationAddress.city',
      'residenceAddress.city',
      'hasContacts',
      { kind: 'array', ref: 'contacts' },
    ],
  },
  validation: [validation[0], validation[2], validation[3], validation[4]],
  behavior: ['compute', 'enableWhen', 'copyFrom', 'onChange'].map(
    (kind) => behavior.filter((row) => row.kind === kind)[0]
  ),
  visibility: GRAMMAR_EXAMPLE.visibility,
  dataSources: GRAMMAR_EXAMPLE.dataSources,
};

/**
 * Потолок грамматики документа в символах — не длиннее прежней грамматики `build_form`
 * ассистента конструктора (около 3500): её читает каждая модель, включая малые локальные.
 */
export const DOCUMENT_GRAMMAR_LIMIT = 3500;

/**
 * Правила документа — по именам: фабрики ядра из его индекса, а без индекса — самые ходовые.
 * Образцы аргументов, как в базе, грамматику документа удлинили бы вдвое против прежней.
 */
function documentRulesLine({ core }: FormCatalogs): string {
  const list = core.found
    ? [...core.rules.keys()].join(' ')
    : 'required email minLength(n) maxLength(n) min(n) max(n) pattern(/re/)';
  return `- rules: ${list}; last argument { code: '…' }.`;
}

function documentGrammar(catalogs: FormCatalogs): string {
  const example = DOCUMENT_GRAMMAR_EXAMPLE;
  const sources = GRAMMAR_EXAMPLE.dataSources[0];
  return `# intent — grammar

One object — a form, a step or a block. Compact JSON.
{"fields":[…],"arrays":[…],"layoutRoot":{…},"validation":[…],"behavior":[…],"visibility":[…],"dataSources":[…]}
Samples show syntax only: fields come from the task, texts keep its language. An unknown key is an error naming the nearest one.

## fields
${json(documentField(field('price')))}
- Group field: "address.city".
${componentLine(catalogs)}
- Choices: "optionsSource":"LOAN_TYPES" + a dataSources record. Mask: InputMask, componentProps ${json(field('phone').componentProps)}.

## layoutRoot — every field and array stands in it
${json(plainLayout)}
- A string child is a field ref; an array: {"kind":"array","ref":"contacts"}; selector names a node.
- Wizard: "steps":[{"title":"Loan","fields":["loanType","price"]},{"title":"Applicant","fields":["password"]}] instead of layoutRoot.

## arrays — repeating rows
${json(example.arrays[0])}
- Row rules and behavior: "each":"contacts", target is the row field, expr reads the row as item.

## validation — one row per rule, its text in message
${json(validation[0])}
${documentRulesLine(catalogs)}
- Condition: "when":${json(validation[2].when)}. Across fields, TRUE when valid: ${json(validation[4])}

## behavior — kind: core operator, expr: TypeScript, sources: fields read
${behaviorRow('compute')} — "when" recomputes only while true.
${behaviorRow('enableWhen')} — disableWhen: inverse.
Also copyFrom (expr: when to copy) onChange computeFrom syncFields resetWhen transformValue revalidateWhen; rows: exclusiveFlag aggregateInto. Handle null.

## visibility, dataSources, node events
${json(GRAMMAR_EXAMPLE.visibility[0])} — HIDDEN while true.
${json({ ...sources, values: sources.values.slice(0, 1) })}
- Node event, a behavior row: {"kind":"onComponentEvent","selector":"<node>","event":"onClick","expr":"…"}. Own operators, call and node hooks are module code: not in a document.
`;
}

/**
 * Грамматика intent для установленных кита и ядра.
 *
 * @param options.sections - `base` (по умолчанию) — база; `all` — база и все секции; список секций —
 *   только они, без повтора базы.
 * @param options.profile - `document` — грамматика документа формы: один текст, без секций.
 */
export function intentGrammar(catalogs: FormCatalogs, options: IntentGrammarOptions = {}): string {
  if (options.profile === 'document') return documentGrammar(catalogs);
  const request = options.sections ?? 'base';
  if (request === 'base') return base(catalogs);
  const sections = request === 'all' ? GRAMMAR_SECTIONS : request;
  const parts = sections.map((name) => SECTION_TEXT[name](catalogs));
  return (request === 'all' ? [base(catalogs), ...parts] : parts).join('\n');
}

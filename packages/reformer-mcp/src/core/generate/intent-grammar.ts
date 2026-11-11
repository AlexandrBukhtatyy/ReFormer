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
import { didYouMean, nameIgnoringCase, suggestComponents } from './component-names.js';
import { UI_KIT_PACKAGE } from './ui-kit-components.js';
import type { PropsSchema } from './ui-kit-props.js';
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
 * Потолок базы в символах: её читает каждая модель, включая малые локальные. Без раздела
 * `## components` база была около 4000 при потолке 4200; раздел (около 1100: все компоненты кита по
 * назначению — и для формы, и для страницы) поднял её до 5000 (ReFormer-11oe.15). Запас — на рост
 * каталога кита и индекса ядра, из которых она печатает списки.
 */
export const GRAMMAR_BASE_LIMIT = 5600;
/**
 * Потолок грамматики целиком (`grammar: "all"`). План задавал 8000, но ниже уже пришлось бы
 * убирать образцы записей, а целиком грамматику просят модели с большим контекстом: малые берут
 * секции по одной. Раздел `## components` в базе прибавил около 1100 (было 9500).
 */
export const GRAMMAR_ALL_LIMIT = 10600;

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

/** Часть запроса списком: секция или сама база (`"base,behavior"` — база и секция). */
export type GrammarPart = GrammarSection | 'base';

/**
 * Компоненты кита: пустой список — раздел `## components` (все компоненты по назначению), имена —
 * описание каждого: роль, импорт, части и пропсы из каталога.
 */
export interface ComponentsRequest {
  readonly components: readonly string[];
}

/**
 * Что вернуть: базу, все секции сразу, выбранные части (в списке база идёт первой, где бы её ни
 * назвали) или компоненты кита.
 */
export type GrammarRequest = 'base' | 'all' | readonly GrammarPart[] | ComponentsRequest;

const isComponentsRequest = (request: GrammarRequest): request is ComponentsRequest =>
  typeof request === 'object' && 'components' in request;

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
 * `"arrays"` или `"arrays,wizard"` — секции, `"base,behavior"` — база и секция. `all` в списке
 * покрывает остальное. Незнакомое имя — `null`: вызывающий отвечает отказом со списком, а не молча
 * отдаёт базу.
 *
 * Базу в списке модели просят сами: описание инструмента обещает «several comma-separated», и
 * отказ на `"base,behavior"` уводил sonnet в `"all"` — вдвое больше текста (ReFormer-11oe.13).
 */
export function readGrammarRequest(value: unknown): GrammarRequest | null {
  if (value === true) return 'base';
  if (typeof value !== 'string') return null;
  // `components` — перечень компонентов кита, `components:Card,Tabs` — их описания.
  const components = /^\s*components?\s*(?::(.*))?$/i.exec(value);
  if (components) {
    return { components: [...new Set((components[1] ?? '').split(/[\s,]+/).filter(Boolean))] };
  }
  const names = [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (!names.every((name) => name === 'base' || name === 'all' || isSection(name))) return null;
  if (names.includes('all')) return 'all';
  if (names.length === 0 || (names.length === 1 && names[0] === 'base')) return 'base';
  return names as GrammarPart[];
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

/** Строка о компонентах полей: ссылка на `## components`, а у хоста без групп — сами поля кита. */
function componentLine({ uiKit }: FormCatalogs): string {
  if (!uiKit.found) {
    return '- component: the @reformer/ui-kit catalog was not found, use a name from your registry.';
  }
  return uiKit.groups
    ? '- component: a field of ## components (inputs, choice).'
    : `- component: ${Object.keys(uiKit.fields).join(' ')}.`;
}

/**
 * Раздел `## components`: все компоненты кита верхнего уровня по назначению — для формы и для
 * страницы (заголовки, текст, таблицы, оверлеи). Раньше грамматика называла одни поля, и
 * контейнер не из примера (`Card`, `Tabs`) модель угадывала, а отказ `unknown-component` отсылал в
 * грамматику, где контейнеров не было (ReFormer-11oe.15). Части и пропсы — по запросу
 * (`form_build {"grammar":"components:Card"}`); у документа билдера запроса нет — только перечень.
 */
function componentsSection({ uiKit }: FormCatalogs, profile: 'module' | 'document'): string {
  if (!uiKit.found || !uiKit.groups) return '';
  const header =
    profile === 'module'
      ? '## components — @reformer/ui-kit by purpose: inputs and choice are fields, the rest are layoutRoot containers; parts and props of any: form_build {"grammar":"components:Card,Tabs"}'
      : '## components — the kit by purpose: inputs and choice are fields, the rest are layoutRoot containers';
  const rows = Object.entries(uiKit.groups).map(([group, names]) => {
    // Теги HTML каталог конструктора называет `$html(div)`, а intent пишет их ключом htmlTag.
    const tags = names.map((name) => /^\$html\((.+)\)$/.exec(name)?.[1]);
    return tags.every(Boolean)
      ? `${group} — a container {"htmlTag":"section"}: ${tags.join(' ')}`
      : `${group}: ${names.join(' ')}`;
  });
  return `${header}\n${rows.join('\n')}\n`;
}

/** Предел описаний за один запрос: столько компонентов модель и спросит за один шаг формы. */
const COMPONENT_DETAILS_LIMIT = 8;
/** Предел пропсов в описании: у таблиц и оверлеев их десятки, а модели нужны ходовые. */
const COMPONENT_PROPS_LIMIT = 40;
/** Описание пропа — не длиннее этого. */
const PROP_DESCRIPTION_CHARS = 140;

/** Пропсы, которых в intent не бывает: обработчики (код, а не JSON), слот и дети узла. */
const NOT_IN_INTENT = /^(on[A-Z].*|asChild|ref|children|key)$/;

/** Тип пропа из JSON Schema одной строкой: `string`, `"a" | "b"`, `number[]`. */
function propType(schema: PropsSchema): string {
  if (Array.isArray(schema.enum))
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  const variants = (schema.anyOf ?? schema.oneOf) as PropsSchema[] | undefined;
  if (Array.isArray(variants)) return [...new Set(variants.map(propType))].join(' | ');
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (type === 'array' && schema.items && typeof schema.items === 'object') {
    return `${propType(schema.items as PropsSchema)}[]`;
  }
  return typeof type === 'string' ? type : 'any';
}

function propDescription(schema: PropsSchema): string {
  if (typeof schema.description !== 'string') return '';
  // Целиком, а не до точки: «Доп. CSS-класс триггера.» обрывалось на сокращении.
  const flat = schema.description.replace(/\s+/g, ' ').trim();
  const clipped =
    flat.length > PROP_DESCRIPTION_CHARS ? `${flat.slice(0, PROP_DESCRIPTION_CHARS - 1)}…` : flat;
  return clipped ? ` — ${clipped}` : '';
}

/** Описание одного компонента кита из его каталога. */
function describeComponent(name: string, { uiKit, uiKitProps }: FormCatalogs): string {
  const exported = uiKit.exports[name] ?? name;
  const subpath = uiKit.subpaths[exported];
  const from = subpath ? `${UI_KIT_PACKAGE}/${subpath}` : UI_KIT_PACKAGE;
  const parent = Object.entries(uiKit.parts ?? {}).find(([, parts]) => parts.includes(name))?.[0];
  const group = Object.entries(uiKit.groups ?? {}).find(([, names]) => names.includes(name))?.[0];
  const role = name in uiKit.fields ? 'field' : parent ? `part of ${parent}` : 'container';
  const lines = [
    `## ${name} — ${role}${group ? `, ${group}` : ''}; import { ${exported} } from "${from}"`,
  ];
  // Части поля (`SelectItem`, …) рисует само поле: в раскладку их не ставят.
  const parts = name in uiKit.fields ? undefined : uiKit.parts?.[name];
  if (parts?.length) lines.push(`parts — containers inside it: ${parts.join(' ')}`);
  const schema = uiKitProps?.defaults[name];
  const properties = (schema?.properties ?? {}) as Record<string, PropsSchema>;
  const hidden = new Set(
    Array.isArray(schema?.['x-runtimeProps']) ? (schema['x-runtimeProps'] as string[]) : []
  );
  const props = Object.entries(properties).filter(
    ([key]) => !NOT_IN_INTENT.test(key) && !hidden.has(key)
  );
  if (props.length === 0) {
    lines.push(schema ? 'componentProps: none' : 'componentProps: the catalog has no props schema');
  } else {
    lines.push(
      name in uiKit.fields
        ? 'componentProps (label and required are keys of the field record):'
        : 'componentProps:'
    );
    for (const [key, prop] of props.slice(0, COMPONENT_PROPS_LIMIT)) {
      const fallback = prop.default === undefined ? '' : ` = ${JSON.stringify(prop.default)}`;
      lines.push(`- ${key}: ${propType(prop)}${fallback}${propDescription(prop)}`);
    }
    if (props.length > COMPONENT_PROPS_LIMIT) {
      lines.push(`- … ${props.length - COMPONENT_PROPS_LIMIT} more`);
    }
  }
  return lines.join('\n');
}

/**
 * Описания компонентов кита по именам: роль и группа, импорт, части составного и пропсы с типом,
 * значениями и описанием из каталога. Описания пропсов — данные кита, на его языке.
 */
function componentDetails(catalogs: FormCatalogs, names: readonly string[]): string {
  const { uiKit } = catalogs;
  if (!uiKit.found) {
    return 'The @reformer/ui-kit catalog was not found: there is nothing to describe.';
  }
  const known = Object.keys(uiKit.exports);
  const blocks = names.slice(0, COMPONENT_DETAILS_LIMIT).map((asked) => {
    const name = nameIgnoringCase(asked, known);
    if (name) return describeComponent(name, catalogs);
    // `TextField` или `выпадающий список` — синоним называет компонент кита, как в ошибке сборки.
    const hint = didYouMean(suggestComponents(asked, known));
    return (
      `## ${asked} — not in @reformer/ui-kit${hint ? `; ${hint}` : '.'} ` +
      'The list: form_build {"grammar":"components"}'
    );
  });
  if (names.length > COMPONENT_DETAILS_LIMIT) {
    blocks.push(
      `… ${names.length - COMPONENT_DETAILS_LIMIT} more: at most ${COMPONENT_DETAILS_LIMIT} per call.`
    );
  }
  return blocks.join('\n\n');
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

${componentsSection(catalogs, 'module')}
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
 * Потолок грамматики документа в символах: её читает каждая модель, включая малые локальные.
 * Прежде — не длиннее старой грамматики `build_form` (около 3500); раздел `## components` с
 * компонентами кита по назначению прибавил около 1100 (ReFormer-11oe.15).
 */
export const DOCUMENT_GRAMMAR_LIMIT = 4700;

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

${componentsSection(catalogs, 'document')}`;
}

const isSectionPart = (part: GrammarPart): part is GrammarSection => part !== 'base';

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
  if (isComponentsRequest(request)) {
    return request.components.length === 0
      ? componentsSection(catalogs, 'module') ||
          'The @reformer/ui-kit catalog was not found: use a name from your registry.'
      : componentDetails(catalogs, request.components);
  }
  const withBase = request === 'all' || request.includes('base');
  const sections = request === 'all' ? GRAMMAR_SECTIONS : request.filter(isSectionPart);
  const parts = sections.map((name) => SECTION_TEXT[name](catalogs));
  return (withBase ? [base(catalogs), ...parts] : parts).join('\n');
}

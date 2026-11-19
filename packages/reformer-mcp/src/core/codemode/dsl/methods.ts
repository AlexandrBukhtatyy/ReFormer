/**
 * Реестр методов конструктора форм профиля `code-guided-dsl` — один источник для объявления
 * `execute`, объекта `api` инструмента `search`, подсказок прелюдии («нет `.regex` — может,
 * `.pattern`?») и теста покрытия: каждая операция `form_edit` достижима хотя бы одним методом.
 *
 * Конструктор только записывает правки — те же объекты `{op, …}`, что принимает `form_edit`;
 * поведение методов — в прелюдии (`prelude.ts`).
 *
 * @module reformer-mcp/core/codemode/dsl/methods
 */

import type { EditOp } from '../../guided/edit-spec.js';

/** Чей это метод: глобального `reformer` или объекта конструктора. */
export type BuilderOn = 'reformer' | 'Form' | 'Field' | 'Rows' | 'Step';

export interface BuilderMethod {
  readonly on: BuilderOn;
  readonly name: string;
  /** Параметры TS-сигнатуры. */
  readonly params: string;
  readonly returns: string;
  /** Одна строка: что делает метод. */
  readonly doc: string;
  /** Пример вызова — для `api` инструмента `search`. */
  readonly example?: string;
  /** Операции `form_edit`, которые даёт метод. */
  readonly ops?: readonly EditOp[];
}

const FIELD = 'Field';

/** Методы конструктора в порядке объявления. */
export const BUILDER_METHODS: readonly BuilderMethod[] = [
  {
    on: 'reformer',
    name: 'form',
    params: 'args?: { dir?: string }',
    returns: 'Form',
    doc: 'The builder of the form in dir ("form" by default). Chains only record edits; save() applies them in ONE call and builds.',
    example: 'const f = reformer.form()',
  },

  {
    on: 'Form',
    name: 'add',
    params: 'name: string, label: string',
    returns: FIELD,
    doc: 'A new input of the task: its key (latin camelCase; a group path like contact.email is allowed) and the label in the words of the task.',
    example: 'f.add("email", "Email").required().email()',
    ops: ['add_field'],
  },
  {
    on: 'Form',
    name: 'field',
    params: 'name: string',
    returns: FIELD,
    doc: 'An existing field, group or array of the form — to change, rename or remove it.',
    example: 'f.field("phone").mask("+7 (999) 999-99-99")',
    ops: ['set_field'],
  },
  {
    on: 'Form',
    name: 'array',
    params: 'name: string, label?: string, rows?: { min?: number; max?: number; step?: string }',
    returns: 'Rows',
    doc: 'Repeating rows: with a label — a new array, then a column per value of a row; without — an existing array. The name of an array the form has, with a label or rows: its label and row bounds change.',
    example: 'f.array("items", "Товары", { min: 1 }).column("title", "Название").required()',
    ops: ['add_array'],
  },
  {
    on: 'Form',
    name: 'step',
    params: 'title: string',
    returns: 'Step',
    doc: 'A wizard step by its title (or number).',
    example: 'f.step("Контакты").fields("email", "phone")',
  },
  {
    on: 'Form',
    name: 'title',
    params: 'text: string',
    returns: 'Form',
    doc: 'The title of the form.',
    ops: ['set_form'],
  },
  {
    on: 'Form',
    name: 'submit',
    params: 'label: string, handler?: string',
    returns: 'Form',
    doc: 'The submit button with the label of the task (handler — the send function the task names). A button is not an input: never add() it.',
    example: 'f.submit("Зарегистрироваться")',
    ops: ['submit'],
  },
  {
    on: 'Form',
    name: 'markup',
    params: '',
    returns: 'Form',
    doc: 'core only: the server writes the JSX markup of index.tsx.',
    ops: ['markup'],
  },
  {
    on: 'Form',
    name: 'edit',
    params: 'edit: { op: string; [key: string]: unknown }',
    returns: 'Form',
    doc: 'A raw form_edit edit — only when a Next: line gives one.',
  },
  {
    on: 'Form',
    name: 'save',
    params: '',
    returns: 'Promise<string>',
    doc: 'Apply every recorded edit in ONE call and build. The answer: a line per chain (✓, or ✗ with the fix), the build, "Plan:", then "Next:" with code or "Done:". Unsaved edits are saved at the end of the script too.',
    example: 'console.log(await f.save())',
  },
  {
    on: 'Form',
    name: 'status',
    params: '',
    returns: 'Promise<string>',
    doc: 'The plan: stages, the last build, "Next:".',
  },
  {
    on: 'Form',
    name: 'confirm',
    params: 'stage: "validation" | "edit"',
    returns: 'Promise<string>',
    doc: 'The form was checked against the task: validation — every limit of the task has a rule; edit — every change is made.',
    example: 'console.log(await f.confirm("validation"))',
  },
  {
    on: 'Form',
    name: 'skip',
    params: 'stage: Stage',
    returns: 'Promise<string>',
    doc: 'Drop a stage the task does not need.',
  },
  {
    on: 'Form',
    name: 'addStage',
    params: 'stage: Stage',
    returns: 'Promise<string>',
    doc: 'Add a stage the task needs.',
  },
  {
    on: 'Form',
    name: 'build',
    params: '',
    returns: 'Promise<string>',
    doc: 'Build the module again from the current files — only when an answer asks to build.',
  },

  {
    on: 'Field',
    name: 'label',
    params: 'text: string',
    returns: FIELD,
    doc: 'A new label: the words of the task.',
    ops: ['set_field'],
  },
  {
    on: 'Field',
    name: 'type',
    params: 'type: "string" | "number" | "boolean" | "date"',
    returns: FIELD,
    doc: 'Text is the default; "number"; "boolean" — a checkbox or switch; "date".',
    example: 'f.add("age", "Возраст").type("number").min(18)',
  },
  {
    on: 'Field',
    name: 'options',
    params: 'choices: Array<string | number | { value: string | number; label: string }>',
    returns: FIELD,
    doc: 'The choices the task lists, 2 or more. A length or a range is a check, not options.',
    example:
      'f.add("method", "Доставка").options([{ value: "courier", label: "Курьер" }, { value: "pickup", label: "Самовывоз" }])',
  },
  {
    on: 'Field',
    name: 'mask',
    params: 'format: string',
    returns: FIELD,
    doc: 'An input format of the task, 9 for a digit: "+7 (999) 999-99-99". The check of the format comes with it.',
  },
  {
    on: 'Field',
    name: 'placeholder',
    params: 'text: string',
    returns: FIELD,
    doc: 'A hint inside the empty input.',
  },
  {
    on: 'Field',
    name: 'readonly',
    params: '',
    returns: FIELD,
    doc: 'The form computes the value or only shows it.',
  },
  {
    on: 'Field',
    name: 'initial',
    params: 'value: string | number | boolean',
    returns: FIELD,
    doc: 'The default value the task names (for a choice — its value).',
  },
  {
    on: 'Field',
    name: 'component',
    params: 'name: string',
    returns: FIELD,
    doc: "Only to override the server's choice by type: Textarea, RadioGroup, Switch, Slider, SelectMulti, InputPassword (a hidden password), DatePicker.",
  },
  {
    on: 'Field',
    name: 'toStep',
    params: 'step: string',
    returns: FIELD,
    doc: 'Put the field (or array) into this wizard step: its title or number.',
    ops: ['place'],
  },
  {
    on: 'Field',
    name: 'required',
    params: 'message?: string',
    returns: FIELD,
    doc: 'The value is required. A message closes a group of checks: it is the text of the checks before it.',
    example: 'f.add("login", "Логин").required().length(3, 20, "От 3 до 20 символов")',
    ops: ['add_rule'],
  },
  {
    on: 'Field',
    name: 'optional',
    params: '',
    returns: FIELD,
    doc: 'The task leaves the field optional: it stays without a rule.',
  },
  {
    on: 'Field',
    name: 'email',
    params: 'message?: string',
    returns: FIELD,
    doc: 'The value must be an email.',
  },
  {
    on: 'Field',
    name: 'min',
    params: 'n: number, message?: string',
    returns: FIELD,
    doc: 'The smallest number the task allows (for a text — its shortest length).',
  },
  {
    on: 'Field',
    name: 'max',
    params: 'n: number, message?: string',
    returns: FIELD,
    doc: 'The largest number the task allows (for a text — its longest length).',
  },
  {
    on: 'Field',
    name: 'minLength',
    params: 'n: number, message?: string',
    returns: FIELD,
    doc: 'The shortest text the task allows.',
  },
  {
    on: 'Field',
    name: 'maxLength',
    params: 'n: number, message?: string',
    returns: FIELD,
    doc: 'The longest text the task allows.',
  },
  {
    on: 'Field',
    name: 'length',
    params: 'min: number, max?: number, message?: string',
    returns: FIELD,
    doc: 'A text from min to max characters ("от 3 до 20 символов").',
  },
  {
    on: 'Field',
    name: 'pattern',
    params: 'regex: RegExp | string, message?: string',
    returns: FIELD,
    doc: 'A regular expression the value must match: /^[A-Za-z0-9_]+$/ — the whole value; /\\d/ — a digit anywhere.',
    example: 'f.field("login").pattern(/^[A-Za-z0-9_]+$/, "Латиница, цифры и _")',
  },
  {
    on: 'Field',
    name: 'digit',
    params: 'message?: string',
    returns: FIELD,
    doc: 'At least one digit in the value.',
    example: 'f.field("password").min(10).digit("Нужна хотя бы одна цифра")',
  },
  {
    on: 'Field',
    name: 'rule',
    params: 'call: string, message?: string',
    returns: FIELD,
    doc: 'A validator call of @reformer/core the builder has no method for: "integer()".',
  },
  {
    on: 'Field',
    name: 'sameAs',
    params: 'field: string, message?: string',
    returns: FIELD,
    doc: 'Must equal another field: a repeated password.',
    example:
      'f.add("confirmPassword", "Повтор пароля").required().sameAs("password", "Пароли не совпадают")',
  },
  {
    on: 'Field',
    name: 'check',
    params: 'test: Fn<Model>, message: string',
    returns: FIELD,
    doc: 'A check across fields over the values of the form, TRUE when valid.',
    example: 'f.field("endDate").check(v => v.endDate >= v.startDate, "Конец позже начала")',
  },
  {
    on: 'Field',
    name: 'warning',
    params: 'test: Fn<Model>, message: string',
    returns: FIELD,
    doc: 'A warning over the values of the form, TRUE when fine: it shows the message and does not block sending ("больше 100 000 — предупреждение").',
    example: 'f.field("total").warning(v => v.total <= 100000, "Крупный заказ: менеджер свяжется")',
  },
  {
    on: 'Field',
    name: 'future',
    params: 'message?: string',
    returns: FIELD,
    doc: 'A date after today ("не раньше завтрашнего дня").',
  },
  {
    on: 'Field',
    name: 'asyncCheck',
    params: 'test: Fn<any>, options: { delay?: number; message: string }',
    returns: FIELD,
    doc: 'A check that waits for a server or its stub — the condition only, over the value: the server waits delay ms itself.',
    example:
      'f.field("captcha").asyncCheck(v => String(v).toUpperCase() === "ABC123", { delay: 300, message: "Символы не совпадают" })',
  },
  {
    on: 'Field',
    name: 'when',
    params: 'condition: Fn<Model>',
    returns: FIELD,
    doc: 'The checks of this chain apply only while the condition holds.',
    example: 'f.field("address").required().when(m => m.method === "courier")',
  },
  {
    on: 'Field',
    name: 'showWhen',
    params: 'condition: Fn<Model>',
    returns: FIELD,
    doc: 'Show the field only while the condition holds.',
    example: 'f.field("company").showWhen(m => m.customerType === "company")',
    ops: ['add_visibility'],
  },
  {
    on: 'Field',
    name: 'hideWhen',
    params: 'condition: Fn<Model>',
    returns: FIELD,
    doc: 'Hide the field while the condition holds.',
  },
  {
    on: 'Field',
    name: 'enableWhen',
    params: 'condition: Fn<Model>, options?: { resetOnDisable?: boolean }',
    returns: FIELD,
    doc: 'The field is active only while the condition holds.',
    ops: ['add_behavior'],
  },
  {
    on: 'Field',
    name: 'disableWhen',
    params: 'condition: Fn<Model>, options?: { resetOnDisable?: boolean }',
    returns: FIELD,
    doc: 'The field is disabled while the condition holds.',
  },
  {
    on: 'Field',
    name: 'resetWhen',
    params: 'condition: Fn<Model>',
    returns: FIELD,
    doc: 'Clear the value when the condition holds.',
  },
  {
    on: 'Field',
    name: 'compute',
    params: 'formula: Fn<Model>',
    returns: FIELD,
    doc: 'A computed value over the form; in an array column — over its row.',
    example:
      'f.add("total", "Итого").type("number").readonly().compute(m => m.subtotal - m.discount)',
  },
  {
    on: 'Field',
    name: 'copyFrom',
    params: 'source: string, condition?: Fn<Model>',
    returns: FIELD,
    doc: 'Copy the value of another field or group, while the condition holds.',
    example: 'f.field("billingAddress").copyFrom("deliveryAddress", m => m.billingSame)',
  },
  {
    on: 'Field',
    name: 'transform',
    params: 'fn: Fn<any>',
    returns: FIELD,
    doc: 'Rewrite the value as it is typed, over the value: upper case, trimmed. Not .compute(): a field never computes from itself.',
    example: 'f.field("promoCode").transform(v => (v ?? "").toUpperCase())',
  },
  {
    on: 'Field',
    name: 'sync',
    params: 'field: string',
    returns: FIELD,
    doc: 'Keep this field equal to another one both ways; the user may still type here ("чек на тот же email").',
  },
  {
    on: 'Field',
    name: 'exclusive',
    params: 'options?: { first?: boolean }',
    returns: FIELD,
    doc: 'A yes/no column true in ONE row only ("основной", "ровно один"): ticking it clears it in the other rows; no row has it — the first row gets it ({ first: false } — no such fallback). No check is needed for it.',
    example: 'f.array("recipients").column("primary").exclusive()',
    ops: ['add_behavior'],
  },
  {
    on: 'Field',
    name: 'setOnChange',
    params: 'source: string, condition: Fn<Model>, value: string | number | boolean | null',
    returns: FIELD,
    doc: 'When the source field changes and the condition holds, set this field to the value ("смена на физлицо: оплата по счёту → картой").',
    example:
      'f.field("paymentMethod").setOnChange("customerType", m => m.customerType === "person" && m.paymentMethod === "invoice", "card")',
  },
  {
    on: 'Field',
    name: 'rename',
    params: 'to: string, label?: string',
    returns: FIELD,
    doc: 'A new key (and label): the server rewrites rules, conditions and the layout.',
    example: 'f.field("login").rename("username", "Имя пользователя")',
    ops: ['rename_field'],
  },
  {
    on: 'Field',
    name: 'remove',
    params: '',
    returns: FIELD,
    doc: 'Remove the field, group or array with its rules and reactions.',
    ops: ['remove_field'],
  },
  {
    on: 'Field',
    name: 'removeRule',
    params: 'name?: string',
    returns: FIELD,
    doc: 'Remove a check by its name ("minLength", "pattern"); none — every check of the field.',
    ops: ['remove_rule'],
  },
  {
    on: 'Field',
    name: 'removeBehavior',
    params: 'kind?: string',
    returns: FIELD,
    doc: 'Remove a reaction by its kind ("compute"); none — every reaction of the field.',
    ops: ['remove_behavior'],
  },

  {
    on: 'Rows',
    name: 'required',
    params: 'message?: string',
    returns: 'Rows',
    doc: 'At least one row — the message of the task when there is none.',
    example:
      'f.array("items").required("Добавьте хотя бы один товар").max(10, "Не больше 10 товаров")',
    ops: ['add_rule'],
  },
  {
    on: 'Rows',
    name: 'min',
    params: 'n: number, message?: string',
    returns: 'Rows',
    doc: 'At least n rows.',
  },
  {
    on: 'Rows',
    name: 'max',
    params: 'n: number, message?: string',
    returns: 'Rows',
    doc: 'At most n rows.',
  },
  {
    on: 'Rows',
    name: 'column',
    params: 'name: string, label?: string',
    returns: FIELD,
    doc: 'A value of each row: with a label — a new column; without — an existing one.',
    example:
      'f.array("items").column("lineTotal", "Сумма").type("number").readonly().compute(r => r.price * r.quantity)',
    ops: ['add_item_field'],
  },
  {
    on: 'Rows',
    name: 'startRows',
    params: 'rows: Array<Record<string, string | number | boolean | null>>',
    returns: 'Rows',
    doc: 'The rows the form starts with, when the task gives them values (after the columns): an object per row, a column left out keeps its default.',
    example: 'f.array("recipients").startRows([{ primary: true }])',
    ops: ['add_array'],
  },

  {
    on: 'Step',
    name: 'fields',
    params: '...names: string[]',
    returns: 'Step',
    doc: 'A new step with these fields and arrays, in order. In a form with sections, a section title turns every section into a step.',
    ops: ['add_step'],
  },
  {
    on: 'Step',
    name: 'after',
    params: 'step: string',
    returns: 'Step',
    doc: 'Put this step right after another step (its title or number) — a new step or one the form has.',
    example: 'f.step("Упаковка").fields("giftWrap", "giftMessage").after("Товары")',
  },
  {
    on: 'Step',
    name: 'before',
    params: 'step: string',
    returns: 'Step',
    doc: 'Put this step right before another step (its title or number).',
  },
  {
    on: 'Step',
    name: 'rename',
    params: 'to: string',
    returns: 'Step',
    doc: 'A new title of the step.',
    ops: ['rename_step'],
  },
  {
    on: 'Step',
    name: 'remove',
    params: '',
    returns: 'Step',
    doc: 'Remove the step with every field, rule and reaction in it.',
    ops: ['remove_step'],
  },
];

/** Имена методов объекта конструктора — для подсказки «может, `.pattern`?» в прелюдии. */
export function methodNames(on: BuilderOn): string[] {
  return BUILDER_METHODS.filter((method) => method.on === on).map((method) => method.name);
}

/** Сигнатура метода строкой: `add(name: string, label: string): Field`. */
export function signatureOf(method: BuilderMethod): string {
  return `${method.name}(${method.params}): ${method.returns}`;
}

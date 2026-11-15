/**
 * Ответы guided — кодом конструктора: `form_edit {"dir":"form","edits":[…]}` в строке `Next:` или в
 * готовой правке сверки становится блоком `const f = reformer.form() … console.log(await f.save())`,
 * `form_status {"confirm":…}` — `await reformer.form().confirm(…)`. Слой каталога инструментов, как
 * `asScriptCalls` у `code-guided`: `plan.ts` и `guided.ts` говорят на языке правок и не знают о
 * конструкторе.
 *
 * Правка, которую конструктор не выражает дословно (неизвестный ключ, вид поведения без метода),
 * печатается как `f.edit({…})`: напечатанный код обязан дать ту же правку.
 *
 * @module reformer-mcp/core/codemode/dsl/printer
 */

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const show = (value: unknown): string => JSON.stringify(value);

/** Заглушка примера: `<field>`, `<the formula of the task>`. */
const PLACEHOLDER = /<[^<>]*>/;

type Scope = 'model' | 'values' | 'value' | 'item';

/** Выражение правки → лямбда конструктора; заглушка остаётся строкой — её не исполнить. */
function lambda(expr: unknown, scope: Scope): string {
  if (typeof expr !== 'string' || PLACEHOLDER.test(expr)) return show(expr);
  switch (scope) {
    case 'model':
      return `m => ${expr.replace(/(?<![\w$.])model\./g, 'm.')}`;
    case 'values':
      return `v => ${expr.replace(/(?<![\w$.])values\./g, 'v.')}`;
    case 'item':
      return `r => ${expr.replace(/(?<![\w$.])item\./g, 'r.')}`;
    case 'value':
      return `value => ${expr}`;
  }
}

interface Call {
  readonly name: string;
  readonly args: string[];
}

const PROP_METHODS: ReadonlyArray<readonly [string, string]> = [
  ['label', 'label'],
  ['type', 'type'],
  ['options', 'options'],
  ['mask', 'mask'],
  ['placeholder', 'placeholder'],
  ['initialValue', 'initial'],
  ['component', 'component'],
];

/** Методы, которые принимают сообщение последним аргументом. */
const TAKES_MESSAGE = new Set([
  'required',
  'email',
  'min',
  'max',
  'minLength',
  'maxLength',
  'pattern',
  'digit',
  'rule',
  'sameAs',
  'check',
  'warning',
]);

/** Свойства поля: `.label(…)`, `.type(…)`, `.readonly()`, `.toStep(…)`. */
function propCalls(edit: Rec, used: Set<string>): Call[] {
  const calls: Call[] = [];
  for (const [key, method] of PROP_METHODS) {
    // Подпись нового поля — уже в `f.add(name, label)`.
    if (edit[key] === undefined || used.has(key)) continue;
    used.add(key);
    calls.push({ name: method, args: [show(edit[key])] });
  }
  if (edit.readonly === true) {
    used.add('readonly');
    calls.push({ name: 'readonly', args: [] });
  }
  if (edit.step !== undefined) {
    used.add('step');
    calls.push({ name: 'toStep', args: [show(edit.step)] });
  }
  return calls;
}

/** Проверки поля: флаги, числа, шаблон, вызов валидатора, совпадение, cross, async, when. */
function checkCalls(edit: Rec, used: Set<string>): Call[] {
  const calls: Call[] = [];
  if (edit.required === true) calls.push({ name: 'required', args: [] });
  if (edit.required === false) calls.push({ name: 'optional', args: [] });
  if (edit.required !== undefined) used.add('required');
  if (edit.email === true) {
    used.add('email');
    calls.push({ name: 'email', args: [] });
  }
  for (const key of ['min', 'max', 'minLength', 'maxLength']) {
    if (typeof edit[key] !== 'number') continue;
    used.add(key);
    calls.push({ name: key, args: [String(edit[key])] });
  }
  if (typeof edit.pattern === 'string') {
    used.add('pattern');
    calls.push(
      /^\/?\\d\/?$/.test(edit.pattern)
        ? { name: 'digit', args: [] }
        : { name: 'pattern', args: [show(edit.pattern)] }
    );
  }
  if (typeof edit.rule === 'string') {
    used.add('rule');
    calls.push({ name: 'rule', args: [show(edit.rule)] });
  }
  if (typeof edit.equals === 'string') {
    used.add('equals');
    calls.push({ name: 'sameAs', args: [show(edit.equals)] });
  }
  if (typeof edit.cross === 'string') {
    used.add('cross');
    const warning = edit.warning === true;
    if (warning) used.add('warning');
    calls.push({ name: warning ? 'warning' : 'check', args: [lambda(edit.cross, 'values')] });
  }
  if (typeof edit.message === 'string') {
    const last = calls[calls.length - 1];
    if (last && TAKES_MESSAGE.has(last.name)) {
      used.add('message');
      last.args.push(show(edit.message));
    }
  }
  if (typeof edit.async === 'string') {
    used.add('async');
    const options: string[] = [];
    if (typeof edit.delay === 'number') {
      used.add('delay');
      options.push(`delay: ${edit.delay}`);
    }
    if (typeof edit.message === 'string' && !used.has('message')) {
      used.add('message');
      options.push(`message: ${show(edit.message)}`);
    }
    calls.push({
      name: 'asyncCheck',
      args: [lambda(edit.async, 'value'), `{ ${options.join(', ')} }`],
    });
  }
  if (typeof edit.when === 'string') {
    used.add('when');
    calls.push({ name: 'when', args: [lambda(edit.when, 'model')] });
  }
  return calls;
}

const chain = (start: string, calls: readonly Call[]): string =>
  `${start}${calls.map((call) => `.${call.name}(${call.args.join(', ')})`).join('')}`;

/** Начало цепочки поля: обычное поле или колонка массива. */
const fieldStart = (name: unknown, array: unknown): string =>
  typeof array === 'string'
    ? `f.array(${show(array)}).column(${show(name)})`
    : `f.field(${show(name)})`;

/** Одна правка → одна строка кода конструктора (или `f.edit({…})`). */
export function printEdit(edit: unknown): string {
  if (!isRecord(edit) || typeof edit.op !== 'string') return `f.edit(${show(edit)})`;
  const used = new Set<string>(['op']);
  const printed = printKnown(edit, used);
  const exact = printed !== null && Object.keys(edit).every((key) => used.has(key));
  return exact ? printed : `f.edit(${show(edit)})`;
}

function printKnown(edit: Rec, used: Set<string>): string | null {
  const mark = (...keys: string[]): void => keys.forEach((key) => used.add(key));
  switch (edit.op) {
    case 'add_field':
      mark('name', 'label');
      return chain(`f.add(${show(edit.name)}, ${show(edit.label)})`, [
        ...propCalls(edit, used),
        ...checkCalls(edit, used),
      ]);
    case 'set_field':
      mark('name', 'array');
      return chain(fieldStart(edit.name, edit.array), [
        ...propCalls(edit, used),
        ...checkCalls(edit, used),
      ]);
    case 'rename_field':
      mark('name', 'to', 'label');
      return `f.field(${show(edit.name)}).rename(${show(edit.to)}${edit.label === undefined ? '' : `, ${show(edit.label)}`})`;
    case 'remove_field':
      mark('name');
      return `f.field(${show(edit.name)}).remove()`;
    case 'add_array': {
      mark('name', 'label', 'minItems', 'maxItems', 'step');
      const rows = [
        edit.minItems === undefined ? '' : `min: ${show(edit.minItems)}`,
        edit.maxItems === undefined ? '' : `max: ${show(edit.maxItems)}`,
        edit.step === undefined ? '' : `step: ${show(edit.step)}`,
      ].filter(Boolean);
      return `f.array(${show(edit.name)}, ${show(edit.label)}${rows.length > 0 ? `, { ${rows.join(', ')} }` : ''})`;
    }
    case 'add_item_field':
      mark('array', 'name', 'label');
      return chain(`f.array(${show(edit.array)}).column(${show(edit.name)}, ${show(edit.label)})`, [
        ...propCalls(edit, used),
        ...checkCalls(edit, used),
      ]);
    case 'add_step': {
      mark('title', 'fields', 'after', 'before');
      const fields = Array.isArray(edit.fields) ? edit.fields.map(show).join(', ') : '';
      const at =
        typeof edit.after === 'string'
          ? `.after(${show(edit.after)})`
          : typeof edit.before === 'string'
            ? `.before(${show(edit.before)})`
            : '';
      return `f.step(${show(edit.title)}).fields(${fields})${at}`;
    }
    case 'rename_step':
      mark('title', 'to');
      return `f.step(${show(edit.title)}).rename(${show(edit.to)})`;
    case 'remove_step':
      mark('title');
      return `f.step(${show(edit.title)}).remove()`;
    case 'place':
      mark('name', 'step');
      return `f.field(${show(edit.name)}).toStep(${show(edit.step)})`;
    case 'add_rule':
      mark('field', 'array');
      return chain(fieldStart(edit.field, edit.array), checkCalls(edit, used));
    case 'remove_rule':
      mark('field', 'rule');
      return `f.field(${show(edit.field)}).removeRule(${edit.rule === undefined ? '' : show(edit.rule)})`;
    case 'add_behavior':
      return printBehavior(edit, used);
    case 'remove_behavior':
      mark('target', 'kind');
      return `f.field(${show(edit.target)}).removeBehavior(${edit.kind === undefined ? '' : show(edit.kind)})`;
    case 'add_visibility':
      mark('field', 'showWhen', 'hideWhen');
      if (edit.showWhen !== undefined && edit.hideWhen === undefined)
        return `f.field(${show(edit.field)}).showWhen(${lambda(edit.showWhen, 'model')})`;
      if (edit.hideWhen !== undefined && edit.showWhen === undefined)
        return `f.field(${show(edit.field)}).hideWhen(${lambda(edit.hideWhen, 'model')})`;
      return null;
    case 'set_form':
      mark('formName');
      return `f.title(${show(edit.formName)})`;
    case 'submit':
      mark('label', 'handler');
      return `f.submit(${show(edit.label)}${edit.handler === undefined ? '' : `, ${show(edit.handler)}`})`;
    case 'markup':
      return 'f.markup()';
    default:
      return null;
  }
}

function printBehavior(edit: Rec, used: Set<string>): string | null {
  const mark = (...keys: string[]): void => keys.forEach((key) => used.add(key));
  mark('kind', 'target', 'array');
  const start = fieldStart(edit.target, edit.array);
  const scope: Scope = typeof edit.array === 'string' ? 'item' : 'model';
  switch (edit.kind) {
    case 'compute':
      mark('expr');
      return `${start}.compute(${lambda(edit.expr, scope)})`;
    case 'enableWhen':
    case 'disableWhen': {
      mark('expr', 'resetOnDisable');
      const options = edit.resetOnDisable === true ? ', { resetOnDisable: true }' : '';
      return `${start}.${edit.kind}(${lambda(edit.expr, scope)}${options})`;
    }
    case 'resetWhen':
      mark('expr');
      return `${start}.resetWhen(${lambda(edit.expr, scope)})`;
    case 'transformValue':
      mark('expr');
      return `${start}.transform(${lambda(edit.expr, 'value')})`;
    case 'syncFields': {
      const sources = Array.isArray(edit.sources) ? edit.sources : [];
      if (sources.length !== 1 || edit.expr !== undefined) return null;
      mark('sources');
      return `${start}.sync(${show(sources[0])})`;
    }
    case 'copyFrom': {
      const sources = Array.isArray(edit.sources) ? edit.sources : [];
      if (sources.length !== 1) return null;
      mark('expr', 'sources');
      const condition =
        edit.expr === undefined || edit.expr === 'true' ? '' : `, ${lambda(edit.expr, scope)}`;
      return `${start}.copyFrom(${show(sources[0])}${condition})`;
    }
    default:
      return null;
  }
}

const formArg = (dir: unknown): string =>
  typeof dir === 'string' && dir !== 'form' ? `{ dir: ${show(dir)} }` : '';

/** `form_edit {…}` → блок кода конструктора. */
function editBlock(args: Rec, declared: boolean): string {
  const edits = Array.isArray(args.edits) ? args.edits : [];
  if (edits.length === 0) return `console.log(await reformer.form(${formArg(args.dir)}).save())`;
  // Второй блок в том же ответе — тот же `f`: `reformer.form()` отдаёт один конструктор на каталог.
  return [
    ...(declared ? [] : [`const f = reformer.form(${formArg(args.dir)})`]),
    ...edits.map(printEdit),
    'console.log(await f.save())',
  ].join('\n');
}

/** `form_status {…}` → вызов конструктора. */
function statusCall(args: Rec): string {
  const form = `reformer.form(${formArg(args.dir)})`;
  if (typeof args.confirm === 'string')
    return `console.log(await ${form}.confirm(${show(args.confirm)}))`;
  if (typeof args.skip === 'string') return `console.log(await ${form}.skip(${show(args.skip)}))`;
  if (typeof args.add === 'string') return `console.log(await ${form}.addStage(${show(args.add)}))`;
  return `console.log(await ${form}.status())`;
}

/** Названия операций в пояснениях ответа — имена методов конструктора. */
const PROSE: ReadonlyArray<readonly [RegExp, string]> = [
  [/\badd_item_field\b/g, '.column()'],
  [/\badd_field\b/g, 'f.add()'],
  [/\bset_field\b/g, 'f.field()'],
  [/\brename_field\b/g, '.rename()'],
  [/\bremove_field\b/g, '.remove()'],
  [/\badd_array\b/g, 'f.array()'],
  [/\badd_step\b/g, 'f.step().fields()'],
  [/\brename_step\b/g, 'f.step().rename()'],
  [/\bremove_step\b/g, 'f.step().remove()'],
  [/\badd_rule\b/g, 'a check (.required(), .min(), .pattern()…)'],
  [/\bremove_rule\b/g, '.removeRule()'],
  [/\badd_behavior\b/g, 'a reaction (.compute(), .enableWhen()…)'],
  [/\bremove_behavior\b/g, '.removeBehavior()'],
  [/\badd_visibility\b/g, '.showWhen()'],
  [/\bset_form\b/g, 'f.title()'],
  [/\bform_edit\b(?!\s*\{)/g, 'execute'],
  [/\bform_status\b(?!\s*\{)/g, 'f.status()'],
  [/\bform_start\b(?!\s*\{)/g, 'reformer.formStart'],
];

/** Ключи правок в пояснениях — методы конструктора. */
const KEY_PROSE: ReadonlyArray<readonly [RegExp, string]> = [
  [/"readonly":\s*true/g, '.readonly()'],
  [/"required":\s*false/g, '.optional()'],
  [/"equals":\s*("[^"]*")/g, '.sameAs($1)'],
  [/"options"/g, '.options()'],
  [/"initialValue"/g, '.initial()'],
  [/"mask"/g, '.mask()'],
  [/"message"/g, 'the message argument'],
  [/"when"/g, '.when()'],
  [/"async"/g, '.asyncCheck()'],
  [/"delay"/g, 'its delay'],
  [/"cross"/g, '.check()'],
  [/"showWhen"/g, '.showWhen()'],
  [/"hideWhen"/g, '.hideWhen()'],
  [/"expr"/g, 'the arrow'],
  [/"step"/g, '.toStep()'],
];

/** Правка JSON внутри пояснения: `{"op":"submit","label":"<its text>"}`. */
const INLINE_EDIT = /\{"op":"[a-z_]+"(?:[^{}]|\{[^{}]*\})*\}/g;

/** Строка исхода правки или сборки — её разбирает стенд и `host.ts`, она не трогается. */
const KEEP = /^(?:- )?(?:✓|✗)|^form_edit: \d/;

/**
 * Переписать ответ guided кодом конструктора. `form_start {…}` остаётся — его переписывает
 * `asScriptCalls` (вызов `reformer.formStart` не меняется).
 */
export function asBuilderCalls(text: string): string {
  let declared = false;
  return text
    .split('\n')
    .map((line) => {
      const call = /\b(form_edit|form_status|form_build) (\{.*\})/.exec(line);
      if (call) {
        let args: unknown;
        try {
          args = JSON.parse(call[2]);
        } catch {
          return line;
        }
        if (!isRecord(args)) return line;
        const code =
          call[1] === 'form_edit'
            ? editBlock(args, declared)
            : call[1] === 'form_status'
              ? statusCall(args)
              : `console.log(await reformer.form(${formArg(args.dir)}).build())`;
        if (call[1] === 'form_edit' && Array.isArray(args.edits) && args.edits.length > 0)
          declared = true;
        const before = line.slice(0, call.index);
        const after = line.slice(call.index + call[0].length);
        return `${before}${code}${after}`;
      }
      if (KEEP.test(line) || /\breformer\.|\bconst f\b/.test(line)) return line;
      const inline = line.replace(INLINE_EDIT, (json) => {
        try {
          return printEdit(JSON.parse(json));
        } catch {
          return json;
        }
      });
      return [...KEY_PROSE, ...PROSE].reduce(
        (out, [pattern, replacement]) => out.replace(pattern, replacement),
        inline
      );
    })
    .join('\n');
}

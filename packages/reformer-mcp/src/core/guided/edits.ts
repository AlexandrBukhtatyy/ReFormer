/**
 * Плоские правки `form.intent.json` для профиля guided: модель шлёт мелкие операции, сервер их
 * проверяет и пишет intent сам.
 *
 * Зачем. Корпус записанных прогонов qwen3.5:4b (ReFormer-f2fs.1): из 39 первых записей intent судья
 * не принял ни одной. Модель пишет JSON Schema вместо intent, правила объектами, неверный JSON.
 * Ассистент конструктора на той же модели мелкими правками собирает 11 форм из 12. Здесь тот же
 * приём для intent:
 *
 * - **ключи плоские**: глубокая вложенность ломала разбор вызовов Ollama;
 * - **не просить того, что сервер знает сам** (OpenAI, function calling best practices): коды
 *   замечаний, источники поведения из выражения, компонент по типу, место поля в раскладке;
 * - **каждая правка проверяется отдельно**: отказ называет, что исправить, а остальные правки
 *   вызова применяются.
 *
 * Правки работают над файлом intent в его записанном виде, а не над `FormIntent`: файл остаётся
 * исходником, его читает и судит обычная сборка.
 *
 * @module reformer-mcp/core/guided/edits
 */

import { MODEL_BEHAVIOR_KINDS } from '../generate/operator-catalog.js';
import type { ReformerTargetStack } from '../generate/form-intent.js';
import type { UiKitComponents } from '../generate/ui-kit-components.js';

export const EDIT_OPS = [
  'add_field',
  'set_field',
  'remove_field',
  'add_array',
  'add_item_field',
  'add_step',
  'place',
  'add_rule',
  'add_behavior',
  'add_visibility',
  'set_form',
  'markup',
] as const;
export type EditOp = (typeof EDIT_OPS)[number];

const FIELD_TYPES = ['string', 'number', 'boolean', 'date'] as const;

/** Правила-флаги и правила-числа: `"required":true`, `"min":18` → `required()`, `min(18)`. */
const FLAG_RULES = ['required', 'email', 'phone', 'url', 'integer'] as const;
const NUMBER_RULES = ['min', 'max', 'minLength', 'maxLength'] as const;

export interface EditContext {
  readonly uiKit: UiKitComponents;
  /** Фабрики правил ядра; пусто — сверять не с чем. */
  readonly rules: ReadonlySet<string>;
  readonly target: ReformerTargetStack;
}

export interface EditOutcome {
  readonly index: number;
  readonly op: string;
  readonly ok: boolean;
  readonly message: string;
}

export interface AppliedEdits {
  readonly file: Record<string, unknown>;
  readonly outcomes: readonly EditOutcome[];
  /** Среди правок есть `markup`: разметку core пишет сервер. */
  readonly markup: boolean;
}

class EditError extends Error {}

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

function list(file: Rec, key: string): Rec[] {
  if (!Array.isArray(file[key])) file[key] = [];
  return file[key] as Rec[];
}

/** Ближайшее имя по расстоянию Левенштейна — для подсказки «did you mean». */
export function nearest(name: string, candidates: readonly string[]): string | null {
  const a = name.toLowerCase();
  // Вхождение сильнее расстояния: `TextInput` — это `Input`, хотя до него четыре правки.
  const contained = candidates
    .filter((candidate) => {
      const b = candidate.toLowerCase();
      return b.length >= 3 && (a.includes(b) || b.includes(a));
    })
    .sort((x, y) => y.length - x.length)[0];
  if (contained) return contained;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const b = candidate.toLowerCase();
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    const distance = row[b.length];
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best !== null && bestDistance <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}

const didYouMean = (name: string, candidates: readonly string[]): string => {
  const guess = nearest(name, candidates);
  return guess
    ? ` — did you mean \`${guess}\`?`
    : candidates.length
      ? ` Known: ${candidates.slice(0, 12).join(', ')}.`
      : '';
};

function text(edit: Rec, key: string, required = false): string | undefined {
  const value = edit[key];
  if (value === undefined || value === null || value === '') {
    if (required) throw new EditError(`"${key}" is required`);
    return undefined;
  }
  if (typeof value !== 'string') throw new EditError(`"${key}" is a string`);
  return value.trim();
}

function number(edit: Rec, key: string): number | undefined {
  const value = edit[key];
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new EditError(`"${key}" is a number`);
  return parsed;
}

function names(edit: Rec, key: string): string[] {
  const value = edit[key];
  if (value === undefined) return [];
  if (typeof value === 'string')
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new EditError(`"${key}" is a list of names`);
  }
  return value.map((item: string) => item.trim()).filter(Boolean);
}

// ---------- Поля и массивы ----------

const fieldsOf = (file: Rec): Rec[] => list(file, 'fields');
const arraysOf = (file: Rec): Rec[] => list(file, 'arrays');
const nameOf = (record: Rec): string => (typeof record.name === 'string' ? record.name : '');
const findField = (file: Rec, name: string): Rec | undefined =>
  fieldsOf(file).find((f) => nameOf(f) === name);
const findArray = (file: Rec, name: string): Rec | undefined =>
  arraysOf(file).find((a) => nameOf(a) === name);
const itemFieldsOf = (array: Rec): Rec[] => list(array, 'itemFields');

/** Все пути модели: поля, массивы и поля строк `массив.поле`. */
function modelPaths(file: Rec): string[] {
  return [
    ...fieldsOf(file).map(nameOf),
    ...arraysOf(file).flatMap((array) => [
      nameOf(array),
      ...itemFieldsOf(array).map((item) => `${nameOf(array)}.${nameOf(item)}`),
    ]),
  ].filter(Boolean);
}

function requireField(file: Rec, name: string): Rec {
  const field = findField(file, name);
  if (field) return field;
  if (findArray(file, name)) throw new EditError(`\`${name}\` is an array, not a field`);
  throw new EditError(`no field \`${name}\`${didYouMean(name, fieldsOf(file).map(nameOf))}`);
}

function requireArray(file: Rec, name: string): Rec {
  const array = findArray(file, name);
  if (array) return array;
  throw new EditError(`no array \`${name}\`${didYouMean(name, arraysOf(file).map(nameOf))}`);
}

function checkNewName(name: string, taken: readonly string[]): void {
  if (!PATH.test(name)) {
    throw new EditError(
      `name \`${name}\` is not an identifier — latin camelCase, a group as "address.city"`
    );
  }
  if (taken.includes(name)) throw new EditError(`\`${name}\` already exists — use set_field`);
}

/** Начальное значение по типу. */
function blankOf(type: string): unknown {
  switch (type) {
    case 'number':
      return null;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

/** Варианты выбора: строки или `{ value, label }`. */
function optionsOf(edit: Rec): Array<{ value: unknown; label: string }> | undefined {
  const value = edit.options;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0)
    throw new EditError('"options" is a non-empty list');
  return value.map((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return { value: option, label: String(option) };
    }
    if (isRecord(option) && option.value !== undefined) {
      return { value: option.value, label: String(option.label ?? option.value) };
    }
    throw new EditError('an option is a string or {"value":…,"label":…}');
  });
}

/**
 * Запись поля из правки: тип, компонент по типу, свойства компонента. `existing` — правка уже
 * записанного поля: незаданное в правке остаётся как было.
 */
function fieldRecord(edit: Rec, ctx: EditContext, existing?: Rec): Rec {
  const record: Rec = existing ? clone(existing) : {};
  const options = optionsOf(edit);
  const mask = text(edit, 'mask');
  const typeGiven = text(edit, 'type');
  const type = typeGiven ?? (typeof record.type === 'string' ? record.type : 'string');
  if (!(FIELD_TYPES as readonly string[]).includes(type)) {
    throw new EditError(
      `"type" is one of ${FIELD_TYPES.join(', ')}${didYouMean(type, FIELD_TYPES)}`
    );
  }
  record.type = type;

  const props: Rec = isRecord(record.componentProps) ? record.componentProps : {};
  const component =
    text(edit, 'component') ??
    (mask
      ? 'InputMask'
      : options
        ? 'Select'
        : typeGiven || record.component === undefined
          ? type === 'number'
            ? 'InputNumber'
            : type === 'boolean'
              ? 'Checkbox'
              : 'Input'
          : String(record.component));
  const fields = Object.keys(ctx.uiKit.fields);
  if (ctx.uiKit.found && !fields.includes(component)) {
    throw new EditError(
      `no field component \`${component}\` in @reformer/ui-kit${didYouMean(component, fields)}`
    );
  }
  record.component = component;

  if (type === 'date' && component === 'Input') props.type = 'date';
  if (options) props.options = options;
  if (mask) props.mask = mask;
  const placeholder = text(edit, 'placeholder');
  if (placeholder) props.placeholder = placeholder;
  if (edit.readonly === true || edit.readOnly === true) props.readOnly = true;
  if (isRecord(edit.props)) Object.assign(props, edit.props);
  if (Object.keys(props).length > 0) record.componentProps = props;
  else delete record.componentProps;

  const label = text(edit, 'label');
  if (label) record.label = label;
  if (edit.initialValue !== undefined) record.initialValue = edit.initialValue;
  else if (record.initialValue === undefined || typeGiven) record.initialValue = blankOf(type);
  return record;
}

// ---------- Раскладка ----------

type Layout = { kind: 'steps'; steps: Rec[] } | { kind: 'tree'; root: Rec };

/** Раскладка файла: сокращение `steps` либо дерево `layoutRoot` (создаётся пустым `Box`). */
function layoutOf(file: Rec): Layout {
  if (Array.isArray(file.steps) && file.steps.length > 0) {
    return { kind: 'steps', steps: file.steps as Rec[] };
  }
  if (!isRecord(file.layoutRoot)) {
    file.layoutRoot = { kind: 'container', component: 'Box', children: [] };
  }
  return { kind: 'tree', root: file.layoutRoot as Rec };
}

const childrenOf = (node: Rec): unknown[] => {
  if (!Array.isArray(node.children)) node.children = [];
  return node.children as unknown[];
};
const refOf = (child: unknown): string | null =>
  typeof child === 'string'
    ? child
    : isRecord(child) && typeof child.ref === 'string'
      ? child.ref
      : null;

/** Узлы шагов дерева по порядку. */
function stepNodes(node: unknown, out: Rec[] = []): Rec[] {
  if (!isRecord(node)) return out;
  if (node.kind === 'step') out.push(node);
  for (const child of Array.isArray(node.children) ? node.children : []) stepNodes(child, out);
  return out;
}

/** Убрать ссылку отовсюду: из шагов сокращения и из дерева. */
function unplace(file: Rec, ref: string): void {
  if (Array.isArray(file.steps)) {
    for (const step of file.steps as Rec[]) {
      if (Array.isArray(step.fields))
        step.fields = (step.fields as unknown[]).filter((f) => f !== ref);
    }
  }
  const prune = (node: unknown): void => {
    if (!isRecord(node) || !Array.isArray(node.children)) return;
    node.children = (node.children as unknown[]).filter((child) => refOf(child) !== ref);
    for (const child of node.children as unknown[]) prune(child);
  };
  prune(file.layoutRoot);
}

/** Шаг по ключу: номер с 1, заголовок или селектор; без ключа — последний. */
function findStep<T extends Rec>(steps: readonly T[], key: string | undefined): T {
  if (steps.length === 0) throw new EditError('the form has no steps yet — add_step first');
  if (key === undefined) return steps[steps.length - 1];
  const index = /^\d+$/.test(key) ? Number(key) - 1 : -1;
  const found =
    steps[index] ??
    steps.find(
      (step) =>
        String(step.title ?? '').toLowerCase() === key.toLowerCase() || step.selector === key
    );
  if (found) return found;
  const titles = steps.map((step) => String(step.title ?? ''));
  throw new EditError(`no step \`${key}\`${didYouMean(key, titles)}`);
}

/** Поставить поле или массив в раскладку: в шаг (если шаги есть) или в корень. */
function place(file: Rec, ref: string, isArray: boolean, step: string | undefined): string {
  const layout = layoutOf(file);
  unplace(file, ref);
  if (layout.kind === 'steps') {
    const target = findStep(layout.steps, step);
    if (Array.isArray(target.fields)) (target.fields as unknown[]).push(ref);
    else target.fields = [ref];
    return `step «${String(target.title)}»`;
  }
  const steps = stepNodes(layout.root);
  if (steps.length > 0) {
    const target = findStep(steps, step);
    childrenOf(target).push(isArray ? { kind: 'array', ref } : ref);
    return `step «${String(target.title)}»`;
  }
  if (step !== undefined) throw new EditError('the form has no steps yet — add_step first');
  childrenOf(layout.root).push(isArray ? { kind: 'array', ref } : ref);
  return 'the form';
}

// ---------- Правила ----------

/** Последний аргумент правила — `{ code }`: без кода текст замечания не попадает в словарь формы. */
function withCode(rule: string, code: string): string {
  if (/\bcode\s*:/.test(rule)) return rule;
  const call = /^(\w+)\s*\(([\s\S]*)\)\s*$/.exec(rule.trim());
  if (!call) return `${rule.trim()}({ code: '${code}' })`;
  const args = call[2].trim();
  return `${call[1]}(${args ? `${args}, ` : ''}{ code: '${code}' })`;
}

const ruleName = (rule: string): string => /^\s*(\w+)/.exec(rule)?.[1] ?? rule;

/** Проверки строки правила: флаги, числа, `pattern`, `rule`/`rules` строками. */
function checksOf(edit: Rec, ctx: EditContext): string[] {
  const checks: string[] = [];
  for (const flag of FLAG_RULES) if (edit[flag] === true) checks.push(`${flag}()`);
  for (const key of NUMBER_RULES) {
    const value = number(edit, key);
    if (value !== undefined) checks.push(`${key}(${value})`);
  }
  const pattern = text(edit, 'pattern');
  if (pattern) {
    const literal = /^\/.*\/[a-z]*$/.test(pattern) ? pattern : `/${pattern.replace(/\//g, '\\/')}/`;
    checks.push(`pattern(${literal})`);
  }
  const single = text(edit, 'rule');
  if (single) checks.push(single);
  checks.push(...names(edit, 'rules'));
  const unknown = checks.map(ruleName).filter((name) => ctx.rules.size > 0 && !ctx.rules.has(name));
  if (unknown.length > 0) {
    throw new EditError(
      `no validator \`${unknown[0]}\` in @reformer/core/validators${didYouMean(unknown[0], [...ctx.rules])}`
    );
  }
  return [...new Set(checks.map((check) => (/\(/.test(check) ? check : `${check}()`)))];
}

// ---------- Поведение ----------

/** Поля, которые читает выражение: `model.x.y` и, в строке массива, `item.x`. */
function sourcesOf(expr: string, paths: readonly string[], each: string | undefined): string[] {
  const found = new Set<string>();
  for (const match of expr.matchAll(/\bmodel\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g)) {
    const parts = match[1].split('.');
    for (let n = parts.length; n > 0; n--) {
      const path = parts.slice(0, n).join('.');
      if (paths.includes(path)) {
        found.add(path);
        break;
      }
    }
  }
  if (each) {
    for (const match of expr.matchAll(/\bitem\.([A-Za-z_$][\w$]*)/g)) {
      const path = `${each}.${match[1]}`;
      if (paths.includes(path)) found.add(path);
    }
  }
  return [...found];
}

// ---------- Операции ----------

function addField(file: Rec, edit: Rec, ctx: EditContext): string {
  const name = text(edit, 'name', true)!;
  checkNewName(name, modelPaths(file));
  fieldsOf(file).push({ name, ...fieldRecord(edit, ctx) });
  return `field \`${name}\` added to ${place(file, name, false, text(edit, 'step'))}`;
}

function setField(file: Rec, edit: Rec, ctx: EditContext): string {
  const name = text(edit, 'name', true)!;
  const arrayName = text(edit, 'array');
  if (arrayName) {
    const items = itemFieldsOf(requireArray(file, arrayName));
    const index = items.findIndex((item) => nameOf(item) === name);
    if (index < 0)
      throw new EditError(
        `no field \`${name}\` in rows of \`${arrayName}\`${didYouMean(name, items.map(nameOf))}`
      );
    items[index] = { name, ...fieldRecord(edit, ctx, items[index]) };
    return `row field \`${arrayName}.${name}\` changed`;
  }
  const fields = fieldsOf(file);
  const index = fields.indexOf(requireField(file, name));
  fields[index] = { ...fieldRecord(edit, ctx, fields[index]), name };
  const step = text(edit, 'step');
  return `field \`${name}\` changed${step ? `, moved to ${place(file, name, false, step)}` : ''}`;
}

function removeField(file: Rec, edit: Rec): string {
  const name = text(edit, 'name', true)!;
  const isArray = findArray(file, name) !== undefined;
  if (!isArray) requireField(file, name);
  file[isArray ? 'arrays' : 'fields'] = (isArray ? arraysOf(file) : fieldsOf(file)).filter(
    (record) => nameOf(record) !== name
  );
  unplace(file, name);
  const touches = (path: unknown): boolean =>
    typeof path === 'string' && (path === name || path.startsWith(`${name}.`));
  let dropped = 0;
  for (const key of ['validation', 'behavior', 'visibility']) {
    const before = list(file, key).length;
    file[key] = list(file, key).filter(
      (row) => !touches(row.target) && !touches(row.selector) && !touches(row.each)
    );
    dropped += before - list(file, key).length;
  }
  return `\`${name}\` removed${dropped ? `, with ${dropped} rules on it` : ''}`;
}

function addArray(file: Rec, edit: Rec): string {
  const name = text(edit, 'name', true)!;
  checkNewName(name, modelPaths(file));
  if (name.includes('.')) throw new EditError('an array name is one word, not a group path');
  const label = text(edit, 'label');
  const minItems = number(edit, 'minItems');
  const maxItems = number(edit, 'maxItems');
  const props: Rec = {};
  if (label) props.title = label;
  props.addButtonLabel = text(edit, 'addLabel') ?? (label ? `+ ${label}` : '+ Add');
  const itemLabel = text(edit, 'itemLabel');
  if (itemLabel) props.itemLabel = itemLabel;
  if (minItems !== undefined) props.minItems = minItems;
  if (maxItems !== undefined) props.maxItems = maxItems;
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  arraysOf(file).push({
    name,
    itemInterfaceName: `${pascal}Item`,
    // Строк не меньше минимума: пустой массив при minItems ≥ 1 — форма с ошибкой с порога.
    initialValue: Array.from({ length: Math.max(0, minItems ?? 0) }, () => ({})),
    componentProps: props,
    itemFields: [],
  });
  return `array \`${name}\` added to ${place(file, name, true, text(edit, 'step'))} — now add_item_field for its row`;
}

function addItemField(file: Rec, edit: Rec, ctx: EditContext): string {
  const arrayName = text(edit, 'array', true)!;
  const array = requireArray(file, arrayName);
  const name = text(edit, 'name', true)!;
  checkNewName(name, itemFieldsOf(array).map(nameOf));
  if (name.includes('.')) throw new EditError('a row field name is one word');
  const record: Rec = { name, ...fieldRecord(edit, ctx) };
  itemFieldsOf(array).push(record);
  // Строки начального значения получают ключ нового поля: иначе тип строки и модель разойдутся.
  if (Array.isArray(array.initialValue)) {
    for (const row of array.initialValue as unknown[]) {
      if (isRecord(row) && !(name in row)) row[name] = record.initialValue;
    }
  }
  return `row field \`${arrayName}.${name}\` added`;
}

function addStep(file: Rec, edit: Rec): string {
  const title = text(edit, 'title', true)!;
  const refs = names(edit, 'fields');
  const known = new Set([...fieldsOf(file).map(nameOf), ...arraysOf(file).map(nameOf)]);
  for (const ref of refs) {
    if (!known.has(ref))
      throw new EditError(`no field or array \`${ref}\`${didYouMean(ref, [...known])}`);
  }
  const isArray = (ref: string) => findArray(file, ref) !== undefined;
  const layout = layoutOf(file);
  if (layout.kind === 'tree' && stepNodes(layout.root).length > 0) {
    const wizard = (function find(node: unknown): Rec | null {
      if (!isRecord(node)) return null;
      if (
        Array.isArray(node.children) &&
        node.children.some((c) => isRecord(c) && c.kind === 'step')
      )
        return node;
      for (const child of Array.isArray(node.children) ? node.children : []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    })(layout.root)!;
    refs.forEach((ref) => unplace(file, ref));
    childrenOf(wizard).push({
      kind: 'step',
      title,
      children: refs.map((ref) => (isArray(ref) ? { kind: 'array', ref } : ref)),
    });
    return `step «${title}» added with ${refs.length} items`;
  }
  if (layout.kind === 'tree') {
    // Первый шаг: раскладка становится сокращением `steps`. Всё, что стояло в корне, уходит в этот
    // шаг — так ни одно поле не остаётся вне раскладки; следующие шаги забирают своё по именам.
    const rootRefs = childrenOf(layout.root).map(refOf);
    if (rootRefs.some((ref) => ref === null)) {
      throw new EditError(
        'the layout holds containers or texts — steps need a plain layout; remove them or edit layoutRoot by hand'
      );
    }
    delete file.layoutRoot;
    file.steps = [{ title, fields: [...new Set([...refs, ...(rootRefs as string[])])] }];
    return `step «${title}» added; the form now has steps`;
  }
  refs.forEach((ref) => unplace(file, ref));
  layout.steps.push({ title, fields: refs });
  return `step «${title}» added with ${refs.length} items`;
}

function placeOp(file: Rec, edit: Rec): string {
  const ref = text(edit, 'name') ?? text(edit, 'field', true)!;
  const isArray = findArray(file, ref) !== undefined;
  if (!isArray) requireField(file, ref);
  return `\`${ref}\` placed in ${place(file, ref, isArray, text(edit, 'step'))}`;
}

function addRule(file: Rec, edit: Rec, ctx: EditContext): string {
  const field = text(edit, 'field') ?? text(edit, 'target', true)!;
  const arrayName = text(edit, 'array') ?? text(edit, 'each');
  let path = field;
  if (arrayName) {
    const items = itemFieldsOf(requireArray(file, arrayName));
    const short = field.startsWith(`${arrayName}.`) ? field.slice(arrayName.length + 1) : field;
    if (!items.some((item) => nameOf(item) === short)) {
      throw new EditError(
        `no field \`${short}\` in rows of \`${arrayName}\`${didYouMean(short, items.map(nameOf))}`
      );
    }
    path = `${arrayName}.${short}`;
  } else if (!findArray(file, field)) {
    requireField(file, field);
  }
  const row: Rec = { target: path };
  if (arrayName) row.each = arrayName;
  const when = text(edit, 'when');
  if (when) row.when = when;
  const message = text(edit, 'message');
  const cross = text(edit, 'cross');
  if (cross) {
    row.cross = cross;
    row.code = text(edit, 'code') ?? `${path}.cross`;
    if (message) row.message = message;
    list(file, 'validation').push(row);
    return `cross rule on \`${path}\` added`;
  }
  const checks = checksOf(edit, ctx);
  if (checks.length === 0) {
    throw new EditError(
      'no check: "required":true, "email":true, "min":N, "max":N, "minLength":N, "maxLength":N, "pattern":"…", "rule":"…" or "cross":"…"'
    );
  }
  row.rules = message
    ? checks.map((check) => withCode(check, `${path}.${ruleName(check)}`))
    : checks;
  if (message) row.message = message;
  list(file, 'validation').push(row);
  return `rule on \`${path}\`: ${checks.map(ruleName).join(', ')}`;
}

function addBehavior(file: Rec, edit: Rec): string {
  const kind = text(edit, 'kind', true)!;
  if (!(MODEL_BEHAVIOR_KINDS as readonly string[]).includes(kind)) {
    throw new EditError(
      `"kind" is one of ${MODEL_BEHAVIOR_KINDS.join(', ')}${didYouMean(kind, MODEL_BEHAVIOR_KINDS)} — a field shown on a condition: add_visibility`
    );
  }
  const arrayName = text(edit, 'array') ?? text(edit, 'each');
  const paths = modelPaths(file);
  let target = text(edit, 'target') ?? text(edit, 'field', true)!;
  if (arrayName && !target.startsWith(`${arrayName}.`) && target !== arrayName)
    target = `${arrayName}.${target}`;
  if (!paths.includes(target))
    throw new EditError(`no field \`${target}\`${didYouMean(target, paths)}`);
  const expr = text(edit, 'expr');
  if (!expr && kind !== 'syncFields' && kind !== 'exclusiveFlag') {
    throw new EditError(
      `"expr" is required for ${kind} — TypeScript over model, e.g. "model.price * 2"`
    );
  }
  const given = names(edit, 'sources');
  const unknownSource = given.find((source) => !paths.includes(source));
  if (unknownSource)
    throw new EditError(
      `no field \`${unknownSource}\` in "sources"${didYouMean(unknownSource, paths)}`
    );
  const sources = (given.length > 0 ? given : sourcesOf(expr ?? '', paths, arrayName)).filter(
    (source) => !(source === target && kind === 'compute')
  );
  const row: Rec = { kind, target, sources };
  if (arrayName) row.each = arrayName;
  if (expr) row.expr = expr;
  const when = text(edit, 'when');
  if (when) row.when = when;
  if (edit.resetOnDisable === true) row.options = { resetOnDisable: true };
  list(file, 'behavior').push(row);
  return `${kind} on \`${target}\`${sources.length ? ` reading ${sources.join(', ')}` : ''}`;
}

function addVisibility(file: Rec, edit: Rec, ctx: EditContext): string {
  const field = text(edit, 'field') ?? text(edit, 'target', true)!;
  if (ctx.target === 'core') {
    throw new EditError(
      'on core visibility is drawn by your JSX — use add_behavior "kind":"enableWhen" (the field is active only on the condition)'
    );
  }
  if (!findArray(file, field)) requireField(file, field);
  const show = text(edit, 'showWhen');
  const hide = text(edit, 'hideWhen');
  if (Boolean(show) === Boolean(hide))
    throw new EditError('give exactly one of "showWhen" or "hideWhen"');
  list(file, 'visibility').push({ selector: field, condition: hide ?? `!(${show})` });
  return `\`${field}\` ${show ? `shown only when ${show}` : `hidden when ${hide}`}`;
}

function setForm(file: Rec, edit: Rec): string {
  const formName = text(edit, 'formName') ?? text(edit, 'name');
  if (!formName) throw new EditError('"formName" is required');
  file.formName = formName;
  return `form name — ${formName}`;
}

/**
 * Применить правки к файлу intent. Правка применяется к копии и принимается целиком или не
 * принимается вовсе; отказ одной не отменяет другие.
 */
export function applyEdits(
  source: Record<string, unknown>,
  edits: unknown,
  ctx: EditContext
): AppliedEdits {
  let file = clone(source);
  const outcomes: EditOutcome[] = [];
  let markup = false;
  const items = Array.isArray(edits) ? edits : [];
  items.forEach((edit, index) => {
    const op = isRecord(edit) && typeof edit.op === 'string' ? edit.op : '';
    try {
      if (!isRecord(edit)) throw new EditError('an edit is an object {"op":…}');
      if (!(EDIT_OPS as readonly string[]).includes(op)) {
        throw new EditError(
          `"op" is one of ${EDIT_OPS.join(', ')}${didYouMean(op || '?', EDIT_OPS)}`
        );
      }
      if (op === 'markup') {
        if (ctx.target !== 'core') {
          throw new EditError(
            `on ${ctx.target} the build writes index.tsx itself — no markup needed`
          );
        }
        markup = true;
        outcomes.push({ index, op, ok: true, message: 'markup: the server writes index.tsx' });
        return;
      }
      const next = clone(file);
      const message = (() => {
        switch (op as EditOp) {
          case 'add_field':
            return addField(next, edit, ctx);
          case 'set_field':
            return setField(next, edit, ctx);
          case 'remove_field':
            return removeField(next, edit);
          case 'add_array':
            return addArray(next, edit);
          case 'add_item_field':
            return addItemField(next, edit, ctx);
          case 'add_step':
            return addStep(next, edit);
          case 'place':
            return placeOp(next, edit);
          case 'add_rule':
            return addRule(next, edit, ctx);
          case 'add_behavior':
            return addBehavior(next, edit);
          case 'add_visibility':
            return addVisibility(next, edit, ctx);
          default:
            return setForm(next, edit);
        }
      })();
      file = next;
      outcomes.push({ index, op, ok: true, message });
    } catch (error) {
      if (!(error instanceof EditError)) throw error;
      outcomes.push({ index, op: op || '?', ok: false, message: error.message });
    }
  });
  return { file, outcomes, markup };
}

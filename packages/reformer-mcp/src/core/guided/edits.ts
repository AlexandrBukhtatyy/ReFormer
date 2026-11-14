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

import { EDIT_OPS, type EditOp } from './edit-spec.js';

export { EDIT_OPS, type EditOp };

const FIELD_TYPES = ['string', 'number', 'boolean', 'date'] as const;

/** Типы поля словами моделей: «choice», «int», «checkbox» — тип контракта (L3-delivery). */
const TYPE_SYNONYMS: Readonly<Record<string, (typeof FIELD_TYPES)[number]>> = {
  text: 'string',
  textarea: 'string',
  choice: 'string',
  select: 'string',
  enum: 'string',
  dropdown: 'string',
  radio: 'string',
  email: 'string',
  phone: 'string',
  tel: 'string',
  password: 'string',
  int: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  bool: 'boolean',
  checkbox: 'boolean',
  datetime: 'date',
};

/**
 * «Тип» только-для-чтения: модель писала `"type":"readonly"` для вычисляемого поля и крутила отказы
 * «type is one of …», меняя тип наугад (L3-refund, 20261113T210742Z-5a45). Это флаг, а не тип.
 */
const READONLY_TYPES: ReadonlySet<string> = new Set([
  'readonly',
  'read-only',
  'read_only',
  'computed',
  'calculated',
]);

function typeSynonym(type: string | undefined): string | undefined {
  if (type === undefined) return undefined;
  const lower = type.trim().toLowerCase();
  return TYPE_SYNONYMS[lower] ?? lower;
}

/** Правила-флаги и правила-числа: `"required":true`, `"min":18` → `required()`, `min(18)`. */
const FLAG_RULES = ['required', 'email', 'phone', 'url', 'integer'] as const;
const NUMBER_RULES = ['min', 'max', 'minLength', 'maxLength'] as const;

export interface EditContext {
  readonly uiKit: UiKitComponents;
  /** Фабрики правил ядра; пусто — сверять не с чем. */
  readonly rules: ReadonlySet<string>;
  readonly target: ReformerTargetStack;
  /**
   * Есть ли в плане этап строк. Нет — `add_array` отказ: «город из списка» модель делала массивом
   * (L2-profile-json, 20261113T171744Z-9518). Не задано — без проверки.
   */
  readonly rows?: boolean;
  /**
   * В плане есть шаги мастера. `false` — «step» в правке поля не значит ничего: модель писала туда
   * формулу итога, отказ «add_step first» уводил её строить шаги, а «readonly» итога терялся с правкой
   * (L3-order-total, 20261113T220710Z-1415). Не задано — без проверки.
   */
  readonly wizard?: boolean;
  /** Текст задания из плана: числовые варианты сверяются с ним. */
  readonly task?: string;
  /**
   * Правка готовой формы: задание — изменение, а не форма целиком. Напоминание «задание называет это
   * поле» при удалении здесь ложное: поле названо как раз затем, чтобы его убрать (батч
   * 20261114T113832Z-68e8, registration-delete).
   */
  readonly edit?: boolean;
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

/**
 * Имя — слово о типе, а не о том, что хранит поле: модель называла поле билетов `integer`, а
 * галочку согласия — `conditional`, и ни контракт, ни разметка их не узнавали (L2-event-signup,
 * 20261114T005219Z-43ce).
 */
const GENERIC_NAME =
  /^(integer|int|string|boolean|bool|conditional|checkbox|field\d*|input\d*|value\d*|item\d*)$/i;

function checkNewName(name: string, taken: readonly string[]): void {
  if (!PATH.test(name)) {
    throw new EditError(
      `name \`${name}\` is not an identifier — latin camelCase, a group as "address.city"`
    );
  }
  if (GENERIC_NAME.test(name.split('.').pop() ?? name)) {
    throw new EditError(
      `name \`${name}\` says the kind, not the input — name it by what it holds in the task (latin camelCase: tickets, promoCode, agree)`
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
  // Длина или диапазон в «options» — проверка, а не варианты: поле ФИО становилось списком
  // с вариантами «min», «2», «max», «100» (L2-profile-json).
  if (
    Array.isArray(value) &&
    value.some((option) => typeof option === 'string' && RULE_WORDS.has(option))
  ) {
    throw new EditError(
      '"options" are the choices of a select; a length or a range is a check on the field: "minLength":2,"maxLength":100 (or add_rule)'
    );
  }
  if (!Array.isArray(value) || value.length === 0)
    throw new EditError('"options" is a non-empty list');
  // Один вариант — не выбор: в «options» попадали формат или ограничение («от 2 до 100 символов»).
  if (value.length === 1) {
    throw new EditError(
      '"options" with one choice is not a select — a choice has 2+ options; a format is "mask", a length or a range is a check ("minLength", "min")'
    );
  }
  // «defect — брак, other — другое»: задание пишет вариант как «значение — подпись», и модель
  // копировала строку целиком — значение «defect - брак» не совпадало с «defect» контракта
  // (L3-refund, 20261113T210742Z-5a45). Делим, только если так записаны все варианты.
  const pairs = value.map((option) =>
    typeof option === 'string' ? /^\s*([A-Za-z][\w.-]*)\s+[—–-]\s+(\S.*?)\s*$/.exec(option) : null
  );
  if (pairs.every((pair) => pair !== null)) {
    return pairs.map((pair) => ({ value: pair![1], label: pair![2] }));
  }
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
  const mask = kitMask(text(edit, 'mask'));
  const rawType = typeSynonym(text(edit, 'type'));
  const readonlyType = rawType !== undefined && READONLY_TYPES.has(rawType);
  const typeGiven = readonlyType
    ? /comput|calcul/.test(rawType) && record.type === undefined
      ? 'number'
      : undefined
    : rawType;
  const type = typeGiven ?? (typeof record.type === 'string' ? record.type : 'string');
  if (!(FIELD_TYPES as readonly string[]).includes(type)) {
    throw new EditError(
      `"type" is one of ${FIELD_TYPES.join(', ')}${didYouMean(type, FIELD_TYPES)}`
    );
  }
  record.type = type;
  // Варианты выбора и маска или дата друг друга исключают: модель вешала варианты города на все
  // поля разом, и телефон с датой становились списками городов (L2-profile-json, 20261113T172825Z-1e9b).
  // Маска — только у текстового поля и только с цифрами: модель придумывала «YYYY-MM-DD» для даты и
  // «0-99» для ФИО, и сервер ставил по ним проверку формата (L2-profile-json, 20261113T173706Z-63d7).
  if (mask && type !== 'string') {
    throw new EditError(
      `a ${type} field has no "mask" — the ${type === 'date' ? 'date picker' : 'input'} sets its format`
    );
  }
  if (mask && !mask.includes('9')) {
    throw new EditError(
      `"mask":"${mask}" has no digit — a mask is the format from the task with 9 for each digit; no format in the task — no mask`
    );
  }
  // Числа вариантами у числового поля — обычно диапазон задания («от 0 до 50»), а не выбор: модель
  // делала скидку списком [0, 5] (L3-order-total, 20261113T202828Z-32b0). Варианты, перечисленные
  // в самом задании, — выбор.
  if (options && type === 'number' && ctx.task) {
    const listed = new Set(ctx.task.match(/\d+/g) ?? []);
    if (
      // Числа строками («"0","1",…,"50"») — те же числа (L3-order-total, 20261113T220710Z-1415).
      options.every(
        (option) =>
          typeof option.value === 'number' ||
          (typeof option.value === 'string' && /^-?\d+(?:\.\d+)?$/.test(option.value.trim()))
      ) &&
      (!options.every((option) => listed.has(String(option.value))) ||
        // Два варианта — границы диапазона задания («от 0 до 50» → [0, 50]): тоже проверка
        // (L3-order-total, 20261114T005219Z-43ce).
        (options.length === 2 &&
          new RegExp(
            `(?:от\\s*${String(options[0].value)}\\s*до\\s*${String(options[1].value)}|${String(options[0].value)}\\s*[–-]\\s*${String(options[1].value)})(?!\\d)`
          ).test(ctx.task)))
    ) {
      throw new EditError(
        'a number field with a range of the task is a check, not choices: "min":<from>,"max":<to> on the field'
      );
    }
  }
  if (options && (mask || type === 'date' || type === 'boolean')) {
    throw new EditError(
      `a field with ${mask ? '"mask"' : `"type":"${type}"`} is not a choice — "options" belong only to the field the task gives choices for`
    );
  }

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
  if (edit.readonly === true || edit.readOnly === true || readonlyType) props.readOnly = true;
  if (isRecord(edit.props)) Object.assign(props, edit.props);
  if (Object.keys(props).length > 0) record.componentProps = props;
  else delete record.componentProps;

  const label = text(edit, 'label');
  if (label) record.label = label;
  // «По умолчанию» словами моделей — default / defaultValue.
  const given = edit.initialValue ?? edit.default ?? edit.defaultValue;
  // Умолчание выбора — значение варианта: модель писала подпись («брак») или строку варианта целиком
  // («defect - брак») — L3-refund.
  const choices = Array.isArray(props.options) ? (props.options as Rec[]) : [];
  const initial =
    typeof given === 'string' && choices.length > 0 && !choices.some((c) => c.value === given)
      ? (choices.find(
          (c) =>
            c.label === given ||
            (typeof c.value === 'string' && given.trim().startsWith(`${c.value} `))
        )?.value ?? given)
      : given;
  if (initial !== undefined) record.initialValue = initial;
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
    // Intent без раскладки раскладывает поля сам; новая раскладка начинается с них — иначе первое
    // добавленное поле оставило бы остальные вне формы («unplaced» на готовой форме без layoutRoot).
    file.layoutRoot = {
      kind: 'container',
      component: 'Box',
      children: [
        ...fieldsOf(file).map(nameOf).filter(Boolean),
        ...arraysOf(file)
          .map(nameOf)
          .filter(Boolean)
          .map((ref) => ({ kind: 'array', ref })),
      ],
    };
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

/** «step» правки поля; в форме без шагов по плану — без него, с пометкой. */
function stepOf(edit: Rec, ctx: EditContext): { step: string | undefined; note: string } {
  const step = text(edit, 'step');
  if (step === undefined || ctx.wizard !== false) return { step, note: '' };
  const formula = /[=*/+×]/.test(step) ? '; a formula is add_behavior "kind":"compute"' : '';
  return { step: undefined, note: ` ("step" ignored — this form has no steps${formula})` };
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

/**
 * Регулярное выражение по маске `InputMask` кита: `9` — цифра, прочие символы — литералы. Маска
 * только подсказка в поле и ввод не проверяет — проверку даёт `pattern`.
 */
export function maskToPattern(mask: string): string {
  const body = [...mask]
    .map((char) => (char === '9' ? '\\d' : char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')))
    .join('');
  return `^${body}$`;
}

/**
 * Маска в нотации кита: цифра — `9`. Модели писали `#` и `_` (нотации других библиотек), и маска
 * `+7 (###) ###-##-##` не принимала ни одной цифры (L2-profile-json, 20261113T172349Z-2850).
 */
export function kitMask(mask: string | undefined): string | undefined {
  return mask?.replace(/[#_]/g, '9');
}

/** Маска поля правила, если она есть. */
function maskOf(record: Rec | undefined): string | undefined {
  const props = record?.componentProps;
  return isRecord(props) && typeof props.mask === 'string' ? props.mask : undefined;
}

/**
 * `pattern`, записанный шаблоном маски (`+7 (999) 999-99-99`), — регулярное выражение по этой маске.
 * Модель писала маску вместо выражения: такое правило пропускает только сами девятки, а с `+` в
 * начале ещё и не компилируется (L2-profile-json, 20261113T165921Z-9de1).
 */
function patternFromMask(edit: Rec, mask: string | undefined): { edit: Rec; note: string } {
  const raw = text(edit, 'pattern');
  if (!raw) return { edit, note: '' };
  const plain = raw
    .replace(/^\/|\/[a-z]*$/g, '')
    .replace(/^\^|\$$/g, '')
    .replace(/\\(.)/g, '$1');
  const regexLike = /\\[dDwWsS]|\[|\{|\.[*+]/.test(raw);
  const asMask = kitMask(plain)!;
  const template =
    (mask !== undefined && asMask === mask) ||
    (!regexLike && /9{2,}/.test(asMask) && /[\s()+\-.]/.test(asMask));
  if (!template) return { edit, note: '' };
  return {
    edit: { ...edit, pattern: maskToPattern(asMask) },
    note: ` (pattern read as the input mask "${plain}")`,
  };
}

/**
 * Самописное выражение адреса почты (`@`, за ним точка) — проверка `email()` сервера. Модель читала
 * «формат email» как `pattern` и писала выражение, которое не пропускало ни одного настоящего адреса:
 * `[^\W_@]+[@]\.+\.[a-z]{2,}` (L2-registration-lite, 20261113T210742Z-5a45). `^@\w+$` (ник) — не почта.
 */
function emailFromPattern(edit: Rec): { edit: Rec; note: string } {
  const raw = text(edit, 'pattern');
  if (!raw || !raw.includes('@')) return { edit, note: '' };
  if (!/\\\.|\[[^\]]*\.[^\]]*\]/.test(raw.slice(raw.indexOf('@')))) return { edit, note: '' };
  return {
    edit: { ...edit, pattern: undefined, email: true },
    note: ' (an email pattern read as "email":true — the server checks the address)',
  };
}

/**
 * Строка правила — вызов валидатора. Короткие записи модели (`minLength:2`, `maxLength=100`,
 * `min 18`) — тот же вызов; прочее — отказ правки. Прежде строка шла в код как есть, `minLength:2()`
 * ломал сборку, и убрать его было нечем (L2-profile-json, 20261113T181347Z-c277).
 */
function ruleCall(rule: string): string {
  const value = rule.trim();
  if (/^\w+\s*\([\s\S]*\)$/.test(value)) return value;
  if (/^\w+$/.test(value)) return `${value}()`;
  const short = /^(\w+)\s*(?:[:=]\s*|\s+)(-?\d+(?:\.\d+)?)$/.exec(value);
  if (short) return `${short[1]}(${short[2]})`;
  throw new EditError(
    `"rule":"${value}" is not a validator call — write "minLength(2)" or use the keys: "minLength":2, "required":true`
  );
}

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
    // Неверное выражение — отказ правки сейчас, а не ошибка компилятора в form.validation.ts, которую
    // модель не связывала со своим правилом.
    const [, body = '', flags = ''] = /^\/(.*)\/([a-z]*)$/.exec(literal) ?? [];
    try {
      new RegExp(body, flags);
    } catch (error) {
      throw new EditError(
        `"pattern" is not a valid regular expression (${(error as Error).message}) — e.g. "^\\d{6}$"; an input format like a phone: "mask" on the field (9 — a digit) and "pattern" as the example shows`
      );
    }
    checks.push(`pattern(${literal})`);
  }
  const single = text(edit, 'rule');
  // Регулярное выражение в «rule» — это pattern: отказ «нет валидатора ^\+7…» модель решала,
  // выбросив проверку формата совсем (L2-profile-json).
  if (
    single &&
    !pattern &&
    /^(\^|\/)|\\d|\$$/.test(single.trim()) &&
    !/^\w+\s*\(/.test(single.trim())
  ) {
    return checksOf({ ...edit, rule: undefined, pattern: single.trim() }, ctx);
  }
  if (single) checks.push(ruleCall(single));
  checks.push(...names(edit, 'rules').map(ruleCall));
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

/** Слова проверок: в «options» они значат ограничение, а не варианты. */
const RULE_WORDS: ReadonlySet<string> = new Set([...FLAG_RULES, ...NUMBER_RULES, 'pattern']);

/**
 * Проверки объектом в «options» (`"options":{"minLength":2}`) — проверки поля: варианты выбора —
 * всегда список.
 */
function rulesFromOptions(edit: Rec): Rec {
  const options = edit.options;
  // Список проверок в «options» (`["required","min:1","max:10"]`) — проверки поля (L2-event-signup).
  if (
    Array.isArray(options) &&
    options.length > 0 &&
    options.every((option) => typeof option === 'string' && RULE_WORDS.has(ruleName(option.trim())))
  ) {
    const { options: _list, ...rest } = edit;
    return { ...rest, rules: [...names(rest, 'rules'), ...(options as string[])] };
  }
  if (!isRecord(options)) return edit;
  const keys = Object.keys(options);
  if (keys.length === 0 || !keys.every((key) => RULE_WORDS.has(key))) return edit;
  const { options: _dropped, ...rest } = edit;
  return { ...options, ...rest };
}

/** Ключи проверок, которые модель пишет прямо на поле (`"required":true` в `add_field`). */
const FIELD_RULE_KEYS = [...FLAG_RULES, ...NUMBER_RULES, 'pattern', 'rule', 'rules'] as const;

/**
 * Проверки, записанные на самом поле, — правило этого поля, а не потеря: прежде ключи молча
 * отбрасывались, ответ был «✓ поле добавлено», а обязательность пропадала (L1-login, батч
 * 20261113T164411Z-e818).
 */
function liftFieldRules(
  file: Rec,
  edit: Rec,
  ctx: EditContext,
  field: string,
  array?: string
): string {
  const given = FIELD_RULE_KEYS.filter((key) => edit[key] !== undefined && edit[key] !== false);
  // Маска ввод не проверяет, а выражение по ней модель переписывала со слэшами и ломала скрипт
  // (L2-profile-json, 20261113T173146Z-3dcb): проверку формата по маске ставит сервер.
  const mask = kitMask(text(edit, 'mask'));
  const format =
    mask && edit.pattern === undefined
      ? `; ${addRule(file, { field, ...(array ? { array } : {}), pattern: maskToPattern(mask) }, ctx)} (the format check from the mask)`
      : '';
  if (given.length === 0) return format;
  const rule: Rec = { field, ...(array ? { array } : {}) };
  for (const key of [...given, 'message', 'when'])
    if (edit[key] !== undefined) rule[key] = edit[key];
  return `; ${addRule(file, rule, ctx)}${format}`;
}

/** Шаблоны формата в тексте задания: цифры со скобками, дефисами, пробелами (`+7 (999) 999-99-99`). */
export function formatTemplates(task: string): string[] {
  return [...task.matchAll(/[+(]?\d[\d\s()+\-.]{4,}\d/g)]
    .map((match) => match[0].trim())
    .filter((template) => /\d{2,}/.test(template) && /[\s()\-+.]/.test(template));
}

/**
 * Маска, когда в задании нет ни одного формата, — выдумка модели: «+9(999)00-00-00» на «имя и
 * телефон», и проверка по маске не пропускала настоящий номер (L1-callback, все прогоны
 * 20261113T224423Z-b31c). Маска выбрасывается с пометкой; поле остаётся.
 */
function withoutInventedMask(edit: Rec, ctx: EditContext, file: Rec): { edit: Rec; note: string } {
  if (typeof edit.mask !== 'string' || !edit.mask.trim() || ctx.task === undefined)
    return { edit, note: '' };
  const templates = formatTemplates(ctx.task);
  const { mask: _dropped, ...rest } = edit;
  if (templates.length === 0) {
    return { edit: rest, note: '; "mask" dropped — the task names no input format' };
  }
  // Формат задания стоит у своего поля («телефон в формате +7 …»). Подпись этого поля далеко перед
  // шаблоном — маска чужая: пошагово модель добавляла сначала одно ФИО, окно задания тянулось до
  // «телефон в формате», и маска телефона вставала на ФИО (L2-profile-json, 20261114T005219Z-43ce).
  const name = text(edit, 'name') ?? text(edit, 'field');
  const record = name ? findField(file, name) : undefined;
  const label = String(edit.label ?? record?.label ?? '')
    .toLowerCase()
    .trim();
  const lower = ctx.task.toLowerCase();
  const keys = [label, name ? `(${name.toLowerCase()}` : ''].filter((key) => key.length >= 3);
  const found = keys.some((key) => lower.includes(key));
  if (!found) return { edit, note: '' };
  const near = templates.some((template) => {
    const at = ctx.task!.indexOf(template);
    return keys.some((key) => {
      const keyAt = lower.lastIndexOf(key, at);
      return keyAt >= 0 && at - (keyAt + key.length) <= 30;
    });
  });
  if (near) return { edit, note: '' };
  return {
    edit: rest,
    note: `; "mask" dropped — the format «${templates[0]}» stands by another input of the task, not by this one`,
  };
}

/** Имя поля правки: `name`, а по привычке `add_rule` — и `field`. */
function fieldName(edit: Rec): string {
  return text(edit, 'name') ?? text(edit, 'field') ?? text(edit, 'name', true)!;
}

function addField(file: Rec, edit: Rec, ctx: EditContext): string {
  const name = fieldName(edit);
  // Модель пересылает весь список полей: отказ «already exists» на каждое блокировал план, и модель
  // останавливалась (L2-profile-json, 20261113T171142Z-19e3). Существующее поле — правка поля.
  if (findField(file, name)) {
    return `\`${name}\` already existed — ${setField(file, { ...edit, op: 'set_field' }, ctx)}`;
  }
  checkNewName(name, modelPaths(file));
  // Заголовок формы — не поле: «Оформление заказа» становился полем orderDetails (L3-delivery,
  // 20261114T005219Z-43ce).
  const title = String(file.formName ?? '')
    .trim()
    .toLowerCase();
  const label = String(edit.label ?? '')
    .trim()
    .toLowerCase();
  if (title && label === title) {
    throw new EditError(
      `«${String(edit.label)}» is the title of the form, not an input — add only the inputs the task names`
    );
  }
  fieldsOf(file).push({ name, ...fieldRecord(edit, ctx) });
  const { step, note } = stepOf(edit, ctx);
  const where = place(file, name, false, step);
  return `field \`${name}\` added to ${where}${note}${liftFieldRules(file, edit, ctx, name)}`;
}

/**
 * `"mask":""` (или `null`) — снять маску с поля вместе с проверкой формата, которую сервер поставил по
 * ней. Маску телефона модель вешала и на ФИО, и снять её было нечем (L2-profile-json,
 * 20261114T005219Z-43ce).
 */
function clearMask(file: Rec, record: Rec, edit: Rec, ctx: EditContext): string {
  if (!(edit.mask === null || (typeof edit.mask === 'string' && edit.mask.trim() === '')))
    return '';
  const props = isRecord(record.componentProps) ? record.componentProps : undefined;
  const old = props && typeof props.mask === 'string' ? props.mask : undefined;
  if (!props || old === undefined) return '';
  delete props.mask;
  if (Object.keys(props).length === 0) delete record.componentProps;
  if (record.component === 'InputMask') record.component = 'Input';
  const path = nameOf(record);
  const check = checksOf({ pattern: maskToPattern(old) }, ctx)[0] ?? '';
  const head = check.slice(0, -1);
  file.validation = list(file, 'validation')
    .map((row) => {
      if (row.target !== path || !Array.isArray(row.rules)) return row;
      const rules = (row.rules as unknown[]).filter(
        (rule) => typeof rule !== 'string' || !rule.startsWith(head)
      );
      return { ...row, rules };
    })
    .filter((row) => row.cross !== undefined || !Array.isArray(row.rules) || row.rules.length > 0);
  return `; mask «${old}» and its format check removed`;
}

function setField(file: Rec, edit: Rec, ctx: EditContext): string {
  const name = fieldName(edit);
  const arrayName = text(edit, 'array');
  if (arrayName) {
    const items = itemFieldsOf(requireArray(file, arrayName));
    const index = items.findIndex((item) => nameOf(item) === name);
    if (index < 0)
      throw new EditError(
        `no field \`${name}\` in rows of \`${arrayName}\`${didYouMean(name, items.map(nameOf))}`
      );
    items[index] = { name, ...fieldRecord(edit, ctx, items[index]) };
    return `row field \`${arrayName}.${name}\` changed${liftFieldRules(file, edit, ctx, name, arrayName)}`;
  }
  const fields = fieldsOf(file);
  const index = fields.indexOf(requireField(file, name));
  fields[index] = { ...fieldRecord(edit, ctx, fields[index]), name };
  const unmasked = clearMask(file, fields[index], edit, ctx);
  const { step, note: stepNote } = stepOf(edit, ctx);
  const moved = step ? `, moved to ${place(file, name, false, step)}` : stepNote;
  return `field \`${name}\` changed${unmasked}${moved}${liftFieldRules(file, edit, ctx, name)}`;
}

/** Путь — это `name` или поле внутри него (`name.city`). */
const under = (path: unknown, name: string): boolean =>
  typeof path === 'string' && (path === name || path.startsWith(`${name}.`));

/**
 * Убрать поля и массивы с этими путями — сами записи и строки валидации, поведения и видимости на
 * них. Строки других полей, которые их читают, остаются: их правит модель, ответ их называет.
 */
function dropPaths(file: Rec, paths: readonly string[]): { dropped: number; readers: string[] } {
  const hit = (path: unknown): boolean => paths.some((name) => under(path, name));
  file.fields = fieldsOf(file).filter((record) => !hit(nameOf(record)));
  file.arrays = arraysOf(file).filter((record) => !hit(nameOf(record)));
  for (const name of paths) unplace(file, name);
  let dropped = 0;
  for (const key of ['validation', 'behavior', 'visibility']) {
    const before = list(file, key).length;
    file[key] = list(file, key).filter(
      (row) => !hit(row.target) && !hit(row.selector) && !hit(row.each)
    );
    dropped += before - list(file, key).length;
  }
  const reads = (row: Rec): boolean =>
    (Array.isArray(row.sources) && row.sources.some(hit)) ||
    ['expr', 'when', 'cross', 'condition'].some(
      (key) =>
        typeof row[key] === 'string' &&
        paths.some((name) =>
          new RegExp(`(?<![\\w$])(?:model|values|form)\\.${escapeRegExp(name)}(?![\\w$])`).test(
            row[key] as string
          )
        )
    );
  const readers = [
    ...new Set(
      ['validation', 'behavior']
        .flatMap((key) => list(file, key))
        .filter(reads)
        .map((row) => `${String(row.kind ?? 'rule')} of ${String(row.target ?? row.selector)}`)
    ),
  ];
  return { dropped, readers };
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Строка ответа об удалении: сколько правил ушло и кто ещё читает удалённое. */
function droppedNote(dropped: number, readers: readonly string[]): string {
  return `${dropped ? `, with ${dropped} rules on it` : ''}${
    readers.length > 0
      ? `; still read by ${readers.join(', ')} — change ${readers.length === 1 ? 'it' : 'them'} (add_behavior / add_rule again, or remove_behavior / remove_rule)`
      : ''
  }`;
}

function removeField(file: Rec, edit: Rec, ctx: EditContext): string {
  const name = fieldName(edit);
  const isArray = findArray(file, name) !== undefined;
  const exact = findField(file, name);
  // Группа (`delivery` у полей `delivery.city`) удаляется вся, хотя такого поля нет.
  const group =
    !isArray &&
    exact === undefined &&
    fieldsOf(file).some((record) => nameOf(record).startsWith(`${name}.`));
  const record = isArray
    ? findArray(file, name)
    : (exact ?? (group ? undefined : requireField(file, name)));
  // Поле, которое задание называет, модель удаляла вместо одной отклонённой правки на нём: «город из
  // списка» пропадал из формы (L2-profile-json, 20261113T230859Z-f59e). Удаляется, но с напоминанием.
  // При правке готовой формы поле названо затем, чтобы его убрать, — без напоминания.
  const label = String(record?.label ?? '').trim();
  const named =
    ctx.edit !== true &&
    ctx.task !== undefined &&
    ((label.length >= 3 && ctx.task.toLowerCase().includes(label.toLowerCase())) ||
      new RegExp(`\\(${escapeRegExp(name)}[\\s,:;)]`).test(ctx.task));
  const { dropped, readers } = dropPaths(file, [name]);
  const warning = named
    ? ` — the task names this input («${label || name}»): put it back with add_field unless it really is not an input of the task`
    : '';
  return `\`${name}\` removed${droppedNote(dropped, readers)}${warning}`;
}

// ---------- Переименования и шаги ----------

/** Новое имя переименования: ключ `to` и его синонимы у моделей. */
function newName(edit: Rec): string {
  const to = text(edit, 'to') ?? text(edit, 'newName') ?? text(edit, 'rename') ?? text(edit, 'new');
  if (!to)
    throw new EditError('"to" is the new key — {"op":"rename_field","name":"<now>","to":"<new>"}');
  return to;
}

/**
 * Заменить путь `from` на `to` во всём intent: записи полей и массивов, цели, источники и селекторы
 * строк, раскладка, выражения (`model.x`, `values.x`, `form.x`, голое имя в формуле `computeFrom`).
 * Возвращает число замен.
 */
function renamePath(file: Rec, from: string, to: string): number {
  let count = 0;
  const swap = (path: unknown): unknown => {
    if (typeof path !== 'string' || !under(path, from)) return path;
    count++;
    return `${to}${path.slice(from.length)}`;
  };
  for (const record of [...fieldsOf(file), ...arraysOf(file)]) record.name = swap(record.name);
  const scoped = new RegExp(
    `(?<![\\w$])(model|values|form)\\.${escapeRegExp(from)}(?![\\w$])`,
    'g'
  );
  const bare = new RegExp(`(?<![\\w$.])${escapeRegExp(from)}(?![\\w$])`, 'g');
  const rewrite = (expr: unknown, bareNames: boolean): unknown => {
    if (typeof expr !== 'string') return expr;
    let out = expr.replace(scoped, (_match, scope: string) => {
      count++;
      return `${scope}.${to}`;
    });
    if (bareNames) {
      out = out.replace(bare, () => {
        count++;
        return to;
      });
    }
    return out;
  };
  for (const key of ['validation', 'behavior', 'visibility']) {
    for (const row of list(file, key)) {
      // Внутри строк массива (`each`) цели и источники — колонки строки, не пути формы.
      if (row.each === undefined) {
        row.target = swap(row.target);
        if (Array.isArray(row.sources)) row.sources = row.sources.map(swap);
      }
      row.each = swap(row.each);
      row.selector = swap(row.selector);
      for (const exprKey of ['expr', 'when', 'cross', 'condition', 'showWhen', 'hideWhen']) {
        if (typeof row[exprKey] !== 'string') continue;
        row[exprKey] = rewrite(row[exprKey], row.kind === 'computeFrom' && exprKey === 'expr');
      }
    }
  }
  if (Array.isArray(file.steps)) {
    for (const step of file.steps as Rec[]) {
      if (Array.isArray(step.fields)) step.fields = (step.fields as unknown[]).map(swap);
    }
  }
  const walk = (node: unknown): void => {
    if (!isRecord(node) || !Array.isArray(node.children)) return;
    node.children = (node.children as unknown[]).map((child) => {
      if (typeof child === 'string') return swap(child);
      if (isRecord(child) && typeof child.ref === 'string') child.ref = swap(child.ref);
      walk(child);
      return child;
    });
  };
  walk(file.layoutRoot);
  return count;
}

function renameField(file: Rec, edit: Rec): string {
  const from = text(edit, 'name') ?? text(edit, 'field', true)!;
  const to = newName(edit);
  const exists =
    findArray(file, from) !== undefined ||
    fieldsOf(file).some((record) => under(nameOf(record), from));
  if (!exists) {
    throw new EditError(`no field \`${from}\`${didYouMean(from, modelPaths(file))}`);
  }
  if (to.split('.').length !== from.split('.').length) {
    throw new EditError(
      `"to" keeps the depth of the path: \`${from}\` → a key like \`${from.split('.').slice(0, -1).concat('<new>').join('.')}\``
    );
  }
  checkNewName(
    to,
    modelPaths(file).filter((path) => !under(path, from))
  );
  const references = renamePath(file, from, to);
  const label = text(edit, 'label');
  if (label) {
    const record = findField(file, to) ?? findArray(file, to);
    if (record) record.label = label;
  }
  return `\`${from}\` renamed to \`${to}\` (${references} references)${label ? `, label «${label}»` : ''}`;
}

/** Все шаги формы: сокращение `steps` или узлы `step` дерева. */
function allSteps(file: Rec): Rec[] {
  if (Array.isArray(file.steps) && file.steps.length > 0) return file.steps as Rec[];
  return stepNodes(file.layoutRoot);
}

function renameStep(file: Rec, edit: Rec): string {
  const step = findStep(allSteps(file), text(edit, 'title') ?? text(edit, 'step', true));
  const to = newName(edit);
  const before = String(step.title ?? '');
  step.title = to;
  return `step «${before}» renamed to «${to}»`;
}

/** Пути полей и массивов узла раскладки: строки, `array`/`part` по ссылке, вложенные контейнеры. */
function refsIn(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (isRecord(node)) {
    if (typeof node.ref === 'string') out.push(node.ref);
    for (const child of Array.isArray(node.children) ? node.children : []) refsIn(child, out);
  }
  return out;
}

function removeStep(file: Rec, edit: Rec): string {
  const steps = allSteps(file);
  const step = findStep(steps, text(edit, 'title') ?? text(edit, 'step', true));
  const title = String(step.title ?? '');
  const refs = Array.isArray(step.fields)
    ? (step.fields as unknown[]).filter((ref): ref is string => typeof ref === 'string')
    : refsIn(step).filter((ref) => ref !== step.selector);
  // Шаг — из раскладки: из сокращения или из детей родителя в дереве.
  if (Array.isArray(file.steps) && file.steps.includes(step)) {
    file.steps = (file.steps as Rec[]).filter((other) => other !== step);
  } else {
    const prune = (node: unknown): void => {
      if (!isRecord(node) || !Array.isArray(node.children)) return;
      node.children = (node.children as unknown[]).filter((child) => child !== step);
      for (const child of node.children as unknown[]) prune(child);
    };
    prune(file.layoutRoot);
  }
  const { dropped, readers } = dropPaths(file, refs);
  // Видимость самого шага (скрытый шаг мастера) — по его селектору.
  if (typeof step.selector === 'string') {
    file.visibility = list(file, 'visibility').filter((row) => row.selector !== step.selector);
  }
  return `step «${title}» removed with ${refs.length} items (${refs.join(', ') || 'none'})${droppedNote(dropped, readers)}`;
}

function addArray(file: Rec, edit: Rec, ctx: EditContext): string {
  if (ctx.rows === false) {
    throw new EditError(
      'the plan has no rows: the task names no repeating rows. A choice from a list is a field with "options". Rows needed after all (the task or its spec lists rows)? Send the same add_array again — the plan gets a rows stage'
    );
  }
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
  const { step, note } = stepOf(edit, ctx);
  return `array \`${name}\` added to ${place(file, name, true, step)}${note} — now add_item_field for its row`;
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
  return `row field \`${arrayName}.${name}\` added${liftFieldRules(file, edit, ctx, name, arrayName)}`;
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

/** Виды «поведения», которые на деле — видимость поля. */
const VISIBILITY_KINDS: ReadonlySet<string> = new Set([
  'visibility',
  'visible',
  'visiblewhen',
  'show',
  'showwhen',
  'showfields',
  'showfield',
  'hide',
  'hidewhen',
]);

const EXPRESSION_WORDS = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'model',
  'values',
  'item',
  'typeof',
  'instanceof',
  'new',
  'in',
  'of',
  'Number',
  'String',
  'Boolean',
  'Math',
  'Date',
  'length',
  'trim',
]);

/**
 * Выражение с голыми именами — над формой: имя поля → `model.<поле>` (в правиле между полями —
 * `values.<поле>`), значение варианта выбора → строка. Модель писала «deliveryMethod == delivery»:
 * сервер отказывал, а в видимости это шло в код как «Cannot find name» (L3-delivery,
 * 20261113T191026Z-aaee).
 */
export function withScope(expr: string, file: Rec, scope: 'model' | 'values' = 'model'): string {
  const roots = new Set(modelPaths(file).map((path) => path.split('.')[0]));
  const choices = new Set<string>();
  for (const field of fieldsOf(file)) {
    const options = isRecord(field.componentProps) ? field.componentProps.options : undefined;
    if (!Array.isArray(options)) continue;
    for (const option of options) {
      const value = isRecord(option) ? option.value : option;
      if (typeof value === 'string') choices.add(value);
    }
  }
  return expr.replace(
    /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(?<![\w$.'"])([A-Za-z_$][\w$]*)(?![\w$])/g,
    (match: string, literal: string | undefined, id: string | undefined) => {
      // Имя поля в кавычках ('reason' === 'other') — поле, если это не вариант выбора (L3-refund).
      if (literal) {
        const inner = literal.slice(1, -1);
        return roots.has(inner) && !choices.has(inner) ? `${scope}.${inner}` : match;
      }
      if (!id || EXPRESSION_WORDS.has(id)) return match;
      if (roots.has(id)) return `${scope}.${id}`;
      if (choices.has(id)) return `'${id}'`;
      return match;
    }
  );
}

/** Имена, которые выражение может звать без `model.`: слова языка и стандартные функции. */
const KNOWN_NAMES: ReadonlySet<string> = new Set([
  ...EXPRESSION_WORDS,
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'Infinity',
  'NaN',
  'Array',
  'Object',
]);

/**
 * Голые имена выражения, которых нет ни в форме, ни в языке. Модель писала `visible ? … : 0` и
 * `comment_visible && …`: это шло в код, сборка падала на «Cannot find name», а убрать поведение было
 * нечем (L3-refund, 20261113T210742Z-5a45). Вызывать после {@link withScope}: поля уже `model.<поле>`.
 */
function unknownNames(expr: string): string[] {
  const bare = expr.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
  // Параметры стрелочных функций — свои имена выражения: `model.items.reduce((sum, row) => …, 0)`.
  const params = new Set<string>();
  for (const match of bare.matchAll(/\(([^()]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>/g)) {
    for (const part of (match[1] ?? match[2] ?? '').split(',')) {
      const name = /^\s*([A-Za-z_$][\w$]*)/.exec(part)?.[1];
      if (name) params.add(name);
    }
  }
  const names = [...bare.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?![\w$])/g)].map((m) => m[1]);
  return [...new Set(names.filter((name) => !KNOWN_NAMES.has(name) && !params.has(name)))];
}

function rejectUnknownNames(key: string, expr: string, file: Rec): void {
  const unknown = unknownNames(expr);
  if (unknown.length === 0) return;
  throw new EditError(
    `"${key}" names ${unknown.map((name) => `\`${name}\``).join(', ')} — not a field of the form; an expression reads only the fields: ${modelPaths(file).join(', ')} (as model.<field>)`
  );
}

/**
 * Условие правила — выражение над полями формы (`model.tickets > 0`). Проверяется при приёме:
 * `@email != ""` прежде шло в код и ломало сборку двенадцатью ошибками типов, а убрать правило
 * было нечем (L2-event-signup, 20261113T184634Z-977e). «true» — условия нет.
 */
/**
 * Одиночное «=» в условии — сравнение: «deliveryMethod=delivery» шло в код присваиванием
 * `model.deliveryMethod='delivery'` и ломало сборку ошибкой типов (L3-delivery,
 * 20261114T005219Z-43ce). Строки в кавычках не трогаются.
 */
function equalsAsComparison(expr: string): string {
  // «!model.reason === 'other'» — отрицание сравнения, а не поля: `!model.reason` — boolean, и
  // сравнение со строкой ломало сборку (L3-refund, 20261114T005219Z-43ce).
  expr = expr.replace(/!\s*(model\.[\w$.]+)\s*===?\s*/g, '$1 !== ');
  return expr.replace(
    /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(?<![=!<>])=(?![=>])/g,
    (match: string, literal: string | undefined) => literal ?? ' === '
  );
}

function conditionOf(when: string | undefined, file: Rec): string | undefined {
  const value = when?.trim() ? withScope(equalsAsComparison(when.trim()), file) : undefined;
  if (!value || value === 'true') return undefined;
  const hint =
    'a condition over the form, e.g. "model.tickets > 0"; the rule always applies — drop "when"';
  if (/@/.test(value)) throw new EditError(`"when":"${value}" — ${hint}`);
  if (/\$\{/.test(value))
    throw new EditError(`"when":"${value}" — no \${…} here: compare the field itself, ${hint}`);
  if (/<[^<>]*\b(choice|task|field|value)\b[^<>]*>/i.test(value))
    throw new EditError(
      `"${value}" has a placeholder in angle brackets — put the value from the task in its place`
    );
  let depth = 0;
  for (const char of value.replace(/'[^']*'|"[^"]*"/g, '""')) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth < 0) break;
  }
  const quotes = ((value.match(/"/g)?.length ?? 0) % 2) + ((value.match(/'/g)?.length ?? 0) % 2);
  if (depth !== 0 || quotes !== 0)
    throw new EditError(`"when":"${value}" is not an expression — ${hint}`);
  const paths = modelPaths(file);
  const refs = [...value.matchAll(/\bmodel\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g)].map(
    (m) => m[1]
  );
  if (refs.length === 0) throw new EditError(`"when":"${value}" reads no field — ${hint}`);
  rejectUnknownNames('when', value, file);
  for (const ref of refs) {
    if (!paths.some((path) => ref === path || ref.startsWith(`${path}.`))) {
      throw new EditError(`"when" reads \`model.${ref}\` — no such field${didYouMean(ref, paths)}`);
    }
  }
  // Голое поле — не да/нет: «model.reason» у выбора давало `validateWhen(() => model.reason, …)` и
  // ошибку типов, которую модель не смогла связать с условием (L3-refund, 20261113T230859Z-f59e).
  const bare = /^!?\s*\(?\s*model\.([\w$.]+)\s*\)?$/.exec(value);
  const record = bare ? findField(file, bare[1]) : undefined;
  if (bare && record && record.type !== 'boolean') {
    const props = record.componentProps;
    const options =
      isRecord(props) && Array.isArray(props.options)
        ? (props.options as unknown[]).map((option) => (isRecord(option) ? option.value : option))
        : [];
    const sample = options.length
      ? options
          .map((option) => `model.${bare[1]} === ${JSON.stringify(option).replace(/"/g, "'")}`)
          .join(' or ')
      : `model.${bare[1]} === <value from the task>`;
    throw new EditError(
      `"${value}" is not yes/no — \`${bare[1]}\` is ${options.length ? 'a choice' : `a ${String(record.type ?? 'string')}`}; compare it: ${sample}`
    );
  }
  return value;
}

/**
 * Правило между полями — выражение над `values`, TRUE когда верно. «Должно совпадать с паролем» —
 * `"equals":"password"`; строка без `values.`, где названо одно другое поле (`password;equals`), —
 * то же равенство. Прочее проверяется при приёме: модель писала `email,password;equals:0`, и это
 * шло в код десятью ошибками типов (L2-registration-lite, 20261113T191026Z-aaee).
 */
function crossOf(edit: Rec, path: string, file: Rec): string | undefined {
  const paths = modelPaths(file);
  const equalTo = (other: string): string => {
    if (!paths.includes(other)) {
      throw new EditError(`"equals":"${other}" — no such field${didYouMean(other, paths)}`);
    }
    return `values.${path} === values.${other}`;
  };
  // «cross» объектом или флагом: `{"target":"password"}`, `{"values":["password"]}`, `true` — отказ
  // «"cross" is a string» модель не понимала и слала его по кругу (L2-registration-lite, f59e).
  const given = edit.cross;
  if (given !== undefined && typeof given !== 'string') {
    const other = isRecord(given)
      ? (given.equals ??
        given.sameAs ??
        given.target ??
        given.field ??
        (Array.isArray(given.values) ? given.values[0] : undefined))
      : undefined;
    if (typeof other === 'string') return equalTo(other.replace(/^values\./, ''));
    throw new EditError(
      `"cross" is an expression over values, TRUE when valid, e.g. "values.${path} === values.<other field>"; a field that must match another: "equals":"<other field>"`
    );
  }
  const equals = text(edit, 'equals') ?? text(edit, 'sameAs');
  if (equals) return equalTo(equals.replace(/^values\./, ''));
  const raw = text(edit, 'cross')?.trim();
  if (!raw) return undefined;
  // Выражение с голыми именами полей — над values; краткая запись без операторов — ниже.
  const value = /[=<>!]/.test(raw) ? withScope(raw, file, 'values') : raw;
  const sample = `"equals":"<other field>" (must match it), or "cross":"values.${path} === values.<other field>"`;
  if (!/\bvalues\./.test(value)) {
    const named = paths.filter(
      (other) =>
        other !== path &&
        new RegExp(`(^|[^\\w])${other.replace(/\./g, '\\.')}([^\\w]|$)`).test(value)
    );
    if (named.length === 1) return equalTo(named[0]);
    throw new EditError(`"cross":"${value}" is not an expression over values — ${sample}`);
  }
  let depth = 0;
  for (const char of value.replace(/'[^']*'|"[^"]*"/g, '""')) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0 || /[;@]/.test(value)) {
    throw new EditError(`"cross":"${value}" is not an expression — ${sample}`);
  }
  for (const match of value.matchAll(/\bvalues\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g)) {
    const ref = match[1];
    if (!paths.some((other) => ref === other || ref.startsWith(`${other}.`))) {
      throw new EditError(
        `"cross" reads \`values.${ref}\` — no such field${didYouMean(ref, paths)}`
      );
    }
  }
  return value;
}

/** Условие показа поля из его правила видимости (там хранится условие скрытия). */
function shownWhen(file: Rec, path: string): string | undefined {
  const row = list(file, 'visibility').find((entry) => entry.selector === path);
  const hide = typeof row?.condition === 'string' ? row.condition.trim() : undefined;
  if (!hide) return undefined;
  const inner = /^!\((.*)\)$/.exec(hide);
  return inner ? inner[1] : `!(${hide})`;
}

/**
 * Скрытое поле не проверяется: правила поля с условием видимости получают условие показа. Адрес
 * «обязателен при доставке» становился обязательным всегда, и самовывоз не проходил
 * (L3-delivery, 20261113T210742Z-5a45).
 */
function rulesWhileShown(file: Rec, path: string, show: string): number {
  let changed = 0;
  for (const row of list(file, 'validation')) {
    if (row.target !== path || row.when !== undefined || row.cross !== undefined) continue;
    row.when = show;
    changed++;
  }
  return changed;
}

/**
 * Убрать правила поля: все или одного валидатора (`"rule":"required"`). Модель сама тянулась к
 * такой правке, когда неудачное правило ломало сборку (L2-event-signup).
 */
function removeRule(file: Rec, edit: Rec): string {
  const field = text(edit, 'field') ?? text(edit, 'name') ?? text(edit, 'target', true)!;
  const only = text(edit, 'rule') ?? text(edit, 'validator');
  const name = only ? ruleName(only) : undefined;
  let removed = 0;
  const kept: Rec[] = [];
  for (const row of list(file, 'validation')) {
    if (row.target !== field) {
      kept.push(row);
      continue;
    }
    const rules = Array.isArray(row.rules) ? (row.rules as unknown[]) : [];
    if (!name) {
      removed += Math.max(rules.length, row.cross !== undefined ? 1 : 0);
      continue;
    }
    const rest = rules.filter((rule) => typeof rule !== 'string' || ruleName(rule) !== name);
    removed += rules.length - rest.length;
    if (rest.length > 0 || row.cross !== undefined) kept.push({ ...row, rules: rest });
  }
  if (removed === 0) {
    throw new EditError(`no rule${name ? ` \`${name}\`` : ''} on \`${field}\``);
  }
  file.validation = kept;
  return `${removed} rule${removed === 1 ? '' : 's'} removed from \`${field}\``;
}

/**
 * Задание делает поле обязательным: фраза с его именем «(address)» или подписью говорит
 * «обязател…». Пустой `add_rule` по такому полю — обязательность: модель слала `{"field":"address"}`
 * без проверки восемь раз и бросила путь (L3-delivery, 20261113T230859Z-f59e).
 */
function taskRequires(task: string | undefined, path: string, record: Rec | undefined): boolean {
  if (!task) return false;
  const lower = task.toLowerCase();
  const label = String(record?.label ?? '')
    .toLowerCase()
    .trim();
  const byName = lower.indexOf(`(${path.toLowerCase()}`);
  const at = byName >= 0 ? byName : label.length >= 3 ? lower.indexOf(label) : -1;
  if (at < 0) return false;
  const start = Math.max(lower.lastIndexOf('.', at), lower.lastIndexOf(';', at)) + 1;
  const ends = [lower.indexOf('.', at), lower.indexOf(';', at)].filter((i) => i >= 0);
  const sentence = lower.slice(start, ends.length > 0 ? Math.min(...ends) : lower.length);
  return /обязател|\brequired\b/.test(sentence) && !/не\s*обязател|\boptional\b/.test(sentence);
}

function addRule(file: Rec, given: Rec, ctx: EditContext): string {
  const field = text(given, 'field') ?? text(given, 'target', true)!;
  const arrayName = text(given, 'array') ?? text(given, 'each');
  let path = field;
  let record: Rec | undefined;
  if (arrayName) {
    const items = itemFieldsOf(requireArray(file, arrayName));
    const short = field.startsWith(`${arrayName}.`) ? field.slice(arrayName.length + 1) : field;
    record = items.find((item) => nameOf(item) === short);
    if (!record) {
      throw new EditError(
        `no field \`${short}\` in rows of \`${arrayName}\`${didYouMean(short, items.map(nameOf))}`
      );
    }
    path = `${arrayName}.${short}`;
  } else if (!findArray(file, field)) {
    record = requireField(file, field);
  }
  const { edit: mailed, note: emailNote } = emailFromPattern(given);
  const { edit: masked, note: patternNote } = patternFromMask(mailed, maskOf(record));
  const maskNote = `${emailNote}${patternNote}`;
  // min/max у текстового поля — его длина: число-валидатор на строке ломал сборку ошибкой типов, и
  // модель крутила пустые правки (L2-profile-json, 20261113T175937Z-a835).
  const textual = record !== undefined && (record.type === undefined || record.type === 'string');
  const lengths =
    textual && (masked.min !== undefined || masked.max !== undefined)
      ? {
          ...masked,
          min: undefined,
          max: undefined,
          ...(masked.min !== undefined && masked.minLength === undefined
            ? { minLength: masked.min }
            : {}),
          ...(masked.max !== undefined && masked.maxLength === undefined
            ? { maxLength: masked.max }
            : {}),
        }
      : masked;
  // Текст замечания в «rule» («Password must be at least 8 characters long.») рядом с проверками —
  // это «message»: отказ «not a validator call» уносил и сами проверки (L2-registration-lite,
  // 20261113T230859Z-f59e).
  const ruleText = text(lengths, 'rule')?.trim();
  const sentence =
    ruleText !== undefined &&
    /\s/.test(ruleText) &&
    !/^\w+\s*\(/.test(ruleText) &&
    !/^(\^|\/)|\\d|\$$/.test(ruleText) &&
    checksOf({ ...lengths, rule: undefined }, ctx).length > 0;
  const edit: Rec = sentence
    ? { ...lengths, rule: undefined, message: text(lengths, 'message') ?? ruleText }
    : lengths;
  const note = `${maskNote}${lengths !== masked ? ' (min/max of a text read as its length)' : ''}${sentence ? ' ("rule" text read as "message")' : ''}`;
  const row: Rec = { target: path };
  if (arrayName) row.each = arrayName;
  const when = conditionOf(text(edit, 'when'), file);
  if (when) row.when = when;
  const message = text(edit, 'message');
  const cross = crossOf(edit, path, file);
  if (cross) {
    row.cross = cross;
    row.code = text(edit, 'code') ?? `${path}.cross`;
    if (message) row.message = message;
    list(file, 'validation').push(row);
    return `cross rule on \`${path}\` added`;
  }
  const found = checksOf(edit, ctx);
  // Условие без проверки — обязательность на условии: «"when":"model.deliveryMethod === 'delivery'",
  // "message":"Адрес требуется при доставке"» без «required» отклонялось, и модель трижды теряла
  // правило (L3-delivery, 20261113T230859Z-f59e).
  const implied =
    found.length === 0 && (row.when !== undefined || taskRequires(ctx.task, path, record));
  const checks = implied ? ['required()'] : found;
  if (checks.length === 0) {
    throw new EditError(
      'no check: "required":true, "email":true, "min":N, "max":N, "minLength":N, "maxLength":N, "pattern":"…", "rule":"…" or "cross":"…"'
    );
  }
  row.rules = message
    ? checks.map((check) => withCode(check, `${path}.${ruleName(check)}`))
    : checks;
  if (message) row.message = message;
  // Та же проверка того же поля (и того же условия) заменяется, а не дописывается: иначе исправить
  // неудачную проверку нельзя — каждая попытка добавляла ещё одну, и ошибок сборки становилось больше.
  const names = new Set(checks.map(ruleName));
  let replaced = 0;
  const kept: Rec[] = [];
  for (const old of list(file, 'validation')) {
    // Условие не в счёт: правило с неудачным «when» иначе не заменить (L2-event-signup).
    const same = old.target === path && old.each === row.each;
    const oldRules = Array.isArray(old.rules) ? (old.rules as unknown[]) : [];
    if (!same || old.cross !== undefined || oldRules.length === 0) {
      kept.push(old);
      continue;
    }
    const rest = oldRules.filter((rule) => typeof rule !== 'string' || !names.has(ruleName(rule)));
    replaced += oldRules.length - rest.length;
    if (rest.length > 0) kept.push({ ...old, rules: rest });
  }
  const shown = row.when === undefined && !row.each ? shownWhen(file, path) : undefined;
  if (shown) row.when = shown;
  kept.push(row);
  file.validation = kept;
  return `rule on \`${path}\`: ${checks.map(ruleName).join(', ')}${implied ? (row.when !== undefined ? ' (a condition with no check read as "required" on it)' : ' (no check given — the task makes the field required)') : ''}${replaced ? ' (replaced the previous one)' : ''}${note}${shown ? ` (checked only while shown: ${shown})` : ''}`;
}

/**
 * Поля формулы — числа. Модель не писала «type":"number"» у цены и скидки: формула над строками
 * не собиралась, а «min/max» становились длиной (L3-order-total, 20261113T202828Z-32b0). Текстовое
 * поле без вариантов и маски, которое формула считает, становится числом, его длины — границами.
 */
function numbersOf(file: Rec, paths: readonly string[]): string[] {
  const promoted: string[] = [];
  for (const path of paths) {
    const field = findField(file, path);
    if (!field || (field.type !== undefined && field.type !== 'string')) continue;
    const props = isRecord(field.componentProps) ? field.componentProps : {};
    if (props.options !== undefined || props.mask !== undefined) continue;
    field.type = 'number';
    field.component = 'InputNumber';
    field.initialValue = null;
    const { type: _type, ...rest } = props;
    if (Object.keys(rest).length > 0) field.componentProps = rest;
    else delete field.componentProps;
    for (const row of list(file, 'validation')) {
      if (row.target !== path || !Array.isArray(row.rules)) continue;
      row.rules = (row.rules as unknown[]).map((rule) =>
        typeof rule === 'string' ? rule.replace(/^(\s*)(min|max)Length(\s*\()/, '$1$2$3') : rule
      );
    }
    promoted.push(path);
  }
  return promoted;
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
  const rawExpr = text(edit, 'expr');
  if (rawExpr && /<[^>]*\b(formula|task|field)\b[^>]*>/i.test(rawExpr)) {
    throw new EditError(
      '"expr" is the formula of the task written over model.<field> — the angle brackets are a placeholder'
    );
  }
  const expr = rawExpr && !arrayName ? withScope(rawExpr, file) : rawExpr;
  if (expr && !arrayName) rejectUnknownNames('expr', expr, file);
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
  const promoted =
    !arrayName && (kind === 'compute' || kind === 'computeFrom') && expr && /[*/+-]/.test(expr)
      ? numbersOf(file, [target, ...sources])
      : [];
  const row: Rec = { kind, target, sources };
  if (arrayName) row.each = arrayName;
  if (expr) row.expr = expr;
  const when = text(edit, 'when');
  if (when) row.when = arrayName ? when : withScope(when, file);
  if (edit.resetOnDisable === true) row.options = { resetOnDisable: true };
  // То же поведение того же поля заменяется: у поля одно вычисление. Три compute на одном поле
  // копились, и неудачное нельзя было исправить (L3-refund, 20261113T210742Z-5a45).
  const computes = new Set(['compute', 'computeFrom']);
  const rows = list(file, 'behavior');
  const kept = rows.filter(
    (old) =>
      !(
        old.target === target &&
        old.each === row.each &&
        (old.kind === kind || (computes.has(kind) && computes.has(String(old.kind))))
      )
  );
  const replaced = rows.length - kept.length;
  rows.splice(0, rows.length, ...kept, row);
  const note = promoted.length
    ? `; ${promoted.join(', ')} made numbers — the formula computes with them`
    : '';
  return `${kind} on \`${target}\`${sources.length ? ` reading ${sources.join(', ')}` : ''}${note}${replaced > 0 ? ' (replaced the previous one)' : ''}`;
}

/** Убрать поведения поля: все или одного вида (`kind`). */
function removeBehavior(file: Rec, edit: Rec): string {
  const target = text(edit, 'target') ?? text(edit, 'field') ?? text(edit, 'name', true)!;
  const kind = text(edit, 'kind');
  const rows = list(file, 'behavior');
  const kept = rows.filter(
    (row) => row.target !== target || (kind !== undefined && row.kind !== kind)
  );
  const removed = rows.length - kept.length;
  if (removed === 0) {
    const present = rows.map((row) => `${String(row.kind)} on ${String(row.target)}`);
    throw new EditError(
      `no behavior on \`${target}\`${kind ? ` of kind ${kind}` : ''} — the form has: ${present.join(', ') || 'none'}`
    );
  }
  rows.splice(0, rows.length, ...kept);
  return `${removed} behavior${removed === 1 ? '' : 's'} removed from \`${target}\``;
}

function addVisibility(file: Rec, edit: Rec, ctx: EditContext): string {
  if (ctx.target === 'core') {
    throw new EditError(
      'on core visibility is drawn by your JSX — use add_behavior "kind":"enableWhen" (the field is active only on the condition)'
    );
  }
  // Несколько полей с одним условием — модель писала «fields»: [...] (L3-delivery).
  const targets = names(edit, 'fields');
  // «"target":"address,deliveryDate"» — список полей через запятую.
  const fields = (
    targets.length > 0 ? targets : [text(edit, 'field') ?? text(edit, 'target', true)!]
  )
    .flatMap((field) => field.split(','))
    .map((field) => field.trim())
    .filter(Boolean);
  for (const field of fields) if (!findArray(file, field)) requireField(file, field);
  // Оба условия — берётся showWhen: модель писала их парой, взаимно обратными.
  const showGiven =
    text(edit, 'showWhen') ??
    (text(edit, 'hideWhen') ? undefined : (text(edit, 'condition') ?? text(edit, 'when')));
  const hideGiven = showGiven ? undefined : text(edit, 'hideWhen');
  if (!showGiven && !hideGiven)
    throw new EditError('give "showWhen" (or "hideWhen") — a condition over the form');
  const show = showGiven ? conditionOf(showGiven, file) : undefined;
  const hide = hideGiven ? conditionOf(hideGiven, file) : undefined;
  if (!show && !hide)
    throw new EditError('the condition is always true — no visibility rule needed');
  let gated = 0;
  for (const field of fields) {
    list(file, 'visibility').push({ selector: field, condition: hide ?? `!(${show})` });
    gated += rulesWhileShown(file, field, show ?? `!(${hide})`);
  }
  return `${fields.map((field) => `\`${field}\``).join(', ')} ${show ? `shown only when ${show}` : `hidden when ${hide}`}${gated ? `; its rules are checked only while shown` : ''}`;
}

function setForm(file: Rec, edit: Rec): string {
  const formName = text(edit, 'formName') ?? text(edit, 'name');
  if (!formName) throw new EditError('"formName" is required');
  file.formName = formName;
  return `form name — ${formName}`;
}

/** Ключи правки без пробелов и кавычек по краям: `" op"` → `op`. */
function trimmedKeys(edit: unknown): { edit: unknown; renamed: Array<[string, string]> } {
  if (!isRecord(edit)) return { edit, renamed: [] };
  const renamed: Array<[string, string]> = [];
  const out: Rec = {};
  for (const [key, value] of Object.entries(edit)) {
    const clean = key
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .trim();
    if (clean !== key) renamed.push([key, clean]);
    if (!(clean in out)) out[clean] = value;
  }
  return { edit: out, renamed };
}

/**
 * Применить правки к файлу intent. Правка применяется к копии и принимается целиком или не
 * принимается вовсе; отказ одной не отменяет другие.
 */
const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const camel = (name: string): string =>
  name.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
const NAME_KEYS = ['name', 'field', 'target', 'array', 'each', 'equals', 'sameAs', 'to'] as const;
const EXPR_KEYS = ['expr', 'when', 'cross', 'showWhen', 'hideWhen', 'condition'] as const;

/**
 * Имена snake_case — camelCase: модель называла поле `confirm_password`, и ни контракт, ни разметка
 * его не узнавали (L2-registration-lite, 20261113T230859Z-f59e). Читаются и ссылки на имя в ключах,
 * и идентификаторы в выражениях — вне кавычек.
 */
function camelNames(edit: unknown): { edit: unknown; renamed: string[] } {
  if (!isRecord(edit)) return { edit, renamed: [] };
  const renamed = new Set<string>();
  const out: Rec = { ...edit };
  const fix = (value: string): string => {
    if (!SNAKE.test(value)) return value;
    renamed.add(value);
    return camel(value);
  };
  for (const key of NAME_KEYS) {
    const value = out[key];
    if (typeof value === 'string') out[key] = value.split('.').map(fix).join('.');
  }
  if (Array.isArray(out.fields))
    out.fields = out.fields.map((value) => (typeof value === 'string' ? fix(value) : value));
  for (const key of EXPR_KEYS) {
    const value = out[key];
    if (typeof value !== 'string') continue;
    out[key] = value.replace(
      /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(?<![\w$])([a-z][a-z0-9]*(?:_[a-z0-9]+)+)(?![\w$])/g,
      (match: string, literal: string | undefined, id: string | undefined) =>
        literal || !id ? match : fix(id)
    );
  }
  return { edit: out, renamed: [...renamed] };
}

export function applyEdits(
  source: Record<string, unknown>,
  edits: unknown,
  ctx: EditContext
): AppliedEdits {
  let file = clone(source);
  const outcomes: EditOutcome[] = [];
  let markup = false;
  const items = Array.isArray(edits) ? edits : [];
  items.forEach((given, index) => {
    // Ключ с пробелом или кавычками (`" op"`) — тот же ключ: отказ «"op" is one of …» на правку с
    // верной операцией модель не понимала и повторяла её раз за разом (L1-login, 20261113T165319Z-ced3).
    const { edit: keyed, renamed } = trimmedKeys(given);
    const { edit: camelled, renamed: snakes } = camelNames(keyed);
    // «"when":true/false» — не условие: true — правило всегда, false модель ставила по ошибке; отказ
    // «"when" is a string» она повторяла раз за разом (L3-delivery, 20261113T230859Z-f59e).
    const flagWhen = isRecord(camelled) && typeof camelled.when === 'boolean';
    const edit = flagWhen ? { ...(camelled as Rec), when: undefined } : camelled;
    const op = isRecord(edit) && typeof edit.op === 'string' ? edit.op.trim() : '';
    const note = `${
      renamed.length
        ? `; keys read as ${renamed.map(([from, to]) => `${JSON.stringify(from)} → "${to}"`).join(', ')}`
        : ''
    }${snakes.length ? `; names read as camelCase: ${snakes.map((name) => `${name} → ${camel(name)}`).join(', ')}` : ''}${flagWhen ? '; "when" true/false is no condition — dropped' : ''}`;
    try {
      if (!isRecord(edit)) {
        throw new EditError(
          `an edit is an object {"op":…}, got ${JSON.stringify(edit)?.slice(0, 40) ?? String(edit)} — check the brackets: [{…}, {…}]`
        );
      }
      if (!op) {
        throw new EditError(
          `no "op" in this edit (keys: ${Object.keys(edit).join(', ') || 'none'}) — every edit starts with "op": one of ${EDIT_OPS.join(', ')}`
        );
      }
      if (!(EDIT_OPS as readonly string[]).includes(op)) {
        const guess = nearest(op, EDIT_OPS);
        throw new EditError(
          `"op":"${op}" is not an edit${guess ? ` — did you mean \`${guess}\`?` : ''} Edits: ${EDIT_OPS.join(', ')}.`
        );
      }
      if (op === 'markup') {
        if (ctx.target !== 'core') {
          throw new EditError(
            `on ${ctx.target} the build writes index.tsx itself — no markup needed`
          );
        }
        markup = true;
        outcomes.push({
          index,
          op,
          ok: true,
          message: `markup: the server writes index.tsx${note}`,
        });
        return;
      }
      const next = clone(file);
      const { edit: fieldEdit, note: maskNote } = withoutInventedMask(
        rulesFromOptions(edit),
        ctx,
        next
      );
      const message = (() => {
        switch (op as EditOp) {
          case 'add_field':
            return addField(next, fieldEdit, ctx);
          case 'set_field':
            return setField(next, fieldEdit, ctx);
          case 'remove_field':
            return removeField(next, edit, ctx);
          case 'rename_field':
            return renameField(next, edit);
          case 'rename_step':
            return renameStep(next, edit);
          case 'remove_step':
            return removeStep(next, edit);
          case 'add_array':
            return addArray(next, edit, ctx);
          case 'add_item_field':
            return addItemField(next, fieldEdit, ctx);
          case 'add_step':
            return addStep(next, edit);
          case 'place':
            return placeOp(next, edit);
          case 'add_rule':
            return addRule(next, edit, ctx);
          case 'remove_rule':
            return removeRule(next, edit);
          case 'remove_behavior':
            return removeBehavior(next, edit);
          case 'add_behavior':
            // «Показать при условии» — это видимость, а не поведение (L3-delivery).
            if (VISIBILITY_KINDS.has(String(edit.kind ?? '').toLowerCase())) {
              const condition = text(edit, 'condition') ?? text(edit, 'expr') ?? text(edit, 'when');
              const hides = /^hide/i.test(String(edit.kind));
              return addVisibility(
                next,
                {
                  ...edit,
                  ...(hides
                    ? { hideWhen: text(edit, 'hideWhen') ?? condition }
                    : { showWhen: text(edit, 'showWhen') ?? condition }),
                },
                ctx
              );
            }
            return addBehavior(next, edit);
          case 'add_visibility':
            return addVisibility(next, edit, ctx);
          default:
            return setForm(next, edit);
        }
      })();
      file = next;
      outcomes.push({ index, op, ok: true, message: `${message}${maskNote}${note}` });
    } catch (error) {
      if (!(error instanceof EditError)) throw error;
      outcomes.push({ index, op: op || '?', ok: false, message: error.message });
    }
  });
  nullSafeFormulas(file);
  return { file, outcomes, markup };
}

/**
 * Числовое поле формы начинается с null: формула «model.price * model.quantity» не проходит проверку
 * типов («possibly null»), а модель не понимала ошибку и девять раз меняла тип полей, не трогая
 * формулу (L3-order-total, 20261113T210742Z-5a45). Ссылки на числовые поля в формулах — с «?? 0».
 */
function nullSafeFormulas(file: Rec): void {
  const numbers = fieldsOf(file)
    .filter((field) => field.type === 'number')
    .map(nameOf)
    .filter(Boolean);
  if (numbers.length === 0) return;
  for (const row of list(file, 'behavior')) {
    if ((row.kind !== 'compute' && row.kind !== 'computeFrom') || typeof row.expr !== 'string')
      continue;
    let expr = row.expr;
    for (const name of numbers) {
      expr = expr.replace(
        new RegExp(`(?<![\\w$.(])model\\.${name}(?![\\w$])(?!\\s*\\?\\?)`, 'g'),
        `(model.${name} ?? 0)`
      );
    }
    row.expr = expr;
  }
}

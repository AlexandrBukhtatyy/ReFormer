/**
 * Печать правил формы в код: схема валидации (`buildValidationSchemaTs`) и поведение
 * (`buildBehaviorTs`) из записей intent. Чистые функции над строками — без диска и без знаний о
 * проекте: справочник операторов ядра приходит аргументом.
 */

import type {
  BehaviorIntent,
  DataSourceIntent,
  FieldIntent,
  FormIntent,
  ValidationRuleIntent,
} from './intent.js';
import { NO_CORE_OPERATORS, type CoreOperators } from './core-operators.js';
import { arrowBodyLines } from './locals.js';

const TS_TYPE: Record<string, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  date: 'Date | null',
  array: 'unknown[]',
  object: 'Record<string, unknown>',
};

/**
 * TS-тип поля с учётом начального значения.
 *
 * `null` в спеке — не опечатка, а штатное «пустое число»: валидаторы ядра (`min`, `max`, …)
 * объявлены как `TField extends number | null | undefined` и пустое значение пропускают,
 * обязательность даёт `required()`. Без расширения типа сгенерированный `model.ts` не
 * компилировался бы сам по себе: `initialFormModel` присваивал бы `null` полю `number`.
 */
export function fieldTsType(
  field: FieldIntent,
  optional: ReadonlySet<FieldIntent> = NONE,
  sources: readonly DataSourceIntent[] = NO_SOURCES
): string {
  const base = choiceTsType(field, sources) ?? baseTsType(field);
  if (field.initialValue !== null && !optional.has(field)) return base;
  return unionMembers(base).includes('null') ? base : `${base} | null`;
}

const NONE: ReadonlySet<FieldIntent> = new Set();
const NO_SOURCES: readonly DataSourceIntent[] = [];

function baseTsType(field: FieldIntent): string {
  return field.type === 'date' && !isDatePicker(field)
    ? 'string'
    : (TS_TYPE[field.type] ?? 'unknown');
}

/**
 * Значения статических вариантов поля выбора — строковыми литералами TS. Варианты лежат в самом
 * поле (`componentProps.options`) либо в справочнике intent (`optionsSource` → `dataSources`).
 * `null` — списка значений нет (варианты приходят с сервера) либо значение варианта — не строка.
 */
function optionLiterals(field: FieldIntent, sources: readonly DataSourceIntent[]): string[] | null {
  const inline = field.componentProps?.options;
  const given = Array.isArray(inline)
    ? inline
    : field.optionsSource !== undefined
      ? sources.find((source) => source.name === field.optionsSource)?.values
      : undefined;
  if (!Array.isArray(given) || given.length === 0) return null;
  const literals = new Set<string>();
  for (const option of given) {
    const value: unknown =
      option !== null && typeof option === 'object'
        ? (option as { value?: unknown }).value
        : option;
    if (typeof value !== 'string') return null;
    literals.add(tsString(value));
  }
  return [...literals];
}

/**
 * Тип поля выбора со статическими вариантами — объединение литералов их значений: опечатку в
 * условии (`model.customerType === 'persn'`) ловит `tsc`, а не пользователь формы. Мультивыбор —
 * массив такого объединения, а не `unknown[]`.
 *
 * Начальное значение вне вариантов (пустая строка «ничего не выбрано») — тоже значение поля, оно
 * входит в тип первым. `null` — вариантов списком нет, и тип остаётся общим.
 */
function choiceTsType(field: FieldIntent, sources: readonly DataSourceIntent[]): string | null {
  if (field.type !== 'string' && field.type !== 'array') return null;
  const literals = optionLiterals(field, sources);
  if (literals === null) return null;
  if (field.type === 'array') {
    const initial = field.initialValue ?? [];
    const known =
      Array.isArray(initial) &&
      initial.every((value) => typeof value === 'string' && literals.includes(tsString(value)));
    return known ? `Array<${literals.join(' | ')}>` : null;
  }
  const initial = field.initialValue === undefined ? '' : field.initialValue;
  if (initial === null) return literals.join(' | ');
  if (typeof initial !== 'string') return null;
  const own = tsString(initial);
  return (literals.includes(own) ? literals : [own, ...literals]).join(' | ');
}

/**
 * Поле выбора, которое компонент не опустошает: радиогруппа и список без крестика сброса
 * (`clearable`) пишут в модель только значение варианта — `null` от них не приходит.
 */
function keepsChoice(field: FieldIntent): boolean {
  if (/^RadioGroup/.test(field.component)) return true;
  return /^Select(?:Async)?$/.test(field.component) && field.componentProps?.clearable !== true;
}

/**
 * Члены объединения типов верхнего уровня: `'a' | 'b' | null` → три члена, `Array<'a' | 'b'>` —
 * один. Черта внутри кавычек и скобок член не делит.
 */
export function unionMembers(type: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < type.length; index++) {
    const char = type[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
    } else if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '<' || char === '(' || char === '[' || char === '{') depth++;
    else if (char === '>' || char === ')' || char === ']' || char === '}') depth--;
    else if (char === '|' && depth === 0) {
      members.push(type.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(type.slice(start).trim());
  return members.filter(Boolean);
}

/**
 * Текстовые поля без безусловного `required()` — `string | null` в модели, по конвенции ядра
 * (`08-form-types.md`: необязательное поле — `null`, «пользователь очистил»). Текстовые
 * компоненты кита пустой ввод так и пишут: `e.target.value || null`. С типом `string` агент писал
 * `model.promo.trim()`, `tsc` молчал, а стёртый промокод ронял шаг (ReFormer-b464). Обязательное
 * поле остаётся `string`: пустым его не пропускает валидация.
 */
export function optionalText(intent: FormIntent): Set<FieldIntent> {
  const required = new Set(
    intent.validation
      .filter((v) => v.when === undefined && v.rules.some((rule) => /^required\b/.test(rule)))
      .map((v) => (v.each ? `${v.each}[].${rowPath(v.target, v.each)}` : v.target))
  );
  const out = new Set<FieldIntent>();
  // Поле выбора со списком вариантов, которое компонент не опустошает, — не «текст»: `null` в его
  // типе означал бы значение, которого в поле не бывает.
  const text = (f: FieldIntent) =>
    baseTsType(f) === 'string' && !(keepsChoice(f) && choiceTsType(f, intent.dataSources) !== null);
  for (const f of intent.fields) {
    if (text(f) && !required.has(f.modelPath ?? f.name)) out.add(f);
  }
  for (const a of intent.arrays) {
    for (const f of a.itemFields) {
      if (text(f) && !required.has(`${a.name}[].${f.modelPath ?? f.name}`)) out.add(f);
    }
  }
  return out;
}

/**
 * Дата под календарём кита (`DatePicker`, значение — `Date`) или под полем ввода (`Input` с
 * `type: 'date'`, значение — строка `YYYY-MM-DD`). Тип модели обязан совпасть со значением
 * компонента: прежний `Date | null` для любой даты при начальном `''` из спеки давал `model.ts`,
 * который не компилируется (`Type 'string' is not assignable to type 'Date'`).
 */
function isDatePicker(field: FieldIntent): boolean {
  return /DatePicker/.test(field.component);
}

/** Литерал начального значения по типу поля. */
export function initialLiteral(field: FieldIntent): string {
  if (field.type === 'date' && isDatePicker(field) && typeof field.initialValue === 'string') {
    // Пустая строка у календаря — «даты нет»; непустая — дата, которую надо построить.
    return field.initialValue === '' ? 'null' : `new Date(${JSON.stringify(field.initialValue)})`;
  }
  if (field.initialValue !== undefined) return JSON.stringify(field.initialValue);
  switch (field.type) {
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'date':
      return isDatePicker(field) ? 'null' : "''";
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return "''";
  }
}

// ---------------------------------------------------------------------------
// form.validation.ts
// ---------------------------------------------------------------------------

/** Какие валидаторы реально использованы — импортируем ровно их. */
/**
 * Имя валидатора → его ВЫЗОВ.
 *
 * `@reformer/core/validators` экспортирует фабрики: `required` — функция, создающая правило,
 * а не само правило. Контракт `ValidationRuleIntent.rules` допускает обе записи (`required` и
 * `minLength(2)`), и раньше первая уходила в код как есть — то есть в `validate(…, [required])`,
 * который не компилируется. Путь «спека → бандл» этого не показывал: анализатор спек всегда
 * пишет со скобками. Показал агент, для которого `required` — самая естественная запись.
 *
 * Имя константы модуля (`constants`, см. {@link hoistRuleConstants}) — уже готовое правило, а не
 * фабрика: оно печатается как есть.
 */
function callValidator(rule: string, constants: ReadonlySet<string> = NO_NAMES): string {
  const trimmed = rule.trim();
  return /[()]/.test(trimmed) || constants.has(trimmed) ? trimmed : `${trimmed}()`;
}

const NO_NAMES: ReadonlySet<string> = new Set();

/** Имя фабрики правила: `minLength(2)` → `minLength`. */
export function ruleName(rule: string): string | null {
  return rule.trim().match(/^([A-Za-z_$][\w$]*)/)?.[1] ?? null;
}

/**
 * Валидаторы ядра, которые вызывают правила. Свои правила (`operators`) импортируются из своего
 * модуля, а не из `@reformer/core/validators`: раньше любое имя уходило в импорт ядра, и правило,
 * которого в ядре нет, давало только ошибку компилятора.
 *
 * Без индекса ядра (`core.found === false`) сверять не с чем: любое имя, не объявленное в
 * `operators`, импортируется из ядра, а несуществующее назовёт компилятор.
 */
function collectValidators(
  rules: readonly ValidationRuleIntent[],
  operators: Readonly<Record<string, string>> = {},
  core: CoreOperators = NO_CORE_OPERATORS,
  constants: ReadonlySet<string> = NO_NAMES
): string[] {
  const used = new Set<string>();
  for (const rule of rules) {
    for (const r of rule.rules) {
      const name = ruleName(r);
      if (name === null || Object.hasOwn(operators, name) || constants.has(r.trim())) continue;
      if (!core.found || core.rules.has(name)) used.add(name);
    }
  }
  return [...used].sort();
}

/**
 * Код ссылается на имя `name` — само по себе, а не на свойство `model.name`: вызов своего оператора
 * или схема, переданная аргументом (`validateModel(model, passwordRules)`).
 */
export function mentionsName(code: string, name: string): boolean {
  return new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(code);
}

/**
 * Импорты своих операторов, на которые ссылается код файла: по строке `import { … } from '<модуль>'`
 * на модуль. Импортируется только нужное — проекты собираются с `noUnusedLocals`.
 */
export function operatorImportLines(
  operators: Readonly<Record<string, string>> | undefined,
  code: readonly string[]
): string[] {
  const byModule = new Map<string, string[]>();
  for (const [name, module] of Object.entries(operators ?? {})) {
    if (!code.some((part) => mentionsName(part, name))) continue;
    byModule.set(module, [...(byModule.get(module) ?? []), name]);
  }
  return [...byModule].map(
    ([module, names]) => `import { ${names.sort().join(', ')} } from '${module}';`
  );
}

/** Код правил, в котором могут встретиться вызовы своих операторов. */
export function validationCode(rules: readonly ValidationRuleIntent[]): string[] {
  return rules.flatMap((rule) => [
    ...rule.rules,
    ...[rule.call, rule.cross, rule.async, rule.when].filter((part): part is string => !!part),
    ...Object.values(rule.params ?? {}),
  ]);
}

/** Параметры `buildValidationSchemaTs`: всё, что модуль берёт не из правил. */
export interface ValidationSchemaTsOptions {
  /** Тип модели — параметр `defineValidation<…>`. */
  interfaceName: string;
  /** Имя экспортируемой константы схемы (`formValidation`, `stepValidation`, …). */
  exportName: string;
  /**
   * Откуда импортировать тип модели — спецификатор модуля как есть (`'./model'`, `'../../types'`).
   * Раскладка файлов — решение потребителя: MCP держит тип в `model.ts`, билдер — в `types.ts`,
   * а файл шага лежит двумя каталогами глубже корня.
   */
  typeImport: string;
  /**
   * Текст JSDoc-шапки модуля — строки без `/**`, ` * ` и `*\/`; перевод строки делит строки.
   * Без него модуль печатается без шапки.
   */
  header?: string;
  /**
   * Свои операторы, которые могут вызывать правила: имя → спецификатор модуля, как его импортирует
   * этот файл (`FormIntent.operators` у файла в корне модуля).
   */
  operators?: Readonly<Record<string, string>>;
  /**
   * Операторы ядра из его индекса: какие имена правил — валидаторы `@reformer/core/validators`.
   * Без них импортируется из ядра любое имя, не объявленное в `operators`.
   */
  core?: CoreOperators;
  /**
   * Тип значения поля правила так, как его называет модуль (`Order['total']`). С ним проверка
   * своего поля и асинхронное правило-стрелка печатаются константами модуля над схемой
   * ({@link hoistRuleConstants}); без него — в теле схемы, как раньше.
   */
  valueType?: (rule: ValidationRuleIntent) => string | null;
}

/**
 * Валидаторы и операторы, которые реально нужны набору правил.
 *
 * Импортируется только использованное: проекты собираются с `noUnusedLocals`, и лишний импорт
 * «на всякий случай» не даст форме скомпилироваться. Поэтому набор считается по ТОМУ
 * подмножеству правил, которое печатается в модуль, — у файла шага он свой.
 */
export function validationImports(
  rules: readonly ValidationRuleIntent[],
  operators: Readonly<Record<string, string>> | undefined,
  core: CoreOperators,
  /**
   * Константы модуля, в которые вынесены правила ({@link hoistRuleConstants}): их имена в списках
   * проверок — не валидаторы ядра, а код их объявлений тоже может звать свои операторы.
   */
  constants: readonly RuleConstant[] = []
): {
  ops: string[];
  validators: string[];
  /** Импорты своих операторов — готовыми строками. */
  custom: string[];
  /** Типы правил ядра, которыми объявлены константы модуля: `Rule`, `AsyncRule`. */
  types: string[];
} {
  // `validate` нужен правилам с валидаторами; набор из одних кросс-полевых и асинхронных проверок
  // его не зовёт. Пустой набор оставляет его: заготовка предлагает дописать правила им.
  const usesValidate = rules.length === 0 || rules.some((r) => r.rules.length > 0);
  const ops = usesValidate ? ['validate', 'defineValidation'] : ['defineValidation'];
  if (rules.some((r) => r.async)) ops.push('validateAsync');
  if (rules.some((r) => r.when)) ops.push('validateWhen');
  if (rules.some((r) => r.each)) ops.push('applyEach');
  const names = new Set(constants.map((constant) => constant.name));
  return {
    ops,
    validators: collectValidators(rules, operators, core, names),
    custom: operatorImportLines(operators, [
      ...validationCode(rules),
      ...constants.flatMap((constant) => constant.lines),
    ]),
    types: [...new Set(constants.map((constant) => constant.type))].sort(),
  };
}

/** Код замечания кросс-полевой проверки, если правило его не назвало. */
export const DEFAULT_CROSS_CODE = 'cross';

/** Строковый литерал TS в одинарных кавычках. */
export function tsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

/** Литерал замечания проверки: код, важность и параметры текста. */
function issueLiteral(
  rule: ValidationRuleIntent,
  params: Readonly<Record<string, string>> | undefined = rule.params
): string {
  const code = (rule.code ?? DEFAULT_CROSS_CODE).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // Предупреждение и параметры замечания — те же поля `ValidationIssue`, что у валидаторов ядра
  // (калибровка кредитной заявки, A13 и A15: без них предупреждения становились ошибками, а
  // тексты — без чисел).
  const entries = Object.entries(params ?? {}).map(
    ([name, expr]) => `${/^[A-Za-z_$][\w$]*$/.test(name) ? name : tsString(name)}: ${expr}`
  );
  const issue = [
    `code: '${code}'`,
    ...(rule.severity === 'warning' ? ["severity: 'warning'"] : []),
    ...(entries.length > 0 ? [`params: { ${entries.join(', ')} }`] : []),
  ];
  return `{ ${issue.join(', ')} }`;
}

/**
 * Проверка между полями. Выражение с константами (`./locals`) печатается блоком: строки `const`
 * и `return` — подвыражение, которое проверка читает несколько раз, записано один раз.
 */
function crossLines(ref: string, rule: ValidationRuleIntent): string[] {
  const issue = issueLiteral(rule);
  // Тело — тернарный оператор без скобок вокруг: их ставит форматтер (prettier и печать
  // конструктора) — в строку со скобками, при переносе тела без них. Условие — в скобках, только
  // когда без них смысл другой.
  const body = arrowBodyLines(
    rule.cross ?? 'true',
    (result) => `${conditionTest(result)} ? null : ${issue}`
  );
  if (body.length === 1) return [`cross(${ref}, (values) => ${body[0]});`];
  return [`cross(${ref}, (values) => ${body[0]}`, ...body.slice(1, -1), '});'];
}

// ---------------------------------------------------------------------------
// Правила-константы модуля
// ---------------------------------------------------------------------------

/** Правило, вынесенное из схемы в константу модуля. */
export interface RuleConstant {
  name: string;
  /** Тип правила ядра: синхронное `Rule` или асинхронное `AsyncRule`. */
  type: 'Rule' | 'AsyncRule';
  /** Строки объявления — над схемами модуля. */
  lines: string[];
}

/** Параметры {@link hoistRuleConstants}. */
export interface HoistRuleOptions {
  /**
   * Тип значения поля правила — так, как его называет модуль: `Order['company']['inn']`. `null` —
   * тип назвать нечем, и правило остаётся в схеме как было.
   */
  valueType: (rule: ValidationRuleIntent) => string | null;
  /** Занятые идентификаторы модуля: имена констант их обходят и добавляются сюда же. */
  taken: Set<string>;
}

/** Чтение области схемы: снимок `values`, модель или строка массива. */
const SCOPE_READ = /(?<![\w$.])(?:values|model|item)(?![\w$])/;

/**
 * Выражение проверки над значением СВОЕГО поля: `values.total <= 100000` → `value <= 100000`.
 * `null` — выражение поля не читает, читает и другие поля либо само занимает имя `value`.
 */
function ownValueExpression(expr: string, path: string): string | null {
  if (/(?<![\w$.])value(?![\w$])/.test(expr)) return null;
  const read = new RegExp(
    `(?<![\\w$.])values\\.${path.replace(/[.$]/g, (char) => `\\${char}`)}(?![\\w$])`,
    'g'
  );
  const own = expr.replace(read, 'value');
  return own === expr || SCOPE_READ.test(own) ? null : own;
}

/** Идентификатор константы из кода замечания: `inn.checksum` → `innChecksumRule`. */
function constantName(source: string, taken: Set<string>): string {
  const words = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const camel = words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : capitalize(word)
    )
    .join('');
  const base = `${/^[A-Za-z_$]/.test(camel) ? camel : `field${capitalize(camel)}`}Rule`;
  let name = base;
  for (let index = 2; taken.has(name); index++) name = `${base}${index}`;
  taken.add(name);
  return name;
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Условие перед `? null : …` — в скобках, только когда без них смысл другой: условие само
 * тернарное, стрелка, запятая или присваивание. Лишние скобки prettier снимает, и код,
 * напечатанный без форматтера (кодоген конструктора), разошёлся бы с ним.
 */
function conditionTest(expr: string): string {
  return /=>|,|(?<!\?)\?(?![.?])|(?<![=!<>])=(?![=>])/.test(expr) ? `(${expr})` : expr;
}

/**
 * Объявление правила поля — одним оператором: `(value) => (условие ? null : замечание)`.
 * Выражение с константами (`./locals`) — блоком со строками `const` и `return`.
 */
function ruleConstantLines(name: string, type: string, expr: string, issue: string): string[] {
  const head = `const ${name}: Rule<${type}> = (value) =>`;
  const body = arrowBodyLines(expr, (result) => `${conditionTest(result)} ? null : ${issue}`);
  if (body.length === 1) return [`${head} (${body[0]});`];
  return [`${head} ${body[0]}`, ...body.slice(1, -1), '};'];
}

/**
 * Вынести из схемы в константы модуля правила, которым место там, а не в теле схемы.
 *
 * - Проверка выражением, которая читает только СВОЁ поле (`values.total <= 100000` у `total`), —
 *   обычное правило поля `Rule`: оно встаёт в список `validate` рядом с валидаторами, а не вторым
 *   оператором `cross` на то же поле. `cross` остаётся проверкам, которые читают другие поля.
 * - Асинхронное правило-стрелка — `AsyncRule`: ядро помнит ответ правила по ссылке на него, и
 *   стрелка, записанная в теле схемы, — новая ссылка на каждом прогоне: живая проверка звала бы её
 *   заново при вводе в любое поле. Ссылка на готовую функцию остаётся как есть.
 *
 * Возвращает правила, где вынесенное заменено именем константы, и сами константы. Печать тела —
 * {@link validationRuleParts} с именами констант: имя в списке проверок — не фабрика, скобки ему
 * не дописываются.
 */
export function hoistRuleConstants(
  rules: readonly ValidationRuleIntent[],
  options: HoistRuleOptions
): { rules: ValidationRuleIntent[]; constants: RuleConstant[] } {
  const constants: RuleConstant[] = [];
  const out = rules.map((rule): ValidationRuleIntent => {
    const type = options.valueType(rule);
    if (type === null) return rule;
    const path = rowTarget(rule);
    const label = rule.each !== undefined ? `${rule.each}.${path}` : path;
    let next = rule;

    if (rule.cross) {
      const expr = ownValueExpression(rule.cross, path);
      const params: Record<string, string> = {};
      // Параметр текста, который поля не читает, — константа: он переносится как есть.
      const portable = Object.entries(rule.params ?? {}).every(([name, value]) => {
        const own = SCOPE_READ.test(value) ? ownValueExpression(value, path) : value;
        if (own !== null) params[name] = own;
        return own !== null;
      });
      if (expr !== null && portable) {
        const name = constantName(rule.code ?? `${label}.check`, options.taken);
        constants.push({
          name,
          type: 'Rule',
          lines: [
            `/** Проверка поля \`${label}\`: читает только его значение. */`,
            ...ruleConstantLines(name, type, expr, issueLiteral(rule, params)),
          ],
        });
        next = { ...next, rules: [...next.rules, name] };
        delete next.cross;
        delete next.params;
      }
    }

    const asyncRule = rule.async?.trim();
    if (
      asyncRule &&
      !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(asyncRule) &&
      !/(?<![\w$.])(?:model|item|cross|values)(?![\w$])/.test(asyncRule)
    ) {
      const name = constantName(rule.code ?? `${label}.async`, options.taken);
      constants.push({
        name,
        type: 'AsyncRule',
        lines: [
          `/** Асинхронная проверка поля \`${label}\`. Константа модуля: ядро помнит ответ по ссылке на правило. */`,
          `const ${name}: AsyncRule<${type}> = ${asyncRule.replace(/;\s*$/, '')};`,
        ],
      });
      next = { ...next, async: name };
    }
    return next;
  });
  return { rules: out, constants };
}

/**
 * Константы в порядке первого упоминания в теле схемы: читатель кода возвращает правила в порядке
 * операторов схемы, и печать прочитанного обязана положить константы туда же, куда первая печать.
 */
export function inOrderOfUse(
  constants: readonly RuleConstant[],
  body: readonly string[]
): RuleConstant[] {
  const text = body.join('\n');
  const at = (name: string) =>
    text.search(new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`));
  return [...constants].sort((a, b) => at(a.name) - at(b.name));
}

/**
 * Параметры схемы валидации: `cross` — только когда им пользуется правило верхнего уровня. Лишний
 * параметр — неиспользованная переменная, а проекты собираются с `noUnusedLocals`.
 */
export function schemaParams(rules: readonly ValidationRuleIntent[]): string {
  return rules.some((rule) => rule.cross && !rule.each) ? '{ model, cross }' : '{ model }';
}

/** Строки, вложенные в блок `head … });` с отступом в два пробела. */
function wrapBlock(head: string, lines: readonly string[]): string[] {
  return [head, ...lines.map((line) => `  ${line}`), '});'];
}

/**
 * Цель правила так, как её адресует схема. Правило строки адресует поле ЭЛЕМЕНТА: цель пишут и от
 * строки (`name`), и полным путём (`items.name`) — второе дало бы `item.$.items.name`, которого у
 * строки нет.
 */
function rowTarget(rule: ValidationRuleIntent): string {
  const each = rule.each;
  return each !== undefined && rule.target.startsWith(`${each}.`)
    ? rule.target.slice(each.length + 1)
    : rule.target;
}

/**
 * Проверки одного поля — одним `validate`.
 *
 * Строка intent несёт один код и один текст, поэтому две проверки поля со своими текстами — две
 * строки с одним `target`. Раньше каждая печаталась своим `validate(model.$.price, […])`, и правка
 * «добавь полю проверку» давала второй оператор рядом с первым, а не валидатор в его списке.
 * Теперь проверки строк с тем же полем, массивом `each` и условием `when` уходят в список первой
 * из них; повтор той же проверки отбрасывается. Строка, у которой кроме проверок ничего не было,
 * исчезает, а её `async`, `cross` и `call` печатаются на своём месте.
 *
 * Только печать: тексты замечаний словарь берёт из строк intent, как они записаны.
 */
export function mergeFieldChecks(rules: readonly ValidationRuleIntent[]): ValidationRuleIntent[] {
  const holders = new Map<string, ValidationRuleIntent>();
  const out: ValidationRuleIntent[] = [];
  const add = (checks: string[], extra: readonly string[]) => {
    for (const check of extra) {
      const call = callValidator(check);
      if (!checks.some((have) => callValidator(have) === call)) checks.push(check);
    }
  };
  for (const rule of rules) {
    if (rule.rules.length === 0) {
      out.push(rule);
      continue;
    }
    const key = JSON.stringify([rule.each ?? '', rule.when?.trim() ?? '', rowTarget(rule)]);
    const holder = holders.get(key);
    if (holder === undefined) {
      const own = { ...rule, rules: [] as string[] };
      add(own.rules, rule.rules);
      holders.set(key, own);
      out.push(own);
      continue;
    }
    add(holder.rules, rule.rules);
    if (rule.async || rule.cross || rule.call) out.push({ ...rule, rules: [] });
  }
  return out;
}

/**
 * Одно правило intent → строки тела схемы (с отступом тела).
 *
 * Обёртки вкладываются снаружи внутрь: условие → строки массива → проверки. Условие `when`
 * записано над КОРНЕВОЙ моделью, поэтому у правила строки оно оборачивает саму привязку
 * `applyEach`, а не проверки внутри строки, — так же, как у схемы строки ({@link applyRowSchema}).
 * Раньше ветка строки собирала блок заново из проверок, и условие терялось: правило становилось
 * безусловным, а импорт `validateWhen` оставался неиспользованным (`noUnusedLocals`).
 */
export function validationRuleBlock(rule: ValidationRuleIntent): string {
  return schemaBody([validationRulePart(rule)]).join('\n');
}

/**
 * Часть тела схемы: строки кода (без отступа тела) и условие, под которым они действуют. Условие
 * в строки не входит — обёртку `validateWhen` ставит {@link schemaBody}, одну на все части с этим
 * условием.
 */
export interface SchemaPart {
  when?: string;
  lines: string[];
}

/** Одно правило intent → часть тела схемы. `constants` — имена констант-правил модуля. */
export function validationRulePart(
  rule: ValidationRuleIntent,
  constants: ReadonlySet<string> = NO_NAMES
): SchemaPart {
  const each = rule.each;
  const target = rowTarget(rule);
  const ref = each !== undefined ? `item.$.${target}` : `model.$.${target}`;

  let lines: string[] = [];
  if (rule.rules.length > 0) {
    const checks = rule.rules.map((check) => callValidator(check, constants));
    lines.push(`validate(${ref}, [${checks.join(', ')}]);`);
  }
  if (rule.async) {
    lines.push(`validateAsync(${ref}, [${rule.async}]);`);
  }
  if (rule.cross) lines.push(...crossLines(ref, rule));
  // Свой оператор валидации — вызов как есть: что и как он проверяет, знает только он.
  if (rule.call) lines.push(`${rule.call.replace(/;\s*$/, '')};`);
  if (each !== undefined) {
    // Правила строки — схема над элементом, записанная на месте: `applyEach` отдаёт ей под-модель
    // и свой `cross` — над снимком строки.
    const params = rule.cross ? '{ model: item, cross }' : '{ model: item }';
    lines = wrapBlock(`applyEach(model.$.${each}, (${params}) => {`, lines);
  }
  const when = rule.when?.trim();
  return when ? { when, lines } : { lines };
}

/** Правила набора → части тела схемы: проверки одного поля слиты ({@link mergeFieldChecks}). */
export function validationRuleParts(
  rules: readonly ValidationRuleIntent[],
  constants: ReadonlySet<string> = NO_NAMES
): SchemaPart[] {
  return mergeFieldChecks(rules).map((rule) => validationRulePart(rule, constants));
}

/**
 * Тело схемы из частей — блоками с отступом тела.
 *
 * Части с одним условием — один `validateWhen` на месте первой из них: `validateWhen` принимает
 * колбэк с любым числом операторов, а условие, повторённое на каждое поле раздела, читается хуже
 * одного блока «при этом условии проверяется вот что». Раньше форма заказа печатала 15 блоков при
 * шести разных условиях. Условия сравниваются текстом.
 */
export function schemaBody(parts: readonly SchemaPart[]): string[] {
  const groups = new Map<string, string[]>();
  const order: (string[] | { when: string })[] = [];
  for (const part of parts) {
    if (part.when === undefined) {
      order.push(part.lines);
      continue;
    }
    const group = groups.get(part.when);
    if (group !== undefined) {
      group.push(...part.lines);
      continue;
    }
    groups.set(part.when, [...part.lines]);
    order.push({ when: part.when });
  }
  return order.map((entry) => {
    const lines = Array.isArray(entry)
      ? entry
      : wrapBlock(`validateWhen(() => ${entry.when}, () => {`, groups.get(entry.when) ?? []);
    return lines.map((line) => `  ${line}`).join('\n');
  });
}

/**
 * Модуль с ОДНОЙ схемой валидации для заданного подмножества правил.
 *
 * Зачем отдельно от `buildValidationTs`. Билдер раскладывает правила визарда по шагам
 * (`steps/<slug>/form.validation.ts` — правила полей шага, корневой `form.validation.ts` — межшаговые),
 * и каждому файлу нужен свой полноценный модуль: свои импорты ровно под свои правила, своё имя
 * экспорта, свой путь до типа модели. Второй эмиттер правил в билдере разошёлся бы с этим на
 * первой же правке — поэтому печать тела живёт здесь одна, а `buildValidationTs` — обёртка над ней.
 *
 * Печатает `import …` + `export const <exportName> = defineValidation<…>(…)` и ничего
 * сверх: сборка корня (`apply(...)`, `makeStepCheck`) — дело потребителя.
 *
 * @example
 * buildValidationSchemaTs([{ target: 'email', rules: ['required', 'email()'] }], {
 *   interfaceName: 'Contacts',
 *   exportName: 'stepValidation',
 *   typeImport: '../../types',
 * });
 */
export function buildValidationSchemaTs(
  rules: readonly ValidationRuleIntent[],
  opts: ValidationSchemaTsOptions
): string {
  const hoisted =
    opts.valueType === undefined
      ? { rules: [...rules], constants: [] }
      : hoistRuleConstants(rules, {
          valueType: opts.valueType,
          taken: new Set([
            'model',
            'cross',
            'item',
            opts.exportName,
            opts.interfaceName,
            ...Object.keys(opts.operators ?? {}),
            ...rules.flatMap((rule) => rule.rules.flatMap((check) => ruleName(check) ?? [])),
          ]),
        });
  const constantNames = new Set(hoisted.constants.map((constant) => constant.name));
  const { ops, validators, custom, types } = validationImports(
    hoisted.rules,
    opts.operators,
    opts.core ?? NO_CORE_OPERATORS,
    hoisted.constants
  );

  const lines: string[] = [];
  if (opts.header !== undefined) {
    lines.push('/**');
    for (const line of opts.header.split('\n')) lines.push(line ? ` * ${line}` : ' *');
    lines.push(' */');
  }
  lines.push(`import { ${ops.join(', ')} } from '@reformer/core/validation';`);
  if (types.length > 0) {
    lines.push(`import type { ${types.join(', ')} } from '@reformer/core/validation';`);
  }
  if (validators.length > 0) {
    lines.push(`import { ${validators.join(', ')} } from '@reformer/core/validators';`);
  }
  lines.push(...custom);
  lines.push(`import type { ${opts.interfaceName} } from '${opts.typeImport}';`);
  lines.push('');
  const body = schemaBody(validationRuleParts(hoisted.rules, constantNames));
  for (const constant of inOrderOfUse(hoisted.constants, body)) lines.push(...constant.lines, '');
  lines.push(
    `export const ${opts.exportName} = defineValidation<${opts.interfaceName}>((${schemaParams(hoisted.rules)}) => {`
  );

  if (rules.length === 0) {
    lines.push('  // Правил в intent не было — добавьте их здесь.');
  }
  lines.push(...body);

  lines.push('});');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// behavior.ts
// ---------------------------------------------------------------------------

/**
 * Имена параметров колбэка `computeFrom` из путей источников.
 *
 * Путь `personal.lastName` идентификатором не является: подставленный в список параметров как
 * есть, он давал `(personal.lastName) => …` — файл не парсится вовсе. Составные пути в intent —
 * норма (целые разделы спек записаны ими), а через `path` их присылает и модель, поэтому имя
 * берётся по последнему сегменту; совпадения разводятся индексом.
 */
function callbackParams(sources: readonly string[]): { params: string[]; renamed: string[] } {
  const used = new Set<string>();
  const params: string[] = [];
  const renamed: string[] = [];
  for (const source of sources) {
    const base = (source.split('.').pop() ?? source).replace(/[^A-Za-z0-9_$]/g, '') || 'value';
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}${i}`;
    used.add(name);
    params.push(name);
    if (name !== source) renamed.push(`${source} → ${name}`);
  }
  return { params, renamed };
}

/**
 * Опции `resetWhen`. Без `resetValue` ядро сбрасывает поле в `null`, и для поля, в тип которого
 * `null` не входит, `resetValue` обязателен по типу (ReFormer-2183): без него сгенерированный
 * файл не компилировался бы. Такому полю генератор подставляет его начальное значение.
 */
function resetWhenOptions(b: BehaviorIntent, intent: FormIntent): string {
  const json = b.options ? JSON.stringify(b.options) : undefined;
  const field = intent.fields.find(
    (f) => (f.modelPath ?? f.name) === b.target || f.name === b.target
  );
  const given = b.options !== undefined && 'resetValue' in b.options;
  if (
    field === undefined ||
    given ||
    unionMembers(fieldTsType(field, optionalText(intent), intent.dataSources)).includes('null')
  ) {
    return json ? `, ${json}` : '';
  }
  const resetValue = `resetValue: ${initialLiteral(field)}`;
  return json && json !== '{}' ? `, ${json.slice(0, -1)}, ${resetValue} }` : `, { ${resetValue} }`;
}

/**
 * Условие вычисления: `, { when: () => … }`. Выражение читает модель, как и формула; у
 * `computeFrom` условие без параметров — ядро принимает и такую функцию.
 */
function computeWhen(b: BehaviorIntent): string {
  return b.when ? `, { when: () => ${b.when} }` : '';
}

/** Путь поля строки — от строки: `items.qty` при `each: 'items'` → `qty`. */
export function rowPath(path: string, each: string): string {
  return path.startsWith(`${each}.`) ? path.slice(each.length + 1) : path;
}

/**
 * Поведение каждой строки печатается внутри `applyEach`: ручки — от строки (`item.$.qty`), а
 * колбэк строки объявляет `item`. `exclusiveFlag` и `aggregateInto` — операторы над массивом
 * целиком и в `applyEach` не заворачиваются.
 */
function isRowBehavior(b: BehaviorIntent): b is BehaviorIntent & { each: string } {
  return b.each !== undefined && b.kind !== 'exclusiveFlag' && b.kind !== 'aggregateInto';
}

/**
 * Строки тела поведения: связи формы — по одной, связи строк одного массива — одним `applyEach`
 * на месте первой из них.
 */
export function renderBehaviors(intent: FormIntent): string[] {
  // Элемент — строка связи формы либо группа связей строк одного массива (на месте первой).
  const parts: (string | { each: string; items: BehaviorIntent[] })[] = [];
  const groups = new Map<string, { each: string; items: BehaviorIntent[] }>();
  for (const b of intent.behavior) {
    if (!isRowBehavior(b)) {
      parts.push(renderBehavior(b, intent));
      continue;
    }
    const group = groups.get(b.each);
    if (group !== undefined) {
      group.items.push(b);
      continue;
    }
    const created = { each: b.each, items: [b] };
    groups.set(b.each, created);
    parts.push(created);
  }
  return parts.flatMap((part) =>
    typeof part === 'string'
      ? [part]
      : [
          // `applyEach` ждёт поведение (`FormBehavior`), а не голую стрелку; тип строки
          // `defineFormBehavior` выводит из массива.
          `  applyEach(model.$.${part.each}, defineFormBehavior(({ model: item }) => {`,
          // Связь бывает в несколько строк (пояснение над `computeFrom`): отступ — каждой.
          ...part.items.flatMap((b) =>
            renderBehavior(b, intent, 'item')
              .split('\n')
              .map((line) => `  ${line}`)
          ),
          '  }));',
        ]
  );
}

/**
 * Операторы поведения, которые печатает набор: виды связей и `applyEach` для связей строк. Вызов
 * своего оператора (`call`) импортирует его модуль, а не ядро.
 */
export function behaviorOps(intent: FormIntent): string[] {
  const ops = new Set<string>(intent.behavior.filter((b) => b.kind !== 'call').map((b) => b.kind));
  if (intent.behavior.some(isRowBehavior)) ops.add('applyEach');
  return [...ops];
}

/** Код поведения, в котором могут встретиться свои операторы и функции ядра. */
export function behaviorCode(intent: FormIntent, withNodes: boolean): string[] {
  return [
    ...intent.behavior.flatMap((b) => [b.expr ?? '', b.when ?? '']),
    ...(withNodes ? (intent.nodes ?? []).map((rule) => rule.expr) : []),
    ...(withNodes ? intent.visibility.map((v) => v.condition) : []),
  ];
}

/**
 * Импорты поведения сверх операторов ядра: свои операторы и `validateModel` — перезапуск своей
 * схемы (`revalidateWhen`). Без него выражение `void validateModel(model, rules)` не собиралось бы.
 */
export function behaviorExtraImports(intent: FormIntent, withNodes: boolean): string[] {
  const code = behaviorCode(intent, withNodes);
  return [
    ...(code.some((part) => /(^|[^\w$.])validateModel\s*\(/.test(part))
      ? ["import { validateModel } from '@reformer/core/validation';"]
      : []),
    // Схема всей формы — проверка перед отправкой с кнопки вне мастера (`submitEventRule`).
    ...(!intent.operators?.formValidation &&
    code.some((part) => mentionsName(part, 'formValidation'))
      ? ["import { formValidation } from './form.validation';"]
      : []),
    ...operatorImportLines(intent.operators, code),
  ];
}

/**
 * Тело формулы: выражение либо блок со строками `const` и `return`, когда формула объявляет
 * константы (`./locals`). Строки блока — с отступом тела поведения.
 */
function formulaBody(expr: string): string {
  const body = arrowBodyLines(expr);
  if (body.length === 1) return body[0] as string;
  return [body[0], ...body.slice(1).map((line) => `  ${line}`)].join('\n');
}

function renderBehavior(b: BehaviorIntent, intent: FormIntent, scope = 'model'): string {
  const path = (p: string): string => (scope === 'item' && b.each ? rowPath(p, b.each) : p);
  const target = `${scope}.$.${path(b.target)}`;
  const sources = b.sources.map((s) => `${scope}.$.${path(s)}`).join(', ');
  const opts = b.options ? `, ${JSON.stringify(b.options)}` : '';
  switch (b.kind) {
    case 'compute':
      return `  compute(${target}, () => ${formulaBody(b.expr ?? 'undefined')}${computeWhen(b)});`;
    case 'computeFrom': {
      // У связи строки параметры — по путям от строки: `items.qty` переименованием не считается.
      const { params, renamed } = callbackParams(b.sources.map(path));
      // Переименование названо на месте: выражение писал консумент, и оно ссылается на
      // ИСХОДНЫЕ имена — без этой строки расхождение он нашёл бы только по ошибке компиляции.
      const note =
        renamed.length > 0
          ? `  // параметры названы по последнему сегменту: ${renamed.join(', ')}\n`
          : '';
      return `${note}  computeFrom([${sources}], ${target}, (${params.join(', ')}) => ${b.expr ?? 'undefined'}${computeWhen(b)});`;
    }
    case 'copyFrom': {
      // `expr` копирования — его условие (`{ when }`; в intent его пишут и ключом `when`). Через
      // `options` функцию не передать — они печатаются JSON, и «копировать, пока стоит флаг»
      // было невыразимо (калибровка, кредитная заявка: `sameEmail`).
      const when = b.expr ? `when: () => ${b.expr}` : '';
      const rest = b.options ? JSON.stringify(b.options).slice(1, -1) : '';
      const all = [when, rest].filter(Boolean).join(', ');
      return `  copyFrom(${scope}.$.${path(b.sources[0] ?? 'source')}, ${target}${all ? `, { ${all} }` : ''});`;
    }
    case 'syncFields':
      return `  syncFields(${target}, ${scope}.$.${path(b.sources[0] ?? 'other')}${opts});`;
    case 'onChange': {
      // Параметр — только если выражение его читает: неиспользованный `value` не собирается под
      // `noUnusedParameters` (калибровка, кредитная заявка: три связи обходили это `void value;`).
      // Загрузка по значению (опции, префилл) — асинхронная реакция: `await` делает колбэк
      // `async`, а `signal` отменяет устаревший запрос, когда источник меняется снова.
      const expr = b.expr ?? '/* эффект */';
      const usesValue = /\bvalue\b/.test(expr);
      const params = /\bsignal\b/.test(expr)
        ? `${usesValue ? 'value' : '_value'}, { signal }`
        : usesValue
          ? 'value'
          : '';
      const async = /\bawait\b/.test(expr) ? 'async ' : '';
      return `  onChange(${target}, ${async}(${params}) => { ${expr} }${opts});`;
    }
    case 'enableWhen':
    case 'disableWhen':
      return `  ${b.kind}(${target}, () => ${b.expr ?? 'true'}${opts});`;
    case 'resetWhen':
      return `  resetWhen(${target}, () => ${b.expr ?? 'false'}${resetWhenOptions(b, intent)});`;
    case 'transformValue':
      return `  transformValue(${target}, (value) => ${b.expr ?? 'value'});`;
    case 'revalidateWhen':
      return `  revalidateWhen([${sources}], () => { ${b.expr ?? '/* перепроверка */'} });`;
    case 'exclusiveFlag': {
      // Флаг — поле строки; массив — `each`, а без него — путь флага до последнего сегмента.
      const each = b.each ?? b.target.split('.').slice(0, -1).join('.');
      return `  exclusiveFlag(model.$.${each}, (row) => row.$.${rowPath(b.target, each)});`;
    }
    case 'aggregateInto':
      return `  aggregateInto(model.$.${b.target}, (rows) => ${b.expr ?? '[]'});`;
    case 'call':
      // Свой оператор — вызов как есть: оператор из `operators` сам регистрирует свои связи.
      return `  ${(b.expr ?? '').replace(/;\s*$/, '')};`;
    default:
      return `  // неизвестный вид поведения: ${String(b.kind)}`;
  }
}

export function buildBehaviorTs(intent: FormIntent): string {
  const ops = behaviorOps(intent).sort();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Поведение формы «${intent.formName}» — реактивные связи над моделью.`);
  lines.push(' */');
  lines.push(
    `import { defineFormBehavior${ops.length ? `, ${ops.join(', ')}` : ''} } from '@reformer/core/behaviors';`
  );
  lines.push(...behaviorExtraImports(intent, false));
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(
    `export const formBehavior = defineFormBehavior<${intent.interfaceName}>(({ model }) => {`
  );
  if (intent.behavior.length === 0) {
    lines.push('  // Поведения в intent не было — добавьте его здесь.');
  }
  lines.push(...renderBehaviors(intent));
  lines.push('});');
  return lines.join('\n') + '\n';
}

/**
 * Печать правил формы в код: схема валидации (`buildValidationSchemaTs`) и поведение
 * (`buildBehaviorTs`) из записей intent. Чистые функции над строками — без диска и без знаний о
 * проекте: справочник операторов ядра приходит аргументом.
 */

import type { BehaviorIntent, FieldIntent, FormIntent, ValidationRuleIntent } from './intent.js';
import { NO_CORE_OPERATORS, type CoreOperators } from './core-operators.js';

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
export function fieldTsType(field: FieldIntent, optional: ReadonlySet<FieldIntent> = NONE): string {
  const base = baseTsType(field);
  if (field.initialValue !== null && !optional.has(field)) return base;
  return base.includes('null') ? base : `${base} | null`;
}

const NONE: ReadonlySet<FieldIntent> = new Set();

function baseTsType(field: FieldIntent): string {
  return field.type === 'date' && !isDatePicker(field)
    ? 'string'
    : (TS_TYPE[field.type] ?? 'unknown');
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
  const text = (f: FieldIntent) => baseTsType(f) === 'string';
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
 */
function callValidator(rule: string): string {
  const trimmed = rule.trim();
  return /[()]/.test(trimmed) ? trimmed : `${trimmed}()`;
}

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
  core: CoreOperators = NO_CORE_OPERATORS
): string[] {
  const used = new Set<string>();
  for (const rule of rules) {
    for (const r of rule.rules) {
      const name = ruleName(r);
      if (name === null || Object.hasOwn(operators, name)) continue;
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
  core: CoreOperators
): {
  ops: string[];
  validators: string[];
  /** Импорты своих операторов — готовыми строками. */
  custom: string[];
} {
  // `validate` нужен правилам с валидаторами; набор из одних кросс-полевых и асинхронных проверок
  // его не зовёт. Пустой набор оставляет его: заготовка предлагает дописать правила им.
  const usesValidate = rules.length === 0 || rules.some((r) => r.rules.length > 0);
  const ops = usesValidate ? ['validate', 'defineValidation'] : ['defineValidation'];
  if (rules.some((r) => r.async)) ops.push('validateAsync');
  if (rules.some((r) => r.when)) ops.push('validateWhen');
  if (rules.some((r) => r.each)) ops.push('applyEach');
  return {
    ops,
    validators: collectValidators(rules, operators, core),
    custom: operatorImportLines(operators, validationCode(rules)),
  };
}

/** Код замечания кросс-полевой проверки, если правило его не назвало. */
export const DEFAULT_CROSS_CODE = 'cross';

/** Строковый литерал TS в одинарных кавычках. */
export function tsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function crossLine(ref: string, rule: ValidationRuleIntent): string {
  const code = (rule.code ?? DEFAULT_CROSS_CODE).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // Предупреждение и параметры замечания — те же поля `ValidationIssue`, что у валидаторов ядра
  // (калибровка кредитной заявки, A13 и A15: без них предупреждения становились ошибками, а
  // тексты — без чисел).
  const params = Object.entries(rule.params ?? {}).map(
    ([name, expr]) => `${/^[A-Za-z_$][\w$]*$/.test(name) ? name : tsString(name)}: ${expr}`
  );
  const issue = [
    `code: '${code}'`,
    ...(rule.severity === 'warning' ? ["severity: 'warning'"] : []),
    ...(params.length > 0 ? [`params: { ${params.join(', ')} }`] : []),
  ];
  return `cross(${ref}, (values) => ((${rule.cross}) ? null : { ${issue.join(', ')} }));`;
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
  const each = rule.each;
  const target = rowTarget(rule);
  const ref = each !== undefined ? `item.$.${target}` : `model.$.${target}`;

  let lines: string[] = [];
  if (rule.rules.length > 0) {
    lines.push(`validate(${ref}, [${rule.rules.map(callValidator).join(', ')}]);`);
  }
  if (rule.async) {
    lines.push(`validateAsync(${ref}, [${rule.async}]);`);
  }
  if (rule.cross) lines.push(crossLine(ref, rule));
  // Свой оператор валидации — вызов как есть: что и как он проверяет, знает только он.
  if (rule.call) lines.push(`${rule.call.replace(/;\s*$/, '')};`);
  if (each !== undefined) {
    // Правила строки — схема над элементом, записанная на месте: `applyEach` отдаёт ей под-модель
    // и свой `cross` — над снимком строки.
    const params = rule.cross ? '{ model: item, cross }' : '{ model: item }';
    lines = wrapBlock(`applyEach(model.$.${each}, (${params}) => {`, lines);
  }
  if (rule.when) {
    lines = wrapBlock(`validateWhen(() => ${rule.when}, () => {`, lines);
  }
  return lines.map((line) => `  ${line}`).join('\n');
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
  const { ops, validators, custom } = validationImports(
    rules,
    opts.operators,
    opts.core ?? NO_CORE_OPERATORS
  );

  const lines: string[] = [];
  if (opts.header !== undefined) {
    lines.push('/**');
    for (const line of opts.header.split('\n')) lines.push(line ? ` * ${line}` : ' *');
    lines.push(' */');
  }
  lines.push(`import { ${ops.join(', ')} } from '@reformer/core/validation';`);
  if (validators.length > 0) {
    lines.push(`import { ${validators.join(', ')} } from '@reformer/core/validators';`);
  }
  lines.push(...custom);
  lines.push(`import type { ${opts.interfaceName} } from '${opts.typeImport}';`);
  lines.push('');
  lines.push(
    `export const ${opts.exportName} = defineValidation<${opts.interfaceName}>((${schemaParams(rules)}) => {`
  );

  if (rules.length === 0) {
    lines.push('  // Правил в intent не было — добавьте их здесь.');
  }
  for (const rule of mergeFieldChecks(rules)) lines.push(validationRuleBlock(rule));

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
  if (field === undefined || given || fieldTsType(field, optionalText(intent)).includes('null')) {
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

function renderBehavior(b: BehaviorIntent, intent: FormIntent, scope = 'model'): string {
  const path = (p: string): string => (scope === 'item' && b.each ? rowPath(p, b.each) : p);
  const target = `${scope}.$.${path(b.target)}`;
  const sources = b.sources.map((s) => `${scope}.$.${path(s)}`).join(', ');
  const opts = b.options ? `, ${JSON.stringify(b.options)}` : '';
  switch (b.kind) {
    case 'compute':
      return `  compute(${target}, () => ${b.expr ?? 'undefined'}${computeWhen(b)});`;
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

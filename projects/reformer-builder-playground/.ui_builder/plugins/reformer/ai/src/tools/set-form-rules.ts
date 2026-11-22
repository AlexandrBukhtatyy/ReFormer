/**
 * Правила формы: валидация, реактивные связи, условная видимость.
 *
 * Единственный write-инструмент, который правит НЕ схему. В `JsonFormSchema` правила положить
 * некуда, контракт `@reformer/renderer-json` закрыт: они живут в коде модуля формы —
 * `validation/` и `behavior/`, — и в конце хода их туда печатает генерация кода
 * (`../stack/rule-code`).
 *
 * Гейт здесь строже, чем у правок раскладки, и не случайно. Неверная раскладка видна на канвасе
 * сразу; неверное правило выглядит правдоподобно и ломается у пользователя — при сборке его
 * проекта или, хуже, молча в рантайме. Поэтому проверяются три вещи, каждая из которых уже
 * однажды всплывала:
 *
 *  - **пути модели существуют** — правило на несуществующее поле не сработает никогда, и
 *    заметить это без запуска формы нельзя;
 *  - **нет циклов** — `a` считается из `b`, `b` из `a` даёт бесконечный пересчёт;
 *  - **поле не пишется дважды** — два `computeFrom` на один target тихо перетирают друг друга.
 *
 * Условной видимости здесь намеренно НЕТ, хотя `FormRules` её держит и эмиттер умеет.
 * Правило видимости адресует узел по `selector`, а селекторы проставляются только при
 * экспорте и только контейнерам-секциям, массивам и кнопкам (`codegen/assign-selectors.ts`);
 * обычное поле его не получает вовсе, и задать его вручную не умеет ни один инструмент агента.
 * Принятое правило видимости поэтому почти всегда оказалось бы no-op — ни ошибки, ни эффекта,
 * худший исход из возможных. Параметр вернётся, когда селектором можно будет управлять.
 *
 * @module plugins/reformer/ai/tools/set-form-rules
 */

import { findCycle } from '@reformer/form-intent';
import { collectModelPaths } from '../../../core/form-model';
import { similarNames } from '@reformer/builder-toolkit';
import { emptyRules, type FormRules } from '../../../core/form-model';
import {
  fail,
  ok,
  type AgentTool,
  type RulesLock,
  type RulesRefusal,
  type ToolErrorCode,
  type ToolOutcome,
} from '../model/types';

/** Виды реактивных связей — те же десять, что понимает `@reformer/core/behaviors`. */
const BEHAVIOR_KINDS = [
  'compute',
  'computeFrom',
  'copyFrom',
  'syncFields',
  'onChange',
  'enableWhen',
  'disableWhen',
  'resetWhen',
  'transformValue',
  'revalidateWhen',
  'exclusiveFlag',
  'aggregateInto',
] as const;

/** Реакции: пишут по событию, а не вычисляют поле из источников — в граф вычислений не входят. */
const REACTION_KINDS: ReadonlySet<string> = new Set(['onChange', 'revalidateWhen']);

/** Правило валидации, как его присылает модель: `rules` можно опустить, если есть другая проверка. */
export interface ValidationParam {
  target: string;
  rules?: string[];
  when?: string;
  each?: string;
  /** Кросс-полевая проверка: выражение над снимком `values`, которое должно быть истинным. */
  cross?: string;
  /** Асинхронное правило — функция выражением: `async (value, { signal }) => …`. */
  async?: string;
  /** Код замечания: у кросс-полевой и асинхронной проверки — свой, у обычной — `<поле>.<правило>`. */
  code?: string;
  /** Текст замечания — в словарь формы; у обычного правила — текст его единственной проверки. */
  message?: string;
}

/** Связь, как её присылает модель: `each` — связь каждой строки массива. */
export interface BehaviorParam {
  kind: string;
  target: string;
  sources?: string[];
  expr?: string;
  each?: string;
  /**
   * Условие пересчёта у `compute` и `computeFrom`: пока ложно, поле хранит своё значение. Приходит
   * из intent `build_form`; в схеме аргументов инструмента его нет — поверхность платит каждая
   * модель на каждом шаге, а сборка зовёт инструмент напрямую.
   */
  when?: string;
  /** Опции оператора: `resetOnDisable` у `enableWhen`, `resetValue` у `resetWhen`. Как `when`. */
  options?: Record<string, unknown>;
}

export interface Params {
  /** Значения источников `$dataSource(NAME)`: имя → варианты списка или значение; `null` убирает. */
  dataSources?: Record<string, unknown>;
  validation?: ValidationParam[];
  behavior?: BehaviorParam[];
  /** `replace` — заменить весь набор; по умолчанию правила добавляются к существующим. */
  mode?: 'merge' | 'replace';
}

export const setFormRulesTool: AgentTool<Params> = {
  name: 'set_form_rules',
  description:
    'Validation and reactive behaviour of the form (validation/, behavior/). Model paths, ' +
    'not node addresses. Expressions are TypeScript read through model: model.country !== null.',
  inputSchema: {
    type: 'object',
    properties: {
      validation: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            target: { type: 'string' },
            rules: {
              type: 'array',
              items: { type: 'string' },
              description: 'required, email, min(1) — from @reformer/core/validators',
            },
            when: { type: 'string', description: 'Rule applies only when true' },
            each: { type: 'string', description: 'Array path: apply per item' },
            cross: { type: 'string', description: 'Must hold: values.a === values.b' },
            async: { type: 'string', description: 'async (value, { signal }) => issue|null' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['target'],
          additionalProperties: false,
        },
      },
      behavior: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: [...BEHAVIOR_KINDS] },
            target: { type: 'string', description: 'Path it WRITES' },
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths it READS; cycles checked over these',
            },
            expr: {
              type: 'string',
              description:
                'compute: the value; copyFrom: copy only while true; *When: the condition',
            },
            each: { type: 'string', description: 'Array path: a link of every row' },
          },
          required: ['kind', 'target'],
          additionalProperties: false,
        },
      },
      dataSources: {
        type: 'object',
        description: '$dataSource(NAME) values: NAME → [{ value, label }] or a value; null removes',
      },
      mode: { type: 'string', enum: ['merge', 'replace'] },
    },
    additionalProperties: false,
  },
  readOnly: false,

  run(params, ctx): ToolOutcome {
    const plan = planRules(params, {
      rules: ctx.rules,
      known: collectModelPaths(ctx.draft),
      lock: ctx.rulesLock,
    });
    // Инструмент отвечает первым отказом: модель правит вызов по одному месту. Все сразу собирает
    // `build_form` (`./build-form`) — его отказ один на весь intent.
    const first = plan.refusals[0];
    if (first !== undefined) return fail(first.code, first.message, first.similar);
    const notes = [...plan.notes, ...unreferencedSourceNotes(params, ctx.draft)];
    return {
      ...ok([summarize(plan.rules), ...notes].join('\n')),
      rules: plan.rules,
      ops: [{ kind: 'update', ref: '/rules', summary: summarize(plan.rules) }],
    };
  },
};

/** Вид отказа правил — для сводного отказа `build_form` и ленты: стабильнее текста. */
export type RuleRefusalKind =
  | 'rules-locked'
  | 'no-field'
  | 'rule-invalid'
  | 'data-source-invalid'
  | 'behavior-invalid'
  | 'two-writers'
  | 'cycle';

/** Почему правило не принять: код инструмента, вид, место и фраза для модели. */
export interface RuleRefusal {
  readonly code: ToolErrorCode;
  readonly kind: RuleRefusalKind;
  /** Цель правила или имя источника. */
  readonly at: string;
  readonly message: string;
  /** Похожие пути модели — у пути без поля. */
  readonly similar?: string[];
}

/** Правила после вызова, что сделано за модель и почему вызов не принять — всё сразу. */
export interface RulesPlan {
  readonly rules: FormRules;
  readonly notes: readonly string[];
  readonly refusals: readonly RuleRefusal[];
}

/**
 * Что вызов `set_form_rules` сделает с правилами — без побочных эффектов.
 *
 * Отказы собираются все, а не до первого: `build_form` отвечает на intent одним отказом со всеми
 * пунктами, и модель чинит их за один заход (аудит 2026-11, D5). Сам инструмент отдаёт первый.
 *
 * @param base.known - Пути модели формы (`collectModelPaths`).
 */
export function planRules(
  params: Params,
  base: { readonly rules: FormRules; readonly known: readonly string[]; readonly lock?: RulesLock }
): RulesPlan {
  const refusals: RuleRefusal[] = [];
  const locked = lockedBy(params, base.lock);
  if (locked !== undefined) {
    refusals.push({
      code: locked.code,
      kind: 'rules-locked',
      at: '/rules',
      message: locked.message,
    });
  }
  const { known } = base;
  const next: FormRules = params.mode === 'replace' ? emptyRules() : cloneRules(base.rules);
  const unknown = (path: string) => !isBoundPath(path, known);
  const noField = (path: string, message: string): void => {
    refusals.push({
      code: 'STALE_POINTER',
      kind: 'no-field',
      at: path,
      message,
      similar: similarNames(path, known),
    });
  };

  /** Что инструмент сделал за модель — дописывается к ответу, чтобы она могла поправить. */
  const notes: string[] = [];
  for (const raw of params.validation ?? []) {
    // Правило строки адресует поле строки, и модель пишет его путь от строки (`name`): хранится
    // он полным путём, как у связей строк, — иначе правило не находило своего поля.
    const rule = { ...raw, target: rowFull(raw.target, raw.each) };
    if (unknown(rule.target)) {
      noField(rule.target, `No field bound to "${rule.target}".`);
      continue;
    }
    const refused = checkValidationParam(rule);
    if (refused) {
      refusals.push({
        code: 'INVALID_PARAMS',
        kind: 'rule-invalid',
        at: rule.target,
        message: refused,
      });
      continue;
    }
    const split = splitMessage(rule);
    if (split.note !== undefined) notes.push(split.note);
    for (const entry of split.entries) {
      const coded = withMessageCode(entry);
      if (typeof coded === 'string') {
        refusals.push({
          code: 'INVALID_PARAMS',
          kind: 'rule-invalid',
          at: rule.target,
          message: coded,
        });
      } else {
        next.validation.push(validationIntent(coded));
      }
    }
  }

  for (const [name, value] of Object.entries(params.dataSources ?? {})) {
    const refused = dataSourceRefusal(name, value);
    if (refused) {
      refusals.push({
        code: 'INVALID_PARAMS',
        kind: 'data-source-invalid',
        at: name,
        message: refused,
      });
      continue;
    }
    const sources = { ...next.dataSources };
    if (value === null) delete sources[name];
    else sources[name] = value;
    if (Object.keys(sources).length > 0) next.dataSources = sources;
    else delete next.dataSources;
  }

  for (const raw of params.behavior ?? []) {
    const refused = checkBehaviorParam(raw);
    if (refused) {
      refusals.push({
        code: 'INVALID_PARAMS',
        kind: 'behavior-invalid',
        at: raw.target,
        message: refused,
      });
      continue;
    }
    // Поля строки хранятся полным путём, как у правил валидации строк: так их сверяет
    // целостность правил, а от строки их печатает генерация.
    const b = behaviorIntent(raw);
    const before = refusals.length;
    if (unknown(b.target)) noField(b.target, `No field bound to "${b.target}".`);
    for (const s of b.sources) {
      if (unknown(s)) noField(s, `Source "${s}" is not bound to any field.`);
    }
    if (refusals.length === before) next.behavior.push(b);
  }

  // Два поведения на один target перетирают друг друга молча — это не «последнее выигрывает»,
  // а гонка: порядок зависит от того, как их разложил сборщик.
  // `aggregateInto` пишет в строки массива, а не в одно поле: с полями строк он не спорит.
  // Реакция поле `target` не пишет — это поле-триггер (`onChange` на `age` рядом с вычислением
  // `age` отвергался как второй писатель; лестница сценариев, L5-credit).
  const fieldLinks = next.behavior.filter((b) => b.kind !== 'aggregateInto');
  const computed = fieldLinks.filter((b) => !REACTION_KINDS.has(b.kind));
  const writers = new Map<string, number>();
  for (const b of computed) writers.set(b.target, (writers.get(b.target) ?? 0) + 1);
  const twice = [...writers].filter(([, n]) => n > 1).map(([t]) => t);
  if (twice.length > 0) {
    refusals.push({
      code: 'SCHEMA_INVALID',
      kind: 'two-writers',
      at: twice.join(', '),
      message: `Two behaviours write the same field: ${twice.join(', ')}.`,
    });
  }

  // Граф вычислений — как у MCP (C7): реакции пишут по событию и поле из источников не вычисляют.
  // `onChange` на поле с самим полем в источниках («сменился пароль — очистить подтверждение»)
  // читался циклом `password → password`, и ассистент отвергал эталон, который `form_build`
  // собирает (лестница сценариев, L5-registration).
  const cycle = findCycle(computed.map((b) => ({ target: b.target, reads: b.sources })));
  if (cycle) {
    refusals.push({
      code: 'SCHEMA_INVALID',
      kind: 'cycle',
      at: cycle[0] ?? '',
      message: `Cycle in computed fields: ${cycle.join(' → ')}.`,
    });
  }

  return { rules: next, notes, refusals };
}

/** Ссылка поля на источник в схеме: `$dataSource(NAME)`. */
const DATA_SOURCE_REF = /\$dataSource\(([A-Za-z_$][\w$]*)\)/g;

/**
 * Заметка об источнике, на который не ссылается ни одно поле черновика (ReFormer-qsm8.14).
 *
 * Генерация печатает только источники, названные `$dataSource(NAME)` в схеме: остальные молча
 * выпадали, и выбор оставался без вариантов, хотя инструмент ответил «готово». Отказом это не
 * делается — модель вправе задать варианты раньше, чем поставит поле, — но ответ называет имя и путь.
 */
export function unreferencedSourceNotes(params: Params, draft: unknown): string[] {
  const referenced = new Set(
    [...JSON.stringify(draft).matchAll(DATA_SOURCE_REF)].map((match) => match[1])
  );
  return Object.entries(params.dataSources ?? {})
    .filter(([name, value]) => value !== null && !referenced.has(name))
    .map(
      ([name]) =>
        `No field uses the data source "${name}" yet: its options are dropped unless a field ` +
        `names it — set_node_prop {"options":"$dataSource(${name})"}.`
    );
}

/**
 * Отказ, если вызов меняет правила, которые ход не сможет записать (`../stack/rule-code`):
 * `replace` меняет все виды, `merge` — те, что в нём названы.
 */
function lockedBy(params: Params, lock: RulesLock | undefined): RulesRefusal | undefined {
  if (lock === undefined) return undefined;
  const all = params.mode === 'replace';
  if (all || (params.validation?.length ?? 0) > 0) {
    if (lock.validation !== undefined) return lock.validation;
  }
  if (all || (params.behavior?.length ?? 0) > 0) {
    if (lock.behavior !== undefined) return lock.behavior;
  }
  if (all || Object.keys(params.dataSources ?? {}).length > 0) return lock.dataSources;
  return undefined;
}

/** Имя источника — то, что стоит в `$dataSource(NAME)`: идентификатор. */
const SOURCE_NAME = /^[A-Za-z_$][\w$]*$/;

/**
 * Почему значение источника не принять, или `null`. Список — только вариантов `{ value, label }`:
 * иначе поле выбора получит то, чего не умеет нарисовать.
 */
function dataSourceRefusal(name: string, value: unknown): string | null {
  if (!SOURCE_NAME.test(name)) return `"${name}" is not a data source name: use an identifier.`;
  if (!Array.isArray(value)) return null;
  const bad = value.find(
    (item) =>
      item === null ||
      typeof item !== 'object' ||
      !('value' in item) ||
      typeof (item as { label?: unknown }).label !== 'string'
  );
  return bad === undefined ? null : `Options of "${name}" are { value, label } objects.`;
}

/**
 * Есть ли у пути правила поле в форме. Путь может указывать внутрь объекта или элемента массива
 * (`items.price`), а связь включения — на группу целиком, поэтому сравнение по префиксу в обе
 * стороны: точное совпадение отвергало бы законные вложенные пути.
 *
 * @param known - Пути модели формы (`collectModelPaths`).
 */
export function isBoundPath(path: string, known: readonly string[]): boolean {
  return known.some((k) => k === path || path.startsWith(`${k}.`) || k.startsWith(`${path}.`));
}

/** Путь поля строки — полным путём: `qty` при `each: 'items'` → `items.qty`. */
export function rowFull(path: string, each: string | undefined): string {
  if (each === undefined || path === each || path.startsWith(`${each}.`)) return path;
  return `${each}.${path}`;
}

/**
 * Почему связь не принять, или `null`. Флаг «только у одной строки» без массива и итог по
 * строкам без формулы молча ничего бы не делали.
 */
function checkBehaviorParam(b: BehaviorParam): string | null {
  if (b.kind === 'exclusiveFlag' && b.each === undefined) {
    return 'exclusiveFlag needs each — the array whose rows share the flag.';
  }
  if (b.kind === 'aggregateInto' && b.expr === undefined) {
    return 'aggregateInto needs expr over rows: rows => [{ index, patch }].';
  }
  return null;
}

/** Связь словаря: поля строки — полным путём, `sources` — всегда массив. */
function behaviorIntent(b: BehaviorParam): FormRules['behavior'][number] {
  // У итога по строкам цель — сам массив, `each` ему не нужен.
  const each = b.kind === 'aggregateInto' ? undefined : b.each;
  return {
    kind: b.kind as FormRules['behavior'][number]['kind'],
    target: rowFull(b.target, each),
    sources: (b.sources ?? []).map((source) => rowFull(source, each)),
    ...(b.expr !== undefined ? { expr: b.expr } : {}),
    ...(each !== undefined ? { each } : {}),
    // Условие пересчёта и опции печатает генерация (`buildBehaviorTs`) и читает обратно читатель
    // кода (`rules-code/behavior`): раньше они терялись здесь молча (аудит 2026-11, D4).
    ...(b.when !== undefined ? { when: b.when } : {}),
    ...(b.options !== undefined && Object.keys(b.options).length > 0 ? { options: b.options } : {}),
  };
}

/**
 * Почему правило валидации не принять, или `null`.
 *
 * Тексту кросс-полевой проверки без `message` неоткуда взяться: в локали ядра нет общего кода
 * «значение неверно», и под полем стоял бы голый код. У асинхронного правила код задаёт само
 * выражение (`{ code: 'taken' }`), поэтому текст без кода не к чему привязать.
 */
function checkValidationParam(rule: ValidationParam): string | null {
  const checks =
    (rule.rules?.length ?? 0) > 0 || rule.cross !== undefined || rule.async !== undefined;
  if (!checks) return `Rule on "${rule.target}" checks nothing: give rules, cross or async.`;
  if (rule.cross !== undefined && rule.message === undefined) {
    return `Cross check on "${rule.target}" needs message — the text shown under the field.`;
  }
  if (rule.message !== undefined && rule.code === undefined && rule.async !== undefined) {
    return `message on "${rule.target}" needs code — the code the async check returns.`;
  }
  return null;
}

/** Вызов валидатора в записи правила: имя и аргументы в скобках (если скобки есть). */
const VALIDATOR_CALL = /^\s*([A-Za-z_$][\w$]*)\s*(?:\((.*)\))?\s*$/s;

/** Свой код в опциях валидатора: `required({ code: 'phone.required' })`. */
const OPTION_CODE = /\bcode\s*:\s*(['"])((?:(?!\1).)+)\1/;

/**
 * Один текст на несколько проверок — разнести по записям, а не отказать.
 *
 * Замер на живой модели: модель пишет `{ rules: ['required', 'email'], message: 'Введите корректный
 * email' }`, получала отказ и тратила целое обращение на повтор. Текст почти всегда описывает
 * проверку, отличную от `required`, — она его и получает; остальные проверки ложатся отдельными
 * записями с текстом по умолчанию. Что сделано, модель узнаёт из ответа и может поправить.
 */
function splitMessage(rule: ValidationParam): {
  readonly entries: readonly ValidationParam[];
  readonly note?: string;
} {
  const checks = rule.rules ?? [];
  if (
    rule.message === undefined ||
    rule.cross !== undefined ||
    rule.async !== undefined ||
    checks.length < 2
  ) {
    return { entries: [rule] };
  }
  const nameOf = (check: string) => VALIDATOR_CALL.exec(check)?.[1] ?? check;
  const worded = checks.reduce(
    (found, check, index) => (nameOf(check) === 'required' ? found : index),
    checks.length - 1
  );
  const { message: _message, code: _code, ...bare } = rule;
  const entries = checks.map((check, index) =>
    index === worded ? { ...rule, rules: [check] } : { ...bare, rules: [check] }
  );
  const others = checks.filter((_, index) => index !== worded).map(nameOf);
  return {
    entries,
    note:
      `The message on "${rule.target}" went to ${nameOf(checks[worded])}; ${others.join(', ')} ` +
      'keep the default text — word them with entries of their own.',
  };
}

/**
 * Текст обычного правила — через свой код его проверки.
 *
 * Замер на живой модели: модель почти всегда ставит `message` к `required` («Укажите телефон»), а
 * отказ стоил шага в каждом ходе с правилами. У валидатора ядра код фиксирован, и текст по нему
 * общий на все поля формы, — поэтому правило получает СВОЙ код (`<поле>.<правило>`, соглашение
 * `RuleOptions.code` ядра), он дописывается в вызов валидатора, а генерация кладёт текст под ним в
 * словарь формы. Проверка у такого правила одна: к какой из двух относился бы один текст — не
 * угадать.
 *
 * Кросс-полевую и асинхронную проверки не трогает: их код и текст и так свои.
 *
 * @returns Правило с кодом в вызове валидатора либо фраза отказа для модели.
 */
function withMessageCode(rule: ValidationParam): ValidationParam | string {
  if (rule.message === undefined || rule.cross !== undefined || rule.async !== undefined) {
    return rule;
  }
  const checks = rule.rules ?? [];
  if (checks.length !== 1) {
    return (
      `message on "${rule.target}" belongs to one check — split ${checks.join(', ')} into ` +
      'separate entries, a message for each.'
    );
  }
  const call = VALIDATOR_CALL.exec(checks[0]);
  if (call === null) return `"${checks[0]}" on "${rule.target}" is not a validator call.`;
  const [, name, args = ''] = call;
  const own = OPTION_CODE.exec(args)?.[2];
  if (own !== undefined) return { ...rule, code: own };
  // Опции, уже переданные объектом, сливать с кодом здесь не возьмёмся — пусть код впишет модель.
  if (args.includes('{')) {
    return `"${checks[0]}" on "${rule.target}" already has options: add code: '...' to them.`;
  }
  const code = rule.code ?? `${rule.target}.${name}`;
  const option = `{ code: '${code}' }`;
  const rewritten = args.trim() === '' ? `${name}(${option})` : `${name}(${args}, ${option})`;
  return { ...rule, rules: [rewritten], code };
}

/** Правило словаря: `rules` всегда массив, у кросс-полевой проверки всегда есть код. */
function validationIntent(rule: ValidationParam): FormRules['validation'][number] {
  const code =
    rule.code ??
    (rule.cross !== undefined ? `${rule.target.split('.').pop() ?? 'field'}Cross` : undefined);
  return {
    target: rule.target,
    rules: rule.rules ?? [],
    ...(rule.when !== undefined ? { when: rule.when } : {}),
    ...(rule.each !== undefined ? { each: rule.each } : {}),
    ...(rule.cross !== undefined ? { cross: rule.cross } : {}),
    ...(rule.async !== undefined ? { async: rule.async } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(rule.message !== undefined ? { message: rule.message } : {}),
  };
}

function cloneRules(rules: FormRules): FormRules {
  return {
    validation: [...rules.validation],
    behavior: [...rules.behavior],
    render: [...rules.render],
    ...(rules.dataSources !== undefined ? { dataSources: { ...rules.dataSources } } : {}),
  };
}

function summarize(rules: FormRules): string {
  return (
    `Готово. Правил: валидация ${rules.validation.length}, поведение ${rules.behavior.length}, ` +
    `render ${rules.render.length}, источников ${Object.keys(rules.dataSources ?? {}).length}. ` +
    'Они уходят в validation/, behavior/ и constants/ модуля формы.'
  );
}

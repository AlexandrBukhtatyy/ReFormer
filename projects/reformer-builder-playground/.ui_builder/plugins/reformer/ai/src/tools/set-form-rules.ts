/**
 * Правила формы: валидация, реактивные связи, условная видимость.
 *
 * Единственный write-инструмент, который правит НЕ схему. Правила — сайдкар (`@/plugins/reformer/core/form-model`):
 * в `JsonFormSchema` их положить некуда, контракт `@reformer/renderer-json` закрыт. Из них
 * генерируются `validation/` и `behavior/` модуля формы, которые до сих пор были заглушками с TODO.
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

import { findCycle } from '@reformer/mcp/dist/core/utils/graph.js';
import { collectModelPaths } from '../../../core/form-model';
import { similarNames } from '../loop/suggest';
import { emptyRules, type FormRules } from '../../../core/form-model';
import { fail, ok, type AgentTool, type ToolOutcome } from '../model/types';

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

/** Правило валидации, как его присылает модель: `rules` можно опустить, если есть другая проверка. */
interface ValidationParam {
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
interface BehaviorParam {
  kind: string;
  target: string;
  sources?: string[];
  expr?: string;
  each?: string;
}

interface Params {
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
            expr: { type: 'string' },
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
    const known = new Set(collectModelPaths(ctx.draft));
    const next: FormRules = params.mode === 'replace' ? emptyRules() : cloneRules(ctx.rules);

    // Путь может указывать внутрь объекта или элемента массива (`items.price`), поэтому
    // сравнение по префиксу: точное совпадение отвергало бы законные вложенные пути.
    const unknown = (path: string) =>
      !known.has(path) &&
      ![...known].some((k) => path.startsWith(`${k}.`) || k.startsWith(`${path}.`));

    for (const raw of params.validation ?? []) {
      // Правило строки адресует поле строки, и модель пишет его путь от строки (`name`): хранится
      // он полным путём, как у связей строк, — иначе правило не находило своего поля.
      const rule = { ...raw, target: rowFull(raw.target, raw.each) };
      if (unknown(rule.target)) {
        return fail(
          'STALE_POINTER',
          `No field bound to "${rule.target}".`,
          similarNames(rule.target, [...known])
        );
      }
      const refused = checkValidationParam(rule);
      if (refused) return fail('INVALID_PARAMS', refused);
      const coded = withMessageCode(rule);
      if (typeof coded === 'string') return fail('INVALID_PARAMS', coded);
      next.validation.push(validationIntent(coded));
    }

    for (const [name, value] of Object.entries(params.dataSources ?? {})) {
      const refused = dataSourceRefusal(name, value);
      if (refused) return fail('INVALID_PARAMS', refused);
      const sources = { ...next.dataSources };
      if (value === null) delete sources[name];
      else sources[name] = value;
      if (Object.keys(sources).length > 0) next.dataSources = sources;
      else delete next.dataSources;
    }

    for (const raw of params.behavior ?? []) {
      const refused = checkBehaviorParam(raw);
      if (refused) return fail('INVALID_PARAMS', refused);
      // Поля строки хранятся полным путём, как у правил валидации строк: так их сверяет
      // целостность правил, а от строки их печатает генерация.
      const b = behaviorIntent(raw);
      if (unknown(b.target)) {
        return fail(
          'STALE_POINTER',
          `No field bound to "${b.target}".`,
          similarNames(b.target, [...known])
        );
      }
      for (const s of b.sources) {
        if (unknown(s)) {
          return fail(
            'STALE_POINTER',
            `Source "${s}" is not bound to any field.`,
            similarNames(s, [...known])
          );
        }
      }
      next.behavior.push(b);
    }

    // Два поведения на один target перетирают друг друга молча — это не «последнее выигрывает»,
    // а гонка: порядок зависит от того, как их разложил сборщик.
    // `aggregateInto` пишет в строки массива, а не в одно поле: с полями строк он не спорит.
    const fieldLinks = next.behavior.filter((b) => b.kind !== 'aggregateInto');
    const writers = new Map<string, number>();
    for (const b of fieldLinks) writers.set(b.target, (writers.get(b.target) ?? 0) + 1);
    const twice = [...writers].filter(([, n]) => n > 1).map(([t]) => t);
    if (twice.length > 0) {
      return fail('SCHEMA_INVALID', `Two behaviours write the same field: ${twice.join(', ')}.`);
    }

    const cycle = findCycle(fieldLinks.map((b) => ({ target: b.target, reads: b.sources })));
    if (cycle) {
      return fail('SCHEMA_INVALID', `Cycle in computed fields: ${cycle.join(' → ')}.`);
    }

    return {
      ...ok(summarize(next)),
      rules: next,
      ops: [{ kind: 'update', ref: '/rules', summary: summarize(next) }],
    };
  },
};

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

/** Путь поля строки — полным путём: `qty` при `each: 'items'` → `items.qty`. */
function rowFull(path: string, each: string | undefined): string {
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

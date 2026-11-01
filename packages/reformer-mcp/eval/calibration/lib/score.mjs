/**
 * Метрики калибровки: сверка intent с эталонными фактами (T1) и пригодность ответа агенту (T6).
 *
 * Сверка СЕМАНТИЧЕСКАЯ: формы playground разложены иначе, чем модуль MCP, поэтому сравниваются
 * сущности — пути полей, шаги, массивы, пары «цель + вид правила», виды связей, селекторы
 * видимости, — а не файлы.
 */

/** Бюджет ответа фасада `mcp_call` ассистента (`plugins/forms/mcp/src/assistant/format.ts`). */
export const ANSWER_BUDGET = 1400;

/** Виды поведения, которые умеет FormIntent (`src/core/generate/form-intent.ts`). */
export const INTENT_BEHAVIOR_KINDS = new Set([
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
]);

/** Имя валидатора из строки правила intent: `minLength(2)` → `minLength`, функция → `custom`. */
export function ruleName(rule) {
  const s = String(rule).trim();
  if (/^(async\b|\(|function\b)/.test(s)) return 'custom';
  return s.match(/^([A-Za-z_$][\w$]*)/)?.[1] ?? 'custom';
}

const rel = (target, each) =>
  each && target.startsWith(`${each}.`) ? target.slice(each.length + 1) : target;
const ruleKey = (target, rule, each) => `${each ? `${each}[].` : ''}${rel(target, each)}|${rule}`;

/** Узлы layout: строка — сокращённая запись поля. */
function childrenOf(node) {
  return Array.isArray(node?.children) ? node.children : [];
}

/** Пути полей и имена массивов под узлом — с учётом частей (`part`) и их относительных путей. */
function leavesOf(node, intent, prefix = '') {
  if (typeof node === 'string') return [prefix + node];
  if (!node || typeof node !== 'object') return [];
  switch (node.kind) {
    case 'field':
      return [prefix + node.ref];
    case 'array':
      return [prefix + node.ref];
    case 'part': {
      const part = intent.parts?.[node.part];
      return part ? leavesOf(part, intent, `${prefix}${node.ref}.`) : [];
    }
    default:
      return childrenOf(node).flatMap((c) => leavesOf(c, intent, prefix));
  }
}

/** Шаги визарда из layout — по порядку. */
function stepsOf(intent) {
  const steps = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'step') {
      steps.push({ title: node.title, selector: node.selector, fields: leavesOf(node, intent) });
      return;
    }
    if (node.kind === 'part') return;
    childrenOf(node).forEach(walk);
  };
  walk(intent.layoutRoot);
  return steps;
}

/** intent → сравнимые множества. */
/** Пути, которые пишет выражение реакции: присваивание, очистка, сброс, смена пропсов узла. */
function writtenBy(expr = '') {
  const out = new Set();
  const re =
    /\b(?:model|form)\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*?)(?:\s*=(?!=)|\.(?:clear|reset|setValue|updateComponentProps)\()/g;
  for (const m of expr.matchAll(re)) out.add(m[1]);
  return [...out];
}

export function normalizeIntent(intent) {
  const fields = new Map();
  for (const f of intent?.fields ?? []) {
    fields.set(f.modelPath ?? f.name, { type: f.type, component: f.component });
  }
  const arrays = new Map(
    (intent?.arrays ?? []).map((a) => [
      a.modelPath ?? a.name,
      new Set((a.itemFields ?? []).map((f) => f.name)),
    ])
  );
  const validation = new Set();
  const conditional = new Set();
  for (const v of intent?.validation ?? []) {
    const names = (v.rules ?? []).map(ruleName);
    if (v.async) names.push('async');
    if (v.cross) names.push('cross');
    for (const n of names) {
      const key = ruleKey(v.target, n, v.each);
      validation.add(key);
      if (v.when) conditional.add(key);
    }
  }
  const behavior = new Set(
    (intent?.behavior ?? []).flatMap((b) => [
      `${b.kind}|${b.each ? `${b.each}[].${rel(b.target, b.each)}` : b.target}`,
      // `target` у onChange — НАБЛЮДАЕМОЕ поле, а facts пишут связь по полю, которое она меняет:
      // записываемые пути берутся из выражения (`model.x = …`, `model.arr.clear()`, `form.x.…(`).
      ...(b.kind === 'onChange' ? writtenBy(b.expr).map((p) => `onChange|${p}`) : []),
    ])
  );
  return {
    fields,
    arrays,
    steps: intent ? stepsOf(intent) : [],
    validation,
    conditional,
    behavior,
    visibility: new Set((intent?.visibility ?? []).map((v) => v.selector)),
    dataSources: new Set((intent?.dataSources ?? []).map((d) => d.name)),
    warnings: intent?.warnings ?? [],
  };
}

/** Эталонные факты → те же множества. */
export function normalizeFacts(facts) {
  const validation = new Set();
  const conditional = new Set();
  for (const v of facts.validation ?? []) {
    const key = ruleKey(v.target, v.rule, v.each);
    validation.add(key);
    if (v.when) conditional.add(key);
  }
  return {
    fields: new Map((facts.fields ?? []).map((f) => [f.path, f])),
    arrays: new Map(
      (facts.arrays ?? []).map((a) => [
        a.name,
        new Set((a.itemFields ?? []).map((f) => f.name ?? f)),
      ])
    ),
    steps: facts.steps ?? [],
    validation,
    conditional,
    behavior: new Set(
      (facts.behavior ?? []).map(
        (b) => `${b.kind}|${b.each ? `${b.each}[].${rel(b.target, b.each)}` : b.target}`
      )
    ),
    behaviorKinds: (facts.behavior ?? []).map((b) => b.kind),
    visibility: new Set((facts.visibility ?? []).map((v) => v.selector)),
    dataSources: new Set((facts.dataSources ?? []).map((d) => d.name)),
  };
}

/** Доля найденного: `{ hit, total, rate, missing }`. */
function recall(expected, actual) {
  const exp = [...expected];
  const missing = exp.filter((x) => !actual.has(x));
  const hit = exp.length - missing.length;
  return { hit, total: exp.length, rate: exp.length ? hit / exp.length : 1, missing };
}

/**
 * T1 — насколько intent покрывает эталон.
 *
 * `behavior` считается дважды: по всем связям эталона и только по тем видам, что FormIntent
 * вообще умеет, — первое мерит путь целиком, второе отделяет анализатор от выразительности.
 */
export function scoreIntent(facts, intent) {
  const f = normalizeFacts(facts);
  const i = normalizeIntent(intent);

  const fields = recall(f.fields.keys(), i.fields);
  const extra = [...i.fields.keys()].filter((p) => !f.fields.has(p));
  const typeMismatch = [...f.fields.entries()]
    .filter(([p, fact]) => i.fields.has(p) && fact.type && i.fields.get(p).type !== fact.type)
    .map(([p, fact]) => `${p}: ${fact.type} → ${i.fields.get(p).type}`);
  const componentMismatch = [...f.fields.entries()]
    .filter(
      ([p, fact]) =>
        i.fields.has(p) && fact.component && i.fields.get(p).component !== fact.component
    )
    .map(([p, fact]) => `${p}: ${fact.component} → ${i.fields.get(p).component}`);

  // Шаги сверяются по порядку: имена шагов в эталоне и в intent разные по природе.
  let placed = 0;
  let placeable = 0;
  const misplaced = [];
  f.steps.forEach((step, index) => {
    for (const p of step.fields ?? []) {
      placeable++;
      const at = i.steps.findIndex((s) => s.fields.includes(p));
      if (at === index) placed++;
      else misplaced.push(`${p}: шаг ${index + 1} → ${at < 0 ? 'нет' : at + 1}`);
    }
  });

  const arrays = recall(f.arrays.keys(), i.arrays);
  const itemFields = { hit: 0, total: 0, missing: [] };
  for (const [name, items] of f.arrays) {
    for (const item of items) {
      itemFields.total++;
      if (i.arrays.get(name)?.has(item)) itemFields.hit++;
      else itemFields.missing.push(`${name}[].${item}`);
    }
  }
  itemFields.rate = itemFields.total ? itemFields.hit / itemFields.total : 1;

  const validation = recall(f.validation, i.validation);
  const byRule = {};
  for (const key of f.validation) {
    const rule = key.split('|')[1];
    byRule[rule] ??= { hit: 0, total: 0 };
    byRule[rule].total++;
    if (i.validation.has(key)) byRule[rule].hit++;
  }
  const conditional = recall(f.conditional, i.conditional);

  const behavior = recall(f.behavior, i.behavior);
  const expressible = new Set(
    [...f.behavior].filter((k) => INTENT_BEHAVIOR_KINDS.has(k.split('|')[0]))
  );
  const behaviorExpressible = recall(expressible, i.behavior);

  return {
    fields: { ...fields, extra, typeMismatch, componentMismatch },
    steps: {
      expected: f.steps.length,
      actual: i.steps.length,
      placement: {
        hit: placed,
        total: placeable,
        rate: placeable ? placed / placeable : 1,
        misplaced,
      },
    },
    arrays,
    itemFields,
    validation: { ...validation, byRule },
    conditional,
    behavior,
    behaviorExpressible,
    visibility: recall(f.visibility, i.visibility),
    dataSources: recall(f.dataSources, i.dataSources),
    warnings: i.warnings.length,
    unparsed: i.warnings.filter((w) => /не разобран/.test(w)).length,
  };
}

/**
 * T6 — главное в ответе должно поместиться в бюджет фасада `mcp_call`: дальше модель видит
 * только начало и пометку «дочитать ресурсом».
 *
 * @param {string} tool
 * @param {string} text
 * @returns {{ chars: number, fits: boolean, key: string, keyAt: number, ok: boolean }}
 */
export function fitness(tool, text) {
  const t = String(text);
  const probes = {
    generate_form: [/^[✅❌].*$/m, 'статус кросс-проверки'],
    plan_form: [/^Разобрано:.*$/m, 'счётчики разбора'],
    validate_form: [/✅|❌|⚠️|RF0\d\d|\bvalid\b|без замечаний|No issues/i, 'вердикт'],
    choose_api: [/^# choose_api: `[^`]+`/m, 'выбранный оператор'],
    find_recipe: [/^# Recipe/m, 'заголовок рецепта'],
    get_symbol_docs: [/```typescript/, 'сигнатура'],
    search_docs: [/reformer:\/\/docs\//, 'первый URI'],
    get_context: [/```typescript/, 'первый пример'],
    list_symbols: [/^-|\|/m, 'первый символ'],
  };
  const [re, key] = probes[tool] ?? [/\S/, 'текст'];
  const m = t.match(re);
  const keyAt = m ? (m.index ?? 0) + m[0].length : -1;
  return {
    chars: t.length,
    fits: t.length <= ANSWER_BUDGET,
    key,
    keyAt,
    ok: keyAt >= 0 && keyAt <= ANSWER_BUDGET,
  };
}

/** Где в ответе начинаются предупреждения — их модель должна увидеть до правки. */
export function warningsAt(text) {
  const at = String(text).search(/^## Warnings/m);
  return at;
}

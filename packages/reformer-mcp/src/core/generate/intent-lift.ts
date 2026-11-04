/**
 * Записи intent, которые `readIntent` читал как ссылки и молча терял, — в каноническую форму.
 *
 * Модель пишет поле там, где оно стоит на форме, а не объявляет его в `fields` со ссылкой по
 * имени: в шаге (`steps: [{ fields: [{ name, component }] }]`) и узлом разметки
 * (`{ kind: "field", name, component, label }`). `readStep` и `readLayoutNode` берут из такой
 * записи только имя, и объявление пропадало: `form_build` отвечал ✓ на форме без полей
 * (ReFormer-j356.5; в билдере те же записи с замера 2026-11-03 поднимает `build-form/lift.ts`).
 *
 * Здесь только перенос записи, без догадок о смысле:
 * - объект с именем и признаком поля (компонент, подпись, тип) поднимается в `fields`, массив со
 *   строками — в `arrays`, а в шаге и разметке остаётся имя;
 * - объявленное в `fields` побеждает описание на месте;
 * - запись поля без имени — проблема, а не тихая потеря.
 *
 * Сверх подъёма — формы входа, которые читались пустыми: intent, который сам узел разметки, один
 * шаг ключом `step` или объектом вместо списка `steps`, раскладка списком, голое `{ "name" }` в
 * разметке (читалось пустым контейнером) и правило валидации в списке полей (читалось вторым
 * полем с тем же именем). Массив, записанный полем в `fields`, читает сам `readIntent`.
 *
 * @module reformer-mcp/core/generate/intent-lift
 */

import type { IntentProblem, IntentWarning, IntentWarningCode } from './form-intent.js';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Ключи имени поля: имя (`readField` берёт `name`, `field`, `key`, `id`), ссылка разметки (`ref`)
 * и путь модели (`modelPath`, `path`, `model`, `binding` — без имени он и есть имя).
 */
const NAME_KEYS = [
  'name',
  'field',
  'key',
  'id',
  'ref',
  'path',
  'modelPath',
  'model',
  'binding',
] as const;

/** Признаки описания поля, как их читает `readField`: по одному имени запись остаётся ссылкой. */
const FIELD_KEYS = [
  'component',
  'componentName',
  'widget',
  'control',
  'label',
  'caption',
  'type',
  'fieldType',
  'valueType',
  'dataType',
  'required',
  'isRequired',
  'componentProps',
  'props',
  'optionsSource',
  'suggestionsSource',
  'options',
] as const;

/** Ключи проверок, как их читает `readValidationRule`. */
const RULE_KEYS = ['rules', 'rule', 'validators', 'checks', 'cross', 'async'] as const;

/** Ключи раскладки и списков шагов, как их читает `readIntent` (`layout` — когда не строка). */
const LAYOUT_KEYS = ['layoutRoot', 'root', 'tree', 'layout'] as const;
const STEP_LIST_KEYS = ['steps', 'pages', 'wizardSteps'] as const;
const STEP_FIELD_KEYS = ['fields', 'fieldNames', 'items', 'refs'] as const;
const CHILD_KEYS = ['children', 'items', 'nodes', 'fields'] as const;
const ITEM_FIELD_KEYS = ['itemFields', 'fields', 'columns', 'items'] as const;

/** Ключи, по которым intent уже intent, а не узел разметки. */
const INTENT_KEYS = ['fields', 'arrays', 'wizard', ...LAYOUT_KEYS, ...STEP_LIST_KEYS] as const;

function nameOf(node: Json): string | undefined {
  for (const key of NAME_KEYS) {
    const value = node[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return undefined;
}

/** Вид узла: `readLayoutNode` читает его и из `type`, но тип поля — не вид узла. */
function kindOf(node: Json): string | undefined {
  return typeof node.kind === 'string' ? node.kind.toLowerCase() : undefined;
}

/** Описание поля: хотя бы один признак поля, без детей и без вида, отличного от `field`. */
function describesField(node: Json): boolean {
  const kind = kindOf(node);
  if ((kind !== undefined && kind !== 'field') || node.children !== undefined) return false;
  return FIELD_KEYS.some((key) => node[key] !== undefined);
}

/** Узел из одних ключей имени: ни детей, ни компонента, ни свойств. */
const isBareReference = (node: Json): boolean =>
  Object.keys(node).every((key) => (NAME_KEYS as readonly string[]).includes(key));

/**
 * Массив, описанный на месте: `{ kind: "array", name, itemFields }` либо
 * `{ name, type: "array", fields: [ … ] }`. Узлом разметки он читался ссылкой без строк.
 */
function isInlineArray(node: Json): boolean {
  if (nameOf(node) === undefined) return false;
  if (Array.isArray(node.itemFields)) return true;
  const typed = kindOf(node) === 'array' || node.type === 'array';
  return typed && ITEM_FIELD_KEYS.some((key) => key !== 'itemFields' && Array.isArray(node[key]));
}

/**
 * Объявление из описания на месте: служебные ключи разметки сняты, путь модели и прочее — как
 * было (их прочтёт `readField`), имя — `name`, если его не было. У массива снят и тип `array`.
 */
function declarationOf(node: Json, name: string): Json {
  const { kind: _kind, ref: _ref, selector: _selector, ...rest } = node;
  if (rest.type === 'array') delete rest.type;
  return typeof node.name === 'string' && node.name.trim() !== '' ? rest : { name, ...rest };
}

/** Имена, уже объявленные списком или словарём (`fields: { city: { … } }`). */
function declaredNames(value: unknown): Set<string> {
  if (isRecord(value)) return new Set(Object.keys(value));
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .map((item) => (typeof item === 'string' ? item : isRecord(item) ? nameOf(item) : undefined))
      .filter((name): name is string => name !== undefined)
  );
}

/** Дописывает поднятые объявления к списку или словарю, не перекрывая объявленное. */
function withDeclarations(value: unknown, lifted: readonly Json[]): unknown {
  const declared = declaredNames(value);
  const fresh = lifted.filter((item) => !declared.has(nameOf(item) as string));
  if (fresh.length === 0) return value;
  if (isRecord(value)) {
    const entries = fresh.map(({ name, ...rest }) => [name as string, rest] as const);
    return { ...value, ...Object.fromEntries(entries) };
  }
  return [...(Array.isArray(value) ? value : []), ...fresh];
}

interface Lift {
  readonly fields: Json[];
  readonly arrays: Json[];
  readonly problems: IntentProblem[];
  bareRefs: number;
}

/** Узел разметки со ссылками вместо описаний; описания — в `lift`. */
function liftNode(node: unknown, at: string, lift: Lift): unknown {
  // Список среди детей — те же дети: модель вкладывает группу полей лишними скобками.
  if (Array.isArray(node)) return node.map((child, i) => liftNode(child, `${at}[${i}]`, lift));
  if (!isRecord(node)) return node;
  const name = nameOf(node);
  // Массив — раньше поля: у массива есть и признаки поля (подпись, тип).
  if (name !== undefined && isInlineArray(node)) {
    lift.arrays.push(declarationOf(node, name));
    return {
      kind: 'array',
      ref: name,
      ...(node.selector === undefined ? {} : { selector: node.selector }),
    };
  }
  if (describesField(node)) {
    if (name === undefined) {
      lift.problems.push({
        at,
        message: 'узел разметки описывает поле, но без имени',
        expected: 'поле — в `fields` с `name`, в разметке — его имя: `"lastName"`',
      });
      return node;
    }
    lift.fields.push(declarationOf(node, name));
    return { kind: 'field', ref: name };
  }
  // Голое имя (`{ "name": "sameAddress" }`) — ссылка на поле: читалось пустым контейнером.
  if (name !== undefined && kindOf(node) === undefined && isBareReference(node)) {
    lift.bareRefs += 1;
    return { kind: 'field', ref: name };
  }
  const next: Json = { ...node };
  for (const key of CHILD_KEYS) {
    if (Array.isArray(next[key])) {
      next[key] = flatten(next[key] as unknown[], `${at}.${key}`, lift);
    }
  }
  return next;
}

/** Дети с развёрнутыми вложенными списками. */
function flatten(children: readonly unknown[], at: string, lift: Lift): unknown[] {
  return children.flatMap((child, i) => {
    const node = liftNode(child, `${at}[${i}]`, lift);
    return Array.isArray(node) ? node : [node];
  });
}

/** Шаг сокращённой записи: описания полей — в `lift`, в шаге — имена. */
function liftStep(step: unknown, at: string, lift: Lift): unknown {
  if (!isRecord(step)) return step;
  const next: Json = { ...step };
  for (const key of STEP_FIELD_KEYS) {
    const list = next[key];
    if (!Array.isArray(list)) continue;
    next[key] = list.map((item, i) => {
      if (!isRecord(item)) return item;
      const name = nameOf(item);
      if (name === undefined) {
        lift.problems.push({
          at: `${at}.${key}[${i}]`,
          message: 'у поля шага нет имени',
          expected: 'поле — в `fields` с `name`, в шаге — его имя: `"fields": ["lastName"]`',
        });
        return item;
      }
      if (isInlineArray(item)) lift.arrays.push(declarationOf(item, name));
      else if (describesField(item)) lift.fields.push(declarationOf(item, name));
      return name;
    });
  }
  return next;
}

/** Правило валидации в списке полей: проверки есть, а признаков поля нет. */
const isMisplacedRule = (item: unknown): boolean =>
  isRecord(item) &&
  RULE_KEYS.some((key) => item[key] !== undefined) &&
  !FIELD_KEYS.some((key) => item[key] !== undefined);

/** Ключи записи правила, которые уходят с поля вместе с проверками. */
const RULE_ENTRY_KEYS = [...RULE_KEYS, 'message', 'errorMessage', 'code', 'when'] as const;

/**
 * Проверки, записанные на самом поле (`{ name, component, rules: [...] }`): `readField` их не
 * читает, и правила пропадали без следа. Поле остаётся без них, проверки — записями `validation`
 * на его путь.
 */
function ownRules(fields: unknown, each?: string): { fields: unknown; rules: Json[] } {
  const rules: Json[] = [];
  const strip = (item: unknown, name?: string): unknown => {
    if (!isRecord(item) || !RULE_KEYS.some((key) => item[key] !== undefined)) return item;
    const target =
      (typeof item.modelPath === 'string' && item.modelPath) ||
      (typeof item.path === 'string' && item.path) ||
      nameOf(item) ||
      name;
    if (target === undefined) return item;
    const rest: Json = { ...item };
    const rule: Json = each === undefined ? { target } : { target, each };
    for (const key of RULE_ENTRY_KEYS) {
      if (rest[key] === undefined) continue;
      rule[key] = rest[key];
      delete rest[key];
    }
    rules.push(rule);
    return rest;
  };
  if (Array.isArray(fields)) {
    // Правило без признаков поля уже ушло в `validation` целиком (`isMisplacedRule`).
    return { fields: fields.map((item) => strip(item)), rules };
  }
  if (isRecord(fields)) {
    const entries = Object.entries(fields).map(([name, item]) => [name, strip(item, name)]);
    return { fields: Object.fromEntries(entries), rules };
  }
  return { fields, rules };
}

/** Проверки на полях строк массива — правилами с `each`: путь в строке, массив — `each`. */
function rowRules(arrays: unknown): { arrays: unknown; rules: Json[] } {
  const rules: Json[] = [];
  const strip = (array: unknown, name?: string): unknown => {
    if (!isRecord(array)) return array;
    const each = nameOf(array) ?? name;
    const key = ITEM_FIELD_KEYS.find((k) => Array.isArray(array[k]) || isRecord(array[k]));
    if (each === undefined || key === undefined) return array;
    const own = ownRules(array[key], each);
    if (own.rules.length === 0) return array;
    rules.push(...own.rules);
    return { ...array, [key]: own.fields };
  };
  if (Array.isArray(arrays)) return { arrays: arrays.map((item) => strip(item)), rules };
  if (isRecord(arrays)) {
    const entries = Object.entries(arrays).map(([name, item]) => [name, strip(item, name)]);
    return { arrays: Object.fromEntries(entries), rules };
  }
  return { arrays, rules };
}

/** Раскладка списком — дети корневого контейнера. */
const asRoot = (value: unknown): unknown =>
  Array.isArray(value) ? { kind: 'container', component: 'Box', children: value } : value;

const names = (items: readonly Json[]): string =>
  items.map((item) => `\`${nameOf(item)}\``).join(', ');

export interface LiftResult {
  /** Intent в канонической записи. */
  readonly source: Json;
  /** Что перенесено — предупреждения чтения. */
  readonly notes: IntentWarning[];
  /** Записи, которые перенести нельзя. */
  readonly problems: IntentProblem[];
}

/**
 * Intent с полями, поднятыми из шагов и разметки в `fields` (массивы — в `arrays`), и с
 * правилами из списка полей — в `validation`.
 */
export function liftInline(source: Json): LiftResult {
  const notes: IntentWarning[] = [];
  const note = (code: IntentWarningCode, message: string): void => {
    notes.push({ code, message });
  };
  let intent: Json = source;

  const isNode =
    !INTENT_KEYS.some((key) => intent[key] !== undefined) &&
    (Array.isArray(intent.children) || kindOf(intent) === 'step');
  if (isNode) {
    const { validation, behavior, visibility, dataSources, formName, target, ...node } = intent;
    const root = kindOf(node) === 'step' ? asRoot([node]) : node;
    intent = Object.fromEntries(
      Object.entries({
        formName,
        target,
        layoutRoot: root,
        validation,
        behavior,
        visibility,
        dataSources,
      }).filter(([, value]) => value !== undefined)
    );
    note('intent-as-node', 'Intent пришёл узлом разметки — прочитан как `layoutRoot`.');
  }

  // Один шаг — ключом `step` или объектом вместо списка `steps`.
  if (intent.steps === undefined && isRecord(intent.step)) {
    const { step, ...rest } = intent;
    intent = { ...rest, steps: [step] };
    note('step-as-key', 'Шаг пришёл ключом `step` — прочитан как `steps` из одного шага.');
  } else if (isRecord(intent.steps) && ('title' in intent.steps || 'fields' in intent.steps)) {
    intent = { ...intent, steps: [intent.steps] };
    note('steps-as-object', '`steps` пришёл объектом — прочитан как список из одного шага.');
  }

  if (Array.isArray(intent.fields) && intent.fields.some(isMisplacedRule)) {
    const rules = intent.fields.filter(isMisplacedRule);
    const validation = intent.validation;
    intent = {
      ...intent,
      fields: intent.fields.filter((item) => !isMisplacedRule(item)),
      validation: [...(Array.isArray(validation) ? validation : []), ...rules],
    };
    note(
      'rules-in-fields',
      `Правил валидации в \`fields\`: ${rules.length} — перенесены в \`validation\`. ` +
        'В `fields` — только поля, проверки — списком `validation`.'
    );
  }

  const lift: Lift = { fields: [], arrays: [], problems: [], bareRefs: 0 };
  for (const key of LAYOUT_KEYS) {
    // `layout` строкой — режим раскладки файлов модуля, не дерево.
    if (intent[key] === undefined || typeof intent[key] === 'string') continue;
    const root = asRoot(intent[key]);
    if (root !== intent[key]) {
      note('layout-as-list', `\`${key}\` пришёл списком — прочитан как дети корневого контейнера.`);
    }
    intent = { ...intent, [key]: liftNode(root, key, lift) };
  }
  if (isRecord(intent.wizard)) {
    const wizard: Json = { ...intent.wizard };
    for (const key of STEP_LIST_KEYS) {
      if (Array.isArray(wizard[key])) {
        wizard[key] = (wizard[key] as unknown[]).map((step, i) =>
          liftStep(step, `wizard.${key}[${i}]`, lift)
        );
      }
    }
    intent = { ...intent, wizard };
  }
  for (const key of STEP_LIST_KEYS) {
    if (Array.isArray(intent[key])) {
      intent = {
        ...intent,
        [key]: (intent[key] as unknown[]).map((step, i) => liftStep(step, `${key}[${i}]`, lift)),
      };
    }
  }

  if (lift.fields.length > 0) {
    intent = { ...intent, fields: withDeclarations(intent.fields, lift.fields) };
    note(
      'inline-fields',
      `Поля, описанные прямо в шагах или узлах разметки, объявлены в \`fields\`: ` +
        `${names(lift.fields)}. Поле объявляй в \`fields\`, а в шаге и разметке ставь его имя.`
    );
  }
  if (lift.arrays.length > 0) {
    intent = { ...intent, arrays: withDeclarations(intent.arrays, lift.arrays) };
    note(
      'inline-arrays',
      `Массивы, описанные прямо в шагах или узлах разметки, объявлены в \`arrays\`: ` +
        `${names(lift.arrays)}.`
    );
  }
  // После подъёма: поле, описанное в шаге, тоже приносит свои проверки.
  const own = ownRules(intent.fields);
  const rows = rowRules(intent.arrays);
  const moved = [...own.rules, ...rows.rules];
  if (moved.length > 0) {
    const validation = intent.validation;
    intent = {
      ...intent,
      ...(own.rules.length > 0 ? { fields: own.fields } : {}),
      ...(rows.rules.length > 0 ? { arrays: rows.arrays } : {}),
      validation: [...(Array.isArray(validation) ? validation : []), ...moved],
    };
    note(
      'rules-on-fields',
      `Проверки, записанные на самих полях: ${moved.length} — перенесены в \`validation\`.`
    );
  }

  if (lift.bareRefs > 0) {
    note(
      'bare-refs',
      `Узлов разметки из одного имени: ${lift.bareRefs} — прочитаны ссылками на поле. ` +
        'Ссылка на поле в разметке — строка: `"lastName"`.'
    );
  }

  return { source: intent, notes, problems: lift.problems };
}

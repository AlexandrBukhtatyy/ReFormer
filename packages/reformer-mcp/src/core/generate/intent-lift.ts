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
 * Описание на месте для уже объявленного поля дописывает объявление тем, чего в нём нет, а
 * расхождение — проблема: раньше такое описание отбрасывалось целиком, и подпись или компонент из
 * разметки пропадали молча (аудит 2026-11, B1). Тексты заметок и проблем — английские: их читает
 * модель.
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
  // Селектор узла поля — селектор самого поля: в объявлении его и держит `FieldIntent`.
  'selector',
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
 * было (их прочтёт `readField`), имя — `name`, если его не было. У массива снят и тип `array`, а
 * `selector` остаётся узлу: селектор массива адресует узел, селектор поля — само поле.
 */
function declarationOf(node: Json, name: string, array = false): Json {
  const { kind: _kind, ref: _ref, ...rest } = node;
  if (array) delete rest.selector;
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

/** Описание на месте и где оно стоит. */
interface Lifted {
  readonly at: string;
  readonly decl: Json;
}

/** Ключи имени и разметки: они называют запись, а не описывают её. */
const MERGE_SKIP: ReadonlySet<string> = new Set([...NAME_KEYS, 'kind', 'ref']);

/**
 * Дописывает поднятые объявления к списку или словарю. Объявленное по имени побеждает, но описание
 * на месте дописывает в него то, чего там нет; разные значения одного ключа — проблема.
 *
 * @returns Новое значение и число объявлений, дописанных описаниями на месте.
 */
function withDeclarations(
  value: unknown,
  lifted: readonly Lifted[],
  problems: IntentProblem[]
): { value: unknown; merged: number } {
  const declared = declaredNames(value);
  const fresh = lifted.filter(({ decl }) => !declared.has(nameOf(decl) as string));
  let merged = 0;
  let next = value;
  for (const { at, decl } of lifted.filter((item) => !fresh.includes(item))) {
    const name = nameOf(decl) as string;
    const own = isRecord(next)
      ? isRecord(next[name])
        ? (next[name] as Json)
        : {}
      : ((next as unknown[]).find((item) => isRecord(item) && nameOf(item) === name) as Json);
    if (own === undefined) continue;
    const additions: Json = {};
    for (const [key, v] of Object.entries(decl)) {
      if (MERGE_SKIP.has(key)) continue;
      if (own[key] === undefined) additions[key] = v;
      else if (JSON.stringify(own[key]) !== JSON.stringify(v)) {
        problems.push({
          code: 'key-conflict',
          at: `${at}.${key}`,
          message:
            `the field \`${name}\` is declared in \`fields\` with another \`${key}\` — ` +
            `${JSON.stringify(own[key])} there, ${JSON.stringify(v)} here`,
          expected: 'one value: describe the field once, in `fields`; in the layout put its name',
        });
      }
    }
    if (Object.keys(additions).length === 0) continue;
    merged += 1;
    const whole = { ...own, ...additions };
    next = isRecord(next)
      ? { ...next, [name]: whole }
      : (next as unknown[]).map((item) => (item === own ? whole : item));
  }
  if (fresh.length === 0) return { value: next, merged };
  if (isRecord(next)) {
    const entries = fresh.map(({ decl: { name, ...rest } }) => [name as string, rest] as const);
    return { value: { ...next, ...Object.fromEntries(entries) }, merged };
  }
  return {
    value: [...(Array.isArray(next) ? next : []), ...fresh.map(({ decl }) => decl)],
    merged,
  };
}

interface Lift {
  readonly fields: Lifted[];
  readonly arrays: Lifted[];
  readonly problems: IntentProblem[];
  bareRefs: number;
}

/**
 * Узел разметки со ссылками вместо описаний; описания — в `lift`.
 *
 * @param inList - Узел среди детей: безымянное описание поля, названное проблемой, из них снимается,
 *   иначе чтение разметки прочло бы его контейнером и назвало бы те же ключи второй раз.
 */
function liftNode(node: unknown, at: string, lift: Lift, inList = false): unknown {
  // Список среди детей — те же дети: модель вкладывает группу полей лишними скобками.
  if (Array.isArray(node)) {
    return node.map((child, i) => liftNode(child, `${at}[${i}]`, lift, inList));
  }
  if (!isRecord(node)) return node;
  const name = nameOf(node);
  // Массив — раньше поля: у массива есть и признаки поля (подпись, тип).
  if (name !== undefined && isInlineArray(node)) {
    lift.arrays.push({ at, decl: declarationOf(node, name, true) });
    return {
      kind: 'array',
      ref: name,
      ...(node.selector === undefined ? {} : { selector: node.selector }),
    };
  }
  if (describesField(node)) {
    if (name === undefined) {
      lift.problems.push({
        code: 'missing-key',
        at,
        message: 'a layout node describes a field but has no name',
        expected: 'the field in `fields` with `name`, in the layout its name: `"lastName"`',
      });
      return inList ? [] : node;
    }
    lift.fields.push({ at, decl: declarationOf(node, name) });
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
    const node = liftNode(child, `${at}[${i}]`, lift, true);
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
    // Безымянное описание названо проблемой и из шага снято: второй раз о нём скажет чтение шага.
    next[key] = list.flatMap((item, i) => {
      if (!isRecord(item)) return [item];
      const name = nameOf(item);
      const itemAt = `${at}.${key}[${i}]`;
      if (name === undefined) {
        lift.problems.push({
          code: 'missing-key',
          at: itemAt,
          message: 'a step field has no name',
          expected:
            'the field in `fields` with `name`, in the step its name: `"fields": ["lastName"]`',
        });
        return [];
      }
      if (isInlineArray(item))
        lift.arrays.push({ at: itemAt, decl: declarationOf(item, name, true) });
      else if (describesField(item))
        lift.fields.push({ at: itemAt, decl: declarationOf(item, name) });
      return [name];
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
    if (!isRecord(item)) return item;
    const carries =
      item.validation !== undefined || RULE_KEYS.some((key) => item[key] !== undefined);
    if (!carries) return item;
    const target =
      (typeof item.modelPath === 'string' && item.modelPath) ||
      (typeof item.path === 'string' && item.path) ||
      nameOf(item) ||
      name;
    if (target === undefined) return item;
    const rest: Json = { ...item };
    const base: Json = each === undefined ? { target } : { target, each };
    // `validation` на самом поле — те же правила другим ключом: раньше он пропадал молча.
    if (rest.validation !== undefined) {
      rules.push(...fieldValidation(rest.validation, base));
      delete rest.validation;
    }
    if (RULE_KEYS.some((key) => rest[key] !== undefined)) {
      const rule: Json = { ...base };
      for (const key of RULE_ENTRY_KEYS) {
        if (rest[key] === undefined) continue;
        rule[key] = rest[key];
        delete rest[key];
      }
      rules.push(rule);
    }
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

/**
 * `validation` на самом поле: строка правила, список строк, запись правила или список записей.
 * Строки — одним правилом, записи — каждая своим; значение другого вида уходит в правило как есть,
 * и его назовёт чтение правила.
 */
function fieldValidation(value: unknown, base: Json): Json[] {
  if (typeof value === 'string') return [{ ...base, rules: [value] }];
  if (isRecord(value)) return [{ ...base, ...value }];
  if (!Array.isArray(value)) return [{ ...base, rules: value }];
  const strings = value.filter((item) => !isRecord(item));
  return [
    ...(strings.length > 0 ? [{ ...base, rules: strings }] : []),
    ...value.filter(isRecord).map((item) => ({ ...base, ...item })),
  ];
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

const names = (items: readonly Lifted[]): string =>
  items.map(({ decl }) => `\`${nameOf(decl)}\``).join(', ');

/**
 * Правила словаря `{ путь: правила }` записями списка. Значение — список строк (`["required()"]`),
 * одна запись, список записей или одна строка правила; место записи — `validation.<путь>`.
 */
export function rulesFromMap(map: Json): Array<{ at: string; item: unknown }> {
  return Object.entries(map).flatMap(([target, v]) => {
    const at = `validation.${target}`;
    if (Array.isArray(v) && v.length > 0 && v.every(isRecord)) {
      return v.map((rec, i) => ({ at: `${at}[${i}]`, item: { target, ...rec } }));
    }
    if (isRecord(v)) return [{ at, item: { target, ...v } }];
    return [{ at, item: { target, rules: v } }];
  });
}

/**
 * Дописать перенесённые правила к `validation`. Словарь правил сначала становится списком: раньше
 * перенос заменял его списком перенесённых, и правила словаря пропадали молча.
 */
function appendRules(validation: unknown, moved: readonly Json[]): unknown[] {
  if (Array.isArray(validation)) return [...validation, ...moved];
  if (isRecord(validation)) return [...rulesFromMap(validation).map(({ item }) => item), ...moved];
  if (validation === undefined || validation === null) return [...moved];
  return [validation, ...moved];
}

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
    note('intent-as-node', 'The intent is a layout node — read as `layoutRoot`.');
  }

  // Один шаг — ключом `step` или объектом вместо списка `steps`.
  if (intent.steps === undefined && isRecord(intent.step)) {
    const { step, ...rest } = intent;
    intent = { ...rest, steps: [step] };
    note('step-as-key', 'One step came under `step` — read as `steps` of one step.');
  } else if (isRecord(intent.steps) && ('title' in intent.steps || 'fields' in intent.steps)) {
    intent = { ...intent, steps: [intent.steps] };
    note('steps-as-object', '`steps` is an object — read as a list of one step.');
  }

  if (Array.isArray(intent.fields) && intent.fields.some(isMisplacedRule)) {
    const rules = intent.fields.filter(isMisplacedRule) as Json[];
    intent = {
      ...intent,
      fields: intent.fields.filter((item) => !isMisplacedRule(item)),
      validation: appendRules(intent.validation, rules),
    };
    note(
      'rules-in-fields',
      `Validation rules in \`fields\`: ${rules.length} — moved to \`validation\`. ` +
        '`fields` holds fields only, checks are the `validation` list.'
    );
  }

  const lift: Lift = { fields: [], arrays: [], problems: [], bareRefs: 0 };
  for (const key of LAYOUT_KEYS) {
    // `layout` строкой — режим раскладки файлов модуля, не дерево.
    if (intent[key] === undefined || typeof intent[key] === 'string') continue;
    const root = asRoot(intent[key]);
    if (root !== intent[key]) {
      note('layout-as-list', `\`${key}\` is a list — read as the children of the root container.`);
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

  let merged = 0;
  if (lift.fields.length > 0) {
    const declared = withDeclarations(intent.fields, lift.fields, lift.problems);
    intent = { ...intent, fields: declared.value };
    merged += declared.merged;
    note(
      'inline-fields',
      `Fields described right in steps or layout nodes are declared in \`fields\`: ` +
        `${names(lift.fields)}. Declare a field in \`fields\` and put its name in the step or ` +
        'the layout.'
    );
  }
  if (lift.arrays.length > 0) {
    const declared = withDeclarations(intent.arrays, lift.arrays, lift.problems);
    intent = { ...intent, arrays: declared.value };
    merged += declared.merged;
    note(
      'inline-arrays',
      `Arrays described right in steps or layout nodes are declared in \`arrays\`: ` +
        `${names(lift.arrays)}.`
    );
  }
  if (merged > 0) {
    note(
      'inline-merged',
      `Descriptions in the layout completed ${merged} declarations already in \`fields\`/` +
        '`arrays` — describe each once, in its declaration.'
    );
  }
  // После подъёма: поле, описанное в шаге, тоже приносит свои проверки.
  const own = ownRules(intent.fields);
  const rows = rowRules(intent.arrays);
  const moved = [...own.rules, ...rows.rules];
  if (moved.length > 0) {
    intent = {
      ...intent,
      ...(own.rules.length > 0 ? { fields: own.fields } : {}),
      ...(rows.rules.length > 0 ? { arrays: rows.arrays } : {}),
      validation: appendRules(intent.validation, moved),
    };
    note(
      'rules-on-fields',
      `Checks written on the fields themselves: ${moved.length} — moved to \`validation\`.`
    );
  }

  if (lift.bareRefs > 0) {
    note(
      'bare-refs',
      `Layout nodes holding only a name: ${lift.bareRefs} — read as field references. A field ` +
        'reference in the layout is a string: `"lastName"`.'
    );
  }

  return { source: intent, notes, problems: lift.problems };
}

/**
 * Intent в записи, которую ждёт MCP: поля, описанные на месте, — в `fields`.
 *
 * Локальная модель пишет поле там, где оно стоит на форме, а не объявляет его в `fields` со ссылкой
 * по имени: в шаге (`steps: [{ fields: [{ name, component }] }]`), узлом разметки
 * (`{ kind: "field", name, component, label }`), а intent шага — самим узлом шага. `readIntent`
 * читает такие записи как ссылки и теряет объявление: поле пропадало, и отказ не говорил почему
 * (замер 2026-11-03, qwen3.8:27b: 4 отказа `build_form` из 13, сценарии 5.4, B.2, B.3).
 *
 * Только перенос записи, без догадок о смысле: поднимается объект с именем и признаком поля
 * (компонент, подпись, тип), а объявленное в `fields` побеждает описание на месте. Запись поля в
 * шаге, у которой не нашлось имени, — проблема, а не молчаливая потеря. Intent без таких записей
 * возвращается как есть — тем же значением.
 *
 * @module plugins/reformer/ai/tools/build-form/lift
 */

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Ключи имени поля: имя (`readField` берёт `name`, `field`, `key`, `id`), ссылка разметки (`ref`)
 * и путь модели (`modelPath`, `path`, `model`, `binding` — без имени он и есть имя). Шаг читает
 * только `name`, `ref`, `path`, `field`: поле шага `{ model: "delivery.city" }` пропадало
 * (замер 2026-11-03, сценарий B.2: шаг собран без полей).
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

/** Признаки описания поля: по одному имени узел остаётся ссылкой. */
const FIELD_KEYS = [
  'component',
  'label',
  'type',
  'required',
  'componentProps',
  'props',
  'optionsSource',
] as const;

/** Ключи компонента поля, как их читает `readField`. */
const COMPONENT_KEYS = ['component', 'componentName', 'widget', 'control'] as const;

/** Ключи раскладки и списков шагов, как их читает `readIntent` (`layout` — когда не строка). */
const LAYOUT_KEYS = ['layoutRoot', 'root', 'tree', 'layout'] as const;
const STEP_LIST_KEYS = ['steps', 'pages', 'wizardSteps'] as const;
const STEP_FIELD_KEYS = ['fields', 'fieldNames', 'items', 'refs'] as const;
const CHILD_KEYS = ['children', 'items', 'nodes', 'fields'] as const;

/** Ключи, по которым intent уже intent, а не узел разметки. */
const INTENT_KEYS = ['fields', 'arrays', 'wizard', ...LAYOUT_KEYS, ...STEP_LIST_KEYS] as const;

function nameOf(node: Json): string | undefined {
  for (const key of NAME_KEYS) {
    const value = node[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return undefined;
}

function kindOf(node: Json): string | undefined {
  return typeof node.kind === 'string' ? node.kind.toLowerCase() : undefined;
}

/** Описание поля: хотя бы один признак поля, без детей. */
function describesField(node: Json): boolean {
  const kind = kindOf(node);
  if ((kind !== undefined && kind !== 'field') || node.children !== undefined) return false;
  return FIELD_KEYS.some((key) => node[key] !== undefined);
}

/**
 * Массив, описанный на месте или полем: `{ kind: "array", name, itemFields }` либо
 * `{ name, type: "array", fields: [ … ] }`. Полем `readField` читает его как поле типа `array` и
 * теряет строки без отказа (замер 2026-11-03, форма на 82 поля: три массива собраны без строк).
 */
function isInlineArray(node: Json): boolean {
  if (nameOf(node) === undefined) return false;
  if (Array.isArray(node.itemFields)) return true;
  const typed = kindOf(node) === 'array' || node.type === 'array';
  return typed && (Array.isArray(node.fields) || Array.isArray(node.items));
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
  readonly problems: string[];
}

/** Узел разметки со ссылками вместо описаний; описания — в `lift`. */
function liftNode(node: unknown, lift: Lift): unknown {
  // Список среди детей — те же дети: модель вкладывает группу полей лишними скобками.
  if (Array.isArray(node)) return node.map((child) => liftNode(child, lift));
  if (!isRecord(node)) return node;
  const name = nameOf(node);
  // Массив — раньше поля: у массива-полем есть и признаки поля (подпись, тип).
  if (name !== undefined && isInlineArray(node)) {
    lift.arrays.push(declarationOf(node, name));
    return {
      kind: 'array',
      ref: name,
      ...(node.selector === undefined ? {} : { selector: node.selector }),
    };
  }
  if (name !== undefined && describesField(node)) {
    lift.fields.push(declarationOf(node, name));
    return { kind: 'field', ref: name };
  }
  const next: Json = { ...node };
  for (const key of CHILD_KEYS) {
    if (Array.isArray(next[key])) next[key] = flatten(next[key] as unknown[], lift);
  }
  return next;
}

/** Дети с развёрнутыми вложенными списками. */
function flatten(children: readonly unknown[], lift: Lift): unknown[] {
  return children.flatMap((child) => {
    const node = liftNode(child, lift);
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
        lift.problems.push(`${at}.${key}[${i}]: a field without "name"`);
        return item;
      }
      if (isInlineArray(item)) {
        lift.arrays.push(declarationOf(item, name));
        return name;
      }
      if (describesField(item)) lift.fields.push(declarationOf(item, name));
      return name;
    });
  }
  return next;
}

/** Запись валидации без единой проверки: ни валидаторов, ни кросс-, ни асинхронной проверки. */
const isEmptyRule = (rule: unknown): boolean =>
  isRecord(rule) &&
  Array.isArray(rule.rules) &&
  rule.rules.length === 0 &&
  rule.cross === undefined &&
  rule.async === undefined;

/** Раскладка списком — дети корневого контейнера. */
const asRoot = (value: unknown): unknown =>
  Array.isArray(value) ? { kind: 'container', component: 'Box', children: value } : value;

/**
 * Компонент по типу, когда тип — имя компонента кита (`type: "textarea"` → `Textarea`). MCP
 * понимает только типы значения и ставил `Input`, после чего модель меняла узел сама двумя
 * вызовами (замер 2026-11-03, сценарий B.2).
 */
function withComponentFromType(field: unknown, components: ReadonlyMap<string, string>): unknown {
  if (!isRecord(field) || COMPONENT_KEYS.some((key) => field[key] !== undefined)) return field;
  const component =
    typeof field.type === 'string' ? components.get(field.type.toLowerCase()) : undefined;
  if (component === undefined) return field;
  const { type: _type, ...rest } = field;
  return { ...rest, component };
}

/** Intent после подъёма и проблемы, из-за которых сборка не должна идти дальше. */
export interface LiftResult {
  readonly intent: unknown;
  readonly problems: readonly string[];
}

/**
 * Intent с полями, поднятыми из шагов и разметки в `fields` (массивы — в `arrays`).
 *
 * Сверх подъёма — записи, которые `readIntent` отклоняет или читает пустыми: раскладка списком
 * (дети корня), intent, который сам узел разметки (`{ kind: "step", title, children }`), один
 * шаг ключом `step` или объектом вместо списка `steps`, правило валидации без проверок и тип
 * поля, который на деле имя компонента.
 *
 * @param components Имена компонентов кита — для типа, который на деле компонент.
 */
export function liftInline(raw: unknown, components: readonly string[] = []): LiftResult {
  const source = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!isRecord(source)) return { intent: raw, problems: [] };

  let intent: Json = { ...source };
  const isNode =
    !INTENT_KEYS.some((key) => intent[key] !== undefined) &&
    (Array.isArray(intent.children) || kindOf(intent) === 'step');
  if (isNode) {
    const { validation, behavior, visibility, dataSources, ...node } = intent;
    const root = kindOf(node) === 'step' ? asRoot([node]) : node;
    intent = Object.fromEntries(
      Object.entries({ layoutRoot: root, validation, behavior, visibility, dataSources }).filter(
        ([, value]) => value !== undefined
      )
    );
  }

  let changed = isNode;
  // Один шаг — ключом `step` или объектом вместо списка `steps`: так модель добавляет шаг в визард.
  if (intent.steps === undefined && isRecord(intent.step)) {
    const { step, ...rest } = intent;
    intent = { ...rest, steps: [step] };
    changed = true;
  } else if (isRecord(intent.steps) && ('title' in intent.steps || 'fields' in intent.steps)) {
    intent = { ...intent, steps: [intent.steps] };
    changed = true;
  }

  // Правило без валидаторов (`rules: []`) — пустая запись, а MCP отклонил бы из-за неё весь intent
  // (замер 2026-11-03, сценарий 21.4: модель так пишет «у этого поля правил нет»).
  if (Array.isArray(intent.validation)) {
    const kept = intent.validation.filter((rule) => !isEmptyRule(rule));
    if (kept.length < intent.validation.length) {
      intent = { ...intent, validation: kept };
      changed = true;
    }
  }

  const lift: Lift = { fields: [], arrays: [], problems: [] };
  // Массив, объявленный в `fields`, — в `arrays`: полем он терял строки.
  if (Array.isArray(intent.fields)) {
    const fields = intent.fields.filter((item) => {
      const name = isRecord(item) ? nameOf(item) : undefined;
      if (name === undefined || !isInlineArray(item as Json)) return true;
      lift.arrays.push(declarationOf(item as Json, name));
      return false;
    });
    if (fields.length < intent.fields.length) intent = { ...intent, fields };
  }
  for (const key of LAYOUT_KEYS) {
    // `layout` строкой — режим раскладки файлов модуля, не дерево.
    if (intent[key] === undefined || typeof intent[key] === 'string') continue;
    const root = asRoot(intent[key]);
    changed ||= root !== intent[key];
    intent[key] = liftNode(root, lift);
  }
  if (isRecord(intent.wizard)) {
    const wizard = { ...intent.wizard };
    for (const key of STEP_LIST_KEYS) {
      if (Array.isArray(wizard[key])) {
        wizard[key] = (wizard[key] as unknown[]).map((step, i) =>
          liftStep(step, `wizard.${key}[${i}]`, lift)
        );
      }
    }
    intent.wizard = wizard;
  }
  for (const key of STEP_LIST_KEYS) {
    if (Array.isArray(intent[key])) {
      intent[key] = (intent[key] as unknown[]).map((step, i) =>
        liftStep(step, `${key}[${i}]`, lift)
      );
    }
  }

  if (lift.fields.length > 0) intent.fields = withDeclarations(intent.fields, lift.fields);
  if (lift.arrays.length > 0) intent.arrays = withDeclarations(intent.arrays, lift.arrays);
  changed ||= lift.fields.length + lift.arrays.length > 0;

  const byName = new Map(components.map((name) => [name.toLowerCase(), name]));
  if (byName.size > 0 && Array.isArray(intent.fields)) {
    const fields = intent.fields.map((field) => withComponentFromType(field, byName));
    if (fields.some((field, i) => field !== (intent.fields as unknown[])[i])) {
      intent.fields = fields;
      changed = true;
    }
  }

  return { intent: changed ? intent : raw, problems: lift.problems };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

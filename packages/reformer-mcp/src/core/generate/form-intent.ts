/**
 * `FormIntent` — промежуточный контракт между «что нужно от формы» и файлами бандла.
 *
 * Зачем отдельное представление, а не сразу код. В ReFormer **JSON несёт только layout**:
 * контракт `JsonFormSchema` — это дерево узлов со строковыми операторами (`$model`,
 * `$component`, `$dataSource`), и ПОВЕДЕНИЕ в нём невыразимо by design. Валидация,
 * вычисляемые поля, условная видимость и навигация живут в отдельных TS-DSL над той же
 * моделью. Поэтому «форма» — это всегда бандл из нескольких файлов, и им нужен общий
 * источник истины, иначе они разъезжаются.
 *
 * Отсюда форма контракта: **плоский реестр сущностей** (поля, массивы, правила, поведение)
 * плюс **дерево layout**, которое ссылается на них по имени. Именно это разделение делает
 * согласованность проверяемой: `cross-check` сверяет, что каждый `$model(path)` из JSON
 * существует в модели, каждый `$component(Name)` — в реестре, каждая цель правила — реальный
 * путь. Если бы layout и поведение описывались одной вложенной структурой, такую проверку
 * пришлось бы заменить надеждой.
 */

/** Тип значения поля в модели. */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

export interface FieldIntent {
  /** Имя поля в модели. Оно же — `selector` узла, если не задан отдельно. */
  name: string;
  /** Путь в модели; по умолчанию совпадает с `name`. */
  modelPath?: string;
  type: FieldType;
  /** Имя компонента в реестре (`Input`, `Select`, …). */
  component: string;
  componentProps?: Record<string, unknown>;
  label?: string;
  initialValue?: unknown;
  /** Имя `$dataSource(...)` для полей выбора. */
  optionsSource?: string;
  /** Селектор узла для render-поведения; по умолчанию — `name`. */
  selector?: string;
}

export interface ArrayIntent {
  name: string;
  modelPath?: string;
  /** Имя интерфейса элемента — попадёт в `model.ts`. */
  itemInterfaceName: string;
  itemFields: FieldIntent[];
  /**
   * Начальное значение обязательно: узел массива без него ломается на первом `add`,
   * и это ровно та ошибка, которую `validateFormSchema` поймать не может.
   */
  initialValue: unknown[];
  /** Компонент, рисующий строки (`FormArray` из ui-kit либо свой). */
  component?: string;
}

/** Правило валидации над одним путём модели. */
export interface ValidationRuleIntent {
  /** Путь в модели. Для правил внутри массива — `items.field`. */
  target: string;
  /** Правило применяется к каждому элементу массива с этим именем. */
  each?: string;
  /** Условие активности правила → `validateWhen`. */
  when?: string;
  /** Имена валидаторов: `required`, `email`, `minLength(2)`, … */
  rules: string[];
  /** Асинхронная проверка: имя функции, которую напишет разработчик. */
  async?: string;
}

/** Реактивная связь над моделью. */
export interface BehaviorIntent {
  kind:
    | 'compute'
    | 'computeFrom'
    | 'copyFrom'
    | 'syncFields'
    | 'onChange'
    | 'enableWhen'
    | 'disableWhen'
    | 'resetWhen'
    | 'transformValue'
    | 'revalidateWhen';
  /** Поле, которое поведение ПИШЕТ. */
  target: string;
  /** Поля, которые оно ЧИТАЕТ. Из них строится проверка циклов. */
  sources: string[];
  /** Тело выражения на TS — вставляется как есть. */
  expr?: string;
  options?: Record<string, unknown>;
}

/** Правило видимости в render-слое. */
export interface VisibilityIntent {
  /** Селектор узла в схеме. */
  selector: string;
  /** Условие, при котором узел СКРЫТ. */
  condition: string;
}

export interface DataSourceIntent {
  name: string;
  /** Комментарий-подсказка, откуда берутся значения. */
  note?: string;
}

export interface WizardIntent {
  steps: Array<{ title: string; fields: string[] }>;
}

/** Узел layout-дерева. Листья ссылаются на поля/массивы ПО ИМЕНИ, не встраивают их. */
export type LayoutNode =
  | { kind: 'field'; ref: string }
  // `selector` у массива — точка адресации для behavior/visibility. Без него генератор
  // подставлял имя массива, и правило, ссылавшееся на собственный selector из intent,
  // адресовало узел, которого в разметке нет.
  | { kind: 'array'; ref: string; selector?: string }
  | {
      kind: 'container';
      component: string;
      htmlTag?: string;
      componentProps?: Record<string, unknown>;
      selector?: string;
      children: LayoutNode[];
    }
  | { kind: 'step'; title: string; selector?: string; children: LayoutNode[] };

export type ReformerTargetStack = 'core' | 'renderer-react' | 'renderer-json';

export interface FormIntent {
  formName: string;
  /** Имя интерфейса модели, PascalCase. */
  interfaceName: string;
  target: ReformerTargetStack;
  layout: 'minimalist' | 'folders';
  layoutRoot: LayoutNode;
  fields: FieldIntent[];
  arrays: ArrayIntent[];
  validation: ValidationRuleIntent[];
  behavior: BehaviorIntent[];
  visibility: VisibilityIntent[];
  dataSources: DataSourceIntent[];
  wizard?: WizardIntent;
  /** Всё, чего не хватило для полного бандла, — видно потребителю. */
  warnings: string[];
}

/** Слова произвольной строки → `PascalCase`-идентификатор (нелатиница отбрасывается). */
function toPascal(source: string): string {
  return String(source)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');
}

/** `Заявка на кредит` → `CreditApplicationForm`-подобное имя интерфейса. */
export function deriveInterfaceName(formName: string): string {
  const pascal = toPascal(formName);
  // Кириллическое имя формы даёт пустой идентификатор — тогда честный дефолт лучше огрызка.
  return pascal.length >= 2 ? `${pascal}Shape` : 'FormShape';
}

/**
 * Имя, под которым сущность попадёт и в модель, и в разметку.
 *
 * `null` означает «читать нечего». Без этой проверки поле без `name` доезжало до билдера с
 * `modelPath === undefined` и падало там на `path.split('.')` — то есть внутренней ошибкой MCP
 * (`-32603`) без единого слова о том, какая именно запись не так.
 */
function usableName(entity: { name?: string; modelPath?: string }): string | null {
  const name = typeof entity?.name === 'string' ? entity.name.trim() : '';
  if (name) return name;
  const path = typeof entity?.modelPath === 'string' ? entity.modelPath.trim() : '';
  return path || null;
}

/**
 * Довести частичный intent до полного: расставить умолчания и собрать `warnings`.
 *
 * Ничего не выдумывает сверх умолчаний, которые нельзя не иметь (`selector = name`,
 * `modelPath = name`). Всё остальное недостающее попадает в `warnings` — генератор обязан
 * сказать, чего у формы не хватает, а не молча выдать полуфабрикат как готовый результат.
 */
export function normalizeIntent(partial: Partial<FormIntent>): FormIntent {
  const warnings = [...(partial.warnings ?? [])];
  const formName = partial.formName?.trim() || 'Form';

  // Безымянная запись — единственное, чего нормализация исправить не может: под именем поле
  // объявляется в модели, по имени на него ссылается разметка. Такие записи выбрасываются
  // ЗДЕСЬ и пересчитываются в warning: дальше по конвейеру их некому обнаружить, и билдер
  // ронял на них весь вызов.
  const dropped: string[] = [];
  const named = <T extends { name?: string; modelPath?: string }>(items: T[], what: string) =>
    items.filter((item) => {
      if (item && usableName(item) !== null) return true;
      dropped.push(what);
      return false;
    });

  const fields = named(partial.fields ?? [], 'поле').map((f) => {
    const name = usableName(f) as string;
    return { ...f, name, modelPath: f.modelPath ?? name, selector: f.selector ?? name };
  });

  const arrays = named(partial.arrays ?? [], 'массив').map((a) => {
    const name = usableName(a) as string;
    const declared = typeof a.itemInterfaceName === 'string' ? a.itemInterfaceName.trim() : '';
    if (!declared) {
      warnings.push(
        `Массив \`${name}\` без itemInterfaceName — интерфейс элемента назван по умолчанию.`
      );
    }
    return {
      ...a,
      name,
      modelPath: a.modelPath ?? name,
      itemInterfaceName: declared || `${toPascal(name.split('.').pop() ?? name) || 'Array'}Item`,
      itemFields: named(a.itemFields ?? [], `поле массива \`${name}\``).map((f) => {
        const fieldName = usableName(f) as string;
        return {
          ...f,
          name: fieldName,
          modelPath: f.modelPath ?? fieldName,
          selector: f.selector ?? fieldName,
        };
      }),
      // Массив без начального значения падает на первом добавлении строки.
      initialValue: Array.isArray(a.initialValue) ? a.initialValue : [],
    };
  });
  for (const what of new Set(dropped)) {
    const count = dropped.filter((d) => d === what).length;
    warnings.push(
      `Без имени, поэтому выброшено (${what}): ${count}. У записи обязателен \`name\`.`
    );
  }
  for (const a of arrays) {
    // Сверяем по тому же имени, что дала нормализация: исходная запись могла прийти вообще
    // без `name` (только `modelPath`), и поиск по `x.name` объявлял бы её «без initialValue».
    const source = (partial.arrays ?? []).find((x) => x && usableName(x) === a.name);
    if (!Array.isArray(source?.initialValue)) {
      warnings.push(`Массив \`${a.name}\` без initialValue — подставлен пустой массив.`);
    }
  }

  // Дедупликация источников данных: одно имя — одна регистрация в реестре.
  const dataSources = [
    ...new Map(
      (partial.dataSources ?? [])
        .filter((d) => d && typeof d.name === 'string' && d.name.trim())
        .map((d) => [d.name, d])
    ).values(),
  ];

  if (fields.length === 0 && arrays.length === 0) {
    warnings.push('В intent нет ни одного поля — бандл будет пустым каркасом.');
  }

  return {
    formName,
    interfaceName: partial.interfaceName?.trim() || deriveInterfaceName(formName),
    target: partial.target ?? 'core',
    layout: partial.layout ?? 'minimalist',
    layoutRoot: partial.layoutRoot ?? {
      kind: 'container',
      component: 'Box',
      children: [
        ...fields.map((f) => ({ kind: 'field' as const, ref: f.name })),
        ...arrays.map((a) => ({ kind: 'array' as const, ref: a.name })),
      ],
    },
    fields,
    arrays,
    validation: partial.validation ?? [],
    behavior: partial.behavior ?? [],
    visibility: partial.visibility ?? [],
    dataSources,
    wizard: partial.wizard,
    warnings,
  };
}

/** Все пути модели, которые intent объявляет, — база для кросс-проверок. */
export function modelPaths(intent: FormIntent): Set<string> {
  const paths = new Set<string>();
  for (const f of intent.fields) paths.add(f.modelPath ?? f.name);
  for (const a of intent.arrays) {
    const base = a.modelPath ?? a.name;
    paths.add(base);
    for (const f of a.itemFields) paths.add(`${base}.${f.modelPath ?? f.name}`);
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Чтение «интуитивного» intent
// ---------------------------------------------------------------------------

/**
 * Почему между аргументом инструмента и `normalizeIntent` стоит отдельный слой.
 *
 * `normalizeIntent` принимает `Partial<FormIntent>` — то есть уже ТЕ ЖЕ имена ключей, что в
 * контракте. Модель, зовущая `generate_form` не после `plan_form`, а «по памяти», присылает те
 * же сущности под интуитивными именами: `path` вместо `name`, `reads` вместо `sources`,
 * `behaviors` вместо `behavior`, шаги отдельным списком `steps`. Такой вход не нормализовался
 * и не отвергался — он доезжал до билдера и падал внутренней ошибкой MCP `-32603` («Cannot read
 * properties of undefined (reading 'split')»), не назвав ни поля, ни того, что делать дальше.
 * Описание инструмента при этом обещало «Partial input is normalised with warnings».
 *
 * Слой делает ровно две вещи: приводит синонимы к контракту (и говорит, что переименовал) и
 * ВЫБРАСЫВАЕТ записи, которые прочитать нельзя, называя каждую поимённо и с ожидаемым видом.
 * Догадок о смысле здесь нет: неизвестный вид поведения — это проблема входа, а не повод
 * придумать оператор, которого консумент не просил.
 */

/** Запись входа, которую прочитать не удалось. */
export interface IntentProblem {
  /** Место в присланном объекте: `fields[2].name`. */
  at: string;
  /** Что не так. */
  message: string;
  /** Какой вид ожидается вместо этого. */
  expected: string;
}

export interface IntentReading {
  /** Нормализованный intent из того, что прочитать удалось. */
  intent: FormIntent;
  /** Выброшенные записи. Пусто — вход прочитан целиком. */
  problems: IntentProblem[];
}

interface ReadCtx {
  warnings: string[];
  problems: IntentProblem[];
  /** `path → name`: печатается одной строкой, а не по разу на каждое поле. */
  renames: Set<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Значение канонического ключа либо первого из синонимов; переименование запоминается. */
function take(
  src: Record<string, unknown>,
  canonical: string,
  aliases: readonly string[],
  ctx: ReadCtx
): unknown {
  if (src[canonical] !== undefined) return src[canonical];
  for (const alias of aliases) {
    if (src[alias] !== undefined) {
      ctx.renames.add(`${alias} → ${canonical}`);
      return src[alias];
    }
  }
  return undefined;
}

/** Непустая строка либо `null`. */
function asName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Список из значения. Одиночка заворачивается (`rules: 'required'`), а объект-карта
 * разворачивается в записи (`fields: { lastName: { type } }` → `[{ name: 'lastName', … }]`) —
 * обе записи встречаются у моделей и обе читаются однозначно.
 */
function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  if (isRecord(value)) {
    return Object.entries(value).map(([name, v]) => (isRecord(v) ? { name, ...v } : { name }));
  }
  return [value];
}

/** Имена из списка: строки как есть, объекты — по `name` / `ref` / `path` / `field`. */
function asNames(value: unknown): string[] {
  return asList(value)
    .map((v) => asName(isRecord(v) ? (v.name ?? v.ref ?? v.path ?? v.field) : v))
    .filter((v): v is string => v !== null);
}

/** Как тип поля называют в спеках и в головах — против того, что понимает модель. */
const FIELD_TYPE_ALIASES: Record<string, FieldType> = {
  string: 'string',
  str: 'string',
  text: 'string',
  email: 'string',
  phone: 'string',
  enum: 'string',
  select: 'string',
  number: 'number',
  int: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  money: 'number',
  boolean: 'boolean',
  bool: 'boolean',
  flag: 'boolean',
  checkbox: 'boolean',
  date: 'date',
  datetime: 'date',
  timestamp: 'date',
  array: 'array',
  list: 'array',
  object: 'object',
  record: 'object',
  group: 'object',
};

/** Компонент по умолчанию — по типу значения; подставляется, только если своего не назвали. */
const DEFAULT_COMPONENT: Record<FieldType, string> = {
  string: 'Input',
  number: 'Input',
  boolean: 'Checkbox',
  date: 'DatePicker',
  array: 'FormArray',
  object: 'Input',
};

const BEHAVIOR_KINDS: ReadonlyArray<BehaviorIntent['kind']> = [
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
];

const BEHAVIOR_BY_KEY = new Map(BEHAVIOR_KINDS.map((kind) => [kind.toLowerCase(), kind]));

/**
 * Целевой стек по любому написанию: `react`, `renderer_react`, `@reformer/renderer-react`.
 *
 * `null` вместо тихого `core` — намеренно: «неизвестный таргет молча стал core» означает бандл
 * не того стека, и об этом консументу надо сказать, а не подставить.
 */
export function readTargetStack(value: unknown): ReformerTargetStack | null {
  const key = typeof value === 'string' ? value.toLowerCase().replace(/[^a-z]/g, '') : '';
  if (!key) return null;
  if (key.includes('json')) return 'renderer-json';
  if (key.includes('react')) return 'renderer-react';
  if (key.includes('core')) return 'core';
  return null;
}

function readFieldType(value: unknown, at: string, ctx: ReadCtx): FieldType {
  const raw = asName(value);
  if (!raw) {
    ctx.warnings.push(`${at}: тип не указан — принят \`string\`.`);
    return 'string';
  }
  const hit = FIELD_TYPE_ALIASES[raw.toLowerCase()];
  if (hit) return hit;
  ctx.warnings.push(
    `${at}: тип \`${raw}\` контракту неизвестен — принят \`string\` ` +
      '(допустимы string | number | boolean | date | array | object).'
  );
  return 'string';
}

function readField(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): { field: FieldIntent; required: boolean } | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'запись поля не объект',
      expected: '{ "name": "lastName", "type": "string", "component": "Input" }',
    });
    return null;
  }

  const modelPath = asName(take(raw, 'modelPath', ['path', 'model', 'binding'], ctx));
  const name = asName(take(raw, 'name', ['field', 'key', 'id'], ctx)) ?? modelPath;
  if (!name) {
    ctx.problems.push({
      at: `${at}.name`,
      message: 'у поля нет имени',
      expected: 'непустая строка `name` (либо `path` — путь в модели, он же станет именем)',
    });
    return null;
  }

  const type = readFieldType(
    take(raw, 'type', ['fieldType', 'valueType', 'dataType'], ctx),
    at,
    ctx
  );
  const component = asName(take(raw, 'component', ['componentName', 'widget', 'control'], ctx));
  if (!component) {
    ctx.warnings.push(
      `${at}: компонент не указан — принят \`${DEFAULT_COMPONENT[type]}\` по типу \`${type}\`.`
    );
  }

  const props = take(raw, 'componentProps', ['props'], ctx);
  const componentProps: Record<string, unknown> = isRecord(props) ? { ...props } : {};
  // `options` — двусмысленный ключ: строка это ИМЯ справочника (`$dataSource(...)`), массив —
  // готовые значения, и им место в пропсах компонента, а не в реестре источников.
  const options = take(raw, 'optionsSource', ['dataSource', 'optionsRef', 'options'], ctx);
  if (Array.isArray(options)) componentProps.options = options;

  const label = asName(take(raw, 'label', ['title', 'caption'], ctx));
  const selector = asName(take(raw, 'selector', ['nodeSelector'], ctx));
  const optionsSource = asName(options);
  const initialValue = take(raw, 'initialValue', ['defaultValue', 'default'], ctx);

  return {
    field: {
      name,
      modelPath: modelPath ?? name,
      type,
      component: component ?? DEFAULT_COMPONENT[type],
      ...(label ? { label } : {}),
      ...(selector ? { selector } : {}),
      ...(optionsSource ? { optionsSource } : {}),
      ...(Object.keys(componentProps).length > 0 ? { componentProps } : {}),
      ...(initialValue !== undefined ? { initialValue } : {}),
    },
    required: take(raw, 'required', ['isRequired', 'mandatory'], ctx) === true,
  };
}

function readArray(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): { array: ArrayIntent; required: string[] } | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'запись массива не объект',
      expected: '{ "name": "items", "itemInterfaceName": "OrderItem", "itemFields": [ … ] }',
    });
    return null;
  }

  const modelPath = asName(take(raw, 'modelPath', ['path'], ctx));
  const name = asName(take(raw, 'name', ['field', 'key', 'id'], ctx)) ?? modelPath;
  if (!name) {
    ctx.problems.push({
      at: `${at}.name`,
      message: 'у массива нет имени',
      expected: 'непустая строка `name` (либо `path` — путь в модели)',
    });
    return null;
  }

  const itemFields: FieldIntent[] = [];
  const required: string[] = [];
  asList(take(raw, 'itemFields', ['fields', 'columns'], ctx)).forEach((item, i) => {
    const read = readField(item, `${at}.itemFields[${i}]`, ctx);
    if (!read) return;
    itemFields.push(read.field);
    if (read.required) required.push(read.field.modelPath ?? read.field.name);
  });

  const itemInterfaceName = asName(
    take(raw, 'itemInterfaceName', ['itemType', 'itemInterface', 'itemName'], ctx)
  );
  const initialValue = take(raw, 'initialValue', ['initialRows', 'rows', 'defaultValue'], ctx);
  const component = asName(take(raw, 'component', ['componentName'], ctx));

  // `itemInterfaceName` и `initialValue` доводит до контракта `normalizeIntent` — она же и
  // предупреждает о подстановке, поэтому здесь они передаются как пришли.
  return {
    array: {
      name,
      modelPath: modelPath ?? name,
      itemInterfaceName: itemInterfaceName as string,
      itemFields,
      initialValue: initialValue as unknown[],
      ...(component ? { component } : {}),
    },
    required,
  };
}

function readValidationRule(raw: unknown, at: string, ctx: ReadCtx): ValidationRuleIntent | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'правило валидации не объект',
      expected: '{ "target": "price", "rules": ["required()", "min(1)"] }',
    });
    return null;
  }

  const target = asName(take(raw, 'target', ['field', 'path', 'name', 'for'], ctx));
  if (!target) {
    ctx.problems.push({
      at: `${at}.target`,
      message: 'правило не говорит, к какому полю относится',
      expected: '`target` — путь в модели, например `personal.lastName`',
    });
    return null;
  }

  const rules = asNames(take(raw, 'rules', ['rule', 'validators', 'checks'], ctx));
  const async = asName(take(raw, 'async', ['asyncValidator', 'asyncRule'], ctx));
  if (rules.length === 0 && !async) {
    ctx.problems.push({
      at: `${at}.rules`,
      message: `у правила на \`${target}\` нет ни одного валидатора`,
      expected: '`rules`: ["required()", "minLength(2)"] — фабрики из `@reformer/core/validators`',
    });
    return null;
  }

  const when = asName(take(raw, 'when', ['condition'], ctx));
  const each = asName(take(raw, 'each', ['array', 'arrayPath'], ctx));
  return {
    target,
    rules,
    ...(async ? { async } : {}),
    ...(when ? { when } : {}),
    ...(each ? { each } : {}),
  };
}

function readBehavior(raw: unknown, at: string, ctx: ReadCtx): BehaviorIntent | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'запись поведения не объект',
      expected: '{ "kind": "computeFrom", "target": "total", "sources": ["price"], "expr": "…" }',
    });
    return null;
  }

  const declared = asName(take(raw, 'kind', ['type', 'op', 'operator'], ctx));
  const kind = declared
    ? BEHAVIOR_BY_KEY.get(declared.toLowerCase().replace(/[^a-z]/g, ''))
    : undefined;
  if (!kind) {
    ctx.problems.push({
      at: `${at}.kind`,
      message: declared
        ? `вид поведения \`${declared}\` контракту неизвестен`
        : 'у поведения не указан вид',
      expected: `${BEHAVIOR_KINDS.join(' | ')} — подобрать под требование помогает \`choose_api\``,
    });
    return null;
  }

  const target = asName(take(raw, 'target', ['field', 'path', 'to', 'writes'], ctx));
  if (!target) {
    ctx.problems.push({
      at: `${at}.target`,
      message: `поведение \`${kind}\` не говорит, какое поле оно пишет`,
      expected: '`target` — путь в модели',
    });
    return null;
  }

  const expr = asName(
    take(raw, 'expr', ['expression', 'formula', 'code', 'when', 'condition'], ctx)
  );
  const options = take(raw, 'options', ['opts'], ctx);
  return {
    kind,
    target,
    sources: asNames(take(raw, 'sources', ['reads', 'deps', 'dependsOn', 'from', 'source'], ctx)),
    ...(expr ? { expr } : {}),
    ...(isRecord(options) ? { options } : {}),
  };
}

function readVisibility(raw: unknown, at: string, ctx: ReadCtx): VisibilityIntent | null {
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'правило видимости не объект',
      expected: '{ "selector": "spouseIncome", "condition": "model.married === false" }',
    });
    return null;
  }
  const selector = asName(take(raw, 'selector', ['node', 'target', 'field', 'ref'], ctx));
  const condition = asName(take(raw, 'condition', ['when', 'expr', 'hideWhen'], ctx));
  if (!selector || !condition) {
    ctx.problems.push({
      at,
      message: selector ? `у правила видимости \`${selector}\` нет условия` : 'нет selector узла',
      expected:
        '`selector` — selector узла из разметки, `condition` — выражение, при котором узел СКРЫТ',
    });
    return null;
  }
  return { selector, condition };
}

function readDataSource(raw: unknown, at: string, ctx: ReadCtx): DataSourceIntent | null {
  const plain = asName(raw);
  if (plain) return { name: plain };
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'источник данных не объект и не имя',
      expected: '"CURRENCIES" либо { "name": "CURRENCIES", "note": "откуда значения" }',
    });
    return null;
  }
  const name = asName(take(raw, 'name', ['id', 'key', 'source'], ctx));
  if (!name) {
    ctx.problems.push({
      at: `${at}.name`,
      message: 'у источника данных нет имени',
      expected: '`name` — то же имя, что в `$dataSource(...)` разметки',
    });
    return null;
  }
  const note = asName(take(raw, 'note', ['description', 'comment'], ctx));
  return { name, ...(note ? { note } : {}) };
}

function readStep(
  raw: unknown,
  at: string,
  ctx: ReadCtx
): { title: string; fields: string[] } | null {
  const plain = asName(raw);
  if (plain) return { title: plain, fields: [] };
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'шаг не объект и не заголовок',
      expected: '{ "title": "Личные данные", "fields": ["lastName", "firstName"] }',
    });
    return null;
  }
  return {
    title: asName(take(raw, 'title', ['label', 'name', 'caption'], ctx)) ?? at,
    fields: asNames(take(raw, 'fields', ['fieldNames', 'items', 'refs'], ctx)),
  };
}

function readLayoutNode(raw: unknown, at: string, ctx: ReadCtx): LayoutNode | null {
  if (raw === undefined || raw === null) return null;
  // Строка среди детей — ссылка на поле по имени: самая частая сокращённая запись.
  const plain = asName(raw);
  if (plain) return { kind: 'field', ref: plain };
  if (!isRecord(raw)) {
    ctx.problems.push({
      at,
      message: 'узел разметки не объект',
      expected: '{ "kind": "container", "component": "Box", "children": [ … ] }',
    });
    return null;
  }

  const kind = (asName(take(raw, 'kind', ['type'], ctx)) ?? '').toLowerCase();
  const selector = asName(take(raw, 'selector', [], ctx));

  if (kind === 'field' || kind === 'array') {
    const ref = asName(take(raw, 'ref', ['name', 'field', 'path'], ctx));
    if (!ref) {
      ctx.problems.push({
        at: `${at}.ref`,
        message: `узел \`${kind}\` не ссылается ни на что`,
        expected: '`ref` — имя поля или массива, объявленного в intent',
      });
      return null;
    }
    // selector осмыслен только у массива: у поля точка адресации — путь модели.
    return kind === 'array' && selector ? { kind, ref, selector } : { kind, ref };
  }

  const children = asList(take(raw, 'children', ['items', 'nodes', 'fields'], ctx))
    .map((child, i) => readLayoutNode(child, `${at}.children[${i}]`, ctx))
    .filter((child): child is LayoutNode => child !== null);

  if (kind === 'step') {
    return {
      kind: 'step',
      title: asName(take(raw, 'title', ['label'], ctx)) ?? 'Шаг',
      ...(selector ? { selector } : {}),
      children,
    };
  }

  if (kind && kind !== 'container' && kind !== 'group') {
    ctx.warnings.push(
      `${at}: вид узла \`${kind}\` контракту неизвестен — прочитан как контейнер ` +
        '(допустимы field | array | container | step).'
    );
  }
  const htmlTag = asName(take(raw, 'htmlTag', ['tag', 'html'], ctx));
  const component = asName(take(raw, 'component', ['componentName'], ctx));
  const props = take(raw, 'componentProps', ['props'], ctx);
  return {
    kind: 'container',
    component: component ?? (htmlTag ? 'div' : 'Box'),
    ...(htmlTag ? { htmlTag } : {}),
    ...(isRecord(props) ? { componentProps: props } : {}),
    ...(selector ? { selector } : {}),
    children,
  };
}

/**
 * Прочитать произвольный вход как `FormIntent`.
 *
 * Возвращает ВСЕГДА рабочий intent — из того, что удалось разобрать, — и отдельным списком то,
 * что пришлось выбросить. Бросать исключение здесь нельзя: у MCP оно превращается в `-32603`,
 * который консументу не сообщает ничего.
 */
export function readIntent(raw: unknown): IntentReading {
  const ctx: ReadCtx = { warnings: [], problems: [], renames: new Set() };

  let source: unknown = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
      ctx.warnings.push('`intent` пришёл строкой — разобран как JSON.');
    } catch (e) {
      ctx.problems.push({
        at: 'intent',
        message: `строка не разбирается как JSON: ${(e as Error).message}`,
        expected: 'объект FormIntent — целиком его отдаёт `plan_form`',
      });
      source = {};
    }
  }
  if (!isRecord(source)) {
    ctx.problems.push({
      at: 'intent',
      message: `получен ${Array.isArray(source) ? 'массив' : typeof source}`,
      expected: 'объект FormIntent — целиком его отдаёт `plan_form`',
    });
    source = {};
  }
  const src = source as Record<string, unknown>;

  const declaredTarget = take(src, 'target', ['stack', 'renderer'], ctx);
  const target = readTargetStack(declaredTarget);
  if (declaredTarget !== undefined && !target) {
    ctx.warnings.push(
      `Таргет \`${String(declaredTarget)}\` не распознан — принят \`core\` ` +
        '(допустимы core | renderer-react | renderer-json).'
    );
  }

  const fields: FieldIntent[] = [];
  const requiredTargets: Array<{ target: string; each?: string }> = [];
  asList(take(src, 'fields', ['formFields', 'inputs'], ctx)).forEach((item, i) => {
    const read = readField(item, `fields[${i}]`, ctx);
    if (!read) return;
    fields.push(read.field);
    if (read.required) requiredTargets.push({ target: read.field.modelPath ?? read.field.name });
  });

  const arrays: ArrayIntent[] = [];
  asList(take(src, 'arrays', ['formArrays', 'collections', 'repeatables'], ctx)).forEach(
    (item, i) => {
      const read = readArray(item, `arrays[${i}]`, ctx);
      if (!read) return;
      arrays.push(read.array);
      for (const path of read.required) {
        requiredTargets.push({ target: path, each: read.array.name });
      }
    }
  );

  const validation: ValidationRuleIntent[] = [];
  asList(take(src, 'validation', ['validations', 'validationRules', 'rules'], ctx)).forEach(
    (item, i) => {
      const rule = readValidationRule(item, `validation[${i}]`, ctx);
      if (rule) validation.push(rule);
    }
  );

  // `required: true` у поля — самая интуитивная запись обязательности, и до сих пор она молча
  // терялась: контракт держит валидацию отдельным списком. Поднимаем её в правило, но не
  // дублируем то, что консумент уже написал руками.
  const lifted = requiredTargets.filter(
    (r) =>
      !validation.some(
        (v) =>
          v.target === r.target && v.each === r.each && v.rules.some((x) => /^required\b/.test(x))
      )
  );
  for (const r of lifted) {
    validation.push({
      target: r.target,
      ...(r.each ? { each: r.each } : {}),
      rules: ['required()'],
    });
  }
  if (lifted.length > 0) {
    ctx.warnings.push(
      `Полей с \`required: true\`: ${lifted.length} — им добавлено правило \`required()\` ` +
        'в validation. Обязательность живёт там: в описании поля её держать негде.'
    );
  }

  const behavior: BehaviorIntent[] = [];
  asList(take(src, 'behavior', ['behaviors', 'behaviours', 'behaviour', 'reactions'], ctx)).forEach(
    (item, i) => {
      const read = readBehavior(item, `behavior[${i}]`, ctx);
      if (read) behavior.push(read);
    }
  );

  const visibility: VisibilityIntent[] = [];
  asList(take(src, 'visibility', ['visibilityRules', 'hidden', 'hideWhen'], ctx)).forEach(
    (item, i) => {
      const read = readVisibility(item, `visibility[${i}]`, ctx);
      if (read) visibility.push(read);
    }
  );

  const dataSources: DataSourceIntent[] = [];
  asList(take(src, 'dataSources', ['datasources', 'data_sources', 'dictionaries'], ctx)).forEach(
    (item, i) => {
      const read = readDataSource(item, `dataSources[${i}]`, ctx);
      if (read) dataSources.push(read);
    }
  );

  const wizardRaw = src.wizard;
  const stepsRaw =
    (isRecord(wizardRaw) ? take(wizardRaw, 'steps', ['pages'], ctx) : undefined) ??
    take(src, 'steps', ['pages', 'wizardSteps'], ctx);
  const steps = asList(stepsRaw)
    .map((item, i) => readStep(item, `steps[${i}]`, ctx))
    .filter((step): step is { title: string; fields: string[] } => step !== null);

  // `layout` в контракте — режим раскладки ФАЙЛОВ (строка), но модели кладут туда и дерево.
  const declaredLayout = src.layout;
  const layoutRoot = readLayoutNode(
    take(src, 'layoutRoot', ['root', 'tree'], ctx) ??
      (isRecord(declaredLayout) ? declaredLayout : undefined),
    'layoutRoot',
    ctx
  );

  if (steps.length > 0 && !layoutRoot) {
    // Честнее сказать, чем достроить: раскладка шагов по разметке — прикладное решение
    // (у core и renderer-react шаги живут инлайном в `index.tsx`), и угадывать её тут нечем.
    ctx.warnings.push(
      `Шагов в intent: ${steps.length} — они сохранены в \`wizard\`, но разметка собрана ` +
        'плоской: генератор шаги по узлам не раскладывает. Разложите поля сами — инлайном в ' +
        '`index.tsx` либо узлами `{ "kind": "step", "children": [ … ] }` в `layoutRoot`.'
    );
  }

  const notes: string[] = [];
  if (ctx.renames.size > 0) {
    notes.push(
      `Ключи приведены к контракту FormIntent: ${[...ctx.renames].sort().join(', ')}. ` +
        'Intent без переименований отдаёт `plan_form`.'
    );
  }
  notes.push(...ctx.warnings);

  const formName = asName(take(src, 'formName', ['name', 'title', 'form', 'formTitle'], ctx));
  const interfaceName = asName(
    take(src, 'interfaceName', ['modelName', 'modelInterface', 'interface'], ctx)
  );

  const intent = normalizeIntent({
    ...(formName ? { formName } : {}),
    ...(interfaceName ? { interfaceName } : {}),
    target: target ?? 'core',
    layout: asName(declaredLayout) === 'folders' ? 'folders' : 'minimalist',
    ...(layoutRoot ? { layoutRoot } : {}),
    fields,
    arrays,
    validation,
    behavior,
    visibility,
    dataSources,
    ...(steps.length > 0 ? { wizard: { steps } } : {}),
    // Свои предупреждения консумента (например, из `plan_form`) сохраняем: intent ходит
    // туда-обратно, и терять их на каждом круге — значит терять разбор спеки.
    warnings: [...asNames(src.warnings), ...notes],
  });

  return { intent, problems: ctx.problems };
}

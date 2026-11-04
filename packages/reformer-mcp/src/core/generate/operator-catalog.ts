/**
 * Операторы ядра, которыми пишется intent: фабрики правил `@reformer/core/validators`, операторы
 * схемы валидации `@reformer/core/validation` и операторы поведения `@reformer/core/behaviors` — и
 * чем каждый из них записывается в `form.intent.json`.
 *
 * Сервер публикуется отдельно от ядра и читать его экспорты в рантайме не может, поэтому таблицы
 * продублированы здесь, а расхождение с исходниками ядра ловит тест `tests/operator-catalog.test.ts`:
 * новый оператор в ядре без строки здесь — красный тест, а не оператор, о котором агент не узнает.
 * Раньше грамматика `form_build` называла 7 правил из 27, и о `minAge`, `fileType` или `phone`
 * агент узнать не мог.
 *
 * @module reformer-mcp/core/generate/operator-catalog
 */

/** Группа правил в грамматике: по типу значения, которое правило проверяет. */
export type ValidatorGroup = 'общие' | 'строки и списки' | 'числа' | 'даты' | 'файлы';

/** Фабрика правила ядра: как её записать в `rules` (аргументы — образец) и к какой группе она. */
export interface ValidatorSpec {
  call: string;
  group: ValidatorGroup;
}

/** Фабрики правил `@reformer/core/validators` в порядке грамматики. */
export const CORE_VALIDATORS: Readonly<Record<string, ValidatorSpec>> = {
  required: { call: 'required', group: 'общие' },
  email: { call: 'email', group: 'строки и списки' },
  url: { call: 'url', group: 'строки и списки' },
  phone: { call: 'phone', group: 'строки и списки' },
  pattern: { call: 'pattern(/re/)', group: 'строки и списки' },
  minLength: { call: 'minLength(n)', group: 'строки и списки' },
  maxLength: { call: 'maxLength(n)', group: 'строки и списки' },
  min: { call: 'min(n)', group: 'числа' },
  max: { call: 'max(n)', group: 'числа' },
  isNumber: { call: 'isNumber', group: 'числа' },
  integer: { call: 'integer', group: 'числа' },
  multipleOf: { call: 'multipleOf(n)', group: 'числа' },
  nonNegative: { call: 'nonNegative', group: 'числа' },
  nonZero: { call: 'nonZero', group: 'числа' },
  isDate: { call: 'isDate', group: 'даты' },
  minDate: { call: "minDate(new Date('2000-01-01'))", group: 'даты' },
  maxDate: { call: 'maxDate(new Date())', group: 'даты' },
  pastDate: { call: 'pastDate', group: 'даты' },
  futureDate: { call: 'futureDate', group: 'даты' },
  minAge: { call: 'minAge(18)', group: 'даты' },
  maxAge: { call: 'maxAge(n)', group: 'даты' },
  fileType: { call: "fileType('image/*,.pdf')", group: 'файлы' },
  maxFileSize: { call: 'maxFileSize(байты)', group: 'файлы' },
  minFileSize: { call: 'minFileSize(байты)', group: 'файлы' },
  maxFiles: { call: 'maxFiles(n)', group: 'файлы' },
  minFiles: { call: 'minFiles(n)', group: 'файлы' },
  maxTotalFileSize: { call: 'maxTotalFileSize(байты)', group: 'файлы' },
};

/** Экспорты `@reformer/core/validators`, которые не правила, а помощники для своих правил. */
export const VALIDATOR_HELPERS: readonly string[] = [
  'isFileLike',
  'matchesFileAccept',
  'toFileArray',
];

/** Правила ядра одной строкой по группам — для грамматики. */
export function renderValidatorList(): string {
  const groups = new Map<ValidatorGroup, string[]>();
  for (const spec of Object.values(CORE_VALIDATORS)) {
    groups.set(spec.group, [...(groups.get(spec.group) ?? []), spec.call]);
  }
  return [...groups]
    .map(([group, calls]) => (group === 'общие' ? calls.join(' ') : `${group}: ${calls.join(' ')}`))
    .join('; ');
}

/**
 * Операторы схемы валидации (`@reformer/core/validation`, модуль `operators`) → ключ правила
 * intent, которым сборка его печатает. `cross` — не экспорт, а параметр схемы; он здесь же, потому
 * что пишется тем же способом.
 */
export const VALIDATION_OPERATORS: Readonly<Record<string, string>> = {
  validate: 'rules',
  validateAsync: 'async',
  validateWhen: 'when',
  applyEach: 'each',
  cross: 'cross',
  apply: 'путь группы через точку',
};

/** Операторы поведения над моделью: каждый — свой `kind` записи `behavior`. */
export const MODEL_BEHAVIOR_KINDS = [
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

/**
 * Операторы над узлами схемы — тоже `kind` записи `behavior`, но адресуют узел по `selector`, а не
 * поле. Правила узлов исполняет рендерер, поэтому на таргете `core` они не печатаются.
 */
export const NODE_BEHAVIOR_KINDS = [
  'onComponentEvent',
  'renderEffect',
  'onInit',
  'onMount',
  'onUnmount',
] as const;

export type ModelBehaviorKind = (typeof MODEL_BEHAVIOR_KINDS)[number];
export type NodeBehaviorKind = (typeof NODE_BEHAVIOR_KINDS)[number];

/** Операторы поведения, которые записываются не своим `kind`, — чем именно. */
export const BEHAVIOR_KEY_OPERATORS: Readonly<Record<string, string>> = {
  applyEach: 'each',
  apply: 'путь группы через точку',
  hideWhen: 'visibility',
};

/**
 * Основа своих операторов поведения: обёртка схемы и низкоуровневый набор авторинга. В intent их не
 * пишут — ими написан оператор в модуле из `operators`, а intent его вызывает (`kind: "call"`).
 */
export const BEHAVIOR_AUTHORING: readonly string[] = [
  'defineFormBehavior',
  'effect',
  'defer',
  'onDispose',
  'getScope',
];

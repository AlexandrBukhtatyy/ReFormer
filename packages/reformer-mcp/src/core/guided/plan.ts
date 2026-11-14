/**
 * План профиля guided: этапы сборки формы, их состояние и один следующий вызов.
 *
 * План лежит файлом `form.plan.json` в каталоге формы, а не в памяти сервера и не в контексте
 * модели. Стенд держит целиком только четыре последних ответа инструментов, а малая модель теряет
 * маршрут через несколько шагов. Поэтому каждый ответ профиля заново вычисляет состояние с диска и
 * кончается строкой `Next:` с одним готовым вызовом.
 *
 * Готовность этапа решает сервер по содержимому intent, а не модель. «Готово» (`Done`) ставится,
 * только когда все этапы сделаны или пропущены, последняя сборка прошла на текущих файлах и типы
 * проверены. Так закрывается ложный успех: 7 из 14 проваленных прогонов qwen3.5:4b кончались
 * словами «форма успешно собрана» (аудит 2026-11).
 *
 * @module reformer-mcp/core/guided/plan
 */

import { formatTemplates, maskToPattern } from './edits.js';
import { readIntent, type FormIntent, type ReformerTargetStack } from '../generate/form-intent.js';
import { collectSteps } from '../generate/schema-emit.js';
import { behaviorWord, crossWord, validationWord, type TaskFeatures } from './features.js';

export const PLAN_FILE = 'form.plan.json';

/** Этапы в порядке исполнения. */
export const STAGE_ORDER = [
  'edit',
  'fields',
  'arrays',
  'wizard',
  'validation',
  'cross',
  'behavior',
  'markup',
] as const;
export type StageId = (typeof STAGE_ORDER)[number];

/** Последняя сборка: прошла ли она и на каких файлах. */
export interface BuildMark {
  readonly ok: boolean;
  readonly typesChecked: boolean;
  /** Отпечаток `form.intent.json`, на котором шла сборка. */
  readonly intent: string;
  /** Отпечаток `index.tsx` после сборки — на core разметку меняют и без intent. */
  readonly index: string;
}

export interface GuidedPlan {
  readonly version: 1;
  readonly formName: string;
  readonly target: ReformerTargetStack;
  readonly source: 'task' | 'spec';
  readonly specPath?: string;
  /**
   * Текст задания (до {@link TASK_LIMIT} знаков) — его ограничения напоминаются на этапе валидации:
   * модель копировала пример с одним `required` и теряла «от 2 до 100 символов» (L2-profile-json).
   */
  readonly task?: string;
  readonly stages: readonly StageId[];
  readonly skipped: readonly StageId[];
  /**
   * Этапы, которые модель сверила с заданием (`form_status {"confirm":…}`). Валидация «готова»
   * только после сверки: модель ставила один `required` и получала «готово», не вспомнив о длине и
   * формате из задания (L2-profile-json, 20261113T173706Z-63d7).
   */
  readonly confirmed?: readonly StageId[];
  /**
   * Сверку при расхождениях уже пытались подтвердить: второе подтверждение принимается (эвристика
   * может ошибиться), первое — нет. Модель подтверждала, не глядя на «the task names 1, 10, 12», и
   * сдавала форму с двумя полями из четырёх (L2-event-signup, 20261113T184634Z-977e).
   */
  readonly confirmTried?: boolean;
  /**
   * Правка готовой формы: `formStart` пришёл, когда intent уже лежал в каталоге, а плана не было. Задание
   * — изменение, план — один этап `edit`, сверка — только по дельте. Без этого режима модель в 8 из 9
   * правок переписывала файлы руками, а единственная правка путём guided получала проверки создания
   * формы и снимала верные правила (батч 20261114T113832Z-68e8).
   */
  readonly mode?: 'edit';
  /** Правка: состав формы на старте — для строки «что изменилось». */
  readonly baseline?: Baseline;
  /** Правка: с начала плана принята хотя бы одна правка. */
  readonly edited?: boolean;
  /**
   * `add_array` уже отклоняли «в плане нет строк»: повтор принимается и добавляет этап. Модель на core
   * получила этот отказ 10 раз подряд и не вызвала `form_status {"add":"arrays"}` (order-create, 68e8).
   */
  readonly rowsTried?: boolean;
  /**
   * Форма, которую последней писал сервер: отпечаток и текст (`null` — сервер её ещё не писал). Intent,
   * написанный руками, сервер возвращает к этой версии: модель уходила писать его сама после ответа
   * сборки «fix form.intent.json» и теряла правила (батч 20261114T183644Z-ab51).
   */
  readonly intentPrint?: string;
  readonly intentCopy?: string | null;
  readonly lastBuild?: BuildMark;
}

/** Состав формы: пути полей, массивы, заголовки шагов. */
export interface Baseline {
  readonly fields: readonly string[];
  readonly arrays: readonly string[];
  readonly steps: readonly string[];
  /** Проверки каждого поля на старте: имена валидаторов, `cross`, `async`. */
  readonly rules?: Readonly<Record<string, readonly string[]>>;
  /** Подписи полей на старте: удалённое поле по-прежнему перекрывает свою подпись в задании. */
  readonly labels?: Readonly<Record<string, string>>;
}

/**
 * Этапы под признаки задачи: поля и валидация всегда, разметка — только на core. Валидация не
 * зависит от слов задания: модель пересказывает их своими словами (и даже транслитом), и
 * «оба обязательны» терялось вместе с этапом (L1-login, батч 20261113T164955Z-8b0d). Задаче без
 * правил этап снимает `skip`.
 */
export function stagesFor(features: TaskFeatures, target: ReformerTargetStack): StageId[] {
  return STAGE_ORDER.filter((stage) => {
    switch (stage) {
      case 'edit':
        return false;
      case 'fields':
      case 'validation':
        return true;
      case 'markup':
        return target === 'core';
      default:
        return features[stage];
    }
  });
}

/** Этапы, которые модель может снять (`skip`) или добавить (`add`): не поля, не разметка, не правка. */
export const OPTIONAL_STAGES: readonly StageId[] = STAGE_ORDER.filter(
  (stage) => stage !== 'fields' && stage !== 'markup' && stage !== 'edit'
);

/** Отпечаток текста: FNV-1a, 32 бита. В `core/` нет node-глобалов, поэтому без `crypto`. */
export function fingerprint(text: string | null): string {
  let hash = 0x811c9dc5;
  for (const char of text ?? '') {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const isStage = (value: unknown): value is StageId =>
  typeof value === 'string' && (STAGE_ORDER as readonly string[]).includes(value);

/** План из файла; битый или чужой файл — `null`, как если бы плана не было. */
/** Сколько знаков задания хранит план. */
export const TASK_LIMIT = 600;

export function parsePlan(text: string | null): GuidedPlan | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const plan = raw as Partial<GuidedPlan> | null;
  if (!plan || plan.version !== 1 || !Array.isArray(plan.stages)) return null;
  if (!plan.stages.every(isStage) || typeof plan.target !== 'string') return null;
  return {
    version: 1,
    formName: typeof plan.formName === 'string' ? plan.formName : 'Form',
    target: plan.target,
    source: plan.source === 'spec' ? 'spec' : 'task',
    ...(typeof plan.specPath === 'string' ? { specPath: plan.specPath } : {}),
    ...(typeof plan.task === 'string' ? { task: plan.task } : {}),
    stages: plan.stages,
    skipped: Array.isArray(plan.skipped) ? plan.skipped.filter(isStage) : [],
    ...(Array.isArray(plan.confirmed) ? { confirmed: plan.confirmed.filter(isStage) } : {}),
    ...(plan.confirmTried === true ? { confirmTried: true } : {}),
    ...(plan.mode === 'edit' ? { mode: 'edit' as const } : {}),
    ...(plan.baseline && typeof plan.baseline === 'object'
      ? {
          baseline: {
            fields: strings(plan.baseline.fields),
            arrays: strings(plan.baseline.arrays),
            steps: strings(plan.baseline.steps),
            ...(plan.baseline.labels && typeof plan.baseline.labels === 'object'
              ? {
                  labels: Object.fromEntries(
                    Object.entries(plan.baseline.labels).filter(
                      (entry): entry is [string, string] => typeof entry[1] === 'string'
                    )
                  ),
                }
              : {}),
            ...(plan.baseline.rules && typeof plan.baseline.rules === 'object'
              ? {
                  rules: Object.fromEntries(
                    Object.entries(plan.baseline.rules).map(([path, names]) => [
                      path,
                      strings(names),
                    ])
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(plan.edited === true ? { edited: true } : {}),
    ...(plan.rowsTried === true ? { rowsTried: true } : {}),
    ...(typeof plan.intentPrint === 'string'
      ? {
          intentPrint: plan.intentPrint,
          intentCopy: typeof plan.intentCopy === 'string' ? plan.intentCopy : null,
        }
      : {}),
    ...(plan.lastBuild ? { lastBuild: plan.lastBuild } : {}),
  };
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Состав формы по intent — исходная точка правки. */
export function baselineOf(intent: FormIntent): Baseline {
  return {
    fields: intent.fields.map((field) => field.modelPath ?? field.name),
    arrays: intent.arrays.map((array) => array.name),
    steps: collectSteps(intent.layoutRoot).map((step) => String(step.title ?? '')),
    rules: checksByField(intent),
    labels: Object.fromEntries(
      intent.fields.map((field) => [field.modelPath ?? field.name, field.label ?? ''])
    ),
  };
}

/** Проверки полей формы (вне строк массивов): имена валидаторов, `cross`, `async`. */
function checksByField(intent: FormIntent): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const row of intent.validation) {
    if (row.each !== undefined) continue;
    const names = [
      ...row.rules.map((rule) => /^\s*(\w+)/.exec(rule)?.[1] ?? rule),
      ...(row.cross ? ['cross'] : []),
      ...(row.async ? ['async'] : []),
    ];
    (out[row.target] ??= []).push(...names);
  }
  return out;
}

export function serializePlan(plan: GuidedPlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}

/** Intent с диска, прочитанный без справочников: для подсчёта этапов их не нужно. */
export function intentOf(text: string | null): FormIntent | null {
  if (text === null) return null;
  try {
    return readIntent(JSON.parse(text)).intent;
  } catch {
    return null;
  }
}

/**
 * Поля без единого правила (вычисляемые и только для чтения не в счёт). Этап валидации засчитывался
 * по одному правилу — и «готово» приходило с необязательными телефоном и городом (L2-profile-json,
 * 20261113T171142Z-19e3). Теперь каждое поле получает правило или этап снимают `skip`.
 */
export function unruled(intent: FormIntent): string[] {
  const rows = intent.validation.filter((row) => !row.cross && row.rules.length > 0);
  return intent.fields
    .filter((field) => field.componentProps?.readOnly !== true)
    .filter((field) => {
      const path = field.modelPath ?? field.name;
      const rules = rows.filter((row) => row.target === path).flatMap((row) => row.rules);
      const mask = field.componentProps?.mask;
      if (typeof mask !== 'string') return rules.length === 0;
      // Поле с маской: проверку формата ставит сервер; этап ждёт решения модели об остальном
      // (обязательность, длина) — правила сверх выражения по маске — или skip.
      const own = `/${maskToPattern(mask)}/`;
      const patterned = rules.some((rule) => /^\s*pattern\s*\(/.test(rule));
      const beyondMask = rules.some((rule) => !rule.includes(own));
      return !patterned || !beyondMask;
    })
    .map((field) => field.modelPath ?? field.name);
}

/** Умолчание задания: «по умолчанию выбран defect» → поле перед фразой и значение. */
interface TaskDefault {
  readonly phrase: string;
  readonly field: string;
  readonly value: string;
}

/**
 * Умолчания, которые задание называет словами («по умолчанию 0», «by default is ru»), с полем —
 * ближайшим «(имя)» перед фразой, если такое поле в форме есть. Модель пропускала умолчание, и
 * сверка его не видела: «0» занят правилом `min(0)`, а «defect» не число (L3-refund,
 * 20261113T210742Z-5a45).
 */
function taskDefaults(task: string, intent: FormIntent): TaskDefault[] {
  const paths = new Set(intent.fields.map((field) => field.modelPath ?? field.name));
  const out: TaskDefault[] = [];
  const phrase =
    /(?:по умолчанию(?:\s+(?:выбран[аоы]?|стоит|равн[аоы]?))?|by default(?:\s+is)?|defaults? to)\s*[:—–-]?\s*[«"']?([\p{L}\d_-]+(?:[.,]\d+)?)/giu;
  for (const match of task.matchAll(phrase)) {
    const before = task.slice(0, match.index);
    const names = [...before.matchAll(/\(([A-Za-z_$][\w$.]*)/g)].map((m) => m[1]);
    const field = names.reverse().find((name) => paths.has(name));
    if (field) out.push({ phrase: match[0].trim(), field, value: match[1] });
  }
  return out;
}

/** Поле, которое задание делает обязательным или видимым по условию, а форма — нет. */
interface FieldGap {
  readonly field: string;
  readonly said: string;
  readonly fix?: Record<string, unknown>;
}

const REQUIRED_WORDS = /обязател|\brequired\b/i;
const OPTIONAL_WORDS = /не\s*обязател|\boptional\b|\bnot required\b/i;
const VISIBLE_WORDS = /видн|виден|видим|показыва|скрыва|\bvisible\b|\bshown\b|\bhidden\b/i;

/**
 * Обязательность и видимость, которые задание говорит про поле в его окне, а в форме их нет. Модель
 * подтверждала сверку без правила «Комментарий (comment) виден и обязателен только при other»: сверка
 * искала только числа и форматы (L3-refund, 20261113T220710Z-1415). Окно — без хвоста фразы: в нём
 * только своё поле (точность важнее полноты — по расхождению модель правит форму).
 */
function fieldGaps(
  task: string,
  intent: FormIntent
): { required: FieldGap[]; visible: FieldGap[] } {
  const required: FieldGap[] = [];
  const visible: FieldGap[] = [];
  const lower = task.toLowerCase();
  for (const field of intent.fields) {
    const path = field.modelPath ?? field.name;
    if (field.componentProps?.readOnly === true || mention(lower, field) === null) continue;
    const said = taskFragment(task, intent, path);
    const rules = intent.validation
      .filter((row) => row.target === path)
      .flatMap((row) => row.rules);
    if (
      REQUIRED_WORDS.test(said) &&
      !OPTIONAL_WORDS.test(said) &&
      !rules.some((rule) => /^\s*required\s*\(/.test(rule))
    ) {
      required.push({ field: path, said, fix: { op: 'add_rule', field: path, required: true } });
    }
    if (
      intent.target !== 'core' &&
      VISIBLE_WORDS.test(said) &&
      !intent.visibility.some((row) => row.selector === path)
    ) {
      const condition = conditionIn(said, intent, path);
      visible.push({
        field: path,
        said,
        ...(condition ? { fix: { op: 'add_visibility', field: path, showWhen: condition } } : {}),
      });
    }
  }
  return { required, visible };
}

/**
 * Соседи по условию: фраза начинается с условия («При доставке становятся обязательными адрес
 * (address) и желаемая дата (deliveryDate) …»), и до «;» она говорит одно про все названные поля.
 * У одного соседа видимость или «when» обязательности есть, у другого нет — расхождение, правка
 * берёт условие соседа. Модель делала адрес обязательным всегда, а дату — только при доставке
 * (L3-delivery, 20261113T230859Z-f59e). Фраза без условия в начале соседей не даёт: «имя и email
 * обязательны, телефон — при согласии» про разные поля.
 */
function siblingGaps(
  task: string,
  intent: FormIntent
): Array<{ text: string; fix: Record<string, unknown> }> {
  const lower = task.toLowerCase();
  const groups = new Map<number, string[]>();
  for (const field of intent.fields) {
    const at = mention(lower, field);
    if (!at || field.componentProps?.readOnly === true) continue;
    const before = task.slice(0, at.at);
    const start =
      Math.max(before.lastIndexOf('.'), before.lastIndexOf(';'), before.lastIndexOf(':')) + 1;
    const clause = task.slice(start);
    if (!/^\s*(при|если|когда|только при|when|if)(?![а-яёa-z])/i.test(clause)) continue;
    const end = clause.search(/[.;]/);
    if (end >= 0 && start + end < at.at) continue;
    const path = field.modelPath ?? field.name;
    groups.set(start, [...(groups.get(start) ?? []), path]);
  }
  const out: Array<{ text: string; fix: Record<string, unknown> }> = [];
  const shown = (path: string): string | undefined => {
    const hide = intent.visibility.find((row) => row.selector === path)?.condition;
    if (hide === undefined) return undefined;
    const inner = /^!\((.*)\)$/.exec(hide.trim());
    return inner ? inner[1] : `!(${hide})`;
  };
  const requiredWhen = (path: string): { has: boolean; when?: string } => {
    const row = intent.validation.find(
      (r) => r.target === path && r.rules.some((rule) => /^\s*required\s*\(/.test(rule))
    );
    return { has: row !== undefined, ...(row?.when ? { when: row.when } : {}) };
  };
  for (const paths of groups.values()) {
    if (paths.length < 2) continue;
    const show = paths.map(shown).find((value) => value !== undefined);
    const lead = paths.find((path) => shown(path) !== undefined);
    if (show && intent.target !== 'core') {
      for (const path of paths.filter((p) => shown(p) === undefined)) {
        out.push({
          text: `the task says the same of ${path} as of ${lead} — ${lead} is shown only when ${show}, ${path} always`,
          fix: { op: 'add_visibility', field: path, showWhen: show },
        });
      }
    }
    const conditional = paths.map(requiredWhen).find((r) => r.when !== undefined)?.when;
    const source = paths.find((path) => requiredWhen(path).when !== undefined);
    if (conditional) {
      for (const path of paths) {
        const own = requiredWhen(path);
        if (own.has && own.when === undefined) {
          out.push({
            text: `the task says the same of ${path} as of ${source} — ${source} is required only when ${conditional}, ${path} always`,
            fix: { op: 'add_rule', field: path, required: true, when: conditional },
          });
        }
      }
    }
  }
  return out;
}

/** Условие из окна поля: ровно один вариант выбора другого поля назван в нём своим значением. */
function conditionIn(said: string, intent: FormIntent, path: string): string | undefined {
  const found: string[] = [];
  for (const field of intent.fields) {
    const name = field.modelPath ?? field.name;
    const options = field.componentProps?.options;
    if (name === path || !Array.isArray(options)) continue;
    for (const option of options as Array<{ value?: unknown }>) {
      const value = option !== null && typeof option === 'object' ? option.value : option;
      if (typeof value !== 'string' || !/^[\w-]+$/.test(value)) continue;
      if (new RegExp(`(?<![\\w-])${value}(?![\\w-])`).test(said))
        found.push(`model.${name} === '${value}'`);
    }
  }
  return found.length === 1 ? found[0] : undefined;
}

/** Слова в скобках, которые не имена полей: «(required)», «(optional)». */
const NOT_FIELD_NAMES: ReadonlySet<string> = new Set([
  'required',
  'optional',
  'readonly',
  'default',
  'min',
  'max',
  'eg',
  'ie',
  'etc',
  'yes',
  'no',
  'true',
  'false',
]);

/**
 * Поля, которые задание называет латинским именем в скобках («К возврату (refund)»), а в форме их
 * нет. Модель теряла поле и подтверждала сверку: она искала только ограничения (L3-refund,
 * 20261113T220710Z-1415). Подпись — слова перед скобкой.
 */
function missingFields(task: string, intent: FormIntent): Array<{ name: string; label: string }> {
  const known = new Set<string>();
  for (const field of intent.fields) known.add(field.modelPath ?? field.name).add(field.name);
  for (const array of intent.arrays) {
    known.add(array.name);
    for (const item of array.itemFields) known.add(item.name);
  }
  for (const field of intent.fields) {
    const options = field.componentProps?.options;
    if (!Array.isArray(options)) continue;
    for (const option of options as Array<{ value?: unknown }>) {
      const value = option !== null && typeof option === 'object' ? option.value : option;
      if (typeof value === 'string') known.add(value);
    }
  }
  const out: Array<{ name: string; label: string }> = [];
  for (const match of task.matchAll(/\(([a-z][A-Za-z0-9]*)(?=[\s,:;)])/g)) {
    const name = match[1];
    if (known.has(name) || NOT_FIELD_NAMES.has(name) || out.some((f) => f.name === name)) continue;
    const words =
      task
        .slice(0, match.index)
        .split(/[.,;:()—]/)
        .pop()
        ?.trim() ?? '';
    const label = words ? `${words[0].toUpperCase()}${words.slice(1)}` : name;
    out.push({ name, label });
  }
  return out;
}

/** Умолчания задания, которых в форме нет. */
function missingDefaults(task: string, intent: FormIntent): TaskDefault[] {
  return taskDefaults(task, intent).filter((entry) => {
    const field = intent.fields.find((f) => (f.modelPath ?? f.name) === entry.field);
    const initial = field?.initialValue;
    if (initial !== undefined && initial !== null && String(initial) === entry.value) return false;
    const options = field?.componentProps?.options;
    // Подпись варианта вместо значения — тоже это умолчание.
    return !(
      Array.isArray(options) &&
      (options as Array<{ value?: unknown; label?: unknown }>).some(
        (option) =>
          option !== null &&
          typeof option === 'object' &&
          String(option.value) === String(initial) &&
          String(option.label).toLowerCase() === entry.value.toLowerCase()
      )
    );
  });
}

/**
 * Расхождения формы с заданием, которые видны без разбора языка: маска не из задания и числа
 * задания, которых нет ни в правиле, ни в лимите строк, ни в варианте. Модель подтверждала сверку,
 * не сравнивая, — «ФИО (2–100 символов)» писала в отчёте, а `minLength(2)` в форме не было
 * (L2-profile-json, 20261113T174711Z-6256). Эвристика: подтвердить можно и при расхождениях.
 */
export function taskGaps(task: string | undefined, intent: FormIntent): string[] {
  if (!task) return [];
  const gaps: string[] = [];
  const templates = formatTemplates(task);
  const masks = intent.fields
    .map((field) => ({ field, mask: field.componentProps?.mask }))
    .filter(
      (entry): entry is { field: (typeof intent.fields)[number]; mask: string } =>
        typeof entry.mask === 'string'
    );
  for (const { field, mask } of masks) {
    if (
      templates.length > 0 &&
      // Цифры с обеих сторон — девятки: «+7» шаблона и «+7» маски совпадают.
      !templates.some((template) => template.replace(/\d/g, '9') === mask.replace(/\d/g, '9'))
    ) {
      gaps.push(
        `the mask of ${field.modelPath ?? field.name} «${mask}» is not the format of the task «${templates[0]}» (9 for each digit)`
      );
    }
  }
  for (const path of strayMasks(task, intent)) {
    gaps.push(
      `the mask of ${path} is the format of another input of the task — the task names no format for ${path}: "mask":"" removes it`
    );
  }
  // Варианты выбора стоят в задании сразу после подписи своего поля («город из списка Москва, …»).
  // Далеко от подписи — это варианты другого поля задания: модель вешала их на первое поле и теряла
  // поле города (L2-profile-json, 20261113T182123Z-e308).
  const lower = task.toLowerCase();
  for (const field of intent.fields) {
    const options = field.componentProps?.options;
    const label = (field.label ?? '').toLowerCase().trim();
    if (!Array.isArray(options) || options.length === 0 || !label) continue;
    const first = options[0] as { label?: unknown } | string;
    const text = String(
      typeof first === 'object' && first !== null ? (first.label ?? '') : first
    ).toLowerCase();
    const at = text ? lower.indexOf(text) : -1;
    if (at < 0) continue;
    // Подпись поля, её первое слово или имя в скобках: модель писала «Причина возврата», а задание —
    // «Причина (reason): defect — брак» (L3-refund, 20261113T230859Z-f59e).
    const name = (field.modelPath ?? field.name).toLowerCase();
    const lead = label.split(/\s+/)[0] ?? '';
    const near = [label, lead.length >= 3 ? lead : '', `(${name}`].filter(Boolean).some((key) => {
      const keyAt = lower.lastIndexOf(key, at);
      return keyAt >= 0 && at - (keyAt + key.length) <= 40;
    });
    if (near) continue;
    gaps.push(
      `the choices of ${field.modelPath ?? field.name} «${field.label}» stand in the task far from «${field.label}» — they belong to the input named right before them; is that input missing?`
    );
  }
  if (templates.length > 0 && masks.length === 0) {
    gaps.push(`the format of the task «${templates[0]}» is on no field — "mask" on its field`);
  }
  // Числа задания вне шаблонов формата и формул.
  const named = taskNumbers(task);
  const used = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'number') used.add(String(value));
    else if (typeof value === 'string')
      for (const match of value.matchAll(/\d+/g)) used.add(match[0]);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(intent.validation.map((row) => [row.rules, row.when, row.cross]));
  // Числа формул и условий — тоже из задания: «× (1 − скидка/100)» давало ложное «names 1, 100».
  collect(intent.behavior.map((row) => [row.expr, row.when]));
  collect(intent.visibility.map((row) => row.condition));
  collect(intent.fields.map((field) => field.initialValue));
  collect(intent.fields.map((field) => [field.componentProps, field.label]));
  collect(intent.arrays.map((array) => [array.componentProps, array.itemFields]));
  used.add(String(collectSteps(intent.layoutRoot).length));
  const missing = [...named].filter((number) => !used.has(number));
  if (missing.length > 0) {
    gaps.push(`the task names ${missing.join(', ')} — no rule or setting of the form uses it`);
  }
  // Обратное: граница правила, которой в задании нет. Модель ставила email «min 6, max 10», и
  // настоящий адрес уже не проходил (L2-registration-lite, 20261113T202828Z-32b0).
  for (const field of missingFields(task, intent)) {
    gaps.push(
      `the task names the input ${field.name} «${field.label}» — the form has no such field`
    );
  }
  for (const gap of siblingGaps(task, intent)) gaps.push(gap.text);
  const { required, visible } = fieldGaps(task, intent);
  for (const gap of required) {
    gaps.push(`the task makes ${gap.field} required («${gap.said}») — no "required" rule on it`);
  }
  for (const gap of visible) {
    gaps.push(
      `the task shows ${gap.field} only on a condition («${gap.said}») — add_visibility for it`
    );
  }
  for (const entry of missingDefaults(task, intent)) {
    gaps.push(
      `the task names the default «${entry.phrase}» — ${entry.field} has no "initialValue" ${entry.value}`
    );
  }
  for (const bound of inventedBounds(task, intent)) {
    gaps.push(
      bound.elsewhere
        ? `the form limits ${bound.field} by ${bound.name}(${bound.value}) — the task names ${bound.value} for ${bound.elsewhere}, not for ${bound.field}`
        : `the form limits ${bound.field} by ${bound.name}(${bound.value}) — the task names no ${bound.value}`
    );
  }
  // Подписи — из задания и на его языке: контракт и пользователь ищут «Повтор пароля», а модель
  // переводила подписи на английский (L2-registration-lite).
  const foreign = foreignLabels(task, intent);
  if (foreign.length > 0) {
    gaps.push(
      `the labels ${foreign.map((label) => `«${label}»`).join(', ')} are not in the task — take each label from the task, in its language`
    );
  }
  return gaps;
}

/** Числа задания вне шаблонов формата и формул. */
function taskNumbers(task: string): Set<string> {
  return new Set(
    [...limitText(task).matchAll(/(?<!\d|\d\.)\d+(?!\d|\.\d)/g)].map((match) => match[0])
  );
}

/**
 * Текст задания, где могут стоять границы: шаблоны формата и числа формул заменены пробелами.
 * Число формулы — операнд арифметики («× (1 − скидка/100)»): это не граница поля. На сверке до
 * этапа поведения формулы в форме ещё нет, и «1, 100» объявлялись границами без правила — модель
 * гоняла правила скидки по кругу, а пара «1 … 100» давала готовую правку `max: 100`
 * (L3-order-total, 20261113T210742Z-5a45). Дефис — оператор только между словами через пробелы:
 * «2-100 символов» — диапазон.
 */
function limitText(task: string): string {
  let rest = task;
  for (const template of formatTemplates(task)) rest = rest.split(template).join(' ');
  const before = [/[\p{L}\d)%]\s*[×*/÷−+]\s*\(*\s*$/u, /[\p{L})]\s+-\s+\(*\s*$/u];
  const after = [/^\s*\)*\s*[×*/÷−+]\s*\(*\s*[\p{L}\d(]/u, /^\s*\)*\s+-\s+\(*\s*[\p{L}(]/u];
  return rest.replace(/(?<!\d|\d\.)\d+(?:\.\d+)?(?!\d|\.\d)/g, (number, at: number) => {
    const head = rest.slice(Math.max(0, at - 40), at);
    const tail = rest.slice(at + number.length, at + number.length + 40);
    const operand =
      before.some((pattern) => pattern.test(head)) || after.some((pattern) => pattern.test(tail));
    // Маркер списка «1) … 2) …» вне скобок — не граница (L4-wizard-3steps: «the task names 1, 2»);
    // «(от 0 до 50)» — граница: число внутри открытой скобки.
    const prefix = rest.slice(0, at);
    // Глубина скобок не уходит ниже нуля: «)» самих маркеров списка её не сбивает.
    let depth = 0;
    for (const char of prefix) {
      if (char === '(') depth++;
      else if (char === ')') depth = Math.max(0, depth - 1);
    }
    const marker = depth <= 0 && /^\)/.test(tail) && /(^|[\s:;,])$/.test(prefix);
    // Число, склеенное с буквами (код `ABC123`), и длительность («через 300 мс») — не ограничения
    // формы: «the task names 123, 300» уводило модель с подтверждения (батч 20261114T192434Z-731c).
    const glued = /\p{L}$/u.test(head) || /^\p{L}/u.test(tail);
    const duration =
      /^\s*(?:мс|ms|миллисекунд|сек(?:унд)?|sec(?:onds?)?|s\b|мин(?:ут)?\b|min(?:utes?)?\b|час|hours?\b)/iu.test(
        tail
      );
    return operand || marker || glued || duration ? ' '.repeat(number.length) : number;
  });
}

/**
 * Маска на поле, в окне которого формата нет, а в окне другого поля он есть: модель вешала маску
 * телефона и на ФИО (L2-profile-json, 20261114T005219Z-43ce).
 */
function strayMasks(task: string, intent: FormIntent): string[] {
  const templates = formatTemplates(task);
  if (templates.length === 0) return [];
  const lower = task.toLowerCase();
  const windows = new Map<string, string>();
  for (const field of intent.fields) {
    if (mention(lower, field) === null) continue;
    const path = field.modelPath ?? field.name;
    windows.set(path, taskFragment(task, intent, path));
  }
  const hasFormat = (text: string): boolean =>
    templates.some((template) => text.includes(template));
  return intent.fields
    .filter((field) => typeof field.componentProps?.mask === 'string')
    .map((field) => field.modelPath ?? field.name)
    .filter((path) => {
      const own = windows.get(path);
      if (own === undefined || hasFormat(own)) return false;
      return [...windows.entries()].some(([other, text]) => other !== path && hasFormat(text));
    });
}

/** Границы правил (min/max/minLength/maxLength), чисел которых в задании нет. */
function inventedBounds(
  task: string,
  intent: FormIntent
): Array<{ field: string; name: string; value: string; elsewhere?: string }> {
  const named = taskNumbers(task);
  const out: Array<{ field: string; name: string; value: string; elsewhere?: string }> = [];
  const lower = task.toLowerCase();
  const numbersOf = (text: string): Set<string> =>
    new Set([...limitText(text).matchAll(/(?<!\d|\d\.)\d+(?!\d|\.\d)/g)].map((m) => m[0]));
  const windows = new Map<string, Set<string>>();
  for (const field of intent.fields) {
    if (mention(lower, field) === null) continue;
    const path = field.modelPath ?? field.name;
    windows.set(path, numbersOf(taskFragment(task, intent, path)));
  }
  for (const row of intent.validation) {
    for (const rule of row.rules) {
      const call = /^\s*(minLength|maxLength|min|max)\s*\(\s*(\d+)/.exec(rule);
      if (!call) continue;
      if (!named.has(call[2])) {
        out.push({ field: row.target, name: call[1], value: call[2] });
        continue;
      }
      // Число задания, но про другое поле: «промокод не длиннее 12» давало email maxLength(12), и
      // настоящий адрес не проходил (L2-event-signup, 20261114T005219Z-43ce).
      const own = windows.get(row.target);
      const other = [...windows.entries()].find(
        ([path, numbers]) => path !== row.target && numbers.has(call[2])
      );
      if (own && !own.has(call[2]) && other)
        out.push({ field: row.target, name: call[1], value: call[2], elsewhere: other[0] });
    }
  }
  return out;
}

/** Подписи латиницей, которых нет в кириллическом задании. */
function foreignLabels(task: string, intent: FormIntent): string[] {
  const letters = task.match(/\p{L}/gu) ?? [];
  const cyrillic = letters.filter((letter) => /[а-яё]/i.test(letter)).length;
  if (letters.length === 0 || cyrillic / letters.length < 0.5) return [];
  const lower = task.toLowerCase();
  return [...intent.fields, ...intent.arrays.flatMap((array) => array.itemFields)]
    .map((field) => field.label ?? '')
    .filter((label) => label && !/[а-яё]/i.test(label) && !lower.includes(label.toLowerCase()));
}

/**
 * Готовые правки под расхождения с заданием — там, где их можно вывести без разбора языка:
 * маска не по шаблону задания → маска из шаблона; число диапазона рядом с границей, которая уже
 * правило (`от 2 до 100` при `maxLength(100)`), → вторая граница того же поля. Предупреждение без
 * готового вызова модель пропускала и подтверждала сверку (L2-profile-json, 20261113T175233Z-7a3f).
 */
export function gapFixes(
  task: string | undefined,
  intent: FormIntent
): Array<Record<string, unknown>> {
  if (!task) return [];
  const fixes: Array<Record<string, unknown>> = [];
  const templates = formatTemplates(task);
  const nines = (value: string): string => value.replace(/\d/g, '9');
  for (const field of intent.fields) {
    const mask = field.componentProps?.mask;
    if (typeof mask !== 'string' || templates.length === 0) continue;
    if (templates.some((template) => nines(template) === nines(mask))) continue;
    fixes.push({ op: 'set_field', name: field.modelPath ?? field.name, mask: templates[0] });
  }
  // Формат задания не стоит ни на одном поле: его поле — то, чья подпись в задании ближе всего
  // перед шаблоном («телефон в формате +7 (999)…»).
  if (
    templates.length > 0 &&
    !intent.fields.some((field) => typeof field.componentProps?.mask === 'string')
  ) {
    const at = task.indexOf(templates[0]);
    const lower = task.toLowerCase();
    let best: { path: string; distance: number } | undefined;
    for (const field of intent.fields) {
      if (field.type !== 'string' || Array.isArray(field.componentProps?.options)) continue;
      const label = (field.label ?? '').toLowerCase().trim();
      if (!label) continue;
      const found = lower.lastIndexOf(label, at);
      if (found < 0 || found > at) continue;
      const distance = at - found;
      if (!best || distance < best.distance)
        best = { path: field.modelPath ?? field.name, distance };
    }
    if (best && best.distance <= 60)
      fixes.push({ op: 'set_field', name: best.path, mask: templates[0] });
  }
  for (const field of missingFields(task, intent)) {
    fixes.push({ op: 'add_field', name: field.name, label: field.label });
  }
  const { required, visible } = fieldGaps(task, intent);
  // Видимость раньше обязательности: правило поля, видимого по условию, сервер проверяет только
  // пока поле видно.
  for (const gap of [...visible, ...required]) if (gap.fix) fixes.push(gap.fix);
  for (const gap of siblingGaps(task, intent)) fixes.push(gap.fix);
  for (const entry of missingDefaults(task, intent)) {
    const field = intent.fields.find((f) => (f.modelPath ?? f.name) === entry.field);
    const numeric = field?.type === 'number' && /^-?\d+(?:[.,]\d+)?$/.test(entry.value);
    fixes.push({
      op: 'set_field',
      name: entry.field,
      initialValue: numeric ? Number(entry.value.replace(',', '.')) : entry.value,
    });
  }
  for (const path of strayMasks(task, intent))
    fixes.push({ op: 'set_field', name: path, mask: '' });
  for (const bound of inventedBounds(task, intent)) {
    fixes.push({ op: 'remove_rule', field: bound.field, rule: bound.name });
  }
  const bounds: Array<{ name: string; value: string; target: string }> = [];
  for (const row of intent.validation) {
    for (const rule of row.rules) {
      const call = /^\s*(minLength|maxLength|min|max)\s*\(\s*(\d+)/.exec(rule);
      if (call) bounds.push({ name: call[1], value: call[2], target: row.target });
    }
  }
  const gaps = taskGaps(task, intent).join(' ');
  const rest = limitText(task);
  const pairs = [...rest.matchAll(/(?<![\d.])(\d+)(?=[^\d]{1,12}?(\d+)(?![\d.]))/g)].map(
    (match) => [match[1], match[2]] as const
  );
  const other: Record<string, string> = {
    maxLength: 'minLength',
    max: 'min',
    minLength: 'maxLength',
    min: 'max',
  };
  for (const [low, high] of pairs) {
    const missingLow = new RegExp(`names [\\d, ]*\\b${low}\\b`).test(gaps);
    const missingHigh = new RegExp(`names [\\d, ]*\\b${high}\\b`).test(gaps);
    const upper = bounds.find(
      (b) => b.value === high && (b.name === 'maxLength' || b.name === 'max')
    );
    const lower = bounds.find(
      (b) => b.value === low && (b.name === 'minLength' || b.name === 'min')
    );
    if (missingLow && upper)
      fixes.push({ op: 'add_rule', field: upper.target, [other[upper.name]]: Number(low) });
    else if (missingHigh && lower)
      fixes.push({ op: 'add_rule', field: lower.target, [other[lower.name]]: Number(high) });
  }
  return fixes;
}

/** Поля с их видом одной строкой: `fio «ФИО»: text · city «Город»: a choice of A | B`. */
export function fieldsSummary(intent: FormIntent): string {
  const kindOf = (field: FormIntent['fields'][number]): string => {
    const props = field.componentProps ?? {};
    if (props.readOnly === true) return 'read-only';
    if (Array.isArray(props.options)) {
      const labels = (props.options as unknown[]).map((option) =>
        option !== null && typeof option === 'object' && 'label' in option
          ? String((option as { label: unknown }).label)
          : String(option)
      );
      return `a choice of ${labels.slice(0, 5).join(' | ')}${labels.length > 5 ? ' | …' : ''}`;
    }
    if (typeof props.mask === 'string') return `mask ${props.mask}`;
    return field.type === 'string' ? 'text' : field.type;
  };
  const fields = intent.fields.map(
    (field) => `${field.modelPath ?? field.name} «${field.label ?? field.name}»: ${kindOf(field)}`
  );
  const rows = intent.arrays.map(
    (array) => `${array.name}[] rows: ${array.itemFields.map((item) => item.name).join(', ')}`
  );
  return [...fields, ...rows].join(' · ') || 'none';
}

/** Правила по полям одной строкой: `fio: required, minLength(2) · phone: required, pattern`. */
export function rulesSummary(intent: FormIntent): string {
  const byField = new Map<string, string[]>();
  for (const row of intent.validation) {
    if (row.cross || row.rules.length === 0) continue;
    const names = row.rules.map((rule) => {
      const call = /^\s*(\w+)\s*\(([^,{)]*)/.exec(rule);
      if (!call) return rule;
      const arg = call[2].trim();
      return call[1] === 'pattern' || !arg ? call[1] : `${call[1]}(${arg})`;
    });
    byField.set(row.target, [...(byField.get(row.target) ?? []), ...names]);
  }
  return (
    [...byField].map(([field, names]) => `${field}: ${names.join(', ')}`).join(' · ') || 'none'
  );
}

/** В форме есть хотя бы одно правило поля. */
export function validationStarted(intent: FormIntent | null): boolean {
  return intent?.validation.some((row) => !row.cross && row.rules.length > 0) === true;
}

/**
 * Вычисляемые поля без вычисления: поле только для чтения или цель формулы задания «(refund) = …»
 * без `compute`. Этап поведения засчитывался по одной видимости, и «Done» выходил без формулы
 * (L3-refund, 20261113T230859Z-f59e).
 */
export function uncomputed(intent: FormIntent, task: string | undefined): string[] {
  const computes = new Set(
    intent.behavior
      .filter((row) => row.kind === 'compute' || row.kind === 'computeFrom')
      .map((row) => row.target)
  );
  const paths = intent.fields.map((field) => field.modelPath ?? field.name);
  const targets = new Set(
    intent.fields
      .filter((field) => field.componentProps?.readOnly === true)
      .map((field) => field.modelPath ?? field.name)
  );
  for (const match of (task ?? '').matchAll(/\(([A-Za-z_$][\w$]*)\)\s*=\s*[^=]/g)) {
    if (paths.includes(match[1])) targets.add(match[1]);
  }
  return [...targets].filter((path) => !computes.has(path));
}

/**
 * Поля формулы задания, которых вычисление не читает: «Итог (total) = цена × количество × (1 −
 * скидка/100)», а модель написала `price * quantity` и потеряла скидку — сборка прошла, «Done» вышел
 * (L3-order-total, 20261114T005219Z-43ce). Поле узнаётся в правой части по имени или по началу слова
 * подписи.
 */
export function formulaMisses(
  intent: FormIntent,
  task: string | undefined
): Array<{ target: string; missing: string[] }> {
  if (!task) return [];
  const out: Array<{ target: string; missing: string[] }> = [];
  const lower = task.toLowerCase();
  for (const match of task.matchAll(/\(([A-Za-z_$][\w$]*)\)\s*=\s*(?=[^=])/g)) {
    const target = match[1];
    const row = intent.behavior.find(
      (b) => (b.kind === 'compute' || b.kind === 'computeFrom') && b.target === target
    );
    if (!row) continue;
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let end = lower.length;
    for (let i = start; i < lower.length; i++) {
      const char = lower[i];
      if (char === '(') depth++;
      else if (char === ')') depth = Math.max(0, depth - 1);
      else if (
        depth === 0 &&
        (char === ',' ||
          char === ':' ||
          char === ';' ||
          (char === '.' && /\s|$/.test(lower[i + 1] ?? '')))
      ) {
        end = i;
        break;
      }
    }
    const rhs = lower.slice(start, end);
    const reads = new Set([
      ...(row.sources ?? []),
      ...[...(row.expr ?? '').matchAll(/model\.([\w$]+)/g)].map((m) => m[1]),
    ]);
    const missing = intent.fields
      .map((field) => ({
        path: field.modelPath ?? field.name,
        label: (field.label ?? '').toLowerCase(),
      }))
      .filter(({ path }) => path !== target && !reads.has(path))
      .filter(({ path, label }) => {
        if (new RegExp(`(?<![\\w$])${path.toLowerCase()}(?![\\w$])`).test(rhs)) return true;
        return label
          .split(/\s+/)
          .filter((word) => word.length >= 4)
          .some((word) => rhs.includes(word.slice(0, 5)));
      })
      .map(({ path }) => path);
    if (missing.length > 0) out.push({ target, missing });
  }
  return out;
}

/** Сделан ли этап по содержимому формы. */
function stageDone(
  stage: StageId,
  intent: FormIntent | null,
  index: string | null,
  task?: string
): boolean {
  if (stage === 'markup') return index !== null && !index.includes('return null;');
  if (!intent) return false;
  switch (stage) {
    case 'edit':
      // Правка закрывается сверкой, а не содержимым: см. planState.
      return false;
    case 'fields':
      return intent.fields.length + intent.arrays.length > 0;
    case 'arrays':
      return intent.arrays.length > 0 && intent.arrays.every((a) => a.itemFields.length > 0);
    case 'wizard':
      return collectSteps(intent.layoutRoot).length > 0;
    case 'validation':
      return unruled(intent).length === 0;
    case 'cross':
      return intent.validation.some((row) => Boolean(row.cross));
    case 'behavior':
      return (
        intent.behavior.length + intent.visibility.length > 0 &&
        uncomputed(intent, task).length === 0 &&
        formulaMisses(intent, task).length === 0
      );
  }
}

export interface StageState {
  readonly id: StageId;
  readonly done: boolean;
  readonly skipped: boolean;
}

export interface PlanState {
  readonly stages: readonly StageState[];
  /** Последняя сборка прошла на текущих файлах. */
  readonly built: boolean;
  /** Последняя сборка шла на текущих файлах и упала. */
  readonly failed: boolean;
  readonly typesChecked: boolean;
  /** Первый несделанный этап. */
  readonly pending: StageId | null;
  readonly complete: boolean;
  /** Intent ещё не записан: собирать нечего, первым идёт этап плана. */
  readonly fresh: boolean;
  /** Intent с диска, прочитанный без справочников; `null` — его нет или он не читается. */
  readonly intent: FormIntent | null;
  /** Правила есть у каждого поля, сверки с заданием ещё не было. */
  readonly awaitingConfirm: boolean;
}

/** Состояние плана по файлам каталога формы. */
export function planState(
  plan: GuidedPlan,
  intentText: string | null,
  indexText: string | null
): PlanState {
  const intent = intentOf(intentText);
  const confirmed = plan.confirmed?.includes('validation') === true;
  const editConfirmed = plan.confirmed?.includes('edit') === true;
  const stages = plan.stages.map((id) => ({
    id,
    // Валидация закрывается только сверкой с заданием; после неё поля без правил — необязательные
    // по решению модели. Правка — принятой правкой и сверкой изменений с заданием.
    done:
      id === 'edit'
        ? plan.edited === true && editConfirmed
        : id === 'validation'
          ? confirmed && (stageDone(id, intent, indexText) || validationStarted(intent))
          : stageDone(id, intent, indexText, plan.task),
    skipped: plan.skipped.includes(id),
  }));
  const last = plan.lastBuild;
  const current =
    last !== undefined &&
    last.intent === fingerprint(intentText) &&
    last.index === fingerprint(indexText);
  const built = current && last.ok;
  const pending = stages.find((stage) => !stage.done && !stage.skipped)?.id ?? null;
  const typesChecked = built && last.typesChecked;
  return {
    stages,
    built,
    failed: current && !last.ok,
    typesChecked,
    pending,
    complete: built && typesChecked && pending === null,
    fresh: intentText === null,
    intent,
    awaitingConfirm:
      (pending === 'validation' && !confirmed && stageDone('validation', intent, indexText)) ||
      (pending === 'edit' && plan.edited === true && !editConfirmed),
  };
}

/** Строка хода плана: `✓` — сделан, `⊘` — пропущен, `→` — текущий, `○` — впереди. */
export function progressLine(state: PlanState): string {
  const marks = state.stages.map((stage) => {
    const mark = stage.done ? '✓' : stage.skipped ? '⊘' : stage.id === state.pending ? '→' : '○';
    return `${mark} ${stage.id}`;
  });
  const build = state.built
    ? state.typesChecked
      ? 'built, types checked'
      : 'built, types NOT checked'
    : state.failed
      ? 'build failed'
      : 'not built since the last change';
  return `Plan: ${marks.join(' · ')} | ${build}`;
}

/** Что делается на этапе: для ответа `form_start`. */
export function stageGoal(stage: StageId, target: ReformerTargetStack): string {
  switch (stage) {
    case 'edit':
      return 'the changes of the task, every one with form_edit — several edits in one call; then a check of the changes against the task';
    case 'fields':
      return 'every input of the task: one add_field each, all in one call; a choice: "options"; a default value of the task: "initialValue"; an input format like a phone: "mask" — the format from the task, 9 for a digit; a computed or read-only field: "readonly":true';
    case 'arrays':
      return 'repeating rows: add_array (min/max rows), then add_item_field for each column of a row';
    case 'wizard':
      return 'steps in order: add_step with the names of its fields and arrays; every field goes to a step';
    case 'validation':
      return 'add_rule per field: required, email, min/max, minLength/maxLength, pattern; "message" — its text; "when" — only on a condition';
    case 'cross':
      return 'rules across fields: a field that must match another — add_rule with "equals":"<other field>"; any other condition — "cross": an expression over values, TRUE when valid';
    case 'behavior':
      return target === 'core'
        ? 'reactions: add_behavior compute (a calculated field), enableWhen (a field active only on a condition)'
        : 'reactions: add_behavior compute (a calculated field); a field shown only on a condition: add_visibility showWhen';
    case 'markup':
      return 'on core the form needs JSX markup: {"op":"markup"} — the server writes index.tsx';
  }
}

/**
 * Правки этапа на полях самой формы. Малая модель копирует пример дословно, и пример с чужими
 * именами (`email`, `age`) давал отказ «нет поля» (прогон MCP профиля, 2026-11-13). Имена полей
 * сервер знает — их и подставляет; содержание (обязательность, тексты) модель берёт из задания.
 */
function examplesOn(
  stage: StageId,
  target: ReformerTargetStack,
  intent: FormIntent
): Array<Record<string, unknown>> | null {
  const names = intent.fields.map((field) => field.modelPath ?? field.name);
  if (names.length === 0) return null;
  const numbers = intent.fields.filter((field) => field.type === 'number');
  const choice = intent.fields.find((field) => Array.isArray(field.componentProps?.options));
  switch (stage) {
    case 'validation': {
      // Пример — на полях без правил: модель копирует его, и поле без правила не теряется.
      const open = unruled(intent);
      const rules: Array<Record<string, unknown>> = (open.length > 0 ? open : names)
        .slice(0, 6)
        .map((field) => ({ op: 'add_rule', field, required: true }));
      // Поле с маской: формат проверяет только pattern, и вывести его из маски модель не умела.
      for (const masked of intent.fields) {
        const path = masked.modelPath ?? masked.name;
        if (typeof masked.componentProps?.mask !== 'string' || !open.includes(path)) continue;
        rules.push({
          op: 'add_rule',
          field: path,
          pattern: maskToPattern(masked.componentProps.mask as string),
        });
      }
      return rules;
    }
    case 'cross':
      // Заглушки, а не пара полей формы: пример `email equals login` модель вставила дословно, и в
      // форме появилось правило «email равен логину» (registration-delete, 20261114T113832Z-68e8).
      return null;
    case 'wizard': {
      const half = Math.ceil(names.length / 2);
      return [
        { op: 'add_step', title: 'Step 1', fields: names.slice(0, half) },
        ...(names.length > 1
          ? [{ op: 'add_step', title: 'Step 2', fields: names.slice(half) }]
          : []),
      ];
    }
    case 'behavior': {
      const edits: Array<Record<string, unknown>> = [];
      // Вычисляемое поле — по «только для чтения», а не по типу: строковое «К возврату» примера не
      // получало, и пример предлагал одну видимость (L3-refund, 20261113T230859Z-f59e).
      const computed = intent.fields.find((field) => field.componentProps?.readOnly === true);
      const inputs = numbers.filter((field) => field !== computed);
      if (computed && inputs.length > 0) {
        // Заглушка, а не формула: модель копировала «price * quantity» и теряла скидку из задания
        // (L3-order-total, 20261113T191026Z-aaee). Поля названы — формулу модель берёт из задания.
        edits.push({
          op: 'add_behavior',
          kind: 'compute',
          target: computed.name,
          expr: `<the formula of the task over ${inputs.map((field) => `model.${field.name}`).join(', ')}>`,
        });
      }
      const options = choice?.componentProps?.options as Array<{ value?: unknown }> | undefined;
      const dependent = names.find((name) => name !== choice?.name && name !== computed?.name);
      if (choice && dependent && options?.[0]?.value !== undefined) {
        // Заглушка, а не первый вариант: пример «=== 'defect'» модель брала как есть, а задание
        // показывало поле при «other» (L3-refund, 20261113T220710Z-1415).
        const condition = `model.${choice.name} === '<the choice of the task>'`;
        edits.push(
          target === 'core'
            ? { op: 'add_behavior', kind: 'enableWhen', target: dependent, expr: condition }
            : { op: 'add_visibility', field: dependent, showWhen: condition }
        );
      }
      return edits.length > 0 ? edits : null;
    }
    default:
      return null;
  }
}

/** Пример правок этапа: на полях формы, когда они есть; иначе — синтаксис на условных именах. */
export function stageExample(
  stage: StageId,
  target: ReformerTargetStack,
  intent: FormIntent | null = null
): string {
  const own = intent ? examplesOn(stage, target, intent) : null;
  if (own) return JSON.stringify(own);
  switch (stage) {
    // Полей ещё нет — заглушки, а не правдоподобные имена: модель копировала `email` из образца
    // вместо поля задачи. Скопированную заглушку сервер отклонит с причиной, чужое имя прошло бы.
    case 'fields':
      return '[{"op":"add_field","name":"<latinName>","label":"<label from the task>"},{"op":"add_field","name":"<latinName>","type":"number","label":"<label>"},{"op":"add_field","name":"<latinName>","label":"<label>","options":["<option>","<option>"]}]';
    case 'arrays':
      return '[{"op":"add_array","name":"contacts","label":"Contacts","minItems":1,"maxItems":5},{"op":"add_item_field","array":"contacts","name":"phone","label":"Phone"}]';
    case 'wizard':
      return '[{"op":"add_step","title":"Contacts","fields":["email","phone"]},{"op":"add_step","title":"Details","fields":["age","contacts"]}]';
    case 'validation':
      return '[{"op":"add_rule","field":"email","required":true,"email":true,"message":"Enter a valid email"},{"op":"add_rule","field":"age","min":18,"max":120,"message":"Age 18 to 120"}]';
    case 'cross':
      return '[{"op":"add_rule","field":"<field>","equals":"<the field it must match>","message":"<text of the task>"}]';
    case 'edit':
      return '[{"op":"rename_field","name":"<key now>","to":"<new key>"},{"op":"set_field","name":"<field>","label":"<new label of the task>"}]';
    // Заглушки, а не «total» и «address»: на форме без этих полей пример вёл в тупик (358f).
    case 'behavior':
      return target === 'core'
        ? '[{"op":"add_behavior","kind":"compute","target":"<computed field>","expr":"<the formula of the task over model.<field>>"},{"op":"add_behavior","kind":"enableWhen","target":"<field>","expr":"model.<field> === \'<the choice of the task>\'"}]'
        : '[{"op":"add_behavior","kind":"compute","target":"<computed field>","expr":"<the formula of the task over model.<field>>"},{"op":"add_visibility","field":"<field>","showWhen":"model.<field> === \'<the choice of the task>\'"}]';
    case 'markup':
      return '[{"op":"markup"}]';
  }
}

/** Готовый вызов `form_edit` с правками. */
export function editCall(dir: string, edits: string): string {
  return `form_edit {"dir":${JSON.stringify(dir)},"edits":${edits}}`;
}

/** Блок следующего шага: ровно один вызов или «готово». */
/** Где поле названо в задании: подпись, подпись без скобок, имя, первое длинное слово подписи. */
function mention(
  lower: string,
  field: FormIntent['fields'][number]
): { at: number; len: number } | null {
  const label = (field.label ?? '').toLowerCase().trim();
  const keys = [
    label,
    label.replace(/\s*\(.*?\)\s*/g, ' ').trim(),
    (field.modelPath ?? field.name).toLowerCase(),
    label.split(/\s+/)[0] ?? '',
  ].filter((key) => key.length >= 3);
  let best: { at: number; len: number } | null = null;
  for (const key of keys) {
    const at = lower.indexOf(key);
    if (at >= 0 && (!best || at < best.at)) best = { at, len: key.length };
  }
  return best;
}

/**
 * Окно фокуса: кусок задания про одно поле — вводная часть фразы (условие вроде «При доставке
 * становятся обязательными») и отрезок от предыдущего упомянутого поля до следующего. `whole` —
 * до конца фразы (формула называет другие поля). Не нашли поле — задание целиком.
 */
export function taskFragment(
  task: string,
  intent: FormIntent,
  path: string,
  whole = false
): string {
  const lower = task.toLowerCase();
  const marks = intent.fields
    .map((field) => ({ path: field.modelPath ?? field.name, at: mention(lower, field) }))
    .filter((mark): mark is { path: string; at: { at: number; len: number } } => mark.at !== null)
    .sort((a, b) => a.at.at - b.at.at);
  const me = marks.find((mark) => mark.path === path);
  const cut = (text: string): string => (text.length > 240 ? `${text.slice(0, 240)}…` : text);
  if (!me) return cut(task);
  const at = me.at.at;
  const before = task.slice(0, at);
  const clauseStart =
    Math.max(before.lastIndexOf('.'), before.lastIndexOf(';'), before.lastIndexOf(':')) + 1;
  const after = task.slice(at);
  // До конца предложения: после «;» задание договаривает про то же поле («…; по умолчанию выбран
  // defect», «…; при самовывозе не проверяются») — окно, обрезанное на «;», это теряло (L3-refund).
  const endMatch = /\.(\s|$)/.exec(after);
  const clauseEnd = endMatch ? at + endMatch.index : task.length;
  const inClause = marks.filter((mark) => mark.at.at >= clauseStart && mark.at.at < clauseEnd);
  const index = inClause.indexOf(me);
  const previous = index > 0 ? inClause[index - 1] : undefined;
  const following = inClause[index + 1];
  const segmentEnd = whole || !following ? clauseEnd : following.at.at;
  const tidy = (text: string): string => text.replace(/^[\s,;:—-]+|[\s,;:—-]+$/g, '');
  if (!previous) return cut(tidy(task.slice(clauseStart, segmentEnd)));
  const lead = tidy(task.slice(clauseStart, inClause[0].at.at));
  // От подписи самого поля: после подписи предыдущего идёт ещё его описание («(от 2 до 100 символов)»).
  const segment = tidy(task.slice(at, segmentEnd));
  return cut(lead ? `${lead} … ${segment}` : segment);
}

/**
 * Сверка формы с заданием: задание, поля с их видом, правила, расхождения и готовая правка под них,
 * затем подтверждение. Сверка всей формы, а не одних правил: модель вешала варианты города на ФИО
 * и теряла поле города — список подписей этого не показывал (L2-profile-json, 20261113T174310Z-2301).
 */
function checkLines(plan: GuidedPlan, intent: FormIntent, dir: string): string[] {
  const fixes = gapFixes(plan.task, intent);
  return [
    ...(plan.task ? [`The task: «${plan.task}»`] : []),
    `Fields now: ${fieldsSummary(intent)}`,
    `Rules now: ${rulesSummary(intent)}`,
    ...taskGaps(plan.task, intent).map((gap) => `⚠️ Differs from the task: ${gap}.`),
    ...(fixes.length > 0
      ? [
          'Next: fix the differences — this call does it:',
          editCall(dir, JSON.stringify(fixes)),
          'The form is right and the difference is not real? Then:',
        ]
      : [
          'An input of the task missing or wrong (a choice on the wrong field, a lost field)? set_field / add_field. A limit (required, a length, a range, a format) without a rule? add_rule. All right:',
        ]),
    `form_status {"dir":${JSON.stringify(dir)},"confirm":"validation"}`,
  ];
}

// ---------- Правка готовой формы ----------

/** Сколько знаков задания хранит план правки: нумерованный список правок длиннее задания формы. */
export const TASK_LIMIT_EDIT = 1200;

const REMOVE_WORDS = /убер|удал|убра|\bremove|\bdelete|\bdrop/i;
const ADD_WORDS = /добав|\badd\b|\badds\b/i;
const RENAME_WORDS = /переимен|\brename/i;
const STEP_WORDS = /шаг|\bstep/i;

/** Слова-не-имена среди латиницы русского текста. */
const NOT_NAMES: ReadonlySet<string> = new Set(['true', 'false', 'null', 'undefined', 'and', 'or']);

/**
 * Имена полей в тексте правки: в обратных кавычках, в скобках, а в русском тексте — и голые
 * латинские идентификаторы: модель пересказывала задание без кавычек («ключ username вместо login»),
 * и сверка не видела переименования (батч 20261114T192434Z-731c). Формулы и маски — не имена.
 */
function namesIn(clause: string): string[] {
  const explicit = [
    ...new Set([
      ...[...clause.matchAll(/`([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)`/g)].map((m) => m[1]),
      ...[...clause.matchAll(/\(([a-z][A-Za-z0-9]*(?:\.[A-Za-z]\w*)*)\)/g)].map((m) => m[1]),
    ]),
  ];
  // Голая латиница — только запасной путь для пересказа без кавычек: рядом с именем в кавычках она
  // обычно ориентир («после email добавь телефон (`phone`)»), а не новое поле.
  if (explicit.length > 0 || !/[а-яё]/i.test(clause)) return explicit;
  return [
    ...new Set(
      [
        ...clause.matchAll(
          /(?<![\w$./\-@])[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*(?:\.[a-z][A-Za-z0-9]*)*(?![\w$/\-@]|\.\w)/g
        ),
      ]
        .map((m) => m[0])
        .filter((name) => name.length >= 3 && !NOT_NAMES.has(name))
    ),
  ];
}

/** Заголовки в «ёлочках». */
const titlesIn = (clause: string): string[] =>
  [...clause.matchAll(/«([^»]+)»/g)].map((m) => m[1].trim());

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Подпись поля как шаблон по основам слов: «Повтор пароля» находит «повтор пароля», «Скидка» — «скидку». */
function labelPattern(label: string): RegExp | null {
  const words = label
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.join('').length < 4) return null;
  const stems = words.map(
    (word) => `${escapeRegExp(word.length >= 5 ? word.slice(0, -1) : word)}\\p{L}*`
  );
  return new RegExp(`(?<!\\p{L})${stems.join('\\s+')}`, 'u');
}

/**
 * Поля, которые фраза называет подписью. Совпадение внутри более длинного совпадения другой подписи
 * не в счёт: «пароль» внутри «повтор пароля» — не поле «Пароль».
 */
function labelsIn(segment: string, labels: Readonly<Record<string, string>>): string[] {
  const lower = segment.toLowerCase();
  const hits: Array<{ path: string; at: number; end: number }> = [];
  for (const [path, label] of Object.entries(labels)) {
    const pattern = labelPattern(label);
    const match = pattern ? pattern.exec(lower) : null;
    if (match) hits.push({ path, at: match.index, end: match.index + match[0].length });
  }
  return hits
    .filter(
      (hit) =>
        !hits.some(
          (other) =>
            other !== hit &&
            other.at <= hit.at &&
            other.end >= hit.end &&
            other.end - other.at > hit.end - hit.at
        )
    )
    .map((hit) => hit.path);
}

/**
 * Сверка правки с заданием — только то, что задание называет однозначно; точность важнее полноты:
 * ложное расхождение толкает модель в лишние правки.
 *
 * - Имена — в обратных кавычках, скобках или голой латиницей в русском тексте; шаги — в «ёлочках»
 *   рядом со словом «шаг». Строка-заголовок со словом действия и двоеточием в конце передаёт
 *   действие пунктам списка под ней.
 * - Удаление по подписи: «убери капчу и повтор пароля» — поле «Повтор пароля» ещё в форме.
 * - «Остальное не меняй»: поле, которое задание не называет ни именем, ни подписью, потеряло
 *   проверки (`baseline` — состав на старте). Модель читала «и все их проверки» как «все проверки
 *   формы» и снимала правила логина и пароля (батч 20261114T192434Z-731c).
 */
export function editGaps(
  task: string | undefined,
  intent: FormIntent,
  baseline?: Baseline
): string[] {
  if (!task) return [];
  const paths = [
    ...intent.fields.map((field) => field.modelPath ?? field.name),
    ...intent.arrays.map((array) => array.name),
  ];
  const has = (name: string): boolean =>
    paths.some((path) => path === name || path.startsWith(`${name}.`));
  const steps = collectSteps(intent.layoutRoot).map((step) =>
    String(step.title ?? '')
      .trim()
      .toLowerCase()
  );
  const hasStep = (title: string): boolean => steps.includes(title.toLowerCase());
  // Подписи на старте и сейчас: удалённое поле перекрывает свою подпись («повтор пароля» — не «пароль»).
  const labels: Record<string, string> = {
    ...(baseline?.labels ?? {}),
    ...Object.fromEntries(
      intent.fields.map((field) => [field.modelPath ?? field.name, field.label ?? ''])
    ),
  };
  const gaps = new Set<string>();
  let heading = '';
  for (const raw of task.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*•]\s/.test(line);
    if (!bullet) heading = /:\s*$/.test(line) ? line : '';
    for (const sentence of line.split(/(?<=[.;!?])\s+/)) {
      const verbs = bullet ? `${heading} ${sentence}` : sentence;
      const names = namesIn(sentence);
      const titles = STEP_WORDS.test(verbs) ? titlesIn(sentence) : [];
      if (RENAME_WORDS.test(verbs)) {
        const pair = names.length >= 2 ? names : titles.length >= 2 ? titles : null;
        if (!pair) continue;
        const [from, to] = /вместо|instead of/i.test(sentence) ? [pair[1], pair[0]] : pair;
        const exists = names.length >= 2 ? has : hasStep;
        const what = names.length >= 2 ? `\`${from}\`` : `step «${from}»`;
        const next = names.length >= 2 ? `\`${to}\`` : `«${to}»`;
        if (exists(from)) gaps.add(`${what} is still in the form — the task renames it to ${next}`);
        else if (!exists(to))
          gaps.add(`${next} is not in the form — the task renames ${what} to it`);
      } else if (REMOVE_WORDS.test(verbs)) {
        for (const name of names)
          if (has(name)) gaps.add(`\`${name}\` is still in the form — the task removes it`);
        // Подписи — только в части фразы до пояснения (« — сами поля…», «: Итого теперь…»): после
        // него задание называет поля, которые остаются.
        const [head] = sentence.split(/\s[—–-]\s|:/);
        for (const path of labelsIn(head, labels))
          if (has(path)) gaps.add(`\`${path}\` is still in the form — the task removes it`);
        for (const title of titles)
          if (hasStep(title))
            gaps.add(`step «${title}» is still in the form — the task removes it`);
      } else if (ADD_WORDS.test(verbs)) {
        for (const name of names)
          if (!has(name)) gaps.add(`\`${name}\` is not in the form — the task adds it`);
        // Заголовок шага — после слова действия: «Между шагами «Товары» и «Оплата» добавь шаг «Упаковка»».
        const after = sentence.slice(Math.max(0, sentence.search(ADD_WORDS)));
        if (STEP_WORDS.test(after)) {
          const [title] = titlesIn(after.slice(after.search(STEP_WORDS)));
          if (title && !hasStep(title))
            gaps.add(`step «${title}» is not in the form — the task adds it`);
        }
      }
    }
  }
  if (baseline?.rules) {
    const now = checksByField(intent);
    const lower = task.toLowerCase();
    for (const [path, before] of Object.entries(baseline.rules)) {
      if (!paths.includes(path)) continue;
      const after = new Set(now[path] ?? []);
      const lost = [...new Set(before)].filter((name) => !after.has(name));
      if (lost.length === 0) continue;
      const label = (
        intent.fields.find((field) => (field.modelPath ?? field.name) === path)?.label ?? ''
      )
        .toLowerCase()
        .trim();
      const named =
        new RegExp(`(?<![\\w$])${escapeRegExp(path.toLowerCase())}(?![\\w$])`).test(lower) ||
        (label.length >= 3 && lower.includes(label));
      if (!named) {
        gaps.add(
          `\`${path}\` lost its checks (${lost.join(', ')}) — the task does not change \`${path}\`: put them back with add_rule`
        );
      }
    }
  }
  return [...gaps];
}

/** Что изменилось с начала правки: поля, массивы, шаги. */
export function changesLine(baseline: Baseline | undefined, intent: FormIntent): string {
  if (!baseline) return '';
  const now = baselineOf(intent);
  const parts: string[] = [];
  const diff = (what: string, before: readonly string[], after: readonly string[]): void => {
    const removed = before.filter((item) => !after.includes(item));
    const added = after.filter((item) => !before.includes(item));
    if (removed.length > 0) parts.push(`${what} removed: ${removed.join(', ')}`);
    if (added.length > 0) parts.push(`${what} added: ${added.join(', ')}`);
  };
  diff('fields', baseline.fields, now.fields);
  diff('arrays', baseline.arrays, now.arrays);
  diff('steps', baseline.steps, now.steps);
  return `Changes since the start: ${parts.join('; ') || 'no field, array or step added or removed (rules, labels and reactions may have changed)'}.`;
}

/** Сверка правки: задание, что изменилось, форма сейчас, расхождения, подтверждение. */
function editCheckLines(plan: GuidedPlan, intent: FormIntent, dir: string): string[] {
  return [
    ...(plan.task ? [`The task: «${plan.task}»`] : []),
    changesLine(plan.baseline, intent),
    `Fields now: ${fieldsSummary(intent)}`,
    `Rules now: ${rulesSummary(intent)}`,
    ...editGaps(plan.task, intent, plan.baseline).map((gap) => `⚠️ Differs from the task: ${gap}.`),
    'A change of the task not made yet? form_edit. Every change made, nothing else touched:',
    `form_status {"dir":${JSON.stringify(dir)},"confirm":"edit"}`,
  ];
}

/** Правки, которыми меняют готовую форму. */
const EDIT_OPS_LINE =
  'Edits for changes: rename_field {name,to,label?} · set_field {name,…} · remove_field {name} · add_field {name,label,…} · add_rule / remove_rule {field,rule?} · add_behavior / remove_behavior {target,kind?} · add_visibility {field,showWhen|hideWhen} · add_step / rename_step {title,to} / remove_step {title} · place {name,step}.';

export function nextLines(plan: GuidedPlan, state: PlanState, dir: string): string[] {
  if (state.failed) {
    return [
      'Next: fix the errors above with form_edit (set_field, remove_field, add_rule …) — the build runs again after the edits:',
      editCall(dir, '[{"op":"set_field","name":"…"}]'),
    ];
  }
  // Правка готовой формы: сначала изменения задания, сборка идёт после них.
  if (state.pending === 'edit' && plan.edited !== true) {
    return [
      ...(plan.task ? [`The task: «${plan.task}»`] : []),
      `Next — edit: ${stageGoal('edit', plan.target)}.`,
      EDIT_OPS_LINE,
      editCall(dir, stageExample('edit', plan.target)),
    ];
  }
  if (state.pending === 'edit' && state.awaitingConfirm && state.intent && state.built) {
    return [
      'Next — check the changes against the task before it is done.',
      ...editCheckLines(plan, state.intent, dir),
    ];
  }
  if (!state.built && !state.fresh) {
    return ['Next: build the current files:', editCall(dir, '[]')];
  }
  if (state.pending === 'validation' && state.awaitingConfirm && state.intent) {
    return [
      'Next — check the form against the task before it is done.',
      ...checkLines(plan, state.intent, dir),
    ];
  }
  if (state.pending !== null) {
    const skip = state.pending === 'fields' || state.pending === 'markup';
    const skipCall = `form_status {"dir":${JSON.stringify(dir)},"skip":"${state.pending}"}`;
    // Валидация начата: этап ждёт поля без правил — их и называем.
    const open = state.pending === 'validation' && state.intent ? unruled(state.intent) : [];
    const started = state.intent?.validation.some((row) => row.rules.length > 0) === true;
    // Ограничения задания — к месту, где они нужны: модель копировала пример с одним required.
    const reminder =
      state.pending === 'validation' && plan.task
        ? [
            `The task: «${plan.task}» — every limit it names (required, a length, a range, a format) is a rule.`,
          ]
        : [];
    // Валидация начата: голого skip нет — через него модель уходила с полями без правил
    // (L2-profile-json, 20261113T180559Z-79cd). Необязательные поля — только после сверки.
    if (started && open.length > 0 && state.intent) {
      return [
        `Next — validation: fields without a rule (or, with a mask, without "pattern"): ${open.join(', ')} — add_rule from the task for each:`,
        editCall(dir, stageExample(state.pending, plan.target, state.intent)),
        `Are ${open.join(', ')} optional on purpose? Check the form against the task first:`,
        ...checkLines(plan, state.intent, dir),
      ];
    }
    // Поведение с видимостью, но без формулы: называем поле, которое задание вычисляет.
    const missing =
      state.pending === 'behavior' && state.intent ? uncomputed(state.intent, plan.task) : [];
    const misses =
      state.pending === 'behavior' && state.intent ? formulaMisses(state.intent, plan.task) : [];
    const formula = [
      ...(missing.length > 0
        ? [
            `Not done: ${missing.join(', ')} — computed by the task, no add_behavior "kind":"compute" on it yet (the formula of the task over model.<field>).`,
          ]
        : []),
      ...misses.map(
        (miss) =>
          `Not done: the formula of ${miss.target} in the task also reads ${miss.missing.join(', ')} — add_behavior "kind":"compute" for ${miss.target} again with the whole formula of the task.`
      ),
    ];
    return [
      ...reminder,
      ...formula,
      `Next — ${state.pending}: ${stageGoal(state.pending, plan.target)}.`,
      editCall(dir, stageExample(state.pending, plan.target, state.intent)),
      ...(skip ||
      (state.pending === 'validation' && plan.task && validationWord(plan.task)) ||
      (state.pending === 'behavior' && plan.task && behaviorWord(plan.task)) ||
      (state.pending === 'cross' && plan.task && crossWord(plan.task))
        ? []
        : [`The task has no ${state.pending}? ${skipCall}`]),
    ];
  }
  if (!state.typesChecked) {
    return [
      'Not done: the types were not checked — the project lacks a TypeScript setup the server can use. Check the module yourself.',
    ];
  }
  return [
    'Done: the form is built, every stage of the plan is complete and the types are checked. Stop here and do not edit module files.',
  ];
}

/**
 * Кросс-проверка бандла: сходятся ли между собой файлы, которые генерировались порознь.
 *
 * Зачем это главный контроль качества, а не `validateFormSchema`. Схема проверяет ОДИН файл:
 * структуру узлов и синтаксис операторов. Но форма — это бандл, и типичная поломка
 * мультифайловой генерации живёт МЕЖДУ файлами: `$model(discount)` в разметке при отсутствии
 * `discount` в модели, `$component(Slider)` без регистрации в реестре, правило на путь,
 * которого нет, `selector` в render-поведении, которого нет в схеме. Каждая из них проходит
 * и ajv, и `tsc` — форма компилируется и молча делает не то.
 *
 * Проверки детерминированные и дешёвые: один обход JSON строит множества имён, дальше —
 * разности с тем, что объявлено в intent.
 */

import { findCycle, type Dependency } from '../utils/graph.js';
import {
  modelPaths,
  type BehaviorIntent,
  type FormIntent,
  type LayoutNode,
} from './form-intent.js';
import {
  collectUsedComponents,
  isDerivedModule,
  mentionsName,
  ruleName,
  submitHandlerOf,
} from './builders.js';
import { NO_CORE_OPERATORS, type CoreOperators } from './core-operators.js';
import {
  BEHAVIOR_KEY_OPERATORS,
  MODEL_BEHAVIOR_KINDS,
  NODE_BEHAVIOR_KINDS,
  VALIDATION_OPERATORS,
} from './operator-catalog.js';

/** Код проверки. Стабилен: на него ссылаются сообщения и тесты. */
export type CrossCheckCode =
  | 'C1'
  | 'C2'
  | 'C3'
  | 'C4'
  | 'C5'
  | 'C6'
  | 'C7'
  | 'C8'
  | 'C9'
  | 'C10'
  | 'C11'
  | 'C12'
  | 'C13';

export interface CrossCheckIssue {
  code: CrossCheckCode;
  severity: 'error' | 'warning';
  message: string;
  /** О чём замечание, когда это поле или справочник: по нему судья не дублирует свои ошибки. */
  subject?: { kind: 'field' | 'data-source'; name: string };
}

export interface CrossCheckReport {
  ok: boolean;
  errors: CrossCheckIssue[];
  warnings: CrossCheckIssue[];
}

/** Собрать все значения операторов данного вида из произвольного JSON-дерева. */
function collectOperators(node: unknown, op: string, out: Set<string>): void {
  if (typeof node === 'string') {
    const m = node.match(new RegExp(`^\\$${op}\\(([^)]*)\\)$`));
    if (m) out.add(m[1]);
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectOperators(v, op, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectOperators(v, op, out);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Аргумент оператора: `$model(a.b)` → `a.b`; не оператор этого вида → `null`. */
function operatorArg(value: unknown, op: string): string | null {
  if (typeof value !== 'string') return null;
  return value.match(new RegExp(`^\\$${op}\\(([^)]*)\\)$`))?.[1] ?? null;
}

/** Документ формата 2: дерево узлов и словарь именованных частей. */
interface SchemaView {
  root: unknown;
  parts: Record<string, unknown>;
  /** Формат 2: привязка ключом `model`, части, шаги в `children`. Иначе — прежний формат. */
  v2: boolean;
}

/** Разобрать переданную схему: документ формата 2, прежний документ либо голое дерево. */
function viewOf(schema: unknown): SchemaView {
  if (isRecord(schema) && schema.format === 2) {
    return { root: schema.root, parts: isRecord(schema.parts) ? schema.parts : {}, v2: true };
  }
  return { root: schema, parts: {}, v2: false };
}

/** Путь массива у узла-массива (любой формат); `null` — узел не массив под-форм. */
function arrayPathOf(rec: Record<string, unknown>): string | null {
  const legacy = operatorArg(rec.array, 'model');
  if (legacy !== null) return legacy;
  return rec.item !== undefined ? operatorArg(rec.model, 'model') : null;
}

/** Шаблон строки узла-массива: вписанный узел либо именованная часть документа. */
function rowTemplateOf(rec: Record<string, unknown>, view: SchemaView): unknown {
  const partName = operatorArg(rec.item, 'part');
  if (partName !== null) return view.parts[partName];
  return isRecord(rec.item) ? rec.item.$template : undefined;
}

/**
 * Собрать `$model(...)`-привязки с учётом области видимости.
 *
 * Внутри шаблона строки массива пути записываются ОТНОСИТЕЛЬНО элемента (`$model(type)` в
 * шаблоне `properties` означает `properties.type`), внутри подформы — относительно группы, к
 * которой часть подключена. Плоский обход этого не знал, и C1 сверял относительный путь с корнем
 * модели: любая вложенная группа внутри элемента массива объявлялась привязкой в никуда.
 * Смягчение через суффиксное сравнение чинило симптом и ломало саму проверку: корневой
 * `$model(monthlyIncome)`, которого в модели нет, «находился» в `coBorrowers.monthlyIncome`.
 *
 * Поэтому префикс протаскивается по дереву: для шаблона строки он равен `путь массива + '.'`,
 * для части подформы — `путь группы + '.'`, для остальных ключей того же узла — прежний.
 * Путь самой группы в результат не попадает: группа — не поле модели.
 *
 * @param stack - Части на пути от корня: часть, подключающая саму себя, обход не зацикливает.
 */
function collectModelRefs(
  node: unknown,
  prefix: string,
  out: Set<string>,
  view: SchemaView,
  stack: readonly string[] = []
): void {
  const path = operatorArg(node, 'model');
  if (path !== null) {
    out.add(prefix + path);
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectModelRefs(v, prefix, out, view, stack);
    return;
  }
  if (!isRecord(node)) return;

  const arrayPath = arrayPathOf(node);
  const groupPath = arrayPath === null && view.v2 ? operatorArg(node.model, 'model') : null;
  const partName = operatorArg(node.part, 'part');

  // Подформа: часть обходится в области своей группы.
  if (groupPath !== null && partName !== null) {
    if (!stack.includes(partName)) {
      collectModelRefs(view.parts[partName], `${prefix}${groupPath}.`, out, view, [
        ...stack,
        partName,
      ]);
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'item' && arrayPath !== null) {
      const rowPart = operatorArg(value, 'part');
      if (rowPart !== null && stack.includes(rowPart)) continue;
      collectModelRefs(
        rowTemplateOf(node, view),
        `${prefix}${arrayPath}.`,
        out,
        view,
        rowPart !== null ? [...stack, rowPart] : stack
      );
      continue;
    }
    // сам оператор массива и остальные ключи узла — пути от текущей области
    collectModelRefs(value, prefix, out, view, stack);
  }
}

/** Собрать все `selector` из дерева — по ним адресуются правила узлов из поведения. */
function collectSelectors(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const v of node) collectSelectors(v, out);
    return;
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if (typeof rec.selector === 'string') out.add(rec.selector);
    for (const v of Object.values(rec)) collectSelectors(v, out);
  }
}

/** Узлы массивов под-форм — для проверки шаблона строки и `initialValue` против itemFields. */
function collectArrayNodes(node: unknown, out: Array<Record<string, unknown>>): void {
  if (Array.isArray(node)) {
    for (const v of node) collectArrayNodes(v, out);
    return;
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if (arrayPathOf(rec) !== null) out.push(rec);
    for (const v of Object.values(rec)) collectArrayNodes(v, out);
  }
}

/**
 * Имена, которые реестр предоставляет всегда, без объявления в intent.
 *
 * `FormWizard` — библиотечный визард ui-kit: полем intent контейнер быть не может по
 * определению, поэтому без этой записи C2 ругалась бы ровно на то, что предписывает канон.
 * `Wizard` и `RendererFormWizard` — ключи прикладного шима прежнего контракта; оставлены,
 * чтобы документы прежнего формата проверялись без ложных срабатываний.
 */
export const BUILTIN_COMPONENTS: ReadonlySet<string> = new Set([
  'FIELD_WRAPPER',
  'Step',
  'FormWizard',
  'Wizard',
  'RendererFormWizard',
  'Box',
  'Section',
  'FieldArray',
]);

export function crossCheckBundle(
  intent: FormIntent,
  layoutJson: unknown,
  opts?: {
    componentNames?: string[];
    dataSourceNames?: string[];
    /** Операторы ядра из его индекса. Без них C12 не сверяет правила с валидаторами ядра. */
    core?: CoreOperators;
  }
): CrossCheckReport {
  const errors: CrossCheckIssue[] = [];
  const warnings: CrossCheckIssue[] = [];
  const err = (code: CrossCheckCode, message: string) =>
    errors.push({ code, severity: 'error', message });
  const warn = (code: CrossCheckCode, message: string, subject?: CrossCheckIssue['subject']) =>
    warnings.push({ code, severity: 'warning', message, ...(subject ? { subject } : {}) });

  const paths = modelPaths(intent);
  const models = new Set<string>();
  const components = new Set<string>();
  const dataSources = new Set<string>();
  // Привязки собираются от корня дерева: части документа формата 2 разворачиваются в области
  // своих подключений. Имена компонентов, источников и селекторы — по всему документу.
  const view = viewOf(layoutJson);
  collectModelRefs(view.root, '', models, view);
  collectOperators(layoutJson, 'component', components);
  collectOperators(layoutJson, 'dataSource', dataSources);

  const selectors = new Set<string>();
  collectSelectors(layoutJson, selectors);

  // C1 — каждая привязка разметки ведёт в существующее поле модели. Пути уже приведены к
  // корню моделью области видимости (см. collectModelRefs), поэтому сравнение точное:
  // суффиксного смягчения здесь быть не должно — оно пропускало реальные промахи.
  for (const m of models) {
    if (!paths.has(m))
      err('C1', `$model(${m}) — no such path in the model; the binding leads nowhere.`);
  }

  // C2 — каждый компонент разметки зарегистрирован. Список «что используется» берём у того же
  // сборщика, что пишет реестр: иначе проверка и генератор разошлись бы в понимании.
  const declaredComponents = new Set<string>([
    ...collectUsedComponents(intent),
    ...BUILTIN_COMPONENTS,
    ...(opts?.componentNames ?? []),
  ]);
  for (const c of components) {
    if (declaredComponents.has(c)) continue;
    if (opts?.componentNames) {
      err(
        'C2',
        `$component(${c}) is declared by no field of the intent and is not in componentNames — the registry will not have it.`
      );
    } else {
      // Контейнерным компонентам места в FormIntent нет: он описывает поля, а не разметку.
      // Пока реальные ключи реестра не переданы, отличить «забыли зарегистрировать» от
      // «это контейнер» нельзя — поэтому предупреждение, а не ошибка.
      warn(
        'C2',
        `$component(${c}) is declared by no field of the intent. For a container or an app shim that is expected; to check for real, pass componentNames — the registry keys.`
      );
    }
  }

  // C3 — каждый источник данных объявлен.
  const declaredSources = new Set(intent.dataSources.map((d) => d.name));
  for (const d of dataSources) {
    if (!declaredSources.has(d)) {
      err(
        'C3',
        `$dataSource(${d}) is not declared in intent.dataSources — the registry will not provide it.`
      );
    }
  }

  // C4 — цели правил валидации существуют.
  for (const rule of intent.validation) {
    const target = rule.each ? `${rule.each}.${rule.target}` : rule.target;
    const known = paths.has(target) || paths.has(rule.target);
    if (!known) err('C4', `A validation rule on \`${target}\` — no such path in the model.`);
  }

  // C5 — цели и источники поведения существуют.
  // Связь строки массива пишут и от строки (`qty` при `each: 'items'`): путь в модели — полный.
  const fullOf = (b: { each?: string }, path: string): string =>
    b.each !== undefined && !path.startsWith(`${b.each}.`) && path !== b.each
      ? `${b.each}.${path}`
      : path;
  // Включение и выключение ядро принимает и на группу: `enableWhen(model.$.residenceAddress, …)`
  // включает все её поля разом (калибровка кредитной заявки, A9: без этого — по записи на лист).
  const groups = new Set(
    [...paths].flatMap((p) =>
      p
        .split('.')
        .slice(0, -1)
        .map((_, i, a) => a.slice(0, i + 1).join('.'))
    )
  );
  const togglesGroup = (b: BehaviorIntent): boolean =>
    (b.kind === 'enableWhen' || b.kind === 'disableWhen') && groups.has(fullOf(b, b.target));
  for (const b of intent.behavior) {
    if (!paths.has(fullOf(b, b.target)) && !togglesGroup(b)) {
      err('C5', `\`${b.kind}\` writes \`${b.target}\` — no such field in the model.`);
    }
    for (const s of b.sources) {
      if (!paths.has(fullOf(b, s))) {
        err('C5', `\`${b.kind}\` reads \`${s}\` — no such field in the model.`);
      }
    }
  }

  // C6 — селекторы render-поведения есть в разметке. Иначе правило молча ничего не делает,
  // и это худший вид поломки: ни ошибки, ни эффекта.
  for (const v of intent.visibility) {
    if (!selectors.has(v.selector)) {
      err(
        'C6',
        `A visibility rule targets \`${v.selector}\`, and the layout has no such selector — the rule would do nothing.`
      );
    }
  }
  for (const rule of intent.nodes ?? []) {
    if (rule.selector !== undefined && !selectors.has(rule.selector)) {
      err(
        'C6',
        `\`${rule.kind}\` targets the node \`${rule.selector}\`, and the layout has no such ` +
          'selector — the rule would do nothing.'
      );
    }
  }

  // C7 — граф вычислений без циклов. Реакции и свои операторы не вычисляют поле из источников:
  // их запись — по событию, и в граф вычислений они не входят.
  const deps: Dependency[] = intent.behavior
    .filter((b) => b.kind !== 'onChange' && b.kind !== 'revalidateWhen' && b.kind !== 'call')
    .map((b) => ({ target: fullOf(b, b.target), reads: b.sources.map((s) => fullOf(b, s)) }));
  const cycle = findCycle(deps);
  if (cycle) {
    err(
      'C7',
      `A cycle in computed fields: ${cycle.join(' → ')} — the runtime throws "Cycle detected".`
    );
  }

  // C8 — узел массива под-форм собран верно: есть шаблон строки, а запасной `initialValue`
  // (если задан) совпадает по ключам с itemFields. Проверка, которую схема сделать не может: она
  // видит `initialValue` как opaque-значение.
  //
  // Формат 2: шаблон нового элемента живёт в модели (`arrayOf`), поэтому `initialValue` у узла
  // необязателен; шаблон строки — именованная часть (`$part(name)`) либо `item.$template`.
  // Прежний формат: `initialValue`-объект обязателен — без него первое добавление строки падает.
  //
  // В обоих форматах это литерал ОДНОГО пустого элемента (объект), а не список начальных строк:
  // `ArrayIntent.initialValue` и `initialValue` узла называются одинаково, но значат разное.
  const arrayNodes: Array<Record<string, unknown>> = [];
  collectArrayNodes(layoutJson, arrayNodes);
  for (const node of arrayNodes) {
    const path = arrayPathOf(node) ?? '';
    const decl = intent.arrays.find((a) => (a.modelPath ?? a.name) === path);
    const sample = node.initialValue;
    const isObject = sample !== null && typeof sample === 'object' && !Array.isArray(sample);
    if (!isObject && (!view.v2 || sample !== undefined)) {
      err(
        'C8',
        view.v2
          ? `The array node \`${path}\`: initialValue must be an object — the literal of one empty row.`
          : `The array node \`${path}\` has no initialValue object — adding the first row fails.`
      );
      if (!view.v2) continue;
    }
    if (decl && isObject) {
      const declared = new Set(decl.itemFields.map((f) => f.name));
      const extra = Object.keys(sample as object).filter((k) => !declared.has(k));
      if (extra.length > 0) {
        err(
          'C8',
          `The initialValue of the array \`${path}\` has fields outside itemFields: ${extra.join(', ')}.`
        );
      }
    }
    // Шаблон строки: в формате 2 — именованная часть либо `item.$template`; в прежнем — только
    // `item.$template` (узел, положенный в `item` напрямую, ajv отвергает, а рендер не находит).
    const rowPart = view.v2 ? operatorArg(node.item, 'part') : null;
    if (rowPart !== null) {
      if (!(rowPart in view.parts)) {
        err(
          'C8',
          `The array node \`${path}\`: the row template \`$part(${rowPart})\` is not declared in \`parts\` of the document.`
        );
      }
    } else if (!isRecord(node.item) || !('$template' in node.item)) {
      err(
        'C8',
        view.v2
          ? `The array node \`${path}\`: the row template is \`"item": "$part(name)"\` or \`item.$template\`.`
          : `The array node \`${path}\`: the row template goes in \`item.$template\`.`
      );
    }
  }

  // Подформы: каждая ссылка `$part(name)` ведёт в объявленную часть.
  if (view.v2) {
    const usedParts = new Set<string>();
    collectOperators(layoutJson, 'part', usedParts);
    for (const name of usedParts) {
      if (!(name in view.parts)) {
        err('C8', `\`$part(${name})\` — no such part in \`parts\` of the document.`);
      }
    }
  }

  // C9 — мёртвые объявления. Не ошибка, но признак расхождения замысла и результата.
  for (const f of intent.fields) {
    const path = f.modelPath ?? f.name;
    if (!models.has(path)) {
      warn('C9', `The field \`${path}\` is declared and not used in the layout.`, {
        kind: 'field',
        name: path,
      });
    }
  }
  for (const d of intent.dataSources) {
    if (!dataSources.has(d.name)) {
      warn('C9', `The data source \`${d.name}\` is declared and used by no field.`, {
        kind: 'data-source',
        name: d.name,
      });
    }
  }

  // C10 — одинаковые testId. Селектор `data-testid` обязан разрешаться в один элемент:
  // при дубле браузерная автоматизация падает со strict mode violation, а раньше генератор
  // печатал два одинаковых идентификатора и тут же отвечал «кросс-проверка пройдена».
  // Строки одного массива дублями не считаются: индекс подставляет потребитель, поэтому
  // ключ учитывает путь до ближайшего array-предка.
  const testIds = new Map<string, number>();
  collectTestIds(layoutJson, '', testIds);
  for (const [id, count] of testIds) {
    if (count > 1) {
      err(
        'C10',
        `testId \`${id}\` occurs ${count} times — the selector resolves to several elements. ` +
          'The id comes from the model path: same-named leaves of different groups need a prefix.'
      );
    }
  }

  // C11 — ссылки раскладки ведут в объявленное. Генератор выбрасывает такой узел молча, поэтому
  // C1 его уже не видит: документ приходит без него, а форма — без поля.
  for (const message of inspectLayoutRefs(intent).unknown) err('C11', message);

  // C13 — шаги вперемешку с другими узлами. Мастером рисуется контейнер, ВСЕ дети которого — шаги;
  // смешанный рисовался обычным контейнером со «Step» внутри, и визард молча не работал.
  for (const message of inspectSteps(intent)) err('C13', message);

  checkOperators(intent, opts?.core ?? NO_CORE_OPERATORS, err, warn);

  return { ok: errors.length === 0, errors, warnings };
}

/** Ключи intent для операторов ядра: язык intent, они есть и без индекса ядра. */
const INTENT_OPERATOR_NAMES = [
  ...Object.keys(VALIDATION_OPERATORS),
  ...MODEL_BEHAVIOR_KINDS,
  ...NODE_BEHAVIOR_KINDS,
  ...Object.keys(BEHAVIOR_KEY_OPERATORS),
];

/**
 * C12 — свои операторы объявлены и подключаемы.
 *
 * Без этой проверки правило с именем, которого нет в ядре, уходило в импорт
 * `@reformer/core/validators`, и агент получал от компилятора «has no exported member» — без
 * подсказки, что своё правило объявляется в `operators`. Валидаторы и имена операторов ядра — из
 * его индекса; без индекса правило с незнакомым именем не отвергается — его назовёт компилятор.
 */
function checkOperators(
  intent: FormIntent,
  core: CoreOperators,
  err: (code: CrossCheckCode, message: string) => void,
  warn: (code: CrossCheckCode, message: string) => void
): void {
  const operators = intent.operators ?? {};
  const declared = (name: string) => Object.hasOwn(operators, name);
  // Имена ядра, которые свой оператор не может носить: импорт ядра и свой импорт столкнутся.
  const coreNames = new Set([...INTENT_OPERATOR_NAMES, ...core.names]);

  for (const rule of intent.validation) {
    for (const r of rule.rules) {
      const name = ruleName(r);
      if (name === null || declared(name) || !core.found || core.rules.has(name)) continue;
      err(
        'C12',
        `The rule \`${r}\` on \`${rule.target}\`: \`${name}\` is not a validator of ` +
          `@reformer/core/validators. Declare your own rule in operators: { "${name}": "./operators" }.`
      );
    }
    const head = rule.call ? ruleName(rule.call) : null;
    if (rule.call && (head === null || !declared(head))) {
      err(
        'C12',
        `The call \`${rule.call}\` on \`${rule.target}\`: the operator${head ? ` \`${head}\`` : ''} is ` +
          'not declared in operators — the build has nowhere to import it from.'
      );
    }
  }
  for (const b of intent.behavior) {
    if (b.kind !== 'call') continue;
    const head = ruleName(b.expr ?? '');
    if (head === null || !declared(head)) {
      err(
        'C12',
        `The behavior \`call\` calls \`${b.expr ?? ''}\`: the operator${head ? ` \`${head}\`` : ''} is ` +
          'not declared in operators. A core operator is written with its own kind, not through call.'
      );
    }
  }

  const code = [
    ...intent.validation.flatMap((v) => [
      ...v.rules,
      ...[v.call, v.cross, v.async, v.when].filter((part): part is string => !!part),
      ...Object.values(v.params ?? {}),
    ]),
    ...intent.behavior.flatMap((b) => [b.expr ?? '', b.when ?? '']),
    ...(intent.nodes ?? []).map((rule) => rule.expr),
    ...intent.visibility.map((v) => v.condition),
  ];
  // Функцию отправки на core зовёт разметка (`bundle.submission.submit`), а не intent: правил узлов
  // там нет (ReFormer-f2fs.17).
  const markupCalls = intent.target === 'core' ? submitHandlerOf(intent) : null;
  for (const [name, module] of Object.entries(operators)) {
    if (coreNames.has(name)) {
      err(
        'C12',
        `Your operator \`${name}\` has the name of a core operator — the imports would clash. Rename it.`
      );
    }
    if (isDerivedModule(module)) {
      err(
        'C12',
        `The operator \`${name}\` is imported from \`${module}\` — the build writes that module. ` +
          'Keep your operators in "./operators".'
      );
    }
    if (name !== markupCalls && !code.some((part) => mentionsName(part, name))) {
      warn(
        'C12',
        `The operator \`${name}\` is declared in operators, and the intent never calls it.`
      );
    }
  }
}

/**
 * Обойти дерево раскладки intent: на что оно ссылается и что из этого не объявлено.
 *
 * Обход идёт по intent, а не по документу схемы: в документе ссылки на необъявленное уже нет.
 *
 * @returns `placed` — пути полей и массивов, стоящих в раскладке; `unknown` — сообщения о ссылках в
 *   никуда.
 */
export function inspectLayoutRefs(intent: FormIntent): { placed: Set<string>; unknown: string[] } {
  const placed = new Set<string>();
  const unknown: string[] = [];
  const declared = (entities: ReadonlyArray<{ name: string; modelPath?: string }>) =>
    new Set(entities.flatMap((entity) => [entity.name, entity.modelPath ?? entity.name]));
  const fields = declared(intent.fields);
  const arrays = declared(intent.arrays);

  const walk = (node: LayoutNode, scope: string | null, parts: readonly string[]): void => {
    const absolute = (ref: string): string => (scope ? `${scope}.${ref}` : ref);
    switch (node.kind) {
      case 'field':
        placed.add(absolute(node.ref));
        if (!fields.has(absolute(node.ref))) {
          unknown.push(
            `The layout refers to the field \`${absolute(node.ref)}\` — no such field in fields.`
          );
        }
        return;
      case 'array':
        placed.add(absolute(node.ref));
        if (!arrays.has(absolute(node.ref))) {
          unknown.push(
            `The layout refers to the array \`${absolute(node.ref)}\` — no such array in arrays.`
          );
        }
        return;
      case 'part': {
        const part = intent.parts?.[node.part];
        if (!part) {
          unknown.push(`The layout mounts the part \`${node.part}\` — no such part in parts.`);
        } else if (!parts.includes(node.part)) {
          walk(part, absolute(node.ref), [...parts, node.part]);
        }
        return;
      }
      case 'text':
        return;
      default:
        for (const child of node.children) walk(child, scope, parts);
    }
  };
  walk(intent.layoutRoot, null, []);
  return { placed, unknown };
}

/**
 * Шаги в раскладке intent: контейнер, где шаги перемешаны с другими узлами, и шаг внутри шага.
 *
 * @returns Сообщения C13.
 */
export function inspectSteps(intent: FormIntent): string[] {
  const out: string[] = [];
  const label = (node: LayoutNode): string =>
    node.kind === 'step'
      ? `step «${node.title}»`
      : node.kind === 'container'
        ? `container \`${node.selector ?? node.component}\``
        : node.kind === 'text'
          ? `text «${node.text}»`
          : `\`${node.ref}\``;
  const walk = (node: LayoutNode, insideStep: boolean): void => {
    if (node.kind !== 'container' && node.kind !== 'step') return;
    if (node.kind === 'step' && insideStep) {
      out.push(`${label(node)} is nested in another step — a wizard holds steps one level deep.`);
    }
    const steps = node.children.filter((child) => child.kind === 'step');
    const others = node.children.filter((child) => child.kind !== 'step');
    if (steps.length > 0 && others.length > 0) {
      out.push(
        `${label(node)} mixes steps with other nodes (${others.map(label).join(', ')}) — a ` +
          'wizard container holds only steps; put these nodes into a step.'
      );
    }
    for (const child of node.children) walk(child, insideStep || node.kind === 'step');
  };
  walk(intent.layoutRoot, false);
  for (const part of Object.values(intent.parts ?? {})) walk(part, false);
  return out;
}

/**
 * Собрать `componentProps.testId` с учётом области массива.
 *
 * Внутри `item.$template` все строки массива рендерятся по одному шаблону, поэтому их
 * идентификаторы совпадают по определению — это не дубль. Считаем такие вхождения один раз,
 * пометив областью, а дублями объявляем только совпадения в пределах одной области.
 *
 * Именованная часть документа формата 2 — своя область: её шаблон лежит в `parts` один раз,
 * сколько бы узлов его ни подключало.
 */
function collectTestIds(node: unknown, scope: string, out: Map<string, number>): void {
  if (Array.isArray(node)) {
    for (const v of node) collectTestIds(v, scope, out);
    return;
  }
  if (!node || typeof node !== 'object') return;

  const rec = node as Record<string, unknown>;
  if (rec.format === 2 && isRecord(rec.parts)) {
    for (const [name, part] of Object.entries(rec.parts)) {
      collectTestIds(part, `${scope}/part:${name}`, out);
    }
    collectTestIds(rec.root, scope, out);
    return;
  }
  const props = rec.componentProps;
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    const testId = (props as Record<string, unknown>).testId;
    if (typeof testId === 'string') {
      const key = `${scope} ${testId}`;
      out.set(key, (out.get(key) ?? 0) + 1);
    }
  }

  const arrayPath = arrayPathOf(rec);
  for (const [key, value] of Object.entries(rec)) {
    if (key === 'componentProps') continue;
    const nextScope = key === 'item' && arrayPath !== null ? `${scope}/${arrayPath}` : scope;
    collectTestIds(value, nextScope, out);
  }
}

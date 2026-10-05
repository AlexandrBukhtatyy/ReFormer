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
import { modelPaths, type FormIntent } from './form-intent.js';
import { collectUsedComponents } from './builders.js';

/** Код проверки. Стабилен: на него ссылаются сообщения и тесты. */
export type CrossCheckCode = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10';

export interface CrossCheckIssue {
  code: CrossCheckCode;
  severity: 'error' | 'warning';
  message: string;
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
const BUILTIN_COMPONENTS = new Set([
  'FIELD_WRAPPER',
  'Step',
  'FormWizard',
  'Wizard',
  'RendererFormWizard',
  'Box',
  'Section',
  'FormArray',
]);

export function crossCheckBundle(
  intent: FormIntent,
  layoutJson: unknown,
  opts?: { componentNames?: string[]; dataSourceNames?: string[] }
): CrossCheckReport {
  const errors: CrossCheckIssue[] = [];
  const warnings: CrossCheckIssue[] = [];
  const err = (code: CrossCheckCode, message: string) =>
    errors.push({ code, severity: 'error', message });
  const warn = (code: CrossCheckCode, message: string) =>
    warnings.push({ code, severity: 'warning', message });

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
      err('C1', `$model(${m}) — такого пути нет в модели. Привязка ведёт в никуда.`);
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
        `$component(${c}) не объявлен ни одним полем intent и не передан в componentNames — в реестре его не будет.`
      );
    } else {
      // Контейнерным компонентам места в FormIntent нет: он описывает поля, а не разметку.
      // Пока реальные ключи реестра не переданы, отличить «забыли зарегистрировать» от
      // «это контейнер» нельзя — поэтому предупреждение, а не ошибка.
      warn(
        'C2',
        `$component(${c}) не объявлен ни одним полем intent. Если это контейнер или прикладной шим — так и должно быть; чтобы проверить по-настоящему, передайте componentNames с ключами реестра.`
      );
    }
  }

  // C3 — каждый источник данных объявлен.
  const declaredSources = new Set(intent.dataSources.map((d) => d.name));
  for (const d of dataSources) {
    if (!declaredSources.has(d)) {
      err('C3', `$dataSource(${d}) не объявлен в intent.dataSources — реестр его не отдаст.`);
    }
  }

  // C4 — цели правил валидации существуют.
  for (const rule of intent.validation) {
    const target = rule.each ? `${rule.each}.${rule.target}` : rule.target;
    const known = paths.has(target) || paths.has(rule.target);
    if (!known) err('C4', `Правило валидации на \`${target}\` — такого пути в модели нет.`);
  }

  // C5 — цели и источники поведения существуют.
  for (const b of intent.behavior) {
    if (!paths.has(b.target)) {
      err('C5', `Поведение \`${b.kind}\` пишет в \`${b.target}\` — такого поля в модели нет.`);
    }
    for (const s of b.sources) {
      if (!paths.has(s)) {
        err('C5', `Поведение \`${b.kind}\` читает \`${s}\` — такого поля в модели нет.`);
      }
    }
  }

  // C6 — селекторы render-поведения есть в разметке. Иначе правило молча ничего не делает,
  // и это худший вид поломки: ни ошибки, ни эффекта.
  for (const v of intent.visibility) {
    if (!selectors.has(v.selector)) {
      err(
        'C6',
        `Видимость адресует \`${v.selector}\`, но такого selector в разметке нет — правило будет no-op.`
      );
    }
  }

  // C7 — граф вычислений без циклов.
  const deps: Dependency[] = intent.behavior
    .filter((b) => b.kind !== 'onChange' && b.kind !== 'revalidateWhen')
    .map((b) => ({ target: b.target, reads: b.sources }));
  const cycle = findCycle(deps);
  if (cycle) {
    err('C7', `Цикл в вычисляемых полях: ${cycle.join(' → ')}. Рантайм бросит «Cycle detected».`);
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
          ? `Узел массива \`${path}\`: initialValue должен быть объектом — литералом одного пустого элемента.`
          : `Узел массива \`${path}\` без initialValue-объекта — первое добавление строки упадёт.`
      );
      if (!view.v2) continue;
    }
    if (decl && isObject) {
      const declared = new Set(decl.itemFields.map((f) => f.name));
      const extra = Object.keys(sample as object).filter((k) => !declared.has(k));
      if (extra.length > 0) {
        err(
          'C8',
          `initialValue массива \`${path}\` содержит поля вне itemFields: ${extra.join(', ')}.`
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
          `Узел массива \`${path}\`: шаблон строки \`$part(${rowPart})\` не объявлен в \`parts\` документа.`
        );
      }
    } else if (!isRecord(node.item) || !('$template' in node.item)) {
      err(
        'C8',
        view.v2
          ? `Узел массива \`${path}\`: шаблон строки — \`"item": "$part(имя)"\` либо \`item.$template\`.`
          : `Узел массива \`${path}\`: шаблон элемента должен лежать в \`item.$template\`.`
      );
    }
  }

  // Подформы: каждая ссылка `$part(name)` ведёт в объявленную часть.
  if (view.v2) {
    const usedParts = new Set<string>();
    collectOperators(layoutJson, 'part', usedParts);
    for (const name of usedParts) {
      if (!(name in view.parts)) {
        err('C8', `\`$part(${name})\` — такой части нет в \`parts\` документа.`);
      }
    }
  }

  // C9 — мёртвые объявления. Не ошибка, но признак расхождения замысла и результата.
  for (const f of intent.fields) {
    const path = f.modelPath ?? f.name;
    if (!models.has(path)) warn('C9', `Поле \`${path}\` объявлено, но в разметке не используется.`);
  }
  for (const d of intent.dataSources) {
    if (!dataSources.has(d.name))
      warn('C9', `dataSource \`${d.name}\` объявлен, но не используется.`);
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
        `testId \`${id}\` встречается ${count} раза — селектор разрешится в несколько элементов. ` +
          'Идентификатор выводится из пути модели: одноимённые листья разных групп должны нести префикс.'
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
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

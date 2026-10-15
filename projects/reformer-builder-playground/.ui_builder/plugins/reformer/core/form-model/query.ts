/**
 * Запросы к документу `JsonFormSchema` только для чтения: поиск узла по пути, путь родителя-узла,
 * обход всех узлов и сбор `$model`-путей / имён операторов (для synth-model и mock-sources
 * runtime-preview), чтение именованных частей документа.
 *
 * ## Именованные части документа
 *
 * Документ формата 2 держит рядом с деревом корня словарь `parts`: имя → разметка подформы. Часть
 * подключается оператором `$part(имя)` двумя способами:
 *
 * ```text
 * { model: '$model(registrationAddress)', part: '$part(address)' }   узел-часть: подформа под группой модели
 * { model: '$model(coBorrowers)', item: '$part(coBorrower)' }        массив: часть — шаблон строки
 * ```
 *
 * Пути `$model(...)` внутри части относительны месту подключения — группе либо строке массива.
 * Поэтому одна часть ставится сколько угодно раз, а её узлы живут в СВОЕЙ области: адресуются из
 * поведения части, а не формы (`apply` для группы, `applyEach` для массива).
 *
 * ## Два обхода: редактора и анализа
 *
 * Обходы редактора ({@link walkNodes}, `node-kind.childSlots`) в части НЕ заходят, и это решение,
 * а не пробел: у узла части нет ни места в дереве редактора, ни идентификатора (`$nodeId`), ни
 * операций правки — документ с частями открывается и сохраняется, не меняя их текста. Но АНАЛИЗУ
 * формы части нужны целиком: без них тип формы теряет подформы, реестр — компоненты и источники
 * данных, проверка — ошибки в разметке части. Для анализа — {@link walkDocumentNodes}: корень и
 * разметка каждой части по одному разу.
 *
 * Часть обходится КАК ЗАПИСАНА, а не «в месте подключения»: сколько раз часть смонтирована, для
 * анализа разметки неважно. Кому важны места подключения — {@link collectPartMounts}.
 *
 * Живёт это здесь, а не отдельным модулем: каталог `form-model` упёрся в планку числа модулей
 * (`integration/structure.test.ts`), а чтение частей — такой же запрос к документу, как остальные.
 *
 * @module plugins/reformer/core/form-model/query
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  isPartNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { getAt, isPrefix, pathEquals, type JsonPath } from './paths';
import { nodeIdOf, type NodeId } from './node-id';
import { childSlots, isNodeLike, isStepsHost, orientationOf, type Orientation } from './node-kind';

/** Узел по пути (или `undefined`, если по пути не узел). */
export function findByPath(schema: JsonFormSchema, path: JsonPath): JsonNode | undefined {
  const v = getAt(schema, path);
  return isNodeLike(v) ? (v as JsonNode) : undefined;
}

/**
 * Путь ОХВАТЫВАЮЩЕГО узла (родителя в терминах дерева, а не JSON-объекта): у пути узла
 * отрезается суффикс слота. Возвращает `null` для корня (`['root']`) или если хвост не
 * распознан как слот.
 *
 * Распознаваемые хвосты:
 * - `['children', i]`                      → контейнер-родитель либо визард (шаги — его `children`)
 * - `['item', '$template']`                → массив-родитель
 * - `['wrapper']`                          → поле-родитель
 */
export function parentNodePath(path: JsonPath): JsonPath | null {
  const n = path.length;
  if (n === 0) return null;
  const last = path[n - 1];
  const prev = path[n - 2];

  if (prev === 'children' && isIndex(last)) return path.slice(0, n - 2);
  if (prev === 'item' && last === '$template') return path.slice(0, n - 2);
  if (last === 'wrapper') return path.slice(0, n - 1);
  return null;
}

function isIndex(seg: JsonPath[number]): boolean {
  return typeof seg === 'number' || /^\d+$/.test(String(seg));
}

/**
 * Обойти все узлы ДЕРЕВА КОРНЯ (pre-order), начиная с корневого (`['root']`), через
 * {@link childSlots}.
 *
 * Это обход редактора: у каждого посещённого узла есть место в дереве и адрес правки. В разметку
 * именованных частей (`parts`) он не заходит — части не редактируются. Анализу, которому нужен
 * документ целиком (типы, источники данных, проверки), — {@link walkDocumentNodes}.
 */
export function walkNodes(
  schema: JsonFormSchema,
  visit: (node: JsonNode, path: JsonPath) => void
): void {
  const start = schema.root;
  if (!isNodeLike(start)) return;
  const rec = (node: JsonNode, path: JsonPath) => {
    visit(node, path);
    for (const slot of childSlots(node, path)) {
      for (const entry of slot.entries) {
        rec(entry.node, slot.single ? slot.path : [...slot.path, entry.index]);
      }
    }
  };
  rec(start, ['root']);
}

/**
 * Указатель «идентификатор узла → путь узла» по всей схеме.
 *
 * Обход тот же, что у {@link walkNodes}, — значит пути здесь совпадают с теми, по которым
 * узел находят `findByPath` и провайдер модели. Повторный идентификатор — ошибка схемы, и
 * находит её валидатор; здесь выигрывает первое вхождение, чтобы ответ был детерминирован.
 * Узлы без идентификатора в указатель не попадают: адресовать их нечем.
 */
export function indexNodePaths(schema: JsonFormSchema): ReadonlyMap<NodeId, JsonPath> {
  const out = new Map<NodeId, JsonPath>();
  walkNodes(schema, (node, path) => {
    const id = nodeIdOf(node);
    if (id !== undefined && !out.has(id)) out.set(id, path);
  });
  return out;
}

/**
 * Верхнеуровневые `$model(path)` формы — привязки полей, массивов и подформ (ключ `model`).
 * В `item.$template` и в разметку подформы НЕ спускаемся: пути там относительны элементу или
 * группе и не входят в модель верхнего уровня. Результат дедуплицирован, порядок — по обходу.
 */
export function collectModelPaths(schema: JsonFormSchema): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (arg: string) => {
    if (!seen.has(arg)) {
      seen.add(arg);
      out.push(arg);
    }
  };
  const rec = (node: JsonNode) => {
    // Массив, подформа и поле: привязка одна, вглубь не идём — у массива и подформы там пути
    // относительные, у поля детей с привязками нет.
    if (isArrayNode(node) || isPartNode(node) || isFieldNode(node)) {
      const p = parseOperator(node.model);
      if (p?.op === 'model') push(p.arg);
      return;
    }
    if (isContainerNode(node)) {
      // Шаги визарда — те же `children`: отдельного обхода им не нужно.
      (node as JsonContainerNode).children?.forEach((child) => {
        // Текстовая часть тоже может нести `$model(...)` — реактивный текст узла.
        if (!isNodeLike(child)) {
          const p = parseOperator(child);
          if (p?.op === 'model') push(p.arg);
          return;
        }
        rec(child);
      });
    }
  };
  if (isNodeLike(schema.root)) rec(schema.root);
  return out;
}

/** Имена операторов, встречающиеся где угодно в схеме (включая props и шаблоны массивов). */
export interface OperatorNames {
  components: string[];
  dataSources: string[];
  fns: string[];
  locales: string[];
}

/**
 * Сбор имён `$component/$dataSource/$fn/$locale` из ВСЕГО документа (рекурсивный скан значений,
 * включая componentProps, `item.$template` и именованные части `parts`). `$model` игнорируется.
 * Нужен для регистрации заглушек источников и детекта незарегистрированных компонентов в
 * runtime-preview.
 */
export function collectOperatorNames(schema: JsonFormSchema): OperatorNames {
  const components = new Set<string>();
  const dataSources = new Set<string>();
  const fns = new Set<string>();
  const locales = new Set<string>();

  const scan = (v: unknown) => {
    if (typeof v === 'string') {
      const p = parseOperator(v);
      if (p) {
        if (p.op === 'component') components.add(p.arg);
        else if (p.op === 'dataSource') dataSources.add(p.arg);
        else if (p.op === 'fn') fns.add(p.arg);
        else if (p.op === 'locale') locales.add(p.arg);
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(scan);
      return;
    }
    if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) scan(val);
    }
  };

  scan(schema.root);
  // Разметка подформ лежит вне дерева корня, но рендерер строит её теми же компонентами.
  scan(schema.parts);
  return {
    components: [...components],
    dataSources: [...dataSources],
    fns: [...fns],
    locales: [...locales],
  };
}

/** Является ли путь путём того же узла (утилита для стора: сравнение выделения). */
export function isSameNode(a: JsonPath, b: JsonPath): boolean {
  return pathEquals(a, b);
}

// ── именованные части документа ───────────────────────────────────────────────

/** Ключ словаря частей в документе — первый сегмент пути узла части. */
export const PARTS_KEY = 'parts';

/** Имя части из оператора `$part(имя)`; `undefined` — значение не этот оператор. */
export function partNameOf(value: unknown): string | undefined {
  const op = parseOperator(value);
  return op?.op === 'part' ? op.arg : undefined;
}

/**
 * Имя части, из которой узел берёт разметку: узел-часть (`part`) либо массив с шаблоном строки
 * `item: "$part(имя)"`. У остальных узлов разметка лежит в них самих — `undefined`.
 */
export function partRefOf(node: JsonNode): string | undefined {
  if (isArrayNode(node)) return partNameOf(node.item);
  if (isPartNode(node)) return partNameOf(node.part);
  return undefined;
}

/**
 * Части документа: имя → разметка. Запись, не похожая на узел, пропускается — о ней скажет
 * проверка схемы, а обходу там делать нечего.
 */
export function documentParts(schema: JsonFormSchema): ReadonlyMap<string, JsonNode> {
  const out = new Map<string, JsonNode>();
  const parts: unknown = schema.parts;
  if (parts === null || typeof parts !== 'object' || Array.isArray(parts)) return out;
  for (const [name, markup] of Object.entries(parts as Record<string, unknown>)) {
    if (isNodeLike(markup)) out.set(name, markup);
  }
  return out;
}

/**
 * Шаблон строки массива: вписанный узел (`item.$template`) либо разметка части (`item: "$part"`).
 *
 * `part` — имя части, если шаблон взят из неё; у вписанного шаблона `null`. `undefined` — шаблона
 * нет: ссылка на несуществующую часть либо узел без `item`.
 */
export function rowTemplateOf(
  node: JsonNode,
  parts: ReadonlyMap<string, JsonNode>
): { readonly node: JsonNode; readonly part: string | null } | undefined {
  if (!isArrayNode(node)) return undefined;
  const item: unknown = node.item;
  const name = partNameOf(item);
  if (name !== undefined) {
    const markup = parts.get(name);
    return markup === undefined ? undefined : { node: markup, part: name };
  }
  const template =
    typeof item === 'object' && item !== null
      ? (item as { $template?: unknown }).$template
      : undefined;
  return isNodeLike(template) ? { node: template, part: null } : undefined;
}

/** Часть, в разметке которой лежит место с таким путём; `null` — место в дереве корня. */
export function partOfPath(path: JsonPath): string | null {
  return path[0] === PARTS_KEY && typeof path[1] === 'string' ? path[1] : null;
}

/** Откуда узел: из дерева корня либо из разметки части. */
export interface NodeOrigin {
  /** Имя части, в разметке которой узел записан; `null` — узел дерева корня. */
  readonly part: string | null;
}

/**
 * Обойти ВСЕ узлы документа: дерево корня (`['root', …]`), затем разметку каждой части
 * (`['parts', имя, …]`) в порядке объявления. Внутри дерева — тот же обход, что у
 * `query.walkNodes` (через {@link childSlots}): шаблоны строк и обёртки полей посещаются.
 *
 * Для анализа, а не для редактора: пути узлов частей годятся, чтобы назвать место и определить
 * область, но адресами правки не служат.
 */
export function walkDocumentNodes(
  schema: JsonFormSchema,
  visit: (node: JsonNode, path: JsonPath, origin: NodeOrigin) => void
): void {
  const rec = (node: JsonNode, path: JsonPath, origin: NodeOrigin): void => {
    visit(node, path, origin);
    for (const slot of childSlots(node, path)) {
      for (const entry of slot.entries) {
        rec(entry.node, slot.single ? slot.path : [...slot.path, entry.index], origin);
      }
    }
  };
  if (isNodeLike(schema.root)) rec(schema.root, ['root'], { part: null });
  for (const [name, markup] of documentParts(schema))
    rec(markup, [PARTS_KEY, name], { part: name });
}

/** Место подключения части. */
export interface PartMount {
  /** Имя части. */
  readonly part: string;
  /** `group` — узел-часть под группой модели; `rows` — шаблон строки массива. */
  readonly kind: 'group' | 'rows';
  /** Путь модели места подключения — от области, в которой стоит узел. */
  readonly model: string;
  /** Узел, который подключает часть, и его путь в документе. */
  readonly node: JsonNode;
  readonly path: JsonPath;
  /** Где стоит узел: в дереве корня либо в разметке другой части. */
  readonly origin: NodeOrigin;
}

/**
 * Все места подключения частей — в порядке обхода документа (корень первым).
 *
 * Ссылка на часть, которой в документе нет, сюда тоже попадает: «есть ли такая часть» решает
 * вызывающий (кодоген такую пропускает, проверка — сообщает).
 */
export function collectPartMounts(schema: JsonFormSchema): readonly PartMount[] {
  const out: PartMount[] = [];
  walkDocumentNodes(schema, (node, path, origin) => {
    const part = partRefOf(node);
    const model = parseOperator((node as { model?: unknown }).model);
    if (part === undefined || model?.op !== 'model') return;
    out.push({
      part,
      kind: isArrayNode(node) ? 'rows' : 'group',
      model: model.arg,
      node,
      path,
      origin,
    });
  });
  return out;
}

// ── навигация по дереву (для горячих клавиш) ──────────────────────────────────

/** Позиция узла среди соседей в его массив-слоте (`children`/`steps`). `null` — не в массив-слоте. */
export interface SiblingInfo {
  slotPath: JsonPath;
  /** Индекс узла в ИСХОДНОМ массиве-слоте (совпадает с последним сегментом пути). */
  index: number;
  /**
   * Индексы всех УЗЛОВ слота в исходном массиве, по порядку. Соседями считаются только они:
   * текстовые части `children` собственного места на canvas не имеют, и выделение по ним не ходит.
   */
  siblings: number[];
  /** Длина исходного массива-слота, включая текстовые части (позиция вставки «в конец»). */
  count: number;
}

/** Найти массив-слот и индекс узла среди соседей. Одиночные слоты (template/wrapper) — не соседи. */
export function siblingInfo(schema: JsonFormSchema, path: JsonPath): SiblingInfo | null {
  const parentP = parentNodePath(path);
  if (!parentP) return null;
  const parentNode = getAt(schema, parentP);
  if (!isNodeLike(parentNode)) return null;
  for (const slot of childSlots(parentNode, parentP)) {
    if (slot.single) continue;
    if (isPrefix(slot.path, path) && path.length === slot.path.length + 1) {
      return {
        slotPath: slot.path,
        index: Number(path[path.length - 1]),
        siblings: slot.entries.map((e) => e.index),
        count: slot.length,
      };
    }
  }
  return null;
}

/** Первый ребёнок узла (для навигации «внутрь»), либо `null`. */
export function firstChildPath(schema: JsonFormSchema, path: JsonPath): JsonPath | null {
  const node = getAt(schema, path);
  if (!isNodeLike(node)) return null;
  for (const slot of childSlots(node, path)) {
    if (slot.entries.length === 0) continue;
    return slot.single ? slot.path : [...slot.path, slot.entries[0].index];
  }
  return null;
}

/** Направление навигации/перемещения (нажатая стрелка). */
export type NavDir = 'up' | 'down' | 'left' | 'right';

/** Смысл стрелки после проекции на ось раскладки: сосед до/после, наружу к родителю, вглубь к ребёнку. */
export type NavIntent = 'prev' | 'next' | 'out' | 'in';

/**
 * Ось, вдоль которой лежат соседи узла — это ось раскладки его родителя ({@link orientationOf}).
 * Горизонтальна только для слота `children` контейнера-ряда: `steps`/`template`/`wrapper` canvas
 * всегда рисует столбцом, независимо от классов родителя. Шаги лежат в том же `children`, что и
 * обычные дети, поэтому слот шагов узнаётся по родителю-визарду, а не по хвосту пути.
 */
export function siblingAxis(schema: JsonFormSchema, path: JsonPath): Orientation {
  if (path[path.length - 2] !== 'children') return 'vertical';
  const parentP = parentNodePath(path);
  if (!parentP) return 'vertical';
  const parentNode = getAt(schema, parentP);
  if (!isNodeLike(parentNode) || isStepsHost(parentNode)) return 'vertical';
  return orientationOf(parentNode);
}

/**
 * Проекция стрелки на ось раскладки: вдоль оси — соседи (`prev`/`next`), поперёк — движение по
 * дереву (`out` к родителю, `in` к первому ребёнку). В столбце ↑↓ ходят по соседям, а ←→ — по
 * дереву; в ряду — наоборот, ←→ по соседям, ↑↓ по дереву.
 */
export function navIntent(dir: NavDir, axis: Orientation): NavIntent {
  const horizontal = axis === 'horizontal';
  switch (dir) {
    case 'up':
      return horizontal ? 'out' : 'prev';
    case 'down':
      return horizontal ? 'in' : 'next';
    case 'left':
      return horizontal ? 'prev' : 'out';
    default:
      return horizontal ? 'next' : 'in';
  }
}

/** Смысл стрелки для конкретного узла: {@link navIntent} на его {@link siblingAxis}. */
export function navIntentAt(schema: JsonFormSchema, path: JsonPath, dir: NavDir): NavIntent {
  return navIntent(dir, siblingAxis(schema, path));
}

/**
 * Соседний узел В ТОМ ЖЕ слоте по направлению `intent`; `null` на границе слота (и для узлов вне
 * массив-слота). Без краевого перехода — им пользуется Shift-расширение выделения, которое живёт
 * внутри одного слота.
 */
export function siblingTarget(
  schema: JsonFormSchema,
  path: JsonPath,
  intent: 'prev' | 'next'
): JsonPath | null {
  const sib = siblingInfo(schema, path);
  if (!sib) return null;
  // Шаг по списку УЗЛОВ слота, а не по индексам массива: между узлами могут лежать текстовые части.
  const pos = sib.siblings.indexOf(sib.index);
  if (pos < 0) return null;
  const next = intent === 'prev' ? pos - 1 : pos + 1;
  return next < 0 || next >= sib.siblings.length ? null : [...sib.slotPath, sib.siblings[next]];
}

/**
 * Первый следующий сосед вверх по цепочке предков: выход за конец слота продолжается с соседа
 * контейнера, потом соседа его контейнера и так далее. `null`, если правее/ниже уже ничего нет.
 */
function nextBeyondSlot(schema: JsonFormSchema, path: JsonPath): JsonPath | null {
  let p = parentNodePath(path);
  while (p) {
    const t = siblingTarget(schema, p, 'next');
    if (t) return t;
    p = parentNodePath(p);
  }
  return null;
}

/**
 * Целевой путь навигации; стрелка трактуется относительно оси раскладки родителя
 * ({@link navIntentAt}): вдоль оси — предыдущий/следующий сосед, поперёк — родитель / первый
 * ребёнок.
 *
 * На границе слота курсор не упирается, а перешагивает её (как обход дерева в DevTools):
 * «дальше» с последнего узла — на следующего соседа ближайшего предка ({@link nextBeyondSlot}),
 * «назад» с первого — на родителя. Вглубь контейнера ↑↓ при этом не проваливаются: вход внутрь
 * остаётся отдельным направлением (`in`). `null`, если идти уже некуда.
 */
export function navTarget(schema: JsonFormSchema, path: JsonPath, dir: NavDir): JsonPath | null {
  const intent = navIntentAt(schema, path, dir);
  if (intent === 'out') return parentNodePath(path);
  if (intent === 'in') return firstChildPath(schema, path);
  const sib = siblingTarget(schema, path, intent);
  if (sib) return sib;
  return intent === 'prev' ? parentNodePath(path) : nextBeyondSlot(schema, path);
}

/**
 * Стабильные идентификаторы узлов — адрес, который переживает правку соседей.
 *
 * **Зачем, если есть путь.** `JsonPath`/JSON Pointer ({@link './paths'}) адресует узел ПОЗИЦИЕЙ,
 * поэтому вставка соседа сдвигает адрес у всех, кто ниже. Для правки «здесь и сейчас» это годится,
 * для диагностики, журнала операций и выделения, переживающего чужую правку, — нет. Идентификатор
 * не съезжает: он лежит на самом узле.
 *
 * **Почему ключ называется `$nodeId`** (решено спайком, альтернативы отвергнуты по причинам):
 * `$id` — ключевое слово JSON Schema, им пользуются мета-схемы формы, и внутри узла он читался бы
 * как «идентификатор схемы»; `id` уже занят НА КОРНЕ схемы с другим смыслом; голый `nodeId` стал
 * бы визуальным двойником `selector`, а их надо разводить — `selector` пишет автор и адресует им
 * поведение рендера, `$nodeId` выдаёт машина и в поведении не адресуется. Префикс `$` у КЛЮЧА
 * в этом DSL уже означает служебную механику (`$schema`, `$template`) и с операторами
 * не конфликтует: операторы — это `$`-префиксные ЗНАЧЕНИЯ.
 *
 * **Идентификатор кладётся на узел, а не в `componentProps`.** Конвертер отбрасывает неизвестные
 * поля узла, а содержимое `componentProps` копирует поголовно, и очистка пропсов для html-тегов
 * устроена как список запрещённого, а не разрешённого. Поле в `componentProps` доехало бы до DOM
 * неизвестным атрибутом на каждом `$html(...)`-узле.
 *
 * **Генератор внедряемый.** `Math.random`/`crypto` в теле модуля сделали бы недетерминированным
 * всё, что через него проходит, включая тесты правок. Поэтому источник случайности — параметр
 * фабрики ({@link createNodeIdFactory}), а {@link newNodeId} — всего лишь умолчание поверх
 * `crypto.getRandomValues`.
 *
 * **Тип узла в `@reformer/renderer-json` про `$nodeId` не знает.** Расширение объявлено здесь
 * ({@link IdentifiedNode}) локально: правку пакета делают отдельно, а домену хватает того, что
 * лишний ключ узла контракт переживает — порядок ключей и неизвестные ключи сохраняются
 * (см. шапку {@link './paths'}).
 *
 * **Двойник адреса лечится перевыдачей, а не отказом.** Схему пишут руками и генерируют чужими
 * инструментами; склейка двух файлов или копипаста поддерева приносит два узла с одним `$nodeId`,
 * и это не редкость, а нормальный вход. Отказ разбора закрыл бы такой файл для структурного
 * редактора целиком — то есть наказал бы пользователя за то, что чинится само. Поэтому второй
 * и следующие носители занятого адреса получают новый ({@link assignNodeIds}), а факт
 * возвращается списком ({@link NodeIdAssignment.duplicates}) — тому, кто захочет о нём сообщить.
 *
 * Перевыдача — то же самое лечение, которое здесь уже применяется к двум соседним порокам:
 * адреса нет вовсе и адрес не той формы ({@link NODE_ID_PATTERN}). Все три означают одно —
 * «файл не несёт годного адреса для этого узла», — и лечить их по-разному было бы непоследовательно.
 *
 * @module reformer-builder/lib/form-model/node-id
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { isNodeLike } from './node-kind';

/** Идентификатор узла: ровно 8 символов base36 (`[0-9a-z]`). */
export type NodeId = string;

/** Длина идентификатора в символах. */
export const NODE_ID_LENGTH = 8;

/** Форма идентификатора. Значение другой формы считается ЧУЖИМ и переписывается. */
export const NODE_ID_PATTERN = /^[0-9a-z]{8}$/;

/** Ключ идентификатора в узле схемы. */
export const NODE_ID_KEY = '$nodeId';

/** Узел с идентификатором — локальное расширение типа `@reformer/renderer-json`. */
export type IdentifiedNode<T = unknown> = JsonNode<T> & { $nodeId?: NodeId };

/** Значение имеет форму идентификатора узла. */
export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && NODE_ID_PATTERN.test(value);
}

/** Идентификатор узла, если он есть и имеет правильную форму. */
export function nodeIdOf(node: JsonNode): NodeId | undefined {
  const raw = (node as IdentifiedNode).$nodeId;
  return isNodeId(raw) ? raw : undefined;
}

/**
 * Источник случайности — форма `crypto.getRandomValues`: заполняет переданный буфер байтами.
 * Буфер, а не число: так подставной источник в тесте задаёт РОВНО те байты, из которых сложится
 * идентификатор, и ожидание в тесте пишется, а не подсматривается.
 */
export type RandomBytes = (out: Uint8Array) => void;

/** Генератор идентификаторов. */
export type NodeIdFactory = () => NodeId;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Наибольшее кратное 36, помещающееся в байт (36 × 7). Байты не меньше него отбрасываются:
 * при простом `byte % 36` первые четыре символа алфавита выпадали бы чаще прочих (256 = 7×36 + 4).
 */
const REJECT_FROM = 252;

/**
 * Сколько раз подряд источнику разрешено не дать ни одного годного байта. Защита от сломанного
 * источника (например, подставного, отдающего одни `0xff`): без неё цикл был бы бесконечным.
 */
const MAX_REFILLS = 32;

/**
 * Фабрика генератора: источник случайности внедряется, поэтому тест получает предсказуемую
 * последовательность идентификаторов, а не «что-нибудь из восьми символов».
 *
 * @param randomBytes - Заполнитель буфера (в бою — `crypto.getRandomValues`).
 * @returns Функция, выдающая новый идентификатор на каждый вызов.
 */
export function createNodeIdFactory(randomBytes: RandomBytes): NodeIdFactory {
  return () => {
    const buf = new Uint8Array(NODE_ID_LENGTH);
    let out = '';
    let cursor = buf.length; // первый проход сразу дозаполнит буфер
    let refills = 0;
    while (out.length < NODE_ID_LENGTH) {
      if (cursor >= buf.length) {
        if (refills >= MAX_REFILLS) {
          throw new Error('createNodeIdFactory: источник случайности не даёт годных байтов');
        }
        randomBytes(buf);
        refills += 1;
        cursor = 0;
      }
      const byte = buf[cursor];
      cursor += 1;
      if (byte < REJECT_FROM) out += ALPHABET[byte % ALPHABET.length];
    }
    return out;
  };
}

/** Умолчание: генератор поверх `crypto.getRandomValues`. */
export const newNodeId: NodeIdFactory = createNodeIdFactory((out) => {
  crypto.getRandomValues(out);
});

/** Результат выдачи адресов вместе с тем, что при ней пришлось починить. */
export interface NodeIdAssignment<T> {
  readonly schema: JsonFormSchema<T>;
  /**
   * Адреса, встреченные в схеме больше одного раза.
   *
   * Первый носитель адрес сохранил, второму и следующим он перевыдан — тем же правилом
   * «первый выигрывает», по которому строится указатель узлов у редактора. Пустой список —
   * файл пришёл с уникальными адресами и ничего не чинилось.
   *
   * Список нужен тому, кто хочет сообщить о находке: сама схема после {@link assignNodeIds}
   * уже исправна, и по ней двойника не видно — как и любой другой починенной поломки.
   */
  readonly duplicates: readonly NodeId[];
}

/**
 * Выдать идентификаторы узлам, у которых их нет или чей адрес занят соседом, СОХРАНЯЯ structural
 * sharing: ветка, где все узлы уже с уникальными идентификаторами, возвращается ТОЙ ЖЕ по ссылке,
 * а нетронутая схема — сама собой.
 *
 * На этом свойстве держится дешёвая отмена (снимок = три указателя) и сравнение `!==` вместо
 * глубокого обхода в тех местах, которые решают, перерисовываться ли им.
 *
 * Идентификатор ставится ПЕРВЫМ ключом узла (у нового ключа позиция всё равно свободна, а в diff
 * его видно сразу); порядок остальных ключей не меняется — требование round-trip.
 *
 * Обход НЕ учитывает листовые компоненты ({@link './node-kind'.isLeafComponent}), в отличие от
 * {@link './node-kind'.childSlots}: множество листьев принадлежит АКТИВНОМУ киту, а идентификатор
 * обязан быть стабильным при его смене. Узел, оказавшийся под листом, идентификатор получит —
 * это дешевле, чем потерять адрес при переключении кита.
 *
 * **Проверка уникальности идёт тем же обходом, что и выдача**, а не вторым проходом: два обхода
 * по разным правилам разошлись бы на первом же неоднородном слоте, и тогда «двойников нет»
 * означало бы «второй обход их не искал».
 *
 * @param schema - Схема (не изменяется).
 * @param next - Генератор; по умолчанию {@link newNodeId}. В тестах подставляется свой.
 * @returns Схема, у которой каждый узел несёт УНИКАЛЬНЫЙ `$nodeId`, и список починенных адресов.
 */
export function assignNodeIds<T>(
  schema: JsonFormSchema<T>,
  next: NodeIdFactory = newNodeId
): NodeIdAssignment<T> {
  const context: WalkContext = {
    next,
    reissue: false,
    taken: new Set<NodeId>(),
    duplicates: new Set<NodeId>(),
  };
  const root = walkNode(schema.root as JsonNode, context);
  return {
    schema: root === (schema.root as JsonNode) ? schema : { ...schema, root: root as JsonNode<T> },
    duplicates: [...context.duplicates],
  };
}

/**
 * {@link assignNodeIds} без отчёта — форма для тех, кому починка нужна, а находки не нужны
 * (разбор документа, тесты, нормализация).
 */
export function ensureNodeIds<T>(
  schema: JsonFormSchema<T>,
  next: NodeIdFactory = newNodeId
): JsonFormSchema<T> {
  return assignNodeIds(schema, next).schema;
}

/**
 * Адреса, встречающиеся в схеме больше одного раза, — БЕЗ починки.
 *
 * Ответ на вопрос «что было не так с файлом»: {@link assignNodeIds} двойников не оставляет,
 * поэтому спросить об этом готовую модель уже нельзя. Считается тем же обходом и тем же
 * правилом, потому что делается тем же кодом.
 */
export function findDuplicateNodeIds(schema: JsonFormSchema): readonly NodeId[] {
  // Заглушка вместо настоящего генератора: схема-результат здесь отбрасывается, а `#` в адресе
  // невыразим ({@link NODE_ID_PATTERN} — только `[0-9a-z]`), поэтому выданное заглушкой не может
  // случайно совпасть с адресом из файла и породить находку из ничего.
  let counter = 0;
  return assignNodeIds(schema, () => `#${String((counter += 1))}`.padEnd(NODE_ID_LENGTH, '#'))
    .duplicates;
}

/**
 * Выдать НОВЫЕ идентификаторы всему поддереву — операция копирования.
 *
 * Вставка узла создаёт новый узел; сохранить чужой идентификатор значило бы создать двойника,
 * на которого сработают правила исходного. Поэтому копия проходит здесь, а не через
 * {@link ensureNodeIds}: тому «идентификатор уже есть» — достаточное основание ничего не делать.
 *
 * Structural sharing здесь бессмысленно: меняется каждый узел, поэтому результат — новое дерево
 * целиком (текстовые части `children` остаются как есть).
 *
 * @param subtree - Копируемый узел (не изменяется).
 * @param next - Генератор; по умолчанию {@link newNodeId}.
 */
export function reissueNodeIds(subtree: JsonNode, next: NodeIdFactory = newNodeId): JsonNode {
  // `taken` не ведётся: адрес переписывается у КАЖДОГО узла поддерева, и сверять новый адрес
  // не с чем — прежних здесь не остаётся вовсе.
  return walkNode(subtree, { next, reissue: true, taken: null, duplicates: new Set() });
}

/** Состояние обхода: генератор, режим и учёт занятых адресов. */
interface WalkContext {
  readonly next: NodeIdFactory;
  /** Переписать адрес у каждого узла (копирование), а не только у безадресных. */
  readonly reissue: boolean;
  /** Уже занятые адреса; `null` — режим перевыдачи, где занимать нечего. */
  readonly taken: Set<NodeId> | null;
  /** Адреса, встреченные повторно. */
  readonly duplicates: Set<NodeId>;
}

/**
 * Общий обход. `reissue` различает две задачи: выдать недостающее (тогда узел с годным
 * УНИКАЛЬНЫМ идентификатором и нетронутыми детьми возвращается ПО ТОЙ ЖЕ ссылке) либо
 * переписать всё.
 *
 * Порядок обхода — прямой (узел перед детьми, слоты по порядку объявления), и он же решает
 * спор за занятый адрес: адрес остаётся у ПЕРВОГО встреченного узла. То же правило, что
 * у указателя узлов редактора, — иначе «кто здесь настоящий» зависело бы от того, кто спрашивает.
 */
function walkNode(node: JsonNode, ctx: WalkContext): JsonNode {
  const id = nextIdFor(node, ctx);
  const patch: Record<string, unknown> = {};
  let changed = id !== undefined;

  const kids = (node as { children?: unknown }).children;
  if (Array.isArray(kids)) {
    const nextKids = walkSlot(kids, ctx);
    if (nextKids !== kids) {
      patch.children = nextKids;
      changed = true;
    }
  }

  // Шаги мастера лежат в пропсах, но это узлы (см. шапку `node-kind`), и адрес им нужен так же.
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  const steps = props?.steps;
  if (Array.isArray(steps)) {
    const nextSteps = walkSlot(steps, ctx);
    if (nextSteps !== steps) {
      patch.componentProps = { ...props, steps: nextSteps };
      changed = true;
    }
  }

  const item = (node as { item?: { $template?: unknown } }).item;
  if (item && isNodeLike(item.$template)) {
    const nextTemplate = walkNode(item.$template, ctx);
    if (nextTemplate !== item.$template) {
      patch.item = { ...item, $template: nextTemplate };
      changed = true;
    }
  }

  const wrapper = (node as { wrapper?: unknown }).wrapper;
  if (isNodeLike(wrapper)) {
    const nextWrapper = walkNode(wrapper, ctx);
    if (nextWrapper !== wrapper) {
      patch.wrapper = nextWrapper;
      changed = true;
    }
  }

  if (!changed) return node;

  // `$nodeId` первым ключом: у нового ключа позиция свободна, у существующего — своя, и спред
  // узла её сохраняет. Присваивание после спреда нужно ровно для случая, когда в узле лежало
  // значение НЕ той формы: место остаётся, значение переписывается.
  const out: Record<string, unknown> = id === undefined ? { ...node } : { $nodeId: id, ...node };
  if (id !== undefined) out.$nodeId = id;
  return Object.assign(out, patch) as unknown as JsonNode;
}

/**
 * Адрес, который узел должен получить, или `undefined` — «оставить свой».
 *
 * Три случая приводят к выдаче нового, и все три означают одно: файл не несёт годного адреса
 * для ЭТОГО узла. Адреса нет; адрес не той формы (её проверяет {@link isNodeId}); адрес уже
 * занят узлом, встреченным раньше. Последний дополнительно записывается в находки.
 */
function nextIdFor(node: JsonNode, ctx: WalkContext): NodeId | undefined {
  const current = (node as IdentifiedNode).$nodeId;

  if (ctx.reissue || !isNodeId(current)) {
    const issued = ctx.next();
    ctx.taken?.add(issued);
    return issued;
  }

  if (ctx.taken === null) return undefined;
  if (!ctx.taken.has(current)) {
    ctx.taken.add(current);
    return undefined;
  }

  ctx.duplicates.add(current);
  const issued = ctx.next();
  ctx.taken.add(issued);
  return issued;
}

/**
 * Массив-слот (`children`/`componentProps.steps`): узлы обходятся, всё остальное (текстовые части,
 * чужие значения) остаётся на своих местах — индексы не должны съезжать.
 */
function walkSlot(items: readonly unknown[], ctx: WalkContext): unknown[] {
  let changed = false;
  const out = items.map((item) => {
    if (!isNodeLike(item)) return item;
    const nextItem = walkNode(item, ctx);
    if (nextItem !== item) changed = true;
    return nextItem;
  });
  return changed ? out : (items as unknown[]);
}

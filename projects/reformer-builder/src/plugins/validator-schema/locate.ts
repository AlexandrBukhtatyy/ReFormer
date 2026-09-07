/**
 * Адресация находки: где в тексте, где в дереве и как одно переводится в другое.
 *
 * Правило из контракта диагностики: у записи РОВНО ОДНА цель, и вид цели определяется
 * природой ошибки.
 *
 * ```text
 * ошибка разбора      → range     узла ещё нет: текст не сложился в дерево
 * структурная ошибка  → node      идентификатор не съезжает при вставке соседей, путь съезжает
 * ни то ни другое     → resource  «файл не той формы» — проблема всего ресурса
 * ```
 *
 * Узловая цель при этом СУЖАЕТСЯ до места внутри узла: `«у компонента нет свойства readOnly»`
 * относится к одному полю, и подчёркивать в ней `$nodeId` — значит показывать на единственное
 * место узла, к ошибке не относящееся. Остаток пути кладётся в цель ОТНОСИТЕЛЬНЫМ (отсчёт от
 * узла), поэтому он не съезжает при вставке соседей — в отличие от абсолютного, который
 * в находку класть по-прежнему нельзя.
 *
 * ## Почему структурная ошибка НЕ адресуется диапазоном
 *
 * Диапазон для узла пришлось бы вычислять симуляцией печати — так делает v1, и поэтому
 * подчёркивание там уезжает на форматированном не так JSON. Перевод «узел → диапазон» делает
 * тот, кто РИСУЕТ, по тексту, который сейчас в редакторе; здесь достаточно идентификатора.
 *
 * ## Два диалекта пути в одном наборе сообщений
 *
 * Сообщения `validateFormSchema` несут путь ТРЕМЯ разными способами, потому что собираются
 * тремя разными фазами:
 *
 * ```text
 * /root/children/0                       JSON Pointer из ajv (структура узлов)
 * root.children[0].component             точечная запись из обхода имён операторов
 * root.children[0].componentProps/hint   смесь: обход дал голову, ajv — хвост
 * ```
 *
 * Разбирать это приходится здесь, и это самая неприятная часть переноса: путь — единственный
 * мост от чужого сообщения к узлу, а чужое сообщение отдаёт его в трёх видах. Собственные
 * проверки (`./structure`, целостность правил) узел знают сразу и через разбор строк не ходят.
 *
 * @module plugins/validator-schema/locate
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { findByPath } from '@/lib/form-model/query';
import { nodeIdOf } from '@/lib/form-model/node-id';
import type { JsonPath } from '@/lib/form-model/paths';
import type { DiagnosticTarget, NodePart, TextRange } from '@/sdk';

/** Результат разбора текста документа. */
export type ParseOutcome =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string; readonly range: TextRange };

/**
 * Смещение из сообщения `SyntaxError`: `… in JSON at position 42`.
 *
 * Разбор сообщения — единственный способ узнать место: `JSON.parse` не отдаёт позицию
 * ни полем ошибки, ни как-либо ещё. Когда формат сообщения не узнан (другой движок,
 * другая версия), диапазоном становится весь текст: подчеркнуть файл целиком честнее,
 * чем подчеркнуть наугад первый символ.
 */
const POSITION_PATTERN = /at position (\d+)/;

/** Разбирает текст, отдавая при отказе диапазон для цели `range`. */
export function parseJson(text: string): ParseOutcome {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const at = POSITION_PATTERN.exec(message);
    if (at === null) return { ok: false, message, range: { start: 0, end: text.length } };
    // Полуинтервал `[start, end)` в кодовых единицах UTF-16 — как `TextRange` и требует.
    // Один символ: ошибка разбора указывает на позицию, а не на протяжённость.
    const start = Math.min(Number(at[1]), text.length);
    return { ok: false, message, range: { start, end: Math.min(start + 1, text.length) } };
  }
}

/** Сегмент пути: число — индекс, строка — ключ. */
function toSegment(raw: string): string | number {
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/** JSON Pointer (`/root/children/0`) в путь. Экранирование по RFC 6901. */
function fromPointer(pointer: string): JsonPath {
  return pointer
    .split('/')
    .slice(1)
    .filter((segment) => segment !== '')
    .map((segment) => toSegment(segment.replace(/~1/g, '/').replace(/~0/g, '~')));
}

/** Точечная запись со скобками (`root.children[0].component`) в путь. */
function fromDotted(dotted: string): JsonPath {
  const out: (string | number)[] = [];
  for (const part of dotted.split('.')) {
    if (part === '') continue;
    const at = part.indexOf('[');
    if (at === -1) {
      out.push(toSegment(part));
      continue;
    }
    if (at > 0) out.push(part.slice(0, at));
    for (const index of part.slice(at).matchAll(/\[(\d+)\]/g)) out.push(Number(index[1]));
  }
  return out;
}

/**
 * Отделяет адрес от текста сообщения.
 *
 * Адрес — первая лексема до пробела: путь не содержит пробелов ни в одном из трёх диалектов.
 * Хвостовое двоеточие снимается — им фазы обхода отделяют путь от текста, а фаза ajv
 * не отделяет ничем.
 */
export function splitLocation(raw: string): { path: JsonPath; message: string } {
  const space = raw.indexOf(' ');
  const head = (space === -1 ? raw : raw.slice(0, space)).replace(/:$/, '');
  const message = space === -1 ? '' : raw.slice(space + 1);

  if (head === '' || head === '/') return { path: [], message };
  if (head.startsWith('/')) return { path: fromPointer(head), message };

  // Смесь: точечная голова, указательный хвост (`…componentProps/hint`).
  const slash = head.indexOf('/');
  if (slash === -1) return { path: fromDotted(head), message };
  return {
    path: [...fromDotted(head.slice(0, slash)), ...fromPointer(head.slice(slash))],
    message,
  };
}

/**
 * Узел, которым находка адресуется, и остаток пути ДО МЕСТА ошибки внутри него.
 *
 * Подъём обязателен: ошибка приходит на лист (`…/componentProps/hint`), а адресуется узел,
 * которому этот лист принадлежит. Отсутствие идентификатора — не сбой: `$nodeId` расставляет
 * `ensureNodeIds` при открытии, и файл, открытый мимо этого, честно адресуется ресурсом.
 *
 * Подъём идёт до НОСИТЕЛЯ ИДЕНТИФИКАТОРА, а не до первого, что похоже на узел, и это не
 * придирка: узлом считается любой объект с ключом `value`/`array`/`component`, а у
 * `TabsTrigger`, `TabsContent` и `RadioGroupItem` ровно такой `componentProps` —
 * `{ value: 'one' }`. Остановка «на похожем» отдавала бы сами пропсы: ни идентификатора,
 * ни компонента, то есть цель уезжала бы в ресурс, а быстрое исправление исчезало.
 *
 * Сам узел возвращается вместе с адресом, потому что его же спрашивают «какой это компонент»
 * и «какие у него пропсы»: без ответа на них исправление предложить нечего, а второй проход
 * по тому же пути разошёлся бы с первым на первой же правке условия «что считается узлом».
 *
 * Остаток пути отрезается ровно там, где нашёлся узел, поэтому он ОТНОСИТЕЛЬНЫЙ — и потому
 * законен в находке: вставка соседей где угодно в документе его не двигает, в отличие от
 * абсолютного пути, который устаревает вместе с показом.
 */
export function nodeSiteAt(
  schema: JsonFormSchema,
  path: JsonPath
): { readonly node: JsonNode; readonly nodeId: string; readonly inner: JsonPath } | undefined {
  for (let end = path.length; end > 0; end -= 1) {
    const node = findByPath(schema, path.slice(0, end));
    if (node === undefined) continue;
    const id = nodeIdOf(node);
    if (id !== undefined) return { node, nodeId: id, inner: path.slice(end) };
  }
  return undefined;
}

/** Идентификатор ближайшего узла НА пути или ВЫШЕ по нему — половина {@link nodeSiteAt}. */
export function nodeIdAt(schema: JsonFormSchema, path: JsonPath): string | undefined {
  return nodeSiteAt(schema, path)?.nodeId;
}

/**
 * Цель для находки по пути: узел (суженный до места внутри него), иначе ресурс целиком.
 *
 * `at` — что подчеркнуть у найденного свойства; решает это ВЫЗЫВАЮЩИЙ, потому что знает код
 * находки: «нет такого свойства» — про имя, «значение не того типа» — про значение.
 */
export function targetAt(schema: JsonFormSchema, path: JsonPath, at?: NodePart): DiagnosticTarget {
  const site = nodeSiteAt(schema, path);
  if (site === undefined) return { kind: 'resource' };
  return {
    kind: 'node',
    nodeId: site.nodeId,
    ...(site.inner.length > 0 ? { within: site.inner, ...(at !== undefined ? { at } : {}) } : {}),
  };
}

/**
 * Навигация «ошибка валидации → строка в raw-JSON». Валидатор (`@reformer/renderer-json/validate`)
 * возвращает человекочитаемые строки вида `root.children[0].componentProps has unknown property "x"`
 * или `root...componentProps/clearable must be boolean`. Здесь мы:
 *  - вычленяем из сообщения путь к узлу (и, для `unknown property`, имя лишнего пропа);
 *  - считаем, на какой СТРОКЕ этот узел окажется в `JSON.stringify(schema, null, 2)`
 *    (той же сериализации, что рисует raw-панель — {@link module:reformer-builder/io/export}).
 *
 * Номер строки чистая (без Monaco) функция от схемы + пути — тестируется напрямую; клик по пути в
 * тосте вызывает reveal этой строки в редакторе.
 *
 * @module reformer-builder/io/error-path
 */

/** Разобранный путь ошибки: сегменты (ключи/индексы) + опц. имя лишнего пропа (`unknown property`). */
export interface ParsedErrorPath {
  segments: (string | number)[];
  /** Для `has unknown property "X"` — само имя `X` (оно присутствует в JSON, к нему и прыгаем). */
  property?: string;
}

/**
 * Путь — ведущий токен сообщения без пробелов; остальное — текст диагностики. Токен может нести
 * хвостовой `:` (формат `path: message`) — срезаем. Возвращает `{ path, rest }` для отрисовки:
 * `path` кликабелен, `rest` — обычный текст.
 */
export function splitErrorMessage(message: string): { path: string; rest: string } {
  const spaceIdx = message.search(/\s/);
  let path = spaceIdx === -1 ? message : message.slice(0, spaceIdx);
  let rest = spaceIdx === -1 ? '' : message.slice(spaceIdx);
  if (path.endsWith(':')) {
    path = path.slice(0, -1);
    rest = ':' + rest;
  }
  return { path, rest };
}

/** Разбить токен пути (`root.children[0].componentProps` / `componentProps/clearable`) на сегменты. */
function tokenizePath(token: string): (string | number)[] {
  const segments: (string | number)[] = [];
  // Разделители уровней: `.` (объект) и `/` (ajv instancePath). `[i]` — индекс массива внутри части.
  for (const part of token.split(/[./]/)) {
    if (!part) continue;
    const re = /([^[\]]+)|\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part))) {
      if (m[1] !== undefined) segments.push(m[1]);
      else if (m[2] !== undefined) segments.push(Number(m[2]));
    }
  }
  return segments;
}

/** Разобрать сообщение валидатора в путь + (опц.) имя лишнего пропа. */
export function parseErrorPath(message: string): ParsedErrorPath | null {
  if (!message) return null;
  const { path } = splitErrorMessage(message);
  const segments = tokenizePath(path);
  const property = /unknown property "([^"]+)"/.exec(message)?.[1];
  return { segments, property };
}

/** Ключи объекта в порядке и составе, в котором их выведет `JSON.stringify` (без `undefined`/функций). */
function serializableKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) => {
    const v = obj[k];
    return v !== undefined && typeof v !== 'function';
  });
}

/**
 * Сколько СТРОК займёт значение в `JSON.stringify(value, null, 2)`. Примитив, `{}` и `[]` — 1 строка;
 * непустой объект/массив — открывающая скобка + сумма по детям + закрывающая. (Строки JSON однострочны:
 * реальные переводы строки экранируются в `\n`.)
 */
function lineSpan(value: unknown): number {
  if (value === null || typeof value !== 'object') return 1;
  if (Array.isArray(value)) {
    if (value.length === 0) return 1;
    let n = 2;
    for (const el of value) n += lineSpan(el);
    return n;
  }
  const obj = value as Record<string, unknown>;
  const keys = serializableKeys(obj);
  if (keys.length === 0) return 1;
  let n = 2;
  for (const k of keys) n += lineSpan(obj[k]);
  return n;
}

/**
 * Номер строки (1-based), где в `JSON.stringify(root, null, 2)` начинается узел по пути `segments`.
 * `root` начинается на строке 1. Возвращает `null`, если путь не резолвится (сегмент отсутствует).
 */
export function lineOfPath(root: unknown, segments: (string | number)[]): number | null {
  let node: unknown = root;
  let line = 1; // строка, где начинается текущий узел (его открывающая скобка / само значение)
  for (const seg of segments) {
    if (node === null || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      const idx = typeof seg === 'number' ? seg : Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return null;
      let l = line + 1; // первый элемент — на следующей строке после `[`
      for (let j = 0; j < idx; j++) l += lineSpan(node[j]);
      line = l;
      node = node[idx];
    } else {
      const obj = node as Record<string, unknown>;
      const keys = serializableKeys(obj);
      const ki = keys.indexOf(String(seg));
      if (ki === -1) return null;
      let l = line + 1; // первое свойство — на следующей строке после `{`
      for (let j = 0; j < ki; j++) l += lineSpan(obj[keys[j]]);
      line = l;
      node = obj[keys[ki]];
    }
  }
  return line;
}

/**
 * Строка в raw-JSON, соответствующая сообщению об ошибке. Для `unknown property` пробуем прыгнуть на
 * сам лишний проп (он есть в JSON), иначе — на родительский узел. `null`, если путь не резолвится.
 */
export function errorLine(schema: unknown, message: string): number | null {
  const parsed = parseErrorPath(message);
  if (!parsed) return null;
  if (parsed.property !== undefined) {
    const withProp = lineOfPath(schema, [...parsed.segments, parsed.property]);
    if (withProp !== null) return withProp;
  }
  return lineOfPath(schema, parsed.segments);
}

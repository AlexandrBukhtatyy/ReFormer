/**
 * Разбор сообщения валидатора: где в схеме находится то, на что он жалуется.
 *
 * `validateFormSchema` (`@reformer/renderer-json/validate`) возвращает человекочитаемые строки
 * вида `root.children[0].componentProps has unknown property "x"` или
 * `root...componentProps/clearable must be boolean`. Здесь из них вычленяется путь к узлу.
 *
 * Зачем это агенту. Валидатор адресует узлы точечной нотацией, а все write-инструменты — JSON
 * Pointer'ом (`/root/children/0`). Без перевода модель получала диагноз в одном диалекте, а чинить
 * была обязана в другом, и таблицы соответствия ниоткуда не знала.
 *
 * В v1 модуль лежал в `io/error-path` и умел ещё одно — считать НОМЕР СТРОКИ в
 * `JSON.stringify(schema, null, 2)`, чтобы клик по ошибке уводил в нужное место raw-редактора.
 * Сюда эта половина не переехала: она нужна редактору JSON, а не ассистенту, и её место — рядом с
 * тем редактором, когда он появится.
 *
 * @module plugins/ai/model/error-path
 */

/** Разобранный путь ошибки: сегменты (ключи/индексы) + опц. имя лишнего пропа. */
export interface ParsedErrorPath {
  segments: (string | number)[];
  /** Для `has unknown property "X"` — само имя `X` (оно присутствует в JSON, к нему и прыгаем). */
  property?: string;
}

/**
 * Путь — ведущий токен сообщения без пробелов; остальное — текст диагностики. Токен может нести
 * хвостовой `:` (формат `path: message`) — срезаем. Возвращает `{ path, rest }`, чтобы вызывающий
 * мог заменить путь своим адресом, сохранив формулировку.
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

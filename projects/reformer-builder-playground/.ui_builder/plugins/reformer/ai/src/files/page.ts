/**
 * Текст файла для модели: строки с номерами, страницы, фрагмент вокруг правки.
 *
 * Номера строк — в формате `cat -n` (номер, табуляция, строка): модели этот формат знаком по
 * обучению на выводе терминала, и она уверенно отделяет номер от текста, когда копирует
 * `old_string` для правки. Номер нужен ей, чтобы называть место, а не чтобы его вставлять, —
 * промпт говорит об этом прямо.
 *
 * Страница режется ПО СТРОКАМ, а не по символам: обрезанная посередине строка — это `old_string`,
 * которого нет в файле, и правка по нему падает. Хвост страницы говорит, откуда читать дальше.
 *
 * @module plugins/reformer/ai/files/page
 */

/** Длиннее этого строка обрезается при показе — минифицированный JSON целиком не нужен. */
export const LINE_LIMIT = 400;

/** Сколько строк контекста показывать вокруг правки. */
const SNIPPET_CONTEXT = 2;

/** Строки текста без `\r` и без пустого хвоста за последним переводом строки. */
export function linesOf(text: string): string[] {
  const lines = text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Строка в формате `cat -n`. */
function numbered(index: number, line: string): string {
  const shown =
    line.length > LINE_LIMIT
      ? `${line.slice(0, LINE_LIMIT)}…[+${line.length - LINE_LIMIT} chars]`
      : line;
  return `${String(index).padStart(6)}\t${shown}`;
}

/** Страница файла. */
export interface Page {
  /** Строки страницы с номерами. */
  readonly body: string;
  /** Первая и последняя показанная строка (1-based); `to < from` — страница пуста. */
  readonly from: number;
  readonly to: number;
  /** Строк в файле. */
  readonly total: number;
}

/**
 * Страница файла в пределах бюджета.
 *
 * @param offset - Первая строка (1-based).
 * @param limit - Сколько строк максимум; `undefined` — сколько влезет в бюджет.
 * @param budget - Символов на тело страницы.
 */
export function pageOf(
  text: string,
  offset: number,
  limit: number | undefined,
  budget: number
): Page {
  const lines = linesOf(text);
  const total = lines.length;
  const from = Math.max(1, offset);
  const last = limit === undefined ? total : Math.min(total, from + limit - 1);
  const out: string[] = [];
  let used = 0;
  let to = from - 1;
  for (let index = from; index <= last; index += 1) {
    const row = numbered(index, lines[index - 1] ?? '');
    // Хоть одна строка показывается всегда — иначе огромная строка закрыла бы файл навсегда.
    if (out.length > 0 && used + row.length + 1 > budget) break;
    out.push(row);
    used += row.length + 1;
    to = index;
  }
  return { body: out.join('\n'), from, to, total };
}

/** Какие строки правка затронула и сколько строк добавила и убрала. */
export interface ChangedLines {
  /** Первая и последняя изменённая строка НОВОГО текста (1-based). */
  readonly from: number;
  readonly to: number;
  readonly added: number;
  readonly removed: number;
}

/**
 * Изменённые строки: общий префикс и общий суффикс отбрасываются, остальное — правка.
 *
 * Не настоящий diff, и это достаточно: модели нужно место, на которое посмотреть, а человеку в
 * журнале панели — порядок величины, «+12 −0», а не построчная история.
 */
export function changedLines(before: string, after: string): ChangedLines {
  const was = linesOf(before);
  const now = linesOf(after);
  let head = 0;
  while (head < was.length && head < now.length && was[head] === now[head]) head += 1;
  let tail = 0;
  while (
    tail < was.length - head &&
    tail < now.length - head &&
    was[was.length - 1 - tail] === now[now.length - 1 - tail]
  ) {
    tail += 1;
  }
  const added = now.length - head - tail;
  const removed = was.length - head - tail;
  return { from: head + 1, to: Math.max(head + 1, head + added), added, removed };
}

/** Фрагмент нового текста вокруг правки — с номерами строк, в пределах бюджета. */
export function snippetOf(after: string, changed: ChangedLines, budget: number): string {
  const total = linesOf(after).length;
  const from = Math.max(1, changed.from - SNIPPET_CONTEXT);
  const to = Math.min(total, changed.to + SNIPPET_CONTEXT);
  const page = pageOf(after, from, to - from + 1, budget);
  return page.to < to ? `${page.body}\n… (more changed lines not shown)` : page.body;
}

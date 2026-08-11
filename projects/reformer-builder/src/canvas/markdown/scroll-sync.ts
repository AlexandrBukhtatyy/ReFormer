/**
 * Математика синхроскролла «редактор ⇄ предпросмотр» (режим «Рядом»).
 *
 * Предпросмотр размечен атрибутами `data-line` (см. {@link module:reformer-builder/canvas/markdown/rehype-source-line}):
 * у блочных элементов известна строка исходника, с которой они начинаются. Пары «строка → offsetTop»
 * образуют якоря, между которыми позиция считается линейной интерполяцией — так короткая строка
 * таблицы в исходнике и её высокий рендер сходятся без накопления ошибки.
 *
 * Здесь только чистые функции (юнит-тесты); работа с DOM/Monaco — в `MarkdownPreview`/`CodeArea`.
 *
 * @module reformer-builder/canvas/markdown/scroll-sync
 */

/** Якорь: строка исходника (1-based) и вертикальная позиция её блока в предпросмотре. */
export interface SourceAnchor {
  line: number;
  top: number;
}

/** Линейная интерполяция с защитой от деления на ноль (совпавшие узлы → берём начало отрезка). */
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

/** Индекс последнего якоря, чьё значение `key` ≤ `value` (бинарный поиск); -1 — таких нет. */
function lastAtOrBefore(
  anchors: readonly SourceAnchor[],
  value: number,
  key: (a: SourceAnchor) => number
): number {
  let lo = 0;
  let hi = anchors.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(anchors[mid]) <= value) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Позиция скролла предпросмотра для строки исходника.
 *
 * До первого якоря интерполируем от начала документа (строка 1 ↔ offset 0), после последнего —
 * возвращаем его позицию: сколько ещё контента идёт следом, по якорям неизвестно, а экстраполяция
 * дала бы рывок в конце файла.
 */
export function lineToOffset(anchors: readonly SourceAnchor[], line: number): number {
  if (!anchors.length) return 0;
  const i = lastAtOrBefore(anchors, line, (a) => a.line);
  if (i === -1) return lerp(line, 1, anchors[0].line, 0, anchors[0].top);
  if (i === anchors.length - 1) return anchors[i].top;
  return lerp(line, anchors[i].line, anchors[i + 1].line, anchors[i].top, anchors[i + 1].top);
}

/** Строка исходника для позиции скролла предпросмотра (обратная к {@link lineToOffset}). */
export function offsetToLine(anchors: readonly SourceAnchor[], top: number): number {
  if (!anchors.length) return 1;
  const i = lastAtOrBefore(anchors, top, (a) => a.top);
  if (i === -1) return lerp(top, 0, anchors[0].top, 1, anchors[0].line);
  if (i === anchors.length - 1) return anchors[i].line;
  return lerp(top, anchors[i].top, anchors[i + 1].top, anchors[i].line, anchors[i + 1].line);
}

/**
 * Собрать якоря из отрендеренного предпросмотра: все элементы с `data-line`, позиция — в системе
 * координат прокрутки контейнера. Считаем через `getBoundingClientRect`, а не `offsetTop`: второй
 * отсчитывается от `offsetParent`, который у вложенных элементов свой.
 *
 * Список отсортирован и без дублей по строке (совпавшие схлопываются в первый — верхний — элемент),
 * как того требуют {@link lineToOffset}/{@link offsetToLine}.
 *
 * @param container — скролл-контейнер предпросмотра.
 * @param scope — поддерево с содержимым (по умолчанию сам контейнер).
 */
export function collectAnchors(container: HTMLElement, scope?: HTMLElement): SourceAnchor[] {
  const nodes = (scope ?? container).querySelectorAll<HTMLElement>('[data-line]');
  const base = container.getBoundingClientRect().top - container.scrollTop;
  const out: SourceAnchor[] = [];
  for (const el of nodes) {
    const line = Number(el.dataset.line);
    if (!Number.isFinite(line)) continue;
    const top = el.getBoundingClientRect().top - base;
    const prev = out[out.length - 1];
    if (prev && prev.line === line) continue;
    out.push({ line, top });
  }
  out.sort((a, b) => a.line - b.line);
  return out;
}

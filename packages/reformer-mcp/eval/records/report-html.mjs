#!/usr/bin/env node
/**
 * Дашборд метрик `@reformer/mcp`: `npm run mcp:report [-- --out <файл>] [--history <файл>]`.
 *
 * Самодостаточный HTML (встроенные стили, скрипт и SVG, без сети) по истории
 * `eval/runs/history.json`; по умолчанию пишется в `.tmp/mcp-eval/report/index.html` и в репозиторий
 * не кладётся — его всегда можно собрать заново из истории.
 *
 * Что на странице:
 * - фильтры одной строкой: период, теги (точка показывается, если у неё есть все «только с» и нет
 *   ни одного «скрыть»; `smoke` скрыт по умолчанию), виды событий (`knowledge` выключен — их много);
 * - серии сценариев и конструктора: выбранная метрика по батчам, цвет закреплён за серией, легенда —
 *   переключатель; линия рвётся, где точки несравнимы (сменился набор ячеек или контракт ячейки);
 *   у одной видимой серии доля pass идёт с интервалом Уилсона;
 * - события — вертикальные отметки; вид события кодирует форма значка, а не цвет;
 * - калибровка и извлечение знания — малые графики по метрике, линия рвётся при смене прибора;
 * - тепловая карта ячеек выбранной серии: средний счёт ячейки по батчам;
 * - события списком; у каждого графика — табличный вид.
 *
 * Holdout по ячейкам не разбирается и здесь: в истории он только агрегатом.
 *
 * @module reformer-mcp/eval/records/report-html
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { historyFile, readHistory } from './history.mjs';
import { repoRoot } from './record.mjs';

const STYLE = `
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --border: rgba(11, 11, 11, 0.10); --wash: rgba(11, 11, 11, 0.05);
  --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
  --series-5: #e87ba4; --series-6: #008300; --series-7: #6250d6; --series-8: #e34948;
  --heat-1: #cde2fb; --heat-2: #9ec5f4; --heat-3: #6da7ec; --heat-4: #3987e5; --heat-5: #256abf; --heat-6: #184f95;
  --heat-ink-1: #0b0b0b; --heat-ink-2: #0b0b0b; --heat-ink-3: #0b0b0b; --heat-ink-4: #ffffff; --heat-ink-5: #ffffff; --heat-ink-6: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --border: rgba(255, 255, 255, 0.10); --wash: rgba(255, 255, 255, 0.06);
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
    --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
    --heat-1: #104281; --heat-2: #1c5cab; --heat-3: #2a78d6; --heat-4: #5598e7; --heat-5: #86b6ef; --heat-6: #b7d3f6;
    --heat-ink-1: #ffffff; --heat-ink-2: #ffffff; --heat-ink-3: #ffffff; --heat-ink-4: #0b0b0b; --heat-ink-5: #0b0b0b; --heat-ink-6: #0b0b0b;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --border: rgba(255, 255, 255, 0.10); --wash: rgba(255, 255, 255, 0.06);
  --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
  --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
  --heat-1: #104281; --heat-2: #1c5cab; --heat-3: #2a78d6; --heat-4: #5598e7; --heat-5: #86b6ef; --heat-6: #b7d3f6;
  --heat-ink-1: #ffffff; --heat-ink-2: #ffffff; --heat-ink-3: #ffffff; --heat-ink-4: #0b0b0b; --heat-ink-5: #0b0b0b; --heat-ink-6: #0b0b0b;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; font-weight: 600; }
h2 { font-size: 16px; margin: 0; font-weight: 600; }
.lead { color: var(--ink-2); margin: 0 0 16px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; padding: 12px 0 16px;
  background: var(--page); z-index: 2; border-bottom: 1px solid var(--grid); margin-bottom: 16px; }
@media (min-width: 720px) { .filters { position: sticky; top: 0; } }
.group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.group > .label { color: var(--muted); font-size: 12px; margin-right: 2px; }
button.chip, label.chip { font: inherit; font-size: 13px; color: var(--ink); background: var(--surface);
  border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; cursor: pointer;
  display: inline-flex; gap: 6px; align-items: center; }
button.chip:hover, label.chip:hover { background: var(--wash); }
button.chip[aria-pressed="true"] { border-color: var(--ink-2); font-weight: 600; }
button.chip[data-state="include"] { border-color: var(--ink-2); font-weight: 600; }
button.chip[data-state="exclude"] { color: var(--muted); text-decoration: line-through; }
label.chip input { margin: 0; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.card-head { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.card-head .note { color: var(--ink-2); font-size: 13px; }
select { font: inherit; font-size: 13px; color: var(--ink); background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 3px 6px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 8px; margin: 4px 0 8px; }
.legend button { font: inherit; font-size: 13px; color: var(--ink); background: none; border: 1px solid transparent;
  border-radius: 6px; padding: 2px 6px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.legend button:hover { background: var(--wash); }
.legend button[aria-pressed="false"] { color: var(--muted); }
.legend button[aria-pressed="false"] .key { opacity: 0.25; }
.key { display: inline-block; width: 14px; height: 2px; border-radius: 1px; }
svg { display: block; width: 100%; height: auto; overflow: visible; }
svg.icon { display: inline-block; width: 12px; height: 12px; flex: none; }
svg text { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
svg .grid { stroke: var(--grid); stroke-width: 1; }
svg .axis { stroke: var(--axis); stroke-width: 1; }
svg .rule { stroke: var(--axis); stroke-width: 1; }
svg .glyph { fill: var(--ink-2); }
svg .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
svg .dot { stroke: var(--surface); stroke-width: 2; }
svg .cross { stroke: var(--ink-2); stroke-width: 1; }
svg .hit { fill: transparent; cursor: crosshair; }
svg .hit:focus { outline: none; }
svg .hit:focus-visible { stroke: var(--ink-2); stroke-width: 1; }
svg .cell:hover, svg .cell:focus { stroke: var(--ink); stroke-width: 1.5; outline: none; }
.multiples { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.multiple h3 { font-size: 13px; font-weight: 600; margin: 0; }
.multiple .value { color: var(--ink-2); font-size: 12px; margin: 0 0 4px; }
.scale { display: flex; gap: 2px; align-items: center; font-size: 12px; color: var(--ink-2); margin-top: 8px; }
.scale span.swatch { width: 24px; height: 10px; border-radius: 2px; display: inline-block; }
details { margin-top: 8px; }
summary { cursor: pointer; color: var(--ink-2); font-size: 13px; }
.table-wrap { overflow-x: auto; margin-top: 8px; }
table { border-collapse: collapse; font-size: 12px; width: 100%; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.wrap { white-space: normal; min-width: 280px; }
th { color: var(--ink-2); font-weight: 600; }
.empty { color: var(--muted); padding: 24px 0; text-align: center; }
.tip { position: fixed; pointer-events: none; z-index: 10; background: var(--surface); color: var(--ink);
  border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; max-width: 360px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); display: none; }
.tip .head { color: var(--ink-2); margin-bottom: 4px; }
.tip .row { display: flex; gap: 8px; align-items: baseline; }
.tip .row strong { font-weight: 600; white-space: nowrap; }
.tip .row span.name { color: var(--ink-2); }
.tip .sub { color: var(--muted); margin-left: 22px; }
.tip .event { margin-top: 4px; }
`;

/**
 * Клиент дашборда. Исполняется в браузере: в страницу попадает его текст (`toString`), поэтому
 * функция самодостаточна и не замыкает ничего из модуля.
 */
function dashboard(history) {
  /* global document, window, Node */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DAY = 86_400_000;
  const RUN_HARNESSES = ['scenario', 'builder'];
  const KINDS = {
    server: { label: 'сервер', glyph: 'triangle' },
    knowledge: { label: 'знание', glyph: 'circle' },
    instrument: { label: 'прибор', glyph: 'square' },
    agent: { label: 'агент', glyph: 'diamond' },
  };
  const METRIC_LABELS = {
    passRate: 'Доля pass',
    score: 'Средний счёт',
    turns: 'Шагов модели, медиана',
    inputTokens: 'Входные токены, медиана',
    outputTokens: 'Выходные токены, медиана',
    toolCalls: 'Вызовов инструментов, медиана',
    costUsd: 'Стоимость батча, $ (оценка)',
    minutes: 'Время прогона, медиана',
    'process.mcpCalls': 'Вызовов MCP, медиана',
    'process.mcpErrors': 'Ошибок MCP, медиана',
    'process.mcpResultChars': 'Знаков в ответах MCP, медиана',
    'process.repeatedCalls': 'Повторных вызовов, медиана',
    'process.validatedAfterLastWrite': 'Проверка после последней записи',
    'harness.truncations': 'Усечений стенда, медиана',
    'harness.textualCalls': 'Вызовов «текстом», медиана',
    'harness.emptyCalls': 'Вызовов без аргументов, медиана',
    'harness.unparsedCalls': 'Ответов, не разобранных Ollama, медиана',
    'harness.lengthStops': 'Ответов, оборванных пределом выхода, медиана',
    hitRate: 'Доля найденного',
    firstPassRate: 'Найдено с первого вызова',
  };
  const COUNT_LIKE =
    /errors|tokens|calls|chars|turns|minutes|cost|truncations|overflows|kept|forms|stops/i;

  const time = (iso) => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const keyOf = (point) => `${point.harness} · ${point.agent} · ${point.approach}`;
  const points = history.points
    .map((point) => ({ ...point, key: keyOf(point), t: time(point.date) }))
    .sort((a, b) => a.t - b.t);
  const events = history.events
    .map((event) => ({ ...event, t: time(event.date) }))
    .sort((a, b) => a.t - b.t);
  const allSeries = [...new Set(points.map((point) => point.key))].sort();
  const runSeries = allSeries.filter((key) => RUN_HARNESSES.includes(key.split(' · ')[0]));
  const standSeries = allSeries.filter((key) => !runSeries.includes(key));
  // Цвет закреплён за серией по всему файлу, а не по видимым: фильтр не перекрашивает выживших.
  const colorOf = new Map(
    runSeries.map((key, index) => [key, index < 8 ? `var(--series-${index + 1})` : 'var(--muted)'])
  );
  const allTags = [...new Set(points.flatMap((point) => point.tags))].sort();
  const runMetrics = [
    ...new Set(
      points.filter((point) => runSeries.includes(point.key)).flatMap((p) => Object.keys(p.metrics))
    ),
  ];

  const state = {
    range: 'all',
    tags: new Map(allTags.includes('smoke') ? [['smoke', 'exclude']] : []),
    kinds: new Set(['server', 'instrument', 'agent']),
    hidden: new Set(),
    metric: 'passRate',
    axis: 'batch',
    // Тепловая карта по умолчанию — сценарная серия с моделью, где больше всего точек.
    heat:
      runSeries
        .filter((key) => key.startsWith('scenario') && !key.includes('replay'))
        .sort(
          (a, b) =>
            points.filter((point) => point.key === b).length -
            points.filter((point) => point.key === a).length
        )[0] ?? runSeries[0],
  };
  let contentWidth = 1100;

  // ---------- Помощники ----------
  function el(tag, attrs = {}, ...children) {
    const svg = tag.startsWith('svg:');
    const node = svg ? document.createElementNS(SVG_NS, tag.slice(4)) : document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }
  const isRate = (metric, values) =>
    ['passRate', 'score', 'process.validatedAfterLastWrite'].includes(metric) ||
    (!COUNT_LIKE.test(metric) && values.every((value) => value >= 0 && value <= 1));
  const compact = (value) =>
    Math.abs(value) >= 10_000
      ? `${(value / 1000).toFixed(Math.abs(value) >= 100_000 ? 0 : 1)}k`
      : Number.isInteger(value)
        ? value.toLocaleString('ru-RU')
        : value.toFixed(2);
  function formatter(metric, rate) {
    if (metric === 'score') return (value) => value.toFixed(2);
    if (rate) return (value) => `${Math.round(value * 100)}%`;
    if (metric === 'minutes') return (value) => `${value.toFixed(1)} мин`;
    if (metric === 'costUsd') return (value) => `$${value.toFixed(2)}`;
    return compact;
  }
  const dateLabel = (t, withTime) => {
    const date = new Date(t);
    const day = `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return withTime
      ? `${day} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
      : day;
  };
  function niceTicks(max, count = 4) {
    if (max <= 0) return [0, 1];
    const raw = max / count;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw);
    const ticks = [];
    for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
    if (ticks.at(-1) < max) ticks.push(ticks.at(-1) + step);
    return ticks;
  }
  function wilson(passed, total) {
    if (!total) return [0, 1];
    const z = 1.6449;
    const p = passed / total;
    const denominator = 1 + (z * z) / total;
    const centre = (p + (z * z) / (2 * total)) / denominator;
    const margin =
      (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
    return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
  }
  function glyph(kind, x, y, size = 4) {
    const shape = KINDS[kind]?.glyph ?? 'circle';
    if (shape === 'circle') return el('svg:circle', { class: 'glyph', cx: x, cy: y, r: size });
    if (shape === 'square') {
      return el('svg:rect', {
        class: 'glyph',
        x: x - size,
        y: y - size,
        width: size * 2,
        height: size * 2,
        rx: 1,
      });
    }
    const d =
      shape === 'triangle'
        ? `M${x},${y - size - 1} L${x + size + 1},${y + size} L${x - size - 1},${y + size} Z`
        : `M${x},${y - size - 1} L${x + size + 1},${y} L${x},${y + size + 1} L${x - size - 1},${y} Z`;
    return el('svg:path', { class: 'glyph', d });
  }
  function glyphIcon(kind) {
    return el(
      'svg:svg',
      { class: 'icon', width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true' },
      glyph(kind, 6, 6, 4)
    );
  }

  // ---------- Подсказка ----------
  const tip = el('div', { class: 'tip', role: 'status', 'aria-live': 'polite' });
  document.body.append(tip);
  function showTip(clientX, clientY, nodes) {
    tip.replaceChildren(...nodes);
    tip.style.display = 'block';
    const { innerWidth, innerHeight } = window;
    const box = tip.getBoundingClientRect();
    const left = clientX + 14 + box.width > innerWidth ? clientX - box.width - 14 : clientX + 14;
    const top = Math.min(clientY + 14, innerHeight - box.height - 8);
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }
  const hideTip = () => {
    tip.style.display = 'none';
  };
  const eventRows = (list) =>
    list.map((event) =>
      el(
        'div',
        { class: 'event row' },
        glyphIcon(event.kind),
        el(
          'span',
          {},
          el('strong', {}, KINDS[event.kind]?.label ?? event.kind),
          ` ${event.title}`,
          event.refs?.length ? el('span', { class: 'name' }, ` · ${event.refs.join(', ')}`) : null
        )
      )
    );

  // ---------- Отбор ----------
  const maxT = points.length ? points.at(-1).t : Date.now();
  const cutoff = () => (state.range === 'all' ? -Infinity : maxT - state.range * DAY);
  function visiblePoint(point) {
    if (point.t < cutoff()) return false;
    for (const [tag, mode] of state.tags) {
      if (mode === 'include' && !point.tags.includes(tag)) return false;
      if (mode === 'exclude' && point.tags.includes(tag)) return false;
    }
    return true;
  }
  const eventVisible = (event) =>
    [event.kind, ...(event.also ?? [])].some((kind) => state.kinds.has(kind));

  /** Можно ли соединить линией две точки серии; иначе — причина разрыва. */
  function breakReason(previous, point) {
    if (point.cells) {
      const before = Object.keys(previous.cells ?? {}).join();
      if (before !== Object.keys(point.cells).join()) return 'другой набор ячеек';
      const changed = Object.entries(point.cells).filter(([key, cell]) => {
        const old = previous.cells?.[key]?.[3];
        return old && cell[3] && old !== cell[3];
      });
      if (changed.length) return `сменился контракт: ${changed.map(([key]) => key).join(', ')}`;
      return null;
    }
    if (previous.instrument && point.instrument && previous.instrument !== point.instrument) {
      return 'сменился прибор (набор проверок)';
    }
    return null;
  }

  // ---------- График по времени ----------
  /**
   * @param {{ series: Array<{ key, label, color, values: Array<{ t, v, point, reason }> }>,
   *   events: object[], width: number, height: number, rate: boolean, format: Function,
   *   band?: Array<{ t, lo, hi }>, label: string, compact?: boolean }} options
   */
  function timeChart(options) {
    const { series, width, height, rate, format, band, label } = options;
    const margin = {
      top: options.compact ? 16 : 22,
      right: 12,
      bottom: 22,
      left: options.compact ? 38 : 48,
    };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const ts = series.flatMap((item) => item.values.map((value) => value.t));
    const t0 = Math.min(...ts) - DAY * 0.5;
    const t1 = Math.max(...ts) + DAY * 0.5;
    const chartEvents = options.events.filter((event) => event.t >= t0 && event.t <= t1);
    const values = series.flatMap((item) => item.values.map((value) => value.v));
    const ticks = rate ? [0, 0.25, 0.5, 0.75, 1] : niceTicks(Math.max(...values, 0));
    const yMax = ticks.at(-1) || 1;
    // Ось «по батчам»: каждый батч — равный шаг, событие — между батчами по своему времени. Ось
    // «время» честна к паузам, но батчи одного вечера на ней сливаются в точку.
    const batches = [...new Set(ts)].sort((a, b) => a - b);
    const batchIndex = (t) => {
      if (t < batches[0]) return -0.4;
      if (t > batches.at(-1)) return batches.length - 0.6;
      const next = batches.findIndex((batch) => batch >= t);
      if (batches[next] === t) return next;
      const previous = batches[next - 1];
      return next - 1 + (t - previous) / (batches[next] - previous);
    };
    const x =
      state.axis === 'batch'
        ? (t) => margin.left + ((batchIndex(t) + 0.5) / batches.length) * plotW
        : (t) => margin.left + ((t - t0) / (t1 - t0 || 1)) * plotW;
    const y = (v) => margin.top + plotH - (v / yMax) * plotH;

    const svg = el('svg:svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': label,
    });
    for (const tick of ticks) {
      svg.append(
        el('svg:line', {
          class: tick === 0 ? 'axis' : 'grid',
          x1: margin.left,
          x2: width - margin.right,
          y1: y(tick),
          y2: y(tick),
        }),
        el('svg:text', { x: margin.left - 6, y: y(tick) + 4, 'text-anchor': 'end' }, format(tick))
      );
    }
    const dateTicks = [];
    if (state.axis === 'batch') {
      // Подпись у первого батча дня, если она не налезает на предыдущую.
      let lastDay = null;
      for (const t of batches) {
        const day = dateLabel(t);
        if (day === lastDay) continue;
        lastDay = day;
        if (dateTicks.length && x(t) - x(dateTicks.at(-1)) < 40) continue;
        dateTicks.push(t);
      }
    } else {
      const days = Math.max(1, Math.round((t1 - t0) / DAY));
      const step = Math.max(1, Math.ceil(days / Math.max(2, Math.floor(plotW / 70))));
      for (let t = Math.ceil(t0 / DAY) * DAY; t <= t1; t += step * DAY) dateTicks.push(t);
    }
    for (const t of dateTicks) {
      svg.append(el('svg:text', { x: x(t), y: height - 6, 'text-anchor': 'middle' }, dateLabel(t)));
    }
    // События: одна отметка на день, значки видов в ряд над областью графика.
    const byDay = new Map();
    for (const event of chartEvents) {
      const day = Math.floor(event.t / DAY) * DAY;
      byDay.set(day, [...(byDay.get(day) ?? []), event]);
    }
    for (const [day, list] of byDay) {
      const position = x(day);
      svg.append(
        el('svg:line', {
          class: 'rule',
          x1: position,
          x2: position,
          y1: margin.top - 4,
          y2: margin.top + plotH,
        })
      );
      const kinds = [...new Set(list.map((event) => event.kind))];
      kinds.forEach((kind, index) => {
        svg.append(
          glyph(
            kind,
            position + (index - (kinds.length - 1) / 2) * 9,
            margin.top - 10,
            options.compact ? 3 : 4
          )
        );
      });
    }
    if (band?.length) {
      const top = band.map((item) => `${x(item.t)},${y(item.hi)}`);
      const bottom = band.map((item) => `${x(item.t)},${y(item.lo)}`).reverse();
      svg.append(
        el('svg:polygon', {
          points: [...top, ...bottom].join(' '),
          fill: series[0].color,
          'fill-opacity': 0.1,
        })
      );
    }
    for (const item of series) {
      let segment = [];
      const flush = () => {
        if (segment.length > 1) {
          svg.append(
            el('svg:path', {
              class: 'line',
              stroke: item.color,
              d: segment
                .map((value, index) => `${index ? 'L' : 'M'}${x(value.t)},${y(value.v)}`)
                .join(' '),
            })
          );
        }
        segment = [];
      };
      for (const value of item.values) {
        if (value.reason) flush();
        segment.push(value);
      }
      flush();
      for (const value of item.values) {
        svg.append(
          el('svg:circle', { class: 'dot', cx: x(value.t), cy: y(value.v), r: 4, fill: item.color })
        );
      }
    }
    // Слой наведения: вертикаль цепляется к ближайшему батчу или дню события.
    const stops = [...new Set([...ts, ...[...byDay.keys()]])].sort((a, b) => a - b);
    const cross = el('svg:line', {
      class: 'cross',
      y1: margin.top - 4,
      y2: margin.top + plotH,
      visibility: 'hidden',
    });
    svg.append(cross);
    let current = -1;
    const show = (index, clientX, clientY) => {
      current = index;
      const t = stops[index];
      cross.setAttribute('x1', x(t));
      cross.setAttribute('x2', x(t));
      cross.setAttribute('visibility', 'visible');
      const rows = [];
      const hits = series
        .map((item) => ({ item, value: item.values.find((value) => value.t === t) }))
        .filter(({ value }) => value);
      const isBatch = hits.length > 0;
      rows.push(
        el(
          'div',
          { class: 'head' },
          isBatch ? `${dateLabel(t, true)} · ${hits[0].value.point.batch}` : dateLabel(t)
        )
      );
      for (const { item, value } of hits) {
        rows.push(
          el(
            'div',
            { class: 'row' },
            el('span', { class: 'key', style: `background:${item.color}` }),
            el('strong', {}, format(value.v)),
            el('span', { class: 'name' }, item.label)
          )
        );
        const details = [];
        if (value.point.counted != null)
          details.push(`pass ${value.point.passed}/${value.point.counted}`);
        if (value.point.holdout)
          details.push(`holdout ${value.point.holdout[0]}/${value.point.holdout[1]}`);
        if (value.point.tags.length) details.push(value.point.tags.join(', '));
        if (details.length) rows.push(el('div', { class: 'sub' }, details.join(' · ')));
        if (value.reason)
          rows.push(el('div', { class: 'sub' }, `не сравнима с предыдущей: ${value.reason}`));
      }
      if (!isBatch) rows.push(...eventRows(byDay.get(t) ?? []));
      const box = svg.getBoundingClientRect();
      showTip(clientX ?? box.left + (x(t) / width) * box.width, clientY ?? box.top + 20, rows);
    };
    const hit = el('svg:rect', {
      class: 'hit',
      x: margin.left,
      y: margin.top - 16,
      width: plotW,
      height: plotH + 16,
      tabindex: 0,
      'aria-label': `${label}: стрелки влево и вправо — по батчам и событиям`,
      onpointermove: (event) => {
        const box = svg.getBoundingClientRect();
        const px = ((event.clientX - box.left) / box.width) * width;
        let best = 0;
        stops.forEach((t, index) => {
          if (Math.abs(x(t) - px) < Math.abs(x(stops[best]) - px)) best = index;
        });
        show(best, event.clientX, event.clientY);
      },
      onpointerleave: () => {
        cross.setAttribute('visibility', 'hidden');
        hideTip();
      },
      onfocus: () => show(current < 0 ? stops.length - 1 : current),
      onblur: () => {
        cross.setAttribute('visibility', 'hidden');
        hideTip();
      },
      onkeydown: (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = Math.min(
          stops.length - 1,
          Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1))
        );
        show(next);
      },
    });
    svg.append(hit);
    return svg;
  }

  function tableView(head, rows, numeric = []) {
    return el(
      'details',
      {},
      el('summary', {}, 'Таблица'),
      el(
        'div',
        { class: 'table-wrap' },
        el(
          'table',
          {},
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              head.map((cell, index) =>
                el('th', { class: numeric.includes(index) ? 'num' : null }, cell)
              )
            )
          ),
          el(
            'tbody',
            {},
            rows.map((row) =>
              el(
                'tr',
                {},
                row.map((cell, index) =>
                  el('td', { class: numeric.includes(index) ? 'num' : null }, cell)
                )
              )
            )
          )
        )
      )
    );
  }

  // ---------- Разделы ----------
  const visibleEvents = () => events.filter(eventVisible);

  function runSection() {
    const metric = state.metric;
    const visible = points.filter((point) => runSeries.includes(point.key) && visiblePoint(point));
    const series = runSeries
      .filter((key) => !state.hidden.has(key))
      .map((key) => {
        const own = visible.filter((point) => point.key === key && point.metrics[metric] != null);
        return {
          key,
          label: key,
          color: colorOf.get(key),
          values: own.map((point, index) => ({
            t: point.t,
            v: point.metrics[metric],
            point,
            reason: index > 0 ? breakReason(own[index - 1], point) : null,
          })),
        };
      })
      .filter((item) => item.values.length > 0);
    const allValues = series.flatMap((item) => item.values.map((value) => value.v));
    const rate = isRate(metric, allValues);
    const format = formatter(metric, rate);
    const single = series.length === 1 && metric === 'passRate';
    const band = single
      ? series[0].values
          .filter((value) => value.point.counted)
          .map((value) => {
            const [lo, hi] = wilson(value.point.passed, value.point.counted);
            return { t: value.t, lo, hi };
          })
      : null;

    const select = el(
      'select',
      {
        'aria-label': 'Метрика',
        onchange: (event) => {
          state.metric = event.target.value;
          render();
        },
      },
      runMetrics.map((id) =>
        el('option', { value: id, selected: id === metric }, METRIC_LABELS[id] ?? id)
      )
    );
    const legend = el(
      'div',
      { class: 'legend' },
      runSeries.map((key) => {
        const count = visible.filter((point) => point.key === key).length;
        return el(
          'button',
          {
            type: 'button',
            'aria-pressed': String(!state.hidden.has(key)),
            onclick: () => {
              if (state.hidden.has(key)) state.hidden.delete(key);
              else state.hidden.add(key);
              render();
            },
          },
          el('span', { class: 'key', style: `background:${colorOf.get(key)}` }),
          `${key} (${count})`
        );
      })
    );
    const body = series.length
      ? timeChart({
          series,
          events: visibleEvents(),
          width: Math.max(300, contentWidth - 34),
          height: contentWidth < 600 ? 240 : 320,
          rate,
          format,
          band,
          label: `${METRIC_LABELS[metric] ?? metric} по батчам`,
        })
      : el('div', { class: 'empty' }, 'Нет точек под фильтром');
    const rows = series
      .flatMap((item) =>
        item.values.map((value) => [
          dateLabel(value.t, true),
          value.point.batch,
          item.key,
          format(value.v),
          value.point.counted != null ? `${value.point.passed}/${value.point.counted}` : '—',
          value.point.tags.join(', '),
          value.reason ?? '',
        ])
      )
      .sort((a, b) => a[0].localeCompare(b[0]));
    return el(
      'section',
      { class: 'card' },
      el(
        'div',
        { class: 'card-head' },
        el('h2', {}, 'Сценарии и конструктор'),
        el(
          'span',
          { class: 'note' },
          single ? 'полоса — 90% интервал Уилсона' : 'линия рвётся там, где точки несравнимы'
        ),
        select
      ),
      legend,
      body,
      tableView(
        ['Время', 'Батч', 'Серия', METRIC_LABELS[metric] ?? metric, 'pass', 'Теги', 'Разрыв'],
        rows,
        [3, 4]
      )
    );
  }

  function standSection() {
    const cards = [];
    // Колонки малых графиков — по ширине карточки, ширина графика — ширина колонки.
    const inner = contentWidth - 34;
    const columns = Math.max(1, Math.floor((inner + 16) / 276));
    const multipleWidth = Math.floor((inner - 16 * (columns - 1)) / columns);
    for (const key of standSeries) {
      const own = points.filter((point) => point.key === key && visiblePoint(point));
      if (own.length === 0) continue;
      const metrics = [...new Set(own.flatMap((point) => Object.keys(point.metrics)))];
      const multiples = metrics.map((metric) => {
        const withValue = own.filter((point) => point.metrics[metric] != null);
        const values = withValue.map((point, index) => ({
          t: point.t,
          v: point.metrics[metric],
          point,
          reason: index > 0 ? breakReason(withValue[index - 1], point) : null,
        }));
        const rate = isRate(
          metric,
          values.map((value) => value.v)
        );
        const format = formatter(metric, rate);
        const label = METRIC_LABELS[metric] ?? metric;
        return el(
          'div',
          { class: 'multiple' },
          el('h3', {}, label),
          el(
            'p',
            { class: 'value' },
            values.length ? `последнее: ${format(values.at(-1).v)}` : 'нет значений'
          ),
          values.length
            ? timeChart({
                series: [{ key, label: key, color: 'var(--series-1)', values }],
                events: visibleEvents(),
                width: multipleWidth,
                height: 130,
                rate,
                format,
                label: `${key}: ${label}`,
                compact: true,
              })
            : null
        );
      });
      const head = ['Время', 'Батч', ...metrics];
      const rows = own.map((point) => [
        dateLabel(point.t, true),
        point.batch,
        ...metrics.map((metric) => {
          const value = point.metrics[metric];
          return value == null
            ? '—'
            : formatter(
                metric,
                isRate(
                  metric,
                  own.map((p) => p.metrics[metric]).filter((v) => v != null)
                )
              )(value);
        }),
      ]);
      cards.push(
        el(
          'section',
          { class: 'card' },
          el(
            'div',
            { class: 'card-head' },
            el('h2', {}, key),
            el(
              'span',
              { class: 'note' },
              `точек ${own.length}; линия рвётся при смене набора проверок`
            )
          ),
          el(
            'div',
            { class: 'multiples', style: `grid-template-columns:repeat(${columns}, 1fr)` },
            multiples
          ),
          tableView(
            head,
            rows,
            metrics.map((_, index) => index + 2)
          )
        )
      );
    }
    return cards;
  }

  function heatSection() {
    const key = state.heat;
    const own = points.filter((point) => point.key === key && visiblePoint(point) && point.cells);
    const select = el(
      'select',
      {
        'aria-label': 'Серия',
        onchange: (event) => {
          state.heat = event.target.value;
          render();
        },
      },
      runSeries.map((item) => el('option', { value: item, selected: item === key }, item))
    );
    const head = el(
      'div',
      { class: 'card-head' },
      el('h2', {}, 'Ячейки по батчам'),
      el('span', { class: 'note' }, 'цвет — средний счёт ячейки, ✓ — все прогоны прошли'),
      select
    );
    const cells = [...new Set(own.flatMap((point) => Object.keys(point.cells)))].sort();
    if (own.length === 0 || cells.length === 0) {
      return el(
        'section',
        { class: 'card' },
        head,
        el('div', { class: 'empty' }, 'Нет точек под фильтром')
      );
    }
    const cellW = 28;
    const cellH = 22;
    const left = 200;
    const top = 44;
    const width = left + own.length * cellW + 8;
    const height = top + cells.length * cellH + 4;
    const svg = el('svg:svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': `Ячейки серии ${key} по батчам`,
      style: `max-width:${width}px`,
    });
    // Дата — у первого батча дня: батчи одного дня идут подряд без повтора подписи.
    own.forEach((point, column) => {
      if (column > 0 && dateLabel(own[column - 1].t) === dateLabel(point.t)) return;
      const cx = left + column * cellW + cellW / 2;
      svg.append(
        el(
          'svg:text',
          { x: cx, y: top - 8, 'text-anchor': 'start', transform: `rotate(-45 ${cx} ${top - 8})` },
          dateLabel(point.t)
        )
      );
    });
    cells.forEach((cell, row) => {
      svg.append(
        el(
          'svg:text',
          { x: left - 8, y: top + row * cellH + cellH / 2 + 4, 'text-anchor': 'end' },
          cell
        )
      );
      own.forEach((point, column) => {
        const value = point.cells[cell];
        if (!value) return;
        const [passed, total, score] = value;
        const step = score == null ? 1 : Math.min(6, 1 + Math.floor(score * 5.999));
        const rect = el('svg:rect', {
          class: 'cell',
          x: left + column * cellW + 1,
          y: top + row * cellH + 1,
          width: cellW - 2,
          height: cellH - 2,
          rx: 3,
          fill: `var(--heat-${step})`,
          tabindex: -1,
          onpointermove: (event) =>
            showTip(event.clientX, event.clientY, [
              el('div', { class: 'head' }, `${dateLabel(point.t, true)} · ${point.batch}`),
              el(
                'div',
                { class: 'row' },
                el('strong', {}, score == null ? '—' : score.toFixed(2)),
                el('span', { class: 'name' }, cell)
              ),
              el(
                'div',
                { class: 'sub' },
                `pass ${passed}/${total}${value[3] ? ` · контракт ${value[3]}` : ''}`
              ),
            ]),
          onpointerleave: hideTip,
        });
        svg.append(rect);
        if (total > 0 && passed === total) {
          svg.append(
            el(
              'svg:text',
              {
                x: left + column * cellW + cellW / 2,
                y: top + row * cellH + cellH / 2 + 4,
                'text-anchor': 'middle',
                style: `fill:var(--heat-ink-${step});pointer-events:none`,
              },
              '✓'
            )
          );
        }
      });
    });
    const scale = el(
      'div',
      { class: 'scale' },
      'счёт 0',
      [1, 2, 3, 4, 5, 6].map((step) =>
        el('span', { class: 'swatch', style: `background:var(--heat-${step})` })
      ),
      '1'
    );
    const rows = own.flatMap((point) =>
      Object.entries(point.cells).map(([cell, [passed, total, score, contract]]) => [
        dateLabel(point.t, true),
        point.batch,
        cell,
        `${passed}/${total}`,
        score == null ? '—' : score.toFixed(2),
        contract ?? '—',
      ])
    );
    return el(
      'section',
      { class: 'card' },
      head,
      el('div', { class: 'table-wrap' }, svg),
      scale,
      tableView(['Время', 'Батч', 'Ячейка', 'pass', 'Счёт', 'Контракт'], rows, [3, 4])
    );
  }

  function eventsSection() {
    // Тот же срез, что у графиков: от первой видимой точки (с запасом в день) до последней.
    const shown = points.filter(visiblePoint);
    const from = shown.length ? shown[0].t - DAY : Infinity;
    const to = shown.length ? shown.at(-1).t + DAY : -Infinity;
    const list = visibleEvents()
      .filter((event) => event.t >= from && event.t <= to)
      .reverse();
    const rows = list.map((event) =>
      el(
        'tr',
        {},
        el('td', {}, event.date),
        el(
          'td',
          {},
          el(
            'span',
            { style: 'display:inline-flex;gap:6px;align-items:center' },
            glyphIcon(event.kind),
            KINDS[event.kind]?.label ?? event.kind
          )
        ),
        el('td', { class: 'wrap' }, event.title),
        el('td', {}, (event.refs ?? []).join(', ')),
        el('td', {}, event.commit ?? '')
      )
    );
    return el(
      'section',
      { class: 'card' },
      el(
        'div',
        { class: 'card-head' },
        el('h2', {}, 'События'),
        el('span', { class: 'note' }, `${list.length} под фильтром`)
      ),
      list.length
        ? el(
            'div',
            { class: 'table-wrap' },
            el(
              'table',
              {},
              el(
                'thead',
                {},
                el(
                  'tr',
                  {},
                  ['Дата', 'Вид', 'Что', 'Задачи', 'Коммит'].map((cell) => el('th', {}, cell))
                )
              ),
              el('tbody', {}, rows)
            )
          )
        : el('div', { class: 'empty' }, 'Нет событий под фильтром')
    );
  }

  function filters() {
    const ranges = [
      ['all', 'Всё время'],
      [30, '30 дней'],
      [14, '14 дней'],
      [7, '7 дней'],
    ];
    const axes = [
      ['batch', 'по батчам'],
      ['time', 'время'],
    ];
    return el(
      'div',
      { class: 'filters' },
      el(
        'div',
        { class: 'group', role: 'group', 'aria-label': 'Ось' },
        el('span', { class: 'label' }, 'Ось'),
        axes.map(([value, text]) =>
          el(
            'button',
            {
              type: 'button',
              class: 'chip',
              'aria-pressed': String(state.axis === value),
              onclick: () => {
                state.axis = value;
                render();
              },
            },
            text
          )
        )
      ),
      el(
        'div',
        { class: 'group', role: 'group', 'aria-label': 'Период' },
        el('span', { class: 'label' }, 'Период'),
        ranges.map(([value, text]) =>
          el(
            'button',
            {
              type: 'button',
              class: 'chip',
              'aria-pressed': String(state.range === value),
              onclick: () => {
                state.range = value;
                render();
              },
            },
            text
          )
        )
      ),
      el(
        'div',
        { class: 'group', role: 'group', 'aria-label': 'Теги' },
        el('span', { class: 'label' }, 'Теги'),
        allTags.map((tag) => {
          const mode = state.tags.get(tag) ?? 'neutral';
          const mark = mode === 'include' ? '✓ ' : mode === 'exclude' ? '− ' : '';
          const title =
            mode === 'include'
              ? 'только с этим тегом'
              : mode === 'exclude'
                ? 'скрыто'
                : 'без условия';
          return el(
            'button',
            {
              type: 'button',
              class: 'chip',
              'data-state': mode,
              title: `${tag}: ${title}; нажатие меняет условие`,
              'aria-label': `Тег ${tag}: ${title}`,
              onclick: () => {
                const next = mode === 'neutral' ? 'include' : mode === 'include' ? 'exclude' : null;
                if (next) state.tags.set(tag, next);
                else state.tags.delete(tag);
                render();
              },
            },
            `${mark}${tag}`
          );
        })
      ),
      el(
        'div',
        { class: 'group', role: 'group', 'aria-label': 'События' },
        el('span', { class: 'label' }, 'События'),
        Object.entries(KINDS).map(([kind, { label }]) =>
          el(
            'label',
            { class: 'chip' },
            el('input', {
              type: 'checkbox',
              checked: state.kinds.has(kind),
              onchange: (event) => {
                if (event.target.checked) state.kinds.add(kind);
                else state.kinds.delete(kind);
                render();
              },
            }),
            glyphIcon(kind),
            `${label} (${events.filter((event) => event.kind === kind).length})`
          )
        )
      )
    );
  }

  const root = document.getElementById('app');
  function render() {
    const scrollY = window.scrollY;
    hideTip();
    // Ширина графиков — по контейнеру: viewBox в 1100 на телефоне сжал бы подписи до нечитаемых.
    const styles = window.getComputedStyle(root);
    contentWidth =
      root.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const series = new Set(points.map((point) => point.key)).size;
    const last = points.at(-1);
    root.replaceChildren(
      el('h1', {}, 'Метрики @reformer/mcp'),
      el(
        'p',
        { class: 'lead' },
        `Точек ${points.length} в ${series} сериях, событий ${events.length}` +
          (last ? `; последняя точка ${dateLabel(last.t, true)} (${last.batch})` : '') +
          '. Источник — packages/reformer-mcp/eval/runs/history.json.'
      ),
      filters(),
      runSection(),
      heatSection(),
      ...standSection(),
      eventsSection()
    );
    window.scrollTo(0, scrollY);
  }
  render();
  let resizeTimer;
  let renderedWidth = root.clientWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (root.clientWidth === renderedWidth) return;
      renderedWidth = root.clientWidth;
      render();
    }, 150);
  });
}

/**
 * HTML дашборда по истории.
 *
 * @param {{ points: object[], events: object[] }} history
 */
export function renderReportHtml(history) {
  const data = JSON.stringify({ points: history.points, events: history.events }).replace(
    /</g,
    '\\u003c'
  );
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Метрики MCP</title>
<style>${STYLE}</style>
</head>
<body>
<main id="app"></main>
<script type="application/json" id="history">${data}</script>
<script>
(${dashboard.toString()})(JSON.parse(document.getElementById('history').textContent));
</script>
</body>
</html>
`;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const argv = process.argv.slice(2);
  const option = (name, fallback) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : fallback;
  };
  const out = path.resolve(option('out', path.join(repoRoot, '.tmp/mcp-eval/report/index.html')));
  const history = readHistory(path.resolve(option('history', historyFile)));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderReportHtml(history));
  console.log(
    `Точек ${history.points.length}, событий ${history.events.length} → ${path.relative(repoRoot, out)}`
  );
}

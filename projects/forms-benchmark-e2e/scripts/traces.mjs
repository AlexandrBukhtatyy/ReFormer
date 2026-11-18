/**
 * Ряды для графиков трейсов: results/<run>/traces/<lib>-<form>.json → JS heap, DOM-узлы и
 * обработчики событий во времени по участникам, с выровненными началами фаз.
 *
 * Источник — события `UpdateCounters` главного потока рендерера (их DevTools рисует под таймлайном
 * с галкой Memory) и метки `bench:phase:<id>:start|end`, которые ставит `lib/session.ts` в
 * trace-прогоне. Трасса — сотни мегабайт по событию на строку: читается потоково, разбираются
 * только нужные строки.
 *
 * Ось X общая для участников: окно замера фазы `k` занимает ширину самого долгого окна среди
 * участников, за ним — промежуток до следующей фазы (тоже по самому долгому); внутри куска время
 * реальное. Так «шаг 1» одной библиотеки стоит напротив «шага 1» другой, хотя проходят их они с
 * разной скоростью.
 *
 * Результат кэшируется в traces/series.json рядом с трассами — пересчёт, только если трассы
 * поменялись (размер или mtime) или поменялась версия формата.
 */
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { PHASES } from './metrics.mjs';
import { LIB_ORDER } from './aggregate.mjs';

const VERSION = 2;
/** Корзин прореживания на всю ось: в каждой — минимум и максимум, «пила» GC сохраняется. */
const BUCKETS = 600;

/** Счётчики трассы → ряды графиков. */
export const TRACE_METRICS = [
  {
    id: 'heap',
    field: 'jsHeapSizeUsed',
    title: 'JS heap',
    unit: 'МБ',
    scale: 1 / 2 ** 20,
    digits: 2,
  },
  { id: 'nodes', field: 'nodes', title: 'DOM-узлы', unit: '', scale: 1, digits: 0 },
  {
    id: 'listeners',
    field: 'jsEventListeners',
    title: 'Обработчики событий',
    unit: '',
    scale: 1,
    digits: 0,
  },
];

const MARK = /^bench:phase:(.+):(start|end)$/;
const round = (v, digits) => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};

/**
 * Одна трасса: счётчики главного потока рендерера и метки фаз. Последнее событие массива стоит в
 * одной строке с `],"metadata":`, первое может стоять за `{"traceEvents":[` — объект события
 * вырезается от первой `{` до последней `}`.
 */
async function readTrace(file) {
  const mainThreads = new Set();
  const counters = [];
  const marks = [];
  const rl = readline.createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (let line of rl) {
    const isCounter = line.includes('"UpdateCounters"');
    const isMark = !isCounter && line.includes('"bench:phase:');
    const isThread = !isCounter && !isMark && line.includes('"thread_name"');
    if (!isCounter && !isMark && !isThread) continue;
    if (line.startsWith('{"traceEvents":[')) line = line.slice('{"traceEvents":['.length);
    let e;
    try {
      e = JSON.parse(line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1));
    } catch {
      continue;
    }
    if (isThread) {
      if (e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
        mainThreads.add(`${e.pid}:${e.tid}`);
    } else if (isCounter) {
      const d = e.args?.data;
      if (e.name === 'UpdateCounters' && d && Number.isFinite(e.ts))
        counters.push({ ts: e.ts, pid: e.pid, thread: `${e.pid}:${e.tid}`, data: d });
    } else {
      const m = MARK.exec(e.name ?? '');
      if (m && String(e.cat).includes('blink.user_timing') && Number.isFinite(e.ts))
        marks.push({ phase: m[1], edge: m[2], ts: e.ts });
    }
  }

  // Только главный поток рендерера (метаданные потоков могут стоять и после событий — фильтр в
  // конце). Навигация может сменить процесс рендерера: с первого события нового pid старый
  // отбрасывается — он доживает и ещё шлёт счётчики, но страница уже не в нём.
  const own = mainThreads.size ? counters.filter((c) => mainThreads.has(c.thread)) : counters;
  own.sort((a, b) => a.ts - b.ts);
  const seen = new Set();
  let current = null;
  const samples = [];
  for (const c of own) {
    if (!seen.has(c.pid)) {
      seen.add(c.pid);
      current = c.pid;
    }
    if (c.pid === current) samples.push(c);
  }
  return { samples, marks };
}

/**
 * Куски участника по меткам, по порядку времени: окно замера фазы (`window`, от метки начала до
 * метки конца) и промежуток до начала следующей фазы (`gap`: пауза пользователя, проверки, GC,
 * заполнение полей без замера — например, шаг 5 кредита перед «Далее»). Промежуток — отдельный
 * кусок, чтобы работа вне замера не приписывалась фазе перед ней. Время — мкс трассы.
 */
function piecesOf(marks, lastTs) {
  const starts = new Map();
  const ends = new Map();
  for (const m of [...marks].sort((a, b) => a.ts - b.ts)) {
    const map = m.edge === 'start' ? starts : ends;
    if (!map.has(m.phase)) map.set(m.phase, m.ts);
  }
  const order = [...starts.entries()].sort((a, b) => a[1] - b[1]);
  const pieces = [];
  order.forEach(([phase, from], i) => {
    const next = i + 1 < order.length ? order[i + 1][1] : null;
    const end = ends.get(phase);
    const to = end !== undefined && (next === null || end <= next) ? end : (next ?? lastTs ?? from);
    pieces.push({ phase, kind: 'window', from, to });
    if (next !== null && next > to) pieces.push({ phase, kind: 'gap', from: to, to: next });
  });
  return pieces;
}

/**
 * Прореживание отрезка: в каждой корзине оси — точки минимума и максимума в порядке времени,
 * плюс первая и последняя точка отрезка, чтобы линия начиналась и кончалась на месте.
 * `points` — [x, y] по возрастанию x. Возвращает плоский массив x0, y0, x1, y1, …
 */
function decimate(points, bucketMs, digits) {
  const out = [];
  const push = (p) => {
    const x = Math.round(p[0]);
    const y = round(p[1], digits);
    const n = out.length;
    if (n >= 2 && out[n - 2] === x && out[n - 1] === y) return;
    out.push(x, y);
  };
  let bucket = null;
  let lo = null;
  let hi = null;
  const flush = () => {
    if (!lo) return;
    if (lo === hi) push(lo);
    else for (const p of lo[0] <= hi[0] ? [lo, hi] : [hi, lo]) push(p);
  };
  points.forEach((p, i) => {
    const b = Math.floor(p[0] / bucketMs);
    if (b !== bucket) {
      flush();
      bucket = b;
      lo = hi = null;
      if (i === 0) push(p);
    }
    if (!lo || p[1] < lo[1]) lo = p;
    if (!hi || p[1] > hi[1]) hi = p;
  });
  flush();
  if (points.length) push(points[points.length - 1]);
  return out;
}

/** Ключ кэша: размер и mtime каждой трассы формы. */
function fingerprint(files) {
  return Object.fromEntries(
    files.map(({ lib, file }) => {
      const st = statSync(file);
      return [lib, { size: st.size, mtimeMs: Math.round(st.mtimeMs) }];
    })
  );
}

/**
 * Ряды графиков формы из трасс прогона. Участники — LIB_ORDER (A/A-контроль не рисуется, как и в
 * ключевых метриках).
 *
 * Ось: у фазы окно замера `[offset, offset + width)` и следом промежуток до следующей шириной
 * `gap`; обе ширины — максимум по участникам.
 *
 * Результат: `{ form, phases: [{ id, title, offset, width, gap }], total, bucketMs, libs: { [lib]: {
 * lines: { heap: [[x, y, …], …по отрезкам] , … }, grid: { heap: [значение в корзине | null], … },
 * stats: { heap: { max, end }, … } } }, unmarked: [lib], missing: [lib] }`. X и ширины — мс.
 */
export async function traceSeries(runDir, form) {
  const dir = path.join(runDir, 'traces');
  const files = LIB_ORDER.map((lib) => ({ lib, file: path.join(dir, `${lib}-${form}.json`) }));
  const present = files.filter((f) => existsSync(f.file));
  const missing = files.filter((f) => !existsSync(f.file)).map((f) => f.lib);
  if (!present.length) return { form, phases: [], libs: {}, unmarked: [], missing, cached: false };

  const cacheFile = path.join(dir, 'series.json');
  const stamp = fingerprint(present);
  if (existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
      if (
        cache.version === VERSION &&
        cache.form === form &&
        JSON.stringify(cache.files) === JSON.stringify(stamp)
      )
        return withTitles({ ...cache.data, missing, cached: true }, form);
    } catch {
      // битый кэш — пересчёт
    }
  }

  const perLib = {};
  const unmarked = [];
  for (const { lib, file } of present) {
    const { samples, marks } = await readTrace(file);
    const pieces = piecesOf(marks, samples.at(-1)?.ts);
    if (!pieces.length) {
      unmarked.push(lib);
      continue;
    }
    perLib[lib] = { samples, pieces };
  }

  // Общая ось: фазы в порядке PHASES, неизвестные — следом в порядке появления.
  const known = (PHASES[form] ?? []).map((p) => p.id);
  const seenPhases = new Set(
    Object.values(perLib).flatMap(({ pieces }) => pieces.map((s) => s.phase))
  );
  const order = [
    ...known.filter((id) => seenPhases.has(id)),
    ...[...seenPhases].filter((id) => !known.includes(id)),
  ];
  const span = { window: {}, gap: {} };
  for (const id of order) span.window[id] = span.gap[id] = 0;
  for (const { pieces } of Object.values(perLib))
    for (const s of pieces)
      span[s.kind][s.phase] = Math.max(span[s.kind][s.phase], (s.to - s.from) / 1000);
  let acc = 0;
  const phases = order.map((id) => {
    const p = {
      id,
      offset: round(acc, 1),
      width: round(span.window[id], 1),
      gap: round(span.gap[id], 1),
    };
    acc = p.offset + p.width + p.gap;
    return p;
  });
  const total = round(acc, 1);
  const base = {
    window: Object.fromEntries(phases.map((p) => [p.id, p.offset])),
    gap: Object.fromEntries(phases.map((p) => [p.id, p.offset + p.width])),
  };
  const bucketMs = total / BUCKETS || 1;

  const libs = {};
  for (const [lib, { samples, pieces }] of Object.entries(perLib)) {
    const lines = Object.fromEntries(TRACE_METRICS.map((m) => [m.id, []]));
    const grid = Object.fromEntries(TRACE_METRICS.map((m) => [m.id, Array(BUCKETS).fill(null)]));
    const stats = Object.fromEntries(TRACE_METRICS.map((m) => [m.id, { max: null, end: null }]));
    let i = 0;
    for (const s of pieces) {
      while (i < samples.length && samples[i].ts < s.from) i++;
      const inSeg = [];
      // Окно закрыто меткой конца: счётчик на самой метке — его, а не промежутка.
      while (
        i < samples.length &&
        (samples[i].ts < s.to || (s.kind === 'window' && samples[i].ts === s.to))
      )
        inSeg.push(samples[i++]);
      if (!inSeg.length) continue;
      const xs = inSeg.map((c) => base[s.kind][s.phase] + (c.ts - s.from) / 1000);
      for (const m of TRACE_METRICS) {
        const pts = inSeg.map((c, k) => [xs[k], (c.data[m.field] ?? 0) * m.scale]);
        lines[m.id].push(decimate(pts, bucketMs, m.digits));
        for (const [x, y] of pts) {
          const b = Math.min(BUCKETS - 1, Math.floor(x / bucketMs));
          grid[m.id][b] = round(y, m.digits);
          if (stats[m.id].max === null || y > stats[m.id].max) stats[m.id].max = y;
        }
        stats[m.id].end = pts.at(-1)[1];
      }
    }
    for (const m of TRACE_METRICS) {
      if (stats[m.id].max !== null) stats[m.id].max = round(stats[m.id].max, m.digits);
      if (stats[m.id].end !== null) stats[m.id].end = round(stats[m.id].end, m.digits);
    }
    libs[lib] = { lines, grid, stats };
  }

  const data = { form, phases, total, bucketMs, buckets: BUCKETS, libs, unmarked };
  writeFileSync(cacheFile, JSON.stringify({ version: VERSION, form, files: stamp, data }));
  return withTitles({ ...data, missing, cached: false }, form);
}

/** Названия фаз — из PHASES при чтении, не из кэша: тексты могут поменяться без перепрогона. */
function withTitles(series, form) {
  const titles = Object.fromEntries((PHASES[form] ?? []).map((p) => [p.id, p.title]));
  return { ...series, phases: series.phases.map((p) => ({ ...p, title: titles[p.id] ?? p.id })) };
}

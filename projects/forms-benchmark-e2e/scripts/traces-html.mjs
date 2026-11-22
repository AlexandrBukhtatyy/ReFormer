/**
 * Раздел HTML-отчёта «Трейсы»: JS heap, DOM-узлы и обработчики событий во времени — на графике
 * все участники, у каждого свой цвет. Ряды — scripts/traces.mjs (начала фаз выровнены).
 *
 * Цвет здесь различает участников, а не роль, как на барах: пять библиотек — первые пять
 * категориальных слотов палитры dataviz в фиксированном порядке (проверены валидатором в светлой
 * и тёмной теме; три светлых слота ниже 3:1 к фону — поэтому под графиками таблица значений),
 * baseline — серый пунктир, как контур его бара. SVG строится здесь, на стороне Node; подсказка
 * с перекрестием и подсветка участника — маленький скрипт TRACE_SCRIPT.
 */
import { TRACE_METRICS } from './traces.mjs';

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/** Слот палитры по участнику — за сущностью, не за порядком: фильтр не перекрашивает линии. */
const SLOT = { 'reformer-core': 1, 'reformer-json': 2, formik: 3, rhf: 4, rjsf: 5 };
const colorClass = (lib) => (lib === 'baseline' ? 'c-base' : `c-s${SLOT[lib] ?? 6}`);

// Геометрия графика (единицы viewBox; SVG тянется на ширину колонки).
const VBW = 1000;
const LEFT = 52;
const RIGHT = 12;
const TOP = 20;
const PLOT_H = 150;
const BOTTOM = 8;
const PLOT_W = VBW - LEFT - RIGHT;
const HEIGHT = TOP + PLOT_H + BOTTOM;

function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const tickText = (v) => String(+v.toFixed(2));
const px = (v) => Math.round(v * 10) / 10;

function chart(series, metric, libs, name, formTitle) {
  const xOf = (ms) => LEFT + (ms / series.total) * PLOT_W;
  const max = niceMax(
    Math.max(0, ...libs.map((lib) => series.libs[lib].stats[metric.id].max ?? 0))
  );
  const yOf = (v) => TOP + PLOT_H - (v / max) * PLOT_H;
  const parts = [];

  // Окна замера фаз — полосы, промежутки между фазами — без заливки. Номер фазы над серединой
  // окна, если не налезает на предыдущий (узкие окна кликов подписывает подсказка).
  let lastLabel = -Infinity;
  series.phases.forEach((p, i) => {
    const x0 = xOf(p.offset);
    const w = Math.max(1, (p.width / series.total) * PLOT_W);
    parts.push(
      `<rect class="phase-band" x="${px(x0)}" y="${TOP}" width="${px(w)}" height="${PLOT_H}"/>`
    );
    const label = String(i + 1);
    const cx = Math.min(VBW - RIGHT - 4, Math.max(LEFT + 4, x0 + w / 2));
    const room = 7 * label.length + 6;
    if (cx - lastLabel >= room) {
      parts.push(
        `<text class="phase-num" x="${px(cx)}" y="${TOP - 6}" text-anchor="middle">${label}</text>`
      );
      lastLabel = cx;
    }
  });
  // Ось Y: 0, середина, максимум — волосяные линии.
  for (const t of [0, max / 2, max]) {
    parts.push(
      `<line class="trace-grid" x1="${LEFT}" x2="${VBW - RIGHT}" y1="${px(yOf(t))}" y2="${px(yOf(t))}"/>`
    );
    parts.push(
      `<text class="tick" x="${LEFT - 6}" y="${px(yOf(t)) + 4}" text-anchor="end">${tickText(t)}</text>`
    );
  }
  // Линии: baseline снизу, ReFormer core сверху.
  for (const lib of [...libs].reverse()) {
    const d = series.libs[lib].lines[metric.id]
      .filter((seg) => seg.length >= 2)
      .map((seg) => {
        let s = '';
        for (let i = 0; i < seg.length; i += 2)
          s += `${i ? 'L' : 'M'}${px(xOf(seg[i]))},${px(yOf(seg[i + 1]))}`;
        // Отрезок из одной точки — короткий штрих, иначе путь не виден.
        return seg.length === 2 ? `${s}h1` : s;
      })
      .join('');
    parts.push(`<g class="tl ${colorClass(lib)}" data-lib="${esc(lib)}"><path d="${d}"/></g>`);
  }
  parts.push(
    `<line class="xhair" x1="0" x2="0" y1="${TOP}" y2="${TOP + PLOT_H}" visibility="hidden"/>`
  );
  const title = `${metric.title}${metric.unit ? `, ${metric.unit}` : ''}`;
  const aria = `${title} во времени по участникам (${formTitle}): ${libs.map(name).join(', ')}`;
  return `<figure class="chart trace-chart" data-metric="${metric.id}" tabindex="0" aria-label="${esc(aria)}"><figcaption>${esc(title)}</figcaption><div class="trace-scroll"><svg viewBox="0 0 ${VBW} ${HEIGHT}" role="img" aria-label="${esc(aria)}">${parts.join('')}</svg></div></figure>`;
}

function fmtValue(v, metric) {
  return v === null || v === undefined ? '—' : v.toFixed(metric.digits);
}

/**
 * Раздел трейсов формы. `series` — результат traceSeries (или undefined, если трасс нет),
 * `labels` — подписи участников, `formTitle` — название формы в тексте.
 */
export function traceSection(series, labels, formTitle) {
  const name = (lib) => labels[lib]?.replace(/_/g, '') ?? lib;
  const out = ['<h3>Трейсы: память и DOM во времени</h3>'];
  const libs = Object.keys(series?.libs ?? {});
  if (!libs.length) {
    out.push(
      series?.unmarked?.length
        ? '<p class="muted">Трассы этого прогона сняты без меток фаз <code>bench:phase:*</code> — без них участников не выровнять по фазам. Перезапустите бенч: трассируемый прогон включён по умолчанию (<code>BENCH_TRACE=1</code>).</p>'
        : '<p class="muted">В прогоне нет трасс (<code>BENCH_TRACE=0</code>).</p>'
    );
    return out.join('');
  }

  out.push(
    `<p class="muted">Счётчики DevTools (<code>UpdateCounters</code>) из трассируемого прогона${series.cpu ? `, CPU ${esc(series.cpu)}x` : ''}. Ось X — время с выровненными фазами: полосы — окна замера фаз (номера — по списку ниже), промежутки между ними — работа вне замера: пауза пользователя, проверки, сборка мусора, заполнение полей без замера. Каждое окно и каждый промежуток шириной в самый долгий у участников, внутри время реальное — у быстрых линия кончается раньше. Heap без принудительной сборки мусора — видна её «пила»; значения после GC — в таблицах фаз ниже.</p>`
  );
  const src = series.source;
  if (src)
    out.push(
      src.sameBuild
        ? `<p class="muted">Трассы — из отдельного прогона <code>${esc(src.traceRun)}</code>, замеры ниже — из <code>${esc(src.run)}</code>. Сборка страниц у них одна (собрана ${esc(src.builtAt ?? '—')}).</p>`
        : `<p class="warn">Трассы — из отдельного прогона <code>${esc(src.traceRun)}</code> на другой сборке страниц (собрана ${esc(src.builtAt ?? '—')}), чем замеры ниже (<code>${esc(src.run)}</code>): графики и таблицы могут расходиться.</p>`
    );
  const notes = [];
  if (series.unmarked?.length)
    notes.push(`без меток фаз, не показаны: ${series.unmarked.map(name).join(', ')}`);
  if (series.missing?.length) notes.push(`нет трассы: ${series.missing.map(name).join(', ')}`);
  if (notes.length) out.push(`<p class="warn">${esc(notes.join('; '))}.</p>`);

  const data = {
    total: series.total,
    bucketMs: series.bucketMs,
    buckets: series.buckets,
    vbw: VBW,
    left: LEFT,
    plotW: PLOT_W,
    phases: series.phases.map((p, i) => ({
      n: i + 1,
      title: p.title,
      offset: p.offset,
      width: p.width,
      gap: p.gap ?? 0,
    })),
    libs: libs.map((lib) => ({ id: lib, label: name(lib), cls: colorClass(lib) })),
    metrics: Object.fromEntries(
      TRACE_METRICS.map((m) => [m.id, { title: m.title, unit: m.unit, digits: m.digits }])
    ),
    grid: Object.fromEntries(libs.map((lib) => [lib, series.libs[lib].grid])),
  };

  out.push(`<div class="traces" data-form="${esc(series.form)}">`);
  out.push(
    `<div class="legend trace-legend" aria-label="Участники">${libs
      .map(
        (lib) =>
          `<button type="button" class="trace-key ${colorClass(lib)}" data-lib="${esc(lib)}"><svg width="20" height="8" aria-hidden="true"><line x1="0" x2="20" y1="4" y2="4"/></svg>${esc(name(lib))}</button>`
      )
      .join(
        ''
      )}<span>наведите на участника — подсветка; на график — значения всех участников</span></div>`
  );
  out.push('<div class="trace-stack">');
  for (const m of TRACE_METRICS) out.push(chart(series, m, libs, name, formTitle));
  out.push('</div>');
  out.push(
    `<ol class="phase-list">${series.phases.map((p) => `<li>${esc(p.title)}</li>`).join('')}</ol>`
  );

  // Табличное представление: пик и значение в конце трассы — данные не только цветом.
  const head = ['Участник'];
  for (const m of TRACE_METRICS) {
    const u = m.unit ? `, ${m.unit}` : '';
    head.push(`${m.title}${u}: пик`, `${m.title}${u}: в конце`);
  }
  const rows = libs.map((lib) => {
    const st = series.libs[lib].stats;
    return [
      esc(name(lib)),
      ...TRACE_METRICS.flatMap((m) => [fmtValue(st[m.id].max, m), fmtValue(st[m.id].end, m)]),
    ];
  });
  out.push(
    `<details><summary>Таблица: пик и конец трассы</summary><div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`
  );
  out.push(
    `<script type="application/json" class="trace-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
  );
  out.push('</div>');
  return out.join('');
}

/** Стили раздела (цвета серий — токены --series-N в :root отчёта). */
export const TRACE_CSS = `
.c-s1 { --c: var(--series-1); } .c-s2 { --c: var(--series-2); } .c-s3 { --c: var(--series-3); }
.c-s4 { --c: var(--series-4); } .c-s5 { --c: var(--series-5); } .c-s6 { --c: var(--series-6); }
.c-base { --c: var(--rest); }
.trace-legend { align-items: center; gap: 4px 12px; }
.trace-key { display: inline-flex; align-items: center; gap: 6px; font: inherit; color: var(--ink-2); background: none; border: 0; border-radius: 4px; padding: 2px 4px; cursor: default; transition: opacity .12s; }
.trace-key:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.trace-key line { stroke: var(--c); stroke-width: 2; }
.trace-key.c-base line { stroke-dasharray: 4 3; }
.trace-stack { display: grid; gap: 8px; }
.trace-stack > .trace-chart { min-width: 0; }
.trace-chart:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.trace-chart svg { touch-action: pan-y; }
.tl path { fill: none; stroke: var(--c); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; transition: opacity .12s; }
.tl.c-base path { stroke-dasharray: 4 3; }
.traces[data-active] .tl:not(.is-active) { opacity: .12; }
.traces[data-active] .trace-key:not(.is-active) { opacity: .5; }
.phase-band { fill: var(--grid); opacity: .5; }
.trace-scroll { overflow-x: auto; }
@media (max-width: 720px) { .trace-chart svg { min-width: 680px; } }
.trace-grid { stroke: var(--grid); stroke-width: 1; vector-effect: non-scaling-stroke; }
.phase-num { fill: var(--muted); font-size: 11px; }
.xhair { stroke: var(--ink-2); stroke-width: 1; vector-effect: non-scaling-stroke; pointer-events: none; }
.phase-list { columns: 2 320px; column-gap: 32px; margin: 8px 0; padding-left: 28px; font-size: 12px; color: var(--ink-2); }
.phase-list li { break-inside: avoid; }
#tip .tip-head { color: var(--ink-2); margin-bottom: 4px; }
#tip .tip-row { display: flex; align-items: center; gap: 8px; }
#tip .tip-row strong { min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; }
#tip .key { display: inline-block; width: 14px; border-top: 2px solid var(--c); }
#tip .key.c-base { border-top-style: dashed; }
`;

/**
 * Перекрестие и подсказка (все участники в точке X, синхронно на трёх графиках формы), подсветка
 * участника из легенды. Подписи — через textContent.
 */
export const TRACE_SCRIPT = `
(() => {
  const tip = document.getElementById('tip');
  const place = (x, y) => {
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - w - 8)) + 'px';
    tip.style.top = Math.max(8, Math.min(y + 14, innerHeight - h - 8)) + 'px';
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  for (const box of document.querySelectorAll('.traces')) {
    const data = JSON.parse(box.querySelector('.trace-data').textContent);
    const figs = [...box.querySelectorAll('.trace-chart')];
    const setActive = (lib) => {
      if (lib) box.dataset.active = lib; else delete box.dataset.active;
      for (const n of box.querySelectorAll('.tl, .trace-key')) n.classList.toggle('is-active', n.dataset.lib === lib);
    };
    for (const k of box.querySelectorAll('.trace-key')) {
      k.addEventListener('pointerenter', () => setActive(k.dataset.lib));
      k.addEventListener('pointerleave', () => setActive(null));
      k.addEventListener('focus', () => setActive(k.dataset.lib));
      k.addEventListener('blur', () => setActive(null));
    }
    const last = data.buckets - 1;
    const xOfBucket = (b) => data.left + ((b + 0.5) * data.bucketMs / data.total) * data.plotW;
    const phaseAt = (ms) => data.phases.find((p) => ms < p.offset + p.width + p.gap) ?? data.phases[data.phases.length - 1];
    const hide = () => { tip.style.display = 'none'; for (const f of figs) f.querySelector('.xhair').setAttribute('visibility', 'hidden'); };
    const show = (fig, b, x, y) => {
      const xh = xOfBucket(b);
      for (const f of figs) { const l = f.querySelector('.xhair'); l.setAttribute('x1', xh); l.setAttribute('x2', xh); l.setAttribute('visibility', 'visible'); }
      const metric = data.metrics[fig.dataset.metric];
      const ms = (b + 0.5) * data.bucketMs;
      const ph = phaseAt(ms);
      const inGap = ms >= ph.offset + ph.width;
      tip.replaceChildren();
      tip.append(el('div', 'tip-head', inGap
        ? 'После фазы ' + ph.n + ' — вне замера (пауза, проверки, GC, заполнение полей) · +' + Math.round(ms - ph.offset - ph.width) + ' мс'
        : ph.n + '. ' + ph.title + ' · +' + Math.round(ms - ph.offset) + ' мс от начала фазы'));
      for (const lib of data.libs) {
        const v = data.grid[lib.id][fig.dataset.metric][b];
        const row = el('div', 'tip-row');
        row.append(el('strong', '', v === null ? '—' : v.toFixed(metric.digits) + (metric.unit ? ' ' + metric.unit : '')), el('span', 'key ' + lib.cls), el('span', '', lib.label));
        tip.append(row);
      }
      place(x, y);
    };
    for (const fig of figs) {
      const svg = fig.querySelector('svg');
      let cur = null;
      const bucketAt = (clientX) => {
        const r = svg.getBoundingClientRect();
        const vx = ((clientX - r.left) / r.width) * data.vbw;
        if (vx < data.left || vx > data.left + data.plotW) return null;
        return Math.max(0, Math.min(last, Math.floor(((vx - data.left) / data.plotW) * data.total / data.bucketMs)));
      };
      svg.addEventListener('pointermove', (e) => { const b = bucketAt(e.clientX); if (b === null) return hide(); cur = b; show(fig, b, e.clientX, e.clientY); });
      svg.addEventListener('pointerleave', hide);
      const fromKeys = () => { const r = fig.getBoundingClientRect(); const s = svg.getBoundingClientRect(); show(fig, cur, s.left + (xOfBucket(cur) / data.vbw) * s.width, r.bottom); };
      fig.addEventListener('focus', () => { if (cur === null) cur = 0; fromKeys(); });
      fig.addEventListener('blur', hide);
      fig.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowRight') cur = Math.min(last, (cur ?? 0) + step);
        else if (e.key === 'ArrowLeft') cur = Math.max(0, (cur ?? 0) - step);
        else if (e.key === 'Home') cur = 0;
        else if (e.key === 'End') cur = last;
        else if (e.key === 'Escape') return hide();
        else return;
        e.preventDefault();
        fromKeys();
      });
    }
  }
})();
`;

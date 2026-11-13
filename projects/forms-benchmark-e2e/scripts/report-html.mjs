/**
 * HTML-версия отчёта: самодостаточная страница (без внешних скриптов и шрифтов), SVG-графики
 * строятся здесь, на стороне Node.
 *
 * Графики — горизонтальные бары по участникам: длина — медиана по прогонам, ус — IQR. Цвет не
 * различает участников (их подписывает ось), а выделяет: ReFormer — акцентный синий, конкуренты —
 * серый, baseline — контур (форма «emphasis», см. dataviz). Палитра проверена валидатором в светлой
 * и тёмной теме. Подписи значений у баров + таблицы под графиками — данные не только цветом.
 */
import { HEADLINE, NOTES } from './metrics.mjs';

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

function fmt(v, unit) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (unit === 'КБ') return v.toFixed(0);
  if (unit === 'шт' || unit === '') return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

const roleOf = (lib) =>
  lib.startsWith('reformer') ? 'subject' : lib === 'baseline' ? 'baseline' : 'competitor';

/** Горизонтальный бар-чарт: rows = [{ lib, label, value, lo, hi, tip, note }]. */
function barChart({ title, unit, rows }) {
  const rowH = 30;
  const left = 118;
  const right = 92;
  const width = 520;
  const top = 8;
  const plotW = width - left - right;
  const height = top + rows.length * rowH + 22;
  const max = Math.max(...rows.map((r) => Math.max(r.value ?? 0, r.hi ?? 0)), 0) || 1;
  const x = (v) => left + (Math.max(0, v) / max) * plotW;
  const ticks = [0, max / 2, max];
  const parts = [];
  for (const t of ticks) {
    parts.push(
      `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${top + rows.length * rowH}"/>`
    );
    parts.push(
      `<text class="tick" x="${x(t)}" y="${height - 6}" text-anchor="middle">${esc(fmt(t, unit))}</text>`
    );
  }
  rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2;
    const h = 16;
    const y = cy - h / 2;
    const role = roleOf(r.lib);
    const w = r.value !== null ? Math.max(1, x(r.value) - left) : 0;
    const rad = Math.min(4, w);
    // Скругление 4px только на конце данных, у базовой линии угол прямой.
    const bar =
      r.value === null
        ? ''
        : `<path class="bar bar--${role}" d="M${left},${y} h${w - rad} a${rad},${rad} 0 0 1 ${rad},${rad} v${h - 2 * rad} a${rad},${rad} 0 0 1 -${rad},${rad} h-${w - rad} z"/>`;
    const whisker =
      r.lo !== null && r.hi !== null && r.hi > r.lo
        ? `<line class="whisker" x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${cy}" y2="${cy}"/><line class="whisker" x1="${x(r.lo)}" x2="${x(r.lo)}" y1="${cy - 4}" y2="${cy + 4}"/><line class="whisker" x1="${x(r.hi)}" x2="${x(r.hi)}" y1="${cy - 4}" y2="${cy + 4}"/>`
        : '';
    const valueX =
      r.value !== null ? Math.max(x(r.value), r.hi !== null ? x(r.hi) : 0) + 6 : left + 6;
    parts.push(
      `<g class="row" tabindex="0" data-tip="${esc(r.tip)}"><title>${esc(r.tip)}</title>` +
        `<rect class="hit" x="0" y="${cy - rowH / 2}" width="${width}" height="${rowH}"/>` +
        `<text class="name${role === 'subject' ? ' name--subject' : ''}" x="${left - 8}" y="${cy + 4}" text-anchor="end">${esc(r.label)}</text>` +
        bar +
        whisker +
        `<text class="value" x="${valueX}" y="${cy + 4}">${esc(r.value === null ? '—' : fmt(r.value, unit))}<tspan class="note"> ${esc(r.note ?? '')}</tspan></text>` +
        `</g>`
    );
  });
  parts.push(
    `<line class="axis" x1="${left}" x2="${left}" y1="${top - 4}" y2="${top + rows.length * rowH}"/>`
  );
  return `<figure class="chart"><figcaption>${esc(title)}${unit ? `, ${esc(unit)}` : ''}</figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">${parts.join('')}</svg></figure>`;
}

function statsTip(lib, label, c, unit, row) {
  const ref = c.vsCore;
  const p =
    ref?.adj !== undefined && ref?.adj !== null
      ? `; p(Holm) против ReFormer core = ${ref.adj.toFixed(3)}`
      : '';
  const ratio = c.ratio && Number.isFinite(c.ratio) ? `; ×${c.ratio.toFixed(2)} к лучшему` : '';
  const ci = c.ratioCI ? ` [95% CI ${c.ratioCI[0].toFixed(2)}–${c.ratioCI[1].toFixed(2)}]` : '';
  const cv = c.cv !== null ? `; CV ${(c.cv * 100).toFixed(0)}%` : '';
  return `${label}: медиана ${fmt(c.median, unit)} ${unit}; IQR ${fmt(c.q25, unit)}–${fmt(c.q75, unit)}; n=${c.n}${cv}${ratio}${ci}${p}${row.best === lib ? ' — лучший' : ''}`;
}

function metricChart(row, title, libs, labels) {
  return barChart({
    title,
    unit: row.unit,
    rows: libs.map((lib) => {
      const c = row.cells[lib];
      return {
        lib,
        label: labels[lib].replace(/_/g, ''),
        value: c?.median ?? null,
        lo: c?.q25 ?? null,
        hi: c?.q75 ?? null,
        note:
          c && lib !== 'baseline' && c.ratio && Number.isFinite(c.ratio)
            ? `×${c.ratio.toFixed(2)}`
            : '',
        tip: c
          ? statsTip(lib, labels[lib].replace(/_/g, ''), c, row.unit, row)
          : `${labels[lib]}: нет данных`,
      };
    }),
  });
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

export function renderHtml(summary, labels) {
  const out = [];
  const env = summary.forms[0]?.env;
  for (const f of summary.forms) {
    const libs = f.libs;
    out.push(
      `<section><h2>Форма: ${f.form === 'registration' ? 'регистрация с капчей' : 'кредитная заявка'}</h2>`
    );
    if (f.failures.length)
      out.push(
        `<p class="warn">Неудачных прогонов: ${f.failures.length} — не входят в статистику.</p>`
      );
    for (const cpu of f.cpus) {
      out.push(`<h3>Ключевые метрики, CPU ${cpu}x</h3><div class="grid">`);
      for (const h of HEADLINE[f.form] ?? []) {
        const s = f.sections.find((x) => x.cpu === cpu && x.phase === h.phase);
        const row = s?.rows.find((r) => r.metric === h.metric);
        if (row) out.push(metricChart(row, `${s.title} — ${row.label}`, libs, labels));
      }
      out.push('</div>');
      out.push(`<details><summary>Все фазы и метрики, CPU ${cpu}x</summary>`);
      for (const s of f.sections.filter((x) => x.cpu === cpu)) {
        out.push(`<h4>${esc(s.title)}</h4>`);
        out.push(
          table(
            ['Метрика', ...libs.map((l) => labels[l].replace(/_/g, ''))],
            s.rows.map((r) => [
              `${esc(r.label)}${r.unit ? `, ${esc(r.unit)}` : ''}`,
              ...libs.map((l) => {
                const c = r.cells[l];
                if (!c) return '—';
                const v = fmt(c.median, r.unit);
                const iqr = `<span class="muted">${fmt(c.q25, r.unit)}–${fmt(c.q75, r.unit)}</span>`;
                const mark = c.marker ? ` ${c.marker}` : '';
                return `${l === r.best ? `<strong>${v}</strong>` : v}${mark}<br>${iqr}`;
              }),
            ])
          )
        );
        if (s.apiCalls) {
          const list = libs
            .filter((l) => s.apiCalls[l] !== undefined)
            .map((l) => {
              const calls = Object.entries(s.apiCalls[l]);
              return `${labels[l].replace(/_/g, '')} — ${calls.length ? calls.map(([n, k]) => `${n} ×${k}`).join(', ') : 'нет'}`;
            });
          out.push(
            `<p class="muted">Запросы к API за фазу различаются (часть работы перенесена в другую фазу): ${esc(list.join('; '))}.</p>`
          );
        }
        for (const note of NOTES[f.form]?.[s.phase] ?? [])
          out.push(`<p class="muted">${esc(note)}</p>`);
      }
      out.push('</details>');
    }
    if (f.renders.length) {
      out.push('<h3>Рендеры React на действие</h3>');
      out.push(
        table(
          ['Фаза', ...libs.map((l) => labels[l].replace(/_/g, ''))],
          f.renders.map((r) => [
            esc(r.title),
            ...libs.map((l) => {
              const c = r.cells[l];
              if (!c) return '—';
              if (c.perKey !== null)
                return `${c.perKey.toFixed(1)} <span class="muted">/клавиша</span>`;
              if (c.perMount !== null)
                return `${c.perMount.toFixed(0)} <span class="muted">/монт.</span>`;
              return `${c.components} <span class="muted">(${c.commits} commit)</span>`;
            }),
          ])
        )
      );
    }
    out.push('</section>');
  }

  if (summary.bundle) {
    out.push('<section><h2>Размер бандла</h2><div class="grid">');
    for (const form of [...new Set(summary.bundle.entries.map((e) => e.form))]) {
      const entries = summary.bundle.entries.filter((e) => e.form === form && labels[e.id]);
      const order = Object.keys(labels);
      entries.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      out.push(
        barChart({
          title: `JS gzip, ${form}`,
          unit: 'КБ',
          rows: entries.map((e) => ({
            lib: e.id,
            label: labels[e.id].replace(/_/g, ''),
            value: e.js.gzip / 1024,
            lo: null,
            hi: null,
            note:
              e.overBaseline && e.id !== 'baseline'
                ? `+${(e.overBaseline.gzip / 1024).toFixed(1)}`
                : '',
            tip: `${labels[e.id].replace(/_/g, '')}: gzip ${(e.js.gzip / 1024).toFixed(1)} КБ, brotli ${(e.js.brotli / 1024).toFixed(1)} КБ, raw ${(e.js.raw / 1024).toFixed(1)} КБ`,
          })),
        })
      );
    }
    out.push('</div></section>');
  }

  if (summary.code) {
    const rows = [];
    for (const [impl, forms] of Object.entries(summary.code.report)) {
      for (const [form, c] of Object.entries(forms)) {
        rows.push([
          `${esc(labels[impl]?.replace(/_/g, '') ?? impl)} / ${form}`,
          c.form.ts,
          c.form.json,
          c.kit.ts,
          c.total.ts + c.total.json,
          c.total.files,
        ]);
      }
    }
    out.push(
      `<section><h2>Объём кода</h2><p class="muted">Исходники, попавшие в бандл страницы; строки без пустых и комментариев после prettier. Обвязка — код интеграции библиотеки, общий для форм.</p>${table(['Реализация', 'Форма TS', 'Форма JSON', 'Обвязка TS', 'Итого строк', 'Файлов'], rows)}</section>`
    );
  }

  const meta = env
    ? `${esc(env.machine.cpu)}, ${env.machine.cores} ядер · ${esc(env.runtime.browser)} · ${env.config.iterations} прогонов на участника · CPU ${env.config.cpuRates.join(', ')}x`
    : '';

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Бенчмарк форм</title>
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --accent: #2a78d6; --rest: #898781; --warn: #d03b3b;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --accent: #3987e5; --rest: #898781; --warn: #e66767;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --accent: #3987e5; --rest: #898781; --warn: #e66767;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; font-variant-numeric: tabular-nums; }
main { max-width: 1120px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 20px; margin: 40px 0 8px; }
h3 { font-size: 16px; margin: 24px 0 8px; }
h4 { font-size: 14px; margin: 20px 0 6px; color: var(--ink-2); }
.meta, .muted { color: var(--ink-2); }
.legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 12px 0; color: var(--ink-2); font-size: 13px; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -1px; margin-right: 6px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr)); gap: 12px; }
.chart { margin: 0; background: var(--surface); border: 1px solid var(--grid); border-radius: 8px; padding: 12px; }
.chart figcaption { font-size: 13px; color: var(--ink-2); margin-bottom: 4px; }
.chart svg { width: 100%; height: auto; display: block; overflow: visible; }
.grid line, line.grid { stroke: var(--grid); stroke-width: 1; }
line.axis { stroke: var(--axis); stroke-width: 1; }
.tick { fill: var(--muted); font-size: 11px; }
.name { fill: var(--ink-2); font-size: 12px; }
.name--subject { fill: var(--ink); font-weight: 600; }
.value { fill: var(--ink); font-size: 12px; }
.value .note { fill: var(--muted); }
.bar--subject { fill: var(--accent); }
.bar--competitor { fill: var(--rest); }
.bar--baseline { fill: none; stroke: var(--rest); stroke-width: 1.5; stroke-dasharray: 3 2; }
.whisker { stroke: var(--ink-2); stroke-width: 1.5; }
.hit { fill: transparent; }
.row:hover .hit, .row:focus .hit { fill: var(--grid); opacity: .45; }
.row:focus { outline: none; }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--grid); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--grid); text-align: left; vertical-align: top; }
th { color: var(--ink-2); font-weight: 600; }
.num { text-align: right; white-space: nowrap; }
details { margin: 12px 0; }
summary { cursor: pointer; color: var(--accent); }
.warn { color: var(--warn); }
#tip { position: fixed; pointer-events: none; max-width: 360px; background: var(--surface); color: var(--ink); border: 1px solid var(--axis); border-radius: 6px; padding: 8px 10px; font-size: 12px; box-shadow: 0 4px 16px rgb(0 0 0 / .15); display: none; z-index: 10; }
@media (max-width: 600px) { body { font-size: 14px; } h1 { font-size: 22px; } }
</style>
</head>
<body>
<main>
<h1>Бенчмарк форм: ReFormer против Formik, React Hook Form и RJSF</h1>
<p class="meta">${meta}<br>Прогоны: ${summary.runs.map((r) => `<code>${esc(r)}</code>`).join(', ')}</p>
<div class="legend" aria-label="Легенда">
  <span><span class="swatch" style="background:var(--accent)"></span>ReFormer (core, JSON)</span>
  <span><span class="swatch" style="background:var(--rest)"></span>Formik, React Hook Form, RJSF</span>
  <span><span class="swatch" style="border:1.5px dashed var(--rest)"></span>baseline — разметка без библиотеки</span>
  <span>Бар — медиана по прогонам, ус — IQR; ×N — отношение к лучшему; меньше — лучше; ▲/▼ в таблицах — значимо хуже/лучше ReFormer core (точный Mann–Whitney, Holm, больше шума A/A)</span>
</div>
${out.join('\n')}
<section><h2>Методика</h2><p>Правила честности, контракт поведения и статистика — <code>projects/forms-benchmark/BENCH-CONTRACT.md</code>. Поведение всех реализаций проверено conformance-тестами до замеров; каждая фаза дополнительно проверяется после окна замера. Полные числа, p-значения и доверительные интервалы — в <code>summary.json</code> и <code>report.md</code>.</p></section>
</main>
<div id="tip" role="tooltip"></div>
<script>
const tip = document.getElementById('tip');
const show = (el, x, y) => { tip.textContent = el.dataset.tip; tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(x + 14, innerWidth - w - 8) + 'px'; tip.style.top = Math.min(y + 14, innerHeight - h - 8) + 'px'; };
for (const el of document.querySelectorAll('.row')) {
  el.addEventListener('pointermove', (e) => show(el, e.clientX, e.clientY));
  el.addEventListener('pointerleave', () => (tip.style.display = 'none'));
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); show(el, r.left, r.bottom); });
  el.addEventListener('blur', () => (tip.style.display = 'none'));
}
</script>
</body>
</html>`;
}

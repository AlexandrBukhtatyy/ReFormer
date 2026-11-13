#!/usr/bin/env node
/**
 * Отчёт бенчмарка: results/<run>/phases.ndjson (+ отчёты бандла и кода приложения) →
 * results/_reports/<stamp>/{summary.json, report.md, report.html}.
 *
 * Как читаются числа (BENCH-CONTRACT §7): прогон уже свёрнут (метрики в metrics.mjs), по прогонам —
 * медиана и IQR; отношение к лучшему в строке; значимость против ReFormer core — Mann–Whitney U с
 * поправкой Holm по всем сравнениям; различие меньше шума A/A-пары не считается различием.
 *
 * Опции: --runs <dir>[,<dir>] (по умолчанию — последний прогон каждой формы), --publish (копия в
 * docs/benchmarks/forms/).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, holm, mannWhitney, median, ratioCI } from './stats.mjs';
import { HEADLINE, METRICS, NOTES, PHASES } from './metrics.mjs';
import { renderHtml } from './report-html.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(here, '..');
const resultsDir = path.join(e2eDir, 'results');
const appDist = path.resolve(e2eDir, '../forms-benchmark/dist');
const repoRoot = path.resolve(e2eDir, '../..');

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const LIB_ORDER = ['reformer-core', 'reformer-json', 'formik', 'rhf', 'rjsf', 'baseline'];
const COMPARE_TO = 'reformer-core';
const CONTROL = 'reformer-core-aa';

// ── Выбор прогонов ───────────────────────────────────────────────────────────
function pickRuns() {
  const explicit = argValue('--runs');
  if (explicit) return explicit.split(',').map((d) => path.resolve(resultsDir, d));
  const dirs = existsSync(resultsDir)
    ? readdirSync(resultsDir).filter(
        (d) => /_[a-z]+_[0-9a-z]+$/.test(d) && existsSync(path.join(resultsDir, d, 'phases.ndjson'))
      )
    : [];
  const latest = {};
  for (const d of dirs.sort()) latest[d.split('_')[1]] = d;
  return Object.values(latest).map((d) => path.join(resultsDir, d));
}

const readNdjson = (file) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

const runs = pickRuns();
if (!runs.length) {
  console.error('нет прогонов в results/ — сначала npm run bench');
  process.exit(1);
}

// ── Агрегация ────────────────────────────────────────────────────────────────
const forms = [];
const comparisons = []; // для Holm: { ref, p }

for (const dir of runs) {
  const env = JSON.parse(readFileSync(path.join(dir, 'env.json'), 'utf8'));
  const phases = readNdjson(path.join(dir, 'phases.ndjson'));
  const runLog = readNdjson(path.join(dir, 'runs.ndjson'));
  const form = env.form;
  const libsPresent = [...new Set(phases.map((p) => p.lib))];
  const libs = LIB_ORDER.filter((l) => libsPresent.includes(l));
  const cpus = [...new Set(phases.filter((p) => p.mode === 'timing').map((p) => p.cpu))].sort();

  const failures = runLog.filter((r) => !r.ok);
  const formOut = { form, runId: env.runId, env, libs, cpus, failures, sections: [], renders: [] };

  for (const cpu of cpus) {
    for (const phase of PHASES[form] ?? []) {
      const metrics = METRICS[phase.kind].filter((m) => !m.only || m.only.includes(phase.id));
      const section = { cpu, phase: phase.id, title: phase.title, kind: phase.kind, rows: [] };
      for (const metric of metrics) {
        const values = {};
        for (const lib of [...libs, CONTROL]) {
          values[lib] = phases
            .filter(
              (p) => p.mode === 'timing' && p.cpu === cpu && p.phase === phase.id && p.lib === lib
            )
            .map((p) => {
              try {
                return metric.get(p);
              } catch {
                return null;
              }
            })
            .filter((v) => v !== null && v !== undefined && Number.isFinite(v));
        }
        const stats = Object.fromEntries(
          Object.entries(values).map(([lib, v]) => [lib, describe(v)])
        );
        const contenders = libs.filter((l) => l !== 'baseline' && stats[l].n > 0);
        if (!contenders.length) continue;
        const best = contenders.reduce((a, b) => (stats[b].median < stats[a].median ? b : a));
        const cells = {};
        for (const lib of libs) {
          const s = stats[lib];
          if (!s.n) continue;
          const ratio = stats[best].median ? s.median / stats[best].median : null;
          cells[lib] = {
            ...s,
            ratio,
            ratioCI: lib === best ? null : ratioCI(values[lib], values[best]),
          };
        }
        // Шум A/A: насколько расходятся две одинаковые сборки ReFormer core.
        const noise =
          stats[CONTROL]?.n && stats[COMPARE_TO]?.n && stats[COMPARE_TO].median
            ? Math.abs(Math.log(stats[CONTROL].median / stats[COMPARE_TO].median))
            : null;
        const row = {
          metric: metric.id,
          label: metric.label,
          unit: metric.unit,
          best,
          noise,
          cells,
        };
        if (values[COMPARE_TO]?.length) {
          for (const lib of contenders.filter((l) => l !== COMPARE_TO)) {
            const p = mannWhitney(values[lib], values[COMPARE_TO]);
            const ref = { form, cpu, phase: phase.id, metric: metric.id, lib, p, adj: null };
            comparisons.push(ref);
            cells[lib].vsCore = ref;
          }
        }
        section.rows.push(row);
      }
      section.apiCalls = apiCallsIfDiffer(phases, cpu, phase.id, libs);
      if (section.rows.length) formOut.sections.push(section);
    }
  }

  // Рендеры: один проход на участника (CPU 1x).
  for (const phase of PHASES[form] ?? []) {
    const row = { phase: phase.id, title: phase.title, kind: phase.kind, cells: {} };
    for (const lib of libs) {
      const rec = phases.find((p) => p.mode === 'renders' && p.phase === phase.id && p.lib === lib);
      if (!rec?.renders) continue;
      const keys = rec.keys?.proc?.length ?? 0;
      const executions = Object.values(rec.renders.primitiveExecutions ?? {}).reduce(
        (a, b) => a + b,
        0
      );
      row.cells[lib] = {
        commits: rec.renders.commits,
        components: rec.renders.components,
        primitives: rec.renders.primitives,
        executions,
        keys,
        perKey: keys ? rec.renders.components / keys : null,
        perMount: phase.kind === 'remount' && rec.count ? rec.renders.components / rec.count : null,
      };
    }
    if (Object.keys(row.cells).length) formOut.renders.push(row);
  }
  forms.push(formOut);
}

// Holm по всем сравнениям отчёта.
const adjusted = holm(comparisons.map((c) => c.p));
comparisons.forEach((c, i) => (c.adj = adjusted[i]));
// Значок значимости — в данные ячейки: его показывают и markdown, и HTML.
for (const f of forms)
  for (const s of f.sections)
    for (const r of s.rows)
      for (const lib of Object.keys(r.cells)) r.cells[lib].marker = marker(r, lib).trim() || null;

const bundle = existsSync(path.join(appDist, 'bundle-report.json'))
  ? JSON.parse(readFileSync(path.join(appDist, 'bundle-report.json'), 'utf8'))
  : null;
const code = existsSync(path.join(appDist, 'code-report.json'))
  ? JSON.parse(readFileSync(path.join(appDist, 'code-report.json'), 'utf8'))
  : null;

const summary = {
  generatedAt: new Date().toISOString(),
  runs: runs.map((r) => path.basename(r)),
  forms,
  bundle,
  code,
};

/**
 * Запросы к fake API за фазу по участникам — только если они различаются: тогда часть работы
 * (и её время) у кого-то перенесена в другую фазу, и это видно под таблицей. У участника берётся
 * самый частый набор вызовов по его прогонам.
 */
function apiCallsIfDiffer(phases, cpu, phaseId, libs) {
  const byLib = {};
  for (const lib of libs.filter((l) => l !== 'baseline')) {
    const sigs = phases
      .filter(
        (p) =>
          p.mode === 'timing' && p.cpu === cpu && p.phase === phaseId && p.lib === lib && p.apiCalls
      )
      .map((p) =>
        JSON.stringify(
          Object.entries(p.apiCalls)
            .filter(([, n]) => n > 0)
            .sort()
        )
      );
    if (!sigs.length) continue;
    const counts = new Map();
    for (const s of sigs) counts.set(s, (counts.get(s) ?? 0) + 1);
    byLib[lib] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  if (new Set(Object.values(byLib)).size <= 1) return null;
  return Object.fromEntries(
    Object.entries(byLib).map(([lib, s]) => [lib, Object.fromEntries(JSON.parse(s))])
  );
}

function formatCalls(calls) {
  const entries = Object.entries(calls);
  return entries.length ? entries.map(([name, n]) => `${name} ×${n}`).join(', ') : 'нет';
}

// ── Markdown ─────────────────────────────────────────────────────────────────
const LABELS = {
  'reformer-core': 'ReFormer core',
  'reformer-json': 'ReFormer JSON',
  formik: 'Formik',
  rhf: 'RHF',
  rjsf: 'RJSF',
  baseline: '_baseline_',
};

function fmt(v, unit) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (unit === 'КБ') return v.toFixed(0);
  if (unit === 'шт' || unit === '') return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/** ▲/▼ — значимо хуже/лучше ReFormer core (Holm p < 0.05 и разница больше шума A/A). */
function marker(row, lib) {
  const ref = row.cells[lib]?.vsCore;
  if (!ref || ref.adj === null || ref.adj >= 0.05) return '';
  const core = row.cells[COMPARE_TO]?.median;
  const mine = row.cells[lib]?.median;
  if (!core || !mine) return '';
  if (row.noise !== null && Math.abs(Math.log(mine / core)) <= row.noise) return '';
  return mine > core ? ' ▲' : ' ▼';
}

function cell(row, lib) {
  const c = row.cells[lib];
  if (!c) return '—';
  const value = fmt(c.median, row.unit);
  if (lib === 'baseline') return `_${value}_`;
  const ratio = c.ratio !== null && Number.isFinite(c.ratio) ? ` ×${c.ratio.toFixed(2)}` : '';
  const text = `${value}${ratio}${marker(row, lib)}`;
  return lib === row.best ? `**${text}**` : text;
}

const lines = [];
const push = (...l) => lines.push(...l);
const envFirst = forms[0].env;
push(
  '# Бенчмарк форм: ReFormer против Formik, React Hook Form и RJSF',
  '',
  `Сформирован ${summary.generatedAt.slice(0, 16).replace('T', ' ')} UTC по прогонам: ${summary.runs.map((r) => `\`${r}\``).join(', ')}.`,
  '',
  `**Машина:** ${envFirst.machine.cpu}, ${envFirst.machine.cores} ядер, ${envFirst.machine.memoryGb} ГБ, ${envFirst.machine.platform}. ` +
    `**Браузер:** ${envFirst.runtime.browser} (${envFirst.runtime.headless}). **Node** ${envFirst.runtime.node}.`,
  `**Прогонов:** ${envFirst.config.iterations} на участника и профиль CPU (+${envFirst.config.warmup} прогрев), ` +
    `троттлинг CPU ${envFirst.config.cpuRates.map((c) => `${c}x`).join(', ')}, ввод с интервалом ${envFirst.config.cadenceMs} мс, ` +
    `сид порядка ${envFirst.config.seed}. **Сборка:** git \`${envFirst.build?.git?.sha?.slice(0, 8) ?? '?'}\`${envFirst.build?.git?.dirty ? ' (с незакоммиченными изменениями)' : ''}.`,
  ''
);
const versions = envFirst.build?.versions ?? {};
push(
  '**Версии:** ' +
    [
      '@reformer/core',
      '@reformer/renderer-json',
      'formik',
      'yup',
      'react-hook-form',
      '@hookform/resolvers',
      'zod',
      '@rjsf/core',
      '@rjsf/validator-ajv8',
      'react',
    ]
      .filter((p) => versions[p])
      .map((p) => `${p} ${versions[p]}`)
      .join(', ') +
    '.',
  '',
  '## Как читать',
  '',
  '- Ячейка — **медиана по прогонам** (каждый прогон сначала свёрнут: например, медиана задержки по всем клавишам фазы). Меньше — лучше.',
  '- `×1.42` — во сколько раз хуже лучшего участника в строке; лучший выделен **жирным**.',
  '- `▲` / `▼` — значимо хуже / лучше ReFormer core: точный Mann–Whitney U (перестановочное распределение), поправка Holm по всем сравнениям отчёта, p < 0.05, и разница больше шума A/A (две одинаковые сборки ReFormer core). Без значка — различие не доказано.',
  '- _baseline_ — та же разметка без библиотеки форм: нижняя граница стоимости.',
  '- Методика и правила честности: `projects/forms-benchmark/BENCH-CONTRACT.md`; поведение всех реализаций проверено conformance-тестами до замеров.',
  ''
);

for (const f of forms) {
  const libs = f.libs;
  const header = `| Метрика | ${libs.map((l) => LABELS[l] ?? l).join(' | ')} |`;
  const sep = `|---|${libs.map(() => '---:').join('|')}|`;
  push(`## Форма: ${f.form === 'registration' ? 'регистрация с капчей' : 'кредитная заявка'}`, '');
  if (f.failures.length) {
    push(
      `> ⚠️ Неудачных прогонов: ${f.failures.length} — они не входят в статистику (см. runs.ndjson).`,
      ''
    );
  }
  for (const cpu of f.cpus) {
    push(`### Итог, CPU ${cpu}x`, '', header, sep);
    for (const h of HEADLINE[f.form] ?? []) {
      const section = f.sections.find((s) => s.cpu === cpu && s.phase === h.phase);
      const row = section?.rows.find((r) => r.metric === h.metric);
      if (!row) continue;
      push(
        `| ${section.title}: ${row.label}, ${row.unit} | ${libs.map((l) => cell(row, l)).join(' | ')} |`
      );
    }
    push('');
  }
  for (const cpu of f.cpus) {
    push(`### Все фазы, CPU ${cpu}x`, '');
    for (const section of f.sections.filter((s) => s.cpu === cpu)) {
      push(`#### ${section.title}`, '', header, sep);
      for (const row of section.rows) {
        push(
          `| ${row.label}${row.unit ? `, ${row.unit}` : ''} | ${libs.map((l) => cell(row, l)).join(' | ')} |`
        );
      }
      const noisy = section.rows.filter((r) =>
        Object.values(r.cells).some((c) => c.cv !== null && c.cv > 0.15)
      );
      if (noisy.length)
        push('', `_Разброс выше 15 % (CV): ${noisy.map((r) => r.label).join('; ')}._`);
      if (section.apiCalls) {
        const list = libs
          .filter((l) => section.apiCalls[l] !== undefined)
          .map((l) => `${LABELS[l] ?? l} — ${formatCalls(section.apiCalls[l])}`);
        push(
          '',
          `_Запросы к API за фазу различаются (часть работы перенесена в другую фазу): ${list.join('; ')}._`
        );
      }
      for (const note of NOTES[f.form]?.[section.phase] ?? []) push('', `_${note}_`);
      push('');
    }
  }
  if (f.renders.length) {
    push(
      '### Рендеры React',
      '',
      'Отрендеренные компоненты за фазу (в скобках — commits); для ввода — на одну клавишу, для перемонтирования — на одно монтирование. Считает хук DevTools (флаг PerformedWork, как React DevTools), проход на CPU 1x.',
      '',
      `| Фаза | ${libs.map((l) => LABELS[l] ?? l).join(' | ')} |`,
      sep
    );
    for (const row of f.renders) {
      const fmtCell = (c) => {
        if (!c) return '—';
        if (c.perKey !== null) return `${c.perKey.toFixed(1)}/клавиша (${c.commits})`;
        if (c.perMount !== null) return `${c.perMount.toFixed(0)}/монтирование`;
        return `${c.components} (${c.commits})`;
      };
      push(`| ${row.title} | ${libs.map((l) => fmtCell(row.cells[l])).join(' | ')} |`);
    }
    push('');
  }
}

if (bundle) {
  push(
    '## Размер бандла',
    '',
    'Отдельная prod-сборка каждой страницы; статическое замыкание входа. Сжатие считается на вход целиком, атрибуция — минифицированные байты по sourcemap.',
    '',
    '| Страница | JS raw, КБ | gzip, КБ | brotli, КБ | gzip сверх baseline, КБ | Крупнейшие пакеты (raw, КБ) |',
    '|---|---:|---:|---:|---:|---|'
  );
  const order = (e) => (LIB_ORDER.indexOf(e.id) === -1 ? 99 : LIB_ORDER.indexOf(e.id));
  for (const e of [...bundle.entries]
    .filter((e) => e.id !== CONTROL)
    .sort((a, b) => a.form.localeCompare(b.form) || order(a) - order(b))) {
    const top = Object.entries(e.packages)
      .filter(([k]) => !k.startsWith('[') && !['react-dom', 'react', 'scheduler'].includes(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k} ${(v / 1024).toFixed(1)}`)
      .join(', ');
    push(
      `| ${LABELS[e.id] ?? e.id} / ${e.form} | ${(e.js.raw / 1024).toFixed(1)} | ${(e.js.gzip / 1024).toFixed(1)} | ${(e.js.brotli / 1024).toFixed(1)} | ${e.overBaseline ? (e.overBaseline.gzip / 1024).toFixed(1) : '—'} | ${top} |`
    );
  }
  push('');
}

if (code) {
  push(
    '## Объём кода реализаций',
    '',
    'Считаются исходники `src/libs/**`, попавшие в бандл страницы (по sourcemap): строки без пустых и комментариев после prettier. «Форма» — файлы каталога формы, «обвязка» — остальной код интеграции библиотеки, который использует страница (адаптеры полей, тема RJSF, общие правила и поведение ReFormer). Общий слой бенчмарка (`src/shared`) одинаков у всех и не считается. JSON-документ кредита у ReFormer JSON сгенерирован один раз из общих метаданных полей; RJSF и ReFormer core строят схемы из тех же метаданных в коде.',
    '',
    '| Реализация / форма | Форма TS | Форма JSON | Обвязка TS | Итого строк | Файлов | gzip исходника, Б |',
    '|---|---:|---:|---:|---:|---:|---:|'
  );
  for (const [impl, forms] of Object.entries(code.report)) {
    for (const [form, c] of Object.entries(forms)) {
      push(
        `| ${LABELS[impl] ?? impl} / ${form} | ${c.form.ts} | ${c.form.json} | ${c.kit.ts} | ${c.total.ts + c.total.json} | ${c.total.files} | ${c.total.gzip} |`
      );
    }
  }
  push('');
}

push(
  '## Ограничения',
  '',
  '- Троттлинг CPU в Chromium замедляет только main thread: парсинг и компиляция вне основного потока, GC и растеризация не замедляются — стоимость больших бандлов занижена.',
  '- «Клавиша → конец кадра» квантуется частотой кадров; для сравнения точнее «клавиша → конец обработки» и CPU-время на клавишу.',
  '- Одна машина и один браузер; результаты на другом железе отличаются по абсолютным значениям.',
  '- Абсолютные значения разных сессий несравнимы даже на одной машине: у baseline (тот же код) они расходились до 1.6× между прогонами одного дня при одинаковой фоновой нагрузке (частота и тепловой режим CPU). Сравнивайте отношения внутри одного отчёта; участники в прогоне чередуются в перемешанном порядке, поэтому дрейф ложится на всех одинаково.',
  '- Реализации конкурентов написаны по официальной документации независимо от кода ReFormer; отклонения каждой — в `projects/forms-benchmark/src/libs/<lib>/README.md`.',
  ''
);

// ── Запись ───────────────────────────────────────────────────────────────────
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace(/-\d{3}Z$/, 'Z');
const outDir = path.join(resultsDir, '_reports', stamp);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'));
writeFileSync(path.join(outDir, 'report.html'), renderHtml(summary, LABELS));
console.log(`отчёт → ${path.relative(process.cwd(), outDir)}/report.md, report.html`);

if (args.includes('--publish')) {
  const pub = path.join(repoRoot, 'docs/benchmarks/forms');
  mkdirSync(pub, { recursive: true });
  for (const f of ['report.md', 'report.html', 'summary.json'])
    copyFileSync(path.join(outDir, f), path.join(pub, f));
  console.log(`опубликовано → ${path.relative(process.cwd(), pub)}`);
}

#!/usr/bin/env node
/**
 * Сравнение двух отчётов бенча «было → стало» — например, до и после изменения ядра, снятых в
 * разных сессиях. По каждой форме, профилю CPU, фазе, метрике времени (мс) и участнику — медианы по
 * прогонам: сырые и нормированные по скорости машины. Байты, счётчики и heap не показываются: от
 * скорости CPU они не зависят.
 *
 *   npm run bench:compare -- <было> <стало> [--norm auto|calibration|baseline|none] [--form <id>]
 *                            [--out <файл.md>]
 *
 * <было> и <стало> — summary.json; каталог отчёта с ним (results/_reports/<stamp>); или прогоны —
 * каталоги results/<run> (путь или имя) через запятую, свёрнутые так же, как в отчёте. Относительные
 * пути — от каталога, где запущен npm, затем от results/.
 *
 * Нормировка (`--norm auto`, по умолчанию): по калибровке, если она есть в обоих отчётах, — значение
 * «стало» делится на отношение медиан калибровки стало/было, то есть пересчитывается к скорости
 * машины «было». Если калибровки нет хотя бы в одном отчёте (отчёты до ReFormer-q6ny), — по
 * baseline: делитель — геометрическое среднее отношений стало/было медиан baseline по метрикам
 * чистого CPU-времени (CPU_TIME_METRICS). Метрики, где нормировка приблизительна (таймеры, сеть,
 * кадры, TBT), помечены «≈».
 *
 * Для каждой стороны печатается фоновая нагрузка (scripts/background.mjs); если хотя бы одна снята на
 * занятой машине — предупреждение: калибровка нагрузку на GPU и память почти не видит.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONTROL, LIB_ORDER, aggregate, isRunDir, resultsDir } from './aggregate.mjs';
import { CPU_TIME_METRICS } from './metrics.mjs';
import { backgroundLine } from './background.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const norm = flag('--norm') ?? 'auto';
const onlyForm = flag('--form');
const outFile = flag('--out');
if (args.length !== 2 || !['auto', 'calibration', 'baseline', 'none'].includes(norm)) {
  console.error(
    'использование: npm run bench:compare -- <было> <стало> [--norm auto|calibration|baseline|none] [--form <id>] [--out <файл.md>]\n' +
      '<было>/<стало>: summary.json, каталог отчёта или прогоны results/<run> через запятую'
  );
  process.exit(1);
}

const LABELS = {
  'reformer-core': 'ReFormer core',
  'reformer-json': 'ReFormer JSON',
  formik: 'Formik',
  rhf: 'RHF',
  rjsf: 'RJSF',
  baseline: 'baseline',
  [CONTROL]: 'ReFormer core A/A',
};
const FORM_TITLES = { registration: 'регистрация с капчей', credit: 'кредитная заявка' };
const label = (lib) => LABELS[lib] ?? lib;

// ── Загрузка стороны сравнения ───────────────────────────────────────────────
const bases = [...new Set([process.env.INIT_CWD, process.cwd()].filter(Boolean))];

function locate(p) {
  if (path.isAbsolute(p)) return existsSync(p) ? p : null;
  for (const base of [...bases, resultsDir, path.join(resultsDir, '_reports')]) {
    const full = path.resolve(base, p);
    if (existsSync(full)) return full;
  }
  return null;
}

function load(spec) {
  const parts = spec.split(',').filter(Boolean);
  if (parts.length === 1) {
    const p = locate(parts[0]);
    if (!p) throw new Error(`не найдено: ${parts[0]}`);
    const file = statSync(p).isDirectory() ? path.join(p, 'summary.json') : p;
    if (existsSync(file) && file.endsWith('.json')) {
      const summary = JSON.parse(readFileSync(file, 'utf8'));
      return { source: path.relative(bases[0], file) || file, summary };
    }
  }
  const dirs = parts.map((d) => {
    const p = locate(d);
    if (!p || !isRunDir(p)) throw new Error(`не прогон (нет phases.ndjson): ${d}`);
    return p;
  });
  const { forms } = aggregate(dirs);
  return {
    source: `прогоны ${dirs.map((d) => path.basename(d)).join(', ')}`,
    summary: { runs: dirs.map((d) => path.basename(d)), forms },
  };
}

// ── Числа ────────────────────────────────────────────────────────────────────
function fmt(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}
const ratioText = (r) => (r === null || !Number.isFinite(r) ? '' : `×${r.toFixed(2)}`);
const geomean = (v) =>
  v.length ? Math.exp(v.reduce((a, b) => a + Math.log(b), 0) / v.length) : null;
const positive = (v) => v !== null && v !== undefined && Number.isFinite(v) && v > 0;

/** Индекс скорости по baseline: геометрическое среднее стало/было по его CPU-метрикам. */
function baselineFactor(before, after) {
  const ratios = [];
  for (const s of after.sections) {
    const prev = before.sections.find((x) => x.phase === s.phase);
    if (!prev) continue;
    for (const r of s.rows) {
      if (!CPU_TIME_METRICS.has(r.metric)) continue;
      const a = prev.rows.find((x) => x.metric === r.metric)?.cells.baseline?.median;
      const b = r.cells.baseline?.median;
      if (positive(a) && positive(b)) ratios.push(b / a);
    }
  }
  return ratios.length ? { factor: geomean(ratios), n: ratios.length } : null;
}

const calibrationMedian = (form, cpu) => form.calibration?.byCpu?.[cpu]?.median ?? null;

/** Калибровки сравнимы только при одной и той же нагрузке (id, объём, повторы). */
function workloadOf(form) {
  const w = form.env?.calibration?.workload;
  return w ? `${w.id}, ${w.units} ед. × ${w.reps} повт.` : 'неизвестна';
}

// ── Сравнение ────────────────────────────────────────────────────────────────
let before;
let after;
try {
  before = load(args[0]);
  after = load(args[1]);
} catch (error) {
  console.error(`bench:compare: ${error.message}`);
  process.exit(1);
}
const lines = [];
const push = (...l) => lines.push(...l);

push(
  '# Сравнение прогонов бенча: было → стало',
  '',
  `- **Было:** ${before.source}${before.summary.runs ? ` (${before.summary.runs.map((r) => `\`${r}\``).join(', ')})` : ''}`,
  `- **Стало:** ${after.source}${after.summary.runs ? ` (${after.summary.runs.map((r) => `\`${r}\``).join(', ')})` : ''}`,
  '- Ячейка: `было → стало ×стало/было · норм. ×…` — медианы по прогонам в мс. «Норм.» — то же отношение после поправки на скорость машины: «стало» пересчитано к скорости машины «было». Меньше 1 — стало быстрее.',
  '- Только метрики времени; байты, счётчики и heap от скорости CPU не зависят и не сравниваются здесь. `≈` у метрики — нормировка приблизительна: в ней есть таймеры (debounce), задержка fake API, ожидание кадра или порог TBT, которые от скорости CPU не зависят.',
  ''
);

const forms = after.summary.forms.filter((f) => !onlyForm || f.form === onlyForm);
for (const f of before.summary.forms)
  if (!forms.some((x) => x.form === f.form) && (!onlyForm || f.form === onlyForm))
    push(`_Форма ${f.form} есть только в «было»._`, '');

for (const fAfter of forms) {
  const fBefore = before.summary.forms.find((x) => x.form === fAfter.form);
  if (!fBefore) {
    push(`_Форма ${fAfter.form} есть только в «стало»._`, '');
    continue;
  }
  for (const cpu of fAfter.cpus) {
    if (!fBefore.cpus.includes(cpu)) {
      push(`_${FORM_TITLES[fAfter.form]}: CPU ${cpu}x есть только в «стало»._`, '');
      continue;
    }
    const sb = { sections: fBefore.sections.filter((s) => s.cpu === cpu) };
    const sa = { sections: fAfter.sections.filter((s) => s.cpu === cpu) };
    push(`## ${FORM_TITLES[fAfter.form] ?? fAfter.form}, CPU ${cpu}x`, '');

    // Делитель нормировки.
    const calA = calibrationMedian(fBefore, cpu);
    const calB = calibrationMedian(fAfter, cpu);
    const wA = workloadOf(fBefore);
    const wB = workloadOf(fAfter);
    const calMissing =
      !calA && !calB
        ? 'калибровки нет в обоих отчётах (прогоны до ReFormer-q6ny)'
        : !calA
          ? 'калибровки нет в «было» (прогоны до ReFormer-q6ny)'
          : !calB
            ? 'калибровки нет в «стало»'
            : wA !== wB
              ? `калибровочные нагрузки разные («было»: ${wA}; «стало»: ${wB}) — их времена несравнимы`
              : null;
    const base = baselineFactor(sb, sa);
    let factor = null;
    const speed = (k) =>
      Math.abs(k - 1) < 0.005
        ? 'скорость машины та же'
        : k > 1
          ? `машина в «стало» медленнее ×${k.toFixed(2)}`
          : `машина в «стало» быстрее ×${(1 / k).toFixed(2)}`;
    const calText = calMissing
      ? null
      : `калибровка ${fmt(calA)} → ${fmt(calB)} мс (${speed(calB / calA)})`;
    const baseText = base
      ? `baseline ×${base.factor.toFixed(2)} (геом. среднее по ${base.n} CPU-метрикам)`
      : null;
    const useCalibration = calText && (norm === 'auto' || norm === 'calibration');
    const useBaseline = !useCalibration && base && (norm === 'auto' || norm === 'baseline');
    if (useCalibration) {
      factor = calB / calA;
      push(
        `**Нормировка по калибровке:** ${calText}.${baseText ? ` Для сверки: ${baseText} — baseline после нормировки должен быть около ×1.00.` : ''}`
      );
    } else if (useBaseline) {
      factor = base.factor;
      const why = norm === 'baseline' ? 'выбрана `--norm baseline`' : calMissing;
      push(
        `**Нормировка по baseline** — ${why}: делитель — ${baseText}. Baseline после неё по построению около ×1.00, а точность нормировки ограничена тем, что baseline меряет только часть фаз.${calText ? ` Калибровка: ${calText}.` : ''}`
      );
    } else {
      const why =
        norm === 'none'
          ? 'выбрана `--norm none`'
          : norm === 'calibration'
            ? calMissing
            : `${calMissing}, а baseline нет в обоих отчётах`;
      push(`**Без нормировки** — ${why}.`);
    }
    push('');

    // Фоновая нагрузка обеих сторон: соседи бьют по GPU и памяти, калибровка этого не видит.
    push(
      `**Фоновая нагрузка:** было — ${backgroundLine(fBefore.background)}; стало — ${backgroundLine(fAfter.background)}.`,
      ''
    );
    const dirty = [
      fBefore.background?.flags?.length ? '«было»' : null,
      fAfter.background?.flags?.length ? '«стало»' : null,
    ].filter(Boolean);
    if (dirty.length) {
      push(
        `> ⚠️ ${dirty.join(' и ')} снято на занятой машине: соседи нагружают GPU, память и композитор, калибровка этого почти не видит — разница ниже может быть фоновой нагрузкой, а не изменением кода. Перепроверьте на тихой машине (\`npm run bench:idle-check\`).`,
        ''
      );
    }

    // Столбцы — участники, которые есть в обоих отчётах; остальные — строкой ниже.
    const both = fAfter.libs.filter((l) => fBefore.libs.includes(l));
    const libs = [
      ...LIB_ORDER.filter((l) => both.includes(l)),
      ...both.filter((l) => !LIB_ORDER.includes(l)),
    ];
    const onlyBefore = fBefore.libs.filter((l) => !both.includes(l));
    const onlyAfter = fAfter.libs.filter((l) => !both.includes(l));
    const missing = [
      onlyBefore.length ? `только в «было» — ${onlyBefore.map(label).join(', ')}` : null,
      onlyAfter.length ? `только в «стало» — ${onlyAfter.map(label).join(', ')}` : null,
    ].filter(Boolean);
    if (missing.length) push(`_Не сравниваются участники ${missing.join('; ')}._`, '');

    // Сводка по участникам: геометрическое среднее отношений по CPU-метрикам.
    const perLib = Object.fromEntries(libs.map((l) => [l, []]));
    const blocks = [];
    for (const s of sa.sections) {
      const prev = sb.sections.find((x) => x.phase === s.phase);
      const rows = s.rows.filter((r) => r.unit === 'мс');
      if (!rows.length) continue;
      const out = [
        `### ${s.title}`,
        '',
        `| Метрика, мс | ${libs.map(label).join(' | ')} |`,
        `|---|${libs.map(() => '---:').join('|')}|`,
      ];
      for (const r of rows) {
        const prevRow = prev?.rows.find((x) => x.metric === r.metric);
        const cpuMetric = CPU_TIME_METRICS.has(r.metric);
        const cells = libs.map((lib) => {
          const a = prevRow?.cells[lib]?.median;
          const b = r.cells[lib]?.median;
          if (!Number.isFinite(a) && !Number.isFinite(b)) return '—';
          if (!Number.isFinite(a) || !Number.isFinite(b)) return `${fmt(a)} → ${fmt(b)}`;
          const raw = positive(a) ? b / a : null;
          const normalized = raw !== null && factor ? raw / factor : null;
          if (cpuMetric && positive(a) && positive(b)) perLib[lib].push({ raw, normalized });
          const normText = normalized !== null ? ` · норм. ${ratioText(normalized)}` : '';
          return `${fmt(a)} → ${fmt(b)} ${ratioText(raw)}${normText}`.trim();
        });
        out.push(`| ${r.label}${cpuMetric ? '' : ' ≈'} | ${cells.join(' | ')} |`);
      }
      if (!prev) out.push('', '_Фазы нет в «было»._');
      out.push('');
      blocks.push(...out);
    }
    for (const prev of sb.sections)
      if (!sa.sections.some((s) => s.phase === prev.phase))
        blocks.push(`_Фаза «${prev.title}» есть только в «было»._`, '');

    push(
      'Сводка по участникам — геометрическое среднее отношений стало/было по метрикам чистого CPU-времени (JS, layout, обработка клавиши, монтирование):',
      '',
      '| Участник | Метрик | Стало/было | Норм. | Норм., min … max |',
      '|---|---:|---:|---:|---:|'
    );
    for (const lib of libs) {
      const list = perLib[lib];
      if (!list.length) continue;
      const normalized = list.map((x) => x.normalized).filter((x) => x !== null);
      push(
        `| ${label(lib)} | ${list.length} | ${ratioText(geomean(list.map((x) => x.raw)))} | ${normalized.length ? ratioText(geomean(normalized)) : '—'} | ${normalized.length ? `${ratioText(Math.min(...normalized))} … ${ratioText(Math.max(...normalized))}` : '—'} |`
      );
    }
    push('', ...blocks);
  }
}

const text = lines.join('\n');
console.log(text);
if (outFile) {
  writeFileSync(path.resolve(bases[0], outFile), text);
  console.error(`сравнение → ${path.resolve(bases[0], outFile)}`);
}

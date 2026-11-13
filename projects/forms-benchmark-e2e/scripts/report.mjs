#!/usr/bin/env node
/**
 * Отчёт бенчмарка: results/<run>/{phases,runs}.ndjson (+ отчёты бандла и кода приложения) →
 * results/_reports/<stamp>/{summary.json, report.md, report.html}. Свёртка прогонов — aggregate.mjs.
 *
 * Как читаются числа (BENCH-CONTRACT §7): прогон уже свёрнут (метрики в metrics.mjs), по прогонам —
 * медиана и IQR; отношение к лучшему в строке; значимость против ReFormer core — Mann–Whitney U с
 * поправкой Holm по всем сравнениям; различие меньше шума A/A-пары не считается различием. Числа —
 * сырые мс сессии; калибровка скорости машины (calibration.mjs) показывается отдельным разделом и
 * их не нормирует — нормировка только при сравнении отчётов (compare.mjs).
 *
 * Опции: --runs <dir>[,<dir>] (по умолчанию — последний прогон каждой формы), --publish (копия в
 * docs/benchmarks/forms/).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { holm } from './stats.mjs';
import { HEADLINE, NOTES } from './metrics.mjs';
import { renderHtml } from './report-html.mjs';
import {
  COMPARE_TO,
  CONTROL,
  LIB_ORDER,
  aggregate,
  e2eDir,
  latestRuns,
  resolveRuns,
  resultsDir,
} from './aggregate.mjs';
import {
  DRIFT_THRESHOLD,
  RUN_DRIFT_SHARE,
  describeFlags,
  pct,
  pctAbs,
  reportCalibration,
} from './calibration.mjs';
import { DIRTY_SHARE, describeBackgroundFlags, neighbourText } from './background.mjs';

const appDist = path.resolve(e2eDir, '../forms-benchmark/dist');
const repoRoot = path.resolve(e2eDir, '../..');

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

// ── Выбор прогонов и свёртка ─────────────────────────────────────────────────
const explicit = argValue('--runs');
const runs = explicit ? resolveRuns(explicit) : latestRuns();
if (!runs.length) {
  console.error('нет прогонов в results/ — сначала npm run bench');
  process.exit(1);
}
const { forms, comparisons } = aggregate(runs);

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
  /** Калибровка скорости машины по всему отчёту (формы обычно мерятся в разных сессиях). */
  calibration: reportCalibration(forms),
  bundle,
  code,
};

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
/** Подписи участников в калибровке: там есть и A/A-копия — она тоже занимает место в порядке. */
const calLabel = (lib) => (lib === CONTROL ? 'ReFormer core A/A' : (LABELS[lib] ?? lib));
const FORM_TITLES = { registration: 'регистрация с капчей', credit: 'кредитная заявка' };

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
  '- Числа — сырые миллисекунды этой сессии, без нормировки. Скорость машины в сессии и её дрейф — раздел «Калибровка скорости машины»; сравнение с отчётом другой сессии — `npm run bench:compare`.',
  '- Методика и правила честности: `projects/forms-benchmark/BENCH-CONTRACT.md`; поведение всех реализаций проверено conformance-тестами до замеров.',
  ''
);

for (const f of forms) {
  const libs = f.libs;
  const header = `| Метрика | ${libs.map((l) => LABELS[l] ?? l).join(' | ')} |`;
  const sep = `|---|${libs.map(() => '---:').join('|')}|`;
  push(`## Форма: ${FORM_TITLES[f.form] ?? f.form}`, '');
  if (f.failures.length) {
    push(
      `> ⚠️ Неудачных прогонов: ${f.failures.length} — они не входят в статистику (см. runs.ndjson).`,
      ''
    );
  }
  for (const [cpu, c] of Object.entries(f.calibration?.byCpu ?? {})) {
    if (!c.flags.length) continue;
    push(
      `> ⚠️ CPU ${cpu}x: скорость машины в этой сессии менялась больше порога ${pctAbs(DRIFT_THRESHOLD, 0)} — ${describeFlags(c).join('; ')}. Абсолютные числа менее надёжны, см. «Калибровка скорости машины».`,
      ''
    );
  }
  if (f.background?.flags.length) {
    push(
      `> ⚠️ Фоновая нагрузка: ${describeBackgroundFlags(f.background)}. Числа этой сессии шумные и несравнимы с прогонами на тихой машине, см. «Фоновая нагрузка».`,
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

pushCalibration();
pushBackground();

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
  '- Фоновая нагрузка на машине (раздел «Фоновая нагрузка») меняет числа сильнее, чем видит калибровка: инференс LLM, чужие браузеры и сборки конкурируют за GPU, память и композитор. Её снимок — только CPU-время процессов и моментальная загрузка GPU в начале и конце прогона; процессы, завершившиеся за прогон, не видны.',
  '- Абсолютные значения разных сессий напрямую несравнимы даже на одной машине: у baseline (тот же код) они расходились до 1.6× между прогонами одного дня при одинаковой фоновой нагрузке (частота и тепловой режим CPU). Поэтому в начале и в конце каждого прогона идёт калибровочная нагрузка: раздел «Калибровка скорости машины» показывает дрейф внутри сессии, а `npm run bench:compare` сравнивает два отчёта и в сырых миллисекундах, и с нормировкой по калибровке. Нормировка приблизительна: метрики с таймерами, сетью и кадрами зависят от скорости CPU лишь частично, а частота меняет разные виды работы неодинаково. Внутри одного отчёта сравнивайте отношения: участники в прогоне чередуются в перемешанном порядке, поэтому дрейф ложится на всех одинаково.',
  '- Реализации конкурентов написаны по официальной документации независимо от кода ReFormer; отклонения каждой — в `projects/forms-benchmark/src/libs/<lib>/README.md`.',
  ''
);

// ── Калибровка скорости машины ───────────────────────────────────────────────
function pushCalibration() {
  push('## Калибровка скорости машины', '');
  const total = summary.calibration;
  if (!total) {
    push(
      '_В прогонах нет калибровки (сняты до её появления, ReFormer-q6ny): дрейф скорости машины не измерен._',
      ''
    );
    return;
  }
  const workload = forms.find((f) => f.env.calibration?.workload)?.env.calibration.workload;
  push(
    `В начале и в конце каждого прогона — одна и та же детерминированная JS-нагрузка${workload ? ` \`${workload.id}\` (${workload.reps} повторов после ${workload.warmup} прогревочных, медиана)` : ''}: объекты полей, строки, regex, мелкие сортировки, spread-копии состояния, JSON. Она идёт на пустой странице той же вкладки под тем же троттлингом CPU, вне окон замера. Её время — мера скорости машины в момент прогона; значение прогона — среднее начала и конца. Таблицы отчёта ею **не нормируются** — она показывает дрейф и нужна для сравнения отчётов разных сессий (\`npm run bench:compare\`).`,
    '',
    `Порог сноски — ${pctAbs(DRIFT_THRESHOLD, 0)}: собственный шум калибровки на тихой машине — 1–3 %, а типичный разброс временных метрик между прогонами — около 5 % (медиана CV), шум A/A — до 7 % (p90); дрейф вдвое больше этого разброса — уже смена режима машины (частота, тепловой режим, энергоэффективные ядра), и перемешанный порядок итераций не гарантирует, что дрейф лёг на участников поровну. Дрейф внутри прогона попадает в сноску, если порог превышен больше чем в ${pctAbs(RUN_DRIFT_SHARE, 0)} прогонов: одиночный скачок медиану по итерациям не сдвигает.`,
    '',
    '| Сессия | CPU | Прогонов | Медиана, мс | Разброс p10–p90 | Первая → последняя итерация | Дрейф в прогоне: медиана / max |',
    '|---|---|---:|---:|---:|---:|---:|'
  );
  for (const f of forms) {
    for (const [cpu, c] of Object.entries(f.calibration?.byCpu ?? {})) {
      const flag = c.flags.length ? ' ⚠️' : '';
      push(
        `| ${FORM_TITLES[f.form] ?? f.form} (\`${f.runId}\`)${flag} | ${cpu}x | ${c.n} | ${fmt(c.median, 'мс')} | ${pctAbs(c.spread)} | ${pct(c.trend)} | ${pct(c.runDrift.median)} / ${pctAbs(c.runDrift.maxAbs)} |`
      );
    }
  }
  for (const [cpu, c] of Object.entries(total.byCpu)) {
    if (Object.keys(c.formMedians).length < 2) continue;
    push(
      `| **весь отчёт**${c.flags.length ? ' ⚠️' : ''} | ${cpu}x | ${c.n} | ${fmt(c.median, 'мс')} | ${pctAbs(c.spread)} | — | — |`
    );
  }
  push('');
  const notes = [];
  for (const f of forms)
    for (const [cpu, c] of Object.entries(f.calibration?.byCpu ?? {}))
      if (c.flags.length)
        notes.push(`${FORM_TITLES[f.form] ?? f.form}, CPU ${cpu}x: ${describeFlags(c).join('; ')}`);
  for (const [cpu, c] of Object.entries(total.byCpu))
    if (c.flags.length) notes.push(`весь отчёт, CPU ${cpu}x: ${describeFlags(c).join('; ')}`);
  if (notes.length) {
    push(
      `> ⚠️ Дрейф скорости машины больше порога ${pctAbs(DRIFT_THRESHOLD, 0)}: ${notes.join('. ')}. Абсолютные числа таких сессий менее надёжны; отношения внутри отчёта страдают меньше, но разброс по прогонам у всех участников выше. Сравнение с другими отчётами — только с нормировкой (\`npm run bench:compare\`).`,
      ''
    );
  } else {
    push(`_Дрейф в пределах порога ${pctAbs(DRIFT_THRESHOLD, 0)}._`, '');
  }

  for (const f of forms) {
    for (const [cpu, c] of Object.entries(f.calibration?.byCpu ?? {})) {
      const libs = Object.keys(c.libs);
      if (!libs.length) continue;
      const head = `| | ${libs.map(calLabel).join(' | ')} |`;
      const sep = `|---|${libs.map(() => '---:').join('|')}|`;
      const row = (label, get) => `| ${label} | ${libs.map((l) => get(c.libs[l])).join(' | ')} |`;
      push(
        `### ${FORM_TITLES[f.form] ?? f.form}, CPU ${cpu}x`,
        '',
        'По участникам (без прогрева):',
        '',
        head,
        sep,
        row('Медиана калибровки, мс', (s) => fmt(s.median, 'мс')),
        row('К медиане сессии', (s) => pct(s.vsSession)),
        row('Начало прогона, мс', (s) => fmt(s.start, 'мс')),
        row('Конец прогона, мс', (s) => fmt(s.end, 'мс')),
        row('Дрейф в прогоне, медиана', (s) => pct(s.drift)),
        row('Дрейф в прогоне, наибольший по модулю', (s) => pctAbs(s.driftMaxAbs)),
        '',
        'По порядку прогонов: калибровка прогона, мс (в скобках — дрейф от начала к концу прогона):',
        '',
        `| Итерация | ${libs.map(calLabel).join(' | ')} | Медиана |`,
        `|---|${libs.map(() => '---:').join('|')}|---:|`
      );
      for (const it of c.iterations) {
        const cells = libs.map((l) => {
          const x = it.cells[l];
          return x ? `${fmt(x.value, 'мс')} (${pct(x.drift, 0)})` : '—';
        });
        push(
          `| ${it.iteration + 1}${it.warmup ? ' (прогрев)' : ''} | ${cells.join(' | ')} | ${fmt(it.median, 'мс')} |`
        );
      }
      push('');
    }
  }
}

// ── Фоновая нагрузка ─────────────────────────────────────────────────────────
function pushBackground() {
  push('## Фоновая нагрузка', '');
  if (!forms.some((f) => f.background)) {
    push(
      '_В прогонах нет замеров фоновой нагрузки (сняты до их появления): что ещё работало на машине, неизвестно._',
      ''
    );
    return;
  }
  const t = forms.find((f) => f.env.background?.thresholds)?.env.background.thresholds;
  push(
    'Калибровка ловит частоту и тепловой режим CPU, но не соседей: инференс LLM, чужие браузеры и сборки конкурируют за GPU, память и композитор и бьют по DOM, layout и отрисовке сильнее, чем по JS. Поэтому в начале и в конце каждого прогона (в точках калибровки, вне окон замера) снимается список процессов: доля CPU процесса — приращение его CPU-времени за прогон к длительности прогона; дерево самого бенча исключено. На macOS добавляется загрузка GPU — моментальная, в точках замера, когда страница бенча пуста.',
    '',
    `Прогон «грязный», если занят тяжёлый сосед${t ? ` (Ollama и чужие автоматизированные браузеры — от ${t.ollamaPct} % ядра, инструменты на Node, десктопные браузеры и Docker/VM — от ${t.toolingPct} %, прочий процесс — от ${t.otherPct} %, GPU — от ${t.gpuPct} %)` : ''} или чужая нагрузка в сумме${t ? ` от ${t.foreignCores} ядра` : ''}: бенч сам занимает 1–2 ядра, и ещё целое ядро соседей уводит его потоки на энергоэффективные ядра. Сессия помечается, если грязных прогонов больше ${pctAbs(DIRTY_SHARE, 0)}: короткий всплеск медиану по итерациям не сдвигает.`,
    '',
    '| Сессия | Прогонов | Чужая нагрузка, ядер: медиана / max | GPU, %: медиана / max | Бенч сам, ядер | «Грязных» прогонов | Пред-проверка |',
    '|---|---:|---:|---:|---:|---:|---|'
  );
  for (const f of forms) {
    const bg = f.background;
    const title = `${FORM_TITLES[f.form] ?? f.form} (\`${f.runId}\`)`;
    if (!bg) {
      push(`| ${title} | — | — | — | — | — | нет замеров |`);
      continue;
    }
    const pre = bg.preflight
      ? bg.preflight.dirty
        ? `занята: ${bg.preflight.reasons.join('; ')}`
        : `свободна (${bg.preflight.foreignCores} ядра)`
      : '—';
    if (!bg.n) {
      push(`| ${title} | 0 | — | — | — | — | ${pre} |`);
      continue;
    }
    push(
      `| ${title}${bg.flags.length ? ' ⚠️' : ''} | ${bg.n} | ${fmt(bg.foreignCores.median, '')} / ${fmt(bg.foreignCores.max, '')} | ${bg.gpu ? `${bg.gpu.median.toFixed(0)} / ${bg.gpu.max.toFixed(0)}` : '—'} | ${fmt(bg.ownCores, '')} | ${bg.dirtyRuns} из ${bg.n} | ${pre} |`
    );
  }
  push('');
  for (const f of forms) {
    const bg = f.background;
    if (!bg?.n || !bg.neighbours.length) continue;
    push(`Тяжёлые соседи, ${FORM_TITLES[f.form] ?? f.form}:`, '');
    for (const n of bg.neighbours) push(`- ${neighbourText(n, bg.n)}`);
    push('');
  }
  const flagged = forms.filter((f) => f.background?.flags.length);
  if (flagged.length) {
    push(
      `> ⚠️ Фоновая нагрузка выше порога: ${flagged.map((f) => `${FORM_TITLES[f.form] ?? f.form} — ${describeBackgroundFlags(f.background)}`).join('. ')}. Соседи нагружают GPU, память и композитор, а калибровка (чистый JS) этого почти не видит — нормировка \`bench:compare\` такие сессии не выправляет. Перед долгим прогоном проверьте машину: \`npm run bench:idle-check\`; \`BENCH_REQUIRE_IDLE=1\` не даст начать замеры на занятой машине.`,
      ''
    );
  } else {
    push('_Фоновая нагрузка в пределах порога._', '');
  }
}

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

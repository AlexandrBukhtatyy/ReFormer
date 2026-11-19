/**
 * Трейсы во времени: JS heap, DOM-узлы и обработчики событий по участникам — три графика стопкой, у
 * каждого своя ось Y (двух шкал на одном графике нет). Ось X общая: окно замера каждой фазы —
 * полоса шириной самого долгого участника, за ним промежуток до следующей фазы, поэтому «шаг 1»
 * одной библиотеки стоит напротив «шага 1» другой.
 *
 * Данные (~110 КБ) грузятся отдельным чанком после монтирования: в HTML страницы — только рамки
 * фиксированной высоты, подписи и легенда, раскладка не прыгает. Перекрестье общее для трёх
 * графиков; оно и подсказка — слой поверх линий, движение курсора пути не перерисовывает.
 */
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
  type ReactNode,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import Translate, { translate } from '@docusaurus/Translate';
import { LIB_ORDER, isDashed, libStyle } from './colors';
import { type BenchText, useBenchText } from './i18n';
import {
  CURSOR_STEPS,
  type Lines,
  VB_H,
  VB_W,
  decodeLines,
  lastValue,
  niceMax,
  pathOf,
  phaseAt,
  spreadLabels,
  tickText,
  valueAt,
} from './traceGeometry';
import {
  type BenchForm,
  type TraceData,
  type TraceForm,
  type TraceMetric,
  libLabel,
} from './types';
import bench from './bench.module.css';
import styles from './traces.module.css';

/** Высота области графика, px — та же, что `--plot-h` в traces.module.css (подписи на концах). */
const PLOT_PX = 132;
/** Мин. расстояние между подписями на концах линий, px. */
const LABEL_GAP = 14;

interface MetricDef {
  id: TraceMetric;
  unit: string;
  digits: number;
  title: () => string;
}

const METRICS: MetricDef[] = [
  {
    id: 'heap',
    unit: 'МБ',
    digits: 1,
    title: () => translate({ id: 'benchmark.traces.metric.heap', message: 'JS heap' }),
  },
  {
    id: 'nodes',
    unit: '',
    digits: 0,
    title: () => translate({ id: 'benchmark.traces.metric.nodes', message: 'DOM-узлы' }),
  },
  {
    id: 'listeners',
    unit: '',
    digits: 0,
    title: () =>
      translate({ id: 'benchmark.traces.metric.listeners', message: 'Обработчики событий' }),
  },
];

const fmtValue = (v: number | null, m: MetricDef, t: BenchText) =>
  v === null ? '—' : `${v.toFixed(m.digits)}${m.unit ? ` ${t.unit(m.unit)}` : ''}`;

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: TraceData };

/** Файл трейсов один на обе вкладки форм — грузится один раз. */
let pending: Promise<TraceData> | null = null;
function loadTraces(): Promise<TraceData> {
  pending ??= import('@site/src/data/forms-benchmark-traces.json').then((m) => m.default);
  return pending;
}

export default function TraceCharts({
  form,
  measuredRuns,
}: {
  form: BenchForm;
  /** Прогоны отчёта на странице — трейсы, записанные для другого отчёта, помечаются. */
  measuredRuns: string[];
}): ReactNode {
  const t = useBenchText();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadTraces().then(
      (data) => alive && setLoad({ status: 'ready', data }),
      () => alive && setLoad({ status: 'error' })
    );
    return () => {
      alive = false;
    };
  }, []);

  const trace =
    load.status === 'ready' ? (load.data.forms.find((f) => f.id === form.id) ?? null) : null;
  const stale =
    load.status === 'ready' && load.data.measuredRuns.join() !== [...measuredRuns].join();
  const libs = trace ? LIB_ORDER.filter((lib) => trace.libs[lib]) : [...LIB_ORDER];
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className={styles.trace}>
      <ul className={clsx(bench.legend, styles.legend)}>
        {libs.map((lib) => (
          <li key={lib} style={libStyle(lib)}>
            <button
              type="button"
              className={clsx(styles.legendButton, active === lib && styles.legendActive)}
              onPointerEnter={() => setActive(lib)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(lib)}
              onBlur={() => setActive(null)}
              aria-pressed={active === lib}
            >
              <span
                className={clsx(bench.swatchLine, isDashed(lib) && bench.swatchBaseline)}
                aria-hidden="true"
              />
              {libLabel(lib)}
            </button>
          </li>
        ))}
        <li className={styles.legendHint}>
          <Translate id="benchmark.traces.legendHint">
            наведите на имя — линия участника выделится
          </Translate>
        </li>
      </ul>
      {trace ? (
        <TracePlots trace={trace} libs={libs} active={active} form={form} t={t} />
      ) : (
        <div className={styles.scroll}>
          <div className={styles.inner}>
            {METRICS.map((m) => (
              <div key={m.id} className={styles.block}>
                <div className={styles.chartTitle}>
                  {m.title()}
                  {m.unit && <span className={styles.chartUnit}>, {t.unit(m.unit)}</span>}
                </div>
                <div className={styles.row}>
                  <span />
                  <div className={clsx(styles.plot, styles.plotEmpty)}>
                    {load.status === 'loading' ? (
                      <Translate id="benchmark.traces.loading">Загрузка графика…</Translate>
                    ) : (
                      <Translate id="benchmark.traces.missing">
                        Трейсов для этой формы нет — значения есть в таблицах выше.
                      </Translate>
                    )}
                  </div>
                  <span />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {trace && <SourceNote trace={trace} stale={stale} t={t} />}
      {trace && <PhaseLegend trace={trace} form={form} t={t} />}
      {trace && <StatsTable trace={trace} libs={libs} t={t} />}
    </div>
  );
}

interface Cursor {
  step: number;
  /** Позиция подсказки по вертикали, px от верха слоя. */
  y: number;
}

function TracePlots({
  trace,
  libs,
  active,
  form,
  t,
}: {
  trace: TraceForm;
  libs: string[];
  active: string | null;
  form: BenchForm;
  t: BenchText;
}): ReactNode {
  const lines = useMemo(() => decodeLines(trace), [trace]);
  const yMax = useMemo(
    () =>
      Object.fromEntries(
        METRICS.map((m) => [
          m.id,
          niceMax(Math.max(0, ...libs.map((lib) => trace.stats[lib]?.[m.id]?.[0] ?? 0))),
        ])
      ) as Record<TraceMetric, number>,
    [trace, libs]
  );
  const plotRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);

  const frac = cursor ? (cursor.step + 0.5) / CURSOR_STEPS : 0;
  const x = frac * trace.total;
  const hit = cursor ? phaseAt(trace.phases, x) : null;

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const plot = plotRef.current?.getBoundingClientRect();
    const layer = layerRef.current?.getBoundingClientRect();
    if (!plot || !layer || !plot.width) return;
    const f = (e.clientX - plot.left) / plot.width;
    if (f < 0 || f > 1) {
      setCursor(null);
      return;
    }
    setCursor({
      step: Math.min(CURSOR_STEPS - 1, Math.floor(f * CURSOR_STEPS)),
      y: e.clientY - layer.top,
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = cursor?.step ?? -1;
    const by = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(CURSOR_STEPS - 1, step + by);
    else if (e.key === 'ArrowLeft') next = Math.max(0, (step < 0 ? CURSOR_STEPS : step) - by);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = CURSOR_STEPS - 1;
    else if (e.key === 'Escape') {
      setCursor(null);
      return;
    } else return;
    e.preventDefault();
    setCursor({ step: next, y: 24 });
  };

  // Текст подсказки для экранного диктора — с задержкой, чтобы не зачитывать каждый шаг.
  const [spoken, setSpoken] = useState('');
  const tipText = cursor ? tooltipText(trace, lines, libs, x, hit, form, t) : '';
  useEffect(() => {
    const id = setTimeout(() => setSpoken(tipText), 250);
    return () => clearTimeout(id);
  }, [tipText]);

  const layerStyle = { '--cx': `${frac * 100}%` } as CSSProperties;
  return (
    <div className={styles.scroll}>
      <div
        ref={layerRef}
        className={styles.inner}
        style={layerStyle}
        data-cursor={cursor ? '' : undefined}
        tabIndex={0}
        role="group"
        aria-label={translate(
          {
            id: 'benchmark.traces.aria',
            message:
              'Графики трейсов: {form}. Стрелки влево и вправо двигают курсор, Shift — на 10 шагов, Home и End — к краям, Esc — скрыть.',
          },
          { form: t.formTitle(form) }
        )}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setCursor(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setCursor(null)}
      >
        <PhaseRuler trace={trace} />
        {METRICS.map((m, i) => (
          <TraceChart
            key={m.id}
            metric={m}
            title={m.title()}
            unitLabel={t.unit(m.unit)}
            lines={lines}
            libs={libs}
            trace={trace}
            yMax={yMax[m.id]}
            active={active}
            plotRef={i === 0 ? plotRef : undefined}
          />
        ))}
        {cursor && (
          <Tooltip
            trace={trace}
            lines={lines}
            libs={libs}
            x={x}
            frac={frac}
            y={cursor.y}
            hit={hit}
            form={form}
            t={t}
          />
        )}
        <div className={styles.srOnly} aria-live="polite">
          {spoken}
        </div>
      </div>
    </div>
  );
}

/** Номера фаз над графиками — над серединой окна, если не налезают на предыдущий. */
function PhaseRuler({ trace }: { trace: TraceForm }): ReactNode {
  let last = -Infinity;
  const marks: Array<{ n: number; at: number }> = [];
  trace.phases.forEach((p, i) => {
    const at = ((p.offset + p.width / 2) / trace.total) * 100;
    const room = 1.6 * String(i + 1).length + 1.6;
    if (at - last >= room) {
      marks.push({ n: i + 1, at });
      last = at;
    }
  });
  return (
    <div className={styles.row} aria-hidden="true">
      <span />
      <div className={styles.ruler}>
        {marks.map((m) => (
          <span key={m.n} style={{ left: `${m.at}%` }}>
            {m.n}
          </span>
        ))}
      </div>
      <span />
    </div>
  );
}

interface ChartProps {
  metric: MetricDef;
  title: string;
  unitLabel: string;
  lines: Lines;
  libs: string[];
  trace: TraceForm;
  yMax: number;
  active: string | null;
  plotRef?: Ref<HTMLDivElement>;
}

const TraceChart = memo(function TraceChart({
  metric,
  title,
  unitLabel,
  lines,
  libs,
  trace,
  yMax,
  active,
  plotRef,
}: ChartProps): ReactNode {
  const paths = useMemo(
    () =>
      Object.fromEntries(
        libs.map((lib) => [lib, pathOf(lines[lib]?.[metric.id] ?? [], trace.total, yMax)])
      ),
    [lines, libs, metric.id, trace.total, yMax]
  );
  const ends = useMemo(
    () =>
      spreadLabels(
        libs
          .map((lib) => ({ lib, v: lastValue(lines[lib]?.[metric.id] ?? []) }))
          .filter((e): e is { lib: string; v: number } => e.v !== null)
          .map((e) => ({ ...e, y: (1 - e.v / yMax) * PLOT_PX })),
        LABEL_GAP,
        PLOT_PX
      ),
    [lines, libs, metric.id, yMax]
  );
  // baseline — снизу, ReFormer core — поверх всех.
  const order = [...libs].reverse();
  return (
    <div className={styles.block}>
      <div className={styles.chartTitle}>
        {title}
        {unitLabel && <span className={styles.chartUnit}>, {unitLabel}</span>}
      </div>
      <div className={styles.row}>
        <div className={styles.ticks} aria-hidden="true">
          {[yMax, yMax / 2, 0].map((v, i) => (
            <span key={i} style={{ top: `${(i / 2) * 100}%` }}>
              {tickText(v)}
            </span>
          ))}
        </div>
        <div ref={plotRef} className={styles.plot}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className={clsx(styles.svg, active && styles.dimmed)}
            aria-hidden="true"
          >
            {trace.phases.map((p) => (
              <rect
                key={p.id}
                className={styles.band}
                x={(p.offset / trace.total) * VB_W}
                y={0}
                width={Math.max(1, (p.width / trace.total) * VB_W)}
                height={VB_H}
              />
            ))}
            {[0, VB_H / 2, VB_H].map((y) => (
              <line key={y} className={styles.grid} x1={0} x2={VB_W} y1={y} y2={y} />
            ))}
            {order.map((lib) => (
              <path
                key={lib}
                d={paths[lib]}
                style={libStyle(lib)}
                className={clsx(
                  styles.line,
                  isDashed(lib) && styles.lineDashed,
                  active === lib && styles.lineActive
                )}
              />
            ))}
          </svg>
          <span className={styles.crosshair} aria-hidden="true" />
        </div>
        <div className={styles.ends} aria-hidden="true">
          {ends.map((e) => (
            <span
              key={e.lib}
              style={{ ...libStyle(e.lib), top: `${e.y}px` }}
              className={clsx(active && active !== e.lib && styles.endDim)}
            >
              <span className={clsx(bench.swatchLine, isDashed(e.lib) && bench.swatchBaseline)} />
              {shortLabel(e.lib)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

/** Подписи на концах линий — короткие: колонка справа узкая. */
const shortLabel = (lib: string) =>
  lib === 'reformer-core' ? 'core' : lib === 'reformer-json' ? 'JSON' : libLabel(lib);

function phaseLine(hit: ReturnType<typeof phaseAt>, form: BenchForm, t: BenchText): string {
  if (!hit) return '';
  const title = t.phaseTitle(form, hit.phase.id, hit.phase.title);
  const ms = Math.round(hit.since);
  return hit.inWindow
    ? translate(
        { id: 'benchmark.traces.tip.phase', message: '{n}. {title} · +{ms} мс от начала фазы' },
        { n: hit.index + 1, title, ms }
      )
    : translate(
        { id: 'benchmark.traces.tip.gap', message: 'после фазы {n} ({title}) — вне замера' },
        { n: hit.index + 1, title }
      );
}

function tooltipText(
  trace: TraceForm,
  lines: Lines,
  libs: string[],
  x: number,
  hit: ReturnType<typeof phaseAt>,
  form: BenchForm,
  t: BenchText
): string {
  const rows = libs.map(
    (lib) =>
      `${libLabel(lib)}: ${METRICS.map((m) => `${m.title()} ${fmtValue(valueAt(lines[lib]?.[m.id] ?? [], x), m, t)}`).join(', ')}`
  );
  return [phaseLine(hit, form, t), ...rows].filter(Boolean).join('. ');
}

function Tooltip({
  lines,
  libs,
  x,
  frac,
  y,
  hit,
  form,
  t,
}: {
  trace: TraceForm;
  lines: Lines;
  libs: string[];
  x: number;
  frac: number;
  y: number;
  hit: ReturnType<typeof phaseAt>;
  form: BenchForm;
  t: BenchText;
}): ReactNode {
  const right = frac > 0.55;
  return (
    <div
      className={styles.tooltip}
      aria-hidden="true"
      style={{
        left: `calc(var(--gl) + (100% - var(--gl) - var(--gr)) * ${frac})`,
        top: `${Math.max(0, y - 12)}px`,
        transform: right ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
      }}
    >
      <div className={clsx(styles.tipHead, hit && !hit.inWindow && styles.tipGap)}>
        {phaseLine(hit, form, t)}
      </div>
      <table className={styles.tipTable}>
        <thead>
          <tr>
            <th />
            {METRICS.map((m) => (
              <th key={m.id}>
                {m.title()}
                {m.unit && `, ${t.unit(m.unit)}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {libs.map((lib) => (
            <tr key={lib} style={libStyle(lib)}>
              <th scope="row">
                <span className={clsx(bench.swatchLine, isDashed(lib) && bench.swatchBaseline)} />
                {libLabel(lib)}
              </th>
              {METRICS.map((m) => {
                const v = valueAt(lines[lib]?.[m.id] ?? [], x);
                return <td key={m.id}>{v === null ? '—' : v.toFixed(m.digits)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceNote({
  trace,
  stale,
  t,
}: {
  trace: TraceForm;
  stale: boolean;
  t: BenchText;
}): ReactNode {
  const date = trace.builtAt
    ? new Intl.DateTimeFormat(t.isEn ? 'en-US' : 'ru-RU', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(new Date(trace.builtAt))
    : '—';
  const values = {
    traceRun: <code>{trace.traceRun}</code>,
    run: <code>{trace.run ?? '—'}</code>,
    sha: <code>{trace.sha ?? '—'}</code>,
    date,
    cpu: trace.cpu ?? '—',
  };
  return (
    <div className={styles.notes}>
      <p>
        {trace.traceRun === trace.run ? (
          <Translate id="benchmark.traces.sourceSame" values={values}>
            {
              'Графики — один трассируемый проход на участника из прогона {run}, CPU {cpu}x: это не медиана, а форма кривой. Точные числа — в таблицах выше.'
            }
          </Translate>
        ) : trace.sameBuild === false ? (
          <Translate id="benchmark.traces.sourceOtherBuild" values={values}>
            {
              '⚠️ Графики — один трассируемый проход на участника из прогона {traceRun} на другой сборке страниц (git {sha}, собрана {date}), CPU {cpu}x; числа таблиц — медианы прогона {run}. Формы могли измениться между сборками.'
            }
          </Translate>
        ) : (
          <Translate id="benchmark.traces.source" values={values}>
            {
              'Графики — один трассируемый проход на участника из отдельного прогона {traceRun} на той же сборке страниц (git {sha}, собрана {date}), CPU {cpu}x: это не медиана, а форма кривой. Числа таблиц — медианы прогона {run}.'
            }
          </Translate>
        )}
      </p>
      {stale && (
        <p>
          <Translate id="benchmark.traces.stale">
            ⚠️ Трейсы записаны для предыдущего отчёта — числа таблиц на странице новее.
          </Translate>
        </p>
      )}
      {trace.unmarked.length > 0 && (
        <p>
          <Translate
            id="benchmark.traces.unmarked"
            values={{ list: trace.unmarked.map(libLabel).join(', ') }}
          >
            {'Без меток фаз в трассе (не показаны): {list}.'}
          </Translate>
        </p>
      )}
    </div>
  );
}

/** Номера фаз на оси → названия; фазы без трассы — отдельной строкой. */
function PhaseLegend({
  trace,
  form,
  t,
}: {
  trace: TraceForm;
  form: BenchForm;
  t: BenchText;
}): ReactNode {
  const traced = new Set(trace.phases.map((p) => p.id));
  const untraced = form.sections.filter((s) => !traced.has(s.id));
  return (
    <details className={styles.more}>
      <summary>
        <Translate id="benchmark.traces.phases" values={{ n: trace.phases.length }}>
          {'Фазы на оси ({n})'}
        </Translate>
      </summary>
      <ol className={styles.phaseList}>
        {trace.phases.map((p) => (
          <li key={p.id}>{t.phaseTitle(form, p.id, p.title)}</li>
        ))}
      </ol>
      {untraced.length > 0 && (
        <p className={styles.notes}>
          <Translate
            id="benchmark.traces.untraced"
            values={{
              list: untraced.map((s) => t.phaseTitle(form, s.id, s.title)).join('; '),
            }}
          >
            {'Не трассировались (отдельная загрузка страницы): {list}.'}
          </Translate>
        </p>
      )}
    </details>
  );
}

/** Точные значения: пик и конец по полной трассе — табличная замена графикам. */
function StatsTable({
  trace,
  libs,
  t,
}: {
  trace: TraceForm;
  libs: string[];
  t: BenchText;
}): ReactNode {
  return (
    <details className={styles.more}>
      <summary>
        <Translate id="benchmark.traces.table">Таблица: пик и конец трассы</Translate>
      </summary>
      <div className={styles.tableWrap}>
        <table className={styles.statsTable}>
          <thead>
            <tr>
              <th rowSpan={2}>
                <Translate id="benchmark.traces.col.lib">Участник</Translate>
              </th>
              {METRICS.map((m) => (
                <th key={m.id} colSpan={2}>
                  {m.title()}
                  {m.unit && `, ${t.unit(m.unit)}`}
                </th>
              ))}
            </tr>
            <tr>
              {METRICS.map((m) => [
                <th key={`${m.id}-max`}>
                  <Translate id="benchmark.traces.col.peak">пик</Translate>
                </th>,
                <th key={`${m.id}-end`}>
                  <Translate id="benchmark.traces.col.end">в конце</Translate>
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {libs.map((lib) => (
              <tr key={lib}>
                <th scope="row">{libLabel(lib)}</th>
                {METRICS.map((m) => {
                  const [max, end] = trace.stats[lib]?.[m.id] ?? [null, null];
                  const d = m.id === 'heap' ? 2 : 0;
                  return [
                    <td key={`${m.id}-max`}>{max === null ? '—' : max.toFixed(d)}</td>,
                    <td key={`${m.id}-end`}>{end === null ? '—' : end.toFixed(d)}</td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

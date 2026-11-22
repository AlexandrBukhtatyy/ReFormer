/**
 * Графики страницы «Замеры: с MCP и без» по отдельным прогонам (`runs` в
 * `src/data/mcp-benchmark*.json`): разброс прогонов по сериям, время × стоимость и карта сценариев.
 * Сводки рисует McpBenchmark.tsx, выбор моделей и вид страницы — models.ts.
 *
 * SVG без библиотек. Ширину графика задаёт контейнер (ResizeObserver): подписи остаются читаемыми
 * от телефона до десктопа, а не масштабируются вместе с картинкой. Плечо кодирует форма значка и
 * подпись, пройден ли прогон — заливка: смысл не держится на одном цвете. Цвет значка — плечо для
 * одной модели и модель для нескольких; наведение на модель приглушает остальные до 15%. Диаграмма
 * рассеяния при нескольких моделях делится на панели по модели, и цвет в них снова плечо.
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import clsx from 'clsx';
import {
  ARM_LABELS,
  Choice,
  ModelPicker,
  STACKS,
  ScopeNote,
  TITLES_EN,
  fmtMinutes,
  fmtTokens,
  fmtUsd,
  hoverProps,
  seriesColor,
  seriesFill,
  seriesLabel,
  dimmer,
  useLang,
  type Lang,
} from './McpBenchmark';
import {
  ALL,
  MODELS,
  runsOf,
  scenarioCell,
  scenarioMeta,
  scenariosOf,
  useScope,
  useView,
  type ModelInfo,
  type ModelRun,
  type Scope,
  type Series,
  type View,
} from './models';
import type { ArmId, Operation } from './types';
import styles from './mcp-charts.module.css';
import base from './mcp-benchmark.module.css';

const TEXT = {
  ru: {
    metric: 'Показатель',
    minutes: 'Время прогона',
    cost: 'Стоимость прогона',
    output: 'Выходные токены',
    unit: { minutes: 'мин', cost: '', output: '' },
    median: 'медиана',
    p90: '90% прогонов ≤',
    max: 'максимум',
    passed: 'пройден',
    failed: 'не пройден',
    passedLegend: 'прогон пройден',
    failedLegend: 'не пройден',
    medianLegend: 'медиана серии',
    table: 'Таблица',
    arm: 'Плечо',
    series: 'Модель · плечо',
    score: 'счёт',
    steps: 'шагов',
    tokens: 'выходных токенов',
    repeat: (n: number) => `повтор ${n}`,
    all: 'Все задачи',
    kinds: { create: 'Создание', edit: 'Правка', delete: 'Удаление' } as Record<Operation, string>,
    yAxis: 'Ось Y',
    timeAxis: 'время прогона, мин (лог. шкала)',
    costAxis: 'стоимость, $ (лог. шкала)',
    outputAxis: 'выходные токены (лог. шкала)',
    noCost: (models: string) => `без стоимости, их прогонов здесь нет: ${models}`,
    shown: (n: number) => `прогонов на графике: ${n}`,
    total: 'Всего',
    allPassed: 'все прогоны прошли',
    somePassed: 'часть прошла',
    nonePassed: 'ни один не прошёл',
    notRun: 'не мерили',
    stack: 'Стек',
    allStacks: 'Все',
    scenario: 'Сценарий',
    spreadLabel: 'Разброс прогонов по сериям',
    scatterLabel: 'Время и стоимость каждого прогона',
  },
  en: {
    metric: 'Metric',
    minutes: 'Run time',
    cost: 'Run cost',
    output: 'Output tokens',
    unit: { minutes: 'min', cost: '', output: '' },
    median: 'median',
    p90: '90% of runs ≤',
    max: 'max',
    passed: 'passed',
    failed: 'failed',
    passedLegend: 'run passed',
    failedLegend: 'failed',
    medianLegend: 'median of the series',
    table: 'Table',
    arm: 'Arm',
    series: 'Model · arm',
    score: 'score',
    steps: 'steps',
    tokens: 'output tokens',
    repeat: (n: number) => `repeat ${n}`,
    all: 'All tasks',
    kinds: { create: 'Create', edit: 'Edit', delete: 'Remove' } as Record<Operation, string>,
    yAxis: 'Y axis',
    timeAxis: 'run time, min (log scale)',
    costAxis: 'cost, $ (log scale)',
    outputAxis: 'output tokens (log scale)',
    noCost: (models: string) => `no cost, their runs are not here: ${models}`,
    shown: (n: number) => `runs on the chart: ${n}`,
    total: 'Total',
    allPassed: 'every run passed',
    somePassed: 'some passed',
    nonePassed: 'none passed',
    notRun: 'not measured',
    stack: 'Stack',
    allStacks: 'All',
    scenario: 'Scenario',
    spreadLabel: 'Spread of runs by series',
    scatterLabel: 'Time and cost of every run',
  },
} as const;

/** Форма значка плеча — тот же знак в легенде, разбросе и диаграмме рассеяния. */
const ARM_SHAPE: Record<ArmId, 'circle' | 'square'> = {
  'no-mcp': 'circle',
  'mcp-dsl': 'square',
};
const ARM_COLOR: Record<ArmId, string> = {
  'no-mcp': 'var(--mc-none)',
  'mcp-dsl': 'var(--mc-dsl)',
};
/** Значок плеча без цвета модели — в легенде режима «все модели». */
const NEUTRAL = 'var(--mc-muted)';

const modelById = (id: string) => MODELS.find((model) => model.id === id);

/** Цвет значка: плечо — для одной модели, модель — для всех вместе. */
const colorOf = (view: View, modelId: string, arm: ArmId): string =>
  view.all ? (modelById(modelId)?.color ?? NEUTRAL) : ARM_COLOR[arm];

// ---------- помощники ----------

/** Ширина контейнера; до первого замера (и при рендере на сервере) — запасная. */
function useWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

const quantile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1)))] ?? 0;
};

function niceLinearTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 1e-6; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Деления логарифмической шкалы: 1, 2, 5 в каждой декаде внутри диапазона. */
function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let decade = Math.floor(Math.log10(min)); decade <= Math.ceil(Math.log10(max)); decade++) {
    for (const m of [1, 2, 5]) {
      const value = m * 10 ** decade;
      if (value >= min && value <= max) ticks.push(value);
    }
  }
  return ticks;
}

const scenarioTitle = (id: string, lang: Lang): string =>
  lang === 'en' ? (TITLES_EN[id] ?? id) : (scenarioMeta(id)?.title ?? id);

/** Значок плеча: круг или квадрат; полый — прогон не пройден. */
function Mark({
  arm,
  color,
  x,
  y,
  r,
  hollow,
}: {
  arm: ArmId;
  color: string;
  x: number;
  y: number;
  r: number;
  hollow?: boolean;
}): ReactNode {
  const props = {
    fill: hollow ? 'var(--mc-surface)' : color,
    stroke: hollow ? color : 'var(--mc-surface)',
    strokeWidth: hollow ? 1.5 : 1,
  };
  const shape = ARM_SHAPE[arm];
  if (shape === 'circle') return <circle cx={x} cy={y} r={r} {...props} />;
  const side = r * 1.75;
  return <rect x={x - side / 2} y={y - side / 2} width={side} height={side} rx={1} {...props} />;
}

/** Значок плеча в HTML-подписи (легенда, заголовок столбца). */
function MarkIcon({
  arm,
  color,
  hollow,
}: {
  arm: ArmId;
  color: string;
  hollow?: boolean;
}): ReactNode {
  return (
    <svg className={styles.markIcon} viewBox="0 0 14 14" aria-hidden="true">
      <Mark arm={arm} color={color} x={7} y={7.5} r={4.5} hollow={hollow} />
    </svg>
  );
}

interface Tip {
  x: number;
  y: number;
  run: ModelRun;
}

/** Ближайший к указателю прогон в пределах `radius` пикселей. */
function nearest<T extends { px: number; py: number }>(
  points: T[],
  x: number,
  y: number,
  radius: number
): T | null {
  let best: T | null = null;
  let bestDistance = radius * radius;
  for (const point of points) {
    const distance = (point.px - x) ** 2 + (point.py - y) ** 2;
    if (distance <= bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

function RunTip({
  tip,
  width,
  lang,
  view,
  armColors,
}: {
  tip: Tip;
  width: number;
  lang: Lang;
  view: View;
  /** Значок в цвете плеча — в панели одной модели. */
  armColors?: boolean;
}): ReactNode {
  const t = TEXT[lang];
  const { run } = tip;
  const left = tip.x + 260 > width ? Math.max(0, tip.x - 252) : tip.x + 12;
  const model = modelById(run.model);
  const color = armColors ? ARM_COLOR[run.arm] : colorOf(view, run.model, run.arm);
  return (
    <div className={styles.tip} style={{ left, top: tip.y + 12 }} role="status">
      <div className={styles.tipHead}>
        <MarkIcon arm={run.arm} color={color} hollow={!run.pass} />
        {view.all && model ? `${model.label} · ` : ''}
        {ARM_LABELS[run.arm][lang]}
      </div>
      <div className={styles.tipTitle}>{scenarioTitle(run.scenario, lang)}</div>
      <div className={styles.tipSub}>
        {STACKS[run.target] ?? run.target} · {t.repeat(run.repeat)} ·{' '}
        <strong>{run.pass ? t.passed : t.failed}</strong> · {t.score} {run.score.toFixed(2)}
      </div>
      <div className={styles.tipSub}>
        {fmtMinutes(run.minutes, lang)}
        {run.cost !== null && ` · ${fmtUsd(run.cost)}`} · {fmtTokens(run.output)} {t.tokens} ·{' '}
        {t.steps}: {run.turns}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Легенда: плечи (форма значка); для нескольких моделей ещё модели (цвет), наведение приглушает.
 * Панели по модели (`faceted`) называют модель заголовком — цвет в них снова плечо.
 */
function SeriesLegend({
  lang,
  view,
  scope,
  median,
  faceted,
}: {
  lang: Lang;
  view: View;
  scope: Scope;
  median?: boolean;
  faceted?: boolean;
}): ReactNode {
  const t = TEXT[lang];
  const dimmed = dimmer(view, scope);
  const arms = [...new Set(view.series.map((series) => series.arm))];
  const sample = arms[0] ?? 'mcp-dsl';
  const byModel = view.all && !faceted;
  return (
    <ul className={styles.legend}>
      {byModel &&
        view.models.map((model) => (
          <li
            key={model.id}
            className={clsx(base.dimmable, dimmed(model.id) && base.dimmed)}
            {...hoverProps(view, scope, model.id)}
          >
            <span className={base.modelDot} style={seriesColor(model.color)} aria-hidden="true" />
            {model.label}
          </li>
        ))}
      {arms.map((arm) => (
        <li key={arm}>
          <MarkIcon arm={arm} color={byModel ? NEUTRAL : ARM_COLOR[arm]} />
          {ARM_LABELS[arm][lang]}
        </li>
      ))}
      <li className={styles.legendNote}>
        <MarkIcon arm={sample} color={NEUTRAL} />
        {t.passedLegend}
        <MarkIcon arm={sample} color={NEUTRAL} hollow />
        {t.failedLegend}
      </li>
      {median && (
        <li className={styles.legendNote}>
          <span className={styles.medianKey} aria-hidden="true" />
          {t.medianLegend}
        </li>
      )}
    </ul>
  );
}

/**
 * Указатель над прогоном: подсказка и, когда моделей несколько, приглушение остальных. Панель одной
 * модели (`dims = false`) соседние панели не приглушает.
 */
function usePointer<T extends { px: number; py: number; run: ModelRun }>(
  view: View,
  scope: Scope,
  points: T[],
  dims = true
) {
  const [tip, setTip] = useState<Tip | null>(null);
  const hovers = dims && view.models.length > 1;
  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const hit = nearest(points, event.clientX - box.left, event.clientY - box.top, 14);
    setTip(hit ? { x: hit.px, y: hit.py, run: hit.run } : null);
    if (hovers) scope.hover(hit ? hit.run.model : null);
  };
  const onLeave = () => {
    setTip(null);
    if (hovers) scope.hover(null);
  };
  return { tip, setTip, onMove, onLeave };
}

// ---------- разброс прогонов ----------

type SpreadMetric = 'minutes' | 'cost' | 'output';

const metricFormat = (metric: SpreadMetric, lang: Lang) =>
  metric === 'minutes'
    ? (value: number) => fmtMinutes(value, lang)
    : metric === 'cost'
      ? (value: number) => fmtUsd(value)
      : (value: number) => fmtTokens(value);

/** Подпись деления оси: короче, чем значение в подсказке. */
const tickFormat = (metric: SpreadMetric, value: number): string =>
  metric === 'cost'
    ? `$${value % 1 ? value.toFixed(value < 0.1 ? 2 : 1) : value}`
    : metric === 'output'
      ? `${value / 1000}k`
      : String(value);

/** Значение прогона на оси показателя; стоимости у локальной модели нет — `null`. */
const valueOf = (run: ModelRun, metric: SpreadMetric): number | null => run[metric];

/** Каждый прогон — точка на оси выбранного показателя, строка на серию; медиана — черта. */
export function McpRunSpread(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scope = useScope();
  const view = useView(scope);
  const dimmed = dimmer(view, scope);
  const [chosen, setMetric] = useState<SpreadMetric>('minutes');
  const metric: SpreadMetric = chosen === 'cost' && !view.costKnown ? 'minutes' : chosen;
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const format = metricFormat(metric, lang);

  const narrow = width < 560;
  const labelWidth = narrow ? 0 : view.all ? 290 : 190;
  const band = 44;
  const rowGap = narrow ? 34 : 14;
  const top = narrow ? 22 : 6;
  const left = labelWidth + 8;
  const right = width - 12;
  const rows = view.series.map((series) => ({
    series,
    runs: runsOf(view, series)
      .filter((run) => valueOf(run, metric) !== null)
      .sort((a, b) => (valueOf(a, metric) ?? 0) - (valueOf(b, metric) ?? 0)),
  }));
  const max = Math.max(
    0,
    ...rows.flatMap((row) => row.runs.map((run) => valueOf(run, metric) ?? 0))
  );
  const ticks = niceLinearTicks(max, narrow ? 4 : 7);
  const domain = ticks[ticks.length - 1] || 1;
  const scale = (value: number) => left + (value / domain) * (right - left);
  const rowTop = (index: number) => top + index * (band + rowGap);
  const height = rowTop(rows.length) - rowGap + 30;

  const placed = rows.flatMap(({ runs }, row) => {
    const centre = rowTop(row) + band / 2;
    // Детерминированный разброс по вертикали: последовательность золотого сечения.
    return runs.map((run, index) => ({
      run,
      px: scale(valueOf(run, metric) ?? 0),
      py: centre + (((index * 0.618034) % 1) - 0.5) * (band - 12),
    }));
  });
  const stats = rows.map(({ series, runs }) => {
    const values = runs.map((run) => valueOf(run, metric) ?? 0);
    return values.length === 0
      ? { series, median: null, p90: null, max: null }
      : {
          series,
          median: quantile(values, 0.5),
          p90: quantile(values, 0.9),
          max: Math.max(...values),
        };
  });
  const show = (value: number | null) => (value === null ? '—' : format(value));
  const { tip, setTip, onMove, onLeave } = usePointer(view, scope, placed);

  return (
    <figure className={clsx(base.root, styles.figure)}>
      <div className={styles.controls}>
        <ModelPicker scope={scope} />
        <Segmented
          label={t.metric}
          value={metric}
          onChange={(value) => {
            setMetric(value);
            setTip(null);
          }}
          options={[
            { id: 'minutes', label: t.minutes },
            ...(view.costKnown ? [{ id: 'cost' as const, label: t.cost }] : []),
            { id: 'output', label: t.output },
          ]}
        />
      </div>
      <ScopeNote view={view} />
      <div className={styles.plot} ref={ref}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${t.spreadLabel}: ${t[metric]}`}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={styles.grid}
                x1={scale(tick)}
                x2={scale(tick)}
                y1={top - 4}
                y2={height - 24}
              />
              <text
                className={styles.tick}
                x={scale(tick)}
                y={height - 8}
                textAnchor={tick === domain && t.unit[metric] ? 'end' : 'middle'}
              >
                {tickFormat(metric, tick)}
                {tick === domain && t.unit[metric] ? ` ${t.unit[metric]}` : ''}
              </text>
            </g>
          ))}
          {stats.map((stat, row) => {
            const y = rowTop(row);
            const { series } = stat;
            const label = seriesLabel(series, view, lang);
            const own = placed.filter(
              (point) => point.run.model === series.model.id && point.run.arm === series.arm
            );
            return (
              <g
                key={series.key}
                className={clsx(base.dimmable, dimmed(series.model.id) && base.dimmed)}
              >
                {narrow ? (
                  <text className={styles.rowLabel} x={left} y={y - 8}>
                    {label}
                    <tspan className={styles.rowNote}>
                      {' '}
                      · {t.median} {show(stat.median)}
                    </tspan>
                  </text>
                ) : (
                  <>
                    <text className={styles.rowLabel} x={0} y={y + band / 2 - 4}>
                      {label}
                    </text>
                    <text className={styles.rowNote} x={0} y={y + band / 2 + 12}>
                      {t.median} {show(stat.median)} · {t.max} {show(stat.max)}
                    </text>
                  </>
                )}
                <line
                  className={styles.baseline}
                  x1={left}
                  x2={right}
                  y1={y + band}
                  y2={y + band}
                />
                {own.map(({ run, px, py }, index) => (
                  <Mark
                    key={index}
                    arm={run.arm}
                    color={colorOf(view, run.model, run.arm)}
                    x={px}
                    y={py}
                    r={3.6}
                    hollow={!run.pass}
                  />
                ))}
                {stat.median !== null && (
                  <line
                    className={styles.median}
                    x1={scale(stat.median)}
                    x2={scale(stat.median)}
                    y1={y - 2}
                    y2={y + band + 2}
                  />
                )}
              </g>
            );
          })}
          {tip && (
            <circle className={styles.focus} cx={tip.x} cy={tip.y} r={7} aria-hidden="true" />
          )}
        </svg>
        {tip && <RunTip tip={tip} width={width} lang={lang} view={view} />}
      </div>
      <SeriesLegend lang={lang} view={view} scope={scope} median />
      <details className={styles.details}>
        <summary>{t.table}</summary>
        <div className={base.tableWrap}>
          <table className={base.table}>
            <thead>
              <tr>
                <th>{view.all ? t.series : t.arm}</th>
                <th>{t.median}</th>
                <th>{t.p90}</th>
                <th>{t.max}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.series.key}>
                  <td>{seriesLabel(stat.series, view, lang)}</td>
                  <td>{show(stat.median)}</td>
                  <td>{show(stat.p90)}</td>
                  <td>{show(stat.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

// ---------- время × стоимость ----------

type KindFilter = 'all' | Operation;
type YMetric = 'cost' | 'output';

/**
 * Диаграмма рассеяния: прогон — значок серии на осях времени и стоимости (обе логарифмические).
 * У локальной модели стоимости нет — тогда ось Y выходные токены, а при нескольких моделях её
 * можно переключить.
 */
export function McpTimeCost(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scope = useScope();
  const view = useView(scope);
  const [kind, setKind] = useState<KindFilter>('all');
  // Без выбора — стоимость, если она есть у каждой модели вида: иначе на оси стоимости не было бы
  // точек локальных моделей.
  const withoutCost = view.models.filter(
    (model) => !view.runs.some((run) => run.model === model.id && run.cost !== null)
  );
  const [chosenY, setY] = useState<YMetric | null>(null);
  const yMetric: YMetric = !view.costKnown
    ? 'output'
    : (chosenY ?? (withoutCost.length === 0 ? 'cost' : 'output'));
  const [ref, area] = useWidth<HTMLDivElement>(720);

  // Несколько моделей — панель на модель с общими осями, цвет — плечо: в одном облаке рядом
  // оказались бы любые две модели, а четыре цвета модели попарно не различимы.
  const panels: Array<ModelInfo | null> = view.models.length > 1 ? view.models : [null];
  const faceted = panels.length > 1;
  const columns = faceted && area >= 640 ? 2 : 1;
  const gap = 16;
  const width = columns === 1 ? area : Math.floor((area - gap) / 2);
  const narrow = width < 560;
  const margin = { left: 46, right: 12, top: 10, bottom: 40 };
  const height = faceted
    ? Math.round(Math.min(320, Math.max(240, width * 0.62)))
    : Math.round(Math.min(440, Math.max(300, width * 0.58)));
  const yOf = (run: ModelRun): number | null => run[yMetric];
  // Оси общие для всех фильтров задач: при переключении точки не прыгают.
  const pool = view.runs.filter((run) => (yOf(run) ?? 0) > 0 && run.minutes > 0);
  const minutes = pool.map((run) => run.minutes);
  const ys = pool.map((run) => yOf(run) ?? 0);
  const xMin = (pool.length ? Math.min(...minutes) : 0.1) * 0.85;
  const xMax = (pool.length ? Math.max(...minutes) : 1) * 1.15;
  const yMin = (pool.length ? Math.min(...ys) : 0.01) * 0.85;
  const yMax = (pool.length ? Math.max(...ys) : 1) * 1.15;
  const sx = (value: number) =>
    margin.left +
    ((Math.log(value) - Math.log(xMin)) / (Math.log(xMax) - Math.log(xMin))) *
      (width - margin.left - margin.right);
  const sy = (value: number) =>
    height -
    margin.bottom -
    ((Math.log(value) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin))) *
      (height - margin.top - margin.bottom);
  const xTicks = logTicks(xMin, xMax);
  const yTicks = logTicks(yMin, yMax);
  const yTick = (tick: number) =>
    yMetric === 'cost' ? `$${tick}` : tick >= 1000 ? `${tick / 1000}k` : String(tick);

  // Серии в порядке вида: без MCP рисуется раньше и не закрывает облако с MCP.
  const groups = view.series.map((series) => ({
    series,
    points: runsOf(view, series)
      .filter((run) => (yOf(run) ?? 0) > 0 && (kind === 'all' || run.kind === kind))
      .map((run) => ({ run, px: sx(run.minutes), py: sy(yOf(run) ?? 1) })),
  }));
  const shown = groups.reduce((total, group) => total + group.points.length, 0);
  const frame: ScatterFrame = {
    width,
    height,
    margin,
    xTicks,
    yTicks,
    sx,
    sy,
    yTick,
    xTitle: t.timeAxis,
    yTitle: yMetric === 'cost' ? (narrow ? '$' : t.costAxis) : t.outputAxis,
  };

  return (
    <figure className={clsx(base.root, styles.figure)}>
      <div className={styles.controls}>
        <ModelPicker scope={scope} />
        <Segmented<KindFilter>
          label={t.metric}
          value={kind}
          onChange={setKind}
          options={[
            { id: 'all', label: t.all },
            { id: 'create', label: t.kinds.create },
            { id: 'edit', label: t.kinds.edit },
            { id: 'delete', label: t.kinds.delete },
          ]}
        />
        {view.costKnown && (
          <Segmented<YMetric>
            label={t.yAxis}
            value={yMetric}
            onChange={setY}
            options={[
              { id: 'cost', label: t.cost },
              { id: 'output', label: t.output },
            ]}
          />
        )}
        <span className={styles.count}>
          {t.shown(shown)}
          {yMetric === 'cost' &&
            withoutCost.length > 0 &&
            ` · ${t.noCost(withoutCost.map((model) => model.label).join(', '))}`}
        </span>
      </div>
      <ScopeNote view={view} panels={faceted} />
      <div
        ref={ref}
        className={clsx(faceted && styles.facets)}
        style={
          faceted ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap } : undefined
        }
      >
        {panels.map((model) => (
          <ScatterPanel
            // Смена фильтра пересоздаёт панели: подсказка не остаётся над скрытым прогоном.
            key={`${model?.id ?? 'one'}|${kind}|${yMetric}`}
            model={model}
            groups={model ? groups.filter((group) => group.series.model.id === model.id) : groups}
            frame={frame}
            view={view}
            scope={scope}
            lang={lang}
          />
        ))}
      </div>
      <SeriesLegend lang={lang} view={view} scope={scope} faceted={faceted} />
    </figure>
  );
}

/** Оси и шкалы диаграммы рассеяния — общие для всех панелей. */
interface ScatterFrame {
  width: number;
  height: number;
  margin: { left: number; right: number; top: number; bottom: number };
  xTicks: number[];
  yTicks: number[];
  sx(value: number): number;
  sy(value: number): number;
  yTick(tick: number): string;
  xTitle: string;
  yTitle: string;
}

/**
 * Одна панель диаграммы рассеяния: все серии вида или, когда моделей несколько, серии одной модели.
 * В панели модели цвет — плечо, как у одной модели; наведение на модель в переключателе приглушает
 * остальные панели.
 */
function ScatterPanel({
  model,
  groups,
  frame,
  view,
  scope,
  lang,
}: {
  model: ModelInfo | null;
  groups: Array<{ series: Series; points: Array<{ run: ModelRun; px: number; py: number }> }>;
  frame: ScatterFrame;
  view: View;
  scope: Scope;
  lang: Lang;
}): ReactNode {
  const t = TEXT[lang];
  const dimmed = dimmer(view, scope);
  const faceted = model !== null;
  const { width, height, margin, sx, sy } = frame;
  const points = groups.flatMap((group) => group.points);
  const { tip, onMove, onLeave } = usePointer(view, scope, points, !faceted);
  const color = (run: ModelRun) =>
    faceted ? ARM_COLOR[run.arm] : colorOf(view, run.model, run.arm);
  return (
    <div className={clsx(base.dimmable, model && dimmed(model.id) && base.dimmed)}>
      {model && <div className={styles.facetTitle}>{model.label}</div>}
      <div className={styles.plot}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={model ? `${t.scatterLabel}: ${model.label}` : t.scatterLabel}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          {frame.xTicks.map((tick) => (
            <g key={`x${tick}`}>
              <line
                className={styles.grid}
                x1={sx(tick)}
                x2={sx(tick)}
                y1={margin.top}
                y2={height - margin.bottom}
              />
              <text
                className={styles.tick}
                x={sx(tick)}
                y={height - margin.bottom + 16}
                textAnchor="middle"
              >
                {tick}
              </text>
            </g>
          ))}
          {frame.yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line
                className={styles.grid}
                x1={margin.left}
                x2={width - margin.right}
                y1={sy(tick)}
                y2={sy(tick)}
              />
              <text className={styles.tick} x={margin.left - 6} y={sy(tick) + 4} textAnchor="end">
                {frame.yTick(tick)}
              </text>
            </g>
          ))}
          <line
            className={styles.baseline}
            x1={margin.left}
            x2={width - margin.right}
            y1={height - margin.bottom}
            y2={height - margin.bottom}
          />
          <text
            className={styles.axisTitle}
            x={width - margin.right}
            y={height - 4}
            textAnchor="end"
          >
            {frame.xTitle}
          </text>
          <text className={styles.axisTitle} x={margin.left + 4} y={margin.top + 10}>
            {frame.yTitle}
          </text>
          {groups.map(({ series, points: own }) => (
            <g
              key={series.key}
              className={clsx(
                !faceted && base.dimmable,
                !faceted && dimmed(series.model.id) && base.dimmed
              )}
            >
              {own.map(({ run, px, py }, index) => (
                <Mark
                  key={index}
                  arm={run.arm}
                  color={color(run)}
                  x={px}
                  y={py}
                  r={4}
                  hollow={!run.pass}
                />
              ))}
            </g>
          ))}
          {tip && (
            <circle className={styles.focus} cx={tip.x} cy={tip.y} r={8} aria-hidden="true" />
          )}
        </svg>
        {tip && <RunTip tip={tip} width={width} lang={lang} view={view} armColors={faceted} />}
      </div>
    </div>
  );
}

// ---------- карта сценариев ----------

const FORMS: Record<string, Record<Lang, string>> = {
  registration: { ru: 'Регистрация', en: 'Registration' },
  order: { ru: 'Оформление заказа', en: 'Checkout' },
  wizard: { ru: 'Мастер оформления заказа', en: 'Checkout wizard' },
};
const FORM_ORDER = ['registration', 'order', 'wizard'];
const OPERATIONS: Record<string, Record<Lang, string>> = {
  create: { ru: 'создание', en: 'create' },
  split: { ru: 'одна страница → шаги', en: 'one page → steps' },
  edit: { ru: 'правка', en: 'edit' },
  delete: { ru: 'удаление', en: 'remove' },
};
const OPERATION_ORDER = ['create', 'split', 'edit', 'delete'];
/** Короткое имя плеча — вторая строка заголовка карты для всех моделей. */
const ARM_SHORT: Record<ArmId, Record<Lang, string>> = {
  'no-mcp': { ru: 'без MCP', en: 'no MCP' },
  'mcp-dsl': { ru: 'с MCP', en: 'with MCP' },
};
const STACK_ORDER = ['core', 'renderer-react', 'renderer-json'];

type Status = 'good' | 'part' | 'bad';
const STATUS_GLYPH: Record<Status, string> = { good: '✓', part: '◐', bad: '✗' };
const statusOf = (passes: number, total: number): Status =>
  passes === total ? 'good' : passes === 0 ? 'bad' : 'part';

function StatusTile({
  passes,
  total,
  title,
}: {
  passes: number;
  total: number;
  title?: string;
}): ReactNode {
  const status = statusOf(passes, total);
  return (
    <span className={clsx(styles.statusTile, styles[status])} title={title}>
      <span className={styles.glyph} aria-hidden="true">
        {STATUS_GLYPH[status]}
      </span>
      {passes}/{total}
    </span>
  );
}

/** Итог столбца карты; у серии нет прогонов выбранного стека — прочерк. */
function TotalTile({
  count,
  missing,
}: {
  count: { passes: number; runs: number };
  missing: string;
}): ReactNode {
  return count.runs > 0 ? (
    <StatusTile passes={count.passes} total={count.runs} />
  ) : (
    <span className={base.missing} title={missing}>
      —
    </span>
  );
}

/**
 * Сводная карта: сценарии по формам × серии, в плитке — сколько прогонов сценария прошли. Третий
 * переключатель — стек: все три вместе или один. Для всех стеков под итогом — строка на стек: по
 * ней видно, какой из них проходит лучше.
 */
export function McpScenarioMap(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scope = useScope();
  const view = useView(scope);
  const dimmed = dimmer(view, scope);
  const [chosenStack, setStack] = useState<string>(ALL);
  const stacks = STACK_ORDER.filter((target) =>
    view.models.some((model) => model.data.targets.includes(target))
  );
  // Стека нет у моделей вида (сменили модель) — показываем все.
  const stack = stacks.includes(chosenStack) ? chosenStack : ALL;
  /** Прогоны серии на сценарии: все или одного стека; не мерили — `null`. */
  const countOf = (series: Series, id: string, target: string) => {
    const cell = scenarioCell(series, id);
    if (!cell) return null;
    if (target === ALL) return { passes: cell.passes, runs: cell.runs };
    const own = cell.targets[target];
    return own && own.runs > 0 ? own : null;
  };
  const split = (id: string) => {
    const dash = id.indexOf('-');
    return [id.slice(0, dash), id.slice(dash + 1)] as const;
  };
  const scenarios = scenariosOf(view).sort((a, b) => {
    const [formA, opA] = split(a.id);
    const [formB, opB] = split(b.id);
    return (
      FORM_ORDER.indexOf(formA) - FORM_ORDER.indexOf(formB) ||
      OPERATION_ORDER.indexOf(opA) - OPERATION_ORDER.indexOf(opB)
    );
  });
  const column = (series: Series) => clsx(base.dimmable, dimmed(series.model.id) && base.dimmed);
  const totalOf = (series: Series, target: string) =>
    scenarios.reduce(
      (total, scenario) => {
        const count = countOf(series, scenario.id, target);
        return count
          ? { passes: total.passes + count.passes, runs: total.runs + count.runs }
          : total;
      },
      { passes: 0, runs: 0 }
    );
  const rows: ReactNode[] = [];
  let form = '';
  for (const scenario of scenarios) {
    const [scenarioForm, operation] = split(scenario.id);
    if (scenarioForm !== form) {
      form = scenarioForm;
      rows.push(
        <tr className={styles.groupRow} key={`form-${form}`}>
          <th colSpan={view.series.length + 1}>{FORMS[form]?.[lang] ?? form}</th>
        </tr>
      );
    }
    rows.push(
      <tr key={scenario.id}>
        <th scope="row" title={scenarioTitle(scenario.id, lang)}>
          {OPERATIONS[operation]?.[lang] ?? operation}
        </th>
        {view.series.map((series) => {
          const cell = scenarioCell(series, scenario.id);
          const count = countOf(series, scenario.id, stack);
          // Все стеки — разбивка по ним в подсказке плитки; один стек — она и есть плитка.
          const breakdown =
            cell && stack === ALL
              ? STACK_ORDER.filter((target) => cell.targets[target])
                  .map(
                    (target) =>
                      `${STACKS[target] ?? target} ${cell.targets[target].passes}/${cell.targets[target].runs}`
                  )
                  .join(' · ')
              : undefined;
          return (
            <td
              key={series.key}
              className={column(series)}
              {...hoverProps(view, scope, series.model.id)}
            >
              {count ? (
                <StatusTile passes={count.passes} total={count.runs} title={breakdown} />
              ) : (
                <span className={base.missing} title={t.notRun}>
                  —
                </span>
              )}
            </td>
          );
        })}
      </tr>
    );
  }
  return (
    <div className={clsx(base.root, styles.figure)}>
      <div className={styles.controls}>
        <ModelPicker scope={scope}>
          {stacks.length > 1 && (
            <Choice
              label={t.stack}
              value={stack}
              options={[
                { id: ALL, label: t.allStacks },
                ...stacks.map((target) => ({ id: target, label: STACKS[target] ?? target })),
              ]}
              onChange={setStack}
            />
          )}
        </ModelPicker>
      </div>
      <ScopeNote view={view} cells={false} />
      <div className={base.tableWrap}>
        <table className={styles.map}>
          <thead>
            <tr>
              <th>{t.scenario}</th>
              {view.series.map((series) => {
                const fill = seriesFill(series, view);
                return (
                  <th
                    key={series.key}
                    scope="col"
                    className={column(series)}
                    {...hoverProps(view, scope, series.model.id)}
                  >
                    <span className={styles.armHead}>
                      <span
                        className={clsx(base.swatch, fill.className)}
                        style={fill.style}
                        aria-hidden="true"
                      />
                      {view.all ? (
                        // Две строки: «модель · плечо» в одну растягивал карту на пять столбцов.
                        <span className={styles.headLines} title={seriesLabel(series, view, lang)}>
                          <span>{series.model.label}</span>
                          <span className={styles.headSub}>{ARM_SHORT[series.arm][lang]}</span>
                        </span>
                      ) : (
                        seriesLabel(series, view, lang)
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
          <tfoot>
            <tr>
              <th scope="row">{t.total}</th>
              {view.series.map((series) => (
                <td
                  key={series.key}
                  className={column(series)}
                  {...hoverProps(view, scope, series.model.id)}
                >
                  <TotalTile count={totalOf(series, stack)} missing={t.notRun} />
                </td>
              ))}
            </tr>
            {stack === ALL &&
              stacks.length > 1 &&
              stacks.map((target) => (
                <tr className={styles.stackRow} key={target}>
                  <th scope="row">{STACKS[target] ?? target}</th>
                  {view.series.map((series) => (
                    <td
                      key={series.key}
                      className={column(series)}
                      {...hoverProps(view, scope, series.model.id)}
                    >
                      <TotalTile count={totalOf(series, target)} missing={t.notRun} />
                    </td>
                  ))}
                </tr>
              ))}
          </tfoot>
        </table>
      </div>
      <ul className={styles.legend}>
        {(['good', 'part', 'bad'] as Status[]).map((status) => (
          <li key={status}>
            <span className={clsx(styles.statusTile, styles.mini, styles[status])}>
              {STATUS_GLYPH[status]}
            </span>
            {status === 'good' ? t.allPassed : status === 'part' ? t.somePassed : t.nonePassed}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Графики страницы «Замеры: с MCP и без» по отдельным прогонам (`runs` в
 * `src/data/mcp-benchmark.json`): разброс прогонов по плечам, время × стоимость и карта сценариев
 * по плечам. Сводки рисует McpBenchmark.tsx.
 *
 * SVG без библиотек. Ширину графика задаёт контейнер (ResizeObserver): подписи остаются читаемыми
 * от телефона до десктопа, а не масштабируются вместе с картинкой. Плечо кодирует форма значка и
 * подпись, пройден ли прогон — заливка: смысл не держится на одном цвете.
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import clsx from 'clsx';
import data from '@site/src/data/mcp-benchmark.json';
import {
  ARM_FILL,
  ARM_LABELS,
  STACKS,
  TITLES_EN,
  fmtMinutes,
  fmtTokens,
  fmtUsd,
  useLang,
  type Lang,
} from './McpBenchmark';
import type { ArmId, Operation, RunResult } from './types';
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
    medianLegend: 'медиана плеча',
    table: 'Таблица',
    arm: 'Плечо',
    score: 'счёт',
    steps: 'шагов',
    tokens: 'выходных токенов',
    repeat: (n: number) => `повтор ${n}`,
    all: 'Все задачи',
    kinds: { create: 'Создание', edit: 'Правка', delete: 'Удаление' } as Record<Operation, string>,
    timeAxis: 'время прогона, мин (лог. шкала)',
    costAxis: 'стоимость, $ (лог. шкала)',
    shown: (n: number) => `прогонов на графике: ${n}`,
    total: 'Всего',
    allPassed: 'все прогоны прошли',
    somePassed: 'часть прошла',
    nonePassed: 'ни один не прошёл',
    scenario: 'Сценарий',
    spreadLabel: 'Разброс прогонов по плечам',
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
    medianLegend: 'median of the arm',
    table: 'Table',
    arm: 'Arm',
    score: 'score',
    steps: 'steps',
    tokens: 'output tokens',
    repeat: (n: number) => `repeat ${n}`,
    all: 'All tasks',
    kinds: { create: 'Create', edit: 'Edit', delete: 'Remove' } as Record<Operation, string>,
    timeAxis: 'run time, min (log scale)',
    costAxis: 'cost, $ (log scale)',
    shown: (n: number) => `runs on the chart: ${n}`,
    total: 'Total',
    allPassed: 'every run passed',
    somePassed: 'some passed',
    nonePassed: 'none passed',
    scenario: 'Scenario',
    spreadLabel: 'Spread of runs by arm',
    scatterLabel: 'Time and cost of every run',
  },
} as const;

const runs = data.runs as RunResult[];
const ARMS = data.arms as ArmId[];

/** Форма значка плеча — тот же знак в легенде, разбросе и диаграмме рассеяния. */
const ARM_SHAPE: Record<ArmId, 'circle' | 'triangle' | 'square'> = {
  'no-mcp': 'circle',
  'mcp-default': 'triangle',
  'mcp-dsl': 'square',
};
const ARM_COLOR: Record<ArmId, string> = {
  'no-mcp': 'var(--mc-none)',
  'mcp-default': 'var(--mc-default)',
  'mcp-dsl': 'var(--mc-dsl)',
};

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
  lang === 'en'
    ? (TITLES_EN[id] ?? id)
    : (data.scenarios.find((entry) => entry.id === id)?.title ?? id);

/** Значок плеча: круг, треугольник или квадрат; полый — прогон не пройден. */
function Mark({
  arm,
  x,
  y,
  r,
  hollow,
}: {
  arm: ArmId;
  x: number;
  y: number;
  r: number;
  hollow?: boolean;
}): ReactNode {
  const color = ARM_COLOR[arm];
  const props = {
    fill: hollow ? 'var(--mc-surface)' : color,
    stroke: hollow ? color : 'var(--mc-surface)',
    strokeWidth: hollow ? 1.5 : 1,
  };
  const shape = ARM_SHAPE[arm];
  if (shape === 'circle') return <circle cx={x} cy={y} r={r} {...props} />;
  if (shape === 'square') {
    const side = r * 1.75;
    return <rect x={x - side / 2} y={y - side / 2} width={side} height={side} rx={1} {...props} />;
  }
  const h = r * 2.1;
  return (
    <path
      d={`M${x} ${y - h * 0.62} L${x + h * 0.6} ${y + h * 0.42} L${x - h * 0.6} ${y + h * 0.42} Z`}
      {...props}
    />
  );
}

/** Значок плеча в HTML-подписи (легенда, заголовок столбца). */
function MarkIcon({ arm, hollow }: { arm: ArmId; hollow?: boolean }): ReactNode {
  return (
    <svg className={styles.markIcon} viewBox="0 0 14 14" aria-hidden="true">
      <Mark arm={arm} x={7} y={7.5} r={4.5} hollow={hollow} />
    </svg>
  );
}

interface Tip {
  x: number;
  y: number;
  run: RunResult;
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

function RunTip({ tip, width, lang }: { tip: Tip; width: number; lang: Lang }): ReactNode {
  const t = TEXT[lang];
  const { run } = tip;
  const left = tip.x + 260 > width ? Math.max(0, tip.x - 252) : tip.x + 12;
  return (
    <div className={styles.tip} style={{ left, top: tip.y + 12 }} role="status">
      <div className={styles.tipHead}>
        <MarkIcon arm={run.arm} hollow={!run.pass} />
        {ARM_LABELS[run.arm][lang]}
      </div>
      <div className={styles.tipTitle}>{scenarioTitle(run.scenario, lang)}</div>
      <div className={styles.tipSub}>
        {STACKS[run.target] ?? run.target} · {t.repeat(run.repeat)} ·{' '}
        <strong>{run.pass ? t.passed : t.failed}</strong> · {t.score} {run.score.toFixed(2)}
      </div>
      <div className={styles.tipSub}>
        {fmtMinutes(run.minutes, lang)} · {fmtUsd(run.cost)} · {fmtTokens(run.output)} {t.tokens} ·{' '}
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

function ArmLegend({ lang, median }: { lang: Lang; median?: boolean }): ReactNode {
  const t = TEXT[lang];
  return (
    <ul className={styles.legend}>
      {ARMS.map((arm) => (
        <li key={arm}>
          <MarkIcon arm={arm} />
          {ARM_LABELS[arm][lang]}
        </li>
      ))}
      <li className={styles.legendNote}>
        <MarkIcon arm="no-mcp" />
        {t.passedLegend}
        <MarkIcon arm="no-mcp" hollow />
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

/** Каждый прогон — точка на оси выбранного показателя, строка на плечо; медиана — черта. */
export function McpRunSpread(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const [metric, setMetric] = useState<SpreadMetric>('minutes');
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [tip, setTip] = useState<Tip | null>(null);
  const format = metricFormat(metric, lang);

  const narrow = width < 560;
  const labelWidth = narrow ? 0 : 190;
  const band = 44;
  const rowGap = narrow ? 34 : 14;
  const top = narrow ? 22 : 6;
  const left = labelWidth + 8;
  const right = width - 12;
  const max = Math.max(...runs.map((run) => run[metric]));
  const ticks = niceLinearTicks(max, narrow ? 4 : 7);
  const domain = ticks[ticks.length - 1];
  const scale = (value: number) => left + (value / domain) * (right - left);
  const rowTop = (index: number) => top + index * (band + rowGap);
  const height = rowTop(ARMS.length) - rowGap + 30;

  const placed = ARMS.flatMap((arm, row) => {
    const own = runs.filter((run) => run.arm === arm).sort((a, b) => a[metric] - b[metric]);
    const centre = rowTop(row) + band / 2;
    // Детерминированный разброс по вертикали: последовательность золотого сечения.
    return own.map((run, index) => ({
      run,
      px: scale(run[metric]),
      py: centre + (((index * 0.618034) % 1) - 0.5) * (band - 12),
    }));
  });
  const stats = ARMS.map((arm) => {
    const values = runs.filter((run) => run.arm === arm).map((run) => run[metric]);
    return {
      arm,
      median: quantile(values, 0.5),
      p90: quantile(values, 0.9),
      max: Math.max(...values),
    };
  });

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const hit = nearest(placed, x, y, 14);
    setTip(hit ? { x: hit.px, y: hit.py, run: hit.run } : null);
  };

  return (
    <figure className={clsx(base.root, styles.figure)}>
      <div className={styles.controls}>
        <Segmented
          label={t.metric}
          value={metric}
          onChange={(value) => {
            setMetric(value);
            setTip(null);
          }}
          options={[
            { id: 'minutes', label: t.minutes },
            { id: 'cost', label: t.cost },
            { id: 'output', label: t.output },
          ]}
        />
      </div>
      <div className={styles.plot} ref={ref}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${t.spreadLabel}: ${t[metric]}`}
          onPointerMove={onMove}
          onPointerLeave={() => setTip(null)}
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
            return (
              <g key={stat.arm}>
                {narrow ? (
                  <text className={styles.rowLabel} x={left} y={y - 8}>
                    {ARM_LABELS[stat.arm][lang]}
                    <tspan className={styles.rowNote}>
                      {' '}
                      · {t.median} {format(stat.median)}
                    </tspan>
                  </text>
                ) : (
                  <>
                    <text className={styles.rowLabel} x={0} y={y + band / 2 - 4}>
                      {ARM_LABELS[stat.arm][lang]}
                    </text>
                    <text className={styles.rowNote} x={0} y={y + band / 2 + 12}>
                      {t.median} {format(stat.median)} · {t.max} {format(stat.max)}
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
              </g>
            );
          })}
          {placed.map(({ run, px, py }, index) => (
            <Mark key={index} arm={run.arm} x={px} y={py} r={3.6} hollow={!run.pass} />
          ))}
          {stats.map((stat, row) => (
            <line
              key={stat.arm}
              className={styles.median}
              x1={scale(stat.median)}
              x2={scale(stat.median)}
              y1={rowTop(row) - 2}
              y2={rowTop(row) + band + 2}
            />
          ))}
          {tip && (
            <circle className={styles.focus} cx={tip.x} cy={tip.y} r={7} aria-hidden="true" />
          )}
        </svg>
        {tip && <RunTip tip={tip} width={width} lang={lang} />}
      </div>
      <ArmLegend lang={lang} median />
      <details className={styles.details}>
        <summary>{t.table}</summary>
        <div className={base.tableWrap}>
          <table className={base.table}>
            <thead>
              <tr>
                <th>{t.arm}</th>
                <th>{t.median}</th>
                <th>{t.p90}</th>
                <th>{t.max}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.arm}>
                  <td>{ARM_LABELS[stat.arm][lang]}</td>
                  <td>{format(stat.median)}</td>
                  <td>{format(stat.p90)}</td>
                  <td>{format(stat.max)}</td>
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

/** Диаграмма рассеяния: прогон — значок плеча на осях времени и стоимости (обе логарифмические). */
export function McpTimeCost(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const [kind, setKind] = useState<KindFilter>('all');
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [tip, setTip] = useState<Tip | null>(null);

  const narrow = width < 560;
  const margin = { left: 46, right: 12, top: 10, bottom: 40 };
  const height = Math.round(Math.min(440, Math.max(300, width * 0.58)));
  // Оси общие для всех фильтров: при переключении точки не прыгают.
  const minutes = runs.map((run) => run.minutes);
  const costs = runs.map((run) => run.cost);
  const xMin = Math.min(...minutes) * 0.85;
  const xMax = Math.max(...minutes) * 1.15;
  const yMin = Math.min(...costs) * 0.85;
  const yMax = Math.max(...costs) * 1.15;
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

  // Плечо с MCP рисуется поверх: облако без MCP шире и не должно его закрывать.
  const shown = ARMS.flatMap((arm) =>
    runs.filter((run) => run.arm === arm && (kind === 'all' || run.kind === kind))
  ).map((run) => ({ run, px: sx(run.minutes), py: sy(run.cost) }));

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const hit = nearest(shown, event.clientX - box.left, event.clientY - box.top, 14);
    setTip(hit ? { x: hit.px, y: hit.py, run: hit.run } : null);
  };

  return (
    <figure className={clsx(base.root, styles.figure)}>
      <div className={styles.controls}>
        <Segmented
          label={t.metric}
          value={kind}
          onChange={(value) => {
            setKind(value);
            setTip(null);
          }}
          options={[
            { id: 'all', label: t.all },
            { id: 'create', label: t.kinds.create },
            { id: 'edit', label: t.kinds.edit },
            { id: 'delete', label: t.kinds.delete },
          ]}
        />
        <span className={styles.count}>{t.shown(shown.length)}</span>
      </div>
      <div className={styles.plot} ref={ref}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t.scatterLabel}
          onPointerMove={onMove}
          onPointerLeave={() => setTip(null)}
        >
          {xTicks.map((tick) => (
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
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line
                className={styles.grid}
                x1={margin.left}
                x2={width - margin.right}
                y1={sy(tick)}
                y2={sy(tick)}
              />
              <text className={styles.tick} x={margin.left - 6} y={sy(tick) + 4} textAnchor="end">
                ${tick}
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
            {t.timeAxis}
          </text>
          <text className={styles.axisTitle} x={margin.left + 4} y={margin.top + 10}>
            {narrow ? '$' : t.costAxis}
          </text>
          {shown.map(({ run, px, py }, index) => (
            <Mark key={index} arm={run.arm} x={px} y={py} r={4} hollow={!run.pass} />
          ))}
          {tip && (
            <circle className={styles.focus} cx={tip.x} cy={tip.y} r={8} aria-hidden="true" />
          )}
        </svg>
        {tip && <RunTip tip={tip} width={width} lang={lang} />}
      </div>
      <ArmLegend lang={lang} />
    </figure>
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

/** Сводная карта: сценарии по формам × плечи, в плитке — сколько прогонов сценария прошли. */
export function McpScenarioMap(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const split = (id: string) => {
    const dash = id.indexOf('-');
    return [id.slice(0, dash), id.slice(dash + 1)] as const;
  };
  const scenarios = [...data.scenarios].sort((a, b) => {
    const [formA, opA] = split(a.id);
    const [formB, opB] = split(b.id);
    return (
      FORM_ORDER.indexOf(formA) - FORM_ORDER.indexOf(formB) ||
      OPERATION_ORDER.indexOf(opA) - OPERATION_ORDER.indexOf(opB)
    );
  });
  const rows: ReactNode[] = [];
  let form = '';
  for (const scenario of scenarios) {
    const [scenarioForm, operation] = split(scenario.id);
    if (scenarioForm !== form) {
      form = scenarioForm;
      rows.push(
        <tr className={styles.groupRow} key={`form-${form}`}>
          <th colSpan={ARMS.length + 1}>{FORMS[form]?.[lang] ?? form}</th>
        </tr>
      );
    }
    rows.push(
      <tr key={scenario.id}>
        <th scope="row" title={scenarioTitle(scenario.id, lang)}>
          {OPERATIONS[operation]?.[lang] ?? operation}
        </th>
        {ARMS.map((arm) => {
          const cell = scenario.arms[arm];
          const stacks = STACK_ORDER.filter((target) => cell.targets[target])
            .map(
              (target) =>
                `${STACKS[target] ?? target} ${cell.targets[target].passes}/${cell.targets[target].runs}`
            )
            .join(' · ');
          return (
            <td key={arm}>
              <StatusTile passes={cell.passes} total={cell.runs} title={stacks} />
            </td>
          );
        })}
      </tr>
    );
  }
  return (
    <div className={clsx(base.root, styles.figure)}>
      <div className={base.tableWrap}>
        <table className={styles.map}>
          <thead>
            <tr>
              <th>{t.scenario}</th>
              {ARMS.map((arm) => (
                <th key={arm} scope="col">
                  <span className={styles.armHead}>
                    <span className={clsx(base.swatch, ARM_FILL[arm])} aria-hidden="true" />
                    {ARM_LABELS[arm][lang]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
          <tfoot>
            <tr>
              <th scope="row">{t.total}</th>
              {ARMS.map((arm) => (
                <td key={arm}>
                  <StatusTile passes={data.summary[arm].passes} total={data.summary[arm].runs} />
                </td>
              ))}
            </tr>
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

/**
 * Трейсы во времени: JS heap, DOM-узлы и обработчики событий по участникам — три графика стопкой, у
 * каждого своя ось Y (двух шкал на одном графике нет). Ось X общая: окно замера каждой фазы —
 * полоса шириной самого долгого участника, за ним промежуток до следующей фазы, поэтому «шаг 1»
 * одной библиотеки стоит напротив «шага 1» другой.
 *
 * Данные (~110 КБ) грузятся отдельным чанком после монтирования: в HTML страницы — только рамки
 * фиксированной высоты, подписи и легенда, раскладка не прыгает. Перекрестье общее для трёх
 * графиков; оно и подсказка — слой поверх линий, движение курсора пути не перерисовывает.
 * Подсказка рисуется в document.body по координатам окна: контейнер графиков прокручивается по
 * горизонтали и обрезал бы её у своих краёв.
 *
 * Зум — по времени, общий для трёх графиков: меняется только viewBox, пути линий не
 * пересчитываются. Приблизить — выделить участок мышью, щёлкнуть номер фазы, Ctrl/⌘ + колесо
 * (и щипок тачпада), кнопки или клавиши + и −; сдвинуть — полоса-обзор под графиками, Shift +
 * колесо, горизонтальный свайп, стрелки у края окна; вернуть весь трейс — кнопка, двойной щелчок,
 * клавиша 0. Ось Y приближенного участка подстраивается под его максимум.
 */
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
  type ReactNode,
  type RefObject,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import Translate, { translate } from '@docusaurus/Translate';
import { isDashed, libStyle } from './colors';
import { useParticipants } from './participants';
import { type BenchText, useBenchText } from './i18n';
import {
  CURSOR_STEPS,
  type Lines,
  VB_H,
  VB_W,
  type View,
  clampView,
  decodeLines,
  maxInRange,
  minSpan,
  niceMax,
  panView,
  pathOf,
  phaseAt,
  phasesInView,
  spreadLabels,
  tickText,
  valueAt,
  valueAtOrBefore,
  zoomView,
} from './traceGeometry';
import { type BenchForm, type TraceData, type TraceForm, type TraceMetric } from './types';
import bench from './bench.module.css';
import styles from './traces.module.css';

/** Высота области графика, px — та же, что `--plot-h` в traces.module.css (подписи на концах). */
const PLOT_PX = 132;
/** Мин. расстояние между подписями на концах линий, px. */
const LABEL_GAP = 14;
/** Сдвиг указателя, после которого нажатие считается выделением участка, а не щелчком, px. */
const DRAG_PX = 5;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

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
function loadFormsTraces(): Promise<TraceData> {
  pending ??= import('@site/src/data/forms-benchmark-traces.json').then((m) => m.default);
  return pending;
}

export default function TraceCharts({
  form,
  measuredRuns,
  load: loadTraces = loadFormsTraces,
}: {
  form: BenchForm;
  /** Прогоны отчёта на странице — трейсы, записанные для другого отчёта, помечаются. */
  measuredRuns: string[];
  /**
   * Файл трейсов отчёта (по умолчанию — отчёта библиотек). Импорт — статической строкой у
   * страницы: сборщику нужен путь, а повторные вызовы страница кэширует сама.
   */
  load?: () => Promise<TraceData>;
}): ReactNode {
  const t = useBenchText();
  const { order, label: libLabel } = useParticipants();
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
  }, [loadTraces]);

  const trace =
    load.status === 'ready' ? (load.data.forms.find((f) => f.id === form.id) ?? null) : null;
  const stale =
    load.status === 'ready' && load.data.measuredRuns.join() !== [...measuredRuns].join();
  const libs = trace ? order.filter((lib) => trace.libs[lib]) : [...order];
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
                        Трейсов для этой формы нет — значения есть в таблицах раздела «Все фазы».
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
  const { label: libLabel } = useParticipants();
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

  const total = trace.total;
  const [view, setView] = useState<View>({ x0: 0, x1: total });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const span = view.x1 - view.x0;
  const zoomed = span < total;
  const resetView = () => setView({ x0: 0, x1: total });
  const zoomBy = (factor: number, at = cursor ? (cursor.step + 0.5) / CURSOR_STEPS : 0.5) =>
    setView((v) => zoomView(v, total, at, factor));
  // Фаза с полями по краям; короткую — не уже 1/50 трассы, чтобы вокруг оставался контекст.
  const zoomToPhase = (index: number) => {
    const p = trace.phases[index];
    const width = Math.max(p.width * 1.16, total / 50);
    const centre = p.offset + p.width / 2;
    setView(clampView({ x0: centre - width / 2, x1: centre + width / 2 }, total));
  };

  // Ось Y приближенного участка — по его максимуму, иначе детали прижаты к низу графика.
  const yTop = useMemo(
    () =>
      zoomed
        ? (Object.fromEntries(
            METRICS.map((m) => [
              m.id,
              Math.min(
                yMax[m.id],
                niceMax(
                  Math.max(
                    0,
                    ...libs.map((lib) => maxInRange(lines[lib]?.[m.id] ?? [], view.x0, view.x1))
                  )
                )
              ),
            ])
          ) as Record<TraceMetric, number>)
        : yMax,
    [zoomed, view.x0, view.x1, lines, libs, yMax]
  );

  const frac = cursor ? (cursor.step + 0.5) / CURSOR_STEPS : 0;
  const x = view.x0 + frac * span;
  const hit = cursor ? phaseAt(trace.phases, x) : null;

  // Подсказка стоит по координатам окна: при прокрутке страницы или контейнера она отстала бы от
  // перекрестья — прячем её до следующего движения курсора.
  const shown = cursor !== null;
  useEffect(() => {
    if (!shown) return undefined;
    const hide = () => setCursor(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', hide, { capture: true });
  }, [shown]);

  // Колесо: Ctrl/⌘ (и щипок тачпада) — масштаб вокруг курсора; горизонтальная прокрутка и Shift —
  // сдвиг приближенного окна; обычное колесо листает страницу. Слушатель не пассивный: React вешает
  // wheel пассивно, и preventDefault не отменил бы масштаб страницы.
  useEffect(() => {
    const node = layerRef.current;
    if (!node) return undefined;
    const onWheel = (e: WheelEvent) => {
      const plot = plotRef.current?.getBoundingClientRect();
      if (!plot?.width) return;
      const at = (e.clientX - plot.left) / plot.width;
      if (at < 0 || at > 1) return;
      const unit = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setView((v) => zoomView(v, total, at, Math.exp(e.deltaY * unit * 0.0025)));
        return;
      }
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      const v = viewRef.current;
      if (!dx || v.x1 - v.x0 >= total) return;
      e.preventDefault();
      setView(panView(v, total, ((dx * unit) / plot.width) * (v.x1 - v.x0)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [total]);

  // Выделение участка: нажатие на графике и протяжка. Рамку рисуют CSS-переменные слоя, без
  // перерисовки графиков на каждое движение.
  const drag = useRef<{ start: number; client: number } | null>(null);
  const plotFrac = (clientX: number): number | null => {
    const plot = plotRef.current?.getBoundingClientRect();
    return plot?.width ? (clientX - plot.left) / plot.width : null;
  };
  const hideSelection = () => layerRef.current?.removeAttribute('data-selecting');
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !(e.target as Element).closest('[data-plot]')) return;
    const f = plotFrac(e.clientX);
    if (f === null) return;
    // Указатель захватывается, только когда протяжка началась (onPointerMove): захват с нажатия
    // перенаправил бы щелчки и двойной щелчок со графика на весь слой.
    drag.current = { start: clamp01(f), client: e.clientX };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    hideSelection();
    if (!d || Math.abs(e.clientX - d.client) < DRAG_PX) return;
    const f = clamp01(plotFrac(e.clientX) ?? d.start);
    const a = Math.min(d.start, f);
    const b = Math.max(d.start, f);
    setView((v) =>
      clampView({ x0: v.x0 + a * (v.x1 - v.x0), x1: v.x0 + b * (v.x1 - v.x0) }, total)
    );
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const plot = plotRef.current?.getBoundingClientRect();
    const layer = layerRef.current?.getBoundingClientRect();
    if (!plot || !layer || !plot.width) return;
    const f = (e.clientX - plot.left) / plot.width;
    const d = drag.current;
    if (d && Math.abs(e.clientX - d.client) >= DRAG_PX && layerRef.current) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const a = Math.min(d.start, clamp01(f));
      const b = Math.max(d.start, clamp01(f));
      layerRef.current.style.setProperty('--sa', `${a * 100}%`);
      layerRef.current.style.setProperty('--sw', `${(b - a) * 100}%`);
      layerRef.current.setAttribute('data-selecting', '');
    }
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
    if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0') {
      e.preventDefault();
      if (e.key === '0') resetView();
      else zoomBy(e.key === '-' || e.key === '_' ? 2 : 0.5);
      return;
    }
    // Курсор у края приближенного окна — стрелка сдвигает само окно.
    const edge =
      (e.key === 'ArrowRight' && step >= CURSOR_STEPS - 1) || (e.key === 'ArrowLeft' && step === 0);
    if (zoomed && edge) {
      e.preventDefault();
      setView((v) => panView(v, total, (e.key === 'ArrowRight' ? 0.1 : -0.1) * (v.x1 - v.x0)));
      return;
    }
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
  const tipText = cursor ? tooltipText(trace, lines, libs, x, hit, form, t, libLabel) : '';
  useEffect(() => {
    const id = setTimeout(() => setSpoken(tipText), 250);
    return () => clearTimeout(id);
  }, [tipText]);

  const layerStyle = { '--cx': `${frac * 100}%` } as CSSProperties;
  // Где окно: одна фаза, несколько или промежуток между ними.
  const visible = phasesInView(trace.phases, view);
  const where = !visible
    ? translate(
        { id: 'benchmark.traces.zoom.where.gap', message: 'после фазы {a}' },
        { a: (phaseAt(trace.phases, view.x0)?.index ?? 0) + 1 }
      )
    : visible[0] === visible[1]
      ? translate(
          { id: 'benchmark.traces.zoom.where.one', message: 'фаза {a}' },
          { a: visible[0] + 1 }
        )
      : translate(
          { id: 'benchmark.traces.zoom.where.many', message: 'фазы {a}–{b}' },
          { a: visible[0] + 1, b: visible[1] + 1 }
        );
  return (
    <>
      <div className={styles.zoomBar}>
        <div
          className={styles.zoomButtons}
          role="group"
          aria-label={translate({
            id: 'benchmark.traces.zoom.group',
            message: 'Масштаб по времени',
          })}
        >
          <button
            type="button"
            onClick={() => zoomBy(2, 0.5)}
            disabled={!zoomed}
            aria-label={translate({ id: 'benchmark.traces.zoom.out', message: 'Отдалить' })}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.5, 0.5)}
            disabled={span <= minSpan(total)}
            aria-label={translate({ id: 'benchmark.traces.zoom.in', message: 'Приблизить' })}
          >
            +
          </button>
          <button type="button" onClick={resetView} disabled={!zoomed}>
            <Translate id="benchmark.traces.zoom.reset">Весь трейс</Translate>
          </button>
        </div>
        <span className={styles.zoomInfo}>
          {zoomed
            ? translate(
                {
                  id: 'benchmark.traces.zoom.state',
                  message: '×{k} · {where} · двойной щелчок по графику — весь трейс',
                },
                { k: (total / span).toFixed(1), where }
              )
            : translate({
                id: 'benchmark.traces.zoom.hint',
                message:
                  'Выделите участок мышью или щёлкните номер фазы — он приблизится; Ctrl/⌘ + колесо — масштаб',
              })}
        </span>
      </div>
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
                'Графики трейсов: {form}. Стрелки влево и вправо двигают курсор, Shift — на 10 шагов, Home и End — к краям, Esc — скрыть; плюс и минус — масштаб, 0 — весь трейс.',
            },
            { form: t.formTitle(form) }
          )}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            hideSelection();
          }}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setCursor(null)}
          onDoubleClick={(e) => {
            if ((e.target as Element).closest('[data-plot]')) resetView();
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setCursor(null)}
        >
          <PhaseRuler trace={trace} view={view} onPhase={zoomToPhase} />
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
              yTop={yTop[m.id]}
              view={view}
              active={active}
              plotRef={i === 0 ? plotRef : undefined}
            />
          ))}
          {zoomed && (
            <Overview
              view={view}
              total={total}
              onMove={(x0) => setView((v) => clampView({ x0, x1: x0 + (v.x1 - v.x0) }, total))}
            />
          )}
          {cursor && (
            <Tooltip
              trace={trace}
              lines={lines}
              libs={libs}
              x={x}
              frac={frac}
              y={cursor.y}
              plotRef={plotRef}
              layerRef={layerRef}
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
    </>
  );
}

/**
 * Полоса-обзор под приближенными графиками: вся трасса и видимое окно. Окно тянется мышью, щелчок
 * мимо него ставит окно серединой туда. Движение не идёт в слой графиков — не двигает курсор.
 */
function Overview({
  view,
  total,
  onMove,
}: {
  view: View;
  total: number;
  onMove: (x0: number) => void;
}): ReactNode {
  const trackRef = useRef<HTMLDivElement>(null);
  const grab = useRef<number | null>(null);
  const msAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    return r?.width ? ((clientX - r.left) / r.width) * total : 0;
  };
  const span = view.x1 - view.x0;
  return (
    <div className={styles.row} aria-hidden="true">
      <span />
      <div
        ref={trackRef}
        className={styles.overview}
        onPointerDown={(e) => {
          e.stopPropagation();
          const ms = msAt(e.clientX);
          const inside = ms >= view.x0 && ms <= view.x1;
          grab.current = inside ? ms - view.x0 : span / 2;
          if (!inside) onMove(ms - span / 2);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (grab.current !== null) onMove(msAt(e.clientX) - grab.current);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          grab.current = null;
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span
          className={styles.overviewThumb}
          style={{ left: `${(view.x0 / total) * 100}%`, width: `${(span / total) * 100}%` }}
        />
      </div>
      <span />
    </div>
  );
}

/**
 * Номера фаз над графиками — над серединой окна фазы, если не налезают на предыдущий; при зуме —
 * только видимые. Щелчок по номеру приближает фазу.
 */
function PhaseRuler({
  trace,
  view,
  onPhase,
}: {
  trace: TraceForm;
  view: View;
  onPhase: (index: number) => void;
}): ReactNode {
  const span = view.x1 - view.x0;
  let last = -Infinity;
  const marks: Array<{ n: number; at: number }> = [];
  trace.phases.forEach((p, i) => {
    const at = ((p.offset + p.width / 2 - view.x0) / span) * 100;
    if (at < 0 || at > 100) return;
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
          <button
            type="button"
            tabIndex={-1}
            key={m.n}
            style={{ left: `${m.at}%` }}
            title={translate(
              { id: 'benchmark.traces.zoom.phase', message: 'Приблизить фазу {n}' },
              { n: m.n }
            )}
            onClick={() => onPhase(m.n - 1)}
          >
            {m.n}
          </button>
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
  /** Верх оси всей трассы — в нём построены пути линий. */
  yMax: number;
  /** Верх оси видимого окна: при зуме — по максимуму участка. */
  yTop: number;
  view: View;
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
  yTop,
  view,
  active,
  plotRef,
}: ChartProps): ReactNode {
  const { short: shortLabel } = useParticipants();
  const paths = useMemo(
    () =>
      Object.fromEntries(
        libs.map((lib) => [lib, pathOf(lines[lib]?.[metric.id] ?? [], trace.total, yMax)])
      ),
    [lines, libs, metric.id, trace.total, yMax]
  );
  // Подписи справа — значения на правом краю окна (без зума — конец трассы).
  const ends = useMemo(
    () =>
      spreadLabels(
        libs
          .map((lib) => ({ lib, v: valueAtOrBefore(lines[lib]?.[metric.id] ?? [], view.x1) }))
          .filter((e): e is { lib: string; v: number } => e.v !== null)
          .map((e) => ({ ...e, y: Math.min(1, Math.max(0, 1 - e.v / yTop)) * PLOT_PX })),
        LABEL_GAP,
        PLOT_PX
      ),
    [lines, libs, metric.id, yTop, view.x1]
  );
  // Окно — это viewBox: x — видимый участок трассы, y — от нуля до верха оси окна.
  const vx = (view.x0 / trace.total) * VB_W;
  const vw = ((view.x1 - view.x0) / trace.total) * VB_W;
  const vh = (yTop / yMax) * VB_H;
  const vy = VB_H - vh;
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
          {[yTop, yTop / 2, 0].map((v, i) => (
            <span key={i} style={{ top: `${(i / 2) * 100}%` }}>
              {tickText(v)}
            </span>
          ))}
        </div>
        <div ref={plotRef} className={styles.plot} data-plot="">
          <svg
            viewBox={`${vx} ${vy} ${vw} ${vh}`}
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
            {[vy, vy + vh / 2, VB_H].map((y, i) => (
              <line key={i} className={styles.grid} x1={0} x2={VB_W} y1={y} y2={y} />
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
          <span className={styles.selection} aria-hidden="true" />
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

/**
 * Заголовок подсказки. Внутри окна фазы время от её начала — отдельной строкой над названием:
 * число меняется при движении курсора, а название фазы остаётся на месте и не прыгает. Вне окна —
 * одна строка «после фазы N — вне замера».
 */
function TipHead({
  hit,
  form,
  t,
}: {
  hit: ReturnType<typeof phaseAt>;
  form: BenchForm;
  t: BenchText;
}): ReactNode {
  if (!hit || !hit.inWindow) {
    return (
      <div className={clsx(styles.tipHead, hit && styles.tipGap)}>{phaseLine(hit, form, t)}</div>
    );
  }
  const title = t.phaseTitle(form, hit.phase.id, hit.phase.title);
  return (
    <div className={styles.tipHead}>
      <div className={styles.tipSince}>
        {translate(
          { id: 'benchmark.traces.tip.since', message: '+{ms} мс от начала фазы' },
          { ms: Math.round(hit.since) }
        )}
      </div>
      {translate(
        { id: 'benchmark.traces.tip.phaseTitle', message: '{n}. {title}' },
        { n: hit.index + 1, title }
      )}
    </div>
  );
}

function tooltipText(
  trace: TraceForm,
  lines: Lines,
  libs: string[],
  x: number,
  hit: ReturnType<typeof phaseAt>,
  form: BenchForm,
  t: BenchText,
  libLabel: (lib: string) => string
): string {
  const rows = libs.map(
    (lib) =>
      `${libLabel(lib)}: ${METRICS.map((m) => `${m.title()} ${fmtValue(valueAt(lines[lib]?.[m.id] ?? [], x), m, t)}`).join(', ')}`
  );
  return [phaseLine(hit, form, t), ...rows].filter(Boolean).join('. ');
}

/** Отступ подсказки от перекрестья и от краёв окна, px. */
const TIP_GAP = 14;
const TIP_EDGE = 8;

function Tooltip({
  lines,
  libs,
  x,
  frac,
  y,
  hit,
  form,
  t,
  plotRef,
  layerRef,
}: {
  trace: TraceForm;
  lines: Lines;
  libs: string[];
  x: number;
  frac: number;
  /** Курсор по вертикали, px от верха слоя графиков. */
  y: number;
  hit: ReturnType<typeof phaseAt>;
  form: BenchForm;
  t: BenchText;
  plotRef: RefObject<HTMLDivElement | null>;
  layerRef: RefObject<HTMLDivElement | null>;
}): ReactNode {
  const { label: libLabel } = useParticipants();
  const ref = useRef<HTMLDivElement>(null);
  // Справа от перекрестья, у правого края окна — слева от него; по вертикали — у курсора. Размер
  // известен только после отрисовки, поэтому позиция ставится до кадра, а до неё подсказка скрыта.
  useLayoutEffect(() => {
    const node = ref.current;
    const plot = plotRef.current?.getBoundingClientRect();
    const layer = layerRef.current?.getBoundingClientRect();
    if (!node || !plot || !layer) return;
    const { width, height } = node.getBoundingClientRect();
    const anchorX = plot.left + plot.width * frac;
    let left = anchorX + TIP_GAP;
    if (left + width > window.innerWidth - TIP_EDGE) left = anchorX - TIP_GAP - width;
    left = Math.max(TIP_EDGE, Math.min(left, window.innerWidth - width - TIP_EDGE));
    const top = Math.max(
      TIP_EDGE,
      Math.min(layer.top + y - 12, window.innerHeight - height - TIP_EDGE)
    );
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.visibility = 'visible';
  });
  return createPortal(
    <div ref={ref} className={styles.tooltip} aria-hidden="true">
      <TipHead hit={hit} form={form} t={t} />
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
    </div>,
    document.body
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
  const { label: libLabel } = useParticipants();
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
              'Графики — один трассируемый проход на участника из прогона {run}, CPU {cpu}x: это не медиана, а форма кривой. Точные числа — в таблицах раздела «Все фазы».'
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
      <p>
        <Translate id="benchmark.traces.garbage">
          {
            'Счётчики — без принудительной сборки мусора: снятая форма остаётся в heap, DOM-узлах и обработчиках, пока её не соберёт GC, — отсюда «пила» и пики, утечку они не означают. Значения после GC — в таблицах фаз.'
          }
        </Translate>
      </p>
      <p>
        <Translate id="benchmark.traces.warmupHidden">
          {
            'Прогрев перед перемонтированием на графиках не показан. Это десятки монтирований и снятий формы подряд без замера: движок разогревает код (компилирует и оптимизирует функции), а снятые формы копятся в памяти, пока он их не соберёт, — линия ползёт вверх и похожа на утечку, хотя после сборки мусора всё возвращается к исходному уровню. Окно перемонтирования начинается после прогрева и принудительной сборки мусора.'
          }
        </Translate>
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
  const { label: libLabel } = useParticipants();
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

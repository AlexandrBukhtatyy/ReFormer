/**
 * Тепловая карта формы: строки — фазы, столбцы — участники, ячейка — во сколько раз участник
 * медленнее ReFormer core в среднем по метрикам фазы (heatmapScore.ts). Расходящаяся шкала: зелёное
 * плечо — ReFormer core быстрее, фиолетовое — медленнее, серая середина — разница меньше 5 % или не
 * доказана. Число и счёт ▲/▼ стоят в каждой ячейке, поэтому цвет — не единственный носитель.
 *
 * Это настоящая таблица: Tab попадает в сетку один раз, дальше стрелки (roving tabindex); Enter на
 * ячейке или кнопка с названием фазы раскрывает таблицу фазы ниже.
 */
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import clsx from 'clsx';
import Translate, { translate } from '@docusaurus/Translate';
import { LIB_ORDER, libStyle } from './colors';
import { type PhaseScore, type Tone, phaseScore, toneOf } from './heatmapScore';
import { type BenchText, useBenchText } from './i18n';
import { type BenchForm, CORE, type Section, fmt, libLabel, sigMark } from './types';
import bench from './bench.module.css';
import styles from './heatmap.module.css';

/** id раскрывающейся фазы в «Все фазы» — его ищет кнопка карты. */
export const phaseDomId = (form: string, phase: string) => `phase-${form}-${phase}`;

/** Раскрыть фазу и прокрутить к ней (без якорных ссылок: их проверяет сборка сайта). */
export function openPhase(form: string, phase: string): void {
  const el = document.getElementById(phaseDomId(form, phase));
  if (!(el instanceof HTMLDetailsElement)) return;
  el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.querySelector('summary')?.focus({ preventScroll: true });
}

const ratioText = (g: number) => `×${g.toFixed(2)}`;

function toneClass(tone: Tone): string {
  return tone.dir === 'mid' ? styles.mid : styles[`${tone.dir}${tone.level}`];
}

interface Tip {
  r: number;
  c: number;
  top: number;
  left: number;
}

export default function Heatmap({ form }: { form: BenchForm }): ReactNode {
  const t = useBenchText();
  const cols = LIB_ORDER.filter((lib) => lib !== CORE && form.libs.includes(lib));
  const grid = form.sections.map((section) => cols.map((lib) => phaseScore(section, lib)));
  const figRef = useRef<HTMLElement>(null);
  const cellRefs = useRef<Array<Array<HTMLTableCellElement | null>>>([]);
  const [focus, setFocus] = useState({ r: 0, c: 0 });
  const [tip, setTip] = useState<Tip | null>(null);

  const showTip = (r: number, c: number) => {
    const cell = cellRefs.current[r]?.[c];
    const fig = figRef.current;
    if (!cell || !fig || !grid[r][c]) {
      setTip(null);
      return;
    }
    const a = cell.getBoundingClientRect();
    const b = fig.getBoundingClientRect();
    setTip({ r, c, top: a.bottom - b.top + 6, left: a.left - b.left + a.width / 2 });
  };

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(form.sections.length - 1, r));
    const nc = Math.max(0, Math.min(cols.length - 1, c));
    setFocus({ r: nr, c: nc });
    cellRefs.current[nr]?.[nc]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableCellElement>, r: number, c: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(r, c + 1),
      ArrowLeft: () => move(r, c - 1),
      ArrowDown: () => move(r + 1, c),
      ArrowUp: () => move(r - 1, c),
      Home: () => move(r, 0),
      End: () => move(r, cols.length - 1),
      Enter: () => openPhase(form.id, form.sections[r].id),
      ' ': () => openPhase(form.id, form.sections[r].id),
      Escape: () => setTip(null),
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  };

  return (
    <figure ref={figRef} className={styles.heatmap}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>
          <Translate id="benchmark.heatmap.title">
            Сводка по фазам: во сколько раз участник медленнее ReFormer core
          </Translate>
        </span>
        <span className={styles.lead}>
          <Translate id="benchmark.heatmap.lead">
            Среднее геометрическое отношений медиан по метрикам фазы: ×1.34 — в среднем на 34 %
            медленнее, ×0.80 — на 20 % быстрее. Под числом — сколько метрик значимо хуже (▲) и лучше
            (▼) из всех сравнимых. Цвет — только когда разница больше 5 % и подтверждена
            значимостью. Наведите на ячейку — разбивка по метрикам; Enter или клик по фазе — её
            таблица.
          </Translate>
        </span>
      </figcaption>
      <HeatLegend />
      <div className={styles.wrap}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            <Translate id="benchmark.heatmap.caption" values={{ form: t.formTitle(form) }}>
              {'Отношение к ReFormer core по фазам: {form}'}
            </Translate>
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.phaseCol}>
                <Translate id="benchmark.heatmap.col.phase">Фаза</Translate>
              </th>
              {cols.map((lib) => (
                <th
                  key={lib}
                  scope="col"
                  style={libStyle(lib)}
                  className={clsx(lib === 'baseline' && styles.baselineCol)}
                >
                  <span className={styles.colHead}>
                    <span
                      className={clsx(bench.swatch, lib === 'baseline' && bench.swatchBaseline)}
                      aria-hidden="true"
                    />
                    {libLabel(lib)}
                  </span>
                  {lib === 'baseline' && (
                    <span className={styles.colSub}>
                      <Translate id="benchmark.heatmap.col.baseline">ориентир</Translate>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.sections.map((section, r) => (
              <tr key={section.id}>
                <th scope="row" className={styles.phaseCol}>
                  <button
                    type="button"
                    className={styles.phaseButton}
                    tabIndex={-1}
                    onClick={() => openPhase(form.id, section.id)}
                  >
                    {t.phaseTitle(form, section.id, section.title)}
                  </button>
                </th>
                {cols.map((lib, c) => {
                  const score = grid[r][c];
                  const baseline = lib === 'baseline';
                  const tone = score ? toneOf(score, !baseline) : null;
                  return (
                    <td
                      key={lib}
                      ref={(el) => {
                        (cellRefs.current[r] ??= [])[c] = el;
                      }}
                      tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                      aria-label={cellLabel(t, form, section, lib, score)}
                      className={clsx(
                        styles.cell,
                        tone && toneClass(tone),
                        baseline && styles.baselineCell,
                        tip?.r === r && tip?.c === c && styles.cellActive
                      )}
                      onPointerEnter={() => showTip(r, c)}
                      onPointerLeave={() => setTip(null)}
                      onFocus={() => {
                        setFocus({ r, c });
                        showTip(r, c);
                      }}
                      onBlur={() => setTip(null)}
                      onClick={() => openPhase(form.id, section.id)}
                      onKeyDown={(e) => onKeyDown(e, r, c)}
                    >
                      {score ? (
                        <>
                          <span className={styles.ratio}>{ratioText(score.g)}</span>
                          <span className={styles.counts}>
                            {baseline ? (
                              <Translate
                                id="benchmark.heatmap.cell.n"
                                values={{ n: score.n }}
                                description="Число сравнимых метрик фазы"
                              >
                                {'из {n}'}
                              </Translate>
                            ) : (
                              <>
                                ▲{score.up} ▼{score.down}
                                <span className={styles.countsOf}> · {score.n}</span>
                              </>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className={styles.none}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tip && grid[tip.r][tip.c] && (
        <HeatTip
          form={form}
          section={form.sections[tip.r]}
          lib={cols[tip.c]}
          score={grid[tip.r][tip.c] as PhaseScore}
          top={tip.top}
          left={tip.left}
          width={figRef.current?.clientWidth ?? 0}
          t={t}
        />
      )}
    </figure>
  );
}

function cellLabel(
  t: BenchText,
  form: BenchForm,
  section: Section,
  lib: string,
  score: PhaseScore | null
): string {
  const phase = t.phaseTitle(form, section.id, section.title);
  if (!score)
    return translate(
      { id: 'benchmark.heatmap.sr.none', message: '{lib}: нет сравнимых метрик в фазе «{phase}»' },
      { lib: libLabel(lib), phase }
    );
  if (lib === 'baseline')
    return translate(
      {
        id: 'benchmark.heatmap.sr.baseline',
        message:
          'baseline: {ratio} к ReFormer core, среднее по {n} метрикам фазы «{phase}»; значимость не проверяется',
      },
      { ratio: ratioText(score.g), n: score.n, phase }
    );
  const values = {
    lib: libLabel(lib),
    ratio: (score.g >= 1 ? score.g : 1 / score.g).toFixed(2),
    n: score.n,
    phase,
    up: score.up,
    down: score.down,
  };
  return score.g >= 1
    ? translate(
        {
          id: 'benchmark.heatmap.sr.slower',
          message:
            '{lib} медленнее ReFormer core в {ratio} раза, среднее по {n} метрикам фазы «{phase}»; значимо хуже в {up}, лучше в {down}',
        },
        values
      )
    : translate(
        {
          id: 'benchmark.heatmap.sr.faster',
          message:
            '{lib} быстрее ReFormer core в {ratio} раза, среднее по {n} метрикам фазы «{phase}»; значимо хуже в {up}, лучше в {down}',
        },
        values
      );
}

/** Разбивка ячейки по метрикам: медианы, отношение, значимость, шум. */
function HeatTip({
  form,
  section,
  lib,
  score,
  top,
  left,
  width,
  t,
}: {
  form: BenchForm;
  section: Section;
  lib: string;
  score: PhaseScore;
  top: number;
  left: number;
  width: number;
  t: BenchText;
}): ReactNode {
  // Подсказка шириной до 26rem: по центру ячейки, но в пределах карточки.
  const tipW = Math.min(416, width);
  const x = Math.max(0, Math.min(width - tipW, left - tipW / 2));
  return (
    <div className={styles.tip} style={{ top, left: x, width: tipW }} aria-hidden="true">
      <div className={styles.tipHead}>
        <Translate
          id="benchmark.heatmap.tip.head"
          values={{ lib: libLabel(lib), phase: t.phaseTitle(form, section.id, section.title) }}
        >
          {'{lib} против ReFormer core — {phase}'}
        </Translate>
      </div>
      <table className={styles.tipTable}>
        <thead>
          <tr>
            <th>
              <Translate id="benchmark.table.metric">Метрика</Translate>
            </th>
            <th>core</th>
            <th>{lib === 'reformer-json' ? 'JSON' : libLabel(lib)}</th>
            <th>×</th>
          </tr>
        </thead>
        <tbody>
          {score.metrics.map((m) => {
            const unit = form.metrics[`${section.kind}/${m.row.id}`]?.unit ?? '';
            return (
              <tr key={m.row.id}>
                <th scope="row">
                  {t.metricLabel(form, section.kind, m.row.id)}
                  {unit && t.unit(unit) && <span className={styles.tipUnit}>, {t.unit(unit)}</span>}
                  {m.row.noisy && (
                    <span className={styles.tipNoisy}>
                      {' '}
                      <Translate id="benchmark.heatmap.tip.noisy">шум</Translate>
                    </span>
                  )}
                </th>
                <td>{fmt(m.core, unit)}</td>
                <td>{fmt(m.value, unit)}</td>
                <td>
                  {ratioText(m.ratio)}
                  {m.sig !== 0 && ` ${sigMark(m.sig)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.tipFoot}>
        <Translate id="benchmark.heatmap.tip.foot" values={{ g: ratioText(score.g), n: score.n }}>
          {'Среднее геометрическое по {n}: {g}'}
        </Translate>
      </div>
    </div>
  );
}

/** Шкала: фиолетовое плечо ← серый → зелёное плечо, подписи порогов и baseline. */
function HeatLegend(): ReactNode {
  const steps: Array<{ cls: string; label: string }> = [
    { cls: styles.neg3, label: '≤×0.63' },
    { cls: styles.neg2, label: '×0.8' },
    { cls: styles.neg1, label: '×0.95' },
    { cls: styles.mid, label: '×1' },
    { cls: styles.pos1, label: '×1.05' },
    { cls: styles.pos2, label: '×1.25' },
    { cls: styles.pos3, label: '≥×1.6' },
  ];
  return (
    <div className={styles.legend}>
      <div className={styles.scale}>
        <div className={styles.scaleBar} aria-hidden="true">
          {steps.map((s) => (
            <span key={s.label} className={s.cls} />
          ))}
        </div>
        <div className={styles.scaleTicks} aria-hidden="true">
          {steps.map((s) => (
            <span key={s.label}>{s.label}</span>
          ))}
        </div>
        <div className={styles.scaleEnds}>
          <span>
            <Translate id="benchmark.heatmap.legend.slower">
              ← участник быстрее ReFormer core
            </Translate>
          </span>
          <span>
            <Translate id="benchmark.heatmap.legend.faster">ReFormer core быстрее →</Translate>
          </span>
        </div>
      </div>
      <ul className={styles.legendNotes}>
        <li>
          <span className={clsx(styles.legendChip, styles.mid)} aria-hidden="true" />
          <Translate id="benchmark.heatmap.legend.unproven">
            серый — разница меньше 5 % или не доказана значимостью
          </Translate>
        </li>
        <li>
          <span className={clsx(styles.legendChip, styles.legendBaseline)} aria-hidden="true" />
          <Translate id="benchmark.heatmap.legend.baseline">
            baseline — ориентир без библиотеки форм, значимость не проверяется
          </Translate>
        </li>
      </ul>
    </div>
  );
}

/**
 * Горизонтальные бары по участникам: длина — медиана по прогонам, ус — IQR (q25–q75), справа —
 * значение, отношение к лучшему и значок значимости против ReFormer core.
 *
 * Цвет участников не различает (их подписывает строка), а выделяет: ReFormer — акцентный цвет
 * сайта, конкуренты — нейтральный серый, baseline — контур. Лучший в строке — жирным, значимость —
 * знаком ▲/▼, поэтому ничего не передаётся одним цветом. Без библиотек графиков: бары — CSS, ширина
 * в процентах от максимума строки, поэтому график тянется от телефона до десктопа.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { translate } from '@docusaurus/Translate';
import { type Cell, fmt, fmtRatio, libLabel, roleOf, sigMark } from './types';
import styles from './bench.module.css';

export interface BarRow {
  lib: string;
  cell: Cell;
}

interface Props {
  /** Заголовок над графиком (фаза), мелко. */
  kicker?: ReactNode;
  /** Подпись метрики. */
  title: ReactNode;
  /** Единица из данных (мс, КБ, шт) — для форматирования; `unitLabel` — для подписи. */
  unit: string;
  unitLabel: string;
  rows: BarRow[];
  best?: string;
  /** Компактный вид для лендинга: без усов и отношения, бары тоньше. */
  compact?: boolean;
  /** Подписи значений без отношения к лучшему (например, КБ бандла). */
  showRatio?: boolean;
  /** Своё форматирование значения; по умолчанию — как в отчёте (`fmt`). */
  format?: (v: number | null) => string;
}

export function sigTitle(sig: -1 | 0 | 1): string {
  return sig === 1
    ? translate({
        id: 'benchmark.sig.worse',
        message: 'значимо хуже ReFormer core',
      })
    : sig === -1
      ? translate({
          id: 'benchmark.sig.better',
          message: 'значимо лучше ReFormer core',
        })
      : '';
}

export default function BarChart({
  kicker,
  title,
  unit,
  unitLabel,
  rows,
  best,
  compact = false,
  showRatio = true,
  format,
}: Props): ReactNode {
  const show = format ?? ((v: number | null) => fmt(v, unit));
  const present = rows.filter((r) => r.cell[0] !== null);
  const max = Math.max(
    ...present.map((r) => Math.max(r.cell[0] ?? 0, compact ? 0 : (r.cell[2] ?? 0))),
    0
  );
  const pos = (v: number | null) =>
    v === null || !max ? 0 : Math.max(0, Math.min(100, (v / max) * 100));
  const suffix = unitLabel ? ` ${unitLabel}` : '';

  return (
    <figure className={clsx(styles.chart, compact && styles.chartCompact)}>
      {(kicker || title) && (
        <figcaption className={styles.chartCaption}>
          {kicker && <span className={styles.chartKicker}>{kicker}</span>}
          <span className={styles.chartTitle}>
            {title}
            {unitLabel && <span className={styles.chartUnit}>, {unitLabel}</span>}
          </span>
        </figcaption>
      )}
      <div className={styles.bars} role="list">
        {present.map(({ lib, cell }) => {
          const [med, q25, q75, ratio, sig] = cell;
          const role = roleOf(lib);
          const isBest = lib === best;
          const tip =
            q25 === null || q75 === null
              ? `${libLabel(lib)}: ${show(med)}${suffix}`
              : translate(
                  {
                    id: 'benchmark.chart.tooltip',
                    message: '{lib}: медиана {median}, IQR {q25}–{q75}{unit}',
                  },
                  {
                    lib: libLabel(lib),
                    median: `${show(med)}${suffix}`,
                    q25: show(q25),
                    q75: show(q75),
                    unit: suffix,
                  }
                );
          return (
            <div
              key={lib}
              role="listitem"
              title={tip}
              className={clsx(
                styles.barRow,
                styles[`role_${role}`],
                lib === 'reformer-core' && styles.libCore,
                isBest && styles.barBest
              )}
            >
              <span className={styles.barName}>{libLabel(lib)}</span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${pos(med)}%` }} />
                {!compact && q25 !== null && q75 !== null && (
                  <span
                    className={styles.whisker}
                    style={{ left: `${pos(q25)}%`, width: `${Math.max(0, pos(q75) - pos(q25))}%` }}
                  />
                )}
              </span>
              <span className={styles.barValue}>
                <span className={styles.barNumber}>
                  {show(med)}
                  {compact && suffix}
                </span>
                {showRatio && !compact && role !== 'baseline' && ratio !== null && (
                  <span className={styles.barRatio}>{fmtRatio(ratio)}</span>
                )}
                {!compact && sig !== 0 && (
                  <span className={styles.barSig} title={sigTitle(sig)}>
                    {sigMark(sig)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

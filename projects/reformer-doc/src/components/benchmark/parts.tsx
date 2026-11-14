import type { ReactNode } from 'react';
import clsx from 'clsx';
import Translate from '@docusaurus/Translate';
import BarChart from './BarChart';
import { type Tile, bundleClaim } from './highlights';
import { useBenchText } from './i18n';
import { CORE, fmt, libLabel } from './types';
import styles from './bench.module.css';

/** «A, B и C» / «A, B and C». */
export function joinNames(names: string[], isEn: boolean): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')}${isEn ? ' and ' : ' и '}${names.at(-1)}`;
}

/** «92–143» — диапазон значений в формате отчёта. */
export function valueRange(values: number[], unit: string): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? fmt(lo, unit) : `${fmt(lo, unit)}–${fmt(hi, unit)}`;
}

/** Дата прогона из ISO-строки — одинаково на сервере и в браузере (UTC). */
export function formatDate(iso: string, isEn: boolean): string {
  return new Intl.DateTimeFormat(isEn ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/** Легенда графиков: цвет + форма маркера + текст — не только цвет. */
export function Legend(): ReactNode {
  return (
    <ul className={styles.legend}>
      <li>
        <span className={clsx(styles.swatch, styles.swatchCore)} aria-hidden="true" />
        <Translate id="benchmark.legend.reformer">ReFormer (core и JSON)</Translate>
      </li>
      <li>
        <span className={styles.swatch} aria-hidden="true" />
        <Translate id="benchmark.legend.rivals">Formik, RHF, RJSF</Translate>
      </li>
      <li>
        <span className={clsx(styles.swatch, styles.swatchBaseline)} aria-hidden="true" />
        <Translate id="benchmark.legend.baseline">
          baseline — та же разметка без библиотеки форм
        </Translate>
      </li>
      <li>
        <span className={styles.swatchWhisker} aria-hidden="true" />
        <Translate id="benchmark.legend.iqr">разброс по прогонам (q25–q75)</Translate>
      </li>
      <li>
        <Translate id="benchmark.legend.sig">
          ▲ / ▼ — значимо хуже / лучше ReFormer core; без значка — разница не доказана
        </Translate>
      </li>
    </ul>
  );
}

/** Счёт ReFormer core против одного конкурента по всем строкам отчёта. */
export function ScoreTile({
  rival,
  wins,
  losses,
  ties,
}: {
  rival: string;
  wins: number;
  losses: number;
  ties: number;
}): ReactNode {
  const total = wins + losses + ties;
  const share = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <div className={styles.scoreTile}>
      <div className={styles.scoreHead}>
        <span>
          <Translate
            id="benchmark.score.vs"
            values={{ rival: <span className={styles.scoreRival}>{libLabel(rival)}</span> }}
          >
            {'против {rival}'}
          </Translate>
        </span>
        <span>
          <Translate id="benchmark.score.rows" values={{ total }}>
            {'{total} строк'}
          </Translate>
        </span>
      </div>
      <div className={styles.scoreValue}>
        {wins}
        <span className={styles.scoreValueOf}>
          {' '}
          <Translate id="benchmark.score.winsLabel">— ReFormer core значимо быстрее</Translate>
        </span>
      </div>
      <div className={styles.scoreBar} aria-hidden="true">
        {wins > 0 && <span className={styles.scoreWin} style={{ flexBasis: share(wins) }} />}
        {ties > 0 && <span className={styles.scoreTie} style={{ flexBasis: share(ties) }} />}
        {losses > 0 && <span className={styles.scoreLoss} style={{ flexBasis: share(losses) }} />}
      </div>
      <ul className={styles.scoreLegend}>
        <li>
          <span className={clsx(styles.dot, styles.scoreWin)} aria-hidden="true" />
          <Translate id="benchmark.score.wins" values={{ n: <b>{wins}</b> }}>
            {'быстрее: {n}'}
          </Translate>
        </li>
        <li>
          <span className={clsx(styles.dot, styles.scoreTie)} aria-hidden="true" />
          <Translate id="benchmark.score.ties" values={{ n: <b>{ties}</b> }}>
            {'не доказано: {n}'}
          </Translate>
        </li>
        <li>
          <span className={clsx(styles.dot, styles.scoreLoss)} aria-hidden="true" />
          <Translate id="benchmark.score.losses" values={{ n: <b>{losses}</b> }}>
            {'медленнее: {n}'}
          </Translate>
        </li>
      </ul>
    </div>
  );
}

/**
 * Плитка лендинга. Формулировки привязаны к id плитки (форма и фаза задаются в highlights.ts —
 * меняя их там, поправьте и текст здесь); числа — из данных.
 */
export function HighlightTile({ tile }: { tile: Tile }): ReactNode {
  const t = useBenchText();
  const unit = t.unit(tile.unit);
  const byRatio = [...tile.rivals].sort((a, b) => a.ratio - b.ratio);
  const rivals = joinNames(
    byRatio.map((r) => libLabel(r.lib)),
    t.isEn
  );
  const core = fmt(tile.core, tile.unit);
  const others = valueRange(
    byRatio.map((r) => r.value),
    tile.unit
  );

  let value: ReactNode = `${tile.factor}×`;
  let claim: ReactNode;
  let context: ReactNode;
  switch (tile.id) {
    case 'ready':
      claim = (
        <Translate id="homepage.benchmark.ready.claim" values={{ rivals }}>
          {'быстрее до готовой формы, чем {rivals}'}
        </Translate>
      );
      context = (
        <Translate id="homepage.benchmark.ready.context" values={{ core, others, unit }}>
          {'Регистрация, холодная загрузка: {core} против {others} {unit}'}
        </Translate>
      );
      break;
    case 'arrayAdd':
      claim = (
        <Translate id="homepage.benchmark.arrayAdd.claim" values={{ rivals }}>
          {'меньше JS на добавление строк массива, чем у {rivals}'}
        </Translate>
      );
      context = (
        <Translate id="homepage.benchmark.arrayAdd.context" values={{ core, others, unit }}>
          {'Кредитная заявка, массив имущества: {core} против {others} {unit} JS'}
        </Translate>
      );
      break;
    case 'wizardStep':
      claim = (
        <Translate id="homepage.benchmark.wizardStep.claim" values={{ rivals }}>
          {'быстрее переход на следующий шаг визарда, чем у {rivals}'}
        </Translate>
      );
      context = (
        <Translate id="homepage.benchmark.wizardStep.context" values={{ core, others, unit }}>
          {'Кредитная заявка, «Далее» на шаг 2 до затихания UI: {core} против {others} {unit}'}
        </Translate>
      );
      break;
    case 'bundle': {
      value = (
        <>
          +{tile.factor}
          <span className={styles.tileValueUnit}>{unit}</span>
        </>
      );
      const kind = bundleClaim(tile);
      claim =
        kind === 'level' ? (
          <Translate id="homepage.benchmark.bundle.claimLevel">
            gzip сверх React без библиотеки форм — на уровне Formik
          </Translate>
        ) : kind === 'smallest' ? (
          <Translate id="homepage.benchmark.bundle.claimSmallest">
            gzip сверх React без библиотеки форм — меньше всех конкурентов
          </Translate>
        ) : (
          <Translate id="homepage.benchmark.bundle.claimPlain">
            gzip сверх React без библиотеки форм
          </Translate>
        );
      context = (
        <Translate id="homepage.benchmark.bundle.context">
          Регистрация: prod-бандл страницы минус та же страница без библиотеки форм
        </Translate>
      );
      break;
    }
  }

  return (
    <div className={styles.tile}>
      <div className={styles.tileValue}>{value}</div>
      <p className={styles.tileClaim}>{claim}</p>
      <p className={styles.tileContext}>{context}</p>
      <BarChart
        title={null}
        unit={tile.unit}
        unitLabel={unit}
        rows={tile.bars}
        best={CORE}
        compact
        // Бандл — до десятых КБ, как число плитки; остальное — как в отчёте.
        format={tile.id === 'bundle' ? (v) => (v === null ? '—' : v.toFixed(1)) : undefined}
      />
    </div>
  );
}

import type { ReactNode } from 'react';
import clsx from 'clsx';
import Translate, { translate } from '@docusaurus/Translate';
import { usePluralForm } from '@docusaurus/theme-common';
import BarChart from './BarChart';
import { LIB_ORDER, isDashed, libStyle } from './colors';
import { type Tile, sizeClaim } from './highlights';
import { useBenchText } from './i18n';
import { CORE, fmt, libLabel } from './types';
import styles from './bench.module.css';

/** «A, B и C» / «A, B and C». */
export function joinNames(names: string[], isEn: boolean): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')}${isEn ? ' and ' : ' и '}${names.at(-1)}`;
}

/** «92–143» — диапазон значений в формате отчёта (или в своём `format`). */
export function valueRange(
  values: number[],
  unit: string,
  format: (v: number) => string = (v) => fmt(v, unit)
): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // U+2060 по бокам тире: диапазон не переносится по «–».
  return lo === hi ? format(lo) : `${format(lo)}⁠–⁠${format(hi)}`;
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

/** Образцы цветов участников: имя рядом с цветом, baseline — контуром (`line` — линией). */
export function LibSwatches({ line = false }: { line?: boolean }): ReactNode {
  return (
    <>
      {LIB_ORDER.map((lib) => (
        <li key={lib} style={libStyle(lib)}>
          <span
            className={clsx(
              line ? styles.swatchLine : styles.swatch,
              isDashed(lib) && styles.swatchBaseline
            )}
            aria-hidden="true"
          />
          {lib === 'baseline' ? (
            <Translate id="benchmark.legend.baseline">
              baseline — та же разметка без библиотеки форм
            </Translate>
          ) : (
            libLabel(lib)
          )}
        </li>
      ))}
    </>
  );
}

/** Легенда графиков: цвет + форма маркера + текст — не только цвет. */
export function Legend(): ReactNode {
  return (
    <ul className={styles.legend}>
      <LibSwatches />
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
 * Плитка лендинга. Формулировки привязаны к id плитки (форма и метрика задаются в highlights.ts —
 * меняя их там, поправьте и текст здесь); числа — из данных.
 */
export function HighlightTile({ tile }: { tile: Tile }): ReactNode {
  const t = useBenchText();
  const { selectMessage } = usePluralForm();
  const unit = t.unit(tile.unit);
  // Рендеры — целые штуки; остальное — как в отчёте.
  const num = (v: number) => (tile.id === 'renders' ? v.toFixed(0) : fmt(v, tile.unit));
  const byRatio = [...tile.rivals].sort((a, b) => a.ratio - b.ratio);
  const rivals = joinNames(
    byRatio.map((r) => libLabel(r.lib)),
    t.isEn
  );
  const core = num(tile.core);
  const others = valueRange(
    byRatio.map((r) => r.value),
    tile.unit,
    num
  );
  const size = sizeClaim(tile);
  const rival = size.kind === 'level' ? libLabel(size.lib) : '';
  const overValue = (
    <>
      +{tile.factor}
      <span className={styles.tileValueUnit}>{unit}</span>
    </>
  );

  let value: ReactNode = `${tile.factor}×`;
  let claim: ReactNode;
  let context: ReactNode;
  let caveat: ReactNode = null;
  switch (tile.id) {
    case 'ready': {
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
      const remount = tile.caveat;
      if (remount)
        caveat = (
          <Translate
            id="homepage.benchmark.ready.caveat"
            values={{
              rivals: joinNames(
                remount.rivals.map((r) => libLabel(r.lib)),
                t.isEn
              ),
              others: valueRange(
                remount.rivals.map((r) => r.value),
                remount.unit
              ),
              core: fmt(remount.core, remount.unit),
              unit: t.unit(remount.unit),
            }}
          >
            {'Перемонтирование готовой формы быстрее у {rivals}: {others} против {core} {unit}'}
          </Translate>
        );
      break;
    }
    case 'bundle':
      value = overValue;
      claim =
        size.kind === 'level' ? (
          <Translate id="homepage.benchmark.bundle.claimLevel" values={{ rival }}>
            {'gzip сверх React без библиотеки форм — на уровне {rival}'}
          </Translate>
        ) : size.kind === 'smallest' ? (
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
    case 'renders':
      value = (
        <>
          {tile.factor}
          <span className={styles.tileValueUnit}>
            {selectMessage(
              tile.core,
              translate({
                id: 'homepage.benchmark.renders.unit',
                message: 'рендер|рендера|рендеров',
                description: 'Plural forms of the word after the render count on the landing tile',
              })
            )}
          </span>
        </>
      );
      claim =
        size.kind === 'level' ? (
          <Translate id="homepage.benchmark.renders.claimLevel" values={{ rival }}>
            {'при монтировании формы — на уровне {rival}'}
          </Translate>
        ) : size.kind === 'smallest' ? (
          <Translate id="homepage.benchmark.renders.claimSmallest">
            при монтировании формы — меньше всех конкурентов
          </Translate>
        ) : (
          <Translate id="homepage.benchmark.renders.claimPlain">при монтировании формы</Translate>
        );
      context = (
        <Translate
          id="homepage.benchmark.renders.context"
          values={{ core, others, baseline: tile.baseline ?? '—' }}
        >
          {
            'Регистрация, рендеры React-компонентов при первом показе формы: {core} против {others}; та же разметка без библиотеки форм — {baseline}'
          }
        </Translate>
      );
      break;
    case 'memory':
      value = overValue;
      claim =
        size.kind === 'level' ? (
          <Translate id="homepage.benchmark.memory.claimLevel" values={{ rival }}>
            {'JS heap сверх React без библиотеки форм — на уровне {rival}'}
          </Translate>
        ) : size.kind === 'smallest' ? (
          <Translate id="homepage.benchmark.memory.claimSmallest">
            JS heap сверх React без библиотеки форм — меньше всех конкурентов
          </Translate>
        ) : (
          <Translate id="homepage.benchmark.memory.claimPlain">
            JS heap сверх React без библиотеки форм
          </Translate>
        );
      context = (
        <Translate id="homepage.benchmark.memory.context">
          Регистрация: память JS после загрузки и сборки мусора минус та же страница без библиотеки
          форм
        </Translate>
      );
      break;
  }

  return (
    <div className={styles.tile}>
      <div className={styles.tileValue}>{value}</div>
      <p className={styles.tileClaim}>{claim}</p>
      <p className={styles.tileContext}>{context}</p>
      {caveat && <p className={styles.tileCaveat}>{caveat}</p>}
      <BarChart
        title={null}
        unit={tile.unit}
        // У рендеров числа без «шт»: что считается, говорит число плитки.
        unitLabel={tile.id === 'renders' ? '' : unit}
        rows={tile.bars}
        best={CORE}
        compact
        // Бандл — до десятых КБ, рендеры — целые, как число плитки; остальное — как в отчёте.
        format={
          tile.id === 'bundle'
            ? (v) => (v === null ? '—' : v.toFixed(1))
            : tile.id === 'renders'
              ? (v) => (v === null ? '—' : v.toFixed(0))
              : undefined
        }
      />
    </div>
  );
}

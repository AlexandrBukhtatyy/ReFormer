/**
 * Раздел замеров MCP на лендинге — сразу под бенчмарком форм и устроен так же: плитки из данных
 * опубликованного отчёта /docs/mcp/benchmark и ссылка на него. Числа — из headline.ts (те же
 * формулы, что у плиток «Итога» отчёта), руками ничего не вписано. Рядом с утверждениями —
 * оговорка, где MCP почти ничего не меняет: правка и удаление проходят и без него.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import { useBenchText } from '@site/src/components/benchmark/i18n';
import { formatDate } from '@site/src/components/benchmark/parts';
import benchStyles from '@site/src/components/benchmark/bench.module.css';
import landingStyles from '@site/src/components/benchmark/LandingBenchmark.module.css';
import { fmtUsd, proseNumber } from './format';
import { MCP_HEADLINE as H } from './headline';
import styles from './LandingMcp.module.css';

interface Bar {
  value: number;
  label: string;
}

interface TileProps {
  kicker: ReactNode;
  value: ReactNode;
  claim: ReactNode;
  context: ReactNode;
  caveat?: ReactNode;
  /** Значения плеч: без MCP и с MCP. */
  none: Bar;
  dsl: Bar;
}

function McpTile({ kicker, value, claim, context, caveat, none, dsl }: TileProps): ReactNode {
  const max = Math.max(none.value, dsl.value, 0);
  const width = (v: number) => `${max ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`;
  const rows = [
    {
      key: 'none',
      name: translate({ id: 'homepage.mcp.arm.none', message: 'без MCP' }),
      bar: none,
      mcp: false,
    },
    {
      key: 'dsl',
      name: translate({ id: 'homepage.mcp.arm.dsl', message: 'с MCP' }),
      bar: dsl,
      mcp: true,
    },
  ];
  return (
    <div className={benchStyles.tile}>
      <span className={styles.tileKicker}>{kicker}</span>
      <div className={benchStyles.tileValue}>{value}</div>
      <p className={benchStyles.tileClaim}>{claim}</p>
      <p className={benchStyles.tileContext}>{context}</p>
      <ul className={styles.bars}>
        {rows.map((row) => (
          <li className={styles.bar} key={row.key}>
            <span>{row.name}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <span
                className={clsx(styles.barFill, row.mcp && styles.barFillMcp)}
                style={{ width: width(row.bar.value) }}
              />
            </span>
            <span className={styles.barValue}>{row.bar.label}</span>
          </li>
        ))}
      </ul>
      {caveat && <p className={benchStyles.tileCaveat}>{caveat}</p>}
    </div>
  );
}

export default function LandingMcp(): ReactNode {
  const t = useBenchText();
  const { none, dsl } = H;
  const num = (v: number) => new Intl.NumberFormat(t.isEn ? 'en-US' : 'ru-RU').format(v);
  const min = translate({ id: 'homepage.mcp.unit.min', message: 'мин' });
  const sec = translate({ id: 'homepage.mcp.unit.sec', message: 'с' });
  // Минуты всех прогонов — целыми, медиана прогона — в секундах: доли минуты читаются хуже.
  const minutes = (v: number) =>
    v < 10 ? proseNumber(v.toFixed(1), t.isEn) : Math.round(v).toString();
  const seconds = (v: number | null) => (v === null ? '—' : Math.round(v * 60).toString());
  return (
    <section className={styles.section}>
      <div className="container">
        <p className={landingStyles.kicker}>
          <Translate
            id="homepage.mcp.kicker"
            values={{ date: H.date ? formatDate(H.date, t.isEn) : '—' }}
          >
            {'Замеры MCP · {date}'}
          </Translate>
        </p>
        <Heading as="h2" className={landingStyles.title}>
          <Translate id="homepage.mcp.title">ИИ-ассистент с MCP-сервером и без него</Translate>
        </Heading>
        <p className={landingStyles.lead}>
          <Translate id="homepage.mcp.lead">
            Один и тот же агент — Claude Sonnet в Claude Code — создаёт, правит и удаляет формы
            ReFormer: в одном плече только по пакетам и их документации, в другом — с MCP-сервером.
            Каждый прогон проверяет один верификатор: сборка, типы и поведение формы.
          </Translate>
        </p>
        <div className={landingStyles.tiles}>
          <McpTile
            kicker={<Translate id="homepage.mcp.quality.kicker">Качество</Translate>}
            value={`${H.quality.dsl}%`}
            claim={
              <Translate id="homepage.mcp.quality.claim" values={{ none: H.quality.none }}>
                {'прогонов проходят все проверки с MCP — без него {none}%'}
              </Translate>
            }
            context={
              <Translate
                id="homepage.mcp.quality.context"
                values={{
                  dsl: H.create.dsl.passes,
                  none: H.create.none.passes,
                  runs: H.create.dsl.runs,
                }}
              >
                {'Создание формы: {dsl} из {runs} с MCP против {none} из {runs} без него'}
              </Translate>
            }
            caveat={
              <Translate
                id="homepage.mcp.quality.caveat"
                values={{
                  none: H.changes.none.passes,
                  dsl: H.changes.dsl.passes,
                  runs: H.changes.dsl.runs,
                }}
              >
                {
                  'Правку и удаление готовой формы и без MCP проходят почти всегда: {none} из {runs} против {dsl} из {runs} — выигрыш в основном на создании'
                }
              </Translate>
            }
            none={{ value: H.quality.none, label: `${H.quality.none}%` }}
            dsl={{ value: H.quality.dsl, label: `${H.quality.dsl}%` }}
          />
          <McpTile
            kicker={<Translate id="homepage.mcp.speed.kicker">Скорость</Translate>}
            value={H.speed}
            claim={
              <Translate
                id="homepage.mcp.speed.claim"
                values={{ dsl: minutes(dsl.minutesTotal), none: minutes(none.minutesTotal), min }}
              >
                {'быстрее: все прогоны — {dsl} {min} против {none}'}
              </Translate>
            }
            context={
              <Translate
                id="homepage.mcp.speed.context"
                values={{
                  dsl: seconds(dsl.minutesMedian),
                  none: seconds(none.minutesMedian),
                  sec,
                }}
              >
                {'Медиана прогона: {dsl} против {none} {sec}'}
              </Translate>
            }
            none={{
              value: none.minutesTotal,
              label: `${minutes(none.minutesTotal)} ${min}`,
            }}
            dsl={{ value: dsl.minutesTotal, label: `${minutes(dsl.minutesTotal)} ${min}` }}
          />
          <McpTile
            kicker={<Translate id="homepage.mcp.cost.kicker">Стоимость</Translate>}
            value={H.cost}
            claim={
              <Translate
                id="homepage.mcp.cost.claim"
                values={{ dsl: fmtUsd(dsl.costTotal), none: fmtUsd(none.costTotal) }}
              >
                {'дешевле: {dsl} против {none} за все прогоны'}
              </Translate>
            }
            context={
              <Translate
                id="homepage.mcp.cost.context"
                values={{ dsl: fmtUsd(dsl.costPerPass), none: fmtUsd(none.costPerPass) }}
              >
                {'За пройденный прогон: {dsl} против {none}'}
              </Translate>
            }
            none={{ value: none.costTotal ?? 0, label: fmtUsd(none.costTotal) }}
            dsl={{ value: dsl.costTotal ?? 0, label: fmtUsd(dsl.costTotal) }}
          />
          <McpTile
            kicker={<Translate id="homepage.mcp.tokens.kicker">Токены</Translate>}
            value={H.tokens}
            claim={
              <Translate id="homepage.mcp.tokens.claim">
                меньше выходных токенов на прогон, по медиане
              </Translate>
            }
            context={
              <Translate
                id="homepage.mcp.tokens.context"
                values={{ dsl: num(dsl.inputMedian), none: num(none.inputMedian) }}
              >
                {'На входе вместе с кэшем: {dsl} против {none}'}
              </Translate>
            }
            none={{ value: none.outputMedian, label: num(none.outputMedian) }}
            dsl={{ value: dsl.outputMedian, label: num(dsl.outputMedian) }}
          />
        </div>
        <p className={styles.takeaway}>
          <strong>
            <Translate id="homepage.mcp.opus.lead">Сильная модель не заменяет сервер.</Translate>
          </strong>{' '}
          <Translate
            id="homepage.mcp.opus.text"
            values={{
              sonnet: H.quality.dsl,
              sonnetCost: fmtUsd(dsl.costTotal),
              opus: H.opus.quality,
              opusCost: fmtUsd(H.opus.costTotal),
              ratio: proseNumber(H.opus.costRatio, t.isEn),
            }}
          >
            {
              'Claude Sonnet с MCP проходит {sonnet}% прогонов за {sonnetCost}, Claude Opus без MCP — {opus}% за {opusCost}, в {ratio} раза дороже.'
            }
          </Translate>
        </p>
        <p className={landingStyles.footnote}>
          <Translate
            id="homepage.mcp.footnote"
            values={{
              scenarios: H.scenarios,
              targets: H.targets,
              repeats: H.repeats,
              runs: H.runs,
            }}
          >
            {
              'Сценариев: {scenarios}, стеков: {targets}, повторов: {repeats}, прогонов на плечо: {runs} · отчёт разбирает и провалы'
            }
          </Translate>
        </p>
        <div className={landingStyles.cta}>
          <Link className="button button--primary button--lg" to="/docs/mcp/benchmark">
            <Translate id="homepage.mcp.cta">Смотреть отчёт →</Translate>
          </Link>
        </div>
      </div>
    </section>
  );
}

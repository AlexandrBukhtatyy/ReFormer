/**
 * Страница-список бенчмарков: карточка на отчёт — что сравнивается, дата прогона и главные числа.
 * Числа берутся из данных отчётов, а не пишутся руками, и считаются теми же функциями, что в самих
 * отчётах: у отчёта форм — плитки лендинга (highlights.ts, useTileText), у замеров MCP — формулы
 * плиток «Итога» (mcp-benchmark/format.ts).
 *
 * Новый отчёт — запись в REPORTS. Отчёт без адреса (`to`) показывается как готовящийся.
 */
import type { ComponentType, ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import { usePluralForm } from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import headline from '@site/src/data/forms-benchmark-headline.json';
import frameworksHeadline from '@site/src/data/frameworks-benchmark-headline.json';
import mcpJson from '@site/src/data/mcp-benchmark.json';
import { type Tile, type TileId, computeTiles } from '@site/src/components/benchmark/highlights';
import { useBenchText } from '@site/src/components/benchmark/i18n';
import { formatDate, useTileText, valueRange } from '@site/src/components/benchmark/parts';
import { FRAMEWORKS_PARITY_TESTS } from '@site/src/components/benchmark/participants';
import { passRate, timesLabel as times } from '@site/src/components/mcp-benchmark/format';
import type { McpBenchData } from '@site/src/components/mcp-benchmark/types';

import styles from './index.module.css';

interface Report {
  id: string;
  /** Адрес отчёта; нет адреса — отчёт готовится. */
  to?: string;
  kicker: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** Строка под заголовком: дата прогона и охват. */
  Meta?: ComponentType;
  /** Главные числа отчёта. */
  Stats?: ComponentType;
  tags?: string[];
}

/** Одно число карточки: значение крупно, под ним — что оно значит. */
function Stat({ value, caption }: { value: ReactNode; caption: ReactNode }): ReactNode {
  return (
    <li className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statCaption}>{caption}</span>
    </li>
  );
}

// ── Бенчмарк форм ───────────────────────────────────────────────────────────

/** Плитки лендинга, которые попадают в карточку, — в этом порядке. */
const FORM_TILES: TileId[] = ['ready', 'bundle', 'renders'];

function FormsStat({ tile }: { tile: Tile }): ReactNode {
  const { value, claim } = useTileText(tile);
  return <Stat value={value} caption={claim} />;
}

function FormsStats(): ReactNode {
  const tiles = computeTiles(headline);
  const shown = FORM_TILES.flatMap((id) => tiles.filter((tile) => tile.id === id));
  return (
    <>
      <ul className={styles.stats}>
        {shown.map((tile) => (
          <FormsStat key={tile.id} tile={tile} />
        ))}
      </ul>
      <p className={styles.statsNote}>
        <Translate id="benchmark.hub.forms.statsNote">
          Числа — ReFormer core на форме регистрации
        </Translate>
      </p>
    </>
  );
}

function FormsMeta(): ReactNode {
  const t = useBenchText();
  const { meta } = headline;
  return (
    <Translate
      id="benchmark.hub.forms.meta"
      values={{
        date: formatDate(meta.generatedAt, t.isEn),
        cpu: Math.max(...meta.cpuRates),
        runs: meta.iterations,
      }}
    >
      {'{date} · CPU {cpu}x · медианы по {runs} прогонам'}
    </Translate>
  );
}

// ── Замеры MCP ──────────────────────────────────────────────────────────────

/** Основной замер — Claude Sonnet (список моделей отчёта — mcp-benchmark/models.ts). */
const mcp = mcpJson as unknown as McpBenchData;
const MCP_MODELS: Record<string, string> = { sonnet: 'Claude Sonnet', opus: 'Claude Opus' };
const NO_MCP = mcp.summary['no-mcp'];
const WITH_MCP = mcp.summary['mcp-dsl'];

function McpStats(): ReactNode {
  return (
    <ul className={styles.stats}>
      <Stat
        value={`${passRate(WITH_MCP)}%`}
        caption={
          <Translate id="benchmark.hub.mcp.quality" values={{ none: passRate(NO_MCP) }}>
            {'прогонов проходят все проверки с MCP против {none}% без него'}
          </Translate>
        }
      />
      <Stat
        value={times(NO_MCP.minutesTotal, WITH_MCP.minutesTotal)}
        caption={
          <Translate id="benchmark.hub.mcp.speed">быстрее с MCP: время всех прогонов</Translate>
        }
      />
      <Stat
        value={times(NO_MCP.costTotal, WITH_MCP.costTotal)}
        caption={
          <Translate id="benchmark.hub.mcp.cost">дешевле с MCP: стоимость всех прогонов</Translate>
        }
      />
    </ul>
  );
}

function McpMeta(): ReactNode {
  const t = useBenchText();
  const { selectMessage } = usePluralForm();
  const runs = NO_MCP.runs + WITH_MCP.runs;
  return (
    <Translate
      id="benchmark.hub.mcp.meta"
      values={{
        date: mcp.date ? formatDate(mcp.date, t.isEn) : '—',
        model: MCP_MODELS[mcp.model] ?? mcp.model,
        runs: `${runs} ${selectMessage(
          runs,
          translate({
            id: 'benchmark.hub.mcp.runs',
            message: 'прогон|прогона|прогонов',
            description: 'Plural forms of the word after the run count on the MCP report card',
          })
        )}`,
      }}
    >
      {'{date} · {model} · {runs}'}
    </Translate>
  );
}

// ── ReFormer в React, Vue и Angular ─────────────────────────────────────────

/** Числа стеков — диапазоном по трём, без рейтинга (как в самом отчёте). */
function FrameworksStats(): ReactNode {
  const t = useBenchText();
  const registration = frameworksHeadline.forms.find((f) => f.id === 'registration');
  const ready = registration?.rows.find((r) => r.phase === 'load' && r.id === 'ready');
  const readyValues = Object.values(ready?.cells ?? {})
    .map((cell) => cell[0])
    .filter((v) => v !== null);
  const gzip = frameworksHeadline.bundle
    .filter((b) => b.form === 'registration')
    .map((b) => b.gzip);
  return (
    <>
      <ul className={styles.stats}>
        {readyValues.length > 0 && (
          <Stat
            value={
              <>
                {valueRange(readyValues, 'мс')} <span>{t.unit('мс')}</span>
              </>
            }
            caption={
              <Translate id="benchmark.hub.frameworks.ready">
                до готовности формы регистрации на трёх стеках
              </Translate>
            }
          />
        )}
        {gzip.length > 0 && (
          <Stat
            value={
              <>
                {valueRange(gzip, 'КБ')} <span>{t.unit('КБ')}</span>
              </>
            }
            caption={
              <Translate id="benchmark.hub.frameworks.bundle">
                JS страницы регистрации, gzip
              </Translate>
            }
          />
        )}
        <Stat
          value={FRAMEWORKS_PARITY_TESTS}
          caption={
            <Translate id="benchmark.hub.frameworks.parity">
              сценария кросс-e2e прошли на тех же сборках
            </Translate>
          }
        />
      </ul>
      <p className={styles.statsNote}>
        <Translate id="benchmark.hub.frameworks.statsNote">
          Диапазоны — по трём стекам, без рейтинга
        </Translate>
      </p>
    </>
  );
}

function FrameworksMeta(): ReactNode {
  const t = useBenchText();
  const { meta } = frameworksHeadline;
  return (
    <Translate
      id="benchmark.hub.frameworks.meta"
      values={{
        date: formatDate(meta.generatedAt, t.isEn),
        cpu: Math.max(...meta.cpuRates),
        runs: meta.iterations,
      }}
    >
      {'{date} · CPU {cpu}x · медианы по {runs} прогонам'}
    </Translate>
  );
}

// ── Реестр отчётов ──────────────────────────────────────────────────────────

const REPORTS: Report[] = [
  {
    id: 'forms',
    to: '/benchmark/forms',
    kicker: <Translate id="benchmark.hub.forms.kicker">Библиотеки форм</Translate>,
    title: (
      <Translate id="benchmark.hub.forms.title">
        ReFormer против Formik, React Hook Form и RJSF
      </Translate>
    ),
    description: (
      <Translate id="benchmark.hub.forms.description">
        Регистрация с капчей и кредитная заявка на шесть шагов — на каждой библиотеке, плюс ReFormer
        на JSON-схеме. Загрузка, ввод, визард, массивы, перемонтирование, бандл и объём кода;
        prod-сборки, одинаковое поведение, замеры в Chromium.
      </Translate>
    ),
    Meta: FormsMeta,
    Stats: FormsStats,
  },
  {
    id: 'mcp',
    to: '/benchmark/mcp',
    kicker: <Translate id="benchmark.hub.mcp.kicker">ИИ-ассистент</Translate>,
    title: <Translate id="benchmark.hub.mcp.title">Замеры: с MCP и без</Translate>,
    description: (
      <Translate id="benchmark.hub.mcp.description">
        Один и тот же агент собирает, правит и чистит формы ReFormer без MCP-сервера и с ним.
        Качество по одному верификатору, время, токены и стоимость; сценарии, стеки и сами
        получившиеся формы.
      </Translate>
    ),
    Meta: McpMeta,
    Stats: McpStats,
  },
  {
    id: 'frameworks',
    to: '/benchmark/frameworks',
    kicker: <Translate id="benchmark.hub.frameworks.kicker">Фреймворки</Translate>,
    title: (
      <Translate id="benchmark.hub.frameworks.title">ReFormer в React, Vue и Angular</Translate>
    ),
    description: (
      <Translate id="benchmark.hub.frameworks.description">
        Одни и те же формы — регистрация и кредитная заявка — на трёх стеках: React с
        @reformer/ui-kit, Vue с Vuetify, Angular с Taiga UI. Поведение проверяется общими
        сценариями.
      </Translate>
    ),
    tags: ['React', 'Vue', 'Angular'],
    Meta: FrameworksMeta,
    Stats: FrameworksStats,
  },
];

function ReportCard({ report }: { report: Report }): ReactNode {
  const { to, kicker, title, description, Meta, Stats, tags } = report;
  return (
    <article className={clsx(styles.card, !to && styles.cardSoon)}>
      <div className={styles.cardHead}>
        <span className={styles.cardKicker}>{kicker}</span>
        {!to && (
          <span className={styles.badge}>
            <Translate id="benchmark.hub.soon">Готовится</Translate>
          </span>
        )}
      </div>
      <Heading as="h2" className={styles.cardTitle}>
        {to ? (
          <Link className={styles.cardLink} to={to}>
            {title}
          </Link>
        ) : (
          title
        )}
      </Heading>
      {Meta && (
        <p className={styles.cardMeta}>
          <Meta />
        </p>
      )}
      <p className={styles.cardDescription}>{description}</p>
      {tags && (
        <ul className={styles.tags}>
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {Stats && <Stats />}
      <p className={styles.cardFoot} aria-hidden={to ? true : undefined}>
        {to ? (
          <Translate id="benchmark.hub.open">Открыть отчёт →</Translate>
        ) : (
          <Translate id="benchmark.hub.soonNote">Отчёт появится здесь</Translate>
        )}
      </p>
    </article>
  );
}

export default function BenchmarkHub(): ReactNode {
  return (
    <Layout
      title={translate({ id: 'benchmark.hub.page.title', message: 'Бенчмарки' })}
      description={translate({
        id: 'benchmark.hub.page.description',
        message:
          'Отчёты с замерами ReFormer: сравнение с Formik, React Hook Form и RJSF, работа ИИ-ассистента с MCP и без, библиотека в React, Vue и Angular.',
      })}
    >
      <header className={styles.hero}>
        <div className="container">
          <p className={styles.kicker}>
            <Translate id="benchmark.hub.kicker">Бенчмарки</Translate>
          </p>
          <Heading as="h1" className={styles.heroTitle}>
            <Translate id="benchmark.hub.title">Замеры ReFormer на реальных прогонах</Translate>
          </Heading>
          <p className={styles.heroLead}>
            <Translate id="benchmark.hub.lead">
              Как ReFormer выглядит рядом с другими библиотеками форм, что MCP-сервер даёт
              ИИ-ассистенту и как библиотека работает в React, Vue и Angular. Методика у каждого
              отчёта открыта, числа — из прогонов, включая те, где ReFormer уступает.
            </Translate>
          </p>
        </div>
      </header>
      <main className={clsx('container', styles.main)}>
        <div className={styles.grid}>
          {REPORTS.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </main>
    </Layout>
  );
}

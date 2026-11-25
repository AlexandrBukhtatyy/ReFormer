/**
 * Отчёт «ReFormer в React, Vue и Angular»: те же две формы и те же сценарии замеров, что у отчёта
 * библиотек (/benchmark/forms), на трёх стеках — React + @reformer/ui-kit, Vue + Vuetify,
 * Angular + Taiga UI.
 *
 * Все числа — из src/data/frameworks-benchmark{,-headline,-traces}.json; их пишет
 * projects/forms-benchmark-e2e/scripts/site-data.mjs из опубликованного отчёта
 * docs/benchmarks/frameworks/summary.json (`npm run bench:frameworks:report -- --publish`).
 * Участник — стек целиком, поэтому отчёт не ранжирует: медианы и межквартильный размах, без
 * «лучшего» в строке и без значимости. Графики — общие компоненты отчёта библиотек; набор
 * участников (порядок, подписи, цвета) им даёт ParticipantContext.
 */
import { type ReactNode, useRef, useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import data from '@site/src/data/frameworks-benchmark.json';
import BarChart from '@site/src/components/benchmark/BarChart';
import TraceCharts from '@site/src/components/benchmark/TraceCharts';
import { libStyle } from '@site/src/components/benchmark/colors';
import { type BenchText, useBenchText } from '@site/src/components/benchmark/i18n';
import { LibSwatches, formatDate } from '@site/src/components/benchmark/parts';
import {
  FRAMEWORKS_PARITY_TESTS as PARITY_TESTS,
  FRAMEWORKS_SET,
  ParticipantContext,
} from '@site/src/components/benchmark/participants';
import {
  type BenchForm,
  type Cell,
  type Row,
  type Section,
  type TraceData,
  fmt,
  pct,
  pctAbs,
} from '@site/src/components/benchmark/types';

import bench from '@site/src/components/benchmark/bench.module.css';
import styles from './forms.module.css';
import own from './frameworks.module.css';

const REPO = 'https://github.com/AlexandrBukhtatyy/ReFormer';
/** Сайт публикуется из develop (deploy-docs.yml) — ссылки на файлы бенчмарка ведут туда же. */
const BRANCH = 'develop';
const blob = (p: string) => `${REPO}/blob/${BRANCH}/${p}`;
const tree = (p: string) => `${REPO}/tree/${BRANCH}/${p}`;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const label = FRAMEWORKS_SET.label;

/** Пакеты стека — из сведений о сборке отчёта. */
const STACK_PACKAGES: Record<string, string[]> = {
  react: ['react', '@reformer/ui-kit', '@reformer/renderer-react'],
  vue: ['vue', 'vuetify', '@reformer/kit-vuetify', '@reformer/renderer-vue'],
  angular: ['@angular/core', '@taiga-ui/core', '@reformer/kit-taiga', '@reformer/renderer-angular'],
};
/** Общее у трёх стеков: ядро и JSON-слой. */
const SHARED_PACKAGES = ['@reformer/core', '@reformer/renderer-json'];

/** «пакет версия»; у неопубликованного пакета репозитория (0.0.0) — только имя. */
function packageText(name: string): string {
  const v = data.meta.versions[name];
  return v && v !== '0.0.0' ? `${name} ${v}` : name;
}

const unitOf = (form: BenchForm, section: Section, row: Row) =>
  form.metrics[`${section.kind}/${row.id}`]?.unit ?? '';

function metricText(t: BenchText, form: BenchForm, section: Section, row: Row): string {
  const text = t.metricLabel(form, section.kind, row.id);
  const unit = t.unit(unitOf(form, section, row));
  return unit ? `${text}, ${unit}` : text;
}

const barRows = (form: BenchForm, row: Row) =>
  form.libs.filter((lib) => row.cells[lib]).map((lib) => ({ lib, cell: row.cells[lib] }));

// ── Шапка ───────────────────────────────────────────────────────────────────
function Hero(): ReactNode {
  const t = useBenchText();
  const { meta } = data;
  const facts: ReactNode[] = [
    <Translate
      key="stack"
      id="benchmark.frameworks.fact.stack"
      values={{
        b: (
          <b>{translate({ id: 'benchmark.frameworks.fact.stackBold', message: 'стек целиком' })}</b>
        ),
      }}
    >
      {'{b}: ReFormer + фреймворк + библиотека компонентов'}
    </Translate>,
    <Translate key="prod" id="benchmark.fact.prod" values={{ b: <b>prod</b> }}>
      {'{b}-сборка каждой страницы отдельно'}
    </Translate>,
    <Translate
      key="parity"
      id="benchmark.frameworks.fact.parity"
      values={{ b: <b>{PARITY_TESTS}</b> }}
    >
      {'одинаковое поведение: {b} сценария кросс-e2e на тех же сборках перед замерами'}
    </Translate>,
    <Translate
      key="cpu"
      id="benchmark.fact.cpu"
      values={{ b: <b>CPU {Math.max(...meta.cpuRates)}x</b> }}
    >
      {'{b} троттлинг'}
    </Translate>,
    <Translate
      key="runs"
      id="benchmark.fact.runs"
      values={{ b: <b>{meta.iterations}</b>, warmup: meta.warmup }}
    >
      {'медианы по {b} прогонам (+{warmup} прогрев)'}
    </Translate>,
    <Translate
      key="rank"
      id="benchmark.frameworks.fact.noRank"
      values={{
        b: (
          <b>
            {translate({ id: 'benchmark.frameworks.fact.noRankBold', message: 'без рейтинга' })}
          </b>
        ),
      }}
    >
      {'{b}: медиана и разброс, без «лучшего» и значимости'}
    </Translate>,
  ];
  return (
    <header className={styles.hero}>
      <div className="container">
        <Link className={styles.backLink} to="/benchmark">
          <Translate id="benchmark.backToHub">← Все бенчмарки</Translate>
        </Link>
        <p className={styles.kicker}>
          <Translate
            id="benchmark.frameworks.hero.kicker"
            values={{ date: formatDate(meta.generatedAt, t.isEn) }}
          >
            {'Фреймворки · {date}'}
          </Translate>
        </p>
        <Heading as="h1" className={styles.heroTitle}>
          <Translate id="benchmark.frameworks.hero.title">
            ReFormer в React, Vue и Angular
          </Translate>
        </Heading>
        <p className={styles.heroLead}>
          <Translate id="benchmark.frameworks.hero.lead">
            Одни и те же формы — регистрация с капчей и кредитная заявка на шесть шагов — из одного
            JSON-документа с общими правилами, поведением и API, нарисованные рендерером ReFormer
            своего фреймворка и библиотекой компонентов. Сценарии замеров — те же, что в отчёте
            библиотек форм: загрузка, ввод, клики, визард, массивы и перемонтирование.
          </Translate>
        </p>
        <ul className={styles.facts}>
          {facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <dl className={styles.env}>
          <div>
            <dt>
              <Translate id="benchmark.env.machine">Машина</Translate>
            </dt>
            <dd>
              <Translate
                id="benchmark.env.machineValue"
                values={{
                  cpu: meta.machine.cpu,
                  cores: meta.machine.cores,
                  memory: meta.machine.memoryGb,
                }}
              >
                {'{cpu}, {cores} ядер, {memory} ГБ'}
              </Translate>
            </dd>
          </div>
          <div>
            <dt>
              <Translate id="benchmark.env.browser">Браузер</Translate>
            </dt>
            <dd>{meta.browser}, headless</dd>
          </div>
          <div>
            <dt>
              <Translate id="benchmark.env.date">Прогон</Translate>
            </dt>
            <dd>{formatDate(meta.generatedAt, t.isEn)}</dd>
          </div>
          <div>
            <dt>
              <Translate id="benchmark.env.build">Сборка</Translate>
            </dt>
            <dd>
              git <code>{meta.git.sha ?? '—'}</code>, Node {meta.node}
            </dd>
          </div>
          <div>
            <dt>
              <Translate id="benchmark.frameworks.env.shared">Общее у стеков</Translate>
            </dt>
            <dd>{SHARED_PACKAGES.map(packageText).join(' + ')}</dd>
          </div>
        </dl>
        <ul className={styles.participants}>
          {data.participants.map((p) => (
            <li key={p.id} style={libStyle(p.id)}>
              <span className={styles.participantName}>{p.stack}</span>
              <span className={styles.participantStack}>
                {(STACK_PACKAGES[p.id] ?? []).map(packageText).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.heroButtons}>
          <Link className="button button--primary button--lg" to="#results">
            <Translate id="benchmark.hero.toResults">К результатам</Translate>
          </Link>
          <Link className="button button--secondary button--lg" to="#method">
            <Translate id="benchmark.frameworks.hero.toMethod">Как читать числа</Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

const NAV: Array<{ id: string; label: ReactNode }> = [
  { id: 'traces', label: <Translate id="benchmark.nav.traces">Трейсы</Translate> },
  { id: 'results', label: <Translate id="benchmark.nav.results">Итог</Translate> },
  { id: 'phases', label: <Translate id="benchmark.nav.phases">Все фазы</Translate> },
  { id: 'bundle', label: <Translate id="benchmark.nav.bundle">Бандл</Translate> },
  { id: 'code', label: <Translate id="benchmark.nav.code">Объём кода</Translate> },
  { id: 'method', label: <Translate id="benchmark.nav.method">Методика</Translate> },
];

function SectionNav(): ReactNode {
  return (
    <nav
      className={styles.sectionNav}
      aria-label={translate({ id: 'benchmark.nav.label', message: 'Разделы отчёта' })}
    >
      <div className={clsx('container', styles.sectionNavInner)}>
        {NAV.map((n) => (
          <Link key={n.id} to={`#${n.id}`} className={styles.sectionNavLink}>
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function FormTabs({ children }: { children: (form: BenchForm) => ReactNode }): ReactNode {
  const t = useBenchText();
  return (
    <Tabs groupId="bench-frameworks-form" className={styles.tabs}>
      {data.forms.map((form) => (
        <TabItem key={form.id} value={form.id} label={cap(t.formTitle(form))}>
          {children(form)}
        </TabItem>
      ))}
    </Tabs>
  );
}

/** Легенда: цвета стеков и ус разброса; значков значимости в этом отчёте нет. */
function StackLegend(): ReactNode {
  return (
    <ul className={bench.legend}>
      <LibSwatches />
      <li>
        <span className={bench.swatchWhisker} aria-hidden="true" />
        <Translate id="benchmark.legend.iqr">разброс по прогонам (q25–q75)</Translate>
      </li>
    </ul>
  );
}

// ── Ключевые результаты ─────────────────────────────────────────────────────
function KeyResults(): ReactNode {
  const t = useBenchText();
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <Heading as="h2" id="results" className={styles.sectionTitle}>
          <Translate id="benchmark.results.title">Ключевые результаты</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.frameworks.results.lead" values={{ runs: data.meta.iterations }}>
            {
              'Ключевые метрики каждой формы: столбец — медиана по {runs} прогонам, ус — межквартильный размах. Меньше — лучше. Отметок «лучший» и значимости нет: стеки различаются не только фреймворком, но и библиотекой компонентов — разница в числах о стеке целиком.'
            }
          </Translate>
        </p>
        <StackLegend />
        <FormTabs>
          {(form) => (
            <div className={styles.chartGrid}>
              {form.headline.map((h) => {
                const section = form.sections.find((s) => s.id === h.phase);
                const row = section?.rows.find((r) => r.id === h.metric);
                if (!section || !row) return null;
                return (
                  <div key={`${section.id}/${row.id}`} className={styles.chartCard}>
                    <BarChart
                      kicker={t.phaseTitle(form, section.id, section.title)}
                      title={t.metricLabel(form, section.kind, row.id)}
                      unit={unitOf(form, section, row)}
                      unitLabel={t.unit(unitOf(form, section, row))}
                      rows={barRows(form, row)}
                      showRatio={false}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </FormTabs>
      </div>
    </section>
  );
}

// ── Все фазы ────────────────────────────────────────────────────────────────
function ResultCell({ cell, unit }: { cell?: Cell; unit: string }): ReactNode {
  if (!cell) return <td className={styles.num}>—</td>;
  const [med, q25, q75] = cell;
  return (
    <td className={styles.num}>
      <span className={styles.cellMain}>{fmt(med, unit)}</span>
      {q25 !== null && q75 !== null && (
        <span className={styles.cellIqr}>
          {fmt(q25, unit)}–{fmt(q75, unit)}
        </span>
      )}
    </td>
  );
}

function PhaseDetails({ form, section }: { form: BenchForm; section: Section }): ReactNode {
  const t = useBenchText();
  const noisy = section.rows.filter((r) => r.noisy);
  // Графики строятся только у раскрытой фазы: свёрнутые (и HTML с сервера) их не несут.
  const [open, setOpen] = useState(false);
  return (
    <details
      className={styles.phase}
      id={`${form.id}-${section.id}`}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className={styles.phaseSummary}>
        <span className={styles.phaseTitle}>{t.phaseTitle(form, section.id, section.title)}</span>
        {noisy.length > 0 && (
          <span className={styles.phaseMeta}>
            <Translate id="benchmark.phases.noisyKicker">разброс &gt; 15 %</Translate>
          </span>
        )}
      </summary>
      {open && (
        <div className={clsx(styles.chartGrid, styles.phaseCharts)}>
          {section.rows.map((row) => (
            <div key={row.id} className={styles.chartCard}>
              <BarChart
                kicker={
                  row.noisy
                    ? translate({ id: 'benchmark.phases.noisyKicker', message: 'разброс > 15 %' })
                    : undefined
                }
                title={t.metricLabel(form, section.kind, row.id)}
                unit={unitOf(form, section, row)}
                unitLabel={t.unit(unitOf(form, section, row))}
                rows={barRows(form, row)}
                showRatio={false}
              />
            </div>
          ))}
        </div>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <Translate id="benchmark.table.metric">Метрика</Translate>
              </th>
              {form.libs.map((lib) => (
                <th key={lib} className={styles.num}>
                  {label(lib)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.rowHead}>
                  {metricText(t, form, section, row)}
                </th>
                {form.libs.map((lib) => (
                  <ResultCell key={lib} cell={row.cells[lib]} unit={unitOf(form, section, row)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(noisy.length > 0 || section.notes.length > 0) && (
        <div className={styles.phaseNotes}>
          {noisy.length > 0 && (
            <p>
              <Translate
                id="benchmark.phases.noisy"
                values={{
                  list: noisy.map((r) => t.metricLabel(form, section.kind, r.id)).join('; '),
                }}
              >
                {'Разброс выше 15 % (CV): {list}.'}
              </Translate>
            </p>
          )}
          {section.notes.map((note) => (
            <p key={note}>{t.note(note)}</p>
          ))}
        </div>
      )}
    </details>
  );
}

function PhaseList({ form }: { form: BenchForm }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const toggle = () => {
    const next = !open;
    ref.current?.querySelectorAll('details').forEach((d) => {
      d.open = next;
    });
    setOpen(next);
  };
  return (
    <div ref={ref}>
      <div className={styles.phaseToolbar}>
        {form.failures > 0 && (
          <span className={styles.warning}>
            <Translate id="benchmark.phases.failures" values={{ n: form.failures }}>
              {'⚠️ Неудачных прогонов: {n} — они не входят в статистику.'}
            </Translate>
          </span>
        )}
        <button type="button" className="button button--sm button--secondary" onClick={toggle}>
          {open ? (
            <Translate id="benchmark.phases.collapseAll">Свернуть все</Translate>
          ) : (
            <Translate id="benchmark.phases.expandAll">Развернуть все</Translate>
          )}
        </button>
      </div>
      {form.sections.map((section) => (
        <PhaseDetails key={section.id} form={form} section={section} />
      ))}
    </div>
  );
}

function AllPhases(): ReactNode {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" id="phases" className={styles.sectionTitle}>
          <Translate id="benchmark.phases.title">Все фазы</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate
            id="benchmark.frameworks.phases.lead"
            values={{ runs: data.meta.iterations, cpu: Math.max(...data.meta.cpuRates) }}
          >
            {
              'Ячейка — медиана по {runs} прогонам при CPU {cpu}x (каждый прогон сначала свёрнут: например, медиана задержки по всем клавишам фазы), под ней — разброс q25–q75. Меньше — лучше. Строки JS (CDP) у Vue занижены — см. методику. Раскройте фазу, чтобы увидеть графики.'
            }
          </Translate>
        </p>
        <FormTabs>{(form) => <PhaseList form={form} />}</FormTabs>
      </div>
    </section>
  );
}

// ── Трейсы во времени ───────────────────────────────────────────────────────
/** Файл трейсов один на обе вкладки форм — грузится один раз. */
let tracesPending: Promise<TraceData> | null = null;
function loadTraces(): Promise<TraceData> {
  tracesPending ??= import('@site/src/data/frameworks-benchmark-traces.json').then(
    (m) => m.default
  );
  return tracesPending;
}

function Traces(): ReactNode {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" id="traces" className={styles.sectionTitle}>
          <Translate id="benchmark.traces.title">Память и DOM во времени</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.frameworks.traces.lead">
            JS heap, DOM-узлы и обработчики событий по ходу всего сценария формы — у каждого стека
            своя линия. Фазы выровнены: окно замера фазы — полоса шириной самого долгого стека,
            между полосами — промежуток без замера. Наведите на график или нажмите ←/→ — подсказка
            покажет значения всех стеков в этот момент. Число DOM-узлов зависит от разметки
            библиотеки компонентов.
          </Translate>
        </p>
        <FormTabs>
          {(form) => <TraceCharts form={form} measuredRuns={data.meta.runs} load={loadTraces} />}
        </FormTabs>
      </div>
    </section>
  );
}

// ── Бандл ───────────────────────────────────────────────────────────────────
const kb1 = (v: number | null) => (v === null ? '—' : v.toFixed(1));

function Bundle(): ReactNode {
  const t = useBenchText();
  const kb = t.unit('КБ');
  if (!data.bundle.length) return null;
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <Heading as="h2" id="bundle" className={styles.sectionTitle}>
          <Translate id="benchmark.bundle.title">Размер бандла</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.frameworks.bundle.lead">
            Отдельная prod-сборка каждой страницы, статическое замыкание от модулей страницы. Бандл
            — страница целиком: фреймворк, библиотека компонентов, рендерер, ядро ReFormer и код
            формы. Реестр регистрирует библиотеку компонентов целиком — как приложение на
            JSON-рендерере. Сжатие считается на вход целиком, атрибуция пакетов — минифицированные
            байты по sourcemap.
          </Translate>
        </p>
        <div className={styles.chartGrid}>
          {data.forms.map((form) => {
            const entries = data.bundle.filter((b) => b.form === form.id);
            if (!entries.length) return null;
            return (
              <div key={form.id} className={styles.chartCard}>
                <BarChart
                  kicker={cap(t.formTitle(form))}
                  title={translate({
                    id: 'benchmark.frameworks.bundle.chartTitle',
                    message: 'JS страницы, gzip',
                  })}
                  unit="КБ"
                  unitLabel={kb}
                  rows={FRAMEWORKS_SET.order
                    .map((lib) => entries.find((b) => b.lib === lib))
                    .filter((b) => b !== undefined)
                    .map((b) => ({ lib: b.lib, cell: [b.gzip, null, null, null, 0] as Cell }))}
                  format={kb1}
                  showRatio={false}
                />
              </div>
            );
          })}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <Translate id="benchmark.bundle.col.page">Страница</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.bundle.col.raw" values={{ kb }}>
                    {'JS raw, {kb}'}
                  </Translate>
                </th>
                <th className={styles.num}>gzip, {kb}</th>
                <th className={styles.num}>brotli, {kb}</th>
                <th>
                  <Translate id="benchmark.bundle.col.top" values={{ kb }}>
                    {'Крупнейшие пакеты (raw, {kb})'}
                  </Translate>
                </th>
              </tr>
            </thead>
            {data.forms.map((form) => (
              <tbody key={form.id}>
                <tr className={styles.groupRow}>
                  <th colSpan={5}>{cap(t.formTitle(form))}</th>
                </tr>
                {FRAMEWORKS_SET.order
                  .map((lib) => data.bundle.find((b) => b.form === form.id && b.lib === lib))
                  .filter((b) => b !== undefined)
                  .map((b) => (
                    <tr key={b.lib}>
                      <th scope="row" className={styles.rowHead}>
                        {label(b.lib)}
                      </th>
                      <td className={styles.num}>{kb1(b.raw)}</td>
                      <td className={clsx(styles.num, styles.strong)}>{kb1(b.gzip)}</td>
                      <td className={styles.num}>{kb1(b.brotli)}</td>
                      <td className={styles.small}>
                        {b.top
                          .map(([name, size]) => `${packageName(name, t)} ${kb1(size)}`)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className={own.note}>
          <Translate id="benchmark.frameworks.bundle.router">
            «Общий код формы» — документ формы, правила, поведение и fake API, одинаковые у трёх
            стеков. @angular/router в бандле Angular-страницы приносит @taiga-ui/core (порталы
            диалогов); сама страница роутер не использует. React и Vue собирает Vite (Rollup),
            Angular — Angular CLI (esbuild).
          </Translate>
        </p>
      </div>
    </section>
  );
}

/** Корзины отчёта размера, не являющиеся пакетами npm, — на языке страницы. */
function packageName(name: string, t: BenchText): string {
  if (!t.isEn) return name;
  if (name === 'форма: общий код') return 'form: shared code';
  if (name === 'хост') return 'host';
  return name;
}

// ── Объём кода ──────────────────────────────────────────────────────────────
function CodeSize(): ReactNode {
  const t = useBenchText();
  if (!data.code.length) return null;
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" id="code" className={styles.sectionTitle}>
          <Translate id="benchmark.code.title">Объём кода реализаций</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.frameworks.code.lead">
            Код, который пишет приложение, — исходники, попавшие в бандл страницы (по sourcemap):
            строки без пустых и комментариев после prettier. «Форма» — общее у трёх стеков:
            JSON-документ, правила, поведение и API. «Обвязка стека» — своё у каждого: реестр
            библиотеки компонентов, вход страницы и компоненты приложения (капча, вычисляемое
            значение). Код библиотек компонентов и рендереров — пакеты, он не считается.
          </Translate>
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <Translate id="benchmark.frameworks.code.col.stack">Стек</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.formTs">Форма TS</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.formJson">Форма JSON</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.frameworks.code.col.kitTs">Обвязка стека TS</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.total">Итого строк</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.files">Файлов</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.gzip">gzip исходника, Б</Translate>
                </th>
              </tr>
            </thead>
            {data.forms.map((form) => (
              <tbody key={form.id}>
                <tr className={styles.groupRow}>
                  <th colSpan={7}>{cap(t.formTitle(form))}</th>
                </tr>
                {FRAMEWORKS_SET.order
                  .map((lib) => data.code.find((c) => c.form === form.id && c.lib === lib))
                  .filter((c) => c !== undefined)
                  .map((c) => (
                    <tr key={c.lib}>
                      <th scope="row" className={styles.rowHead}>
                        {label(c.lib)}
                      </th>
                      <td className={styles.num}>{c.formTs}</td>
                      <td className={styles.num}>{c.formJson}</td>
                      <td className={clsx(styles.num, styles.strong)}>{c.kitTs}</td>
                      <td className={styles.num}>{c.total}</td>
                      <td className={styles.num}>{c.files}</td>
                      <td className={styles.num}>{c.gzip}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}

// ── Методика и ограничения ──────────────────────────────────────────────────
function SessionHealth(): ReactNode {
  const t = useBenchText();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <Translate id="benchmark.health.col.form">Форма</Translate>
            </th>
            <th className={styles.num}>
              <Translate id="benchmark.health.col.calMedian">Калибровка, медиана</Translate>
            </th>
            <th className={styles.num}>
              <Translate id="benchmark.health.col.spread">Разброс p10–p90</Translate>
            </th>
            <th className={styles.num}>
              <Translate id="benchmark.health.col.trend">Дрейф за сессию</Translate>
            </th>
            <th className={styles.num}>
              <Translate id="benchmark.health.col.foreign">Чужая нагрузка, ядер</Translate>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.forms.map((f) => {
            const c = f.calibration;
            const bg = f.background;
            const flagged = (c?.flags.length ?? 0) > 0 || (bg?.flags.length ?? 0) > 0;
            return (
              <tr key={f.id}>
                <th scope="row" className={styles.rowHead}>
                  {cap(t.formTitle(f))}
                  {flagged && ' ⚠️'}
                </th>
                <td className={styles.num}>{c ? `${fmt(c.median, 'мс')} ${t.unit('мс')}` : '—'}</td>
                <td className={styles.num}>{c ? pctAbs(c.spread) : '—'}</td>
                <td className={styles.num}>{c ? pct(c.trend) : '—'}</td>
                <td className={styles.num}>
                  {bg?.foreignCores
                    ? `${bg.foreignCores.median?.toFixed(2) ?? '—'} / max ${bg.foreignCores.max?.toFixed(2) ?? '—'}`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const REPRODUCE = `npm ci
npx playwright install chromium
# Пакеты @reformer/* берутся из dist
npm run build
# Prod-сборки страниц трёх стеков, размер бандла и объём кода,
# сценарии кросс-e2e на этих сборках, прогоны и отчёт
npm run bench:frameworks
# Опубликовать отчёт и данные этой страницы
npm run bench:frameworks:report -- --publish`;

const REPRODUCE_EN = `npm ci
npx playwright install chromium
# @reformer/* packages are consumed from dist
npm run build
# Prod builds of the three stacks' pages, bundle size and code size,
# cross-e2e scenarios on these builds, the runs and the report
npm run bench:frameworks
# Publish the report and this page's data
npm run bench:frameworks:report -- --publish`;

function Methodology(): ReactNode {
  const t = useBenchText();
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <Heading as="h2" id="method" className={styles.sectionTitle}>
          <Translate id="benchmark.method.title">Методика и ограничения</Translate>
        </Heading>
        <div className={styles.methodGrid}>
          <ul className={styles.methodList}>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.stack.title">Стек целиком.</Translate>
              </b>{' '}
              <Translate id="benchmark.frameworks.method.stack.text">
                Участник — ReFormer, фреймворк и библиотека компонентов вместе: React с
                @reformer/ui-kit, Vue с Vuetify, Angular с Taiga UI. Библиотеки рисуют поля
                по-разному — своя разметка, стили, всплывающие списки, — поэтому числа говорят о
                стеке, а не о фреймворке в чистом виде, и цену рендерера ReFormer отдельно не
                выделяют.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.shared.title">Одна форма.</Translate>
              </b>{' '}
              <Translate id="benchmark.frameworks.method.shared.text">
                JSON-документ формы, правила, поведение, поток шагов и fake API у трёх стеков общие;
                различаются реестр компонентов и вход страницы. Сценарии замеров — те же, что в
                отчёте библиотек форм; они ходят по одному DOM-контракту китов, а список выбирают
                через драйвер библиотеки.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.parity.title">
                  Паритет до замеров.
                </Translate>
              </b>{' '}
              <Translate id="benchmark.frameworks.method.parity.text" values={{ n: PARITY_TESTS }}>
                {
                  'Перед замерами Playwright прогоняет {n} сценариев кросс-e2e на тех же prod-сборках: ошибки, серверные проверки, маски, визард, массивы и канонический payload. Замеры начинаются только после зелёного прогона.'
                }
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.remount.title">
                  Перемонтирование.
                </Translate>
              </b>{' '}
              <Translate id="benchmark.frameworks.method.remount.text">
                Каждое монтирование создаёт новый корень фреймворка с формой: createRoot у React,
                createApp у Vue, createComponent у Angular. Библиотека компонентов настраивается
                один раз на страницу (экземпляр Vuetify, провайдеры Taiga UI). Форма строится после
                загрузки начальных значений — сравнивайте «монтирование до готовности».
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.stats.title">Без рейтинга.</Translate>
              </b>{' '}
              <Translate
                id="benchmark.frameworks.method.stats.text"
                values={{ runs: data.meta.iterations }}
              >
                {
                  'Каждый прогон сворачивается (например, медиана по всем клавишам фазы), по {runs} прогонам — медиана и межквартильный размах. Отметок значимости и «лучшего» в строке нет: при разных библиотеках компонентов рейтинг читался бы как рейтинг фреймворков, а этого замер не показывает.'
                }
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.renders.title">
                  Без счётчика рендеров.
                </Translate>
              </b>{' '}
              <Translate id="benchmark.frameworks.method.renders.text">
                Рендеры в отчёте библиотек считает хук React DevTools; у Vue и Angular такого
                счётчика нет, поэтому раздела рендеров здесь нет.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.cdp.title">JS по CDP.</Translate>
              </b>{' '}
              <Translate id="benchmark.frameworks.method.cdp.text">
                «Выполнение JS (CDP)» и «JS на клавишу» — счётчик ScriptDuration протокола Chrome
                DevTools, а код в реакциях промисов (Promise.then) он не учитывает. Vue
                перерисовывает в Promise.then, поэтому эти строки у Vue занижены в разы и с другими
                стеками не сравнимы; в ключевые результаты они не вынесены. Задержки ввода и кликов,
                Total Blocking Time и layout такой ошибки не имеют.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.frameworks.method.limits.title">Ограничения.</Translate>
              </b>{' '}
              <Translate id="benchmark.frameworks.method.limits.text">
                Троттлинг CPU в Chromium замедляет только main thread — стоимость больших бандлов
                занижена. Одна машина и один браузер; абсолютные числа разных сессий несравнимы,
                сравнивайте стеки внутри отчёта: в прогоне они чередуются в перемешанном порядке.
                Соседние процессы на Windows не снимаются — колонка «чужая нагрузка» пустая.
              </Translate>
            </li>
          </ul>
          <div className={styles.methodSide}>
            <Heading as="h3" className={styles.subTitle}>
              <Translate id="benchmark.method.sources">Исходники и сырой отчёт</Translate>
            </Heading>
            <ul className={styles.linkList}>
              <li>
                <Link href={blob('docs/benchmarks/frameworks/report.md')}>report.md</Link>
                {' — '}
                <Translate id="benchmark.method.link.report">полный отчёт этого прогона</Translate>
              </li>
              <li>
                <Link href={tree('projects/forms-benchmark/src/cross')}>
                  forms-benchmark/src/cross
                </Link>
                {' — '}
                <Translate id="benchmark.frameworks.method.link.cross">
                  общий код форм трёх стеков
                </Translate>
              </li>
              <li>
                <Link href={blob('projects/cross-framework-e2e/DOM-CONTRACT.md')}>
                  DOM-CONTRACT.md
                </Link>
                {' — '}
                <Translate id="benchmark.frameworks.method.link.contract">
                  DOM-контракт китов и драйверы списков
                </Translate>
              </li>
              <li>
                <Link href={blob('projects/forms-benchmark/scripts/build-frameworks.mjs')}>
                  build-frameworks.mjs
                </Link>
                {' — '}
                <Translate id="benchmark.frameworks.method.link.build">
                  prod-сборки страниц стеков
                </Translate>
              </li>
            </ul>
          </div>
        </div>
        <Heading as="h3" className={styles.subTitle}>
          <Translate id="benchmark.method.reproduce">Как воспроизвести</Translate>
        </Heading>
        <div className={styles.reproduce}>
          <CodeBlock language="bash">{t.isEn ? REPRODUCE_EN : REPRODUCE}</CodeBlock>
        </div>
        <Heading as="h3" className={styles.subTitle}>
          <Translate id="benchmark.method.healthTitle">Состояние машины в этом отчёте</Translate>
        </Heading>
        <SessionHealth />
      </div>
    </section>
  );
}

export default function FrameworksBenchmarkPage(): ReactNode {
  return (
    <Layout
      title={translate({
        id: 'benchmark.frameworks.page.title',
        message: 'ReFormer в React, Vue и Angular',
      })}
      description={translate({
        id: 'benchmark.frameworks.page.description',
        message:
          'Одни и те же формы ReFormer на трёх стеках — React с @reformer/ui-kit, Vue с Vuetify, Angular с Taiga UI: загрузка, ввод, визард, массивы, перемонтирование, бандл и объём кода.',
      })}
    >
      <ParticipantContext.Provider value={FRAMEWORKS_SET}>
        <Hero />
        <SectionNav />
        <main className={styles.main}>
          <Traces />
          <KeyResults />
          <AllPhases />
          <Bundle />
          <CodeSize />
          <Methodology />
        </main>
      </ParticipantContext.Provider>
    </Layout>
  );
}

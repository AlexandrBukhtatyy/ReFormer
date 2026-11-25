/**
 * Отчёт бенчмарка форм: ReFormer против Formik, React Hook Form и RJSF.
 *
 * Все числа — из src/data/forms-benchmark.json; его пишет
 * projects/forms-benchmark-e2e/scripts/site-data.mjs из опубликованного отчёта
 * docs/benchmarks/forms/summary.json (`npm run bench:report -- --publish` обновляет оба). Страница
 * показывает то же, что report.md: медиану, IQR, отношение к лучшему и значимость против
 * ReFormer core, включая строки, где ReFormer проигрывает.
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
import data from '@site/src/data/forms-benchmark.json';
import BarChart, { sigTitle } from '@site/src/components/benchmark/BarChart';
import Heatmap, { phaseDomId } from '@site/src/components/benchmark/Heatmap';
import TraceCharts from '@site/src/components/benchmark/TraceCharts';
import { libStyle } from '@site/src/components/benchmark/colors';
import { type BenchText, useBenchText } from '@site/src/components/benchmark/i18n';
import { Legend, ScoreTile, formatDate, joinNames } from '@site/src/components/benchmark/parts';
import {
  type BenchForm,
  type Cell,
  CORE,
  RIVALS,
  type Row,
  type Section,
  fmt,
  fmtRatio,
  libLabel,
  lossesOf,
  pct,
  pctAbs,
  scoreAgainst,
  sigMark,
} from '@site/src/components/benchmark/types';

import styles from './benchmark.module.css';

const REPO = 'https://github.com/AlexandrBukhtatyy/ReFormer';
/** Сайт публикуется из develop (deploy-docs.yml) — ссылки на файлы бенчмарка ведут туда же. */
const BRANCH = 'develop';
const blob = (p: string) => `${REPO}/blob/${BRANCH}/${p}`;
const tree = (p: string) => `${REPO}/tree/${BRANCH}/${p}`;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Версии стека участника — из данных отчёта. */
const STACK_VERSIONS: Record<string, string[]> = {
  'reformer-core': ['@reformer/core'],
  'reformer-json': ['@reformer/renderer-json'],
  formik: ['formik', 'yup'],
  rhf: ['react-hook-form', 'zod'],
  rjsf: ['@rjsf/core', '@rjsf/validator-ajv8'],
  baseline: ['react'],
};

function stackOf(lib: string): string {
  return (STACK_VERSIONS[lib] ?? [])
    .filter((p) => data.meta.versions[p])
    .map((p) => `${p} ${data.meta.versions[p]}`)
    .join(' + ');
}

function metricText(t: BenchText, form: BenchForm, section: Section, row: Row): string {
  const label = t.metricLabel(form, section.kind, row.id);
  const unit = t.unit(form.metrics[`${section.kind}/${row.id}`]?.unit ?? '');
  return unit ? `${label}, ${unit}` : label;
}

const unitOf = (form: BenchForm, section: Section, row: Row) =>
  form.metrics[`${section.kind}/${row.id}`]?.unit ?? '';

// ── Шапка ───────────────────────────────────────────────────────────────────
function Hero(): ReactNode {
  const t = useBenchText();
  const { meta } = data;
  const cpu = Math.max(...meta.cpuRates);
  const facts: ReactNode[] = [
    <Translate key="prod" id="benchmark.fact.prod" values={{ b: <b>prod</b> }}>
      {'{b}-сборка каждой страницы отдельно'}
    </Translate>,
    <Translate
      key="conf"
      id="benchmark.fact.conformance"
      values={{
        b: <b>{translate({ id: 'benchmark.fact.conformanceCount', message: '171 тест' })}</b>,
      }}
    >
      {'одинаковые UI и поведение: {b} перед замерами'}
    </Translate>,
    <Translate key="cpu" id="benchmark.fact.cpu" values={{ b: <b>CPU {cpu}x</b> }}>
      {'{b} троттлинг'}
    </Translate>,
    <Translate
      key="runs"
      id="benchmark.fact.runs"
      values={{ b: <b>{meta.iterations}</b>, warmup: meta.warmup }}
    >
      {'медианы по {b} прогонам (+{warmup} прогрев)'}
    </Translate>,
    <Translate key="stats" id="benchmark.fact.stats" values={{ b: <b>Mann–Whitney + Holm</b> }}>
      {'точный {b}, p < 0.05'}
    </Translate>,
    <Translate key="aa" id="benchmark.fact.aa" values={{ b: <b>A/A</b> }}>
      {'разница меньше шума {b} — не разница'}
    </Translate>,
  ];
  return (
    <header className={styles.hero}>
      <div className="container">
        <p className={styles.kicker}>
          <Translate
            id="benchmark.hero.kicker"
            values={{ date: formatDate(meta.generatedAt, t.isEn) }}
          >
            {'Бенчмарк форм · {date}'}
          </Translate>
        </p>
        <Heading as="h1" className={styles.heroTitle}>
          <Translate id="benchmark.hero.title">
            ReFormer против Formik, React Hook Form и RJSF — на реальных числах из браузера
          </Translate>
        </Heading>
        <p className={styles.heroLead}>
          <Translate id="benchmark.hero.lead">
            Две формы из реальных спецификаций — регистрация с капчей и кредитная заявка на шесть
            шагов — реализованы на каждой библиотеке, плюс ReFormer на JSON-схеме и baseline без
            библиотеки форм. Меряем то, что чувствует пользователь: загрузку, ввод, клики, переходы
            визарда, массивы и перемонтирование.
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
        </dl>
        <ul className={styles.participants}>
          {data.participants.map((p) => (
            <li key={p.id} className={styles[`participant_${p.role}`]} style={libStyle(p.id)}>
              <span className={styles.participantName}>{p.label}</span>
              <span className={styles.participantStack}>
                {p.id === 'baseline' ? (
                  <Translate id="benchmark.participant.baseline" values={{ react: stackOf(p.id) }}>
                    {'{react}, без библиотеки форм'}
                  </Translate>
                ) : p.id === 'reformer-core' ? (
                  `${stackOf(p.id)} + @reformer/cdk`
                ) : (
                  stackOf(p.id)
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.heroButtons}>
          <Link className="button button--primary button--lg" to="#results">
            <Translate id="benchmark.hero.toResults">К результатам</Translate>
          </Link>
          <Link className="button button--secondary button--lg" to="#losses">
            <Translate id="benchmark.hero.toLosses">Где ReFormer уступает</Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

const NAV: Array<{ id: string; label: ReactNode }> = [
  { id: 'traces', label: <Translate id="benchmark.nav.traces">Трейсы</Translate> },
  { id: 'results', label: <Translate id="benchmark.nav.results">Итог</Translate> },
  { id: 'losses', label: <Translate id="benchmark.nav.losses">Где уступает</Translate> },
  { id: 'phases', label: <Translate id="benchmark.nav.phases">Все фазы</Translate> },
  { id: 'renders', label: <Translate id="benchmark.nav.renders">Рендеры</Translate> },
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

// ── Ключевые результаты ─────────────────────────────────────────────────────
function FormTabs({ children }: { children: (form: BenchForm) => ReactNode }): ReactNode {
  const t = useBenchText();
  return (
    <Tabs groupId="bench-form" className={styles.tabs}>
      {data.forms.map((form) => (
        <TabItem key={form.id} value={form.id} label={cap(t.formTitle(form))}>
          {children(form)}
        </TabItem>
      ))}
    </Tabs>
  );
}

function KeyResults(): ReactNode {
  const t = useBenchText();
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <Heading as="h2" id="results" className={styles.sectionTitle}>
          <Translate id="benchmark.results.title">Ключевые результаты</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.results.scoreLead">
            Счёт по всем строкам отчёта — обе формы, все фазы и метрики: в скольких ReFormer core
            значимо быстрее конкурента, в скольких медленнее и где разница не доказана.
          </Translate>
        </p>
        <div className={styles.scoreGrid}>
          {RIVALS.map((rival) => (
            <ScoreTile key={rival} rival={rival} {...scoreAgainst(data.forms, rival)} />
          ))}
        </div>
        <Heading as="h3" className={styles.subTitle}>
          <Translate id="benchmark.results.headlineTitle">Ключевые метрики по формам</Translate>
        </Heading>
        <Legend />
        <FormTabs>
          {(form) => {
            const rows = form.headline
              .map((h) => {
                const section = form.sections.find((s) => s.id === h.phase);
                const row = section?.rows.find((r) => r.id === h.metric);
                return section && row ? { section, row } : null;
              })
              .filter((x): x is { section: Section; row: Row } => x !== null);
            const coreBest = rows.filter((r) => r.row.best === CORE).length;
            return (
              <>
                <p className={styles.tabLead}>
                  <Translate
                    id="benchmark.results.coreBest"
                    values={{ n: <b>{coreBest}</b>, total: rows.length }}
                  >
                    {
                      'ReFormer core — лучший в {n} из {total} ключевых метрик этой формы. Меньше — лучше.'
                    }
                  </Translate>
                </p>
                <div className={styles.chartGrid}>
                  {rows.map(({ section, row }) => (
                    <div key={`${section.id}/${row.id}`} className={styles.chartCard}>
                      <BarChart
                        kicker={t.phaseTitle(form, section.id, section.title)}
                        title={t.metricLabel(form, section.kind, row.id)}
                        unit={unitOf(form, section, row)}
                        unitLabel={t.unit(unitOf(form, section, row))}
                        rows={form.libs
                          .filter((lib) => row.cells[lib])
                          .map((lib) => ({ lib, cell: row.cells[lib] }))}
                        best={row.best}
                      />
                    </div>
                  ))}
                </div>
              </>
            );
          }}
        </FormTabs>
      </div>
    </section>
  );
}

// ── Где ReFormer уступает ───────────────────────────────────────────────────
function Losses(): ReactNode {
  const t = useBenchText();
  const all = data.forms.flatMap((f) => lossesOf(f));
  const total = data.forms.reduce(
    (n, f) => n + f.sections.reduce((m, s) => m + s.rows.filter((r) => r.cells[CORE]).length, 0),
    0
  );
  const byRival = RIVALS.map((lib) => ({
    lib,
    n: all.filter((l) => l.winners.includes(lib)).length,
  }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" id="losses" className={styles.sectionTitle}>
          <Translate id="benchmark.losses.title">Где ReFormer уступает</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.losses.lead">
            Отчёт публикует всё, включая проигрыши. Ниже — каждая строка, где конкурент значимо
            быстрее ReFormer core (▼ в полном отчёте), от самого большого отставания к меньшему.
          </Translate>
        </p>
        <p className={styles.lossSummary}>
          <Translate
            id="benchmark.losses.summary"
            values={{
              n: <b>{all.length}</b>,
              total,
              list: byRival
                .map((r) =>
                  translate(
                    { id: 'benchmark.losses.byRival', message: '{lib} — {n}' },
                    { lib: libLabel(r.lib), n: r.n }
                  )
                )
                .join(', '),
            }}
          >
            {'Таких строк {n} из {total}. Кто обгоняет (в строке их может быть несколько): {list}.'}
          </Translate>
        </p>
        <div className={styles.lossGrid}>
          {data.forms.map((form) => {
            const losses = lossesOf(form);
            if (!losses.length) return null;
            return (
              <div key={form.id} className={styles.lossBlock}>
                <Heading as="h3" className={styles.subTitle}>
                  {cap(t.formTitle(form))}
                </Heading>
                <div className={styles.tableWrap}>
                  <table className={clsx(styles.table, styles.lossTable)}>
                    <thead>
                      <tr>
                        <th>
                          <Translate id="benchmark.losses.col.metric">Фаза и метрика</Translate>
                        </th>
                        <th className={styles.num}>ReFormer core</th>
                        <th>
                          <Translate id="benchmark.losses.col.winner">Значимо быстрее</Translate>
                        </th>
                        <th className={styles.num}>
                          <Translate id="benchmark.losses.col.factor">Отставание</Translate>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {losses.map((l) => {
                        const unit = unitOf(form, l.section, l.row);
                        const u = t.unit(unit);
                        const others = l.winners.filter((w) => w !== l.winner);
                        return (
                          <tr key={`${l.section.id}/${l.row.id}`}>
                            <td>
                              <span className={styles.lossPhase}>
                                {t.phaseTitle(form, l.section.id, l.section.title)}
                              </span>
                              <span className={styles.lossMetric}>
                                {t.metricLabel(form, l.section.kind, l.row.id)}
                              </span>
                            </td>
                            <td className={styles.num}>
                              <span className={styles.lossCoreLabel}>ReFormer core </span>
                              {fmt(l.core, unit)} {u}
                            </td>
                            <td>
                              <b>{libLabel(l.winner)}</b>{' '}
                              <span className={styles.nowrap}>
                                {fmt(l.winnerValue, unit)} {u}
                              </span>
                              {others.length > 0 && (
                                <span className={styles.lossAlso}>
                                  <Translate
                                    id="benchmark.losses.also"
                                    values={{ list: joinNames(others.map(libLabel), t.isEn) }}
                                  >
                                    {'также {list}'}
                                  </Translate>
                                </span>
                              )}
                            </td>
                            <td className={clsx(styles.num, styles.lossFactor)}>
                              {fmtRatio(l.factor)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Все фазы ────────────────────────────────────────────────────────────────
function ResultCell({
  cell,
  unit,
  best,
  baseline,
}: {
  cell?: Cell;
  unit: string;
  best: boolean;
  baseline: boolean;
}): ReactNode {
  if (!cell) return <td className={styles.num}>—</td>;
  const [med, q25, q75, ratio, sig] = cell;
  return (
    <td className={clsx(styles.num, best && styles.bestCell, baseline && styles.baselineCell)}>
      <span className={styles.cellMain}>
        {fmt(med, unit)}
        {!baseline && ratio !== null && (
          <span className={styles.cellRatio}> {fmtRatio(ratio)}</span>
        )}
        {sig !== 0 && (
          <span className={styles.cellSig} title={sigTitle(sig)}>
            {' '}
            {sigMark(sig)}
          </span>
        )}
      </span>
      {q25 !== null && q75 !== null && (
        <span className={styles.cellIqr}>
          {fmt(q25, unit)}–{fmt(q75, unit)}
        </span>
      )}
    </td>
  );
}

function apiCallsText(
  t: BenchText,
  form: BenchForm,
  calls: Record<string, Record<string, number>>
): string {
  return form.libs
    .filter((l) => calls[l] !== undefined)
    .map((l) => {
      const list = Object.entries(calls[l]).map(([name, n]) => `${name} ×${n}`);
      return `${libLabel(l)} — ${list.length ? list.join(', ') : t.isEn ? 'none' : 'нет'}`;
    })
    .join('; ');
}

function PhaseDetails({ form, section }: { form: BenchForm; section: Section }): ReactNode {
  const t = useBenchText();
  const coreBest = section.rows.filter((r) => r.best === CORE).length;
  const noisy = section.rows.filter((r) => r.noisy);
  // Графики строятся только у раскрытой фазы: свёрнутые (и HTML с сервера) их не несут.
  const [open, setOpen] = useState(false);
  return (
    <details
      className={styles.phase}
      id={phaseDomId(form.id, section.id)}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className={styles.phaseSummary}>
        <span className={styles.phaseTitle}>{t.phaseTitle(form, section.id, section.title)}</span>
        <span className={styles.phaseMeta}>
          <Translate
            id="benchmark.phases.coreBest"
            values={{ n: coreBest, total: section.rows.length }}
          >
            {'ReFormer core лучший в {n} из {total}'}
          </Translate>
        </span>
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
                rows={form.libs
                  .filter((lib) => row.cells[lib])
                  .map((lib) => ({ lib, cell: row.cells[lib] }))}
                best={row.best ?? undefined}
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
                <th
                  key={lib}
                  className={clsx(styles.num, lib === 'baseline' && styles.baselineCell)}
                >
                  {libLabel(lib)}
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
                  <ResultCell
                    key={lib}
                    cell={row.cells[lib]}
                    unit={unitOf(form, section, row)}
                    best={lib === row.best}
                    baseline={lib === 'baseline'}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(noisy.length > 0 || section.apiCalls || section.notes.length > 0) && (
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
          {section.apiCalls && (
            <p>
              <Translate
                id="benchmark.phases.apiCalls"
                values={{ list: apiCallsText(t, form, section.apiCalls) }}
              >
                {
                  'Запросы к API за фазу различаются (часть работы перенесена в другую фазу): {list}.'
                }
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
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <Heading as="h2" id="phases" className={styles.sectionTitle}>
          <Translate id="benchmark.phases.title">Все фазы</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate
            id="benchmark.phases.lead"
            values={{ runs: data.meta.iterations, cpu: Math.max(...data.meta.cpuRates) }}
          >
            {
              'Ячейка — медиана по {runs} прогонам при CPU {cpu}x (каждый прогон сначала свёрнут: например, медиана задержки по всем клавишам фазы), под ней — разброс q25–q75. ×1.44 — во сколько раз хуже лучшего в строке; лучший — жирным. Меньше — лучше.'
            }
          </Translate>
        </p>
        <FormTabs>
          {(form) => (
            <>
              <Heatmap form={form} />
              <PhaseList form={form} />
            </>
          )}
        </FormTabs>
      </div>
    </section>
  );
}

// ── Трейсы во времени ───────────────────────────────────────────────────────
function Traces(): ReactNode {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" id="traces" className={styles.sectionTitle}>
          <Translate id="benchmark.traces.title">Память и DOM во времени</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.traces.lead">
            JS heap, DOM-узлы и обработчики событий по ходу всего сценария формы — у каждого
            участника своя линия. Фазы выровнены: окно замера фазы — полоса шириной самого долгого
            участника, между полосами — промежуток без замера (паузы, проверки, сборка мусора).
            Наведите на график или нажмите ←/→ — подсказка покажет значения всех участников в этот
            момент.
          </Translate>
        </p>
        <FormTabs>{(form) => <TraceCharts form={form} measuredRuns={data.meta.runs} />}</FormTabs>
      </div>
    </section>
  );
}

// ── Рендеры ─────────────────────────────────────────────────────────────────
function Renders(): ReactNode {
  const t = useBenchText();
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" id="renders" className={styles.sectionTitle}>
          <Translate id="benchmark.renders.title">Рендеры React</Translate>
        </Heading>
        <p className={styles.sectionLead}>
          <Translate id="benchmark.renders.lead">
            Отрендеренные компоненты за фазу (в скобках — commits); для ввода — на одну клавишу, для
            перемонтирования — на одно монтирование. Считает хук DevTools (флаг PerformedWork, как
            React DevTools), отдельный проход на CPU 1x.
          </Translate>
        </p>
        <FormTabs>
          {(form) => (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      <Translate id="benchmark.table.phase">Фаза</Translate>
                    </th>
                    {form.libs.map((lib) => (
                      <th
                        key={lib}
                        className={clsx(styles.num, lib === 'baseline' && styles.baselineCell)}
                      >
                        {libLabel(lib)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.renders.map((r) => {
                    const section = form.sections.find((s) => s.id === r.phase);
                    return (
                      <tr key={r.phase}>
                        <th scope="row" className={styles.rowHead}>
                          {t.phaseTitle(form, r.phase, section?.title ?? r.phase)}
                        </th>
                        {form.libs.map((lib) => {
                          const c = r.cells[lib];
                          if (!c)
                            return (
                              <td key={lib} className={styles.num}>
                                —
                              </td>
                            );
                          const [components, commits, perKey, perMount] = c;
                          const text =
                            perKey !== null
                              ? translate(
                                  {
                                    id: 'benchmark.renders.perKey',
                                    message: '{n}/клавиша ({commits})',
                                  },
                                  { n: perKey.toFixed(1), commits }
                                )
                              : perMount !== null
                                ? translate(
                                    {
                                      id: 'benchmark.renders.perMount',
                                      message: '{n}/монтирование',
                                    },
                                    { n: perMount.toFixed(0) }
                                  )
                                : `${components} (${commits})`;
                          return (
                            <td
                              key={lib}
                              className={clsx(
                                styles.num,
                                lib === 'baseline' && styles.baselineCell
                              )}
                            >
                              {text}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
          <Translate id="benchmark.bundle.lead">
            Отдельная prod-сборка каждой страницы, статическое замыкание входа. Главное число — gzip
            сверх baseline: сколько библиотека форм и код формы добавляют к той же странице без
            библиотеки. Сжатие считается на вход целиком, атрибуция пакетов — минифицированные байты
            по sourcemap.
          </Translate>
        </p>
        <div className={styles.chartGrid}>
          {data.forms.map((form) => {
            const entries = data.bundle.filter((b) => b.form === form.id && b.lib !== 'baseline');
            if (!entries.length) return null;
            return (
              <div key={form.id} className={styles.chartCard}>
                <BarChart
                  kicker={cap(t.formTitle(form))}
                  title={translate({
                    id: 'benchmark.bundle.chartTitle',
                    message: 'gzip сверх baseline',
                  })}
                  unit="КБ"
                  unitLabel={kb}
                  rows={entries.map((b) => ({
                    lib: b.lib,
                    cell: [b.overBaselineGzip, null, null, null, 0] as Cell,
                  }))}
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
                <th className={styles.num}>
                  <Translate id="benchmark.bundle.col.over" values={{ kb }}>
                    {'gzip сверх baseline, {kb}'}
                  </Translate>
                </th>
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
                  <th colSpan={6}>{cap(t.formTitle(form))}</th>
                </tr>
                {data.bundle
                  .filter((b) => b.form === form.id)
                  .map((b) => (
                    <tr key={b.lib}>
                      <th
                        scope="row"
                        className={clsx(
                          styles.rowHead,
                          b.lib === 'baseline' && styles.baselineCell
                        )}
                      >
                        {libLabel(b.lib)}
                      </th>
                      <td className={styles.num}>{kb1(b.raw)}</td>
                      <td className={styles.num}>{kb1(b.gzip)}</td>
                      <td className={styles.num}>{kb1(b.brotli)}</td>
                      <td className={clsx(styles.num, styles.strong)}>{kb1(b.overBaselineGzip)}</td>
                      <td className={styles.small}>
                        {b.top.map(([name, size]) => `${name} ${kb1(size)}`).join(', ')}
                      </td>
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
          <Translate id="benchmark.code.lead">
            Исходники реализации, попавшие в бандл страницы (по sourcemap): строки без пустых и
            комментариев после prettier. «Форма» — файлы каталога формы, «обвязка» — остальной код
            интеграции библиотеки (адаптеры полей, тема RJSF, общие правила и поведение ReFormer).
            Общий слой бенчмарка одинаков у всех и не считается. JSON-документ кредита у ReFormer
            JSON сгенерирован один раз из общих метаданных полей; RJSF и ReFormer core строят схемы
            из тех же метаданных в коде.
          </Translate>
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <Translate id="benchmark.code.col.impl">Реализация</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.formTs">Форма TS</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.formJson">Форма JSON</Translate>
                </th>
                <th className={styles.num}>
                  <Translate id="benchmark.code.col.kitTs">Обвязка TS</Translate>
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
                {data.code
                  .filter((c) => c.form === form.id)
                  .map((c) => (
                    <tr key={c.lib}>
                      <th
                        scope="row"
                        className={clsx(
                          styles.rowHead,
                          c.lib === 'baseline' && styles.baselineCell
                        )}
                      >
                        {libLabel(c.lib)}
                      </th>
                      <td className={styles.num}>{c.formTs}</td>
                      <td className={styles.num}>{c.formJson}</td>
                      <td className={styles.num}>{c.kitTs}</td>
                      <td className={clsx(styles.num, styles.strong)}>{c.total}</td>
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
  const withCal = data.forms.filter((f) => f.calibration);
  const withBg = data.forms.filter((f) => f.background);
  if (!withCal.length && !withBg.length) {
    return (
      <p className={styles.methodNote}>
        <Translate id="benchmark.method.noHealth">
          Опубликованный отчёт снят до появления калибровки и детектора фоновой нагрузки: дрейф
          скорости машины и соседние процессы в этих прогонах не измерены.
        </Translate>
      </p>
    );
  }
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
            <th className={styles.num}>
              <Translate id="benchmark.health.col.dirty">«Грязных» прогонов</Translate>
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
                <td className={styles.num}>{bg?.n ? `${bg.dirtyRuns} / ${bg.n}` : '—'}</td>
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
# Пакеты @reformer/* берутся из dist — собрать по порядку
for pkg in @reformer/core @reformer/cdk @reformer/renderer-react @reformer/renderer-json; do
  npm run build:stackblitz -w "$pkg"
done
# Свободна ли машина: соседние процессы, GPU
npm run bench:idle-check
# Сборка страниц, conformance, прогоны и отчёт; на занятой машине не начнёт
BENCH_REQUIRE_IDLE=1 npm run bench`;

const REPRODUCE_EN = `npm ci
npx playwright install chromium
# @reformer/* packages are consumed from dist — build them in order
for pkg in @reformer/core @reformer/cdk @reformer/renderer-react @reformer/renderer-json; do
  npm run build:stackblitz -w "$pkg"
done
# Is the machine idle: neighbouring processes, GPU
npm run bench:idle-check
# Build the pages, conformance, runs and the report; refuses to start on a busy machine
BENCH_REQUIRE_IDLE=1 npm run bench`;

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
                <Translate id="benchmark.method.contract.title">Контракт поведения.</Translate>
              </b>{' '}
              <Translate id="benchmark.method.contract.text">
                Одна спецификация на форму, общий UI, fake API и тексты у всех. Конкуренты написаны
                идиоматично по официальной документации, без опоры на код ReFormer, с одинаковым
                бюджетом оптимизаций: без React Compiler и ручных memo сверх рекомендованного.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.method.conformance.title">
                  Conformance до замеров.
                </Translate>
              </b>{' '}
              <Translate id="benchmark.method.conformance.text">
                Перед замерами Playwright прогоняет 171 тест: conformance всех реализаций — ошибки и
                тихая фаза, серверные проверки, маски, визард, массивы, канонический payload — и
                калибровку счётчика рендеров. Замеры начинаются только после зелёного прогона.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.method.stats.title">Статистика.</Translate>
              </b>{' '}
              <Translate id="benchmark.method.stats.text" values={{ runs: data.meta.iterations }}>
                {
                  'Каждый прогон сворачивается (например, медиана по всем клавишам фазы), по {runs} прогонам — медиана и IQR. Значимость против ReFormer core — точный Mann–Whitney U с поправкой Holm по всем сравнениям отчёта, p < 0.05; разница меньше шума A/A (две одинаковые сборки ReFormer core) разницей не считается.'
                }
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.method.health.title">
                  Калибровка и фоновая нагрузка.
                </Translate>
              </b>{' '}
              <Translate id="benchmark.method.health.text">
                В начале и в конце каждого прогона — калибровочная JS-нагрузка (дрейф скорости
                машины) и снимок соседних процессов и GPU; с BENCH_REQUIRE_IDLE=1 замеры не начнутся
                на занятой машине.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.method.drift.title">Дрейф машины.</Translate>
              </b>{' '}
              <Translate id="benchmark.method.drift.text">
                Абсолютные числа разных сессий несравнимы даже на одной машине: baseline (тот же
                код) расходился до 1.6× между прогонами одного дня. Сравнивайте отношения внутри
                одного отчёта: участники в прогоне чередуются в перемешанном порядке, и дрейф
                ложится на всех одинаково.
              </Translate>
            </li>
            <li>
              <b>
                <Translate id="benchmark.method.limits.title">Ограничения.</Translate>
              </b>{' '}
              <Translate id="benchmark.method.limits.text">
                Троттлинг CPU в Chromium замедляет только main thread — стоимость больших бандлов
                занижена. Одна машина и один браузер. «Клавиша → конец кадра» квантуется частотой
                кадров; точнее — «клавиша → конец обработки» и JS на клавишу.
              </Translate>
            </li>
          </ul>
          <div className={styles.methodSide}>
            <Heading as="h3" className={styles.subTitle}>
              <Translate id="benchmark.method.sources">Исходники и сырой отчёт</Translate>
            </Heading>
            <ul className={styles.linkList}>
              <li>
                <Link href={blob('projects/forms-benchmark/BENCH-CONTRACT.md')}>
                  BENCH-CONTRACT.md
                </Link>
                {' — '}
                <Translate id="benchmark.method.link.contract">
                  методика и правила честности
                </Translate>
              </li>
              <li>
                <Link href={blob('docs/benchmarks/forms/report.md')}>report.md</Link>
                {' — '}
                <Translate id="benchmark.method.link.report">полный отчёт этого прогона</Translate>
              </li>
              <li>
                <Link href={tree('projects/forms-benchmark/src/libs')}>
                  forms-benchmark/src/libs
                </Link>
                {' — '}
                <Translate id="benchmark.method.link.libs">
                  реализации всех участников; в README каждой — отклонения
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

export default function BenchmarkPage(): ReactNode {
  return (
    <Layout
      title={translate({ id: 'benchmark.page.title', message: 'Бенчмарк форм' })}
      description={translate({
        id: 'benchmark.page.description',
        message:
          'ReFormer против Formik, React Hook Form и RJSF: загрузка, ввод, визард, массивы, бандл и объём кода на двух реальных формах — медианы, разброс и значимость, включая проигрыши.',
      })}
    >
      <Hero />
      <SectionNav />
      <main className={styles.main}>
        <Traces />
        <KeyResults />
        <Losses />
        <AllPhases />
        <Renders />
        <Bundle />
        <CodeSize />
        <Methodology />
      </main>
    </Layout>
  );
}

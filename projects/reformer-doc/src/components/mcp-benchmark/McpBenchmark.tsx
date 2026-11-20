/**
 * Инфографика страницы «Замеры: с MCP и без» (docs/mcp/benchmark.mdx): итог прогонов плитками и
 * бар-чартами, разбивка по видам задач, карточки сценариев и причины провалов. Данные — готовые
 * сводки из `src/data/mcp-benchmark.json`; здесь только отрисовка и подписи на двух языках.
 *
 * Без библиотек графиков: бары — CSS, ширина в процентах от максимума метрики, поэтому графики
 * тянутся от телефона до десктопа. Графики по отдельным прогонам — в McpCharts.tsx.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import data from '@site/src/data/mcp-benchmark.json';
import type { ArmId, ArmSummary, Operation, ScenarioResult } from './types';
import styles from './mcp-benchmark.module.css';

export type Lang = 'ru' | 'en';

export function useLang(): Lang {
  const { i18n } = useDocusaurusContext();
  return i18n.currentLocale === 'en' ? 'en' : 'ru';
}

export const ARM_LABELS: Record<ArmId, Record<Lang, string>> = {
  'no-mcp': { ru: 'Без MCP', en: 'No MCP' },
  'mcp-default': { ru: 'MCP · инструменты', en: 'MCP · tool set' },
  'mcp-dsl': { ru: 'MCP · code-guided-dsl', en: 'MCP · code-guided-dsl' },
};

export const ARM_FILL: Record<ArmId, string> = {
  'no-mcp': styles.fill_none,
  'mcp-default': styles.fill_default,
  'mcp-dsl': styles.fill_dsl,
};

const BASELINE: ArmId = 'no-mcp';
const BEST_MCP: ArmId = 'mcp-dsl';

const TEXT = {
  ru: {
    quality: 'Качество',
    byStack: 'по стекам',
    withoutMcp: (p: number) => `без MCP ${p}%`,
    speed: 'Скорость',
    cost: 'Стоимость',
    tokens: 'Токены',
    steps: 'Шаги агента',
    times: (x: string) => `×${x}`,
    passRate: 'Пройдено, %',
    passRateHint: 'прогонов, прошедших все обязательные проверки',
    minutesTotal: 'Время всех прогонов',
    minutesHint: 'сумма по 90 прогонам плеча, мин',
    costTotal: 'Стоимость всех прогонов',
    costTotalHint: 'сумма по 90 прогонам плеча, $',
    costPerPass: 'Стоимость пройденного прогона',
    costPerPassHint: 'все расходы плеча / число пройденных, $',
    turns: 'Шагов агента на прогон',
    turnsHint: 'медиана',
    output: 'Выходных токенов на прогон',
    outputHint: 'медиана, токенов',
    input: 'Входных токенов на прогон',
    inputHint: 'медиана, вместе с кэшем',
    score: 'Средний счёт проверок',
    scoreHint: 'доля пройденных проверок, 0–1',
    min: 'мин',
    operation: 'Задача',
    ops: { create: 'Создание формы', edit: 'Правка готовой формы', delete: 'Удаление полей' },
    approach: 'Плечо',
    passed: 'Пройдено',
    scoreCol: 'Счёт',
    timeCol: 'Время, медиана',
    costCol: 'Стоимость',
    turnsCol: 'Шагов',
    outputCol: 'Вывод',
    level: (n: number) => `уровень ${n}`,
    runs: (n: number) => `${n} прогонов`,
    vs: 'против',
    noPass: 'нет пройденных',
    failuresTitle: (arm: string) => `${arm}: что не прошло на создании`,
    noFailures: 'все создания прошли',
  },
  en: {
    quality: 'Quality',
    byStack: 'by stack',
    withoutMcp: (p: number) => `no MCP ${p}%`,
    speed: 'Speed',
    cost: 'Cost',
    tokens: 'Tokens',
    steps: 'Agent steps',
    times: (x: string) => `×${x}`,
    passRate: 'Passed, %',
    passRateHint: 'runs that pass every required check',
    minutesTotal: 'Time of all runs',
    minutesHint: 'sum over the 90 runs of the arm, min',
    costTotal: 'Cost of all runs',
    costTotalHint: 'sum over the 90 runs of the arm, $',
    costPerPass: 'Cost per passed run',
    costPerPassHint: 'all spending of the arm / passed runs, $',
    turns: 'Agent steps per run',
    turnsHint: 'median',
    output: 'Output tokens per run',
    outputHint: 'median, tokens',
    input: 'Input tokens per run',
    inputHint: 'median, cache included',
    score: 'Mean check score',
    scoreHint: 'share of passed checks, 0–1',
    min: 'min',
    operation: 'Task',
    ops: { create: 'Create a form', edit: 'Edit a ready form', delete: 'Remove fields' },
    approach: 'Arm',
    passed: 'Passed',
    scoreCol: 'Score',
    timeCol: 'Time, median',
    costCol: 'Cost',
    turnsCol: 'Steps',
    outputCol: 'Output',
    level: (n: number) => `level ${n}`,
    runs: (n: number) => `${n} runs`,
    vs: 'vs',
    noPass: 'none passed',
    failuresTitle: (arm: string) => `${arm}: what failed on creation`,
    noFailures: 'every creation passed',
  },
} as const;

const TAGS: Record<string, Record<Lang, string>> = {
  spec: { ru: 'по спецификации', en: 'from a spec' },
  array: { ru: 'массив строк', en: 'repeating rows' },
  computed: { ru: 'вычисления', en: 'computed fields' },
  conditional: { ru: 'условные поля', en: 'conditional fields' },
  cross: { ru: 'межполевые правила', en: 'cross-field rules' },
  async: { ru: 'асинхронная проверка', en: 'async check' },
  operators: { ru: 'свои валидаторы', en: 'custom validators' },
  submit: { ru: 'отправка', en: 'submit' },
  heavy: { ru: 'большая форма', en: 'large form' },
  validation: { ru: 'валидация', en: 'validation' },
  delete: { ru: 'удаление', en: 'removal' },
  copy: { ru: 'копирование значений', en: 'copied values' },
  edit: { ru: 'правка', en: 'edit' },
  rename: { ru: 'переименование', en: 'rename' },
  wizard: { ru: 'мастер с шагами', en: 'wizard' },
};

export const TITLES_EN: Record<string, string> = {
  'registration-create': 'Registration: create the form',
  'registration-edit': 'Registration: edit a ready form',
  'registration-delete': 'Registration: remove fields with their rules',
  'order-create': 'Checkout: create the form from a spec',
  'order-edit': 'Checkout: rename, a new computed field, a conditional rule',
  'order-delete': 'Checkout: remove fields with their dependencies',
  'wizard-create': 'Checkout wizard: create from a spec',
  'wizard-edit': 'Checkout wizard: a new step, a moved field, a renamed step',
  'wizard-split': 'Checkout wizard: one page → steps',
  'wizard-delete': 'Checkout wizard: remove steps with their fields and dependencies',
};

/** Порядок стеков в подписях: от ядра к рендерерам. */
const STACK_ORDER = ['core', 'renderer-react', 'renderer-json'];

export const STACKS: Record<string, string> = {
  core: 'core',
  'renderer-react': 'react',
  'renderer-json': 'json',
};

/** Проверка стенда → человеческая подпись. */
function checkLabel(check: string, lang: Lang): string {
  const known: Record<string, Record<Lang, string>> = {
    'workspace.layout': { ru: 'файлы модуля не по раскладке', en: 'module files off the layout' },
    'runtime.form': { ru: 'форма не собирается', en: 'the form does not assemble' },
    'runtime.load': { ru: 'модуль не загружается', en: 'the module does not load' },
    'static.tsc': { ru: 'ошибки типов', en: 'type errors' },
    'static.stack': { ru: 'не тот стек', en: 'wrong stack' },
  };
  if (known[check]) return known[check][lang];
  const probe = /^runtime\.probe\.(.+)$/.exec(check);
  if (probe) return lang === 'en' ? `probe “${probe[1]}”` : `проба «${probe[1]}»`;
  const structure = /^runtime\.structure\.(.+)$/.exec(check);
  if (structure) return lang === 'en' ? `structure: ${structure[1]}` : `структура: ${structure[1]}`;
  return check;
}

export const fmtMinutes = (value: number | null, lang: Lang): string =>
  value === null ? '—' : `${value < 10 ? value.toFixed(1) : Math.round(value)} ${TEXT[lang].min}`;
export const fmtUsd = (value: number | null): string =>
  value === null ? '—' : `$${value < 1 ? value.toFixed(3) : value.toFixed(2)}`;
export const fmtTokens = (value: number): string =>
  value >= 100_000 ? `${Math.round(value / 1000)}k` : `${(value / 1000).toFixed(1)}k`;
const fmtRatio = (value: number): string => (value >= 10 ? value.toFixed(0) : value.toFixed(1));
const percent = (passes: number, runs: number): number => (runs ? (passes / runs) * 100 : 0);

/** Легенда плеч: образец заливки + подпись. */
export function McpLegend(): ReactNode {
  const lang = useLang();
  return (
    <ul className={styles.legend}>
      {data.arms.map((arm) => (
        <li key={arm}>
          <span className={clsx(styles.swatch, ARM_FILL[arm])} aria-hidden="true" />
          {ARM_LABELS[arm][lang]}
        </li>
      ))}
    </ul>
  );
}

interface Metric {
  title: string;
  hint: string;
  better: 'higher' | 'lower';
  value: (summary: ArmSummary) => number | null;
  format: (value: number | null) => string;
}

/** Горизонтальные бары одной метрики по плечам; лучший — жирным, у MCP — кратность к «без MCP». */
function MetricChart({ metric }: { metric: Metric }): ReactNode {
  const lang = useLang();
  const values = data.arms.map((arm) => metric.value(data.summary[arm]));
  const present = values.filter((value): value is number => value !== null);
  const max = Math.max(...present, 0);
  const best = metric.better === 'higher' ? Math.max(...present) : Math.min(...present);
  const base = metric.value(data.summary[BASELINE]);
  return (
    <figure className={styles.chart}>
      <figcaption>
        <span className={styles.chartTitle}>{metric.title}</span>
        <span className={styles.chartHint}>{metric.hint}</span>
      </figcaption>
      <div className={styles.bars}>
        {data.arms.map((arm, index) => {
          const value = values[index];
          const ratio =
            arm === BASELINE || value === null || base === null || value === 0 || base === 0
              ? null
              : metric.better === 'higher'
                ? value / base
                : base / value;
          return (
            <div className={styles.barRow} key={arm}>
              <span className={styles.barName} title={ARM_LABELS[arm][lang]}>
                {ARM_LABELS[arm][lang]}
              </span>
              <span className={styles.barTrack} aria-hidden="true">
                <span
                  className={clsx(styles.fill, ARM_FILL[arm])}
                  style={{ width: `${max && value !== null ? (value / max) * 100 : 0}%` }}
                />
              </span>
              <span className={styles.barValue}>
                <span className={clsx(value === best && styles.best)}>{metric.format(value)}</span>
                {ratio !== null && ratio > 1.05 && (
                  <span className={styles.ratio}>{TEXT[lang].times(fmtRatio(ratio))}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

interface StackQuality {
  target: string;
  /** Доля пройденных у лучшего MCP-плеча, %. */
  best: number;
  /** Доля пройденных без MCP, %. */
  base: number;
}

/**
 * Какой стек надёжнее: доля пройденных прогонов по стекам у лучшего MCP-плеча и без MCP. От
 * лучшего стека к худшему; при равенстве решает работа без сервера, затем порядок STACK_ORDER.
 */
function stackQuality(): StackQuality[] {
  const best = data.summary[BEST_MCP].targets;
  const base = data.summary[BASELINE].targets;
  return STACK_ORDER.filter((target) => best[target] && base[target])
    .map((target) => ({
      target,
      best: percent(best[target].passes, best[target].runs),
      base: percent(base[target].passes, base[target].runs),
    }))
    .sort((a, b) => b.best - a.best || b.base - a.base);
}

interface Tile {
  kicker: string;
  value: string;
  caption: string;
  note: string;
  stacks?: StackQuality[];
}

/** Итог прогонов: плитки с главными кратностями и бар-чарты по метрикам. */
export function McpSummary(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const none = data.summary[BASELINE];
  const dsl = data.summary[BEST_MCP];
  const def = data.summary['mcp-default'];
  const pct = (s: ArmSummary) => Math.round(percent(s.passes, s.runs));
  const tiles: Tile[] = [
    {
      kicker: t.quality,
      value: `${pct(dsl)}%`,
      stacks: stackQuality(),
      caption:
        lang === 'en'
          ? `of runs pass every check with MCP · code-guided-dsl ${t.vs} ${pct(none)}% without MCP`
          : `прогонов проходят все проверки с MCP · code-guided-dsl ${t.vs} ${pct(none)}% без MCP`,
      note:
        lang === 'en'
          ? `MCP · tool set: ${pct(def)}%, mean score ${def.score.toFixed(3)} ${t.vs} ${none.score.toFixed(3)}`
          : `MCP · инструменты: ${pct(def)}%, средний счёт ${def.score.toFixed(3)} ${t.vs} ${none.score.toFixed(3)}`,
    },
    {
      kicker: t.speed,
      value: t.times(fmtRatio(none.minutesTotal / dsl.minutesTotal)),
      caption:
        lang === 'en'
          ? `faster: ${fmtMinutes(dsl.minutesTotal, lang)} for 90 runs ${t.vs} ${fmtMinutes(none.minutesTotal, lang)}`
          : `быстрее: ${fmtMinutes(dsl.minutesTotal, lang)} на 90 прогонов ${t.vs} ${fmtMinutes(none.minutesTotal, lang)}`,
      note:
        lang === 'en'
          ? `MCP · tool set: ×${fmtRatio(none.minutesTotal / def.minutesTotal)} (${fmtMinutes(def.minutesTotal, lang)})`
          : `MCP · инструменты: ×${fmtRatio(none.minutesTotal / def.minutesTotal)} (${fmtMinutes(def.minutesTotal, lang)})`,
    },
    {
      kicker: t.cost,
      value: t.times(fmtRatio(none.costTotal / dsl.costTotal)),
      caption:
        lang === 'en'
          ? `cheaper: ${fmtUsd(dsl.costTotal)} ${t.vs} ${fmtUsd(none.costTotal)} for 90 runs`
          : `дешевле: ${fmtUsd(dsl.costTotal)} ${t.vs} ${fmtUsd(none.costTotal)} за 90 прогонов`,
      note:
        lang === 'en'
          ? `per passed run ${fmtUsd(dsl.costPerPass)} ${t.vs} ${fmtUsd(none.costPerPass)}; MCP · tool set: ${fmtUsd(def.costTotal)}`
          : `за пройденный прогон ${fmtUsd(dsl.costPerPass)} ${t.vs} ${fmtUsd(none.costPerPass)}; MCP · инструменты: ${fmtUsd(def.costTotal)}`,
    },
    {
      kicker: t.tokens,
      value: t.times(fmtRatio(none.outputMedian / dsl.outputMedian)),
      caption:
        lang === 'en'
          ? `fewer output tokens per run: ${fmtTokens(dsl.outputMedian)} ${t.vs} ${fmtTokens(none.outputMedian)}`
          : `меньше выходных токенов на прогон: ${fmtTokens(dsl.outputMedian)} ${t.vs} ${fmtTokens(none.outputMedian)}`,
      note:
        lang === 'en'
          ? `input with cache: ${fmtTokens(dsl.inputMedian)} ${t.vs} ${fmtTokens(none.inputMedian)}`
          : `вход вместе с кэшем: ${fmtTokens(dsl.inputMedian)} ${t.vs} ${fmtTokens(none.inputMedian)}`,
    },
  ];
  const metrics: Metric[] = [
    {
      title: t.passRate,
      hint: t.passRateHint,
      better: 'higher',
      value: (s) => percent(s.passes, s.runs),
      format: (v) => (v === null ? '—' : `${Math.round(v)}%`),
    },
    {
      title: t.score,
      hint: t.scoreHint,
      better: 'higher',
      value: (s) => s.score,
      format: (v) => (v === null ? '—' : v.toFixed(3)),
    },
    {
      title: t.minutesTotal,
      hint: t.minutesHint,
      better: 'lower',
      value: (s) => s.minutesTotal,
      format: (v) => fmtMinutes(v, lang),
    },
    {
      title: t.costTotal,
      hint: t.costTotalHint,
      better: 'lower',
      value: (s) => s.costTotal,
      format: fmtUsd,
    },
    {
      title: t.costPerPass,
      hint: t.costPerPassHint,
      better: 'lower',
      value: (s) => s.costPerPass,
      format: fmtUsd,
    },
    {
      title: t.turns,
      hint: t.turnsHint,
      better: 'lower',
      value: (s) => s.turnsMedian,
      format: (v) => (v === null ? '—' : String(v)),
    },
    {
      title: t.output,
      hint: t.outputHint,
      better: 'lower',
      value: (s) => s.outputMedian,
      format: (v) => (v === null ? '—' : fmtTokens(v)),
    },
    {
      title: t.input,
      hint: t.inputHint,
      better: 'lower',
      value: (s) => s.inputMedian,
      format: (v) => (v === null ? '—' : fmtTokens(v)),
    },
  ];
  return (
    <div className={styles.root}>
      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <div className={styles.tile} key={tile.kicker}>
            <span className={styles.tileKicker}>{tile.kicker}</span>
            <span className={styles.tileValue}>{tile.value}</span>
            <span className={styles.tileCaption}>{tile.caption}</span>
            {tile.stacks && (
              <div className={styles.tileStacks}>
                <span className={styles.tileStacksTitle}>{t.byStack}</span>
                <ol>
                  {tile.stacks.map((stack) => (
                    <li key={stack.target}>
                      <span className={styles.tileStackName}>
                        {STACKS[stack.target] ?? stack.target}
                      </span>
                      <span className={styles.tileStackValue}>{Math.round(stack.best)}%</span>
                      <span className={styles.tileStackBase}>
                        {t.withoutMcp(Math.round(stack.base))}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <span className={styles.tileNote}>{tile.note}</span>
          </div>
        ))}
      </div>
      <McpLegend />
      <div className={styles.charts}>
        {metrics.map((metric) => (
          <MetricChart metric={metric} key={metric.title} />
        ))}
      </div>
    </div>
  );
}

/** Мини-бар в ячейке таблицы: значение и полоска от максимума столбца. */
function CellBar({
  arm,
  value,
  max,
  label,
}: {
  arm: ArmId;
  value: number | null;
  max: number;
  label: string;
}): ReactNode {
  return (
    <span className={styles.cellBar}>
      <span>{label}</span>
      <span className={styles.miniTrack} aria-hidden="true">
        <span
          className={clsx(styles.fill, ARM_FILL[arm])}
          style={{ width: `${max && value !== null ? (value / max) * 100 : 0}%` }}
        />
      </span>
    </span>
  );
}

/** Пройдено по видам задач: создание, правка, удаление. */
export function McpOperations(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const operations: Operation[] = ['create', 'edit', 'delete'];
  return (
    <div className={clsx(styles.root, styles.tableWrap)}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t.operation}</th>
            {data.arms.map((arm) => (
              <th key={arm}>{ARM_LABELS[arm][lang]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => (
            <tr key={op}>
              <td>{t.ops[op]}</td>
              {data.arms.map((arm) => {
                const cell = data.summary[arm].operations[op];
                const share = percent(cell.passes, cell.runs);
                return (
                  <td key={arm}>
                    <CellBar
                      arm={arm}
                      value={share}
                      max={100}
                      label={`${cell.passes}/${cell.runs}`}
                    />
                    <span className={styles.stacks}>
                      {fmtMinutes(cell.minutesMedian, lang)} · {fmtUsd(cell.costTotal)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function scenarioById(id: string): ScenarioResult {
  const scenario = data.scenarios.find((entry) => entry.id === id);
  if (!scenario) throw new Error(`Нет сценария ${id} в src/data/mcp-benchmark.json`);
  return scenario;
}

/** Заголовок сценария в языке страницы (для подписей вне MDX). */
export function useScenarioTitle(id: string): string {
  const lang = useLang();
  return lang === 'en' ? (TITLES_EN[id] ?? id) : scenarioById(id).title;
}

/** Карточка сценария: уровень, теги и таблица плеч с прохождением по стекам, временем и ценой. */
export function McpScenario({ id }: { id: string }): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scenario = scenarioById(id);
  const arms = data.arms.map((arm) => ({ arm, cell: scenario.arms[arm] }));
  const maxMinutes = Math.max(...arms.map(({ cell }) => cell.minutesMedian ?? 0));
  const maxCost = Math.max(...arms.map(({ cell }) => cell.costTotal));
  return (
    <div className={styles.root}>
      <div className={styles.scenarioMeta}>
        {scenario.level !== null && <span className={styles.badge}>{t.level(scenario.level)}</span>}
        <span>{t.runs(arms[0].cell.runs)}</span>
        <span aria-hidden="true">·</span>
        <span>{scenario.tags.map((tag) => TAGS[tag]?.[lang] ?? tag).join(', ')}</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.approach}</th>
              <th>{t.passed}</th>
              <th>{t.scoreCol}</th>
              <th>{t.timeCol}</th>
              <th>{t.costCol}</th>
              <th>{t.turnsCol}</th>
              <th>{t.outputCol}</th>
            </tr>
          </thead>
          <tbody>
            {arms.map(({ arm, cell }) => (
              <tr key={arm}>
                <td>
                  <span className={styles.armCell}>
                    <span className={clsx(styles.swatch, ARM_FILL[arm])} aria-hidden="true" />
                    {ARM_LABELS[arm][lang]}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      cell.passes === cell.runs
                        ? styles.pass
                        : cell.passes === 0
                          ? styles.fail
                          : undefined
                    }
                  >
                    {cell.passes}/{cell.runs}
                  </span>
                  <span className={styles.stacks}>
                    {STACK_ORDER.filter((target) => data.targets.includes(target))
                      .map((target) => {
                        const stack = cell.targets[target];
                        return `${STACKS[target] ?? target} ${stack.passes}/${stack.runs}`;
                      })
                      .join(' · ')}
                  </span>
                </td>
                <td>{cell.score.toFixed(3)}</td>
                <td>
                  <CellBar
                    arm={arm}
                    value={cell.minutesMedian}
                    max={maxMinutes}
                    label={fmtMinutes(cell.minutesMedian, lang)}
                  />
                </td>
                <td>
                  <CellBar
                    arm={arm}
                    value={cell.costTotal}
                    max={maxCost}
                    label={fmtUsd(cell.costTotal)}
                  />
                </td>
                <td>{cell.turnsMedian ?? '—'}</td>
                <td>{fmtTokens(cell.outputMedian)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Частые причины провала создания формы по плечам. */
export function McpCreateFailures(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  return (
    <div className={clsx(styles.root, styles.failures)}>
      {data.arms.map((arm) => {
        const failures = data.summary[arm].createFailures;
        return (
          <div className={styles.tile} key={arm}>
            <span className={styles.tileKicker}>{t.failuresTitle(ARM_LABELS[arm][lang])}</span>
            {failures.length === 0 ? (
              <span className={styles.tileNote}>{t.noFailures}</span>
            ) : (
              <ul>
                {failures.map((failure) => (
                  <li key={failure.check}>
                    {checkLabel(failure.check, lang)} — {failure.runs}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Строка условий прогона: дата, модель, число прогонов. */
export function McpRunInfo(): ReactNode {
  const lang = useLang();
  const runs = data.arms.reduce((total, arm) => total + data.summary[arm].runs, 0);
  const date = data.date
    ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${data.date}T00:00:00Z`))
    : '—';
  return (
    <p className={styles.runInfo}>
      {lang === 'en'
        ? `${date} · model ${data.model} · ${runs} runs: ${data.scenarios.length} scenarios × ${data.targets.length} stacks × ${data.repeats} repeats × ${data.arms.length} arms · batch ${data.batches.join(', ')}`
        : `${date} · модель ${data.model} · ${runs} прогонов: ${data.scenarios.length} сценариев × ${data.targets.length} стека × ${data.repeats} повтора × ${data.arms.length} плеча · батч ${data.batches.join(', ')}`}
    </p>
  );
}

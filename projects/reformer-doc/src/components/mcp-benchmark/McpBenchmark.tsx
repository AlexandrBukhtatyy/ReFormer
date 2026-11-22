/**
 * Инфографика страницы «Замеры: с MCP и без» (docs/mcp/benchmark.mdx): итог прогонов плитками и
 * бар-чартами, разбивка по видам задач, карточки сценариев и причины провалов. Данные — готовые
 * сводки из `src/data/mcp-benchmark*.json` (файл на модель, список — models.ts); здесь только
 * отрисовка и подписи на двух языках.
 *
 * У каждого блока свой выбор: модель (одна, готовое сравнение или все вместе) и плечо (без MCP,
 * с MCP или оба) — он меняет только этот блок. Одна модель — строки графиков её плечи, цвет — плечо. Несколько моделей — строки
 * «модель · плечо», цвет — модель, плечо — стиль заливки; наведение на модель приглушает остальные.
 *
 * Без библиотек графиков: бары — CSS, ширина в процентах от максимума метрики, поэтому графики
 * тянутся от телефона до десктопа. Графики по отдельным прогонам — в McpCharts.tsx.
 */
import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  ALL,
  ARM_ORDER,
  GROUPS,
  MODELS,
  armsOf,
  paidCostsOf,
  scenarioCell,
  scenarioMeta,
  summaryOf,
  useScope,
  useSharedScope,
  useView,
  type ArmChoice,
  type ModelInfo,
  type Scope,
  type Series,
  type View,
} from './models';
import type { ArmId, ArmSummary, Operation, ScenarioArm } from './types';
import styles from './mcp-benchmark.module.css';

export type Lang = 'ru' | 'en';

export function useLang(): Lang {
  const { i18n } = useDocusaurusContext();
  return i18n.currentLocale === 'en' ? 'en' : 'ru';
}

export const ARM_LABELS: Record<ArmId, Record<Lang, string>> = {
  'no-mcp': { ru: 'Без MCP', en: 'No MCP' },
  'mcp-dsl': { ru: 'С MCP', en: 'With MCP' },
};

export const ARM_FILL: Record<ArmId, string> = {
  'no-mcp': styles.fill_none,
  'mcp-dsl': styles.fill_dsl,
};

/** Заливка плеча в цвете модели (все модели): цвет задаёт `--series`. */
const MODEL_FILL: Record<ArmId, string> = {
  'no-mcp': styles.modelFill_none,
  'mcp-dsl': styles.modelFill_dsl,
};

const BASELINE: ArmId = 'no-mcp';
const BEST_MCP: ArmId = 'mcp-dsl';

const TEXT = {
  ru: {
    quality: 'Качество',
    speed: 'Скорость',
    cost: 'Стоимость',
    tokens: 'Токены',
    steps: 'Шаги агента',
    times: (x: string) => `×${x}`,
    passRate: 'Пройдено, %',
    passRateHint: 'прогонов, прошедших все обязательные проверки',
    minutesTotal: 'Время всех прогонов',
    minutesMedian: 'Время прогона',
    medianHint: 'медиана, мин',
    costMedian: 'Стоимость прогона',
    medianCostHint: 'медиана, $',
    minutesHint: 'сумма по прогонам плеча, мин',
    costTotal: 'Стоимость всех прогонов',
    costTotalHint: 'сумма по прогонам плеча, $',
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
    opsShort: { create: 'создание', edit: 'правка', delete: 'удаление' },
    matrix: (scenarios: number, targets: number) =>
      `${scenarios} ${plural(scenarios, 'сценарий', 'сценария', 'сценариев')} × ${targets} ${plural(targets, 'стек', 'стека', 'стеков')}`,
    notMeasured: 'не мерили',
    approach: 'Плечо',
    passed: 'Пройдено',
    scoreCol: 'Счёт',
    timeCol: 'Время, медиана',
    costCol: 'Стоимость',
    turnsCol: 'Шагов',
    outputCol: 'Вывод',
    level: (n: number) => `уровень ${n}`,
    runs: (n: number) => `${n} ${plural(n, 'прогон', 'прогона', 'прогонов')}`,
    vs: 'против',
    noPass: 'нет пройденных',
    failuresTitle: (arm: string) => `${arm}: что не прошло на создании`,
    noFailures: 'все создания прошли',
    model: 'Модель',
    allModels: 'Все модели',
    armPick: 'Плечо',
    bothArms: 'Оба',
    noRuns: (model: string) => `${model}: этот сценарий не мерили`,
    noCost: 'стоимость не считалась — модель локальная',
    common: (scenarios: number, targets: number) =>
      `Несколько моделей — только ячейки, которые мерили у каждой: ${scenarios} ${plural(scenarios, 'сценарий', 'сценария', 'сценариев')} × ${targets} ${plural(targets, 'стек', 'стека', 'стеков')}.`,
    without: (type: string, models: string) => `${type} не мерили: ${models}.`,
    colours:
      'Цвет — модель, плечо — стиль заливки и форма значка; наведите на модель, чтобы приглушить остальные.',
    panels:
      'Панель — модель, оси у панелей общие; цвет и форма значка — плечо. Наведите на модель в переключателе, чтобы приглушить остальные.',
  },
  en: {
    quality: 'Quality',
    speed: 'Speed',
    cost: 'Cost',
    tokens: 'Tokens',
    steps: 'Agent steps',
    times: (x: string) => `×${x}`,
    passRate: 'Passed, %',
    passRateHint: 'runs that pass every required check',
    minutesTotal: 'Time of all runs',
    minutesMedian: 'Run time',
    medianHint: 'median, min',
    costMedian: 'Run cost',
    medianCostHint: 'median, $',
    minutesHint: 'sum over the runs of the arm, min',
    costTotal: 'Cost of all runs',
    costTotalHint: 'sum over the runs of the arm, $',
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
    opsShort: { create: 'create', edit: 'edit', delete: 'remove' },
    matrix: (scenarios: number, targets: number) =>
      `${scenarios} ${scenarios === 1 ? 'scenario' : 'scenarios'} × ${targets} ${targets === 1 ? 'stack' : 'stacks'}`,
    notMeasured: 'not measured',
    approach: 'Arm',
    passed: 'Passed',
    scoreCol: 'Score',
    timeCol: 'Time, median',
    costCol: 'Cost',
    turnsCol: 'Steps',
    outputCol: 'Output',
    level: (n: number) => `level ${n}`,
    runs: (n: number) => `${n} ${n === 1 ? 'run' : 'runs'}`,
    vs: 'vs',
    noPass: 'none passed',
    failuresTitle: (arm: string) => `${arm}: what failed on creation`,
    noFailures: 'every creation passed',
    model: 'Model',
    allModels: 'All models',
    armPick: 'Arm',
    bothArms: 'Both',
    noRuns: (model: string) => `${model}: this scenario was not measured`,
    noCost: 'no cost — a local model',
    common: (scenarios: number, targets: number) =>
      `Several models — only the cells every one of them ran: ${scenarios} scenarios × ${targets} stacks.`,
    without: (type: string, models: string) => `${type} was not measured for ${models}.`,
    colours:
      'Colour is the model; the arm is the fill style and the mark shape. Hover a model to fade the others.',
    panels:
      'A panel per model, the panels share their axes; colour and mark shape are the arm. Hover a model in the switch to fade the others.',
  },
} as const;

/** Русское склонение по числу: 1 прогон, 2 прогона, 5 прогонов. */
export function plural(n: number, one: string, few: string, many: string): string {
  const tens = n % 100;
  const units = n % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

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

// ---------- модели: подписи, заливка, наведение ----------

/** `--series` для заливки и точки цвета модели. */
export const seriesColor = (color: string): CSSProperties =>
  ({ '--series': color }) as CSSProperties;

/** Подпись серии: плечо — для одной модели, «модель · плечо» — когда выбраны все. */
export function seriesLabel(series: Series, view: View, lang: Lang): string {
  // Плечо выбрано — оно одно на весь блок и названо в переключателе: подпись — модель.
  if (view.all && view.arm !== ALL) return series.model.label;
  return view.all
    ? `${series.model.label} · ${ARM_LABELS[series.arm][lang]}`
    : ARM_LABELS[series.arm][lang];
}

/** Заливка бара серии: цвет плеча для одной модели, цвет модели и стиль плеча — для всех. */
export function seriesFill(
  series: Series,
  view: View
): { className: string; style?: CSSProperties } {
  return view.all
    ? { className: MODEL_FILL[series.arm], style: seriesColor(series.model.color) }
    : { className: ARM_FILL[series.arm] };
}

/** Приглушить ли данные модели: в виде несколько моделей и указатель блока — на другой. */
export function dimmer(view: View, scope: Scope): (modelId: string) => boolean {
  const hovered = scope.hovered;
  const active =
    view.models.length > 1 && hovered !== null && view.models.some((model) => model.id === hovered);
  return (modelId) => active && modelId !== hovered;
}

/** Наведение на элемент модели — только когда моделей в блоке несколько. */
export function hoverProps(view: View, scope: Scope, modelId: string) {
  if (view.models.length <= 1) return {};
  return {
    onMouseEnter: () => scope.hover(modelId),
    onMouseLeave: () => scope.hover(null),
  };
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  onHover,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string; dot?: string; title?: string }>;
  onChange: (value: T) => void;
  onHover?: (value: T | null) => void;
}): ReactNode {
  const labelId = useId();
  return (
    <div className={styles.pickerGroup}>
      <span className={styles.pickerLabel} id={labelId}>
        {label}
      </span>
      <div className={styles.pickerOptions} role="group" aria-labelledby={labelId}>
        {options.map((option) => {
          const hover = onHover
            ? {
                onMouseEnter: () => onHover(option.id),
                onMouseLeave: () => onHover(null),
                onFocus: () => onHover(option.id),
                onBlur: () => onHover(null),
              }
            : {};
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={value === option.id}
              title={option.title}
              onClick={() => onChange(option.id)}
              {...hover}
            >
              {option.dot && (
                <span
                  className={styles.modelDot}
                  style={seriesColor(option.dot)}
                  aria-hidden="true"
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Переключатели блока: модель (цветная точка — цвет модели на графиках, когда выбраны все) и
 * плечо — из тех, что мерили у выбранных моделей. `children` — свои переключатели блока в том же
 * ряду (стек у карты сценариев).
 */
export function ModelPicker({
  scope,
  children,
}: {
  scope: Scope;
  children?: ReactNode;
}): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const arms = armsOf(scope.model);
  const isModel = (id: string) => MODELS.some((model) => model.id === id);
  return (
    <div className={styles.picker}>
      <Choice
        label={t.model}
        value={scope.model}
        options={[
          { id: ALL, label: t.allModels },
          ...GROUPS.map((group) => ({ id: group.id, label: group.label[lang] })),
          ...MODELS.map((model) => ({
            id: model.id,
            label: model.label,
            dot: model.color,
            title: model.note[lang],
          })),
        ]}
        onChange={(model) => {
          scope.setModel(model);
          if (scope.arm !== ALL && !armsOf(model).includes(scope.arm)) scope.setArm(ALL);
        }}
        onHover={(id) => scope.hover(id && isModel(id) ? id : null)}
      />
      {arms.length > 1 && (
        <Choice<ArmChoice>
          label={t.armPick}
          value={scope.arm}
          options={[
            { id: ALL, label: t.bothArms },
            ...arms.map((arm) => ({ id: arm, label: ARM_LABELS[arm][lang] })),
          ]}
          onChange={scope.setArm}
        />
      )}
      {children}
    </div>
  );
}

/**
 * Что сравнивает блок: общие ячейки нескольких моделей и модели без выбранного плеча. Блоки по
 * сценариям (`cells={false}`) берут все прогоны сценария — им только легенда цвета. Панели по модели
 * (`panels`) объясняют, что цвет в них — плечо.
 */
export function ScopeNote({
  view,
  cells = true,
  panels = false,
}: {
  view: View;
  cells?: boolean;
  panels?: boolean;
}): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const notes: string[] = [];
  if (view.models.length > 1) {
    if (cells) notes.push(t.common(view.scenarioIds.length, view.targets.length));
    notes.push(panels ? t.panels : t.colours);
  }
  if (view.without.length > 0 && view.arm !== ALL) {
    notes.push(
      t.without(ARM_LABELS[view.arm][lang], view.without.map((model) => model.label).join(', '))
    );
  }
  if (notes.length === 0) return null;
  return <p className={styles.scopeNote}>{notes.join(' ')}</p>;
}

/** Легенда: плечи выбранной модели; для всех моделей — модели (цвет) и плечи (стиль заливки). */
function Legend({ view, scope }: { view: View; scope: Scope }): ReactNode {
  const lang = useLang();
  const dimmed = dimmer(view, scope);
  const arms = [...new Set(view.series.map((series) => series.arm))];
  if (!view.all) {
    return (
      <ul className={styles.legend}>
        {arms.map((arm) => (
          <li key={arm}>
            <span className={clsx(styles.swatch, ARM_FILL[arm])} aria-hidden="true" />
            {ARM_LABELS[arm][lang]}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={styles.legend}>
      {view.models.map((model) => (
        <li
          key={model.id}
          className={clsx(styles.dimmable, dimmed(model.id) && styles.dimmed)}
          {...hoverProps(view, scope, model.id)}
        >
          <span className={styles.modelDot} style={seriesColor(model.color)} aria-hidden="true" />
          {model.label}
        </li>
      ))}
      {arms.map((arm) => (
        <li key={arm}>
          <span
            className={clsx(styles.swatch, MODEL_FILL[arm])}
            style={seriesColor('var(--ifm-color-emphasis-600)')}
            aria-hidden="true"
          />
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

/** Горизонтальные бары одной метрики по сериям; лучший — жирным, у MCP — кратность к «без MCP». */
function MetricChart({
  metric,
  view,
  scope,
}: {
  metric: Metric;
  view: View;
  scope: Scope;
}): ReactNode {
  const lang = useLang();
  const dimmed = dimmer(view, scope);
  const rows = view.series.map((series) => ({
    series,
    value: metric.value(summaryOf(view, series)),
  }));
  const present = rows.map((row) => row.value).filter((value): value is number => value !== null);
  const max = Math.max(...present, 0);
  const best = metric.better === 'higher' ? Math.max(...present) : Math.min(...present);
  return (
    <figure className={styles.chart}>
      <figcaption>
        <span className={styles.chartTitle}>{metric.title}</span>
        <span className={styles.chartHint}>{metric.hint}</span>
      </figcaption>
      <div className={clsx(styles.bars, view.all && styles.barsWide)}>
        {rows.map(({ series, value }) => {
          // Кратность — к плечу без MCP той же модели.
          const baseline = view.series.find(
            (other) => other.model === series.model && other.arm === BASELINE
          );
          const base = baseline ? metric.value(summaryOf(view, baseline)) : null;
          const ratio =
            series.arm === BASELINE || value === null || base === null || value === 0 || base === 0
              ? null
              : metric.better === 'higher'
                ? value / base
                : base / value;
          const label = seriesLabel(series, view, lang);
          const fill = seriesFill(series, view);
          return (
            <div
              className={clsx(
                styles.barRow,
                styles.dimmable,
                dimmed(series.model.id) && styles.dimmed
              )}
              key={series.key}
              {...hoverProps(view, scope, series.model.id)}
            >
              <span className={styles.barName} title={label}>
                {label}
              </span>
              <span className={styles.barTrack} aria-hidden="true">
                {value !== null && (
                  <span
                    className={clsx(styles.fill, fill.className)}
                    style={{ ...fill.style, width: `${max ? (value / max) * 100 : 0}%` }}
                  />
                )}
              </span>
              <span className={styles.barValue}>
                <span className={clsx(value === best && present.length > 1 && styles.best)}>
                  {metric.format(value)}
                </span>
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

/**
 * Плитки главных кратностей: одна модель, оба плеча — «без MCP» и «с MCP». У
 * локальной модели стоимости нет — плитка стоимости показывает платную модель на тех же задачах.
 */
function SummaryTiles({ view }: { view: View }): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const find = (arm: ArmId) => view.series.find((series) => series.arm === arm);
  const noneSeries = find(BASELINE);
  const dslSeries = find(BEST_MCP);
  if (view.models.length !== 1 || view.arm !== ALL || !noneSeries || !dslSeries) return null;
  const none = summaryOf(view, noneSeries);
  const dsl = summaryOf(view, dslSeries);
  const pct = (s: ArmSummary) => Math.round(percent(s.passes, s.runs));
  const ratio = (a: number | null, b: number | null) =>
    a === null || b === null || b === 0 ? '—' : t.times(fmtRatio(a / b));
  // Локальная модель стоимости не считает: плитка показывает платную модель на тех же задачах.
  const paid =
    dsl.costTotal === null
      ? paidCostsOf(view).find((entry) => entry.arms[BASELINE] && entry.arms[BEST_MCP])
      : undefined;
  const costTile = (): { value: string; caption: string; note: string } => {
    if (dsl.costTotal !== null) {
      return {
        value: ratio(none.costTotal, dsl.costTotal),
        caption:
          lang === 'en'
            ? `cheaper: ${fmtUsd(dsl.costTotal)} ${t.vs} ${fmtUsd(none.costTotal)} for ${dsl.runs} runs`
            : `дешевле: ${fmtUsd(dsl.costTotal)} ${t.vs} ${fmtUsd(none.costTotal)} за ${t.runs(dsl.runs)}`,
        note:
          lang === 'en'
            ? `per passed run ${fmtUsd(dsl.costPerPass)} ${t.vs} ${fmtUsd(none.costPerPass)}`
            : `за пройденный прогон ${fmtUsd(dsl.costPerPass)} ${t.vs} ${fmtUsd(none.costPerPass)}`,
      };
    }
    const paidNone = paid?.arms[BASELINE];
    const paidDsl = paid?.arms[BEST_MCP];
    if (!paid || !paidNone || !paidDsl) return { value: '—', caption: t.noCost, note: '' };
    const name = paid.model.label;
    const own = view.models[0].label;
    return {
      value: ratio(paidNone.costTotal, paidDsl.costTotal),
      caption:
        lang === 'en'
          ? `cheaper for ${name} on the same tasks: ${fmtUsd(paidDsl.costTotal)} ${t.vs} ${fmtUsd(paidNone.costTotal)} for ${paidDsl.runs} runs`
          : `дешевле у ${name} на тех же задачах: ${fmtUsd(paidDsl.costTotal)} ${t.vs} ${fmtUsd(paidNone.costTotal)} за ${t.runs(paidDsl.runs)}`,
      note:
        lang === 'en'
          ? `${own} is local, its cost is not counted`
          : `${own} — локальная, стоимость не считается`,
    };
  };
  const tiles = [
    {
      kicker: t.quality,
      value: `${pct(dsl)}%`,
      caption:
        lang === 'en'
          ? `of runs pass every check with MCP ${t.vs} ${pct(none)}% without MCP`
          : `прогонов проходят все проверки с MCP ${t.vs} ${pct(none)}% без MCP`,
      note:
        lang === 'en'
          ? `mean check score ${dsl.score.toFixed(3)} ${t.vs} ${none.score.toFixed(3)}`
          : `средний счёт проверок ${dsl.score.toFixed(3)} ${t.vs} ${none.score.toFixed(3)}`,
    },
    {
      kicker: t.speed,
      value: ratio(none.minutesTotal, dsl.minutesTotal),
      caption:
        lang === 'en'
          ? `faster: ${fmtMinutes(dsl.minutesTotal, lang)} for ${dsl.runs} runs ${t.vs} ${fmtMinutes(none.minutesTotal, lang)}`
          : `быстрее: ${fmtMinutes(dsl.minutesTotal, lang)} на ${t.runs(dsl.runs)} ${t.vs} ${fmtMinutes(none.minutesTotal, lang)}`,
      note:
        lang === 'en'
          ? `median run: ${fmtMinutes(dsl.minutesMedian, lang)} ${t.vs} ${fmtMinutes(none.minutesMedian, lang)}`
          : `медиана прогона: ${fmtMinutes(dsl.minutesMedian, lang)} ${t.vs} ${fmtMinutes(none.minutesMedian, lang)}`,
    },
    { kicker: t.cost, ...costTile() },
    {
      kicker: t.tokens,
      value: ratio(none.outputMedian, dsl.outputMedian),
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
  return (
    <div className={styles.tiles}>
      {tiles.map((tile) => (
        <div className={styles.tile} key={tile.kicker}>
          <span className={styles.tileKicker}>{tile.kicker}</span>
          <span className={styles.tileValue}>{tile.value}</span>
          <span className={styles.tileCaption}>{tile.caption}</span>
          {tile.note && <span className={styles.tileNote}>{tile.note}</span>}
        </div>
      ))}
    </div>
  );
}

/** Итог прогонов: переключатели блока, плитки с главными кратностями и бар-чарты по метрикам. */
export function McpSummary(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scope = useScope();
  const view = useView(scope);
  // Суммы сравнимы только при равном числе прогонов: у моделей разное число повторов, поэтому
  // для нескольких моделей — медиана прогона.
  const several = view.models.length > 1;
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
    several
      ? {
          title: t.minutesMedian,
          hint: t.medianHint,
          better: 'lower',
          value: (s) => s.minutesMedian,
          format: (v) => fmtMinutes(v, lang),
        }
      : {
          title: t.minutesTotal,
          hint: t.minutesHint,
          better: 'lower',
          value: (s) => s.minutesTotal,
          format: (v) => fmtMinutes(v, lang),
        },
    several
      ? {
          title: t.costMedian,
          hint: t.medianCostHint,
          better: 'lower',
          value: (s) => s.costMedian,
          format: fmtUsd,
        }
      : {
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
  // Метрика без единого значения (стоимость у локальной модели) — без графика.
  const shown = metrics.filter((metric) =>
    view.series.some((series) => metric.value(summaryOf(view, series)) !== null)
  );
  return (
    <div className={styles.root}>
      <ModelPicker scope={scope} />
      <ScopeNote view={view} />
      <SummaryTiles view={view} />
      <Legend view={view} scope={scope} />
      <div className={styles.charts}>
        {shown.map((metric) => (
          <MetricChart metric={metric} view={view} scope={scope} key={metric.title} />
        ))}
      </div>
    </div>
  );
}

/** Мини-бар в ячейке таблицы: значение и полоска от максимума столбца. */
function CellBar({
  fill,
  value,
  max,
  label,
}: {
  fill: { className: string; style?: CSSProperties };
  value: number | null;
  max: number;
  label: string;
}): ReactNode {
  return (
    <span className={styles.cellBar}>
      <span>{label}</span>
      <span className={styles.miniTrack} aria-hidden="true">
        <span
          className={clsx(styles.fill, fill.className)}
          style={{ ...fill.style, width: `${max && value !== null ? (value / max) * 100 : 0}%` }}
        />
      </span>
    </span>
  );
}

/** Пройдено по видам задач: создание, правка, удаление. */
export function McpOperations(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scope = useScope();
  const view = useView(scope);
  const dimmed = dimmer(view, scope);
  const operations: Operation[] = ['create', 'edit', 'delete'];
  const cellClass = (series: Series) =>
    clsx(styles.dimmable, dimmed(series.model.id) && styles.dimmed);
  return (
    <div className={styles.root}>
      <ModelPicker scope={scope} />
      <ScopeNote view={view} />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.operation}</th>
              {view.series.map((series) => (
                <th
                  key={series.key}
                  className={cellClass(series)}
                  {...hoverProps(view, scope, series.model.id)}
                >
                  {seriesLabel(series, view, lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operations.map((op) => (
              <tr key={op}>
                <td>{t.ops[op]}</td>
                {view.series.map((series) => {
                  const cell = summaryOf(view, series).operations[op];
                  const fill = seriesFill(series, view);
                  const meta = [
                    `${cell.passes}/${cell.runs}`,
                    fmtMinutes(cell.minutesMedian, lang),
                    ...(cell.costTotal !== null ? [fmtUsd(cell.costTotal)] : []),
                  ].join(' · ');
                  return (
                    <td
                      key={series.key}
                      className={cellClass(series)}
                      {...hoverProps(view, scope, series.model.id)}
                    >
                      {cell.runs === 0 ? (
                        <span className={styles.missing}>—</span>
                      ) : (
                        <span className={styles.opCell}>
                          <span className={styles.opTrack} aria-hidden="true">
                            <span
                              className={clsx(styles.fill, fill.className)}
                              style={{
                                ...fill.style,
                                width: `${percent(cell.passes, cell.runs)}%`,
                              }}
                            />
                          </span>
                          <span className={styles.opMeta}>{meta}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Подходы рядом: строка — модель на своей матрице задач, столбец — плечо. Единственный блок, где все
 * модели видны сразу на всех своих прогонах: «все модели» в остальных блоках берут только общие
 * ячейки. Сравнивать — внутри строки; лучшая доля пройденных в строке — жирным.
 */
export function McpApproaches(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const operations: Operation[] = ['create', 'edit', 'delete'];
  return (
    <div className={styles.root}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.model}</th>
              {ARM_ORDER.map((arm) => (
                <th key={arm}>
                  <span className={styles.armCell}>
                    <span className={clsx(styles.swatch, ARM_FILL[arm])} aria-hidden="true" />
                    {ARM_LABELS[arm][lang]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODELS.map((model) => {
              const data = model.data;
              const cells = ARM_ORDER.map((arm) => ({
                arm,
                summary: data.arms.includes(arm) ? data.summary[arm] : null,
              }));
              const rates = cells.flatMap(({ summary }) =>
                summary && summary.runs > 0 ? [percent(summary.passes, summary.runs)] : []
              );
              const best = Math.max(...rates);
              return (
                <tr key={model.id}>
                  <td>
                    <span className={styles.armCell}>
                      <span
                        className={styles.modelDot}
                        style={seriesColor(model.color)}
                        aria-hidden="true"
                      />
                      {model.label}
                    </span>
                    <span className={styles.stacks}>
                      {t.matrix(data.scenarios.length, data.targets.length)}
                    </span>
                  </td>
                  {cells.map(({ arm, summary }) => {
                    if (!summary || summary.runs === 0) {
                      return (
                        <td key={arm}>
                          <span className={styles.missing}>{t.notMeasured}</span>
                        </td>
                      );
                    }
                    const rate = percent(summary.passes, summary.runs);
                    return (
                      <td key={arm}>
                        <span className={styles.approachCell}>
                          <span>
                            <span
                              className={clsx(rate === best && rates.length > 1 && styles.best)}
                            >
                              {summary.passes}/{summary.runs}
                            </span>{' '}
                            <span className={styles.ratio}>{Math.round(rate)}%</span>
                          </span>
                          <span className={styles.opTrack} aria-hidden="true">
                            <span
                              className={clsx(styles.fill, ARM_FILL[arm])}
                              style={{ width: `${rate}%` }}
                            />
                          </span>
                          <span className={styles.approachOps}>
                            {operations
                              .filter((op) => summary.operations[op].runs > 0)
                              .map((op) => (
                                <span key={op}>
                                  {t.opsShort[op]} {summary.operations[op].passes}/
                                  {summary.operations[op].runs}
                                </span>
                              ))}
                          </span>
                          <span className={styles.opMeta}>
                            {[
                              fmtMinutes(summary.minutesMedian, lang),
                              ...(summary.costTotal !== null ? [fmtUsd(summary.costTotal)] : []),
                            ].join(' · ')}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Заголовок сценария в языке страницы (для подписей вне MDX). */
export function useScenarioTitle(id: string): string {
  const lang = useLang();
  return lang === 'en' ? (TITLES_EN[id] ?? id) : (scenarioMeta(id)?.title ?? id);
}

/** Общий выбор карточек сценариев и переключателя над их вкладками. */
const SCENARIOS = 'scenarios';

/**
 * Переключатели над вкладками сценариев — выбор для всех карточек. Легенды плеч здесь нет: строки
 * таблиц сценариев подписаны тем же значком и именем плеча.
 */
export function McpScenarioControls(): ReactNode {
  const scope = useSharedScope(SCENARIOS);
  const view = useView(scope);
  return (
    <div className={styles.root}>
      <ModelPicker scope={scope} />
      <ScopeNote view={view} cells={false} />
    </div>
  );
}

/** Карточка сценария: уровень, теги и таблица серий с прохождением по стекам, временем и ценой. */
export function McpScenario({ id }: { id: string }): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scope = useSharedScope(SCENARIOS);
  const view = useView(scope);
  const dimmed = dimmer(view, scope);
  const scenario = scenarioMeta(id);
  if (!scenario) throw new Error(`Нет сценария ${id} в src/data/mcp-benchmark*.json`);
  const rows = view.series
    .map((series) => ({ series, cell: scenarioCell(series, id) }))
    .filter((row): row is { series: Series; cell: ScenarioArm } => row.cell !== null);
  const missing = view.models.filter((model) => !rows.some((row) => row.series.model === model));
  const maxMinutes = Math.max(...rows.map(({ cell }) => cell.minutesMedian ?? 0));
  const maxCost = Math.max(...rows.map(({ cell }) => cell.costTotal ?? 0));
  const runCounts = [...new Set(rows.map(({ cell }) => cell.runs))];
  return (
    <div className={styles.root}>
      <div className={styles.scenarioMeta}>
        {scenario.level !== null && <span className={styles.badge}>{t.level(scenario.level)}</span>}
        {runCounts.length === 1 && (
          <>
            <span>{t.runs(runCounts[0])}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{scenario.tags.map((tag) => TAGS[tag]?.[lang] ?? tag).join(', ')}</span>
      </div>
      {rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{view.all ? t.model : t.approach}</th>
                <th>{t.passed}</th>
                <th>{t.scoreCol}</th>
                <th>{t.timeCol}</th>
                <th>{t.costCol}</th>
                <th>{t.turnsCol}</th>
                <th>{t.outputCol}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ series, cell }) => {
                const fill = seriesFill(series, view);
                return (
                  <tr
                    key={series.key}
                    className={clsx(styles.dimmable, dimmed(series.model.id) && styles.dimmed)}
                    {...hoverProps(view, scope, series.model.id)}
                  >
                    <td>
                      <span className={styles.armCell}>
                        <span
                          className={clsx(styles.swatch, fill.className)}
                          style={fill.style}
                          aria-hidden="true"
                        />
                        {seriesLabel(series, view, lang)}
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
                        {STACK_ORDER.filter((target) => cell.targets[target])
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
                        fill={fill}
                        value={cell.minutesMedian}
                        max={maxMinutes}
                        label={fmtMinutes(cell.minutesMedian, lang)}
                      />
                    </td>
                    <td>
                      {cell.costTotal === null ? (
                        <span className={styles.missing}>—</span>
                      ) : (
                        <CellBar
                          fill={fill}
                          value={cell.costTotal}
                          max={maxCost}
                          label={fmtUsd(cell.costTotal)}
                        />
                      )}
                    </td>
                    <td>{cell.turnsMedian ?? '—'}</td>
                    <td>{fmtTokens(cell.outputMedian)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {missing.length > 0 && (
        <p className={styles.scopeNote}>
          {missing.map((model) => t.noRuns(model.label)).join('; ')}
        </p>
      )}
    </div>
  );
}

/** Частые причины провала создания формы по сериям. */
export function McpCreateFailures(): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const scope = useScope();
  const view = useView(scope);
  const dimmed = dimmer(view, scope);
  return (
    <div className={styles.root}>
      <ModelPicker scope={scope} />
      <ScopeNote view={view} />
      <div className={styles.failures}>
        {view.series.map((series) => {
          const failures = summaryOf(view, series).createFailures;
          return (
            <div
              className={clsx(
                styles.tile,
                styles.dimmable,
                dimmed(series.model.id) && styles.dimmed
              )}
              key={series.key}
              {...hoverProps(view, scope, series.model.id)}
            >
              <span className={styles.tileKicker}>
                {t.failuresTitle(seriesLabel(series, view, lang))}
              </span>
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
    </div>
  );
}

const fmtDate = (date: string | null, lang: Lang): string =>
  date
    ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${date}T00:00:00Z`))
    : '—';

/** Условия прогона одной модели: дата, модель, число прогонов. */
function modelInfoLine(model: ModelInfo, lang: Lang): string {
  const data = model.data;
  const runs = data.arms.reduce((total, arm) => total + data.summary[arm].runs, 0);
  const date = fmtDate(data.date, lang);
  const scenarios = data.scenarios.length;
  const targets = data.targets.length;
  const arms = data.arms.length;
  return lang === 'en'
    ? `${date} · ${model.label} (${model.note.en}) · ${runs} runs: ${scenarios} scenarios × ${targets} stacks × ${data.repeats} ${data.repeats === 1 ? 'repeat' : 'repeats'} × ${arms} ${arms === 1 ? 'arm' : 'arms'} · batch ${data.batches.join(', ')}`
    : `${date} · ${model.label} (${model.note.ru}) · ${runs} ${plural(runs, 'прогон', 'прогона', 'прогонов')}: ${scenarios} ${plural(scenarios, 'сценарий', 'сценария', 'сценариев')} × ${targets} ${plural(targets, 'стек', 'стека', 'стеков')} × ${data.repeats} ${plural(data.repeats, 'повтор', 'повтора', 'повторов')} × ${arms} ${plural(arms, 'плечо', 'плеча', 'плеч')} · батч ${data.batches.join(', ')}`;
}

/** Условия прогонов: строка на модель — дата, где гоняли, сколько прогонов, батч. */
export function McpRunInfo(): ReactNode {
  const lang = useLang();
  return (
    <ul className={clsx(styles.runInfo, styles.runList)}>
      {MODELS.map((model) => (
        <li key={model.id}>
          <span className={styles.modelDot} style={seriesColor(model.color)} aria-hidden="true" />{' '}
          {modelInfoLine(model, lang)}
        </li>
      ))}
    </ul>
  );
}

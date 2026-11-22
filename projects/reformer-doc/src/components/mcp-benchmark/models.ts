/**
 * Модели страницы «Замеры: с MCP и без» и выбор внутри блока: модель (одна или все вместе) и плечо
 * (оба, без MCP, с MCP).
 *
 * Выбор — свой у каждого блока с переключателем: он меняет только графики рядом с кнопками.
 * Карточки сценариев во вкладках делят один выбор с переключателем над вкладками (общий выбор по
 * имени — `useSharedScope`). Наведение на модель приглушает остальные модели до 15% — тоже только в
 * своём блоке.
 *
 * Вид блока — серии «модель × плечо» и их прогоны. Одна модель — все её прогоны и готовые сводки из
 * файла. Несколько моделей — только ячейки «сценарий × стек», которые есть у каждой модели вида:
 * иначе 180 прогонов одной модели сравнивались бы с девятью прогонами другой на другом наборе
 * задач. Сводки тогда считаются здесь же из прогонов — так же, как их считает mcp-value-docs.mjs.
 * Карточки и карта сценариев сравнивают один сценарий и берут все прогоны.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import gemma from '@site/src/data/mcp-benchmark-gemma4-26b.json';
import opus from '@site/src/data/mcp-benchmark-opus.json';
import qwen from '@site/src/data/mcp-benchmark-qwen2.5-coder-14b.json';
import sonnet from '@site/src/data/mcp-benchmark.json';
import type {
  ArmId,
  ArmTotals,
  McpBenchData,
  Operation,
  RunResult,
  ScenarioArm,
  ScenarioResult,
} from './types';

type Lang = 'ru' | 'en';

export interface ModelInfo {
  /** Ключ модели. */
  id: string;
  /** Имя модели — одинаково на обоих языках. */
  label: string;
  /** Чем и где гоняли. */
  note: Record<Lang, string>;
  /** Цвет модели — переменная из mcp-benchmark.module.css. */
  color: string;
  data: McpBenchData;
}

/**
 * JSON сайт типизирует сам (`moduleResolution: bundler`), строки плеч — просто `string`: формат
 * файла задаёт types.ts, отсюда приведение.
 *
 * Порядок — порядок цветов и строк графиков: слоты категориальной палитры по порядку (синий,
 * оранжевый, бирюзовый, жёлтый). Соседние слоты различимы при всех видах дальтонизма, а вот любые
 * два из четырёх — нет: жёлтый сливается с оранжевым. Поэтому диаграмма рассеяния, где рядом
 * оказываются любые две модели, при нескольких моделях разбивается на панели по модели.
 */
export const MODELS: ModelInfo[] = [
  {
    id: 'sonnet',
    label: 'Claude Sonnet',
    note: { ru: 'Claude Code, API Anthropic', en: 'Claude Code, Anthropic API' },
    color: 'var(--mcp-model-1)',
    data: sonnet as unknown as McpBenchData,
  },
  {
    id: 'opus',
    label: 'Claude Opus',
    note: { ru: 'Claude Code, API Anthropic', en: 'Claude Code, Anthropic API' },
    color: 'var(--mcp-model-2)',
    data: opus as unknown as McpBenchData,
  },
  {
    id: 'qwen2.5-coder-14b',
    label: 'Qwen2.5-Coder 14B',
    note: { ru: 'локально, LM Studio', en: 'local, LM Studio' },
    color: 'var(--mcp-model-3)',
    data: qwen as unknown as McpBenchData,
  },
  {
    id: 'gemma4-26b',
    label: 'Gemma 4 26B',
    note: { ru: 'локально, Ollama', en: 'local, Ollama' },
    color: 'var(--mcp-model-4)',
    data: gemma as unknown as McpBenchData,
  },
];

/**
 * Готовые сравнения нескольких моделей, кроме «всех». «Все» берут только ячейки, которые есть у
 * каждой модели, — пока локальные модели прошли не всю матрицу, это одна регистрация. Две модели
 * с полной матрицей сравниваются на всех десяти сценариях.
 */
export const GROUPS: Array<{ id: string; label: Record<Lang, string>; models: string[] }> = [
  {
    id: 'claude',
    label: { ru: 'Sonnet и Opus', en: 'Sonnet and Opus' },
    models: ['sonnet', 'opus'],
  },
];

/** Все модели или оба плеча. */
export const ALL = 'all';
/** Модель блока: id модели, id готового сравнения из GROUPS или все вместе. */
export type ModelChoice = string;

/** Модели выбора — в порядке MODELS. */
export function chosenModels(choice: ModelChoice): ModelInfo[] {
  if (choice === ALL) return MODELS;
  const group = GROUPS.find((entry) => entry.id === choice);
  return MODELS.filter((entry) => (group ? group.models.includes(entry.id) : entry.id === choice));
}
/** Плечо блока: одно или оба. */
export type ArmChoice = ArmId | typeof ALL;

export const ARM_ORDER: ArmId[] = ['no-mcp', 'mcp-dsl'];

// ---------- выбор блока ----------

export interface Scope {
  model: ModelChoice;
  arm: ArmChoice;
  /** Модель под указателем в этом блоке. */
  hovered: string | null;
  setModel(model: ModelChoice): void;
  setArm(arm: ArmChoice): void;
  hover(model: string | null): void;
}

const DEFAULT_MODEL = 'sonnet';

/** Выбор одного блока: свой у каждого графика. */
export function useScope(): Scope {
  const [model, setModel] = useState<ModelChoice>(DEFAULT_MODEL);
  const [arm, setArm] = useState<ArmChoice>(ALL);
  const [hovered, hover] = useState<string | null>(null);
  return useMemo(
    () => ({
      model,
      arm,
      hovered,
      setModel: (next: ModelChoice) => {
        setModel(next);
        hover(null);
      },
      setArm: (next: ArmChoice) => {
        setArm(next);
        hover(null);
      },
      hover,
    }),
    [model, arm, hovered]
  );
}

interface SharedState {
  model: ModelChoice;
  arm: ArmChoice;
  hovered: string | null;
}

const shared = new Map<string, SharedState>();
const listeners = new Map<string, Set<() => void>>();
const INITIAL: SharedState = { model: DEFAULT_MODEL, arm: ALL, hovered: null };

function sharedStore(name: string) {
  const read = () => shared.get(name) ?? INITIAL;
  const write = (patch: Partial<SharedState>) => {
    shared.set(name, { ...read(), ...patch });
    listeners.get(name)?.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    const own = listeners.get(name) ?? new Set<() => void>();
    own.add(listener);
    listeners.set(name, own);
    return () => {
      own.delete(listener);
    };
  };
  return { read, write, subscribe };
}

/**
 * Выбор, общий для блоков с одним именем: переключатель над вкладками сценариев и карточки в них.
 * На сервере — выбор по умолчанию.
 */
export function useSharedScope(name: string): Scope {
  const store = useMemo(() => sharedStore(name), [name]);
  const state = useSyncExternalStore(store.subscribe, store.read, () => INITIAL);
  return useMemo(
    () => ({
      ...state,
      setModel: (model: ModelChoice) => store.write({ model, hovered: null }),
      setArm: (arm: ArmChoice) => store.write({ arm, hovered: null }),
      hover: (hovered: string | null) => {
        if (store.read().hovered !== hovered) store.write({ hovered });
      },
    }),
    [state, store]
  );
}

// ---------- вид блока ----------

/** Серия графиков: прогоны одного плеча одной модели. */
export interface Series {
  key: string;
  model: ModelInfo;
  arm: ArmId;
}

/** Прогон вместе с моделью. */
export type ModelRun = RunResult & { model: string };

export interface View {
  key: string;
  /** Выбрано несколько моделей: цвет — модель, форма значка и стиль заливки — плечо. */
  all: boolean;
  /** Выбранное плечо. */
  arm: ArmChoice;
  /** Модели вида — выбранные, у которых есть прогоны выбранного плеча. */
  models: ModelInfo[];
  /** Выбранные модели без прогонов выбранного плеча. */
  without: ModelInfo[];
  series: Series[];
  /** Прогоны сводок и графиков: для нескольких моделей — только общие ячейки. */
  runs: ModelRun[];
  /** Хоть у одного прогона есть стоимость. */
  costKnown: boolean;
  /** Сценарии и стеки прогонов вида. */
  scenarioIds: string[];
  targets: string[];
}

const modelRuns = (model: ModelInfo): ModelRun[] =>
  model.data.runs.map((run) => ({ ...run, model: model.id }));

const viewCache = new Map<string, View>();

export function viewOf(model: ModelChoice, arm: ArmChoice): View {
  const key = `${model}|${arm}`;
  const cached = viewCache.get(key);
  if (cached) return cached;
  const chosen = chosenModels(model);
  const ofArm = (run: ModelRun) => arm === ALL || run.arm === arm;
  const models = chosen.filter((entry) => modelRuns(entry).some(ofArm));
  let runs = models.flatMap(modelRuns).filter(ofArm);
  if (models.length > 1) {
    const cellsOf = (entry: ModelInfo) =>
      new Set(
        runs.filter((run) => run.model === entry.id).map((run) => `${run.scenario}|${run.target}`)
      );
    const [first, ...rest] = models.map(cellsOf);
    const common = [...first].filter((cell) => rest.every((cells) => cells.has(cell)));
    runs = runs.filter((run) => common.includes(`${run.scenario}|${run.target}`));
  }
  const series = models.flatMap((entry) =>
    ARM_ORDER.filter((id) => runs.some((run) => run.model === entry.id && run.arm === id)).map(
      (id) => ({ key: `${entry.id}|${id}`, model: entry, arm: id })
    )
  );
  const view: View = {
    key,
    all: chosen.length > 1,
    arm,
    models,
    without: chosen.filter((entry) => !models.includes(entry)),
    series,
    runs,
    costKnown: runs.some((run) => run.cost !== null),
    scenarioIds: [...new Set(runs.map((run) => run.scenario))],
    targets: [...new Set(runs.map((run) => run.target))],
  };
  viewCache.set(key, view);
  return view;
}

export const useView = (scope: Scope): View => viewOf(scope.model, scope.arm);

/** Плечи, которые есть у выбранных моделей, — варианты второго переключателя. */
export function armsOf(model: ModelChoice): ArmId[] {
  const chosen = chosenModels(model);
  return ARM_ORDER.filter((arm) =>
    chosen.some((entry) => entry.data.runs.some((run) => run.arm === arm))
  );
}

export const runsOf = (view: View, series: Series): ModelRun[] =>
  view.runs.filter((run) => run.model === series.model.id && run.arm === series.arm);

// ---------- сводки ----------

const median = (values: number[]): number | null => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const round = (value: number | null, digits: number): number | null =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/** Сводка прогонов — как `summarize` в mcp-value-docs.mjs. */
function summarizeRuns(runs: ModelRun[]): ArmTotals {
  const passes = runs.filter((run) => run.pass).length;
  const costs = runs.map((run) => run.cost).filter((cost): cost is number => cost !== null);
  const costKnown = costs.length > 0;
  const cost = sum(costs);
  const operations = Object.fromEntries(
    (['create', 'edit', 'delete'] as Operation[]).map((kind) => {
      const own = runs.filter((run) => run.kind === kind);
      const ownCosts = own
        .map((run) => run.cost)
        .filter((value): value is number => value !== null);
      return [
        kind,
        {
          runs: own.length,
          passes: own.filter((run) => run.pass).length,
          minutesMedian: round(median(own.map((run) => run.minutes)), 2),
          costTotal: ownCosts.length ? round(sum(ownCosts), 2) : null,
        },
      ];
    })
  ) as ArmTotals['operations'];
  const failures = new Map<string, number>();
  for (const run of runs) {
    if (run.kind !== 'create' || run.pass) continue;
    for (const check of run.failed ?? []) failures.set(check, (failures.get(check) ?? 0) + 1);
  }
  return {
    runs: runs.length,
    passes,
    score: round(sum(runs.map((run) => run.score)) / (runs.length || 1), 3) ?? 0,
    minutesTotal: round(sum(runs.map((run) => run.minutes)), 1) ?? 0,
    minutesMedian: round(median(runs.map((run) => run.minutes)), 2),
    costTotal: costKnown ? round(cost, 2) : null,
    costMedian: costKnown ? round(median(costs), 3) : null,
    costPerPass: costKnown && passes ? round(cost / passes, 3) : null,
    turnsMedian: median(runs.map((run) => run.turns)),
    outputMedian: Math.round(median(runs.map((run) => run.output)) ?? 0),
    inputMedian: Math.round(median(runs.map((run) => run.input)) ?? 0),
    mcpCalls: 0,
    operations,
    createFailures: [...failures.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([check, count]) => ({ check, runs: count })),
  };
}

const summaryCache = new Map<string, ArmTotals>();

/** Сводка серии: готовая из файла для одной модели, посчитанная по общим ячейкам — для нескольких. */
export function summaryOf(view: View, series: Series): ArmTotals {
  if (view.models.length <= 1) return series.model.data.summary[series.arm];
  const key = `${view.key}|${series.key}`;
  const cached = summaryCache.get(key);
  if (cached) return cached;
  const summary = summarizeRuns(runsOf(view, series));
  summaryCache.set(key, summary);
  return summary;
}

/** Платные модели — у их прогонов есть стоимость; локальные считают только время и токены. */
export const PAID_MODELS = MODELS.filter((entry) =>
  entry.data.runs.some((run) => run.cost !== null)
);

/** Сводки платной модели по плечам — на ячейках вида. */
export interface PaidCost {
  model: ModelInfo;
  arms: Partial<Record<ArmId, ArmTotals>>;
}

const paidCache = new Map<string, PaidCost[]>();

/**
 * Во что те же задачи обошлись платным моделям, которых нет в виде. У локальной модели стоимости
 * нет, и плитка стоимости показывает цифры платной на тех же ячейках «сценарий × стек», а не на всём
 * её замере — иначе регистрация одной модели сравнивалась бы с десятью сценариями другой.
 */
export function paidCostsOf(view: View): PaidCost[] {
  const cached = paidCache.get(view.key);
  if (cached) return cached;
  const cells = new Set(view.runs.map((run) => `${run.scenario}|${run.target}`));
  const result = PAID_MODELS.filter((entry) => !view.models.includes(entry))
    .map((entry) => {
      const runs = modelRuns(entry).filter((run) => cells.has(`${run.scenario}|${run.target}`));
      const arms: PaidCost['arms'] = {};
      for (const arm of ARM_ORDER) {
        const own = runs.filter((run) => run.arm === arm);
        if (own.length > 0) arms[arm] = summarizeRuns(own);
      }
      return { model: entry, arms };
    })
    .filter((paid) => Object.keys(paid.arms).length > 0);
  paidCache.set(view.key, result);
  return result;
}

/** Ячейка сценария серии — все прогоны модели на сценарии; нет прогонов — `null`. */
export function scenarioCell(series: Series, id: string): ScenarioArm | null {
  const scenario = series.model.data.scenarios.find((entry) => entry.id === id);
  const cell = scenario?.arms[series.arm];
  return cell && cell.runs > 0 ? cell : null;
}

/** Сценарий по id из любой модели (заголовок, уровень, теги). */
export function scenarioMeta(id: string): ScenarioResult | undefined {
  for (const model of MODELS) {
    const found = model.data.scenarios.find((entry) => entry.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Все сценарии моделей вида — для карты сценариев. */
export function scenariosOf(view: View): ScenarioResult[] {
  const seen = new Map<string, ScenarioResult>();
  for (const model of view.models) {
    for (const scenario of model.data.scenarios) {
      if (!seen.has(scenario.id)) seen.set(scenario.id, scenario);
    }
  }
  return [...seen.values()];
}

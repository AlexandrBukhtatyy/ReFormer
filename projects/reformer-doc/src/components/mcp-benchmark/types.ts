/**
 * Формат данных страницы «Замеры: с MCP и без» — `src/data/mcp-benchmark.json`. Файл пишет
 * `packages/reformer-mcp/eval/scenarios/mcp-value-docs.mjs` из снимка отчёта подходов стенда.
 */

export type ArmId = 'no-mcp' | 'mcp-default' | 'mcp-dsl';
export type Operation = 'create' | 'edit' | 'delete';

/** Сводка прогонов одного плеча (всего набора или одного сценария). */
export interface ArmSummary {
  runs: number;
  passes: number;
  /** Средняя доля пройденных проверок, 0–1. */
  score: number;
  minutesTotal: number;
  minutesMedian: number | null;
  costTotal: number;
  costMedian: number | null;
  /** Стоимость всех прогонов, делённая на число пройденных; `null` — ни одного пройденного. */
  costPerPass: number | null;
  turnsMedian: number | null;
  outputMedian: number;
  /** Вход шага вместе с чтением и записью кэша. */
  inputMedian: number;
  mcpCalls: number;
}

export interface OperationSummary {
  runs: number;
  passes: number;
  minutesMedian: number | null;
  costTotal: number;
}

/** Прогоны и пройденные в одном стеке (`core`, `renderer-react`, `renderer-json`). */
export interface TargetCell {
  runs: number;
  passes: number;
}

export interface ArmTotals extends ArmSummary {
  /** Пройдено по стекам — на всём наборе сценариев. */
  targets: Record<string, TargetCell>;
  operations: Record<Operation, OperationSummary>;
  /** Частые не пройденные проверки на создании формы. */
  createFailures: Array<{ check: string; runs: number }>;
}

export interface ScenarioArm extends ArmSummary {
  targets: Record<string, TargetCell>;
}

export interface ScenarioResult {
  id: string;
  title: string;
  level: number | null;
  operation: string | null;
  tags: string[];
  arms: Record<ArmId, ScenarioArm>;
}

/** Один прогон замера — для графиков разброса. */
export interface RunResult {
  arm: ArmId;
  scenario: string;
  target: string;
  kind: Operation;
  repeat: number;
  pass: boolean;
  /** Доля пройденных проверок, 0–1. */
  score: number;
  minutes: number;
  /** Стоимость прогона по отчёту Claude Code, $. */
  cost: number;
  /** Выходные токены. */
  output: number;
  /** Входные токены вместе с чтением и записью кэша. */
  input: number;
  turns: number;
}

export interface McpBenchData {
  batches: string[];
  /** Дата батча, YYYY-MM-DD. */
  date: string | null;
  model: string;
  repeats: number;
  targets: string[];
  arms: ArmId[];
  summary: Record<ArmId, ArmTotals>;
  scenarios: ScenarioResult[];
  runs: RunResult[];
}

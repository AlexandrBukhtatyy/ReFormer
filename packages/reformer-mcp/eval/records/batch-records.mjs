/**
 * Записи батча стенда сценариев — из `records.jsonl`, а если его нет, восстановленные по сырью.
 *
 * Раннер пишет `records.jsonl` в конце батча. Остановленный батч (сон машины, Ctrl+C) или упавший
 * на записи (до `ReFormer-ju84`) остаётся без него, хотя прогоны в нём проверены. Тогда запись
 * собирается из артефактов прогона:
 *
 * - вердикт, счёт и проверки — `verify.json`;
 * - шаги и токены — журнал модели `transcript.jsonl`;
 * - время — строка итога в логе батча: stdout раннера, сохранённый в `.tmp/dev-logs/`, первая
 *   строка — «Батч <id>: …». Без лога у прогона нет времени;
 * - агент и модель — имя прогона и модели матриц (`matrices/*.json`): в имени `:` заменено на `-`.
 *
 * Отпечатков сервера, коммита и контракта у восстановленной записи нет (`server`, `source`,
 * `contractDigest` — `null`). Прогон без `verify.json` (прерван до проверки) пропускается.
 *
 * @module reformer-mcp/eval/records/batch-records
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadScenarios, scenariosDirectory } from '../scenarios/catalog.mjs';
import { repoRoot } from './record.mjs';

export const logsDirectory = path.join(repoRoot, '.tmp', 'dev-logs');

const isDirectory = (dir) => existsSync(dir) && statSync(dir).isDirectory();

/** Строки `.jsonl`; нет файла — пусто. */
export const readJsonl = (file) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
    : [];

/** Каталоги прогонов батча: в каждом есть журнал модели или трасса сервера. */
export const runDirectories = (batchDirectory) =>
  readdirSync(batchDirectory)
    .sort()
    .map((slug) => path.join(batchDirectory, slug))
    .filter(
      (runDir) =>
        existsSync(path.join(runDir, 'transcript.jsonl')) ||
        existsSync(path.join(runDir, 'server-trace.jsonl'))
    );

/** Время начала батча по его id: `20261113T010642Z-594a` → `2026-11-13T01:06:42Z`. */
export function batchStartedAt(batchId) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(batchId);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z` : null;
}

/** Лог батча по id: первая строка stdout раннера — «Батч <id>: …». */
function batchLog(batchId, directory) {
  if (!isDirectory(directory)) return '';
  for (const name of readdirSync(directory)) {
    const file = path.join(directory, name);
    if (!statSync(file).isFile()) continue;
    const text = readFileSync(file, 'utf8');
    if (text.startsWith(`Батч ${batchId}:`)) return text;
  }
  return '';
}

let scenarioIndex;
/** Сценарии по id, с holdout: предел шагов и разбиение. */
function scenarioById(id) {
  scenarioIndex ??= new Map(
    loadScenarios({ includeHoldout: true }).map((scenario) => [scenario.id, scenario])
  );
  return scenarioIndex.get(id);
}

let agentIndex;
/** Агент по модели из имени прогона: `qwen3.5-4b` → `{ kind: 'ollama', model: 'qwen3.5:4b' }`. */
function agentBySlug(modelSlug) {
  if (!agentIndex) {
    agentIndex = new Map();
    const directory = path.join(scenariosDirectory, 'matrices');
    for (const name of isDirectory(directory) ? readdirSync(directory) : []) {
      if (!name.endsWith('.json')) continue;
      const matrix = JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
      // У матриц конструктора `kind` не указан: такая строка не затирает строку с ним.
      for (const agent of matrix.agents ?? []) {
        const name = agent.model ?? agent.kind;
        if (!name) continue;
        const key = name.replace(/[^\w.-]+/g, '-');
        if (agentIndex.get(key)?.kind && !agent.kind) continue;
        agentIndex.set(key, { kind: agent.kind ?? 'unknown', model: agent.model ?? null });
      }
    }
  }
  return agentIndex.get(modelSlug) ?? { kind: 'unknown', model: modelSlug };
}

/** Запись прогона по его артефактам. */
function reconstructRecord(batchId, runDir, log) {
  const slug = path.basename(runDir);
  // `<сценарий>.<таргет>.<подход>.<модель>.r<N>`; в модели бывает точка: `qwen3.5-4b`.
  const parts = slug.split('.');
  const [scenarioId, target, approachId] = parts;
  const repeatSlug = parts.at(-1);
  const modelSlug = parts.slice(3, -1).join('.');
  const verify = JSON.parse(readFileSync(path.join(runDir, 'verify.json'), 'utf8'));
  const transcript = readJsonl(path.join(runDir, 'transcript.jsonl'));
  const steps = transcript.filter((entry) => entry.role === 'assistant');
  const scenario = scenarioById(scenarioId);
  const last = steps.at(-1);
  const exitReason =
    last && !(last.tool_calls ?? []).length
      ? 'completed'
      : steps.length >= (scenario?.budget?.maxSteps ?? 30)
        ? 'maxSteps'
        : 'timeout';
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const seconds = log.match(new RegExp(`[✓✗] ${escaped}: счёт [\\d.]+, (\\d+) с`))?.[1];
  return {
    runId: `${batchId}.${slug}`,
    batchId,
    harness: 'scenario',
    startedAt: batchStartedAt(batchId),
    durationMs: seconds ? Number(seconds) * 1000 : undefined,
    source: null,
    server: null,
    agent: agentBySlug(modelSlug),
    approach: { id: approachId },
    scenario: {
      id: scenarioId,
      level: scenario?.level ?? Number(scenarioId.match(/^L(\d+)/)?.[1] ?? 0),
      target,
      split: scenario?.split ?? null,
      contractDigest: null,
    },
    repeat: { index: Number(repeatSlug?.slice(1)) || 1, of: null },
    verdict: verify.verdict,
    exitReason,
    score: verify.score,
    gates: verify.gates ?? [],
    checks: verify.checks,
    usage: {
      turns: steps.length,
      inputTokens: steps.reduce((sum, entry) => sum + (entry.usage?.inputTokens ?? 0), 0),
      outputTokens: steps.reduce((sum, entry) => sum + (entry.usage?.outputTokens ?? 0), 0),
    },
    metrics: [
      {
        id: 'harness.truncations',
        value: transcript
          .filter((entry) => entry.role === 'harness')
          .reduce((sum, entry) => sum + (entry.truncated ?? 0), 0),
      },
    ],
    artifacts: { runDir: path.relative(repoRoot, runDir).replaceAll('\\', '/') },
  };
}

/**
 * Записи батча стенда сценариев.
 *
 * @param {string} batchDirectory каталог батча в `.tmp/mcp-runs`
 * @param {{ logs?: string }} [options] каталог логов батчей
 * @returns {{ records: object[], reconstructed: boolean }}
 */
export function readBatchRecords(batchDirectory, { logs = logsDirectory } = {}) {
  const stored = readJsonl(path.join(batchDirectory, 'records.jsonl'));
  if (stored.length > 0) return { records: stored, reconstructed: false };
  const batchId = path.basename(batchDirectory);
  const log = batchLog(batchId, logs);
  const records = runDirectories(batchDirectory)
    .filter((runDir) => existsSync(path.join(runDir, 'verify.json')))
    .map((runDir) => reconstructRecord(batchId, runDir, log));
  return { records, reconstructed: records.length > 0 };
}

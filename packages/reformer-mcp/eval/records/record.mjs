/**
 * Запись прогона (`reformer-mcp-run/1`) — один формат для всех стендов качества сервера.
 *
 * Сырьё и записи всегда ложатся в `.tmp/mcp-runs/<batchId>/`. В репозиторий попадают только батчи,
 * опубликованные явно (`--publish`): `packages/reformer-mcp/eval/runs/<год>/`. Отладочные прогоны
 * в истории не нужны, а опубликованные сравниваются `mcp:compare` и рисуются `mcp:report`.
 */

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateTokens, McpClient } from '../lib/client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const packageDirectory = path.resolve(here, '../..');
export const repoRoot = path.resolve(packageDirectory, '../..');
export const runsDirectory = path.join(repoRoot, '.tmp', 'mcp-runs');
export const publishedDirectory = path.join(packageDirectory, 'eval', 'runs');

export const RECORD_SCHEMA = 'reformer-mcp-run/1';
const schema = JSON.parse(readFileSync(path.join(here, 'schema.json'), 'utf8'));

/** Потолок записи: записи коммитятся, сырьё остаётся в `.tmp`. */
export const RECORD_SIZE_LIMITS = {
  scenario: 4000,
  builder: 4000,
  retrieval: 6000,
  calibration: 8000,
};

/** Идентификатор батча: время прогона плюс случайный хвост, чтобы два прогона не совпали. */
export function newBatchId(now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  return `${stamp}-${randomBytes(2).toString('hex')}`;
}

const sha256 = (hash) => hash.digest('hex').slice(0, 16);

function git(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 29 });
  return result.status === 0 ? result.stdout : '';
}

/**
 * Откуда прогон: коммит и незакоммиченные правки. `dirtyDigest` различает две разные грязные сборки
 * на одном коммите. Журнал beads меняется от каждой команды `bd` и к сборке отношения не имеет.
 */
export function collectSource() {
  const pathspec = ['--', '.', ':(exclude).beads'];
  const status = git(['status', '--porcelain', ...pathspec]);
  const dirty = status.trim().length > 0;
  return {
    gitSha: git(['rev-parse', '--short=8', 'HEAD']).trim() || 'unknown',
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'unknown',
    dirty,
    dirtyDigest: dirty
      ? sha256(
          createHash('sha256')
            .update(git(['diff', 'HEAD', ...pathspec]))
            .update(status)
        )
      : null,
  };
}

function hashFiles(hash, directory, accept) {
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory).sort()) {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) hashFiles(hash, file, accept);
    else if (accept(file)) hash.update(name).update(readFileSync(file));
  }
}

/** Отпечаток сборки сервера: JS рядом с запускаемым файлом. */
export function buildDigest(serverPath) {
  const hash = createHash('sha256');
  hashFiles(hash, path.dirname(serverPath), (file) => file.endsWith('.js'));
  return sha256(hash);
}

/** Отпечаток знания: то, что сервер отдаёт агентам из документации пакетов. */
export function knowledgeDigest() {
  const hash = createHash('sha256');
  const packages = path.join(repoRoot, 'packages');
  for (const name of readdirSync(packages).sort()) {
    const directory = path.join(packages, name);
    for (const file of ['llms.txt', 'llms-index.json']) {
      const target = path.join(directory, file);
      if (existsSync(target)) hash.update(readFileSync(target));
    }
    hashFiles(hash, path.join(directory, 'docs', 'llms'), () => true);
  }
  return sha256(hash);
}

/** Что сервер показывает клиенту и сколько это стоит: три отпечатка и цена подключения. */
export async function fingerprintServer(serverPath, channel = 'node') {
  const client = new McpClient(serverPath);
  try {
    const { serverInfo } = await client.initialize();
    const results = {};
    for (const method of [
      'tools/list',
      'prompts/list',
      'resources/list',
      'resources/templates/list',
    ]) {
      results[method] = (await client.request(method, {})).result ?? {};
    }
    const surface = JSON.stringify([
      results['tools/list'],
      results['prompts/list'],
      results['resources/templates/list'],
    ]);
    return {
      channel,
      version: serverInfo?.version ?? null,
      surfaceDigest: sha256(createHash('sha256').update(surface)),
      buildDigest: buildDigest(serverPath),
      knowledgeDigest: knowledgeDigest(),
      staticTokens: ['tools/list', 'resources/list', 'prompts/list']
        .map((method) => estimateTokens(JSON.stringify(results[method])))
        .reduce((sum, tokens) => sum + tokens, 0),
    };
  } finally {
    client.close();
  }
}

/** Собрать запись: общие поля стенда плюс то, что известно о конкретном прогоне. */
export function createRecord(fields) {
  const { batchId, harness, scenario, approach, agent, repeat } = fields;
  const slug = [
    batchId,
    scenario.id,
    scenario.target,
    approach.id,
    agent.model ?? agent.kind,
    `r${repeat?.index ?? 1}`,
  ]
    .filter(Boolean)
    .join('.')
    .replace(/[^\w.-]+/g, '-');
  return {
    schema: RECORD_SCHEMA,
    runId: fields.runId ?? slug,
    batchId,
    harness,
    startedAt: fields.startedAt,
    durationMs: Math.round(fields.durationMs ?? 0),
    source: fields.source,
    server: fields.server,
    agent,
    approach,
    scenario: { level: null, target: null, split: null, contractDigest: null, ...scenario },
    repeat: repeat ?? { index: 1, of: 1 },
    verdict: fields.verdict,
    exitReason: fields.exitReason ?? null,
    score: fields.score ?? null,
    gates: fields.gates ?? [],
    checks: fields.checks ?? {},
    metrics: fields.metrics ?? [],
    usage: fields.usage ?? null,
    toolSequence: fields.toolSequence ?? null,
    artifacts: fields.artifacts ?? null,
    host: fields.host ?? { os: process.platform, node: process.version },
  };
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object')
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

/** Подмножество JSON Schema, которым написана `schema.json`: без зависимости ради одного файла. */
function schemaProblems(value, node, at) {
  const problems = [];
  if (node.enum && !node.enum.includes(value)) {
    problems.push(`${at}: значение ${JSON.stringify(value)} вне списка`);
  }
  if (node.type && ![node.type].flat().some((type) => typeMatches(value, type))) {
    problems.push(`${at}: ожидался тип ${[node.type].flat().join('|')}`);
    return problems;
  }
  for (const key of node.required ?? []) {
    if (value?.[key] === undefined) problems.push(`${at}.${key}: нет обязательного поля`);
  }
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    if (value?.[key] !== undefined)
      problems.push(...schemaProblems(value[key], child, `${at}.${key}`));
  }
  if (node.items && Array.isArray(value)) {
    value.forEach((item, index) =>
      problems.push(...schemaProblems(item, node.items, `${at}[${index}]`))
    );
  }
  return problems;
}

/** Проблемы записи: несоответствие схеме и превышение потолка размера. Пусто — запись годна. */
export function validateRecord(record) {
  const problems = schemaProblems(record, schema, 'запись');
  for (const [id, check] of Object.entries(record.checks ?? {})) {
    const valid =
      typeof check === 'string' ||
      (Array.isArray(check) &&
        check.length === 2 &&
        check.every((part) => typeof part === 'string'));
    if (!valid)
      problems.push(`запись.checks.${id}: ожидалась строка статуса или [статус, причина]`);
  }
  const size = Buffer.byteLength(JSON.stringify(record));
  const limit = RECORD_SIZE_LIMITS[record.harness];
  if (limit && size > limit) problems.push(`запись: ${size} байт больше потолка ${limit}`);
  return problems;
}

/** Статус проверки и причина из значения `checks`. */
export const checkStatus = (check) => (Array.isArray(check) ? check[0] : check);
export const checkReason = (check) => (Array.isArray(check) ? check[1] : null);

/**
 * Дописать записи батча и, по `publish`, положить копию в репозиторий.
 *
 * @returns {{ local: string, published: string | null }}
 */
export function writeRecords(records, { batchId, harness, label, publish = false }) {
  for (const record of records) {
    const problems = validateRecord(record);
    if (problems.length > 0) {
      throw new Error(`Запись ${record.runId} не годится:\n  ${problems.join('\n  ')}`);
    }
  }
  const lines = records.map((record) => `${JSON.stringify(record)}\n`).join('');
  const directory = path.join(runsDirectory, batchId);
  mkdirSync(directory, { recursive: true });
  const local = path.join(directory, 'records.jsonl');
  appendFileSync(local, lines);
  if (!publish) return { local, published: null };

  const year = batchId.slice(0, 4);
  const yearDirectory = path.join(publishedDirectory, year);
  mkdirSync(yearDirectory, { recursive: true });
  const published = path.join(yearDirectory, `${batchId}-${harness}-${label}.jsonl`);
  writeFileSync(published, readFileSync(local));
  return { local, published };
}

/** Заменить записи в уже существующих файлах батча: новая оценка тех же прогонов. */
export function rewriteRecords(records, files) {
  for (const record of records) {
    const problems = validateRecord(record);
    if (problems.length > 0) {
      throw new Error(`Запись ${record.runId} не годится:\n  ${problems.join('\n  ')}`);
    }
  }
  const lines = records.map((record) => `${JSON.stringify(record)}\n`).join('');
  for (const file of files) writeFileSync(file, lines);
}

/** Записи из `.jsonl`; пустые строки пропускаются. */
export function readRecords(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

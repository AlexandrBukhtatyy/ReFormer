#!/usr/bin/env node
/**
 * Eval-харнесс @reformer/mcp.
 *
 * Отвечает на один вопрос: ОТДАЁТ ли сервер знание, нужное для задачи, за сколько вызовов
 * и токенов. Не «написала ли модель правильный код» — это зона клиента, недетерминированная
 * и непригодная для CI-гейта. Сервер контролирует именно извлечение, его и меряем.
 *
 * Метрики:
 *   static        — tools/list + resources/list + prompts/list: цена ПОДКЛЮЧЕНИЯ, до любой
 *                   полезной работы. Самая недооценённая статья: до Фазы 0 это 24 781 токен.
 *   hitRate       — доля задач, где нужное имя API вообще всплыло.
 *   firstPassRate — доля задач, где оно всплыло с ПЕРВОЙ, самой естественной формулировки.
 *                   Главный KPI: 1000 токенов × 1 запрос дешевле, чем 600 × 4.
 *   calls/tokens  — медиана и p95 на задачу.
 *
 * Запуск:
 *   npm run mcp:evaluate                      — прогон + сравнение с baseline
 *   npm run mcp:evaluate -- --save <file>     — записать результат как baseline
 *   npm run mcp:evaluate -- --strategy v6     — выбрать стратегию извлечения
 *   npm run mcp:evaluate -- --json <file>     — выгрузить полный отчёт (с трассами)
 *   npm run mcp:evaluate -- --server <path>   — померить другую сборку сервера
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { McpClient, estimateTokens } from './lib/client.mjs';
import { assertStrongExpectations } from './lib/match.mjs';
import { auditExpectations } from './lib/corpus-audit.mjs';

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(evalDir, '..');
const repoRoot = path.resolve(pkgDir, '../..');

// ---------------------------------------------------------------------------
// Аргументы
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

// По умолчанию меряем РЕКОМЕНДУЕМЫЙ путь агента. Стратегия `v6` осталась для A/B:
// она показывает, сколько давал сервер без decision-слоя.
const strategyName = flag('strategy', 'v6-choose');
const savePath = flag('save');
const jsonPath = flag('json');
const baselinePath = flag('baseline', path.join(repoRoot, 'docs', 'mcp-eval', 'baseline.json'));
const compare = !savePath && existsSync(baselinePath);
// `--server` позволяет померить ДРУГУЮ сборку сервера тем же корпусом и стратегией —
// так снимается baseline с прошлой ревизии, которая своего харнесса ещё не содержит.
const serverPath = path.resolve(flag('server', path.join(pkgDir, 'dist', 'index.js')));

if (!existsSync(serverPath)) {
  console.error(`✗ ${path.relative(repoRoot, serverPath)} не найден — сначала соберите пакет:`);
  console.error('  npm run build -w @reformer/mcp');
  process.exit(1);
}

// Сервер резолвит документацию относительно CWD — пинним корень репо, иначе результат
// зависит от места запуска (тот же приём, что в snapshot-prompts.mjs).
process.chdir(repoRoot);

// ---------------------------------------------------------------------------
// Корпус и стратегия
// ---------------------------------------------------------------------------

const corpusDir = path.join(evalDir, 'corpus');
const corpus = readdirSync(corpusDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .flatMap((f) => {
    const g = JSON.parse(readFileSync(path.join(corpusDir, f), 'utf8'));
    return g.tasks.map((t) => ({ ...t, category: t.category ?? g.category }));
  });

// Корпус — тоже измерительный прибор, и ломается он двумя способами.
// 1. Слишком ОБЩЕЕ ожидание («cross», «registry») удовлетворяется служебными списками
//    сервера и завышает метрику.
assertStrongExpectations(corpus);
// 2. Слишком КОНКРЕТНОЕ, но выдуманное — задача измеряет несуществующий API, и промах
//    сервера ошибочно засчитывается ему в пробелы (так `isValid`/`FormStatus` попали в
//    корпус: `isValid` совпадал как префикс реального `isValidating`).
{
  const docsParser = await import(
    pathToFileURL(path.join(pkgDir, 'dist', 'utils', 'docs-parser.js')).href
  );
  const symbols = await import(
    pathToFileURL(path.join(pkgDir, 'dist', 'index', 'symbols.js')).href
  );
  const problems = await auditExpectations(corpus, {
    packages: docsParser.KNOWN_PACKAGES,
    docsOf: (p) => docsParser.getFullDocs(p),
    hasSymbol: async (name) => (await symbols.findOneSymbol(name)) !== null,
  });
  if (problems.length > 0) {
    console.error(`✗ корпус проверяет несуществующий API (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

const strategy = await import(
  pathToFileURL(path.join(evalDir, 'strategies', `${strategyName}.mjs`)).href
);

// ---------------------------------------------------------------------------
// Прогон
// ---------------------------------------------------------------------------

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[i];
}

const client = new McpClient(serverPath);
let report;
try {
  const init = await client.initialize();

  // Статическая поверхность — то, за что клиент платит просто за подключение.
  const staticSurface = {};
  for (const method of ['tools/list', 'resources/list', 'prompts/list']) {
    const r = await client.request(method, {});
    staticSurface[method] = estimateTokens(JSON.stringify(r.result ?? {}));
  }
  staticSurface.total = Object.values(staticSurface).reduce((a, b) => a + b, 0);

  const results = [];
  for (const task of corpus) {
    const r = await strategy.run(client, task);
    const tokens = Math.round(r.chars / 4);
    results.push({
      id: task.id,
      category: task.category,
      hit: r.hit,
      firstPass: r.firstPass,
      calls: r.calls,
      tokens,
      ms: Math.round(r.ms),
      trace: r.trace,
    });
    process.stdout.write(
      `  ${r.firstPass ? '✓' : r.hit ? '~' : '✗'} ${task.id.padEnd(30)} ` +
        `${String(r.calls).padStart(2)} calls  ${String(tokens).padStart(6)} tok\n`
    );
  }

  const tokens = results.map((r) => r.tokens).sort((a, b) => a - b);
  const calls = results.map((r) => r.calls).sort((a, b) => a - b);
  const byCategory = {};
  for (const r of results) {
    const c = (byCategory[r.category] ??= { total: 0, hit: 0, firstPass: 0, tokens: 0 });
    c.total++;
    if (r.hit) c.hit++;
    if (r.firstPass) c.firstPass++;
    c.tokens += r.tokens;
  }

  report = {
    strategy: strategyName,
    serverVersion: init.serverInfo?.version ?? 'unknown',
    startupMs: Math.round(init.ms),
    tasks: results.length,
    static: staticSurface,
    hitRate: +(results.filter((r) => r.hit).length / results.length).toFixed(3),
    firstPassRate: +(results.filter((r) => r.firstPass).length / results.length).toFixed(3),
    tokensPerTask: {
      median: quantile(tokens, 0.5),
      p95: quantile(tokens, 0.95),
      total: tokens.reduce((a, b) => a + b, 0),
    },
    callsPerTask: { median: quantile(calls, 0.5), p95: quantile(calls, 0.95) },
    byCategory,
    misses: results.filter((r) => !r.hit).map((r) => r.id),
    results,
  };
} finally {
  client.close();
}

// ---------------------------------------------------------------------------
// Отчёт
// ---------------------------------------------------------------------------

const pct = (x) => `${(x * 100).toFixed(1)}%`;

console.log(
  `\n=== @reformer/mcp eval — стратегия ${report.strategy}, версия ${report.serverVersion} ===`
);
console.log(`  задач: ${report.tasks}   старт сервера: ${report.startupMs} ms`);
console.log(
  `  статическая поверхность: ${report.static.total} tok ` +
    `(tools ${report.static['tools/list']}, resources ${report.static['resources/list']}, prompts ${report.static['prompts/list']})`
);
console.log(`  hit rate:        ${pct(report.hitRate)}`);
console.log(`  first-pass rate: ${pct(report.firstPassRate)}   ← главный KPI`);
console.log(
  `  токенов/задача:  median ${report.tokensPerTask.median}, p95 ${report.tokensPerTask.p95}, всего ${report.tokensPerTask.total}`
);
console.log(
  `  вызовов/задача:  median ${report.callsPerTask.median}, p95 ${report.callsPerTask.p95}`
);
console.log('\n  по категориям:');
for (const [cat, c] of Object.entries(report.byCategory)) {
  console.log(
    `    ${cat.padEnd(12)} hit ${String(c.hit).padStart(2)}/${c.total}  ` +
      `first-pass ${String(c.firstPass).padStart(2)}/${c.total}  ${String(c.tokens).padStart(6)} tok`
  );
}
if (report.misses.length > 0) {
  console.log(`\n  не найдено (${report.misses.length}): ${report.misses.join(', ')}`);
}

if (jsonPath) {
  mkdirSync(path.dirname(path.resolve(jsonPath)), { recursive: true });
  writeFileSync(path.resolve(jsonPath), JSON.stringify(report, null, 2));
  console.log(`\n  полный отчёт → ${jsonPath}`);
}

if (savePath) {
  const target = path.resolve(savePath);
  mkdirSync(path.dirname(target), { recursive: true });
  // В baseline трассы не пишем: они большие и шумят в diff'ах PR.
  const { results, ...summary } = report;
  void results;
  writeFileSync(target, JSON.stringify(summary, null, 2) + '\n');
  console.log(`\n✓ baseline записан → ${path.relative(repoRoot, target)}`);
  process.exit(0);
}

if (!compare) {
  console.log(
    `\n  baseline не найден (${path.relative(repoRoot, baselinePath)}) — сравнение пропущено.`
  );
  console.log('  Записать текущий результат как baseline:');
  console.log('    npm run mcp:evaluate -- --save docs/mcp-eval/baseline.json');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Сравнение с baseline — гейт
// ---------------------------------------------------------------------------

const base = JSON.parse(readFileSync(baselinePath, 'utf8'));
const regressions = [];

function cmp(label, now, before, { higherIsBetter, tolerance = 0 }) {
  const delta = now - before;
  const worse = higherIsBetter ? delta < -tolerance : delta > tolerance;
  const arrow = delta === 0 ? '=' : delta > 0 ? '+' : '';
  console.log(
    `    ${label.padEnd(24)} ${String(before).padStart(8)} → ${String(now).padStart(8)}  ${arrow}${delta}${worse ? '  ✗ регресс' : ''}`
  );
  if (worse) regressions.push(`${label}: ${before} → ${now}`);
}

console.log(
  `\n=== сравнение с baseline (${path.relative(repoRoot, baselinePath)}, стратегия ${base.strategy}) ===`
);
cmp('static tokens', report.static.total, base.static.total, {
  higherIsBetter: false,
  tolerance: 200,
});
cmp('hit rate %', Math.round(report.hitRate * 1000), Math.round(base.hitRate * 1000), {
  higherIsBetter: true,
});
cmp(
  'first-pass %',
  Math.round(report.firstPassRate * 1000),
  Math.round(base.firstPassRate * 1000),
  { higherIsBetter: true }
);
cmp('tokens/task median', report.tokensPerTask.median, base.tokensPerTask.median, {
  higherIsBetter: false,
  tolerance: 50,
});
// Хвост и сумма — не роскошь, а главное, за чем тут следят. Медиана держится на 1k, пока
// отдельные задачи стоят 25-40k: агент проваливается в чтение секции `API Reference`
// целиком. Первая версия гейта сравнивала только медиану и пропустила рост p95 с 24 749 до
// 41 488 после того, как в llms.txt добавился ранее терявшийся DSL.
cmp('tokens/task p95', report.tokensPerTask.p95, base.tokensPerTask.p95, {
  higherIsBetter: false,
  tolerance: 500,
});
cmp('tokens total', report.tokensPerTask.total, base.tokensPerTask.total, {
  higherIsBetter: false,
  tolerance: 2000,
});
cmp('calls/task median', report.callsPerTask.median, base.callsPerTask.median, {
  higherIsBetter: false,
});

if (regressions.length > 0) {
  console.error(`\n✗ eval: ${regressions.length} регресс(ов) против baseline:`);
  for (const r of regressions) console.error(`  - ${r}`);
  console.error('\n  Если регресс осознанный — обновите baseline:');
  console.error('    npm run mcp:evaluate -- --save docs/mcp-eval/baseline.json');
  process.exit(1);
}
console.log('\n✓ eval: регрессов против baseline нет');

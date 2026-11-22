#!/usr/bin/env node
/**
 * Инфографика по коду @reformer/* одной командой.
 *
 * Пайплайн: структура пакетов (TypeScript AST) → реальные вызовы (type checker)
 * → модель диаграммы → .excalidraw.md → проверка читаемости линий.
 *
 *   npm run diagram                       # полный прогон, путь из REFORMER_DIAGRAM_OUT
 *   npm run diagram -- <путь.excalidraw.md>
 *   npm run diagram -- --skip-analyze     # только перерисовать из готовой модели
 *   npm run diagram -- --no-check         # без проверки линий
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_MODEL, DEFAULT_OUT, resolveOut } from './paths.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Инфографика по коду → Excalidraw.

  node scripts/diagrams/index.mjs [путь.excalidraw.md] [опции]

Опции:
  --skip-analyze   пропустить анализ кода, перерисовать из ${path.relative(process.cwd(), CODE_MODEL)}
  --no-check       не запускать проверку читаемости линий
  -h, --help       эта справка

Путь вывода: аргумент → $REFORMER_DIAGRAM_OUT → ${path.relative(process.cwd(), DEFAULT_OUT)}`);
  process.exit(0);
}

const skipAnalyze = argv.includes('--skip-analyze');
const noCheck = argv.includes('--no-check');
const OUT = resolveOut(argv.find((a) => !a.startsWith('-')));

/** Запускает шаг пайплайна; любой ненулевой код — остановка всей команды. */
function step(title, script, args = []) {
  console.log(`\n=== ${title} ===`);
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n✗ шаг «${title}» завершился с кодом ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

if (skipAnalyze) {
  if (!fs.existsSync(CODE_MODEL)) {
    console.error(`--skip-analyze, но модели нет: ${CODE_MODEL}\nзапустите команду без флага.`);
    process.exit(1);
  }
  console.log(`модель переиспользуется: ${CODE_MODEL}`);
} else {
  step('1/3 структура пакетов (TypeScript AST)', 'extract-code.mjs');
  step('2/3 вызовы методов и функций (type checker)', 'extract-calls.mjs');
  step('3/3 модель диаграммы', 'prepare-model.mjs');
}

step('отрисовка Excalidraw', 'gen-excalidraw.mjs', [OUT]);
if (!noCheck) step('проверка читаемости линий', 'check-lines.mjs', [OUT]);

console.log(`\n✓ готово: ${OUT}`);

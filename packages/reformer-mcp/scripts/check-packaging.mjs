#!/usr/bin/env node
// Guard: под `npx @reformer/mcp` (пакет не является зависимостью проекта) сервер
// обязан находить свою документацию и рецепты. Проверяет то, что молча ломалось у
// потребителя, но зеленело в монорепо:
//   1. reformer://guide — свой llms.txt (был не в `files` → "documentation not found");
//   2. find_recipe по файловым рецептам — docs/llms сиблингов (были не в `files`).
//
// Ключевая тонкость (как в ui-kit check-subpaths): проверять надо ВНЕ монорепо.
// Node резолвит модули, поднимаясь по дереву каталогов, поэтому из любой папки
// внутри репозитория недостающие файлы «находятся» и проверка ложно зеленеет.
// Поэтому: npm pack → чистый проект в os.tmpdir() → npm install тарболов → probe
// запускается В песочнице, где путь к mcp такой же, как у потребителя.
//
// Сиблинги (core/cdk) ставятся локальными тарболами — проверяем текущий код, а не
// последний релиз в npm. cdk нужен ради рецепта form-field (он живёт в @reformer/cdk).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgDir, '../..');
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

/** Сиблинги, которые паковать локально вместо установки из npm. */
const LOCAL_SIBLINGS = {
  '@reformer/core': path.join(repoRoot, 'packages/reformer'),
  '@reformer/cdk': path.join(repoRoot, 'packages/reformer-cdk'),
};

// npm через его JS-entry (npm_execpath), иначе на Windows execFile не спавнит npm.cmd
// без shell, а shell ломается о пробелы в путях (тот же приём, что в check-subpaths).
const npmExecpath = process.env.npm_execpath;
const viaNode = Boolean(npmExecpath?.endsWith('.js'));
const onWindows = process.platform === 'win32';

// Конфиг монорепо не должен протекать в песочницу (корневой .npmrc с
// legacy-peer-deps отключил бы автоустановку peer'ов) — моделируем дефолтный npm.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('npm_config_'))
);

const run = (args, cwd) => {
  const [file, argv] = viaNode
    ? [process.execPath, [npmExecpath, ...args]]
    : [onWindows ? 'npm.cmd' : 'npm', onWindows ? args.map((a) => JSON.stringify(a)) : args];
  return execFileSync(file, argv, {
    cwd,
    env: cleanEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: !viaNode && onWindows,
  });
};

/** `npm pack` → абсолютный путь к тарболу. */
function pack(dir, dest) {
  const out = run(['pack', '--pack-destination', dest, '--loglevel=error'], dir);
  const name = out.trim().split('\n').pop().trim();
  return path.join(dest, name);
}

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'reformer-mcp-packaging-'));
const tarballs = path.join(sandbox, 'tarballs');
const consumer = path.join(sandbox, 'consumer');
mkdirSync(tarballs);
mkdirSync(consumer);

let failed = false;
try {
  console.log(`  песочница: ${sandbox}`);

  const dependencies = { [pkg.name]: `file:${pack(pkgDir, tarballs)}` };
  for (const [name, dir] of Object.entries(LOCAL_SIBLINGS)) {
    dependencies[name] = `file:${pack(dir, tarballs)}`;
  }

  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'mcp-packaging-smoke',
        version: '1.0.0',
        private: true,
        type: 'module',
        dependencies,
      },
      null,
      2
    )
  );

  console.log(`  npm install: ${Object.keys(dependencies).length} пакет(ов)…`);
  run(['install', '--no-audit', '--no-fund', '--loglevel=error'], consumer);

  // Probe запускается В песочнице: только там mcp резолвится как у потребителя
  // (createRequire от установленного пакета), и docs/llms сиблингов лежат в
  // node_modules, а не в исходниках монорепо.
  const runner = `
import { getFullDocs } from '@reformer/mcp/dist/utils/docs-parser.js';
import { findRecipeTool } from '@reformer/mcp/dist/tools/find-recipe.js';

const failures = [];

// 1. reformer://guide — собственный llms.txt пакета mcp.
const guide = getFullDocs('@reformer/mcp');
if (guide.startsWith('@reformer/mcp documentation not found') || guide.length < 500) {
  failures.push('reformer://guide пуст/не найден (llms.txt не в files пакета mcp?)');
}

// 2/3. Файловые рецепты. Проверяем, что ответ пришёл ИМЕННО из файла docs/llms
// (Source содержит "docs/llms/"), а не из секции llms.txt: секционный fallback
// доступен и без docs/llms, поэтому "не No recipe found" сам по себе публикацию
// docs/llms не гарантирует. Файловый ответ — единственный сигнал, что каталог
// реально попал в тарбол.
// \\/ в этом template literal → \/ в записанном smoke.mjs (иначе \/ схлопнется в /
// и регекс станет битым /docs/llms//).
const fileSourced = (text) => /docs\\/llms\\//.test(text) && !/matched by section heading/.test(text);

// core — docs/llms/@reformer/core.
const ps = (await findRecipeTool({ topic: 'project-structure' })).content[0].text;
if (!fileSourced(ps)) {
  failures.push('find_recipe("project-structure") не из файла docs/llms (не в files @reformer/core?)');
}

// cdk — docs/llms/@reformer/cdk.
const ff = (await findRecipeTool({ topic: 'form-field' })).content[0].text;
if (!fileSourced(ff)) {
  failures.push('find_recipe("form-field") не из файла docs/llms (не в files @reformer/cdk?)');
}

console.log(JSON.stringify({ failures }));
`;
  writeFileSync(path.join(consumer, 'smoke.mjs'), runner);

  // Системный node напрямую (cwd = consumer): Node резолвит @reformer/mcp из
  // consumer/node_modules. НЕ через `npm exec node` — тот ищет пакет по имени `node`
  // и скачивает node-дистрибутив с npm (медленно, хрупко в CI/офлайн).
  const out = execFileSync(process.execPath, ['smoke.mjs'], {
    cwd: consumer,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const line = out.trim().split('\n').pop();
  const { failures } = JSON.parse(line);

  if (failures.length > 0) {
    console.error(`✗ @reformer/mcp packaging: ${failures.length} проблем(ы):`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      '\n  Обычно причина — файлы выпали из поля "files" пакета: llms.txt (mcp) или\n' +
        '  docs/llms (core/cdk/…). Проверь package.json.files и `npm pack --dry-run`.'
    );
    failed = true;
  } else {
    console.log(
      '✓ @reformer/mcp: guide и файловые рецепты (project-structure, form-field) доступны у потребителя'
    );
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);

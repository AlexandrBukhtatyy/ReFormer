#!/usr/bin/env node
// Guard: React-контекст локализации существует в одном экземпляре на все пакеты @reformer/*.
//
// Зачем: `I18nProvider` приложения и хуки cdk / ui-kit / рендереров работают вместе только пока
// импортируют ОДИН И ТОТ ЖЕ объект контекста — из dist ядра. Если подпуть `@reformer/core/i18n`
// попадёт в сборку другого пакета (не вынесен во внешние зависимости), в ней появится своя копия
// контекста: компоненты этого пакета перестанут видеть провайдер и молча заговорят встроенным
// английским. Тесты этого не ловят — vitest резолвит один экземпляр модуля; ломается только
// собранный артефакт.
//
// Как проверяет: у контекста есть маркер — его displayName (`I18N_CONTEXT_MARKER` в
// packages/reformer/src/platforms/react/i18n/context.ts). Скрипт ищет эту строку во всех
// packages/*/dist: она обязана встретиться ровно в одном файле, и этот файл — в dist ядра.
//
// Использование (после сборки пакетов):
//   node scripts/check-i18n-singleton.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'ReformerI18nContext';
const CORE = 'reformer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Все каталоги dist пакетов, включая вложенные группы (packages/ui-kits/*). */
function distDirs(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (existsSync(path.join(full, 'package.json'))) {
      const dist = path.join(full, 'dist');
      if (existsSync(dist))
        out.push({ name: path.relative(path.join(repoRoot, 'packages'), full), dist });
    } else {
      distDirs(full, out);
    }
  }
  return out;
}

function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (/\.(m?js|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

const packages = distDirs(path.join(repoRoot, 'packages'));
const core = packages.find((pkg) => pkg.name === CORE);
if (core === undefined) {
  console.error(`✗ dist ядра не найден (packages/${CORE}/dist) — сначала соберите @reformer/core`);
  process.exit(1);
}

const hits = [];
for (const pkg of packages) {
  for (const file of jsFiles(pkg.dist)) {
    if (readFileSync(file, 'utf8').includes(MARKER)) hits.push({ pkg: pkg.name, file });
  }
}

const rel = (file) => path.relative(repoRoot, file).split(path.sep).join('/');
const inCore = hits.filter((hit) => hit.pkg === CORE);
const foreign = hits.filter((hit) => hit.pkg !== CORE);

let failed = false;
if (inCore.length !== 1) {
  failed = true;
  console.error(
    `✗ контекст локализации в dist ядра: ожидался ровно один файл, найдено ${inCore.length}` +
      (inCore.length > 0 ? `\n${inCore.map((hit) => `    ${rel(hit.file)}`).join('\n')}` : '')
  );
}
if (foreign.length > 0) {
  failed = true;
  console.error(
    '✗ копия контекста локализации в чужой сборке — `@reformer/core/i18n` не вынесен во внешние ' +
      'зависимости (в vite.config.ts пакета нужно правило /^@reformer\\//):\n' +
      foreign.map((hit) => `    ${rel(hit.file)}`).join('\n')
  );
}
if (failed) process.exit(1);

console.log(
  `✓ контекст локализации один: ${rel(inCore[0].file)} (проверено dist пакетов: ${packages.length})`
);

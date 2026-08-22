#!/usr/bin/env node
// Guard: КАЖДЫЙ зарегистрированный промпт @reformer/mcp обязан отрендериться.
//
// Зачем: `start-here` — задокументированная точка входа сервера («START HERE… Call this
// first») — возвращала клиенту JSON-RPC -32603 «"fieldWrapper:" not defined». Причина:
// в шаблоне лежит JSX `settings={{ fieldWrapper: FormField }}`, а Handlebars в strict-режиме
// читает `{{ fieldWrapper: FormField }}` как выражение. То же было в `to-renderer`.
//
// Почему это не поймали: единственное, что рендерило промпты, — `snapshot-prompts.mjs` с
// РУЧНЫМ списком кейсов, где `start-here` просто отсутствовал, и он не запускался в CI.
// Поэтому здесь список НЕ ручной: промпты берутся из барреля `dist/prompts/index.js` по
// паре `<x>PromptDefinition` + `get<X>Prompt`, аргументы — из самого определения. Новый
// промпт попадает под проверку автоматически, забыть его нельзя.
//
// Плюс отдельная фаза: статический скан ВСЕХ шаблонов на неэкранированные mustache —
// ловит шаблон, ещё не подключённый к промпту, и даёт внятное сообщение вместо
// handlebars-ошибки на рантайме.
//
// Использование: node scripts/check-mcp-render.mjs

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(repoRoot, 'packages', 'reformer-mcp');
const distEntry = path.join(pkgDir, 'dist', 'prompts', 'index.js');
const templatesDir = path.join(pkgDir, 'src', 'prompts', 'templates');

if (!existsSync(distEntry)) {
  console.error(`✗ ${path.relative(repoRoot, distEntry)} не найден — сначала соберите пакет:`);
  console.error('  npm run build -w @reformer/mcp');
  process.exit(1);
}

// Промпты читают спеки и детектят стек относительно CWD — пинним, чтобы результат не зависел
// от места запуска (тот же приём, что в snapshot-prompts.mjs).
process.chdir(repoRoot);

/** Значения для аргументов промптов. Ключ — имя аргумента из его же определения. */
const ARG_FIXTURES = {
  code: '// RENDER_CHECK\nconst form = createForm({ name: { value: "" } });',
  requirements: 'RENDER_CHECK: rule A; rule B.',
  description: 'RENDER_CHECK: form with name(string), age(number 18+).',
  steps: 'RENDER_CHECK: 1=personal; 2=address; 3=review.',
  specPath: 'docs/specs/credit-application-form.md',
  target: 'core',
  projectPath: repoRoot,
  // Промпты с выбором стадии/цели: без валидного значения они уходят в свою ветку ошибки,
  // и проверка «отрендерилось» становится бессмысленной.
  feature: 'validation',
};

const failures = [];

// ---------------------------------------------------------------------------
// Фаза 1 — статический скан шаблонов (та же классификация, что в prompt-template-loader.ts)
// ---------------------------------------------------------------------------

const RAW_BLOCK_RE = /\{\{\{\{raw\}\}\}\}[\s\S]*?\{\{\{\{\/raw\}\}\}\}/g;
const MUSTACHE_RE = /(\\?)\{\{\{?([^{}]*?)\}?\}\}/g;
const PATH_RE = /^[\w.$]+$/;

for (const file of readdirSync(templatesDir).filter((f) => f.endsWith('.md'))) {
  const src = readFileSync(path.join(templatesDir, file), 'utf8').replace(RAW_BLOCK_RE, '');
  let m;
  MUSTACHE_RE.lastIndex = 0;
  while ((m = MUSTACHE_RE.exec(src)) !== null) {
    const escaped = m[1] !== '';
    const inner = m[2].trim();
    if (escaped || !inner) continue;
    if (/^[#/^!>]/.test(inner)) continue;
    if (PATH_RE.test(inner)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    failures.push(
      `${file}:${line} — неэкранированный {{${inner}}}: Handlebars разберёт это как выражение. ` +
        'Экранируйте открывающую скобку как \\{{ либо оберните блок в {{{{raw}}}} … {{{{/raw}}}}.'
    );
  }
}

// ---------------------------------------------------------------------------
// Фаза 2 — реальный рендер каждого зарегистрированного промпта
// ---------------------------------------------------------------------------

const mod = await import(pathToFileURL(distEntry).href);

/** `startHerePromptDefinition` → `getStartHerePrompt`. */
function getterNameFor(defExport) {
  const stem = defExport.replace(/PromptDefinition$/, '');
  return 'get' + stem.charAt(0).toUpperCase() + stem.slice(1) + 'Prompt';
}

const definitionExports = Object.keys(mod).filter((k) => k.endsWith('PromptDefinition'));
if (definitionExports.length === 0) {
  console.error('✗ в dist/prompts/index.js нет ни одного *PromptDefinition — баррель изменился?');
  process.exit(1);
}

let rendered = 0;
for (const defExport of definitionExports) {
  const def = mod[defExport];
  const getterName = getterNameFor(defExport);
  const getter = mod[getterName];

  if (typeof getter !== 'function') {
    failures.push(`${def?.name ?? defExport}: не найден геттер ${getterName} в барреле промптов`);
    continue;
  }

  // Аргументы — ровно те, что промпт объявил о себе сам.
  const args = {};
  for (const a of def?.arguments ?? []) {
    args[a.name] = ARG_FIXTURES[a.name] ?? `RENDER_CHECK_${a.name}`;
  }

  try {
    // `server` не передаём: sampling-ветки должны деградировать, а не падать.
    const result = await getter(args);
    const text = result?.messages?.[0]?.content?.text;
    if (typeof text !== 'string' || text.length === 0) {
      failures.push(`${def.name}: вернул пустой/не-строковый текст`);
      continue;
    }
    // Ветка ошибки — не рендер. Без этой проверки гейт зеленел на `add-feature`, который
    // с фикстурой-заглушкой отвечал «неизвестная стадия» на 129 символов: формально строка
    // непустая, фактически шаблон не отрисовался ни разу.
    if (text.startsWith('❌')) {
      failures.push(
        `${def.name}: вернул сообщение об ошибке вместо шаблона — ${text.split('\n')[0].slice(0, 90)}`
      );
      continue;
    }
    if (text.length < 400) {
      failures.push(
        `${def.name}: подозрительно короткий рендер (${text.length} символов) — вероятно, ветка ошибки`
      );
      continue;
    }
    rendered++;
    console.log(`  ✓ ${def.name.padEnd(18)} ${String(text.length).padStart(6)} chars`);
  } catch (err) {
    failures.push(`${def.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failures.length > 0) {
  console.error(`\n✗ @reformer/mcp render: ${failures.length} проблем(ы):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `\n✓ @reformer/mcp: ${rendered} промпт(ов) рендерятся, шаблоны без неэкранированных {{…}}`
);

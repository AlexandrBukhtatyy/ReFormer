#!/usr/bin/env node
// Guard: ни один промпт @reformer/mcp не должен УЧИТЬ API, снятому из core.
//
// Зачем: промпт `start-here` (точка входа, «use this MCP server as your only source of
// truth») велел вызывать `validateFormModel(model, schema)` и писать `validators: [...]`
// на листе схемы — оба контракта удалены. Опаснее обычной опечатки: поле `validators`
// осталось в типах, поэтому такой код КОМПИЛИРУЕТСЯ — tsc и ESLint чисты, форма рисуется
// и молча отправляет пустые обязательные поля. Инструментального сигнала нет ни одного.
// Сервер при этом противоречил сам себе: `get_symbol_docs('validateFormModel')` отвечал
// «not found», пока `start-here` учил её звать.
//
// Что проверяем: упоминание снятого API допустимо ТОЛЬКО в отрицательном контексте
// («removed», «obsolete», «never emit», «❌» …) — так написаны эталонные `add-validation.md`
// и `create-form.md`. Контекст берём БЛОКОМ (абзац / код-фенс, разделитель — пустая
// строка), а не строкой: в живых файлах отрицание регулярно стоит на соседней строке
// (`start-here.md` 20-21, `add-wizard.md` 136-138) — построчная проверка дала бы ложные
// срабатывания.
//
// Использование: node scripts/check-mcp-prompts.mjs

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(repoRoot, 'packages', 'reformer-mcp', 'src', 'prompts', 'templates');

/** Снятое из core API. Ключ — человекочитаемое имя для отчёта. */
const REMOVED_API = [
  { name: 'validateFormModel', re: /validateFormModel/ },
  { name: 'ModelValidator', re: /ModelValidator/ },
  { name: 'leaf `validators: [...]`', re: /validators:\s*\[/ },
];

/**
 * Маркеры отрицательного контекста. Достаточно одного в блоке.
 * Список намеренно явный: если появится новая формулировка отрицания — её сюда дописать,
 * это дешевле, чем угадывать тональность прозы эвристикой.
 */
const NEGATIVE_MARKERS = [
  'removed',
  'obsolete',
  'legacy',
  'deprecated',
  'no longer',
  'never emit',
  'do not emit',
  'do not use',
  'old shape',
  'the old',
  '❌',
  'not `validateformmodel`',
  'no `validateformmodel`',
  'no leaf',
  'no validators',
  'carries no',
  'has no',
];

/** Разбить текст на блоки (абзац/код-фенс) с номером стартовой строки. */
function toBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let current = null;
  let inFence = false;

  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    // Пустая строка вне код-фенса закрывает блок; внутри фенса — часть блока.
    if (!inFence && line.trim() === '') {
      current = null;
      return;
    }
    if (current === null) {
      current = { startLine: i + 1, lines: [] };
      blocks.push(current);
    }
    current.lines.push(line);
  });

  return blocks.map((b) => ({ startLine: b.startLine, text: b.lines.join('\n') }));
}

function hasNegativeMarker(text) {
  const lower = text.toLowerCase();
  return NEGATIVE_MARKERS.some((m) => lower.includes(m));
}

if (!existsSync(templatesDir)) {
  console.error(`✗ Каталог шаблонов не найден: ${path.relative(repoRoot, templatesDir)}`);
  process.exit(1);
}

const files = readdirSync(templatesDir)
  .filter((f) => f.endsWith('.md'))
  .sort();

const violations = [];
let checkedBlocks = 0;

for (const file of files) {
  const full = path.join(templatesDir, file);
  const content = readFileSync(full, 'utf8');

  for (const block of toBlocks(content)) {
    const hits = REMOVED_API.filter((api) => api.re.test(block.text));
    if (hits.length === 0) continue;
    checkedBlocks += 1;
    if (hasNegativeMarker(block.text)) continue;

    violations.push({
      file,
      line: block.startLine,
      api: hits.map((h) => h.name).join(', '),
      excerpt: block.text.split('\n').slice(0, 3).join('\n'),
    });
  }
}

if (violations.length > 0) {
  console.error(`✗ Промпты учат снятому API (${violations.length}):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.api}`);
    console.error(
      v.excerpt
        .split('\n')
        .map((l) => `    │ ${l}`)
        .join('\n')
    );
    console.error('');
  }
  console.error(
    '  Снятое API можно упоминать ТОЛЬКО как «так больше нельзя»: добавьте в этот же блок\n' +
      '  маркер отрицания (removed / obsolete / never emit / ❌ …) — как в add-validation.md\n' +
      '  и create-form.md — либо перепишите блок на живой контракт:\n' +
      '  defineValidationSchema + validate(sig, [rules]) + validateModel(model, schema).'
  );
  process.exit(1);
}

console.log(
  `✓ @reformer/mcp промпты: ${files.length} шаблон(ов), ` +
    `${checkedBlocks} блок(ов) со снятым API — все в отрицательном контексте`
);

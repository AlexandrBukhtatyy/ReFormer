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
 * Устаревшая РУЧНАЯ сборка формы. Само API живо (фабрики зовут его внутри), поэтому ловим не
 * упоминание символа, а связку: «создаём модель И тут же строим форму», «конвертируем JSON И
 * строим форму», а также снятые формы монтажа рендерера. Именно так промпты и разъезжались с
 * пакетами: `createJsonForm` появился, а боилерплейт в `create-form.md`/`add-wizard.md` ещё
 * полгода учил `convertJsonToM1Tree` + `<JsonFormRenderer schema=…>` — гейт этого не видел,
 * потому что проверял только снятые символы валидации.
 */
const LEGACY_ASSEMBLY = [
  {
    name: 'ручная связка createModel + createForm',
    test: (t) => /createModel\s*[<(]/.test(t) && /\bcreateForm\s*[<(]/.test(t),
  },
  {
    name: 'ручная связка convertJsonToM1Tree + createForm',
    test: (t) => /convertJsonToM1Tree/.test(t) && /\bcreateForm\s*[<(]/.test(t),
  },
  {
    name: 'сборка формы в useMemo',
    test: (t) =>
      /useMemo\s*\(/.test(t) &&
      /\bcreateForm\s*[<(]|createJsonForm|createReactForm|createCoreForm/.test(t),
  },
  {
    name: '<JsonFormRenderer schema={…}> вместо бандла form={…}',
    test: (t) => /JsonFormRenderer[^]*?\sschema=\{/.test(t),
  },
  {
    name: 'settings={{ registry, model }} у JsonRendererProvider',
    test: (t) => /settings=\{\{[^}]*\bmodel\b/.test(t),
  },
  {
    name: 'снятый проп validate={…} у JsonFormRenderer (теперь validateSchema)',
    test: (t) => /JsonFormRenderer[^]*?\svalidate=\{/.test(t),
  },
];

/**
 * Промпты, обязанные учить сборке через фабрику: если файл вообще говорит про создание формы,
 * он должен назвать актуальную точку входа. Без этого «тихий разъезд» вернётся с другой стороны —
 * промпт просто перестанет упоминать сборку, и проверка выше ничего не найдёт.
 */
const MUST_MENTION_FACTORY = [
  'create-form.md',
  'start-here.md',
  'to-renderer.md',
  'to-renderer-json.md',
  'add-wizard.md',
];
const FACTORY_RE = /createCoreForm|createReactForm|createJsonForm/;

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
    const hits = [
      ...REMOVED_API.filter((api) => api.re.test(block.text)),
      ...LEGACY_ASSEMBLY.filter((api) => api.test(block.text)),
    ];
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

  // Обратная проверка: файл про сборку обязан назвать фабрику.
  if (MUST_MENTION_FACTORY.includes(file) && !FACTORY_RE.test(content)) {
    violations.push({
      file,
      line: 1,
      api: 'не упомянута ни одна фабрика сборки (createCoreForm / createReactForm / createJsonForm)',
      excerpt: content.split('\n').slice(0, 3).join('\n'),
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

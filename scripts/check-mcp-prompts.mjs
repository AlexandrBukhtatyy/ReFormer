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
 * Presentational-примитив в позиции поля формы.
 *
 * У ui-kit две линейки: `*Field` — value-based (`value` + `onChange(value)`), примитивы —
 * shadcn/Radix-контролы с нативным `onChange(event)`. В форме примитив пишет в модель объект
 * события, `Checkbox` игнорирует `value`, `RadioGroup` рендерится пустым. Ни tsc, ни
 * `validate_form` этого не видят — поле выглядит рабочим, расходится только модель.
 *
 * Миграция v7 разъезжалась ДВАЖДЫ: сначала корпус `docs/llms` отстал от кода, потом починили
 * только сторону renderer-json. Оба раза не заметили, потому что сигнала не было ни одного.
 * Отсюда гейт: `component:` в примере обязан называть field-версию.
 *
 * Имена — из `packages/reformer-ui-kit/component-catalog.json` (role: 'field'); отрицательный
 * контекст («не ставьте», «❌», «анти-паттерн») по общему правилу пропускается, поэтому
 * разделы, объясняющие саму разницу линеек, гейт не трогает.
 */
const PRESENTATIONAL_AS_FIELD = [
  {
    name: 'примитив ui-kit в `component:` вместо *Field-версии',
    re: /component:\s*(Input|InputMask|InputPassword|InputOTP|Textarea|Select|NativeSelect|Checkbox|Switch|RadioGroup|Slider|Calendar|DatePicker|Combobox|Toggle|ToggleGroup)(?![A-Za-z])/,
  },
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
  // Явный скоуп: пример показывает УЗЛОВОЙ конфиг (`new FieldNode({...})`), а не layout-схему M1,
  // где `validators` уже нет. Маркер дописан осознанно — так эти примеры остаются легальными.
  'node-level',
  // Русскоязычные отрицания. Понадобились, когда корпус расширился с англоязычных промптов на
  // docs/llms и JSDoc: там «так больше нельзя» пишут по-русски, и без этих маркеров гейт валил
  // ровно те файлы, которые и объясняют, что API снято (17-nonexistent-api, 14-extended-mistakes).
  'удал', // удалён / удалено / удалены / удалённого
  'снят', // снятый / снято / снята
  'больше нельзя',
  'не существует',
  'устарел',
  'wrong',
  'а не `modelvalidator',
  'ts2353', // ошибка компиляции — контекст заведомо отрицательный
  'нет поля',
  'поля `validators` нет',
  'старая схема',
  'ловушк',
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

// --- Второй корпус: то, что сервер отдаёт помимо промптов --------------------------------
//
// Зачем. Гейт годами смотрел только в шаблоны промптов, а `get_symbol_docs` отдаёт JSDoc из
// пакетов, `find_recipe` — файлы docs/llms. Замерено прогоном формы через MCP-only: 28 из 30
// фабрик валидаторов учили снятому `validators: [...]` внутри FieldConfig — ровно тому, что
// `05-common-mistakes.md` называет удалённым. Описание символа и его же пример противоречили
// друг другу, и агент верил примеру.
//
// Проверяем ТОЛЬКО снятое API (REMOVED_API): LEGACY_ASSEMBLY и «обязан назвать фабрику» —
// требования к промптам, для библиотечного кода они бессмысленны. В .ts смотрим ИСКЛЮЧИТЕЛЬНО
// JSDoc-блоки: реализация вправе читать `config.validators`, это живое node-level поле.
const DOC_CORPUS_ROOTS = ['packages'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.turbo']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) || /docs[/\\]llms[/\\].+\.md$/.test(full))
      out.push(full);
  }
  return out;
}

/** JSDoc-блоки файла как текст — только они попадают агенту через get_symbol_docs. */
function jsdocBlocks(content) {
  const out = [];
  const re = /\/\*\*[\s\S]*?\*\//g;
  let m;
  while ((m = re.exec(content)) !== null) {
    out.push({ startLine: content.slice(0, m.index).split('\n').length, text: m[0] });
  }
  return out;
}

let corpusFiles = 0;
for (const root of DOC_CORPUS_ROOTS) {
  const abs = path.join(repoRoot, root);
  if (!existsSync(abs)) continue;
  for (const full of walk(abs)) {
    const rel = path.relative(repoRoot, full).replace(/\\/g, '/');
    // Шаблоны промптов уже проверены выше — своим, более строгим набором правил.
    if (rel.includes('reformer-mcp/src/prompts/templates/')) continue;
    if (/\.(test|spec)\.tsx?$/.test(rel)) continue;

    const content = readFileSync(full, 'utf8');
    const blocks = rel.endsWith('.md') ? toBlocks(content) : jsdocBlocks(content);

    for (const block of blocks) {
      const hits = [
        ...REMOVED_API.filter((api) => api.re.test(block.text)),
        ...PRESENTATIONAL_AS_FIELD.filter((api) => api.re.test(block.text)),
      ];
      if (hits.length === 0) continue;
      checkedBlocks += 1;
      if (hasNegativeMarker(block.text)) continue;
      violations.push({
        file: rel,
        line: block.startLine,
        api: hits.map((h) => h.name).join(', '),
        excerpt: block.text.split('\n').slice(0, 3).join('\n'),
      });
    }
    corpusFiles += 1;
  }
}

if (violations.length > 0) {
  console.error(`✗ Материал MCP учит снятому API (${violations.length}):\n`);
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
  `✓ материал MCP: ${files.length} шаблон(ов) промптов + ${corpusFiles} файл(ов) JSDoc/docs-llms, ` +
    `${checkedBlocks} блок(ов) со снятым API — все в отрицательном контексте`
);

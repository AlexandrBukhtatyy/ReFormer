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
 * Не тот компонент в позиции поля формы.
 *
 * Field-версий (`*Field`, `withFormControl`) в ui-kit больше нет: в `component:` кладётся сам
 * компонент, а его диалект (`checked`/`onCheckedChange`, событие, …) обёртка поля берёт из статики
 * `reformerAdapter`. Ошибкой остаются (а) удалённые `*Field`-имена и (б) корни compound-компонентов,
 * которые без детей ничего не рисуют: `Select` (форме нужен `SelectAsync`), `RadioGroup` /
 * `ToggleGroup` / `NativeSelect` (нужны варианты `*Options` / `NativeSelectWithOptions`),
 * `Calendar` (нужен `CalendarSingle`), `InputOTP` (нужен `InputOTPDefault`). Ни tsc, ни
 * `validate_form` этого не видят — поле выглядит рабочим, расходится только модель.
 *
 * Отрицательный контекст («не ставьте», «❌», «анти-паттерн») по общему правилу пропускается.
 */
const PRESENTATIONAL_AS_FIELD = [
  {
    name: 'удалённая *Field-версия ui-kit в `component:`',
    re: /component:\s*(?!Form)[A-Z]\w*Field(?![A-Za-z])/,
  },
  {
    name: 'корень compound-компонента в `component:` вместо варианта для формы',
    re: /component:\s*(Select|RadioGroup|ToggleGroup|NativeSelect|Calendar|InputOTP)(?![A-Za-z])/,
  },
];

/**
 * Прежний контракт формы. Единый контракт — одна схема-дерево с ключом `model`, одно поведение
 * `({ model, form, schema })`, одна сборка `createForm`; всё, что перечислено ниже, промпт вправе
 * упоминать ТОЛЬКО как «так больше не пишут».
 *
 * Ловим не только символы, но и связки. Именно так промпты разъезжались с пакетами:
 * `createJsonForm` появился, а боилерплейт в `create-form.md`/`add-wizard.md` ещё полгода учил
 * `convertJsonToM1Tree` + `<JsonFormRenderer schema=…>` — гейт этого не видел, потому что
 * проверял только снятые символы валидации.
 */
/** Низкоуровневая фабрика «форма из готовой модели» — не сборка формы. */
const LOW_LEVEL_FORM_RE = /\bcreateFormFromModel\s*[<(]/;
/** Любая фабрика формы: единая сборка, низкоуровневая и три прежние. */
const ANY_FORM_FACTORY_RE =
  /\bcreateForm(FromModel)?\s*[<(]|createJsonForm|createReactForm|createCoreForm/;

const LEGACY_ASSEMBLY = [
  {
    name: 'прежняя фабрика сборки (createCoreForm / createReactForm / createJsonForm) вместо createForm',
    test: (t) => /\b(createCoreForm|createReactForm|createJsonForm)\b/.test(t),
  },
  {
    name: 'прежний хук сборки (useReactForm / useJsonForm) вместо useFormBundle',
    test: (t) => /\b(useReactForm|useJsonForm)\b/.test(t),
  },
  {
    name: 'прежний рендерер JSON (JsonFormRenderer / JsonRendererProvider) вместо FormRenderer',
    test: (t) => /\b(JsonFormRenderer|JsonRendererProvider)\b/.test(t),
  },
  {
    name: 'второе поведение (renderBehavior / form.render.ts) вместо единого form.behavior.ts',
    test: (t) => /\brenderBehavior\b|RenderBehaviorFn|form\.render\.ts/.test(t),
  },
  {
    name: 'прежний ключ узла (value: / array:) вместо model:',
    test: (t) =>
      /\bvalue:\s*['"]?(\$model\(|\w+\.\$\.)/.test(t) ||
      /"value":\s*"\$model\(/.test(t) ||
      /\barray:\s*['"]?(\$model\(|\w+\.\w)/.test(t) ||
      /"array":\s*"\$model\(/.test(t),
  },
  {
    name: 'прежний оператор валидации each(…) вместо applyEach',
    test: (t) => /(^|[^\w.])each\(\s*\w+\./m.test(t),
  },
  {
    name: 'ручная обёртка makeValidationConfig вместо validation: { steps, extras }',
    test: (t) => /makeValidationConfig/.test(t),
  },
  {
    name: 'прикладной шим визарда (RendererFormWizard / wizard.tsx / $component(Wizard))',
    test: (t) => /RendererFormWizard|\bwizard\.tsx\b|\$component\(Wizard\)/.test(t),
  },
  {
    name: 'ручная связка createModel + createFormFromModel',
    test: (t) => /createModel\s*[<(]/.test(t) && LOW_LEVEL_FORM_RE.test(t),
  },
  {
    name: 'ручная связка convertJsonToM1Tree + фабрика формы',
    test: (t) => /convertJsonToM1Tree/.test(t) && ANY_FORM_FACTORY_RE.test(t),
  },
  {
    name: 'сборка формы в useMemo',
    test: (t) => /useMemo\s*\(/.test(t) && ANY_FORM_FACTORY_RE.test(t),
  },
  {
    name: 'settings={{ registry, model }} у провайдера рендерера',
    test: (t) => /settings=\{\{[^}]*\bmodel\b/.test(t),
  },
];

/**
 * Промпты, обязанные учить сборке: если файл вообще говорит про создание формы, он должен
 * назвать актуальную точку входа. Без этого «тихий разъезд» вернётся с другой стороны —
 * промпт просто перестанет упоминать сборку, и проверка выше ничего не найдёт.
 */
const MUST_MENTION_FACTORY = [
  'create-form.md',
  'start-here.md',
  'to-renderer.md',
  'to-renderer-json.md',
  'add-wizard.md',
];
const FACTORY_RE = /\bcreateForm\s*[<(]/;

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
  // Прежний контракт формы: так названы в промптах ключи, фабрики и файлы, которые сменил
  // единый контракт («the former contract», «прежний контракт»).
  'former',
  'прежн',
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
      api: 'не названа сборка формы — createForm',
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
  console.error(`✗ Материал MCP учит снятому API или прежнему контракту (${violations.length}):\n`);
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
    '  Снятое API и прежний контракт можно упоминать ТОЛЬКО как «так больше нельзя»: добавьте в\n' +
      '  этот же блок маркер отрицания (removed / obsolete / former / never emit / ❌ …) — как в\n' +
      '  add-validation.md и create-form.md — либо перепишите блок на живой контракт:\n' +
      '  узел { model: model.$.x, component }, сборка createForm + useFormBundle, поведение\n' +
      '  defineFormBehavior(({ model, form, schema }) => …), валидация defineValidationSchema.'
  );
  process.exit(1);
}

console.log(
  `✓ материал MCP: ${files.length} шаблон(ов) промптов + ${corpusFiles} файл(ов) JSDoc/docs-llms, ` +
    `${checkedBlocks} блок(ов) со снятым API или прежним контрактом — все в отрицательном контексте`
);

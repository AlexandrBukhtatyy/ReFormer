#!/usr/bin/env node
// Гард корпуса знаний: документация библиотек для агентов не должна УЧИТЬ снятому API.
//
// Корпус — то, что агент получает как справку по библиотеке: `docs/llms` пакетов (из них
// собирается `llms.txt`) и JSDoc исходников (из него — описания символов). Опасный случай —
// пример со снятым API, который компилируется: поле `validators` осталось в типах, поэтому код
// с ним проходит tsc и ESLint, форма рисуется и молча отправляет пустые обязательные поля.
// Описание символа и его же пример противоречат друг другу, и агент верит примеру.
//
// Упоминание снятого API допустимо ТОЛЬКО в отрицательном контексте («removed», «❌», «удалено»
// …). Контекст берётся БЛОКОМ (абзац / код-фенс), а не строкой: отрицание регулярно стоит на
// соседней строке. В .ts смотрим только JSDoc-блоки: реализация вправе читать `config.validators`.
//
// Модуль же отдаёт правила и обход другим проверкам того же рода (экспорты ниже).
//
// Использование: node scripts/llms-corpus.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Снятое из core API. Ключ — человекочитаемое имя для отчёта. */
export const REMOVED_API = [
  { name: 'validateFormModel', re: /validateFormModel/ },
  { name: 'ModelValidator', re: /ModelValidator/ },
  { name: 'leaf `validators: [...]`', re: /validators:\s*\[/ },
  // Замечание без текста: текст даёт словарь формы по коду правила.
  { name: 'ValidationError вместо ValidationIssue', re: /\bValidationError\b/ },
  {
    name: 'текст в опциях правила (`message`) вместо кода и словаря',
    re: /\b(required|email|url|pattern|minLength|maxLength|min|max)\([^)]*\{[^}]*\bmessage\s*:/,
  },
  // Уровень формы и поток шагов: шаги — в flow сборки, проверка и отправка — методы бандла.
  { name: '`validation.steps` вместо `flow.steps`', re: /validation\.steps\b/ },
  {
    name: '`bundle.validation.validateAll()` и др. вместо `bundle.validate()` / `submit()`',
    re: /bundle\.validation\??\.(?:validateAll|validateStep|runAll|runStep|stepSelectors)\b/,
  },
  {
    name: 'конфиг и ref визарда (FormWizardConfig / FormWizardHandle / defineSteps / useWizardStepValidation)',
    re: /\b(FormWizardConfig|FormWizardHandle|defineSteps|useWizardStepValidation)\b/,
  },
  // Ноды формы: контракты FormControl / FormGroup / FormArray.
  { name: 'FormProxy вместо FormGroup', re: /\bFormProxy\b/ },
  {
    name: 'классы нод FieldNode / GroupNode вместо FormControl / FormGroup',
    re: /\b(FieldNode|GroupNode)\b/,
  },
  {
    name: 'удалённые методы нод (patchValue / markAsDirty / markAsPristine)',
    re: /\.(patchValue|markAsDirty|markAsPristine)\(/,
  },
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
export const PRESENTATIONAL_AS_FIELD = [
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

export const LEGACY_ASSEMBLY = [
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
    name: 'ручная обёртка makeValidationConfig вместо потока шагов flow: { steps } сборки',
    test: (t) => /makeValidationConfig/.test(t),
  },
  {
    name: 'прикладной шим визарда (RendererFormWizard / wizard.tsx / $component(Wizard))',
    test: (t) => /RendererFormWizard|\bwizard\.tsx\b|\$component\(Wizard\)/.test(t),
  },
  {
    name: 'ручная связка createModel + createFormFromModel',
    test: (t) => /createModel\s*[<(]/.test(t) && LOW_LEVEL_FORM_RE.test(t),
    // Только промпты: они обязаны учить сборке `createForm`. Справочник docs/llms вправе
    // показывать низкоуровневый путь — `createFormFromModel` живое публичное API.
    promptOnly: true,
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
  // С 7.0 форму создаёт один путь — intent → form_build; generate_form удалён (аудит 2026-11).
  {
    name: 'generate_form вместо form_build',
    test: (t) => /\bgenerate_form\b/.test(t),
  },
];

/**
 * Маркеры отрицательного контекста. Достаточно одного в блоке.
 * Список намеренно явный: если появится новая формулировка отрицания — её сюда дописать,
 * это дешевле, чем угадывать тональность прозы эвристикой.
 */
export const NEGATIVE_MARKERS = [
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
  'больше нет',
  'вместо',
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

/**
 * Разбить текст на блоки (абзац/код-фенс) с номером стартовой строки и ближайшим заголовком над
 * блоком (`heading`): таблица «Было → Стало» под заголовком «Удалённое API» отделена от него
 * пустой строкой, и без заголовка её отрицательный контекст терялся.
 */
export function toBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let current = null;
  let inFence = false;
  let heading = '';

  lines.forEach((line, i) => {
    if (!inFence && /^#{1,6}\s/.test(line)) heading = line;
    if (/^\s*```/.test(line)) inFence = !inFence;
    // Пустая строка вне код-фенса закрывает блок; внутри фенса — часть блока.
    if (!inFence && line.trim() === '') {
      current = null;
      return;
    }
    if (current === null) {
      current = { startLine: i + 1, heading, lines: [] };
      blocks.push(current);
    }
    current.lines.push(line);
  });

  return blocks.map((b) => ({
    startLine: b.startLine,
    heading: b.heading,
    text: b.lines.join('\n'),
  }));
}

export function hasNegativeMarker(text) {
  const lower = text.toLowerCase();
  return NEGATIVE_MARKERS.some((m) => lower.includes(m));
}

// --- Корпус: JSDoc и docs/llms пакетов --------------------------------------------------
//
// Зачем. `get_symbol_docs` отдаёт агенту JSDoc из пакетов, `find_recipe` — файлы docs/llms.
// Замерено прогоном формы через MCP-only: 28 из 30
// фабрик валидаторов учили снятому `validators: [...]` внутри FieldConfig — ровно тому, что
// `05-common-mistakes.md` называет удалённым. Описание символа и его же пример противоречили
// друг другу, и агент верил примеру.
//
// Проверяем снятое API (REMOVED_API, PRESENTATIONAL_AS_FIELD), а в рецептах docs/llms — и прежний
// контракт сборки (LEGACY_ASSEMBLY без правил только для промптов). В .ts смотрим ИСКЛЮЧИТЕЛЬНО
// JSDoc-блоки: реализация вправе читать `config.validators`, это живое node-level поле.
//
// `checkCorpus`: `roots` — каталоги обхода, `base` — от чего считать пути в отчёте,
// `skip(rel)` — что пропустить.
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

export function checkCorpus({ roots, base, skip = () => false }) {
  const violations = [];
  let files = 0;
  let checkedBlocks = 0;
  for (const abs of roots) {
    if (!existsSync(abs)) continue;
    for (const full of walk(abs)) {
      const rel = path.relative(base, full).replace(/\\/g, '/');
      if (skip(rel)) continue;
      if (/\.(test|spec)\.tsx?$/.test(rel)) continue;

      const content = readFileSync(full, 'utf8');
      const isLlmsDoc = rel.endsWith('.md');
      const blocks = isLlmsDoc ? toBlocks(content) : jsdocBlocks(content);

      for (const block of blocks) {
        const hits = [
          ...REMOVED_API.filter((api) => api.re.test(block.text)),
          ...PRESENTATIONAL_AS_FIELD.filter((api) => api.re.test(block.text)),
          // Прежний контракт формы — и в рецептах docs/llms: `find_recipe` отдаёт их агенту целиком,
          // как промпт. В JSDoc эти связки не ищем — там их нет, а регулярки на код реализации
          // (`useMemo` рядом с фабрикой) дали бы ложные срабатывания.
          ...(isLlmsDoc
            ? LEGACY_ASSEMBLY.filter((api) => !api.promptOnly && api.test(block.text))
            : []),
        ];
        if (hits.length === 0) continue;
        checkedBlocks += 1;
        // В рецептах контекст блока — и его заголовок: разделы «Удалённое API», «Перевод документа
        // прежнего формата» перечисляют прежние имена таблицами и списками без слова-отрицания.
        if (hasNegativeMarker(isLlmsDoc ? `${block.heading ?? ''}\n${block.text}` : block.text))
          continue;
        violations.push({
          file: rel,
          line: block.startLine,
          api: hits.map((h) => h.name).join(', '),
          excerpt: block.text.split('\n').slice(0, 3).join('\n'),
        });
      }
      files += 1;
    }
  }
  return { violations, files, checkedBlocks };
}

/** Напечатать нарушения; `what` — что проверялось («Корпус знаний», «Материал MCP»). */
export function printViolations(violations, what) {
  console.error(`✗ ${what} учит снятому API или прежнему контракту (${violations.length}):\n`);
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
      '  этот же блок маркер отрицания (removed / obsolete / former / never emit / ❌ …) — либо\n' +
      '  перепишите блок на живой контракт:\n' +
      '  узел { model: model.$.x, component }, сборка createForm + useFormBundle, поведение\n' +
      '  defineFormBehavior(({ model, form, schema }) => …), валидация defineValidation.'
  );
}

// --- Запуск: корпус пакетов библиотеки ---------------------------------------------------

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { violations, files, checkedBlocks } = checkCorpus({
    roots: [path.join(repoRoot, 'packages')],
    base: repoRoot,
  });
  if (violations.length > 0) {
    printViolations(violations, 'Корпус знаний');
    process.exit(1);
  }
  console.log(
    `✓ корпус знаний: ${files} файл(ов) JSDoc/docs-llms, ${checkedBlocks} блок(ов) со снятым API ` +
      'или прежним контрактом — все в отрицательном контексте'
  );
}

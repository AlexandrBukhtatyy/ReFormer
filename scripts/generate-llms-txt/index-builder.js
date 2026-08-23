/**
 * Сборка `llms-index.json` — машиночитаемого индекса пакета, который публикуется рядом с
 * `llms.txt`.
 *
 * Зачем он вообще нужен. Сервер `@reformer/mcp` сегодня парсит TypeScript-AST установленных
 * пакетов в рантайме: это тянет `typescript` (23 MB) в РАНТАЙМНЫЕ зависимости публикуемого
 * пакета и дублирует логику, которая уже есть здесь, в генераторе (парсер символов в
 * `index.js` — по собственному комментарию, «mirrors» парсера сервера). Индекс убирает и то,
 * и другое: разбор происходит один раз на билде, рядом с источником.
 *
 * Почему индекс лежит В КАЖДОМ ПАКЕТЕ, а не внутри `@reformer/mcp`. Сервер публикуется
 * отдельно от библиотек, которые описывает, и у потребителя `@reformer/core` может быть
 * другой версии. Снапшот, запечённый в mcp, немедленно разъехался бы по версиям — причём
 * это была бы РЕГРЕССИЯ: сегодня парсер читает `node_modules/@reformer/core`, то есть ровно
 * установленную версию. Индекс рядом с `llms.txt` сохраняет это свойство.
 *
 * Что индекс НЕ содержит: тела секций документации. Они уже есть в `llms.txt`, который
 * сервер и так кэширует, и адресуются по `reformer://docs/<pkg>/<slug>`. Дублировать их —
 * удвоить вес пакета без выигрыша. Индекс несёт то, что дорого получить в рантайме:
 * символы, типизированные по словарю куски документации и карту «где что лежит».
 *
 * Словарь секций закреплён в docs/llms-convention.md §3 и соблюдается: 153 заголовка из
 * него встречаются в docs/llms/*.md. Поэтому типизация — извлечение, а не авторская работа.
 */

import fs from 'fs';
import path from 'path';

/** Версия схемы индекса. Ломающее изменение формата → +1, потребитель обязан проверять. */
export const INDEX_SCHEMA_VERSION = 1;

/**
 * Словарь §3 → поле индекса. Ключ — нормализованный заголовок (lowercase, без пунктуации).
 * Заголовок может стоять и на `##`, и на `###`: замерено 19+13 для `Anti-patterns`,
 * 2+13 для `Common Patterns`, 9+10 для `API` — привязываться к уровню нельзя.
 */
const SECTION_VOCABULARY = {
  purpose: 'purpose',
  overview: 'purpose',
  'key concepts': 'keyConcepts',
  api: 'api',
  'api reference': 'api',
  'common patterns': 'patterns',
  'anti patterns': 'antiPatterns',
  antipatterns: 'antiPatterns',
  examples: 'examples',
  troubleshooting: 'troubleshooting',
  'troubleshooting faq': 'troubleshooting',
  'see also': 'seeAlso',
  'quick start': 'quickStart',
  'import patterns': 'importPatterns',
  installation: 'installation',
};

/** Нормализация заголовка для сопоставления со словарём. */
function normalizeHeading(text) {
  return text
    .toLowerCase()
    .replace(/\{[^}]*\}/g, '') // якоря вида `{ #execute }`
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Слаг секции ТОЧНО так, как его считает `docs-parser.slugify` на стороне сервера:
 * lowercase + NFKC + схлопывание не-[a-z0-9] в `-` + обрезка краевых `-`.
 * Расхождение здесь означало бы URI в индексе, который ReadResource отвергнет,
 * поэтому инвариант закреплён тестом (index-artifacts.test.ts).
 */
export function slugify(title) {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Стем файла `06-validation.md` → `validation`. Стабильный id топика. */
export function topicId(fileName) {
  return fileName.replace(/\.md$/i, '').replace(/^\d+-/, '');
}

// ---------------------------------------------------------------------------
// Разбор одного docs-файла на типизированные куски
// ---------------------------------------------------------------------------

/** Все заголовки файла с телами, любого уровня. */
function splitHeadings(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (m) {
      if (current) out.push(current);
      current = { level: m[1].length, heading: m[2].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) out.push(current);
  return out.map((s) => ({ ...s, body: s.body.join('\n').trim() }));
}

/** Fenced-блоки тела с языком. */
function codeFences(body) {
  const out = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(body)) !== null) out.push({ lang: m[1] || null, code: m[2].trimEnd() });
  return out;
}

/**
 * Anti-patterns → структура `{ bad, why, correct }`.
 *
 * Разбор опирается на конвенцию, которую документация соблюдает буквально: внутри код-блока
 * плохой вариант помечен `// ❌ <пояснение>`, правильный — `// ✅ <пояснение>`. Замерено:
 * 25 из 25 код-блоков в секциях Anti-patterns содержат ОБА маркера. Секции без код-блоков
 * (их большинство — 24 из 32) сохраняются как есть, в поле `note`: выдумывать структуру,
 * которой в источнике нет, значит врать потребителю.
 */
export function parseAntiPatterns(body) {
  const entries = [];
  for (const { code } of codeFences(body)) {
    const lines = code.split('\n');
    const badLine = lines.findIndex((l) => l.includes('❌'));
    const goodLine = lines.findIndex((l) => l.includes('✅'));
    if (badLine === -1 || goodLine === -1 || goodLine < badLine) continue;

    // Текст ПОСЛЕ маркера в его строке — это и есть объяснение, ради которого секция писалась.
    const noteOf = (line, marker) =>
      line
        .slice(line.indexOf(marker) + marker.length)
        .replace(/^\s*/, '')
        .trim();

    // Код — строки блока БЕЗ строки-маркера. Ничего сверх этого не срезаем: первая версия
    // дополнительно убирала следующую `//`-строку и стирала реальное содержимое.
    const codeOf = (from, to) => lines.slice(from, to).join('\n').trim();

    const entry = {
      why: noteOf(lines[badLine], '❌'),
      bad: codeOf(badLine + 1, goodLine),
      correctNote: noteOf(lines[goodLine], '✅'),
    };
    const correct = codeOf(goodLine + 1, lines.length);
    // Бывает, что «правильный» вариант выражен только прозой в строке-маркере — тогда поля
    // `correct` просто нет. Пустая строка вместо него была бы враньём потребителю.
    if (correct) entry.correct = correct;
    entries.push(entry);
  }
  if (entries.length > 0) return entries;
  const note = body.trim();
  return note ? [{ note }] : [];
}

/** Пункты маркированного списка верхнего уровня (для Key Concepts / See also). */
function bulletItems(body) {
  return body
    .split(/\r?\n/)
    .filter((l) => /^\s*[-*]\s+\S/.test(l))
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);
}

/** Первый содержательный абзац — краткое назначение топика. */
function firstParagraph(md) {
  const body = md.replace(/^#\s+.+$/m, '');
  for (const chunk of body.split(/\n\s*\n/)) {
    const t = chunk.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('|') || t.startsWith('>')) {
      continue;
    }
    return t.replace(/\s+/g, ' ');
  }
  return '';
}

/**
 * Один топик = один файл `docs/llms/NN-<topic>.md`.
 *
 * `id` берётся из ИМЕНИ ФАЙЛА, а не из заголовка: `slugify` вырезает кириллицу, и заголовок
 * «61. Путь 1 — строковые пропы» схлопывается в слаг `"1"` (замерено — таких 5 из 343).
 * Имя файла всегда латинский kebab-case, поэтому id по построению осмысленный и стабильный.
 */
export function buildTopic(doc, sectionSlugs) {
  const typed = {
    purpose: '',
    keyConcepts: [],
    api: '',
    patterns: [],
    antiPatterns: [],
    examples: [],
    troubleshooting: [],
    seeAlso: [],
  };

  for (const s of splitHeadings(doc.raw)) {
    const field = SECTION_VOCABULARY[normalizeHeading(s.heading)];
    if (!field) continue;
    switch (field) {
      case 'purpose':
      case 'quickStart':
      case 'installation':
      case 'importPatterns':
        if (field === 'purpose' && !typed.purpose) typed.purpose = firstParagraph(s.body);
        break;
      case 'keyConcepts':
        typed.keyConcepts.push(...bulletItems(s.body));
        break;
      case 'api':
        if (!typed.api) typed.api = s.body.slice(0, 4000);
        break;
      case 'patterns':
        typed.patterns.push(
          ...codeFences(s.body).map((f) => ({ lang: f.lang, code: f.code.slice(0, 2000) }))
        );
        break;
      case 'antiPatterns':
        typed.antiPatterns.push(...parseAntiPatterns(s.body));
        break;
      case 'examples':
        typed.examples.push(
          ...codeFences(s.body).map((f) => ({ lang: f.lang, code: f.code.slice(0, 2000) }))
        );
        break;
      case 'troubleshooting':
        typed.troubleshooting.push(...bulletItems(s.body));
        break;
      case 'seeAlso':
        typed.seeAlso.push(...bulletItems(s.body));
        break;
      default:
        break;
    }
  }

  if (!typed.purpose) typed.purpose = firstParagraph(doc.raw);

  return {
    id: topicId(doc.file),
    file: doc.file,
    title: doc.title,
    ...typed,
    // Куда идти за полным текстом: те же слаги, что отдаёт resources/list-каталог.
    // Секции без слага парсер сервера не видит — не показываем их и мы.
    sections: doc.sections
      .map((s, i) => ({ heading: s.heading, slug: sectionSlugs[i] }))
      .filter((s) => s.slug !== null),
    terms: extractTerms(doc.raw),
  };
}

/**
 * Термы для полнотекстового поиска: слова прозы + идентификаторы из кода. Нужны, чтобы
 * ранжирование не зависело от повторного разбора markdown в рантайме.
 * Стоп-слова не режем — на этом объёме дешевле отфильтровать при скоринге.
 */
export function extractTerms(md) {
  const words = md.toLowerCase().match(/[a-zа-яё][a-zа-яё0-9_$]{2,}/gi) ?? [];
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
    .map(([w, n]) => [w, n]);
}

// ---------------------------------------------------------------------------
// Символы
// ---------------------------------------------------------------------------

/** Первое предложение описания — то, что показывается в списках. */
function summarize(description) {
  const flat = description.replace(/\s+/g, ' ').trim();
  const m = flat.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : flat).slice(0, 300);
}

/**
 * Символ в индексе. Примеров кладём ОДИН (канонический — первый): замерено, что >1 примера
 * лишь у 52 символов из 1056, а вес индекса растёт на всех. Полный список примеров остаётся
 * в `llms.txt` секции API Reference.
 */
export function buildSymbolEntry(sym, pkg, topicsByFile, pkgDir = process.cwd()) {
  const tag = (name) => sym.tags.filter((t) => t.tag === name);
  const examples = tag('example');
  // Путь считается от КАТАЛОГА ПАКЕТА, а не от cwd: индекс коммитится, и путь, зависящий от
  // места запуска, давал бы `src/form/x.ts` при сборке из пакета и `packages/reformer/src/form/x.ts`
  // из корня — то есть разный артефакт из одних и тех же исходников.
  const relSource = path.relative(pkgDir, sym.sourcePath).replace(/\\/g, '/');

  // `related` из @see: там встречаются и {@link X}, и markdown-ссылки на docs/llms.
  const related = [];
  for (const s of tag('see')) {
    for (const m of s.text.matchAll(/\{@link\s+([A-Za-z_$][\w$]*)/g)) related.push(m[1]);
  }

  return {
    name: sym.name,
    kind: sym.kind,
    signature: sym.signature,
    summary: summarize(sym.description),
    description: sym.description || undefined,
    params: tag('param')
      .filter((t) => t.name)
      .map((t) => [t.name, t.text]),
    returns: (tag('returns')[0] ?? tag('return')[0])?.text,
    example: examples[0]?.text,
    examplesCount: examples.length,
    deprecated:
      tag('deprecated').length > 0 ? tag('deprecated')[0].text || '(no message)' : undefined,
    related: related.length > 0 ? [...new Set(related)] : undefined,
    topics: topicsByFile.get(sym.name) ?? undefined,
    sourcePath: relSource,
    // Из каких подпутей пакета символ импортируется (, , …). Нужен для
    // проверки RF003: импорт из корня там, где символ живёт только в подпути, — ошибка,
    // которую tsc покажет лишь при сборке проекта потребителя.
    entries: sym.entries && sym.entries.length > 0 ? sym.entries : undefined,
    package: pkg,
  };
}

/**
 * Какие топики упоминают символ. Даёт `get_context` переход «символ → где про него читать»,
 * а `discover_context` — обратный, «топик → какие API относятся».
 */
export function mapSymbolsToTopics(symbols, docs) {
  const byName = new Map();
  for (const sym of symbols) {
    const hits = [];
    // Границы слова: `compute` не должен цепляться за `computeFrom` и наоборот.
    const re = new RegExp(`\\b${sym.name.replace(/[$]/g, '\\$')}\\b`);
    for (const doc of docs) {
      if (re.test(doc.raw)) hits.push(topicId(doc.file));
    }
    if (hits.length > 0) byName.set(sym.name, hits);
  }
  return byName;
}

// ---------------------------------------------------------------------------
// Частота использования — свободный сигнал популярности
// ---------------------------------------------------------------------------

/**
 * Сколько раз символ встречается в эталонных формах монорепо.
 *
 * Заменяет телеметрию (её пришлось бы собирать у пользователей и делать opt-in): в репозитории
 * уже есть корпус реальных форм, и он честнее — `validate` там 357 раз, `cross` 65, `compute` 55,
 * а `applyEach`/`aggregateInto`/`exclusiveFlag` — ноль. Это прямой сигнал для ранжирования.
 *
 * Каталога нет (сборка у потребителя, а не в монорепо) → поле просто отсутствует.
 */
export function countUsage(names, examplesDir) {
  if (!examplesDir || !fs.existsSync(examplesDir)) return null;
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) files.push(p);
    }
  };
  try {
    walk(examplesDir);
  } catch {
    return null;
  }
  const text = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const usage = {};
  for (const name of names) {
    const re = new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`, 'g');
    const n = (text.match(re) ?? []).length;
    if (n > 0) usage[name] = n;
  }
  return usage;
}

// ---------------------------------------------------------------------------
// Сборка
// ---------------------------------------------------------------------------

/**
 * Слаги секций ровно те, что сервер выведет из `llms.txt`.
 *
 * Повторяет `docs-parser.listSections` буква в букву, потому что расхождение означало бы
 * URI в индексе, который ReadResource отвергнет. Тонкости, на которых первая версия
 * ошиблась и которые ловит index-artifacts.test.ts:
 *
 *  1. `llms.txt` начинается с секции `## Table of Contents`, которой нет ни в одном
 *     docs-файле, — она занимает слаг ПЕРВОЙ и участвует в разведении коллизий;
 *  2. парсер срезает ведущий числовой префикс ДО слагификации, причём с квантификатором
 *     `+` — генератор нумерует секции сам (`## 5. …`), и если исходный заголовок тоже
 *     начинается с числа (`## 1. API Reference`), в llms.txt получается двойная нумерация
 *     `## 5. 1. API Reference`, из которой должно остаться `api-reference`;
 *  3. заголовок, от которого не остаётся ни одного `[a-z0-9]`, секцией НЕ считается
 *     (парсер его пропускает) — такой индекс обязан пропустить тоже.
 */
function computeSectionSlugs(docs, hasApiReference) {
  const used = new Set();
  const take = (heading) => {
    const clean = heading.replace(/^(\d+(\.\d+)*[.)]?\s+)+/, '');
    let slug = slugify(clean);
    if (!slug) return null;
    if (used.has(slug)) {
      let n = 2;
      while (used.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    used.add(slug);
    return slug;
  };

  if (docs.length > 0) take('Table of Contents');
  const byDoc = docs.map((doc) => doc.sections.map((s) => take(s.heading)));
  if (hasApiReference) take('API Reference');
  return byDoc;
}

/**
 * @param {object} args
 * @param {{name:string,version:string}} args.meta
 * @param {Array<{file:string,title:string,sections:Array<{heading:string,body:string}>,raw:string}>} args.docs
 * @param {Array<object>} args.symbols — из parsePublicSymbols генератора
 * @param {string|null} args.examplesDir — каталог эталонных форм для `usage` (может отсутствовать)
 */
export function buildIndex({ meta, docs, symbols, examplesDir = null, pkgDir = process.cwd() }) {
  const slugsByDoc = computeSectionSlugs(docs, symbols.length > 0);

  const topicsByFile = mapSymbolsToTopics(symbols, docs);
  const usage = countUsage(
    symbols.map((s) => s.name),
    examplesDir
  );

  const symbolEntries = symbols.map((s) => {
    const e = buildSymbolEntry(s, meta.name, topicsByFile, pkgDir);
    if (usage && usage[s.name]) e.usage = usage[s.name];
    return e;
  });

  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    package: meta.name,
    version: meta.version,
    topics: docs.map((doc, i) => buildTopic(doc, slugsByDoc[i])),
    symbols: symbolEntries,
  };
}

/**
 * Разбор `llms.txt` на секции — чистые функции над ТЕКСТОМ.
 *
 * Отделено от загрузки: раньше те же алгоритмы принимали имя пакета и сами лезли за содержимым
 * на диск, из-за чего единственным способом их проверить был реальный файл. Здесь на входе
 * строка, поэтому логика одинаково работает в CLI, в браузере и в тесте с литералом.
 *
 * Инвариант, который обязан соблюдаться в обе стороны: слаги, вычисленные здесь, совпадают со
 * слагами, которые проставляет генератор индекса (`scripts/generate-llms-txt/index-builder.js`).
 * Разъезд означает, что `reformer://docs/<pkg>/<slug>` из индекса перестанет резолвиться —
 * это закреплено `tests/index-artifacts.test.ts`.
 *
 * @module reformer-mcp/core/docs/sections
 */

/**
 * Нормализация topic/заголовка для сопоставления: lowercase + выкинуть дефисы/подчёркивания/
 * пробелы. Именно из-за их отсутствия «form-field» не находил секцию «## FormField», а
 * «enable-when» — «## enableWhen»: сервер рекламировал алиасы, которые сам не резолвил.
 */
export function normalizeTopic(s: string): string {
  return s.toLowerCase().replace(/[-_\s]/g, '');
}

/**
 * Открывающий/закрывающий забор кода: ```-строка или ~~~-строка (3+ символа, отступ до 3
 * пробелов), плюс «инфо-строка» после него — `ts`, `bash`, пусто.
 */
interface FenceDelimiter {
  char: string;
  length: number;
  info: string;
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

function matchFence(line: string): FenceDelimiter | null {
  const m = line.match(FENCE_RE);
  return m ? { char: m[1][0], length: m[1].length, info: m[2] } : null;
}

/**
 * Построчный трекер код-заборов: `true` — строка внутри блока кода (сам забор считается его
 * частью), значит заголовком быть не может.
 *
 * Зачем вообще. Разбор считал заголовком ЛЮБУЮ строку, начинающуюся с `#`, — включая те, что
 * лежат внутри блока кода: shell-комментарий, `# heading` в примере markdown, `#pragma`.
 * Замерено на корпусе: строка `# same names, allowed shapes:` внутри блока с раскладкой файлов
 * обрывала секцию «Minimalist (default) — flat, one file per concern» на 16 % раньше конца,
 * унося целиком блок «Rules:» — то есть сам контракт именования. Секция при этом выглядела
 * целой: ни маркера обрезки, ни ошибки.
 *
 * Правила — CommonMark: закрывает забор того же символа не короче открывающего и с пустой
 * инфо-строкой; у ```-забора в инфо-строке не может быть обратной кавычки (иначе это не
 * открытие); незакрытый забор тянется до конца текста. Последнее делает несбалансированный
 * забор в документации заметным (секции после него исчезнут), а не тихо игнорируемым —
 * баланс проверяется тестом на корпусе.
 */
export function createFenceTracker(): (line: string) => boolean {
  let open: FenceDelimiter | null = null;

  return (line: string): boolean => {
    const fence = matchFence(line);
    if (open) {
      if (fence && fence.char === open.char && fence.length >= open.length && !fence.info.trim()) {
        open = null;
      }
      return true;
    }
    if (fence && !(fence.char === '`' && fence.info.includes('`'))) {
      open = fence;
      return true;
    }
    return false;
  };
}

/**
 * Остался ли в тексте незакрытый код-забор.
 *
 * Две роли, обе про «обрыв не должен быть тихим»:
 *  - на корпусе — здоровье документации: незакрытый забор в `llms.txt` съел бы все секции
 *    после себя (CommonMark: блок тянется до конца текста);
 *  - на теле ОДНОЙ секции — признак того, что извлечение остановилось ПОСЕРЕДИНЕ блока кода,
 *    то есть ровно симптом дефекта, ради которого появился {@link createFenceTracker}.
 */
export function hasUnclosedFence(text: string): boolean {
  const inCodeFence = createFenceTracker();
  for (const line of text.split('\n')) inCodeFence(line);
  // Забор закрыт ⇒ пустая строка вне кода; открыт ⇒ она внутри блока.
  return inCodeFence('');
}

export interface SectionMeta {
  /** Original `## ` heading text, e.g. "copyFrom" or "API SIGNATURES". */
  title: string;
  /** URL-safe slug derived from the title (lowercase, kebab-case). */
  slug: string;
  /** Heading level. Only level 2 is exposed. */
  level: 2;
  /** First non-empty content line after the header, trimmed to ~120 chars. */
  preview: string;
}

/**
 * Convert a section title to a URL-safe slug.
 *
 * lowercase + NFKC normalisation + collapse non-`[a-z0-9]` runs into `-` +
 * trim leading/trailing `-`.
 *
 * @example
 * slugify('copyFrom')                 // 'copyfrom'
 * slugify('API SIGNATURES')           // 'api-signatures'
 * slugify('Multi-Step / Wizard')      // 'multi-step-wizard'
 * slugify('Troubleshooting / FAQ')    // 'troubleshooting-faq'
 */
export function slugify(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Перечислить все секции уровня 2 (`## `) в тексте `llms.txt`.
 *
 * Слаги уникальны в пределах результата: коллизии разводятся суффиксом `-2`, `-3`, … у
 * последующих вхождений (редко, но возможно, если два заголовка нормализуются одинаково).
 */
export function parseSections(docs: string): SectionMeta[] {
  const lines = docs.split('\n');
  const result: SectionMeta[] = [];
  const usedSlugs = new Set<string>();
  const inCodeFence = createFenceTracker();

  for (let i = 0; i < lines.length; i++) {
    // Трекер обязан увидеть КАЖДУЮ строку, поэтому зовётся до любых continue.
    if (inCodeFence(lines[i])) continue;
    const m = lines[i].match(/^##\s+(.+)$/);
    if (!m) continue;
    const title = m[1].trim();
    if (!title) continue;

    // Strip leading numeric prefix ("1.", "2.1.5", "3)") before slugifying so
    // slugs stay stable when sections are inserted/reordered upstream.
    // The `+` quantifier on the outer group handles double-numbering like
    // "1. 1. Foo" or "2. 1.5 Bar" produced by some llms.txt generators.
    const cleanTitle = title.replace(/^(\d+(\.\d+)*[.)]?\s+)+/, '');
    let slug = slugify(cleanTitle);
    if (!slug) continue; // skip pure-non-alnum titles
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    usedSlugs.add(slug);

    // Свой трекер на превью: заголовок обрывает поиск, только если он НЕ внутри забора, а
    // первая строка кода за забором по-прежнему годится в превью (историческое поведение).
    let preview = '';
    const inPreviewFence = createFenceTracker();
    for (let j = i + 1; j < lines.length && j < i + 12; j++) {
      const fenced = inPreviewFence(lines[j]);
      const trimmed = lines[j].trim();
      if (!trimmed) continue;
      if (!fenced && trimmed.startsWith('#')) break;
      if (trimmed.startsWith('```')) continue;
      preview = trimmed.slice(0, 120);
      break;
    }

    result.push({ title, slug, level: 2, preview });
  }

  return result;
}

/**
 * Тело одной секции по её метаданным: от строки `## ` до строки перед следующим заголовком
 * того же или более высокого уровня. `null` — заголовок в тексте не найден.
 *
 * В отличие от {@link extractSection} — точное совпадение заголовка, без подстрочного поиска.
 */
export function extractSectionByMeta(docs: string, meta: SectionMeta): string | null {
  const lines = docs.split('\n');
  const result: string[] = [];
  const inCodeFence = createFenceTracker();
  let inSection = false;
  let sectionLevel = 0;

  for (const line of lines) {
    // Строка внутри блока кода — всегда содержимое, никогда граница секции: иначе
    // shell-комментарий `# …` обрезал бы секцию на себе (см. createFenceTracker).
    const headerMatch = inCodeFence(line) ? null : line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const [, hashes, title] = headerMatch;
      const level = hashes.length;
      if (!inSection && level === 2 && title.trim() === meta.title) {
        inSection = true;
        sectionLevel = level;
        result.push(line);
        continue;
      }
      if (inSection && level <= sectionLevel) break;
    }
    if (inSection) result.push(line);
  }

  return result.length === 0 ? null : result.join('\n').trim();
}

/**
 * Section names in llms.txt
 */
export type SectionName =
  | 'Installation'
  | 'Quick Start'
  | 'Architecture'
  | 'Form Schema'
  | 'Node Types'
  | 'Validation'
  | 'Behaviors'
  | 'React Integration'
  | 'API Reference'
  | 'Common Patterns'
  | 'Troubleshooting / FAQ';

/**
 * Секция по имени заголовка — сопоставление подстрочное и нормализованное, уровни 1–3.
 *
 * `null` вместо сообщения об ошибке: текст «не найдено» зависит от того, искали в одном пакете
 * или во всех, а это знание вызывающего, не разборщика.
 */
export function extractSection(docs: string, name: SectionName | string): string | null {
  const lines = docs.split('\n');
  const result: string[] = [];
  const inCodeFence = createFenceTracker();
  let inSection = false;
  let sectionLevel = 0;

  for (const line of lines) {
    // Как и в extractSectionByMeta: забор экранирует `#` — и от начала секции, и от конца.
    const headerMatch = inCodeFence(line) ? null : line.match(/^(#{1,3})\s+(.+)$/);

    if (headerMatch) {
      const [, hashes, title] = headerMatch;
      const level = hashes.length;

      // Нормализуем обе стороны: «form-field» матчит «## FormField», «enable-when» — «## enableWhen».
      if (normalizeTopic(title).includes(normalizeTopic(name))) {
        inSection = true;
        sectionLevel = level;
        result.push(line);
        continue;
      }

      if (inSection && level <= sectionLevel) {
        break;
      }
    }

    if (inSection) {
      result.push(line);
    }
  }

  return result.length === 0 ? null : result.join('\n').trim();
}

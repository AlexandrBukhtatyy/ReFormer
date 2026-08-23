/**
 * Tests for the search_docs tool (ReFormer-wk1 pkg 4).
 *
 * Главный инвариант: каждый reformer://docs/<pkg>/<slug> в выдаче ОБЯЗАН резолвиться
 * через getSectionBySlug — иначе агент получит URI, который ReadResource отвергнет.
 * Плюс контракт краевых случаев (пустой запрос, отсутствие совпадений) и фильтр по пакету.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  searchDocsTool,
  searchSections,
  __resetSearchDocsIndex,
  OWN_DOCS_NO_LIBRARY_ALTERNATIVE,
  isOwnDocsExempt,
  isFormLayoutQuery,
} from '../src/core/tools/search-docs';
import { getSectionBySlug, listAvailablePackages } from '../src/utils/docs-parser';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

const URI_RE = /reformer:\/\/docs\/([^/\s`]+)\/([^\s`]+)/g;

function extractUris(text: string): Array<{ short: string; slug: string }> {
  const out: Array<{ short: string; slug: string }> = [];
  let m: RegExpExecArray | null;
  URI_RE.lastIndex = 0;
  while ((m = URI_RE.exec(text)) !== null) out.push({ short: m[1], slug: m[2] });
  return out;
}

describe('search_docs', () => {
  beforeEach(() => __resetSearchDocsIndex(k));

  it('пустой / пробельный query → подсказка, без падения', async () => {
    for (const q of [undefined, '', '   ']) {
      const res = await searchDocsTool({ query: q as string }, k);
      expect(res.content[0].text).toMatch(/query/i);
    }
  });

  it('осмысленный запрос находит секции и каждый URI резолвится через getSectionBySlug', async () => {
    if (listAvailablePackages().length === 0) return; // нет llms.txt на диске — нечего искать
    const res = await searchDocsTool({ query: 'validation' }, k);
    const text = res.content[0].text;
    const uris = extractUris(text);
    expect(uris.length).toBeGreaterThan(0);
    for (const { short, slug } of uris) {
      const pkg = `@reformer/${short}`;
      expect(
        getSectionBySlug(pkg, slug),
        `URI reformer://docs/${short}/${slug} из выдачи не резолвится в секцию`
      ).not.toBeNull();
    }
  });

  it('заведомо бессмысленный запрос → сообщение об отсутствии совпадений (без URI)', async () => {
    const res = await searchDocsTool({ query: 'zzqqxywvunlikelyterm' }, k);
    const text = res.content[0].text;
    expect(text).toMatch(/no documentation sections matched/i);
    expect(extractUris(text)).toHaveLength(0);
  });

  it('limit ограничивает число результатов', async () => {
    if (listAvailablePackages().length === 0) return;
    const res = await searchDocsTool({ query: 'form', limit: 2 }, k);
    const headers = (res.content[0].text.match(/^## @reformer\//gm) || []).length;
    expect(headers).toBeLessThanOrEqual(2);
  });

  it('фильтр package ограничивает выдачу одним пакетом', async () => {
    const available = listAvailablePackages();
    if (!available.includes('@reformer/core')) return;
    const res = await searchDocsTool({ query: 'form', package: '@reformer/core' }, k);
    for (const { short } of extractUris(res.content[0].text)) {
      expect(short).toBe('core');
    }
  });
});

/**
 * Понижение собственных доков сервера (`OWN_DOCS_PENALTY`) и его исключение.
 *
 * Штраф разумен: на «как сделать X в ReFormer» отвечает библиотечный пакет, а не мануал
 * сервера. Но у раскладки файлов формы библиотечной альтернативы нет вовсе — гайд «Form
 * directory layout» единственный называет набор файлов на каждый target, — и штраф топил
 * единственного носителя правила. Замерено (`.tmp/layout-check/report.md`): агент, не
 * прочитавший `reformer://guide` целиком (~47 КБ), получал 5/10 совпадений с каноном.
 */
describe('search_docs — понижение самодокументации и исключение из него', () => {
  beforeEach(() => __resetSearchDocsIndex(k));

  const hasDocs = listAvailablePackages().length > 0;

  it.runIf(hasDocs)('каждый префикс исключения резолвится в секцию mcp', () => {
    // Слаги считаются из ЗАГОЛОВКОВ гайда. Переименование заголовка молча выключило бы
    // исключение, и правило снова стало бы недостижимым — ловим это здесь.
    const slugs = k.docs.sections('@reformer/mcp').map((s) => s.slug);
    for (const prefix of OWN_DOCS_NO_LIBRARY_ALTERNATIVE) {
      expect(
        slugs.filter(isOwnDocsExempt).some((s) => s === prefix || s.startsWith(`${prefix}-`)),
        `префикс исключения "${prefix}" не резолвится — заголовок гайда переименован`
      ).toBe(true);
    }
  });

  it.runIf(hasDocs)('раскладка файлов формы выигрывает запрос про имена файлов', () => {
    // Со штрафом §1 набирал 10.5 и проигрывал core-секции `9. ARRAY SCHEMA FORMAT` (14.2),
    // которая к именам файлов отношения не имеет: слово «form» в ней просто чаще.
    const [top] = searchSections(k, 'form file names', undefined, 3);
    expect(top.pkg).toBe('@reformer/mcp');
    expect(top.slug).toBe('minimalist-default-flat-one-file-per-concern');
  });

  it.runIf(hasDocs)('§1 гайда находится по запросу «form directory layout»', () => {
    // Самая естественная английская формулировка вопроса «как назвать файлы формы». Слов
    // «form / directory / layout» нет ни в заголовке §1, ни в её теле — они были только в H1
    // и во введении файла, которые генератор llms.txt терял (ReFormer-8l6). Пока это было
    // так, §1 не входил даже в восьмёрку выдачи, и правило доезжало лишь до того, кто прочёл
    // `reformer://guide` целиком (~47 КБ). Замерено после починки: 5-е место, 11.5.
    const hits = searchSections(k, 'form directory layout', undefined, 8);
    expect(
      hits.map((h) => h.slug),
      '§1 гайда раскладки снова выпал из выдачи — проверь, что шапка файла попадает в llms.txt'
    ).toContain('minimalist-default-flat-one-file-per-concern');
  });

  it.runIf(hasDocs)('штраф продолжает действовать для самодокументации сервера', () => {
    // §5 гайда (`REFORMER_FORM_LAYOUT`) — настройка САМОГО сервера, то есть ровно та
    // самодокументация, ради которой штраф заводился, и в исключение он не входит. Без
    // штрафа она вставала на 2-е место этого запроса (19.93) выше ui-kit'овых «Layout across
    // targets», «Field grid» и «Spacing scale» — тех, о которых и спрашивают.
    const hits = searchSections(k, 'form layout spacing grid', undefined, 5);
    const own = hits.filter((h) => h.pkg === '@reformer/mcp');
    expect(
      own.map((h) => h.slug),
      'секции mcp перехватили ui-kit-запрос'
    ).toEqual([]);
  });
});

/**
 * Отрицательная сторона исключения: на запросах НЕ про раскладку гайд всплывать не должен.
 *
 * Эта проверка существует потому, что регресс уже случился. Исключение завели безусловным —
 * и §1, длинная секция с перечислением ответственности каждого файла (плотная по словам
 * `validate`, `step`, `sync`, `schema`), стала выигрывать чужие запросы: на батарее из 20
 * заведомо не-layout запросов секции гайда попадали в топ-3 трижды (все три — 1-е место,
 * вытеснив библиотечный ответ) и в топ-10 семь раз против нуля до исключения.
 *
 * Поймать это eval'ом не вышло: `eval/corpus/07-layout.json` умеет только `expectAny` —
 * положительное ожидание. Отрицательного канала («секция X не должна быть в выдаче») в
 * формате корпуса нет, поэтому сторож живёт здесь.
 */
describe('search_docs — исключение из штрафа действует только на layout-запросах', () => {
  beforeEach(() => __resetSearchDocsIndex(k));

  const hasDocs = listAvailablePackages().length > 0;

  /** Ровно те запросы, на которых безусловное исключение вытеснило библиотечный ответ. */
  const HIJACKED = [
    'how to validate a step',
    'keep two fields in sync',
    'render schema tree instead of jsx',
    'async data source options',
    'JSON DSL $model operator',
  ];

  it.runIf(hasDocs)('гайд раскладки не попадает в выдачу запросов не про файлы', () => {
    for (const query of HIJACKED) {
      const guide = searchSections(k, query, undefined, 10).filter(
        (h) => h.pkg === '@reformer/mcp' && isOwnDocsExempt(h.slug)
      );
      expect(
        guide.map((h) => h.slug),
        `запрос "${query}" не про раскладку файлов, а гайд раскладки в его выдаче`
      ).toEqual([]);
    }
  });

  it('условие темы: слово про организацию файлов включает исключение, общее слово — нет', () => {
    // Термы приходят из того же `tokenize`, что и индекс: нижний регистр, camelCase разобран.
    expect(isFormLayoutQuery(['form', 'file', 'names'])).toBe(true);
    expect(isFormLayoutQuery(['file', 'naming'])).toBe(true);
    expect(isFormLayoutQuery(['form', 'directory', 'layout'])).toBe(true);
    expect(isFormLayoutQuery(['what', 'files', 'should', 'form', 'have'])).toBe(true);
    expect(isFormLayoutQuery(['раскладка', 'файлов', 'формы'])).toBe(true);

    expect(isFormLayoutQuery(['how', 'to', 'validate', 'step'])).toBe(false);
    expect(isFormLayoutQuery(['keep', 'two', 'fields', 'in', 'sync'])).toBe(false);
    expect(isFormLayoutQuery(['render', 'schema', 'tree', 'instead', 'of', 'jsx'])).toBe(false);
  });

  it('неоднозначная основа без слова про модуль формы исключение НЕ включает', () => {
    // `file` живёт и вне раскладки: «file input component» без этого условия выигрывал §1.
    expect(isFormLayoutQuery(['file', 'input', 'component'])).toBe(false);
    expect(isFormLayoutQuery(['upload', 'file', 'field'])).toBe(false);
    expect(isFormLayoutQuery(['json', 'schema', 'structure'])).toBe(false);
    // …а вместе со словом про модуль формы — включает.
    expect(isFormLayoutQuery(['form', 'module', 'files'])).toBe(true);
    expect(isFormLayoutQuery(['структура', 'формы'])).toBe(true);
  });

  it.runIf(hasDocs)('целевые layout-запросы продолжают находить §1 гайда', () => {
    // Цена сужения должна быть нулевой: те же запросы, ради которых исключение и заводили.
    for (const query of [
      'form file names',
      'file naming',
      'form module files',
      'form directory layout',
      'directory layout',
      'what files should a form have',
    ]) {
      const hits = searchSections(k, query, undefined, 10);
      expect(
        hits.map((h) => h.slug),
        `§1 гайда раскладки выпал из выдачи запроса "${query}"`
      ).toContain('minimalist-default-flat-one-file-per-concern');
    }
  });
});

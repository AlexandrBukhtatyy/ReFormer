/**
 * Разбор `llms.txt` на секции: границей секции считается ТОЛЬКО заголовок вне блока кода.
 *
 * Дефект, ради которого файл появился. `extractSectionByMeta` признавала заголовком любую
 * строку, начинающуюся с `#`, — в том числе лежащую внутри ```-забора. В гайде раскладки
 * (`@reformer/mcp`, `06-form-directory-layout.md`) внутри блока с по-целевыми наборами файлов
 * есть строка-комментарий `# same names, allowed shapes:`. Разбор принимал её за заголовок
 * уровня 1 и обрывал на ней секцию «Minimalist (default) — flat, one file per concern»:
 * по `reformer://docs/mcp/minimalist-default-flat-one-file-per-concern` отдавалось 6 844
 * символа вместо 8 165 — терялись 1 321 символ (16 %) и вместе с ними ВЕСЬ блок «Rules:»,
 * то есть сам контракт именования, ради которого гайд и писался.
 *
 * Обрыв был тихим: ни маркера усечения, ни ошибки — секция выглядела целой. Поэтому здесь два
 * уровня проверок:
 *  - юнит-тесты на литералах — на все формы забора (``` и ~~~, длиннее трёх, с языковой
 *    меткой, с отступом), чтобы правило не выродилось в «пропускать строки между ```»;
 *  - инвариант на корпусе — НИ ОДНО тело секции не заканчивается внутри блока кода. Это и есть
 *    общий признак преждевременного обрыва, а не проверка одного известного места.
 */

import { describe, it, expect } from 'vitest';
import {
  createFenceTracker,
  hasUnclosedFence,
  parseSections,
  extractSection,
  extractSectionByMeta,
} from '../src/core/docs/sections';
import { listAvailablePackages, listSections, getFullDocs } from '../src/utils/docs-parser';

const packages = listAvailablePackages();
const hasDocs = packages.length > 0;

/** Тело секции по её заголовку — как это делает `sectionBySlug`, но без корпуса. */
function bodyOf(docs: string, title: string): string {
  const meta = parseSections(docs).find((s) => s.title === title);
  if (!meta) throw new Error(`секция "${title}" не распознана`);
  return extractSectionByMeta(docs, meta) ?? '';
}

describe('createFenceTracker — границы блоков кода', () => {
  it('считает содержимое ```-блока кодом, а строки вокруг — нет', () => {
    const inCode = createFenceTracker();
    expect(['текст', '```ts', 'const a = 1;', '```', 'снова текст'].map(inCode)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it('закрывает забор только тем же символом и не короче открывающего', () => {
    const inCode = createFenceTracker();
    // ~~~ не закрывает ```, а ``` короче четырёх — тоже: блок продолжается.
    expect(['````', '~~~', '```', '# всё ещё код', '````', 'текст'].map(inCode)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('не принимает за закрывающий забор строку с инфо-строкой', () => {
    const inCode = createFenceTracker();
    expect(['```', '```ts', '# код', '```', 'текст'].map(inCode)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('видит забор с отступом до трёх пробелов и не видит с четырьмя', () => {
    expect(['   ```', 'код', '   ```'].map(createFenceTracker())).toEqual([true, true, true]);
    expect(['    ```', 'текст'].map(createFenceTracker())).toEqual([false, false]);
  });

  it('hasUnclosedFence: незакрытый забор тянется до конца текста', () => {
    expect(hasUnclosedFence('текст\n```ts\nconst a = 1;')).toBe(true);
    expect(hasUnclosedFence('текст\n```ts\nconst a = 1;\n```\nещё')).toBe(false);
    expect(hasUnclosedFence('просто текст без заборов')).toBe(false);
  });
});

describe('extractSectionByMeta — `#` внутри блока кода не обрывает секцию', () => {
  // Сжатая копия формы, на которой ломалось: комментарий-строка внутри блока с раскладкой.
  const docs = [
    '## 1. Minimalist',
    '',
    'Вступление.',
    '',
    '```',
    'core (8):  index.tsx  model.ts',
    '',
    '# same names, allowed shapes:',
    'renderer-json  schema as raw data  -> renderer.schema.json',
    '```',
    '',
    'Rules:',
    '',
    '- **All steps inline in `index.tsx`**',
    '',
    '## 2. App-level infrastructure',
    '',
    'Другая секция.',
  ].join('\n');

  it('доезжает до конца секции вместе с блоком «Rules:»', () => {
    const body = bodyOf(docs, '1. Minimalist');
    expect(body).toContain('# same names, allowed shapes:');
    expect(body).toContain('Rules:');
    expect(body).toContain('All steps inline in `index.tsx`');
  });

  it('всё так же останавливается на СЛЕДУЮЩЕМ настоящем заголовке', () => {
    const body = bodyOf(docs, '1. Minimalist');
    expect(body).not.toContain('App-level infrastructure');
    expect(body).not.toContain('Другая секция.');
  });

  it('тело секции не обрывается внутри блока кода', () => {
    expect(hasUnclosedFence(bodyOf(docs, '1. Minimalist'))).toBe(false);
  });

  it('то же для ~~~-забора и заголовка любого уровня внутри него', () => {
    const md = [
      '## Shell block',
      '',
      '~~~bash',
      '### не заголовок',
      '#!/bin/sh',
      '~~~',
      '',
      'хвост секции',
      '',
      '## Next section',
    ].join('\n');
    const body = bodyOf(md, 'Shell block');
    expect(body).toContain('#!/bin/sh');
    expect(body).toContain('хвост секции');
    expect(body).not.toContain('Next section');
  });
});

describe('parseSections — `## ` внутри блока кода не создаёт секцию', () => {
  const md = [
    '## Real section',
    '',
    '```md',
    '## пример заголовка в примере',
    '```',
    '',
    'хвост',
    '',
    '## Second real',
  ].join('\n');

  it('перечисляет только заголовки вне заборов', () => {
    expect(parseSections(md).map((s) => s.title)).toEqual(['Real section', 'Second real']);
  });

  it('тело первой секции включает пример целиком', () => {
    const body = bodyOf(md, 'Real section');
    expect(body).toContain('## пример заголовка в примере');
    expect(body).toContain('хвост');
  });
});

describe('extractSection (подстрочный поиск) — то же правило', () => {
  it('не заканчивает секцию на `#` внутри примера', () => {
    const md = ['# Гайд', '', '```sh', '# комментарий', '```', '', 'важный хвост'].join('\n');
    const body = extractSection(md, 'Гайд') ?? '';
    expect(body).toContain('важный хвост');
  });

  it('не НАЧИНАЕТ секцию с заголовка, который лежит в примере', () => {
    const md = ['# Введение', '', '```md', '# Установка', 'из примера', '```', ''].join('\n');
    // «Установка» есть только внутри примера — секции с таким заголовком в документе нет.
    const body = extractSection(md, 'Установка');
    expect(body === null || !body.startsWith('# Установка')).toBe(true);
  });
});

describe('корпус — обрывов внутри блоков кода не осталось', () => {
  it.runIf(hasDocs)('ни один `llms.txt` не содержит незакрытого забора', () => {
    // Незакрытый забор по правилам CommonMark тянется до конца текста — все секции после него
    // перестали бы существовать. Дешевле поймать это здесь, чем ловить пропажу секции.
    const broken = packages.filter((pkg) => hasUnclosedFence(getFullDocs(pkg)));
    expect(broken, `незакрытый код-забор: ${broken.join(', ')}`).toEqual([]);
  });

  it.runIf(hasDocs)('ни одно тело секции не заканчивается внутри блока кода', () => {
    // Общий признак преждевременного обрыва. До правки инвариант нарушала ровно одна секция
    // на 362 — mcp/minimalist-default-flat-one-file-per-concern.
    const broken: string[] = [];
    for (const pkg of packages) {
      const docs = getFullDocs(pkg);
      for (const meta of listSections(pkg)) {
        const body = extractSectionByMeta(docs, meta) ?? '';
        if (hasUnclosedFence(body)) broken.push(`${pkg}/${meta.slug}`);
      }
    }
    expect(broken, `секция оборвана внутри блока кода: ${broken.join(', ')}`).toEqual([]);
  });

  const hasOwnDocs = (packages as readonly string[]).includes('@reformer/mcp');

  it.runIf(hasOwnDocs)(
    '§1 гайда раскладки отдаётся с блоком «Rules:» и полным набором имён',
    () => {
      // Именно эта секция и была обрезана; проверяем не длину, а те строки, ради которых
      // её читают: контракт именования и правило «все шаги инлайном».
      const docs = getFullDocs('@reformer/mcp');
      const meta = listSections('@reformer/mcp').find(
        (s) => s.slug === 'minimalist-default-flat-one-file-per-concern'
      );
      expect(meta, 'секция раскладки пропала из llms.txt').toBeDefined();
      const body = extractSectionByMeta(docs, meta!) ?? '';
      expect(body).toContain('Rules:');
      expect(body).toContain('All steps inline in `index.tsx`');
      for (const file of [
        'form.schema.ts',
        'renderer.schema.ts',
        'form.behavior.ts',
        'registry.ts',
      ]) {
        expect(body, `имя ${file} не доехало до конца секции`).toContain(file);
      }
    }
  );
});

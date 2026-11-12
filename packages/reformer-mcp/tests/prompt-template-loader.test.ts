/**
 * Подстановка в шаблонах промптов (ReFormer-bx95): `{{имя}}` и ничего больше. Шаблонизатор
 * Handlebars заменён ею, потому что его разделители совпадали с JSX и промпт `start-here` отдавал
 * клиентам -32603. Здесь закреплено то, ради чего замена делалась: JSX — текст, значение не
 * разбирается повторно, пропущенная переменная — ошибка, а остатки старого синтаксиса видны.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fillTemplate,
  renderPromptTemplate,
  staleTemplateSyntax,
  templatePlaceholders,
} from '../src/utils/prompt-template-loader';

const templatesDir = resolve(__dirname, '../src/prompts/templates');
const templateFiles = readdirSync(templatesDir).filter((file) => file.endsWith('.md'));

describe('fillTemplate', () => {
  it('подставляет значения по именам, повторная подстановка берёт то же значение', () => {
    expect(fillTemplate('# {{title}}\n\n{{body}} — {{title}}', { title: 'Т', body: 'текст' })).toBe(
      '# Т\n\nтекст — Т'
    );
  });

  it('JSX и объекты в фигурных скобках остаются текстом', () => {
    const template =
      '<FormRenderer settings={{ fieldWrapper: FormField }} />\n' +
      'style={{ color }} {{a: 1}} {{ name }} { {name} }';
    expect(fillTemplate(template, {})).toBe(template);
  });

  it('значение не разбирается повторно и не трактуется как шаблон replace', () => {
    const code = 'const x = {{other}}; s.replace(re, "$& $1 $$ $`")';
    expect(fillTemplate('{{code}}|{{other}}', { code, other: 'O' })).toBe(`${code}|O`);
  });

  it('пропущенная переменная — ошибка со списком недостающих и переданных', () => {
    expect(() => fillTemplate('{{a}} {{b}} {{c}}', { a: 1 }, 'x.md')).toThrow(
      'Prompt template "x.md" missing variables: b, c. Provided: a'
    );
  });

  it('имя из прототипа объекта переменной не считается', () => {
    expect(() => fillTemplate('{{toString}}', {})).toThrow(/missing variables: toString/);
  });

  it('null и undefined под ключом — пустая строка, число — его запись', () => {
    expect(fillTemplate('[{{a}}][{{b}}][{{n}}]', { a: null, b: undefined, n: 42 })).toBe(
      '[][][42]'
    );
  });
});

describe('templatePlaceholders', () => {
  it('имена без повторов в порядке появления, только точная форма', () => {
    expect(templatePlaceholders('{{b}} {{a}} {{b}} {{ c }} {{d.e}} {{1x}}')).toEqual(['b', 'a']);
  });
});

describe('staleTemplateSyntax', () => {
  it('находит остатки Handlebars с номерами строк', () => {
    const template = [
      'ok {{name}}',
      'settings=\\{{ a: b }}',
      '{{#if x}}',
      '{{else}}',
      '{{/if}}',
      '{{!-- comment --}}',
      '{{> partial}}',
      '{{{{raw}}}}x{{{{/raw}}}}',
      '{{{triple}}}',
    ].join('\n');
    expect(staleTemplateSyntax(template).map((hit) => hit.line)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 8, 9,
    ]);
  });

  it('JSX и подстановки — не остатки', () => {
    expect(staleTemplateSyntax('{{name}} settings={{ fieldWrapper: FormField }}')).toEqual([]);
  });
});

describe('шаблоны пакета', () => {
  it('шаблоны на месте', () => {
    expect(templateFiles.length).toBeGreaterThan(0);
  });

  it.each(templateFiles)('%s без синтаксиса Handlebars', (file) => {
    expect(staleTemplateSyntax(readFileSync(resolve(templatesDir, file), 'utf8'))).toEqual([]);
  });

  it('шаблон без подстановок рендерится как есть', () => {
    const raw = readFileSync(resolve(templatesDir, 'start-here.md'), 'utf8');
    expect(templatePlaceholders(raw)).toEqual([]);
    expect(renderPromptTemplate('start-here', {})).toBe(raw);
  });

  it('неизвестный шаблон — ошибка с путями поиска', () => {
    expect(() => renderPromptTemplate('no-such-template', {})).toThrow(
      /Prompt template "no-such-template\.md" not found\. Tried:/
    );
  });
});

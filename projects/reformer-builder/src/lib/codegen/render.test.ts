import { describe, expect, it } from 'vitest';
import { registerPartial, renderTemplate } from './render';

/** Вид-заглушка: движку всё равно, что внутри, а тестам нужна короткая запись. */
const view = (data: Record<string, unknown> = {}): object => data;

describe('экранирования нет — печатается код, а не HTML', () => {
  // Умолчание Eta — `autoEscape: true`, и оно молча ломало бы КАЖДЫЙ печатаемый файл:
  // условие превращалось бы в `&amp;&amp;`, JSX — в `&lt;div&gt;`, строка — в `&quot;`.
  // Отказ при этом выглядел бы не как ошибка шаблонизатора, а как «кодоген печатает мусор».
  it('логические операторы, угловые скобки и кавычки доезжают как есть', () => {
    const out = renderTemplate('t.escape', '<%= it.code %>', view({ code: 'a && b < c > "d"' }));
    expect(out).toBe('a && b < c > "d"');
  });

  it('JSX с двойными фигурными скобками — обычный текст', () => {
    // Ровно то, обо что разбился Handlebars в `packages/reformer-mcp`: `{{` там разбирается
    // как выражение. У Eta разделители `<% %>`, поэтому JSX для неё ничем не примечателен.
    const source = '<JsonFormRenderer settings={{ fieldWrapper: <%= it.wrapper %> }} />';
    expect(renderTemplate('t.jsx', source, view({ wrapper: 'FormField' }))).toBe(
      '<JsonFormRenderer settings={{ fieldWrapper: FormField }} />'
    );
  });
});

describe('пробелы передаются буквально, обрезка — только явная', () => {
  // Это и есть причина отказа от умолчания Eta (`autoTrim: [false, 'nl']`): там перевод строки
  // съедался за КАЖДЫМ закрывающим тегом, то есть обычная подстановка в конце строки молча
  // склеивала соседние строки. В шаблоне отказ не виден — перенос стоит на месте.
  it('подстановка в конце строки НЕ съедает перевод строки', () => {
    expect(renderTemplate('t.eol', '# <%= it.x %>\n\nтекст', view({ x: 'Форма' }))).toBe(
      '# Форма\n\nтекст'
    );
  });

  it('управляющий тег с `-%>` даёт ровно одну строку на итерацию', () => {
    const source = [
      '<% for (const name of it.names) { -%>',
      "  reg('<%= name %>');",
      '<% } -%>',
    ].join('\n');
    expect(renderTemplate('t.loop', source, view({ names: ['A', 'B'] }))).toBe(
      "  reg('A');\n  reg('B');\n"
    );
  });

  it('управляющий тег БЕЗ `-%>` оставляет свой перевод строки — и это видно', () => {
    const source = ['<% for (const n of it.ns) { %>', 'L', '<% } %>'].join('\n');
    expect(renderTemplate('t.loop-raw', source, view({ ns: [1] }))).toBe('\nL\n');
  });

  it('отступ внутри цикла сохраняется', () => {
    const source = '<% for (const n of it.ns) { -%>\n      <%= n %>,\n<% } -%>';
    expect(renderTemplate('t.indent', source, view({ ns: [1] }))).toBe('      1,\n');
  });
});

describe('ошибка шаблона называет место, а не только причину', () => {
  // Единственная причина, по которой шаблоны вообще можно отдать пользователю: без номера
  // строки сообщение «Cannot read properties of undefined» не говорит НИЧЕГО о том, где чинить.
  it('исполнение: номер строки и окно вокруг сбойной', () => {
    const source = ['строка 1', 'строка 2', '<%= it.nope.deep %>', 'строка 4'].join('\n');
    let message = '';
    try {
      renderTemplate('t.runtime', source, view());
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('line 3');
    expect(message).toContain('>> 3|');
    expect(message).toContain('Cannot read properties of undefined');
  });

  it('разбор: незакрытый тег отвергается, а не уезжает в файл', () => {
    expect(() => renderTemplate('t.parse', 'до <%= it.x после', view({ x: 1 }))).toThrow();
  });
});

describe('кэш сверяется по тексту, а не по имени', () => {
  // Пользовательские шаблоны перечитываются: после правки файла имя то же, тело другое.
  // Кэш «по имени» отдал бы прежнюю скомпилированную функцию, и правка не применилась бы —
  // причём молча, что неотличимо от «мой шаблон не подхватился».
  it('то же имя с другим исходником печатает по-новому', () => {
    expect(renderTemplate('t.same', 'первый <%= it.x %>', view({ x: 1 }))).toBe('первый 1');
    expect(renderTemplate('t.same', 'второй <%= it.x %>', view({ x: 1 }))).toBe('второй 1');
  });
});

describe('включения работают без файловой системы', () => {
  // На `eta/core` поля `readFile`/`resolvePath` равны `null`, поэтому поиск идёт во внутренний
  // стор. Это не обход ограничения, а требование: шаблон приезжает из источника проекта.
  it('зарегистрированный партиал подставляется', () => {
    registerPartial('t.partial', 'СНИППЕТ(<%= it.dir %>)');
    const out = renderTemplate('t.host', 'A <%~ include("t.partial", it) %> B', view({ dir: 'f' }));
    expect(out).toBe('A СНИППЕТ(f) B');
  });

  it('незарегистрированное включение — отказ с именем', () => {
    expect(() => renderTemplate('t.missing', '<%~ include("нет-такого", it) %>', view())).toThrow(
      /нет-такого/
    );
  });
});

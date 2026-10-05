import { describe, expect, it } from 'vitest';
import { formatTargetFile, parseTargetFile } from './template-file';

const file = (header: string, body = 'тело\n'): string => `---\n${header}\n---\n${body}`;

describe('заголовок файла цели', () => {
  it('разбирается вместе с телом, тело остаётся байт в байт', () => {
    const result = parseTargetFile(
      file('{ "id": "user.api", "path": "api.ts", "cls": "user" }', 'строка 1\n\nстрока 3\n')
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta).toEqual({ id: 'user.api', path: 'api.ts', cls: 'user' });
    expect(result.body).toBe('строка 1\n\nстрока 3\n');
  });

  it('необязательные поля доезжают', () => {
    const result = parseTargetFile(
      file(
        '{ "id": "u", "path": "p.ts", "cls": "derived", "order": 45, "title": "Мой",\n "overrides": "codegen.registry", "applies": "it.wizard !== null", "regenerable": true }'
      )
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.order).toBe(45);
    expect(result.meta.overrides).toBe('codegen.registry');
    expect(result.meta.applies).toBe('it.wizard !== null');
    expect(result.meta.regenerable).toBe(true);
  });

  it('тело может само содержать `---`', () => {
    // Закрывающей считается ПЕРВАЯ строка `---` после заголовка, поэтому разделитель внутри
    // тела (а он бывает в markdown-целях) остаётся текстом.
    const result = parseTargetFile(
      file('{ "id": "u", "path": "R.md", "cls": "derived" }', 'a\n---\nb\n')
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe('a\n---\nb\n');
  });
});

describe('отказы называются, а не проглатываются', () => {
  // Соседний `parseManifest` шаблонов проекта на битом JSON возвращает `{}` — там это уместно.
  // Здесь цель, молча выпавшая из списка, неотличима от «мой файл не подхватился», и человек
  // будет искать причину в шаблоне, которого никто не читал.
  const cases: [string, string, RegExp][] = [
    ['нет заголовка вовсе', 'просто текст\n', /должен начинаться/],
    ['заголовок не закрыт', '---\n{ "id": "u" }\n', /не закрыт/],
    ['битый JSON', file('{ "id": '), /не разбирается как JSON/],
    ['заголовок — массив', file('[]'), /объектом JSON/],
    ['нет id', file('{ "path": "a.ts", "cls": "user" }'), /нет «id»/],
    ['нет path', file('{ "id": "u", "cls": "user" }'), /нет «path»/],
    ['чужой cls', file('{ "id": "u", "path": "a.ts", "cls": "прочее" }'), /derived.*user/],
    [
      'order не число',
      file('{ "id": "u", "path": "a.ts", "cls": "user", "order": "10" }'),
      /числом/,
    ],
    [
      'regenerable не булево',
      file('{ "id": "u", "path": "a.ts", "cls": "user", "regenerable": "да" }'),
      /true или false/,
    ],
    ['пустой title', file('{ "id": "u", "path": "a.ts", "cls": "user", "title": "  " }'), /title/],
  ];

  it.each(cases)('%s', (_name, text, expected) => {
    const result = parseTargetFile(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(expected);
  });
});

describe('обратная сборка — для выгрузки встроенного шаблона', () => {
  it('печатает то, что разбирается обратно в то же самое', () => {
    const meta = {
      id: 'user.registry',
      overrides: 'codegen.registry',
      path: 'registry.ts',
      cls: 'derived' as const,
      order: 40,
      title: 'Реестр компонентов',
    };
    const text = formatTargetFile(meta, 'тело шаблона\n');
    const back = parseTargetFile(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.meta).toEqual(meta);
    expect(back.body).toBe('тело шаблона\n');
  });

  it('заголовок печатается по строке на поле — его будут править руками', () => {
    const text = formatTargetFile({ id: 'u', path: 'a.ts', cls: 'user' }, '');
    expect(text.split('\n').slice(0, 6)).toEqual([
      '---',
      '{',
      '  "id": "u",',
      '  "path": "a.ts",',
      '  "cls": "user"',
      '}',
    ]);
  });
});

describe('цель по шагам визарда — each: step', () => {
  const header = (extra: string): string =>
    `---\n{ "id": "u.step", "path": "steps/{step}/validation.ts", "cls": "user"${extra} }\n---\nтело\n`;

  it('разбирает «each»: «step» и возвращает его в заголовке', () => {
    const result = parseTargetFile(header(', "each": "step"'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.each).toBe('step');
    expect(result.meta.path).toBe('steps/{step}/validation.ts');
  });

  it('без «each» поля нет вовсе — а не undefined', () => {
    const result = parseTargetFile(header(''));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('each' in result.meta).toBe(false);
  });

  it('иное значение «each» — отказ, а не молчаливая цель на один файл', () => {
    const result = parseTargetFile(header(', "each": "field"'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/each/);
  });

  it('выгрузка печатает «each» после «path», и файл разбирается обратно', () => {
    const meta = {
      id: 'user.step-validation',
      overrides: 'codegen.step-validation',
      path: 'steps/{step}/validation.ts',
      each: 'step' as const,
      cls: 'user' as const,
      regenerable: true,
    };
    const text = formatTargetFile(meta, 'тело\n');
    expect(text).toContain('"path": "steps/{step}/validation.ts",\n  "each": "step",');
    const back = parseTargetFile(text);
    expect(back.ok && back.meta).toEqual(meta);
  });
});

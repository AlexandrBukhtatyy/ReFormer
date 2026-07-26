import { describe, expect, it } from 'vitest';
import { errorLine, lineOfPath, parseErrorPath, splitErrorMessage } from './error-path';

describe('splitErrorMessage', () => {
  it('путь + текст диагностики', () => {
    expect(splitErrorMessage('root.children[0].componentProps has unknown property "x"')).toEqual({
      path: 'root.children[0].componentProps',
      rest: ' has unknown property "x"',
    });
  });

  it('хвостовой `:` уходит в текст, а не в путь', () => {
    expect(splitErrorMessage('root.children[0]: unknown component "Foo"')).toEqual({
      path: 'root.children[0]',
      rest: ': unknown component "Foo"',
    });
  });

  it('сообщение без пробелов — весь текст путь', () => {
    expect(splitErrorMessage('/')).toEqual({ path: '/', rest: '' });
  });
});

describe('parseErrorPath', () => {
  it('сегменты объектов и индексы массивов', () => {
    expect(parseErrorPath('root.children[2].component must be string')).toEqual({
      segments: ['root', 'children', 2, 'component'],
      property: undefined,
    });
  });

  it('имя лишнего пропа для `unknown property`', () => {
    const parsed = parseErrorPath('root.componentProps has unknown property "data-testid"');
    expect(parsed).toEqual({ segments: ['root', 'componentProps'], property: 'data-testid' });
  });

  it('ajv instancePath через `/`', () => {
    expect(parseErrorPath('root.componentProps/clearable must be boolean')?.segments).toEqual([
      'root',
      'componentProps',
      'clearable',
    ]);
  });
});

describe('lineOfPath', () => {
  // Сериализация — та же, что рисует raw-панель: JSON.stringify(obj, null, 2).
  const schema = {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        { value: '$model(a)', component: '$component(Input)' },
        { value: '$model(b)', component: '$component(Input)', componentProps: { min: 1 } },
      ],
    },
  };

  /** Референс: реально найти 1-based строку начала узла в pretty-JSON. */
  const lines = JSON.stringify(schema, null, 2).split('\n');
  const lineStartingWith = (needle: string) =>
    lines.findIndex((l) => l.trimStart().startsWith(needle)) + 1;

  it('корень — строка 1', () => {
    expect(lineOfPath(schema, [])).toBe(1);
  });

  it('верхнеуровневый ключ', () => {
    expect(lineOfPath(schema, ['root'])).toBe(lineStartingWith('"root"'));
  });

  it('элемент массива по индексу', () => {
    // Второй элемент children — его строка `{` (первого свойства value второго элемента).
    const line = lineOfPath(schema, ['root', 'children', 1]);
    expect(line).not.toBeNull();
    // На этой строке начинается объект второго элемента.
    expect(lines[line! - 1].trim()).toBe('{');
    // А его value — на следующей.
    expect(lines[line!].trim()).toBe('"value": "$model(b)",');
  });

  it('вложенный проп внутри элемента массива', () => {
    const line = lineOfPath(schema, ['root', 'children', 1, 'componentProps', 'min']);
    expect(line).not.toBeNull();
    expect(lines[line! - 1].trim()).toBe('"min": 1');
  });

  it('несуществующий путь → null', () => {
    expect(lineOfPath(schema, ['root', 'nope'])).toBeNull();
    expect(lineOfPath(schema, ['root', 'children', 99])).toBeNull();
  });
});

describe('errorLine', () => {
  const schema = {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          value: '$model(x)',
          component: '$component(Input)',
          componentProps: { label: 'A', 'data-testid': 'x' },
        },
      ],
    },
  };
  const lines = JSON.stringify(schema, null, 2).split('\n');

  it('`unknown property` прыгает на сам лишний проп', () => {
    const line = errorLine(
      schema,
      'root.children[0].componentProps has unknown property "data-testid"'
    );
    expect(line).not.toBeNull();
    expect(lines[line! - 1].trim()).toBe('"data-testid": "x"');
  });

  it('несуществующий путь → null (мягко)', () => {
    expect(errorLine(schema, 'root.ghost.field must be string')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { CODES } from './codes';
import { parseJson, splitLocation } from './locate';
import { translateMessage } from './translate';

describe('адрес отделяется от сообщения во всех трёх диалектах', () => {
  it('JSON Pointer из ajv', () => {
    expect(splitLocation("/root/children/0 must have required property 'component'")).toEqual({
      path: ['root', 'children', 0],
      message: "must have required property 'component'",
    });
  });

  it('точечная запись из обхода имён операторов (двоеточие снимается)', () => {
    expect(splitLocation('root.children[0].component: unknown component "Inpt"')).toEqual({
      path: ['root', 'children', 0, 'component'],
      message: 'unknown component "Inpt"',
    });
  });

  it('смесь: точечная голова, указательный хвост', () => {
    expect(splitLocation('root.children[1].componentProps/hint must be string')).toEqual({
      path: ['root', 'children', 1, 'componentProps', 'hint'],
      message: 'must be string',
    });
  });

  it('корень схемы обозначается одиночным слэшем', () => {
    expect(splitLocation('/ has unknown property "roots"')).toEqual({
      path: [],
      message: 'has unknown property "roots"',
    });
  });

  it('вложенные индексы подряд', () => {
    // Шаг визарда — `children[2]`; индексы подряд даёт массив массивов в пропсах узла.
    expect(
      splitLocation('root.children[2].componentProps.rows[1][0].value: unknown fn "calc"').path
    ).toEqual(['root', 'children', 2, 'componentProps', 'rows', 1, 0, 'value']);
  });

  it('фраза с хвостом-пояснением: адресом остаётся только первая лексема', () => {
    expect(
      splitLocation(
        'root.children[0].part: unknown part "adress" — declare it in the document "parts" map'
      )
    ).toEqual({
      path: ['root', 'children', 0, 'part'],
      message: 'unknown part "adress" — declare it in the document "parts" map',
    });
  });
});

describe('сообщение становится кодом и параметрами', () => {
  const cases: [string, string, Record<string, unknown>][] = [
    ['unknown component "Inpt"', CODES.UNKNOWN_COMPONENT, { name: 'Inpt' }],
    [
      'HTML tag "script" is not allowed in $html(...) — presentational tags only',
      CODES.HTML_TAG_NOT_ALLOWED,
      { tag: 'script' },
    ],
    ['unknown dataSource "LOAN_TYPES"', CODES.UNKNOWN_DATA_SOURCE, { name: 'LOAN_TYPES' }],
    ['unknown fn "calcTotal"', CODES.UNKNOWN_FN, { name: 'calcTotal' }],
    ['unknown locale key "fields.sum"', CODES.UNKNOWN_LOCALE_KEY, { key: 'fields.sum' }],
    // Имя — до ПЕРВОЙ кавычки: в хвосте-пояснении свои кавычки, и жадный образец вернул бы
    // именем `adress" — declare it in the document "parts`.
    [
      'unknown part "adress" — declare it in the document "parts" map',
      CODES.UNKNOWN_PART,
      { name: 'adress' },
    ],
    // Хвост образцом не закреплён: без пояснения фраза узнаётся так же.
    ['unknown part "row"', CODES.UNKNOWN_PART, { name: 'row' }],
    ['has unknown property "lable"', CODES.UNKNOWN_PROPERTY, { property: 'lable' }],
    ["must have required property 'component'", CODES.MISSING_PROPERTY, { property: 'component' }],
    ['must be boolean', CODES.WRONG_TYPE, { expected: 'boolean' }],
    ['must be string,null', CODES.WRONG_TYPE, { expected: 'string,null' }],
    // Ниже — то, что до сужения образца притворялось ошибкой типа и печаталось фразой
    // «Значение не того типа: ожидается equal to one of the allowed values».
    ['must be equal to one of the allowed values', CODES.VALUE_NOT_ALLOWED, {}],
    ['must be equal to constant', CODES.VALUE_NOT_ALLOWED, {}],
    ['must be >= 1', CODES.OUT_OF_RANGE, { op: '>=', limit: '1' }],
    ['must be <= 10', CODES.OUT_OF_RANGE, { op: '<=', limit: '10' }],
    ['must be > 0', CODES.OUT_OF_RANGE, { op: '>', limit: '0' }],
    // Регулярка мета-схемы становится формой записи: `^\$model\(.+\)$` человеку не подсказывает
    // написать `$model(price)`.
    [
      'must match pattern "^\\$model\\(.+\\)$"',
      CODES.PATTERN_MISMATCH,
      { expected: '$model(...)' },
    ],
    [
      'must match pattern "^\\$html\\([a-zA-Z][a-zA-Z0-9]*\\)$"',
      CODES.PATTERN_MISMATCH,
      { expected: '$html(...)' },
    ],
    ['must match pattern "^\\$part\\(.+\\)$"', CODES.PATTERN_MISMATCH, { expected: '$part(...)' }],
    ['must match pattern "^[0-9a-z]{8}$"', CODES.PATTERN_MISMATCH, { expected: '$nodeId' }],
    // Неузнанная регулярка отдаётся как есть: она хотя бы точна.
    ['must match pattern "^\\d+$"', CODES.PATTERN_MISMATCH, { expected: '^\\d+$' }],
    [
      'array node "initialValue" is missing element keys [type, price] required by the item template',
      CODES.ARRAY_INITIAL_VALUE_INCOMPLETE,
      { keys: 'type, price' },
    ],
  ];

  for (const [message, code, params] of cases) {
    it(`«${message.slice(0, 40)}…» → ${code}`, () => {
      expect(translateMessage(message)).toEqual({ code, params });
    });
  }

  it('«у массива нет initialValue» своего кода больше не имеет: формат 2 этой фразы не рождает', () => {
    // Шаблон нового элемента в формате 2 живёт в модели, и о пропущенном `initialValue` проверка
    // молчит; документ прежнего формата до неё не доходит — он переводится раньше. Образец и код
    // убраны вместе с фразой, а дойди она всё же (чужой пакет вправе её вернуть) — находка
    // не теряется, как и любая неузнанная.
    const message =
      'array node is missing "initialValue" — the "Add" button would create an empty element';

    expect(translateMessage(message)).toEqual({ code: CODES.INVALID, params: { message } });
  });

  it('счётные проверки остаются общим кодом: единица счёта у ajv внутри фразы', () => {
    // Осознанная граница, а не промах образца: `… more than 2 items` без склонения перевести
    // нечем, а шесть кодов на «сторона × единица» не окупились бы восемью местами в каталоге.
    expect(translateMessage('must NOT have more than 2 items').code).toBe(CODES.INVALID);
    expect(translateMessage('must NOT have fewer than 5 characters').code).toBe(CODES.INVALID);
  });

  it('неузнанная фраза не теряется: общий код и текст в параметрах', () => {
    // Граница перевода: проверки живут в чужом пакете, и новое сообщение там не должно
    // приводить к ПОТЕРЕ находки — только к потере самопочинки по ней.
    expect(translateMessage('something entirely new happened')).toEqual({
      code: CODES.INVALID,
      params: { message: 'something entirely new happened' },
    });
  });
});

describe('разбор текста даёт диапазон, а не догадку', () => {
  it('позиция из сообщения движка становится полуинтервалом на один символ', () => {
    const text = '{\n  "root": {,}\n}';

    const outcome = parseJson(text);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ожидался отказ разбора');
    expect(outcome.range.end - outcome.range.start).toBe(1);
    expect(text[outcome.range.start]).toBe(',');
  });

  it('без позиции подчёркивается весь текст: наугад — хуже', () => {
    // Пустой текст: движок сообщает про неожиданный конец ввода без позиции в старых версиях,
    // а в новых — с позицией 0; оба ответа обязаны остаться внутри текста.
    const outcome = parseJson('');

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ожидался отказ разбора');
    expect(outcome.range.start).toBe(0);
    expect(outcome.range.end).toBe(0);
  });

  it('разобравшийся текст отдаёт значение', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });
});

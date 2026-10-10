/**
 * Формат сообщений ядра (`src/i18n/message-format.ts`) — подмножество ICU без зависимостей:
 * множественные формы по `Intl.PluralRules` языка, подстановка без повторного разбора, `select`,
 * экранирование апострофом, маркер пропущенного аргумента и отказ разбора на синтаксической ошибке.
 * Сверка с `intl-messageformat` — в `message-format.differential.test.ts` и
 * `message-format.property.test.ts`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  createMessageFormatter,
  formatPattern,
  MessageSyntaxError,
  parseMessage,
  type MessagePattern,
  type MessageValues,
} from '../../src/i18n/message-format';

const ru = createMessageFormatter('ru');
const en = createMessageFormatter('en');

const FILES_RU = '{count, plural, one{# файл} few{# файла} many{# файлов} other{# файла}}';
const FILES_EN = '{count, plural, one{# file} other{# files}}';

describe('множественные формы — русский (one/few/many/other)', () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [0, '0 файлов'],
    [1, '1 файл'],
    [2, '2 файла'],
    [5, '5 файлов'],
    [11, '11 файлов'],
    [21, '21 файл'],
    [101, '101 файл'],
  ];
  for (const [count, expected] of cases) {
    it(`${count} → ${expected}`, () => {
      assert.equal(ru(FILES_RU, { count }), expected);
    });
  }
});

describe('множественные формы — английский (one/other)', () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [0, '0 files'],
    [1, '1 file'],
    [2, '2 files'],
    [5, '5 files'],
    [11, '11 files'],
    [21, '21 files'],
    [101, '101 files'],
  ];
  for (const [count, expected] of cases) {
    it(`${count} → ${expected}`, () => {
      assert.equal(en(FILES_EN, { count }), expected);
    });
  }
});

describe('категории не захардкожены под локаль', () => {
  it('одно и то же сообщение в ru и en даёт разные формы', () => {
    const message = '{count, plural, one{ONE} few{FEW} many{MANY} other{OTHER}}';
    assert.equal(ru(message, { count: 2 }), 'FEW');
    assert.equal(en(message, { count: 2 }), 'OTHER');
    assert.equal(ru(message, { count: 5 }), 'MANY');
    assert.equal(en(message, { count: 1 }), 'ONE');
  });

  it('русское сообщение, отформатированное как en, откатывается на other, а не падает', () => {
    assert.equal(en(FILES_RU, { count: 5 }), '5 файла');
  });

  it('# форматируется через Intl.NumberFormat активной локали', () => {
    assert.equal(ru(FILES_RU, { count: 1234 }), '1 234 файла');
    assert.equal(en(FILES_EN, { count: 1234 }), '1,234 files');
  });

  it('точная ветка =N выигрывает у категории', () => {
    const message =
      '{count, plural, =0{файлов нет} one{# файл} few{# файла} many{# файлов} other{# файла}}';
    assert.equal(ru(message, { count: 0 }), 'файлов нет');
    assert.equal(ru(message, { count: 1 }), '1 файл');
  });
});

describe('подстановка', () => {
  it('подставляет значение', () => {
    assert.equal(ru('Открыт файл {name}', { name: 'form.ts' }), 'Открыт файл form.ts');
  });

  it('подставляет один аргумент несколько раз', () => {
    assert.equal(ru('{a} и ещё раз {a}', { a: 'X' }), 'X и ещё раз X');
  });

  it('значение подставляется как текст и повторно НЕ разбирается', () => {
    const injected = '{count, plural, other{ВЗЛОМ}}';
    assert.equal(ru('Файл {name}', { name: injected }), `Файл ${injected}`);
  });

  it('нестроковые значения приводятся через String', () => {
    assert.equal(ru('{n}/{b}', { n: 42, b: true }), '42/true');
  });

  it('число вне plural не форматируется по локали — как и в intl-messageformat', () => {
    assert.equal(ru('{year} год', { year: 2026 }), '2026 год');
    assert.equal(ru('{n}', { n: 1234567 }), '1234567');
  });

  it('пробелы вокруг имени аргумента допустимы', () => {
    assert.equal(ru('Привет, {  name  }!', { name: 'мир' }), 'Привет, мир!');
  });
});

describe('вложенность', () => {
  it('подстановка внутри ветки plural', () => {
    const message =
      '{count, plural, one{# файл в {dir}} few{# файла в {dir}} many{# файлов в {dir}} other{# файла в {dir}}}';
    assert.equal(ru(message, { count: 1, dir: 'src' }), '1 файл в src');
    assert.equal(ru(message, { count: 3, dir: 'src' }), '3 файла в src');
    assert.equal(ru(message, { count: 7, dir: 'src' }), '7 файлов в src');
  });

  // «#» здесь — в ветке plural после select, а не внутри него.
  it('select внутри plural, и # в ветке plural после него — число этого plural', () => {
    const message =
      '{count, plural, one{{gender, select, female{удалила} other{удалил}} # файл} other{{gender, select, female{удалила} other{удалил}} # файлов}}';
    assert.equal(ru(message, { count: 1, gender: 'female' }), 'удалила 1 файл');
    assert.equal(ru(message, { count: 5, gender: 'male' }), 'удалил 5 файлов');
  });

  it('plural внутри plural перепривязывает #', () => {
    const message = '{a, plural, other{#: {b, plural, other{#}}}}';
    assert.equal(ru(message, { a: 2, b: 9 }), '2: 9');
  });

  it('# внутри select, вложенного в plural, — литерал, как в ICU [ReFormer-6bit]', () => {
    const message = '{n, plural, other{# из {g, select, other{# шт.}}}}';
    assert.equal(ru(message, { n: 3, g: 'x' }), '3 из # шт.');
  });
});

describe('выбор по значению (select)', () => {
  it('выбирает ветку по значению', () => {
    const message = '{gender, select, male{он} female{она} other{оно}}';
    assert.equal(ru(message, { gender: 'male' }), 'он');
    assert.equal(ru(message, { gender: 'female' }), 'она');
    assert.equal(ru(message, { gender: 'robot' }), 'оно');
  });

  it('неизвестное значение откатывается на other', () => {
    assert.equal(
      ru('{status, select, ok{готово} other{неизвестно}}', { status: 'wat' }),
      'неизвестно'
    );
  });

  it('нестроковое значение приводится через String', () => {
    assert.equal(ru('{n, select, 1{один} other{много}}', { n: 1 }), 'один');
  });
});

describe('экранирование', () => {
  it("'{' и '}' дают литеральные скобки", () => {
    assert.equal(ru("Ключ '{'name'}' не найден"), 'Ключ {name} не найден');
  });

  it("'' даёт литеральный апостроф", () => {
    assert.equal(en("it''s fine"), "it's fine");
  });

  it('одиночный апостроф перед обычным текстом остаётся апострофом', () => {
    assert.equal(en("don't {a}", { a: 'x' }), "don't x");
  });

  it("'#' внутри plural экранирует решётку, а вне plural — нет", () => {
    assert.equal(ru("{count, plural, other{'#' #}}", { count: 3 }), '# 3');
    assert.equal(ru("тег '#' здесь"), "тег '#' здесь");
  });

  it('литеральные скобки внутри ветки plural', () => {
    assert.equal(ru("{count, plural, other{'{'#'}'}}", { count: 3 }), '{3}');
  });
});

describe('отсутствующий аргумент', () => {
  it('подстановка без значения даёт заметный маркер', () => {
    assert.equal(ru('Открыт файл {name}'), 'Открыт файл ⟦name⟧');
  });

  it('plural без значения даёт маркер, а не выбирает ветку наугад', () => {
    assert.equal(ru(FILES_RU), '⟦count⟧');
  });

  it('plural с нечисловым значением даёт маркер', () => {
    assert.equal(ru(FILES_RU, { count: 'пять' as unknown as number }), '⟦count⟧');
    assert.equal(ru(FILES_RU, { count: Number.NaN }), '⟦count⟧');
  });

  it('select без значения даёт маркер', () => {
    assert.equal(ru('{gender, select, other{оно}}'), '⟦gender⟧');
  });

  it('маркер заменяется через onMissingArgument (в сборке — тихий откат)', () => {
    const quiet = createMessageFormatter('ru', { onMissingArgument: () => '' });
    assert.equal(quiet('Открыт файл {name}'), 'Открыт файл ');
  });

  it('значение null считается заданным, undefined — нет', () => {
    assert.equal(ru('{a}', { a: null }), 'null');
    assert.equal(ru('{a}', { a: undefined }), '⟦a⟧');
  });
});

describe('неизвестная категория и отказы разбора', () => {
  it('категория, которой нет в сообщении, откатывается на other', () => {
    assert.equal(ru('{count, plural, one{# файл} other{# файлов}}', { count: 3 }), '3 файлов');
  });

  it('plural без ветки other — ошибка разбора, а не молчаливый промах', () => {
    assert.throws(() => parseMessage('{count, plural, one{# файл}}'), MessageSyntaxError);
  });

  it('select без ветки other — ошибка разбора', () => {
    assert.throws(() => parseMessage('{g, select, male{он}}'), MessageSyntaxError);
  });

  it('неизвестный тип аргумента — ошибка разбора', () => {
    assert.throws(() => parseMessage('{d, date, other{x}}'), MessageSyntaxError);
  });

  it('незакрытая ветка — ошибка разбора', () => {
    assert.throws(() => parseMessage('{count, plural, other{# файл'), MessageSyntaxError);
  });

  it('непарная } — ошибка разбора', () => {
    assert.throws(() => parseMessage('лишняя } скобка'), MessageSyntaxError);
  });

  it('пустое имя аргумента — ошибка разбора', () => {
    assert.throws(() => parseMessage('{}'), MessageSyntaxError);
  });

  it('сообщение об ошибке называет позицию и само сообщение', () => {
    assert.throws(
      () => parseMessage('{count, plural, one{#}}'),
      (error: unknown) => {
        assert.ok(error instanceof MessageSyntaxError);
        assert.match(error.message, /нет обязательной ветки other/);
        assert.match(error.message, /позиция \d+/);
        return true;
      }
    );
  });
});

describe('форма без аргументов', () => {
  it('простой текст проходит насквозь', () => {
    assert.equal(ru('Панель файлов'), 'Панель файлов');
  });

  it('пустая строка', () => {
    assert.equal(ru(''), '');
  });
});

describe('кэш разбора', () => {
  it('повторный вызов не разбирает заново, но даёт тот же результат', () => {
    const format = createMessageFormatter('ru');
    assert.equal(format(FILES_RU, { count: 1 }), '1 файл');
    assert.equal(format(FILES_RU, { count: 5 }), '5 файлов');
  });

  it('formatPattern переиспользует разобранное дерево', () => {
    const pattern = parseMessage(FILES_RU);
    const values: MessageValues = { count: 2 };
    assert.equal(formatPattern(pattern, values, 'ru'), '2 файла');
    assert.equal(formatPattern(pattern, { count: 2 }, 'en'), '2 файла');
  });
});

describe('message-format — апостроф внутри литерала', () => {
  it("'' внутри литерала в кавычках даёт апостроф и литерал не закрывает", () => {
    assert.equal(en("'{a''b}' и далее"), "{a'b} и далее");
  });

  it('три апострофа подряд: пара — апостроф, третий перед обычным текстом — тоже апостроф', () => {
    assert.equal(en("it'''s"), "it''s");
  });

  it('незакрытая кавычка тянется до конца сообщения', () => {
    assert.equal(ru("Ключ '{name"), 'Ключ {name');
    assert.equal(ru("'{'' — апостроф"), "{' — апостроф");
  });

  it('незакрытая кавычка в ветке съедает закрывающие скобки — ошибка разбора', () => {
    assert.throws(
      () => parseMessage("{n, plural, other{'{x}}"),
      (error: unknown) => {
        assert.ok(error instanceof MessageSyntaxError);
        assert.match(error.message, /ветка «other» не закрыта/);
        return true;
      }
    );
  });
});

describe('message-format — синтаксические ошибки разбора', () => {
  const rejects = (source: string, reason: RegExp): void => {
    assert.throws(
      () => parseMessage(source),
      (error: unknown) => {
        assert.ok(error instanceof MessageSyntaxError, String(error));
        assert.equal(error.name, 'MessageSyntaxError');
        assert.match(error.message, reason);
        return true;
      }
    );
  };

  it('после ключа ветки нет «{»', () => {
    rejects('{n, plural, one # файл other{# файлов}}', /ожидалась «\{» после ветки «one»/);
    rejects('{g, select, male}', /ожидалась «\{» после ветки «male»/);
  });

  it('plural не закрыт «}» после последней ветки', () => {
    rejects('{n, plural, other{x}', /«n, plural» не закрыт «\}»/);
    rejects('{g, select, other{x} ', /«g, select» не закрыт «\}»/);
  });

  it('после типа нет запятой', () => {
    rejects('{n, plural other{x}}', /ожидалась «,» после «plural»/);
    rejects('{n, select', /ожидалась «,» после «select»/);
  });

  it('незакрытая вложенность любой глубины — MessageSyntaxError, а не RangeError [ReFormer-9jow]', () => {
    // Разбор рекурсивный: на глубине в несколько тысяч уровней стек кончался раньше, чем
    // разбор доходил до конца строки и замечал, что ничего не закрыто.
    rejects('{a, select, other{'.repeat(20_000), /вложенность аргументов глубже 100 уровней/);
  });

  it('повтор ключа ветки — отказ разбора [ReFormer-d8i3]', () => {
    rejects('{n, plural, one{А} one{Б} other{В}}', /ветка «one» в «n, plural» повторяется/);
    rejects('{g, select, other{А} other{Б}}', /ветка «other» в «g, select» повторяется/);
  });

  it('после «=» у plural — только целое число [ReFormer-d8i3]', () => {
    rejects('{n, plural, =abc{А} other{Б}}', /после «=» ожидалось целое число/);
    rejects('{n, plural, ={А} other{Б}}', /после «=» ожидалось целое число/);
    rejects('{n, plural, =1.5{А} other{Б}}', /ожидалась «\{» после ветки «=1»/);
  });

  it('символ синтаксиса ICU в имени — отказ разбора [ReFormer-eh7o]', () => {
    rejects('{user.name}', /ожидались «,» или «\}» после аргумента «user»/);
    rejects('{g, select, =1{А} other{Б}}', /ожидалось имя/);
  });
});

describe('message-format — апостроф перед угловыми скобками', () => {
  it("'<' и '>' открывают литерал, как в intl-messageformat [ReFormer-l53m]", () => {
    assert.equal(ru("a '<b>' c"), 'a <b> c');
    assert.equal(ru("'<'{name}'>'", { name: 'x' }), '<x>');
  });

  it('угловые скобки без апострофа — обычный текст', () => {
    assert.equal(ru('a <b>{name}</b>', { name: 'x' }), 'a <b>x</b>');
  });
});

describe('message-format — «#» без числа', () => {
  // `#` разбирается только внутри plural, а ветку plural без числа не выбрать — значит,
  // на разобранном сообщении до узла числа без числа не дойти. Дерево — публичный тип:
  // вызывающий собирает его и сам.
  const pound: MessagePattern = [
    { kind: 'text', value: 'всего: ' },
    { kind: 'number', name: 'n' },
  ];

  it('значение не число — маркер пропущенного аргумента', () => {
    assert.equal(formatPattern(pound, { n: 'пять' }, 'ru'), 'всего: ⟦n⟧');
    assert.equal(formatPattern(pound, { n: Number.POSITIVE_INFINITY }, 'ru'), 'всего: ⟦n⟧');
    assert.equal(formatPattern(pound, {}, 'ru'), 'всего: ⟦n⟧');
  });

  it('маркер берётся из onMissingArgument, а число форматируется по языку', () => {
    assert.equal(
      formatPattern(pound, { n: 'пять' }, 'ru', { onMissingArgument: (name) => `?${name}` }),
      'всего: ?n'
    );
    assert.equal(formatPattern(pound, { n: 1234.5 }, 'en'), 'всего: 1,234.5');
  });
});

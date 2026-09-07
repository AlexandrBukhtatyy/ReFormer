import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  createMessageFormatter,
  formatPattern,
  MessageSyntaxError,
  parseMessage,
  type MessageValues,
} from './message-format';

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

  it('select внутри plural, и # внутри select относится к внешнему plural', () => {
    const message =
      '{count, plural, one{{gender, select, female{удалила} other{удалил}} # файл} other{{gender, select, female{удалила} other{удалил}} # файлов}}';
    assert.equal(ru(message, { count: 1, gender: 'female' }), 'удалила 1 файл');
    assert.equal(ru(message, { count: 5, gender: 'male' }), 'удалил 5 файлов');
  });

  it('plural внутри plural перепривязывает #', () => {
    const message = '{a, plural, other{#: {b, plural, other{#}}}}';
    assert.equal(ru(message, { a: 2, b: 9 }), '2: 9');
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

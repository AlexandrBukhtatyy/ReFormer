/**
 * Тексты замечаний валидации: правила несут только код и параметры, словари полны по кодам,
 * порядок источников в `resolveIssueMessage` — словарь формы, локаль, встроенный английский, код.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  email,
  fileType,
  futureDate,
  integer,
  isDate,
  isNumber,
  max,
  maxAge,
  maxDate,
  maxFileSize,
  maxFiles,
  maxLength,
  maxTotalFileSize,
  min,
  minAge,
  minDate,
  minFileSize,
  minFiles,
  minLength,
  multipleOf,
  nonNegative,
  nonZero,
  pastDate,
  pattern,
  phone,
  required,
  url,
} from '../../src/form/validators';
import type { ValidationIssue } from '../../src/form/types/contracts';
import type { RuleOptions } from '../../src/form/types/validation-schema';
import enJson from '../../src/i18n/en.json';
import ruJson from '../../src/i18n/ru.json';
import { DEFAULT_LOCALE, extendLocale } from '../../src/i18n/locale';
import { createI18n } from '../../src/i18n/translator';
import {
  defineIssueMessages,
  resolveIssueMessage,
  type IssueMessages,
} from '../../src/i18n/validation-message';
import { ru as ruLocale } from '../../src/locale/ru';

type AnyRule = (value: unknown, scope: unknown, root: unknown) => ValidationIssue | null;
const run = (rule: unknown, value: unknown): ValidationIssue | null =>
  (rule as AnyRule)(value, undefined, undefined);

const file = (name: string, type: string, size: number) => ({ name, type, size });
const yearsAgo = (years: number): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
};

/** Код ошибки → вызов правила на значении, которое его нарушает. */
const FAILING: ReadonlyArray<
  readonly [code: string, fail: (options?: RuleOptions) => ValidationIssue | null]
> = [
  ['required', (o) => run(required(o), '')],
  ['pattern', (o) => run(pattern(/^\d+$/, o), 'abc')],
  ['email', (o) => run(email(o), 'not-an-email')],
  ['url', (o) => run(url(o), 'not a url')],
  ['url_protocol', (o) => run(url({ ...o, allowedProtocols: ['https', 'ftp'] }), 'http://a.io')],
  ['phone', (o) => run(phone(o), 'abc')],
  ['min', (o) => run(min(5, o), 1)],
  ['max', (o) => run(max(5, o), 10)],
  ['minLength', (o) => run(minLength(8, o), 'abc')],
  ['maxLength', (o) => run(maxLength(2, o), 'abcdef')],
  ['isNumber', (o) => run(isNumber(o), 'abc')],
  ['integer', (o) => run(integer(o), 1.5)],
  ['multipleOf', (o) => run(multipleOf(5, o), 7)],
  ['nonNegative', (o) => run(nonNegative(o), -1)],
  ['nonZero', (o) => run(nonZero(o), 0)],
  ['date_invalid', (o) => run(isDate(o), 'not-a-date')],
  ['date_min', (o) => run(minDate(new Date(2030, 0, 15), o), new Date(2020, 0, 1))],
  ['date_max', (o) => run(maxDate(new Date(2020, 0, 15), o), new Date(2030, 0, 1))],
  ['date_past', (o) => run(futureDate(o), new Date(2000, 0, 1))],
  ['date_future', (o) => run(pastDate(o), new Date(2999, 0, 1))],
  ['date_min_age', (o) => run(minAge(18, o), yearsAgo(5))],
  ['date_max_age', (o) => run(maxAge(60, o), yearsAgo(90))],
  ['fileType', (o) => run(fileType('image/*', o), [file('doc.pdf', 'application/pdf', 10)])],
  [
    'maxFileSize',
    (o) => run(maxFileSize(1024, o), [file('big.png', 'image/png', 5 * 1024 * 1024)]),
  ],
  ['minFileSize', (o) => run(minFileSize(2048, o), [file('tiny.png', 'image/png', 10)])],
  ['maxFiles', (o) => run(maxFiles(1, o), [file('a', '', 1), file('b', '', 1)])],
  ['minFiles', (o) => run(minFiles(2, o), [file('a', '', 1)])],
  [
    'maxTotalFileSize',
    (o) => run(maxTotalFileSize(1024, o), [file('a', '', 800), file('b', '', 800)]),
  ],
];

/** Коды, которые выдаёт отбор файлов в cdk: словарь для них тоже держит ядро. */
const CDK_ONLY_CODES = ['fileExists', 'uploadAborted', 'uploadFailed'];

/** Код раннера схемы: async-правило не вернуло результат (сеть, исключение). */
const RUNNER_CODES = ['ruleFailed'];

const en = createI18n(DEFAULT_LOCALE);
const ru = createI18n(ruLocale);

describe('правила каталога: код и параметры', () => {
  it.each(FAILING)('%s — замечание несёт код и параметры, текста у него нет', (code, fail) => {
    const issue = fail();

    expect(issue, `правило «${code}» не сработало на нарушающем значении`).not.toBeNull();
    expect(issue!.code).toBe(code);
    expect(Object.keys(issue!).sort()).toEqual(
      issue!.params === undefined ? ['code'] : ['code', 'params']
    );
  });

  it.each(FAILING)('%s — свой код и параметры из опций важнее встроенных', (_code, fail) => {
    const issue = fail({ code: 'profile.field', params: { extra: 1 } })!;

    expect(issue.code).toBe('profile.field');
    expect(issue.params).toMatchObject({ extra: 1 });
  });

  it('таблица покрывает каждый код, который есть в исходниках правил', () => {
    const dir = fileURLToPath(new URL('../../src/form/validators', import.meta.url));
    const inSource = new Set<string>();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.ts')) continue;
      const text = readFileSync(`${dir}/${name}`, 'utf8');
      for (const match of text.matchAll(/validationIssue\(\s*'([^']+)'/g)) inSource.add(match[1]!);
    }

    expect([...inSource].sort()).toEqual(FAILING.map(([code]) => code).sort());
    // Прямых сборок замечания в обход помощника не осталось: текста в правилах нет.
    for (const name of readdirSync(dir)) {
      if (name === 'validation-issue.ts' || name.endsWith('.type-test.ts')) continue;
      expect(readFileSync(`${dir}/${name}`, 'utf8'), name).not.toMatch(/\bmessage(Key)?\s*:/);
    }
  });
});

describe('словари ядра: текст есть у каждого кода', () => {
  const codes = [...FAILING.map(([code]) => code), ...CDK_ONLY_CODES, ...RUNNER_CODES];

  it.each(codes)('validation.%s — в en и в ru', (code) => {
    expect(enJson).toHaveProperty([`validation.${code}`]);
    expect(ruJson).toHaveProperty([`validation.${code}`]);
  });

  it('лишних кодов в словаре нет', () => {
    const inDictionary = Object.keys(enJson)
      .filter((key) => key.startsWith('validation.'))
      .map((key) => key.slice('validation.'.length));

    expect(inDictionary.sort()).toEqual([...codes].sort());
  });

  it.each(FAILING)(
    '%s — настоящие параметры правила закрывают все подстановки сообщения',
    (code, fail) => {
      const error = fail()!;

      for (const i18n of [en, ru]) {
        const text = resolveIssueMessage(error, i18n);
        // Незакрытая подстановка выводится как {name}; сам код означал бы промах по словарю.
        expect(text, `${i18n.code}: ${text}`).not.toMatch(/[{}]/);
        expect(text).not.toBe(code);
        expect(text.length).toBeGreaterThan(3);
      }
    }
  );
});

describe('resolveIssueMessage — тексты по языку', () => {
  it('без провайдера — английская фраза вместо кода', () => {
    expect(resolveIssueMessage({ code: 'required' }, en)).toBe('This field is required');
    expect(resolveIssueMessage({ code: 'minLength', params: { minLength: 8 } }, en)).toBe(
      'Enter at least 8 characters'
    );
    expect(resolveIssueMessage({ code: 'minLength', params: { minLength: 1 } }, en)).toBe(
      'Enter at least 1 character'
    );
  });

  it('в русской локали — русский текст с множественным числом', () => {
    const text = (minLength: number) =>
      resolveIssueMessage({ code: 'minLength', params: { minLength } }, ru);

    expect(resolveIssueMessage({ code: 'required' }, ru)).toBe('Обязательное поле');
    expect(text(1)).toBe('Не меньше 1 символа');
    expect(text(3)).toBe('Не меньше 3 символов');
    expect(text(8)).toBe('Не меньше 8 символов');
    expect(text(21)).toBe('Не меньше 21 символа');
  });

  it('дата в параметрах форматируется по языку', () => {
    const error: ValidationIssue = {
      code: 'date_min',
      params: { minDate: new Date(2030, 0, 15) as never },
    };

    expect(resolveIssueMessage(error, en)).toBe('The date must not be earlier than Jan 15, 2030');
    expect(resolveIssueMessage(error, ru)).toBe('Дата не раньше 15 янв. 2030 г.');
  });

  it('размер в байтах идёт строкой с единицей языка', () => {
    const error: ValidationIssue = {
      code: 'maxFileSize',
      params: { maxFileSize: 1536 * 1024, fileName: 'big.png', actualSize: 5 * 1024 * 1024 },
    };

    expect(resolveIssueMessage(error, en)).toBe('File big.png is larger than 1.5 MB');
    expect(resolveIssueMessage(error, ru)).toBe('Файл big.png больше 1,5 МБ');
  });

  it('массив в параметрах идёт перечнем', () => {
    const error: ValidationIssue = {
      code: 'url_protocol',
      params: { allowedProtocols: ['https', 'ftp'] as never },
    };

    expect(resolveIssueMessage(error, en)).toBe(
      'The URL must use one of these protocols: https, ftp'
    );
  });

  it('число остаётся числом — множественные формы работают', () => {
    const files = (maxFiles: number) =>
      resolveIssueMessage({ code: 'maxFiles', params: { maxFiles } }, ru);

    expect(files(1)).toBe('Не больше 1 файла');
    expect(files(5)).toBe('Не больше 5 файлов');
  });
});

describe('resolveIssueMessage — порядок источников', () => {
  const appRu = createI18n(
    extendLocale(ruLocale, {
      messages: {
        'validation.username-taken': 'Имя «{name}» уже занято',
        'validation.profile.name.required': 'Как вас зовут?',
      },
    })
  );
  const formMessages = defineIssueMessages({
    'phone.required': 'Укажите телефон',
    'pin.minLength': 'В коде {minLength, plural, one{# цифра} few{# цифры} other{# цифр}}',
    'loanAmount.min': (params, i18n) => `Минимум ${i18n.number(Number(params.min))} ₽`,
    required: 'Заполните поле формы',
    broken: 'Незакрытая {скобка',
  });

  it('словарь формы важнее словаря локали и встроенного текста', () => {
    expect(resolveIssueMessage({ code: 'phone.required' }, ru, formMessages)).toBe(
      'Укажите телефон'
    );
    // Встроенный код тоже переопределяется записью словаря формы.
    expect(resolveIssueMessage({ code: 'required' }, ru, formMessages)).toBe(
      'Заполните поле формы'
    );
    expect(resolveIssueMessage({ code: 'required' }, appRu, formMessages)).toBe(
      'Заполните поле формы'
    );
  });

  it('шаблон словаря формы получает параметры замечания и множественное число языка', () => {
    const text = (minLength: number) =>
      resolveIssueMessage({ code: 'pin.minLength', params: { minLength } }, ru, formMessages);

    expect(text(1)).toBe('В коде 1 цифра');
    expect(text(4)).toBe('В коде 4 цифры');
    expect(text(6)).toBe('В коде 6 цифр');
  });

  it('функция словаря формы получает сырые параметры и ручку локали', () => {
    const issue: ValidationIssue = { code: 'loanAmount.min', params: { min: 50000 } };

    expect(resolveIssueMessage(issue, ru, formMessages)).toBe(`Минимум ${ru.number(50000)} ₽`);
    expect(resolveIssueMessage(issue, en, formMessages)).toBe('Минимум 50,000 ₽');
  });

  it('функция словаря формы работает и без параметров у замечания', () => {
    const messages = defineIssueMessages({
      custom: (params) => `ключей: ${Object.keys(params).length}`,
    });

    expect(resolveIssueMessage({ code: 'custom' }, ru, messages)).toBe('ключей: 0');
  });

  it('кода нет в словаре формы — текст даёт локаль', () => {
    expect(resolveIssueMessage({ code: 'email' }, ru, formMessages)).toBe(
      'Введите корректный email'
    );
    expect(resolveIssueMessage({ code: 'profile.name.required' }, appRu, formMessages)).toBe(
      'Как вас зовут?'
    );
  });

  it('битый шаблон словаря формы не прячет замечание: дальше идёт локаль и код', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(resolveIssueMessage({ code: 'broken' }, ru, formMessages)).toBe('broken');
    quiet.mockRestore();
  });

  it('ключи прототипа объекта записями словаря формы не считаются', () => {
    expect(resolveIssueMessage({ code: 'toString' }, ru, formMessages)).toBe('toString');
    expect(resolveIssueMessage({ code: 'constructor' }, ru, {})).toBe('constructor');
  });

  it('свой код локализуется ключом validation.<код> в словаре приложения', () => {
    expect(resolveIssueMessage({ code: 'username-taken', params: { name: 'neo' } }, appRu)).toBe(
      'Имя «neo» уже занято'
    );
  });

  it('свой код без словарей — сам код', () => {
    expect(resolveIssueMessage({ code: 'username-taken' }, en)).toBe('username-taken');
    expect(resolveIssueMessage({ code: 'custom' }, ru, formMessages)).toBe('custom');
  });

  it('словарь приложения переопределяет встроенный текст ядра', () => {
    const custom = createI18n(
      extendLocale(ruLocale, { messages: { 'validation.required': 'Заполните поле' } })
    );

    expect(resolveIssueMessage({ code: 'required' }, custom)).toBe('Заполните поле');
  });

  it('язык без своего словаря — встроенный английский', () => {
    const de = createI18n({ code: 'de', messages: {} });

    expect(resolveIssueMessage({ code: 'required' }, de)).toBe('This field is required');
  });
});

describe('defineIssueMessages', () => {
  it('возвращает тот же объект: словарь остаётся стабильной ссылкой', () => {
    const source = { 'a.required': 'Нужно' } as const;

    expect(defineIssueMessages(source)).toBe(source);
  });
});

describe('validation-message — перечень без Intl.ListFormat', () => {
  const protocols: ValidationIssue = {
    code: 'url_protocol',
    params: { allowedProtocols: ['https', 'ftp', 'sftp'] as never },
  };
  const EXPECTED = 'The URL must use one of these protocols: https, ftp, sftp';

  it('Intl.ListFormat не понимает код языка — перечень соединяется запятыми', () => {
    // Код не BCP 47: `new Intl.ListFormat` бросает RangeError. Текст сообщения — встроенный
    // английский: он форматируется по `en` и с кодом локали не сталкивается.
    const broken = createI18n({ code: 'not a locale', messages: {} });

    expect(() => new Intl.ListFormat('not a locale')).toThrow(RangeError);
    expect(resolveIssueMessage(protocols, broken)).toBe(EXPECTED);
    // Отказ запомнен для кода — второй вызов идёт тем же путём.
    expect(resolveIssueMessage(protocols, broken)).toBe(EXPECTED);
  });

  it('с тем же кодом дата в параметрах бросает RangeError', () => {
    // поведение под вопросом [ReFormer-drum]: от некорректного кода защищён только перечень, а дата, размер
    // файла, `plural`, `number` и `date` ручки по такому коду бросают. Код может прийти извне —
    // загрузчик оставляет локали запрошенный код (`setLang` из адресной строки).
    const broken = createI18n({ code: 'not a locale', messages: {} });
    const issue: ValidationIssue = {
      code: 'date_min',
      params: { minDate: new Date(2030, 0, 1) as never },
    };

    expect(() => resolveIssueMessage(issue, broken)).toThrow(RangeError);
  });

  it('в рантайме без Intl.ListFormat — то же соединение запятыми', () => {
    const intl = Intl as { ListFormat?: unknown };
    const original = intl.ListFormat;
    intl.ListFormat = undefined;
    try {
      // Свой код языка: удачно созданный форматтер кэшируется по коду на весь модуль.
      expect(resolveIssueMessage(protocols, createI18n({ code: 'kk', messages: {} }))).toBe(
        EXPECTED
      );
    } finally {
      intl.ListFormat = original;
    }
  });
});

describe('validation-message — запись словаря формы не строка и не функция', () => {
  it('замечание не теряется: текст даёт локаль, без диагностики', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Словарь формы пришёл JSON-ом с числом вместо шаблона.
    const fromJson = JSON.parse('{ "required": 42 }') as IssueMessages;

    expect(resolveIssueMessage({ code: 'required' }, ru, fromJson)).toBe('Обязательное поле');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

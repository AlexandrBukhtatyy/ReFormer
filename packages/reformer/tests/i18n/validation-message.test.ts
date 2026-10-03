/**
 * Тексты ошибок валидации: умолчание `message` у правил, полнота словарей по кодам и порядок
 * источников в `resolveValidationError`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
import type { ValidationError } from '../../src/form/types/contracts';
import type { ValidateOptions } from '../../src/form/types/validation-schema';
import enJson from '../../src/i18n/en.json';
import ruJson from '../../src/i18n/ru.json';
import { DEFAULT_LOCALE, extendLocale } from '../../src/i18n/locale';
import { createI18n } from '../../src/i18n/translator';
import { resolveValidationError } from '../../src/i18n/validation-message';
import { ru as ruLocale } from '../../src/locale/ru';

type AnyRule = (value: unknown, scope: unknown, root: unknown) => ValidationError | null;
const run = (rule: unknown, value: unknown): ValidationError | null =>
  (rule as AnyRule)(value, undefined, undefined);

const file = (name: string, type: string, size: number) => ({ name, type, size });
const yearsAgo = (years: number): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
};

/** Код ошибки → вызов правила на значении, которое его нарушает. */
const FAILING: ReadonlyArray<
  readonly [code: string, fail: (options?: ValidateOptions) => ValidationError | null]
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

const en = createI18n(DEFAULT_LOCALE);
const ru = createI18n(ruLocale);

describe('правила каталога: умолчание сообщения', () => {
  it.each(FAILING)('%s — без options.message кладёт пустую строку', (code, fail) => {
    const error = fail();

    expect(error, `правило «${code}» не сработало на нарушающем значении`).not.toBeNull();
    expect(error!.code).toBe(code);
    expect(error!.message).toBe('');
    expect(error!.messageKey).toBeUndefined();
  });

  it.each(FAILING)('%s — переносит message, messageKey и params из опций', (_code, fail) => {
    const error = fail({ message: 'Своё', messageKey: 'app.rule', params: { extra: 1 } })!;

    expect(error.message).toBe('Своё');
    expect(error.messageKey).toBe('app.rule');
    expect(error.params).toMatchObject({ extra: 1 });
  });

  it('таблица покрывает каждый код, который есть в исходниках правил', () => {
    const dir = fileURLToPath(new URL('../../src/form/validators', import.meta.url));
    const inSource = new Set<string>();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.ts')) continue;
      const text = readFileSync(`${dir}/${name}`, 'utf8');
      for (const match of text.matchAll(/validationError\(\s*'([^']+)'/g)) inSource.add(match[1]!);
    }

    expect([...inSource].sort()).toEqual(FAILING.map(([code]) => code).sort());
    // Прямых сборок ошибки в обход помощника не осталось.
    for (const name of readdirSync(dir)) {
      if (name === 'validation-error.ts') continue;
      expect(readFileSync(`${dir}/${name}`, 'utf8'), name).not.toMatch(
        /message: options\?\.message/
      );
    }
  });
});

describe('словари ядра: текст есть у каждого кода', () => {
  const codes = [...FAILING.map(([code]) => code), ...CDK_ONLY_CODES];

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
        const text = resolveValidationError(error, i18n);
        // Незакрытая подстановка выводится как {name}; сам код означал бы промах по словарю.
        expect(text, `${i18n.code}: ${text}`).not.toMatch(/[{}]/);
        expect(text).not.toBe(code);
        expect(text.length).toBeGreaterThan(3);
      }
    }
  );
});

describe('resolveValidationError — тексты по языку', () => {
  it('без провайдера — английская фраза вместо кода или «invalid»', () => {
    expect(resolveValidationError({ code: 'required', message: '' }, en)).toBe(
      'This field is required'
    );
    expect(
      resolveValidationError({ code: 'minLength', message: '', params: { minLength: 8 } }, en)
    ).toBe('Enter at least 8 characters');
    expect(
      resolveValidationError({ code: 'minLength', message: '', params: { minLength: 1 } }, en)
    ).toBe('Enter at least 1 character');
  });

  it('в русской локали — русский текст с множественным числом', () => {
    const text = (minLength: number) =>
      resolveValidationError({ code: 'minLength', message: '', params: { minLength } }, ru);

    expect(resolveValidationError({ code: 'required', message: '' }, ru)).toBe('Обязательное поле');
    expect(text(1)).toBe('Не меньше 1 символа');
    expect(text(3)).toBe('Не меньше 3 символов');
    expect(text(8)).toBe('Не меньше 8 символов');
    expect(text(21)).toBe('Не меньше 21 символа');
  });

  it('дата в параметрах форматируется по языку', () => {
    const error: ValidationError = {
      code: 'date_min',
      message: '',
      params: { minDate: new Date(2030, 0, 15) as never },
    };

    expect(resolveValidationError(error, en)).toBe(
      'The date must not be earlier than Jan 15, 2030'
    );
    expect(resolveValidationError(error, ru)).toBe('Дата не раньше 15 янв. 2030 г.');
  });

  it('размер в байтах идёт строкой с единицей языка', () => {
    const error: ValidationError = {
      code: 'maxFileSize',
      message: '',
      params: { maxFileSize: 1536 * 1024, fileName: 'big.png', actualSize: 5 * 1024 * 1024 },
    };

    expect(resolveValidationError(error, en)).toBe('File big.png is larger than 1.5 MB');
    expect(resolveValidationError(error, ru)).toBe('Файл big.png больше 1,5 МБ');
  });

  it('массив в параметрах идёт перечнем', () => {
    const error: ValidationError = {
      code: 'url_protocol',
      message: '',
      params: { allowedProtocols: ['https', 'ftp'] as never },
    };

    expect(resolveValidationError(error, en)).toBe(
      'The URL must use one of these protocols: https, ftp'
    );
  });

  it('число остаётся числом — множественные формы работают', () => {
    const files = (maxFiles: number) =>
      resolveValidationError({ code: 'maxFiles', message: '', params: { maxFiles } }, ru);

    expect(files(1)).toBe('Не больше 1 файла');
    expect(files(5)).toBe('Не больше 5 файлов');
  });
});

describe('resolveValidationError — порядок источников', () => {
  const appRu = createI18n(
    extendLocale(ruLocale, {
      messages: {
        'profile.name.required': 'Как вас зовут?',
        'profile.pin.short': 'В коде {minLength, plural, one{# цифра} few{# цифры} other{# цифр}}',
        'validation.username-taken': 'Имя «{name}» уже занято',
      },
    })
  );

  it('явное сообщение автора важнее словаря', () => {
    expect(resolveValidationError({ code: 'required', message: 'Укажите телефон' }, ru)).toBe(
      'Укажите телефон'
    );
  });

  it('messageKey из локали важнее и явного сообщения, и текста по коду', () => {
    expect(
      resolveValidationError(
        { code: 'required', message: 'Name is required', messageKey: 'profile.name.required' },
        appRu
      )
    ).toBe('Как вас зовут?');
  });

  it('messageKey получает параметры ошибки', () => {
    expect(
      resolveValidationError(
        {
          code: 'minLength',
          message: '',
          messageKey: 'profile.pin.short',
          params: { minLength: 4 },
        },
        appRu
      )
    ).toBe('В коде 4 цифры');
  });

  it('messageKey, которого нет в локали: в ход идёт message, а без него — текст по коду', () => {
    expect(
      resolveValidationError(
        { code: 'required', message: 'Name is required', messageKey: 'profile.name.required' },
        en
      )
    ).toBe('Name is required');
    expect(
      resolveValidationError({ code: 'required', message: '', messageKey: 'nope.key' }, ru)
    ).toBe('Обязательное поле');
  });

  it('свой код локализуется ключом validation.<код> в словаре приложения', () => {
    expect(
      resolveValidationError(
        { code: 'username-taken', message: '', params: { name: 'neo' } },
        appRu
      )
    ).toBe('Имя «neo» уже занято');
  });

  it('свой код без словаря и без сообщения — сам код', () => {
    expect(resolveValidationError({ code: 'username-taken', message: '' }, en)).toBe(
      'username-taken'
    );
  });

  it('свой код с готовым сообщением — сообщение', () => {
    expect(resolveValidationError({ code: 'username-taken', message: 'Имя занято' }, en)).toBe(
      'Имя занято'
    );
  });

  it('прежнее умолчание «invalid» считается пустым сообщением', () => {
    expect(resolveValidationError({ code: 'email', message: 'invalid' }, ru)).toBe(
      'Введите корректный email'
    );
    // Для неизвестного кода откат — на код, а не на «invalid».
    expect(resolveValidationError({ code: 'custom', message: 'invalid' }, ru)).toBe('custom');
  });

  it('ошибка без поля message (чужое правило на JS) не ломает резолвер', () => {
    const bare = { code: 'required' } as unknown as ValidationError;

    expect(resolveValidationError(bare, ru)).toBe('Обязательное поле');
    expect(resolveValidationError({ code: 'custom' } as unknown as ValidationError, ru)).toBe(
      'custom'
    );
  });

  it('словарь приложения переопределяет встроенный текст ядра', () => {
    const custom = createI18n(
      extendLocale(ruLocale, { messages: { 'validation.required': 'Заполните поле' } })
    );

    expect(resolveValidationError({ code: 'required', message: '' }, custom)).toBe(
      'Заполните поле'
    );
  });

  it('язык без своего словаря ошибок — встроенный английский', () => {
    const de = createI18n({ code: 'de', messages: {} });

    expect(resolveValidationError({ code: 'required', message: '' }, de)).toBe(
      'This field is required'
    );
  });
});

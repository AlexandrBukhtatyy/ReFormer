/**
 * Локаль как данные (`src/i18n/locale.ts`): слияние локалей, имена подстановок сообщения и проверка
 * словаря `validateLocale` — разбор каждого сообщения и сверка ключей и подстановок с образцом.
 * Проверка нужна словарям, которые пришли по сети или написаны вне репозитория, поэтому здесь же —
 * что она видит в нестроковых значениях и в битом образце.
 */
import { describe, expect, it } from 'vitest';
import enJson from '../../src/i18n/en.json';
import ruJson from '../../src/i18n/ru.json';
import {
  DEFAULT_LOCALE,
  extendLocale,
  messageArguments,
  validateLocale,
  type FormLocale,
  type Messages,
} from '../../src/i18n/locale';
import { parseMessage } from '../../src/i18n/message-format';
import { en } from '../../src/locale/en';
import { ru } from '../../src/locale/ru';

describe('extendLocale', () => {
  const base: FormLocale = {
    code: 'ru',
    weekStartsOn: 1,
    messages: { 'kit.a': 'А', 'kit.b': 'Б' },
  };

  it('сливает словари: ключи из patch важнее, остальные сохраняются', () => {
    const next = extendLocale(base, { messages: { 'kit.b': 'Б*', 'app.c': 'В' } });

    expect(next.messages).toEqual({ 'kit.a': 'А', 'kit.b': 'Б*', 'app.c': 'В' });
    expect(next.code).toBe('ru');
    expect(next.weekStartsOn).toBe(1);
  });

  it('остальные поля заменяет, исходную локаль не трогает', () => {
    const next = extendLocale(base, { weekStartsOn: 0, dateFormat: 'dd.MM.yyyy' });

    expect(next.weekStartsOn).toBe(0);
    expect(next.dateFormat).toBe('dd.MM.yyyy');
    // Словарь не передан — остаётся та же ссылка: кэш разбора сообщений не теряется.
    expect(next.messages).toBe(base.messages);
    expect(base).toEqual({ code: 'ru', weekStartsOn: 1, messages: { 'kit.a': 'А', 'kit.b': 'Б' } });
  });
});

describe('DEFAULT_LOCALE', () => {
  it('английский с пустым словарём — «провайдера нет»', () => {
    expect(DEFAULT_LOCALE).toEqual({ code: 'en', messages: {} });
  });
});

describe('messageArguments', () => {
  it('собирает имена, включая встречающиеся только внутри веток', () => {
    const pattern = parseMessage(
      '{count, plural, one{# файл в {dir}} other{{kind, select, a{{name}} other{—}}}}'
    );
    expect([...messageArguments(pattern)].sort()).toEqual(['count', 'dir', 'kind', 'name']);
  });
});

describe('validateLocale', () => {
  it('чистый словарь — без замечаний', () => {
    expect(validateLocale({ a: 'Привет, {name}' }, { a: 'Hello, {name}' })).toEqual([]);
  });

  it('без образца проверяет только разбор', () => {
    const issues = validateLocale({ ok: 'текст', bad: '{count, plural, one{#}}' });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ key: 'bad', kind: 'syntax' });
    expect(issues[0]!.message).toMatch(/other/);
  });

  it('с образцом находит пропущенные и лишние ключи', () => {
    const issues = validateLocale({ a: 'А', extra: 'лишний' }, { a: 'A', b: 'B' });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'extra', kind: 'extra' }),
        expect.objectContaining({ key: 'b', kind: 'missing' }),
      ])
    );
    expect(issues).toHaveLength(2);
  });

  it('с образцом находит потерянную подстановку', () => {
    const issues = validateLocale({ a: 'Выбрано много' }, { a: 'Selected: {count}' });

    expect(issues).toEqual([expect.objectContaining({ key: 'a', kind: 'arguments' })]);
    expect(issues[0]!.message).toContain('count');
  });

  it('битое сообщение не даёт второго замечания про подстановки', () => {
    const issues = validateLocale({ a: '{count' }, { a: 'Selected: {count}' });

    expect(issues.map((issue) => issue.kind)).toEqual(['syntax']);
  });
});

describe('locale — validateLocale на данных не из репозитория', () => {
  it('подстановки сравниваются как множества имён: порядок и повторы не важны', () => {
    expect(
      validateLocale(
        { a: '{count, plural, one{# из {total}} other{# из {total}}}' },
        { a: '{total}: {count, plural, other{#}}' }
      )
    ).toEqual([]);
  });

  it('значение-не-строка — замечание syntax, как его видит переводчик [ReFormer-4ysq]', () => {
    // Переводчик такое значение отвергает («сообщение не является строкой») и откатывается на
    // встроенный английский, а проверка словаря его пропускала: `parseMessage(42)` — пустое дерево.
    const fromNetwork = JSON.parse('{ "a": 42, "b": null, "c": ["C"] }') as Messages;

    expect(validateLocale(fromNetwork, { a: 'A', b: 'B', c: 'C' })).toEqual(
      ['a', 'b', 'c'].map((key) => ({
        key,
        kind: 'syntax',
        message: 'сообщение не является строкой',
      }))
    );
  });

  it('битое сообщение образца — замечание по ключу, проверка словаря продолжается [ReFormer-drum]', () => {
    const issues = validateLocale(
      { a: 'A', b: 'B {n}', c: 'C' },
      { a: 'Selected: {count', b: 'B', c: 42 as unknown as string }
    );

    expect(issues.map(({ key, kind }) => ({ key, kind }))).toEqual([
      { key: 'a', kind: 'syntax' },
      { key: 'b', kind: 'arguments' },
      { key: 'c', kind: 'syntax' },
    ]);
    expect(issues[0].message).toMatch(/^в образце: /);
    expect(issues[2].message).toBe('в образце: сообщение не является строкой');
  });
});

describe('встроенные локали ядра', () => {
  it('ru переводит ровно те же ключи с теми же подстановками, что en', () => {
    expect(validateLocale(ruJson, enJson)).toEqual([]);
    expect(validateLocale(enJson)).toEqual([]);
  });

  it('синхронные модули несут код языка, первый день недели и словарь', () => {
    expect(en).toEqual({ code: 'en', weekStartsOn: 0, messages: enJson });
    expect(ru).toEqual({ code: 'ru', weekStartsOn: 1, messages: ruJson });
  });
});

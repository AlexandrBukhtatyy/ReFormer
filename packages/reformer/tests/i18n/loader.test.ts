import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bundledLocaleSource,
  createLocaleLoader,
  fetchMessages,
  type LocaleSource,
} from '../../src/i18n/loader';
import type { FormLocale } from '../../src/i18n/locale';
import { CORE_LOCALES, loadCoreLocale } from '../../src/locale/index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createLocaleLoader', () => {
  it('сливает источники по порядку: поздний перекрывает ранний', async () => {
    const kit: LocaleSource = () => ({
      code: 'ru',
      weekStartsOn: 1,
      messages: { 'kit.a': 'кит А', 'kit.b': 'кит Б' },
    });
    const app: LocaleSource = async () => ({ 'kit.b': 'своё Б', 'app.c': 'В' });

    const locale = await createLocaleLoader([kit, app])('ru');

    expect(locale).toEqual({
      code: 'ru',
      weekStartsOn: 1,
      messages: { 'kit.a': 'кит А', 'kit.b': 'своё Б', 'app.c': 'В' },
    });
  });

  it('код языка у результата — запрошенный, а не из файла', async () => {
    const locale = await createLocaleLoader([() => ({ code: 'ru', messages: {} })])('ru-RU');

    expect(locale.code).toBe('ru-RU');
  });

  it('источник без данных для языка (null/undefined) ничего не добавляет', async () => {
    const locale = await createLocaleLoader([() => null, () => undefined, () => ({ a: 'A' })])(
      'de'
    );

    expect(locale).toEqual({ code: 'de', messages: { a: 'A' } });
  });

  it('без источников — пустая локаль запрошенного языка', async () => {
    expect(await createLocaleLoader([])('fr')).toEqual({ code: 'fr', messages: {} });
  });

  it('словарь с ключом «messages»-строкой остаётся словарём', async () => {
    const locale = await createLocaleLoader([
      () => ({ messages: 'Сообщения', title: 'Заголовок' }),
    ])('ru');

    expect(locale.messages).toEqual({ messages: 'Сообщения', title: 'Заголовок' });
  });

  it('кэширует локаль и не дублирует идущий запрос', async () => {
    const source = vi.fn<LocaleSource>(async () => ({ a: 'A' }));
    const load = createLocaleLoader([source]);

    const first = load('ru');
    const second = load('ru');
    expect(second).toBe(first);

    const locale = await first;
    expect(await load('ru')).toBe(locale);
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('peek отдаёт локаль только после загрузки; preload — то же, что вызов', async () => {
    const load = createLocaleLoader([() => ({ a: 'A' })]);

    expect(load.peek('ru')).toBeUndefined();
    const locale = await load.preload('ru');
    expect(load.peek('ru')).toBe(locale);
    expect(load.peek('en')).toBeUndefined();
  });

  it('отказ источника — отказ загрузки, и следующая попытка идёт заново', async () => {
    let fail = true;
    const source = vi.fn<LocaleSource>(async () => {
      if (fail) throw new Error('сеть недоступна');
      return { a: 'A' };
    });
    const load = createLocaleLoader([source]);

    await expect(load('ru')).rejects.toThrow('сеть недоступна');
    expect(load.peek('ru')).toBeUndefined();

    fail = false;
    expect((await load('ru')).messages).toEqual({ a: 'A' });
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('источник, вернувший не объект, — ошибка загрузки', async () => {
    const broken = (() => 'строка') as unknown as LocaleSource;

    await expect(createLocaleLoader([broken])('ru')).rejects.toThrow(TypeError);
    await expect(createLocaleLoader([(() => []) as unknown as LocaleSource])('ru')).rejects.toThrow(
      TypeError
    );
  });
});

describe('fetchMessages', () => {
  const respond = (body: unknown, init: { ok?: boolean; status?: number } = {}) =>
    vi.fn(async () => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    }));

  it('забирает JSON по адресу языка', async () => {
    const fetchMock = respond({ 'profile.title': 'Профиль' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMessages((code) => `/locales/${code}.json`)('ru');

    expect(result).toEqual({ 'profile.title': 'Профиль' });
    expect(fetchMock).toHaveBeenCalledWith('/locales/ru.json', undefined);
  });

  it('передаёт параметры запроса как есть', async () => {
    const fetchMock = respond({});
    vi.stubGlobal('fetch', fetchMock);
    const init = { cache: 'no-store' } as const;

    await fetchMessages(() => '/l.json', init)('ru');

    expect(fetchMock).toHaveBeenCalledWith('/l.json', init);
  });

  it('ответ не 2xx — ошибка с адресом и кодом ответа', async () => {
    vi.stubGlobal('fetch', respond(null, { ok: false, status: 404 }));

    await expect(fetchMessages((code) => `/locales/${code}.json`)('de')).rejects.toThrow(
      /de.*\/locales\/de\.json.*404/
    );
  });

  it('в связке с загрузчиком локаль целиком из файла раскладывается по полям', async () => {
    vi.stubGlobal('fetch', respond({ code: 'ru', weekStartsOn: 1, messages: { 'kit.a': 'А' } }));

    const locale = await createLocaleLoader([fetchMessages(() => '/ru.json')])('ru');

    expect(locale).toEqual({ code: 'ru', weekStartsOn: 1, messages: { 'kit.a': 'А' } });
  });
});

describe('bundledLocaleSource', () => {
  const en: FormLocale = { code: 'en', messages: { a: 'A' } };
  const ru: FormLocale = { code: 'ru', messages: { a: 'А' } };
  const source = bundledLocaleSource({ en: async () => en, ru: async () => ru });

  it('находит язык точно и по основной части кода', async () => {
    expect(await source('ru')).toBe(ru);
    expect(await source('ru-RU')).toBe(ru);
    expect(await source('EN-us')).toBe(en);
  });

  it('неизвестный язык — null, а не ошибка', () => {
    expect(source('de')).toBeNull();
  });

  it('имена из прототипа объекта языками не считаются', () => {
    expect(source('constructor')).toBeNull();
    expect(source('toString')).toBeNull();
  });
});

describe('loadCoreLocale — встроенные локали ядра', () => {
  it('отдаёт локаль каждого поставляемого языка', async () => {
    expect(CORE_LOCALES).toEqual(['en', 'ru']);
    for (const code of CORE_LOCALES) {
      const locale = (await loadCoreLocale(code)) as FormLocale;
      expect(locale.code).toBe(code);
      expect(locale.messages['format.fileSize.kb']).toBeDefined();
    }
  });

  it('в загрузчике: русские единицы размера, для неизвестного языка — пустой словарь', async () => {
    const load = createLocaleLoader([loadCoreLocale]);

    expect((await load('ru')).messages['format.fileSize.kb']).toBe('{value} КБ');
    expect(await load('de')).toEqual({ code: 'de', messages: {} });
  });
});

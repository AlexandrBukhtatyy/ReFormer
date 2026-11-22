/**
 * Встроенные локали ядра — вход `@reformer/core/locale` (`src/locale/index.ts`).
 *
 * `loadCoreLocale` — источник для `createLocaleLoader`: по коду языка отдаёт ленивый чанк его
 * локали (тексты ошибок валидации, единицы размера файла) или `null`, если ядро язык не
 * поставляет. Проверяется, что источник знает ровно языки из `CORE_LOCALES`, узнаёт код с регионом
 * и в другом регистре, не принимает имена прототипа за языки, а в цепочке с сетевым источником
 * (`fetchMessages`, `fetch` подменён) даёт локаль, где словарь сервера дополняет и перекрывает
 * словарь ядра. Загрузчик, сетевой источник и хранилище берутся из публичного входа
 * `@reformer/core/i18n` (`src/i18n.ts`) — так, как их импортирует приложение.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createI18n,
  createLocaleLoader,
  createLocaleStore,
  fetchMessages,
  resolveIssueMessage,
} from '../../src/i18n';
import enJson from '../../src/i18n/en.json';
import ruJson from '../../src/i18n/ru.json';
import { CORE_LOCALES, loadCoreLocale } from '../../src/locale/index';
import { en } from '../../src/locale/en';
import { ru } from '../../src/locale/ru';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Подменённый `fetch`: отвечает телами по очереди, последнее — на все дальнейшие запросы. */
function stubFetch(...responses: ReadonlyArray<{ body: unknown; status?: number }>) {
  let call = 0;
  const fetchMock = vi.fn(async (_address: string, _init?: RequestInit) => {
    const { body, status = 200 } = responses[Math.min(call++, responses.length - 1)]!;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Цепочка из документации: подписи ядра чанком, ключи приложения и правки — с сервера. */
const coreThenServer = () =>
  createLocaleLoader([loadCoreLocale, fetchMessages((code) => `/locales/${code}.json`)]);

describe('locale — CORE_LOCALES', () => {
  it('перечисляет языки, которые ядро поставляет само', () => {
    expect(CORE_LOCALES).toEqual(['en', 'ru']);
  });

  it('у каждого поставляемого языка — полный словарь ядра под своим кодом', async () => {
    for (const code of CORE_LOCALES) {
      const locale = await loadCoreLocale(code);

      expect(locale).toMatchObject({ code });
      expect(Object.keys((locale as { messages: object }).messages).sort()).toEqual(
        Object.keys(enJson).sort()
      );
    }
  });
});

describe('locale — loadCoreLocale', () => {
  it('поставляемый язык — ленивый чанк: промис той же локали, что у синхронного подпути', async () => {
    const pendingRu = loadCoreLocale('ru');
    const pendingEn = loadCoreLocale('en');

    expect(pendingRu).toBeInstanceOf(Promise);
    expect(pendingEn).toBeInstanceOf(Promise);
    // Тот же модуль, что `@reformer/core/locale/ru`, а не копия словаря.
    expect(await pendingRu).toBe(ru);
    expect(await pendingEn).toBe(en);
  });

  it('код с регионом и в другом регистре сводится к основному языку', async () => {
    expect(await loadCoreLocale('ru-RU')).toBe(ru);
    expect(await loadCoreLocale('RU')).toBe(ru);
    expect(await loadCoreLocale('en-US')).toBe(en);
    expect(await loadCoreLocale('EN-gb')).toBe(en);
  });

  it('язык, которого ядро не поставляет, — синхронный null, а не ошибка и не промис', () => {
    // `ru_RU` — не BCP 47 (разделитель — дефис), основной язык из него не выделяется.
    for (const code of ['de', 'pt-BR', '', 'ru_RU']) {
      expect(loadCoreLocale(code), code).toBeNull();
    }
  });

  it('имена из прототипа объекта языками не считаются', () => {
    for (const code of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(loadCoreLocale(code), code).toBeNull();
    }
  });
});

describe('locale — loadCoreLocale в загрузчике', () => {
  it('единственный источник: поставляемый язык — локаль ядра, прочий — пустая локаль', async () => {
    const load = createLocaleLoader([loadCoreLocale]);

    expect(await load('ru')).toEqual(ru);
    expect((await load('ru')).messages['format.fileSize.kb']).toBe('{value} КБ');
    expect(await load('de')).toEqual({ code: 'de', messages: {} });
  });

  it('словарь сервера дополняет и перекрывает словарь ядра; первый день недели — от ядра', async () => {
    const fetchMock = stubFetch({
      body: { 'validation.required': 'Заполните поле', 'app.title': 'Заявка' },
    });

    const locale = await coreThenServer()('ru');

    expect(locale).toEqual({
      code: 'ru',
      weekStartsOn: 1,
      messages: { ...ruJson, 'validation.required': 'Заполните поле', 'app.title': 'Заявка' },
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/locales/ru.json', undefined);
    // Локаль ядра — общий модуль: слияние её не меняет.
    expect(ru.messages['validation.required']).toBe(ruJson['validation.required']);
  });

  it('код с регионом: словарь ядра — по основному языку, файл и код локали — по запрошенному', async () => {
    const fetchMock = stubFetch({ body: { 'app.title': 'Заявка' } });

    const locale = await coreThenServer()('ru-RU');

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/locales/ru-RU.json', undefined);
    expect(locale.code).toBe('ru-RU');
    expect(locale.messages['format.fileSize.kb']).toBe(ruJson['format.fileSize.kb']);
    expect(locale.messages['app.title']).toBe('Заявка');
  });

  it('файл с локалью целиком перекрывает поля ядра, но код остаётся запрошенным', async () => {
    stubFetch({ body: { code: 'by', weekStartsOn: 0, messages: { 'app.title': 'Заявка' } } });

    const locale = await coreThenServer()('ru');

    expect(locale).toEqual({
      code: 'ru',
      weekStartsOn: 0,
      messages: { ...ruJson, 'app.title': 'Заявка' },
    });
  });

  it('язык без чанка ядра: словарь — только с сервера, прочие тексты ядра — встроенный английский', async () => {
    stubFetch({ body: { 'validation.required': 'Pflichtfeld' } });

    const locale = await coreThenServer()('de');
    const i18n = createI18n(locale);

    expect(locale).toEqual({ code: 'de', messages: { 'validation.required': 'Pflichtfeld' } });
    expect(resolveIssueMessage({ code: 'required' }, i18n)).toBe('Pflichtfeld');
    expect(resolveIssueMessage({ code: 'email' }, i18n)).toBe(enJson['validation.email']);
  });

  it('ответ сервера не 2xx — отказ всей загрузки; повтор идёт заново, а удача кэшируется', async () => {
    const fetchMock = stubFetch({ body: null, status: 503 }, { body: { 'app.title': 'Заявка' } });
    const load = coreThenServer();

    await expect(load('ru')).rejects.toThrow(/\/locales\/ru\.json.*503/);
    expect(load.peek('ru')).toBeUndefined();

    const locale = await load('ru');
    expect(locale.messages['app.title']).toBe('Заявка');
    expect(await load('ru')).toBe(locale);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('запрос в сеть уходит сразу, не дожидаясь чанка ядра', async () => {
    const fetchMock = stubFetch({ body: {} });

    const pending = coreThenServer()('ru');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await pending;
  });

  it('хранилище над цепочкой: язык, уже побывавший на экране, возвращается без ожидания', async () => {
    const fetchMock = stubFetch({ body: { 'app.title': 'Заявка' } });
    const load = coreThenServer();
    const store = createLocaleStore(load, 'ru');

    store.setLang('ru');
    await load('ru');
    store.setLang('en');
    await load('en');
    expect(store.getState()).toMatchObject({ lang: 'en', pending: false });

    store.setLang('ru');

    // Без промиса: локаль берётся из кэша загрузчика в том же вызове.
    expect(store.getState()).toEqual({
      lang: 'ru',
      locale: load.peek('ru'),
      pending: false,
      error: undefined,
    });
    expect(store.getState().locale?.messages['app.title']).toBe('Заявка');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

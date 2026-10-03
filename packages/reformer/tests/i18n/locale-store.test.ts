import { describe, expect, it, vi } from 'vitest';
import type { FormLocale } from '../../src/i18n/locale';
import { createLocaleStore, type LocaleLoad } from '../../src/i18n/locale-store';

const locale = (code: string): FormLocale => ({ code, messages: { hello: code } });

/** Загрузчик, чьи ответы тест отпускает вручную — так проверяется порядок прихода. */
function controlledLoad() {
  const pending = new Map<
    string,
    { resolve: (locale: FormLocale) => void; reject: (error: unknown) => void }[]
  >();
  const load = vi.fn((code: string) => {
    return new Promise<FormLocale>((resolve, reject) => {
      const queue = pending.get(code) ?? [];
      queue.push({ resolve, reject });
      pending.set(code, queue);
    });
  });
  const settle = async (code: string, action: 'resolve' | 'reject', error?: unknown) => {
    const request = pending.get(code)?.shift();
    if (request === undefined) throw new Error(`нет запроса за «${code}»`);
    if (action === 'resolve') request.resolve(locale(code));
    else request.reject(error);
    // Дать отработать then-цепочке хранилища.
    await Promise.resolve();
    await Promise.resolve();
  };
  return { load: load as LocaleLoad & typeof load, settle };
}

describe('createLocaleStore', () => {
  it('создание не запускает загрузку: первой локали нет, ждём', () => {
    const { load } = controlledLoad();
    const store = createLocaleStore(load, 'ru');

    expect(store.getState()).toEqual({ lang: 'ru', locale: null, pending: true, error: undefined });
    expect(load).not.toHaveBeenCalled();
  });

  it('локаль из кэша загрузчика применяется синхронно, без ожидания', () => {
    const ru = locale('ru');
    const load = Object.assign(
      vi.fn(async () => ru),
      { peek: (code: string) => (code === 'ru' ? ru : undefined) }
    );
    const store = createLocaleStore(load, 'ru');

    expect(store.getState()).toEqual({ lang: 'ru', locale: ru, pending: false, error: undefined });
    store.setLang('ru');
    expect(load).not.toHaveBeenCalled();
  });

  it('первая загрузка: после ответа локаль на месте', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    const listener = vi.fn();
    store.subscribe(listener);

    store.setLang('ru');
    expect(load).toHaveBeenCalledTimes(1);
    await settle('ru', 'resolve');

    expect(store.getState()).toMatchObject({ lang: 'ru', pending: false, error: undefined });
    expect(store.getState().locale?.code).toBe('ru');
    expect(listener).toHaveBeenCalled();
  });

  it('повторный запрос языка, который уже грузится, не уходит второй раз', () => {
    const { load } = controlledLoad();
    const store = createLocaleStore(load, 'ru');

    store.setLang('ru');
    store.setLang('ru');

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('при переключении прежний язык остаётся на экране, пока новый не пришёл', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    store.setLang('ru');
    await settle('ru', 'resolve');

    store.setLang('en');

    expect(store.getState()).toMatchObject({ lang: 'en', pending: true });
    expect(store.getState().locale?.code).toBe('ru');

    await settle('en', 'resolve');

    expect(store.getState()).toMatchObject({ lang: 'en', pending: false });
    expect(store.getState().locale?.code).toBe('en');
  });

  it('при быстром переключении применяется только последний запрос', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    store.setLang('ru');
    await settle('ru', 'resolve');

    store.setLang('en');
    store.setLang('de');
    // Ответы приходят в обратном порядке: сначала последний, потом устаревший.
    await settle('de', 'resolve');
    await settle('en', 'resolve');

    expect(store.getState()).toMatchObject({ lang: 'de', pending: false });
    expect(store.getState().locale?.code).toBe('de');
  });

  it('устаревший ответ, пришедший раньше нужного, не применяется', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    store.setLang('ru');
    await settle('ru', 'resolve');

    store.setLang('en');
    store.setLang('de');
    await settle('en', 'resolve');

    expect(store.getState()).toMatchObject({ lang: 'de', pending: true });
    expect(store.getState().locale?.code).toBe('ru');
  });

  it('возврат к языку на экране отменяет ожидание и не грузит его заново', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    store.setLang('ru');
    await settle('ru', 'resolve');

    store.setLang('en');
    store.setLang('ru');

    expect(store.getState()).toMatchObject({ lang: 'ru', pending: false });
    expect(load).toHaveBeenCalledTimes(2); // ru и en; второго запроса за ru нет

    await settle('en', 'resolve');
    expect(store.getState().locale?.code).toBe('ru');
  });

  it('ошибка загрузки язык не меняет, попадает в состояние и в onError', async () => {
    const { load, settle } = controlledLoad();
    const onError = vi.fn();
    const store = createLocaleStore(load, 'ru', { onError });
    store.setLang('ru');
    await settle('ru', 'resolve');

    const failure = new Error('404');
    store.setLang('de');
    await settle('de', 'reject', failure);

    expect(store.getState()).toMatchObject({ lang: 'de', pending: false, error: failure });
    expect(store.getState().locale?.code).toBe('ru');
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure, 'de');
  });

  it('ошибка устаревшего запроса не сообщается', async () => {
    const { load, settle } = controlledLoad();
    const onError = vi.fn();
    const store = createLocaleStore(load, 'ru', { onError });
    store.setLang('ru');
    await settle('ru', 'resolve');

    store.setLang('de');
    store.setLang('en');
    await settle('de', 'reject', new Error('404'));

    expect(onError).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ lang: 'en', pending: true, error: undefined });
  });

  it('после ошибки тот же язык можно запросить снова, и удача ошибку сбрасывает', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    store.setLang('ru');
    await settle('ru', 'reject', new Error('сеть'));

    expect(store.getState()).toMatchObject({ locale: null, pending: false });
    expect(store.getState().error).toBeInstanceOf(Error);

    store.setLang('ru');
    expect(store.getState()).toMatchObject({ pending: true, error: undefined });
    await settle('ru', 'resolve');

    expect(store.getState()).toMatchObject({ pending: false, error: undefined });
    expect(store.getState().locale?.code).toBe('ru');
  });

  it('возврат к показанному языку после ошибки ошибку сбрасывает', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    store.setLang('ru');
    await settle('ru', 'resolve');
    store.setLang('de');
    await settle('de', 'reject', new Error('404'));

    store.setLang('ru');

    expect(store.getState()).toMatchObject({ lang: 'ru', pending: false, error: undefined });
  });

  it('локаль с кодом, отличным от запрошенного, не перезагружается', async () => {
    // Свой загрузчик вправе ответить «ru» на запрос «ru-RU».
    const load = vi.fn(async () => locale('ru'));
    const store = createLocaleStore(load, 'ru-RU');

    store.setLang('ru-RU');
    await Promise.resolve();
    await Promise.resolve();
    store.setLang('ru-RU');

    expect(load).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ lang: 'ru-RU', pending: false });
  });

  it('отписка прекращает уведомления', async () => {
    const { load, settle } = controlledLoad();
    const store = createLocaleStore(load, 'ru');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.setLang('ru');
    await settle('ru', 'resolve');

    expect(listener).not.toHaveBeenCalled();
  });
});

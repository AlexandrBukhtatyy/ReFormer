// @vitest-environment happy-dom
/**
 * Уровень языка [ReFormer-cn5g.3].
 *
 * Язык — уровень UI над моделью: его меняет форма настроек (привязка к полю), код (`set`) или
 * другая вкладка (хранилище), а компоненты, `<html lang dir>` и перевод следуют за ним. Загрузку
 * делает тот же `createLocaleStore`, что у `I18nProvider`; здесь проверяется сам уровень:
 * выбор начального языка, промис `set`, сохранение только загрузившегося языка, время жизни.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from '@preact/signals-core';
import { createModel, createStore } from '../../src/model/index';
import { createLocaleLoader } from '../../src/i18n/loader';
import type { FormLocale } from '../../src/i18n/locale';
import type { LocaleLoad } from '../../src/i18n/locale-store';
import {
  browserLanguage,
  createLanguage,
  documentLang,
  textDirection,
  webStorage,
  type StorageAdapter,
} from '../../src/language/index';
import { deferred, settle, type Deferred } from '../test-utils/async';

const locale = (code: string, title: string): FormLocale => ({
  code,
  messages: { 'app.title': title, 'cart.items': '{count, plural, one{# item} other{# items}}' },
});
const RU = locale('ru', 'Профиль');
const EN = locale('en', 'Profile');
const AR = locale('ar', 'الملف');

/** Загрузчик: мгновенный, из таблицы локалей. */
const instant = (table: Record<string, FormLocale>) =>
  createLocaleLoader([(code) => table[code] ?? null]);

/** Загрузчик под контролем теста. */
function controlledLoad() {
  const requests = new Map<string, Deferred<FormLocale>>();
  const load = vi.fn((code: string) => {
    const request = deferred<FormLocale>();
    requests.set(code, request);
    return request.promise;
  }) as LocaleLoad & ReturnType<typeof vi.fn>;
  return {
    load,
    resolve: async (code: string, value: FormLocale) => {
      requests.get(code)!.resolve(value);
      await settle();
    },
    reject: async (code: string, error: Error) => {
      requests.get(code)!.reject(error);
      await settle();
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = '';
  document.documentElement.dir = '';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createLanguage — загрузка и показанный язык', () => {
  it('до первой загрузки — встроенный английский; после — язык на экране', async () => {
    const { load, resolve } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null });
    expect(language.lang.value).toBe('ru');
    expect(language.locale.value).toBeNull();
    expect(language.pending.value).toBe(true);
    expect(language.t('app.title', undefined, 'Profile')).toBe('Profile');
    await resolve('ru', RU);
    expect(language.code.value).toBe('ru');
    expect(language.pending.value).toBe(false);
    expect(language.t('app.title')).toBe('Профиль');
    expect(language.i18n.value.t('cart.items', { count: 2 })).toBe('2 items');
    language.dispose();
  });

  it('пока новый язык грузится, на экране прежний; t внутри computed реактивен', async () => {
    const { load, resolve } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null });
    await resolve('ru', RU);
    const title = computed(() => language.t('app.title'));
    expect(title.value).toBe('Профиль');
    const done = language.set('en');
    expect(language.lang.value).toBe('en');
    expect(language.code.value).toBe('ru');
    expect(language.pending.value).toBe(true);
    await resolve('en', EN);
    await done;
    expect(title.value).toBe('Profile');
    language.dispose();
  });

  it('set: промис отклоняется ошибкой загрузки, язык на экране прежний; повтор — retry', async () => {
    const { load, resolve, reject } = controlledLoad();
    const onError = vi.fn();
    const language = createLanguage({ load, initial: 'ru', detect: null, onError });
    await resolve('ru', RU);
    const failed = language.set('en');
    await reject('en', new Error('сеть'));
    await expect(failed).rejects.toThrow('сеть');
    expect(language.code.value).toBe('ru');
    expect((language.error.value as Error).message).toBe('сеть');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'en');

    const again = language.set('en'); // тот же язык после ошибки — повторная попытка
    expect(language.pending.value).toBe(true);
    await resolve('en', EN);
    await again;
    expect(language.code.value).toBe('en');
    expect(language.error.value).toBeUndefined();
    language.dispose();
  });

  it('set вытесненного языка выполняется, когда запросили другой', async () => {
    const { load, resolve } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null });
    await resolve('ru', RU);
    const toEn = language.set('en');
    const toAr = language.set('ar');
    await expect(toEn).resolves.toBeUndefined();
    await resolve('ar', AR);
    await toAr;
    expect(language.code.value).toBe('ar');
    language.dispose();
  });

  it('set показанного языка выполняется сразу; retry — повтор упавшей загрузки', async () => {
    const { load, resolve, reject } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null });
    await resolve('ru', RU);
    await expect(language.set('ru')).resolves.toBeUndefined();
    void language.set('en').catch(() => {});
    await reject('en', new Error('x'));
    language.retry();
    expect(language.pending.value).toBe(true);
    await resolve('en', EN);
    expect(language.code.value).toBe('en');
    language.dispose();
  });

  it('кэш загрузчика — язык показан синхронно', async () => {
    const load = instant({ ru: RU, en: EN });
    await load.preload('en');
    const language = createLanguage({ load, initial: 'en', detect: null });
    expect(language.code.value).toBe('en');
    expect(language.pending.value).toBe(false);
    language.dispose();
  });
});

describe('createLanguage — начальный язык', () => {
  it('хранилище важнее привязки и initial; негодное пропускается', async () => {
    localStorage.setItem('reformer.lang', '"en"');
    const language = createLanguage({
      load: instant({ en: EN, ru: RU }),
      initial: 'ru',
      detect: null,
      storage: webStorage(),
    });
    expect(language.lang.value).toBe('en');
    language.dispose();

    localStorage.setItem('reformer.lang', '"de"');
    const filtered = createLanguage({
      load: instant({ en: EN, ru: RU }),
      initial: 'ru',
      supported: ['ru', 'en'],
      detect: null,
      storage: webStorage(),
    });
    expect(filtered.lang.value).toBe('ru');
    filtered.dispose();
  });

  it('язык браузера, если не дали хранилище, привязка и initial', () => {
    vi.stubGlobal('navigator', { languages: ['de-DE', 'en-US'], language: 'de-DE' });
    const language = createLanguage({ load: instant({}), supported: ['ru', 'en'] });
    expect(language.lang.value).toBe('en');
    language.dispose();
  });

  it('ничего не подошло — fallback (по умолчанию en)', () => {
    const language = createLanguage({ load: instant({}), detect: () => undefined });
    expect(language.lang.value).toBe('en');
    language.dispose();
    const ru = createLanguage({ load: instant({}), detect: null, fallback: 'ru' });
    expect(ru.lang.value).toBe('ru');
    ru.dispose();
  });
});

describe('createLanguage — привязка к полю модели', () => {
  it('форма настроек пишет поле — язык переключается; set пишет в поле', async () => {
    const app = createStore(() => {
      const model = createModel({ settings: { lang: 'ru' } });
      const language = createLanguage({
        lang: model.$.settings.lang,
        load: instant({ ru: RU, en: EN }),
        detect: null,
      });
      return { model, language };
    });
    await settle();
    expect(app.language.code.value).toBe('ru');
    app.model.settings.lang = 'en';
    await settle();
    expect(app.language.code.value).toBe('en');
    await app.language.set('ru');
    expect(app.model.settings.lang).toBe('ru');
    app.dispose();
  });

  it('начальный язык записывается в поле', () => {
    localStorage.setItem('reformer.lang', '"en"');
    const model = createModel({ lang: 'ru' });
    const language = createLanguage({
      lang: model.$.lang,
      load: instant({ ru: RU, en: EN }),
      detect: null,
      storage: webStorage(),
    });
    expect(model.lang).toBe('en');
    language.dispose();
  });
});

describe('createLanguage — документ и хранилище', () => {
  it('<html lang dir> следует за показанным языком', async () => {
    const language = createLanguage({
      load: instant({ ru: RU, ar: AR }),
      initial: 'ru',
      detect: null,
    });
    await settle();
    expect(document.documentElement.lang).toBe('ru');
    expect(document.documentElement.dir).toBe('ltr');
    await language.set('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(language.dir.value).toBe('rtl');
    language.dispose();
  });

  it('document: null — атрибуты не трогает; свой корень', async () => {
    const language = createLanguage({
      load: instant({ ru: RU }),
      initial: 'ru',
      detect: null,
      document: null,
    });
    await settle();
    expect(document.documentElement.lang).toBe('');
    language.dispose();

    const root = document.createElement('section');
    const scoped = createLanguage({
      load: instant({ ru: RU }),
      initial: 'ru',
      detect: null,
      document: documentLang(root),
    });
    await settle();
    expect(root.lang).toBe('ru');
    scoped.dispose();
  });

  it('сохраняется только загрузившийся язык', async () => {
    const { load, resolve, reject } = controlledLoad();
    const writes: unknown[] = [];
    const data = new Map<string, unknown>();
    const storage: StorageAdapter = {
      get: (k) => data.get(k),
      set: (k, v) => {
        writes.push(v);
        data.set(k, v);
      },
    };
    const language = createLanguage({ load, initial: 'ru', detect: null, storage });
    await resolve('ru', RU);
    void language.set('en').catch(() => {});
    await reject('en', new Error('x'));
    expect(writes).toEqual(['ru']);
    void language.set('ar');
    await resolve('ar', AR);
    expect(writes).toEqual(['ru', 'ar']);
    language.dispose();
  });

  it('правка из другой вкладки переключает язык; негодная — пропускается', async () => {
    const language = createLanguage({
      load: instant({ ru: RU, en: EN }),
      initial: 'ru',
      supported: ['ru', 'en'],
      detect: null,
      storage: webStorage(),
    });
    await settle();
    localStorage.setItem('reformer.lang', '"de"');
    window.dispatchEvent(new StorageEvent('storage', { key: 'reformer.lang' }));
    expect(language.lang.value).toBe('ru');
    localStorage.setItem('reformer.lang', '"en"');
    window.dispatchEvent(new StorageEvent('storage', { key: 'reformer.lang' }));
    await settle();
    expect(language.code.value).toBe('en');
    language.dispose();
  });

  it('хранилище без subscribe — только чтение и запись', async () => {
    const data = new Map<string, unknown>([['reformer.lang', 'en']]);
    const storage: StorageAdapter = { get: (k) => data.get(k), set: (k, v) => void data.set(k, v) };
    const language = createLanguage({ load: instant({ ru: RU, en: EN }), detect: null, storage });
    await settle();
    expect(language.code.value).toBe('en');
    await language.set('ru');
    expect(data.get('reformer.lang')).toBe('ru');
    language.dispose();
  });
});

describe('createLanguage — время жизни', () => {
  it('после снятия запись в поле язык не меняет', async () => {
    const model = createModel({ lang: 'ru' });
    const store = createStore(() => ({
      language: createLanguage({
        lang: model.$.lang,
        load: instant({ ru: RU, en: EN }),
        detect: null,
      }),
    }));
    await settle();
    store.dispose();
    model.lang = 'en';
    await settle();
    expect(store.language.code.value).toBe('ru');
  });
});

describe('адаптеры языка', () => {
  it('browserLanguage: точный тег, затем базовый язык; без списка — первый язык браузера', () => {
    vi.stubGlobal('navigator', { languages: ['pt-BR', 'ru-RU'], language: 'pt-BR' });
    expect(browserLanguage({ supported: ['pt-BR', 'ru'] })()).toBe('pt-BR');
    expect(browserLanguage({ supported: ['ru'] })()).toBe('ru');
    expect(browserLanguage()()).toBe('pt-BR');
    expect(browserLanguage({ supported: ['ja'] })()).toBeUndefined();
  });

  it('browserLanguage: без navigator.languages — navigator.language; без navigator — undefined', () => {
    vi.stubGlobal('navigator', { languages: [], language: 'en-GB' });
    expect(browserLanguage({ supported: ['en'] })()).toBe('en');
    vi.stubGlobal('navigator', { language: '' });
    expect(browserLanguage()()).toBeUndefined();
    vi.stubGlobal('navigator', undefined);
    expect(browserLanguage()()).toBeUndefined();
  });

  it('documentLang без document — null', () => {
    vi.stubGlobal('document', undefined);
    expect(documentLang()).toBeNull();
  });

  it('textDirection: rtl для арабского и иврита, ltr для прочих и невалидных тегов', () => {
    expect(textDirection('ar')).toBe('rtl');
    expect(textDirection('he-IL')).toBe('rtl');
    expect(textDirection('ru')).toBe('ltr');
    expect(textDirection('!!')).toBe('ltr');
  });

  it('textDirection без Intl.Locale#getTextInfo — запасной список', () => {
    const OriginalLocale = Intl.Locale;
    vi.stubGlobal('Intl', {
      ...Intl,
      Locale: class extends OriginalLocale {
        getTextInfo = undefined;
        textInfo = undefined;
      },
    });
    expect(textDirection('fa')).toBe('rtl');
    expect(textDirection('en')).toBe('ltr');
  });
});

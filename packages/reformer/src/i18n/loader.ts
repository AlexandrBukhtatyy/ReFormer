/**
 * Загрузка локалей: откуда брать словарь, решает приложение.
 *
 * Источник — функция `(code) => локаль | словарь`. Им может быть ленивый чанк пакета
 * (`loadKitLocale`), запрос по сети ({@link fetchMessages}) или что угодно своё. Загрузчик собирает
 * несколько источников в одну локаль, поэтому набор языков и сами тексты не зашиты в сборку
 * приложения: новый язык — это новый файл на сервере.
 *
 * @module i18n/loader
 */

import { extendLocale, type FormLocale, type Messages } from './locale';

/** Что может вернуть источник: локаль целиком, её часть, голый словарь или ничего. */
export type LocaleSourceResult = Partial<FormLocale> | Messages | null | undefined;

/**
 * Источник локали. Получает код языка, отдаёт локаль или словарь — сразу или промисом.
 * `null`/`undefined` означает «для этого языка у меня ничего нет» и ошибкой не считается.
 */
export type LocaleSource = (code: string) => LocaleSourceResult | Promise<LocaleSourceResult>;

/** Загрузчик локалей с кэшем. */
export interface LocaleLoader {
  /** Загрузить локаль языка. Повторный вызов возвращает тот же промис и ту же локаль. */
  (code: string): Promise<FormLocale>;
  /** Уже загруженная локаль или `undefined`. Позволяет провайдеру отрисоваться синхронно. */
  peek(code: string): FormLocale | undefined;
  /** То же, что вызов загрузчика; имя для чтения в коде старта приложения. */
  preload(code: string): Promise<FormLocale>;
}

/**
 * Локаль (или её часть) узнаём по полю `messages`-объекту. У голого словаря все значения —
 * строки, поэтому ключ с именем `messages` в нём возможен, но объектом не будет. Отсюда правило
 * для источника: настройки локали без словаря отдаются с пустым `messages: {}`.
 */
function isLocaleShaped(value: object): value is Partial<FormLocale> {
  const messages = (value as { messages?: unknown }).messages;
  return messages !== null && typeof messages === 'object';
}

function toPatch(result: LocaleSourceResult): Partial<FormLocale> | undefined {
  if (result === null || result === undefined) return undefined;
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('источник локали вернул не объект');
  }
  return isLocaleShaped(result) ? result : { messages: result as Messages };
}

/**
 * Собирает загрузчик из источников. Источники опрашиваются параллельно, а сливаются по порядку:
 * поздний перекрывает ранний. Результат кэшируется по коду языка, идущий запрос не дублируется.
 * Отказ любого источника — отказ загрузки; из кэша такой запрос удаляется, и следующая попытка
 * пойдёт заново. Источник, которому можно промахнуться, приложение оборачивает само:
 * `(code) => source(code).catch(() => null)`.
 *
 * Код языка у результата — всегда запрошенный: по нему работает `Intl`, и он не должен зависеть
 * от того, что написано внутри файла.
 *
 * @param sources - Источники в порядке возрастания приоритета.
 *
 * @example
 * ```ts
 * import { createLocaleLoader, fetchMessages } from '@reformer/core/i18n';
 * import { loadKitLocale } from '@reformer/ui-kit/locale';
 *
 * export const loadLocale = createLocaleLoader([
 *   loadKitLocale,                                    // подписи кита — чанк нужного языка
 *   fetchMessages((code) => `/locales/${code}.json`), // ключи приложения и правки — с сервера
 * ]);
 * ```
 */
export function createLocaleLoader(sources: readonly LocaleSource[]): LocaleLoader {
  const loaded = new Map<string, FormLocale>();
  const inFlight = new Map<string, Promise<FormLocale>>();

  const load = (code: string): Promise<FormLocale> => {
    const ready = loaded.get(code);
    if (ready !== undefined) return Promise.resolve(ready);
    const running = inFlight.get(code);
    if (running !== undefined) return running;

    const request = Promise.all(sources.map(async (source) => toPatch(await source(code))))
      .then((patches) => {
        let locale: FormLocale = { code, messages: {} };
        for (const patch of patches) {
          if (patch !== undefined) locale = extendLocale(locale, patch);
        }
        locale = { ...locale, code };
        loaded.set(code, locale);
        return locale;
      })
      .finally(() => {
        inFlight.delete(code);
      });
    inFlight.set(code, request);
    return request;
  };

  return Object.assign(load, {
    peek: (code: string) => loaded.get(code),
    preload: load,
  });
}

/**
 * Источник локали по сети: забирает JSON по адресу, построенному из кода языка. Файл может быть
 * словарём (`{ "profile.title": "Профиль" }`) или локалью целиком (`{ "code": "ru", "messages": … }`).
 * Ответ не `2xx` — ошибка загрузки.
 *
 * @param url - Адрес файла для языка.
 * @param init - Параметры запроса, передаются в `fetch` как есть.
 *
 * @example
 * ```ts
 * fetchMessages((code) => `/locales/${code}.json`);
 * ```
 */
export function fetchMessages(url: (code: string) => string, init?: RequestInit): LocaleSource {
  return async (code) => {
    const address = url(code);
    const response = await fetch(address, init);
    if (!response.ok) {
      throw new Error(`локаль «${code}»: ${address} ответил ${response.status}`);
    }
    return (await response.json()) as LocaleSourceResult;
  };
}

/**
 * Источник встроенных локалей пакета: по чанку на язык. Язык ищется точно, затем по основной части
 * кода (`ru-RU` → `ru`). Языка нет — источник отдаёт `null`: подписи пакета останутся английскими,
 * пока приложение не даст их своим источником.
 *
 * @param loaders - Код языка → ленивый импорт его локали.
 *
 * @example
 * ```ts
 * export const loadKitLocale = bundledLocaleSource({
 *   en: () => import('./en').then((m) => m.en),
 *   ru: () => import('./ru').then((m) => m.ru),
 * });
 * ```
 */
export function bundledLocaleSource(
  loaders: Readonly<Record<string, () => Promise<FormLocale>>>
): LocaleSource {
  return (code) => {
    const base = code.split('-')[0]!.toLowerCase();
    const exact = Object.prototype.hasOwnProperty.call(loaders, code) ? loaders[code] : undefined;
    const load =
      exact ?? (Object.prototype.hasOwnProperty.call(loaders, base) ? loaders[base] : undefined);
    return load === undefined ? null : load();
  };
}

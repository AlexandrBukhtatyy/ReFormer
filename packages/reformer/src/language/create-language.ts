/**
 * Уровень языка над моделью: запрошенный и показанный язык, локаль и перевод — сигналами.
 *
 * Загрузку не дублирует: внутри — `createLocaleStore` из `@reformer/core/i18n` (прежний язык на
 * экране, пока новый грузится; применяется только последний запрос; кэш загрузчика).
 *
 * @module language/create-language
 */

import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals-core';
import { watchField } from '../model/behaviors-value';
import { createStore, onScopeDispose } from '../model/scope';
import { signalFrom } from '../model/signal-from';
import { createLocaleStore, type LocaleLoad } from '../i18n/locale-store';
import { createI18n, type I18nHandle } from '../i18n/translator';
import { DEFAULT_LOCALE, type FormLocale } from '../i18n/locale';
import type { MessageValues } from '../i18n/message-format';
import { writeStorage, type StorageAdapter } from '../levels/storage';
import {
  browserLanguage,
  documentLang,
  textDirection,
  type LanguageTarget,
  type TextDirection,
} from './adapters';

/**
 * Настройки {@link createLanguage}.
 *
 * @group Language
 */
export interface LanguageOptions {
  /** Загрузчик локалей — `createLocaleLoader([...])` из `@reformer/core/i18n`. */
  load: LocaleLoad;
  /**
   * Поле модели с языком (`app.$.settings.lang`): форма настроек над этим полем переключает язык.
   * Без привязки уровень заводит свой сигнал.
   */
  lang?: Signal<string>;
  /** Язык на старте, если его не дали хранилище и привязка. */
  initial?: string;
  /** Язык, если ничего не подошло. По умолчанию `'en'`. */
  fallback?: string;
  /** Языки приложения: сохранённый, привязанный и определённый язык вне списка пропускается. */
  supported?: readonly string[];
  /** Определение языка пользователя. По умолчанию {@link browserLanguage}; `null` — не определять. */
  detect?: (() => string | undefined) | null;
  /** Где помнить выбор. Сохраняется язык, который загрузился: неудачный не переживёт перезагрузку. */
  storage?: StorageAdapter | null;
  /** Ключ в хранилище. По умолчанию `'reformer.lang'`. */
  storageKey?: string;
  /** Куда применять язык. По умолчанию {@link documentLang}; `null` — DOM не трогать. */
  document?: LanguageTarget | null;
  /** Отказ загрузки языка, который всё ещё запрошен. */
  onError?: (error: unknown, lang: string) => void;
}

/**
 * Уровень языка.
 *
 * @group Language
 */
export interface Language {
  /** Запрошенный язык. Пока он грузится, на экране прежний. */
  readonly lang: ReadonlySignal<string>;
  /** Код языка на экране (код показанной локали). */
  readonly code: ReadonlySignal<string>;
  /** Показанная локаль; `null` — ни одна ещё не загружена. */
  readonly locale: ReadonlySignal<FormLocale | null>;
  /** Перевод и форматирование показанного языка; до первой загрузки — встроенный английский. */
  readonly i18n: ReadonlySignal<I18nHandle>;
  /** Идёт загрузка запрошенного языка. */
  readonly pending: ReadonlySignal<boolean>;
  /** Ошибка последней загрузки; `undefined` — ошибки нет. */
  readonly error: ReadonlySignal<unknown>;
  /** Направление письма показанного языка. */
  readonly dir: ReadonlySignal<TextDirection>;
  /** Перевести ключ показанным языком. Внутри `computed` и эффектов — реактивно. */
  t(key: string, values?: MessageValues, defaultMessage?: string): string;
  /**
   * Запросить язык. Промис выполняется, когда язык показан или вытеснен новым запросом, и
   * отклоняется ошибкой загрузки. Повтор языка, загрузка которого упала, — повторная попытка.
   */
  set(lang: string): Promise<void>;
  /** Повторить упавшую загрузку. */
  retry(): void;
  /** Перестать следить за привязкой и хранилищем. Атрибуты документа не снимаются. */
  dispose(): void;
}

/**
 * Создать уровень языка.
 *
 * Начальный язык — первый подходящий из: хранилища, привязанного поля, `initial`, `detect()`,
 * иначе `fallback`; он записывается и в привязанное поле. Дальше каждая запись в поле (формой,
 * кодом, `set`) запрашивает язык, а показанный язык попадает на `<html lang dir>` и в хранилище.
 *
 * Уровень принадлежит текущей области (`createStore`) и снимается вместе с ней. В React — провайдер
 * `I18nProvider({ language })` из `@reformer/core/react`: компоненты cdk и ui-kit говорят этим языком.
 *
 * @param options - См. {@link LanguageOptions}.
 * @returns Уровень языка.
 *
 * @example
 * ```typescript
 * import { createModel, createStore } from '@reformer/core/model';
 * import { createLocaleLoader } from '@reformer/core/i18n';
 * import { createLanguage, webStorage } from '@reformer/core/language';
 * import { loadKitLocale } from '@reformer/ui-kit/locale';
 *
 * const app = createStore(() => {
 *   const model = createModel({ settings: { lang: 'ru' } });
 *   const language = createLanguage({
 *     lang: model.$.settings.lang,
 *     load: createLocaleLoader([loadKitLocale]),
 *     supported: ['ru', 'en'],
 *     storage: webStorage(),
 *   });
 *   return { model, language };
 * });
 *
 * await app.language.set('en'); // словарь загружен, <html lang="en">
 * ```
 *
 * @group Language
 */
export function createLanguage(options: LanguageOptions): Language {
  return createStore((scope) => {
    const fallback = options.fallback ?? 'en';
    const storageKey = options.storageKey ?? 'reformer.lang';
    const { storage, supported } = options;
    const usable = (code: unknown): code is string =>
      typeof code === 'string' && code !== '' && (!supported || supported.includes(code));
    const detect = options.detect === undefined ? browserLanguage({ supported }) : options.detect;

    const initial =
      [storage?.get(storageKey), options.lang?.peek(), options.initial].find(usable) ??
      [detect?.()].find(usable) ??
      fallback;
    const lang = options.lang ?? signal(initial);
    lang.value = initial;

    const store = createLocaleStore(options.load, initial, { onError: options.onError });
    const state = signalFrom(store.getState, store.subscribe);
    watchField(lang, (code) => store.setLang(code), { immediate: true });

    const locale = computed(() => state.value.locale);
    const code = computed(() => state.value.locale?.code ?? DEFAULT_LOCALE.code);
    const i18n = computed(() => createI18n(state.value.locale ?? DEFAULT_LOCALE));
    const dir = computed(() => textDirection(code.value));
    const pending = computed(() => state.value.pending);
    const error = computed(() => state.value.error);

    if (storage) {
      // Сохраняется загрузившийся язык: язык, загрузка которого упала, не переживёт перезагрузку.
      const loaded = computed(() => {
        const s = state.value;
        return !s.pending && s.error === undefined && s.locale !== null ? s.lang : null;
      });
      watchField(loaded, (value) => {
        if (value !== null && storage.get(storageKey) !== value)
          writeStorage(storage, storageKey, value);
      });
      const stop = storage.subscribe?.(storageKey, () => {
        const stored = storage.get(storageKey);
        if (usable(stored)) lang.value = stored;
      });
      if (stop) onScopeDispose(stop);
    }

    const target = options.document === undefined ? documentLang() : options.document;
    if (target) scope.effect(() => target.apply(code.value, dir.value));

    return {
      lang,
      code,
      locale,
      i18n,
      pending,
      error,
      dir,
      t(key: string, values?: MessageValues, defaultMessage?: string): string {
        return i18n.value.t(key, values, defaultMessage);
      },
      set(next: string): Promise<void> {
        const before = store.getState();
        if (lang.peek() === next && before.lang === next && before.error !== undefined) {
          store.retry();
        }
        lang.value = next;
        return new Promise<void>((resolve, reject) => {
          const settle = (): boolean => {
            const s = store.getState();
            if (s.lang !== next)
              resolve(); // вытеснен новым запросом
            else if (s.pending) return false;
            else if (s.error !== undefined) reject(s.error);
            else resolve();
            return true;
          };
          if (settle()) return;
          const unsubscribe = store.subscribe(() => {
            if (settle()) unsubscribe();
          });
        });
      },
      retry(): void {
        store.retry();
      },
    };
  });
}

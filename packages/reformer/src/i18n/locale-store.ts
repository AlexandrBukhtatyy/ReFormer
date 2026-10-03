/**
 * Хранилище активной локали для провайдера, который грузит язык сам.
 *
 * Вся логика загрузки собрана здесь и не знает про React: провайдер только подписывается на
 * состояние. Так поведение проверяется обычными юнит-тестами, без рендера.
 *
 * Правила:
 * - **прежний язык остаётся на экране**, пока новый не загрузится: `locale` меняется только на
 *   готовую локаль, а на время ожидания взводится `pending`;
 * - **применяется только последний запрос**: ответ для языка, с которого уже ушли, отбрасывается;
 * - **ошибка язык не меняет**: `locale` остаётся прежней, ошибка кладётся в `error`;
 * - **локаль из кэша загрузчика применяется синхронно** — без кадра ожидания.
 *
 * @module i18n/locale-store
 */

import type { FormLocale } from './locale';

/** Функция загрузки локали. `peek` — необязательный синхронный кэш (есть у `createLocaleLoader`). */
export interface LocaleLoad {
  (code: string): Promise<FormLocale>;
  peek?(code: string): FormLocale | undefined;
}

/** Состояние хранилища. Объект неизменяемый: новая ссылка — новое состояние. */
export interface LocaleStoreState {
  /** Запрошенный язык. Пока `pending`, может отличаться от языка `locale`. */
  readonly lang: string;
  /** Локаль, которая сейчас на экране; `null` — ни одна ещё не загружена. */
  readonly locale: FormLocale | null;
  /** Идёт загрузка запрошенного языка. */
  readonly pending: boolean;
  /** Ошибка последней загрузки; сбрасывается следующей удачной. */
  readonly error: unknown;
}

/** Хранилище активной локали. */
export interface LocaleStore {
  getState(): LocaleStoreState;
  subscribe(listener: () => void): () => void;
  /** Запросить язык. Повторный запрос того же языка, пока он грузится или уже показан, — no-op. */
  setLang(lang: string): void;
}

/** Настройки хранилища. */
export interface LocaleStoreOptions {
  /** Вызывается при отказе загрузки языка, который всё ещё запрошен. */
  readonly onError?: (error: unknown, lang: string) => void;
}

/**
 * Создаёт хранилище. Загрузка при создании НЕ начинается: начальное состояние считается чисто —
 * из кэша загрузчика, если локаль там уже есть, — а запрос уходит на первый {@link LocaleStore.setLang}.
 * Это позволяет создавать хранилище прямо в рендере.
 *
 * @param load - Загрузчик локалей.
 * @param lang - Начальный язык.
 * @param options - См. {@link LocaleStoreOptions}.
 */
export function createLocaleStore(
  load: LocaleLoad,
  lang: string,
  options: LocaleStoreOptions = {}
): LocaleStore {
  const listeners = new Set<() => void>();
  const cached = load.peek?.(lang);
  let state: LocaleStoreState = {
    lang,
    locale: cached ?? null,
    pending: cached === undefined,
    error: undefined,
  };
  /** Язык, чей запрос сейчас в пути; `null` — запросов нет. */
  let requested: string | null = null;
  /**
   * Язык, чья локаль сейчас на экране. Отдельно от `locale.code`: свой загрузчик вправе вернуть
   * локаль с другим кодом (`ru` на запрос `ru-RU`), и сравнение по коду перезагружало бы её.
   */
  let shown: string | null = cached === undefined ? null : lang;

  const set = (next: LocaleStoreState): void => {
    state = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setLang(next) {
      if (requested === next) return;

      if (shown === next) {
        // Вернулись к языку, который на экране: идущий запрос другого языка больше не нужен.
        requested = null;
        if (state.lang !== next || state.pending || state.error !== undefined) {
          set({ ...state, lang: next, pending: false, error: undefined });
        }
        return;
      }

      const ready = load.peek?.(next);
      if (ready !== undefined) {
        requested = null;
        shown = next;
        set({ lang: next, locale: ready, pending: false, error: undefined });
        return;
      }

      requested = next;
      set({ ...state, lang: next, pending: true, error: undefined });
      load(next).then(
        (locale) => {
          if (requested !== next) return; // с этого языка уже ушли
          requested = null;
          shown = next;
          set({ lang: next, locale, pending: false, error: undefined });
        },
        (error: unknown) => {
          if (requested !== next) return;
          requested = null;
          set({ ...state, pending: false, error });
          options.onError?.(error, next);
        }
      );
    },
  };
}

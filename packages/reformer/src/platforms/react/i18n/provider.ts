/**
 * Провайдер локализации.
 *
 * Два режима:
 * - `lang` + `load` — провайдер грузит локаль сам (основной путь);
 * - `locale` — готовый объект, синхронно (SSR, тесты, приложение со своей загрузкой).
 *
 * Файл без JSX намеренно: `react/jsx-runtime` не входит во внешние зависимости сборки ядра.
 *
 * @module platforms/react/i18n/provider
 */

import {
  createElement,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { DEFAULT_LOCALE, type FormLocale } from '../../../i18n/locale';
import { createLocaleStore, type LocaleLoad } from '../../../i18n/locale-store';
import { createI18n } from '../../../i18n/translator';
import { contextValue, I18nContext } from './context';

/** Режим «готовая локаль». */
export interface I18nStaticProviderProps {
  /** Локаль. Смена объекта переключает язык сразу. */
  locale: FormLocale;
  children?: ReactNode;
}

/** Режим «провайдер грузит сам». */
export interface I18nLoadingProviderProps {
  /** Код языка. Смена кода запускает загрузку; до её конца на экране прежний язык. */
  lang: string;
  /**
   * Загрузчик локалей — обычно результат `createLocaleLoader`. Нужна СТАБИЛЬНАЯ ссылка (модульная
   * константа, `useMemo`): новый загрузчик — новое хранилище, и язык запрашивается у него заново.
   * На экране тем временем остаётся прежняя локаль, но инлайн-стрелка гоняла бы запрос на каждый
   * рендер родителя.
   */
  load: LocaleLoad;
  /**
   * Что показать, пока не загружена самая первая локаль. По умолчанию — ничего: иначе на кадр
   * мелькнул бы встроенный английский. Если локаль уже в кэше загрузчика (`load.preload(lang)`
   * до монтирования), первый рендер синхронный и `fallback` не показывается. Упала первая
   * загрузка — дети показываются на встроенном английском, ошибка — в `useI18n().error`,
   * повторить — `useI18n().retry()`.
   */
  fallback?: ReactNode;
  /** Отказ загрузки. Язык на экране при этом не меняется. */
  onError?: (error: unknown, lang: string) => void;
  children?: ReactNode;
}

export type I18nProviderProps = I18nStaticProviderProps | I18nLoadingProviderProps;

function StaticProvider({ locale, children }: I18nStaticProviderProps): ReactElement {
  const value = useMemo(() => contextValue(createI18n(locale), false, undefined), [locale]);
  return createElement(I18nContext.Provider, { value }, children);
}

function LoadingProvider({
  lang,
  load,
  fallback,
  onError,
  children,
}: I18nLoadingProviderProps): ReactElement | null {
  // Колбэк читается через ref: смена его идентичности не должна пересоздавать хранилище.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  // Локаль на экране — её получает хранилище нового загрузчика, чтобы не вернуться к `fallback`.
  const shownRef = useRef<FormLocale | null>(null);
  // Дети уже показаны: дальше провайдер их не размонтирует, даже если локали всё ещё нет.
  const childrenShownRef = useRef(false);

  // Хранилище создаётся в рендере, но запрос при этом не уходит: начальное состояние берётся из
  // кэша загрузчика, а загрузку запускает эффект ниже. `lang` в зависимости не входит — язык
  // хранилищу сообщает тот же эффект.
  const store = useMemo(
    () =>
      createLocaleStore(load, lang, {
        onError: (error, code) => onErrorRef.current?.(error, code),
        previous: shownRef.current ?? undefined,
      }),
    [load]
  );

  useEffect(() => {
    store.setLang(lang);
  }, [store, lang]);

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { locale, pending, error } = state;
  if (locale !== null) shownRef.current = locale;
  // Первая загрузка упала — показать детей на встроенном английском, а не держать `fallback`.
  const builtin = locale === null && (error !== undefined || childrenShownRef.current);

  const value = useMemo(
    () =>
      locale === null && !builtin
        ? null
        : contextValue(createI18n(locale ?? DEFAULT_LOCALE), pending, error, store.retry),
    [locale, builtin, pending, error, store]
  );

  if (value === null)
    return fallback === undefined ? null : createElement(Fragment, null, fallback);
  childrenShownRef.current = true;
  return createElement(I18nContext.Provider, { value }, children);
}

/**
 * Провайдер локализации для подписей компонентов, ошибок валидации и авторских подписей формы.
 * Без провайдера компоненты говорят встроенным английским.
 *
 * При смене `lang` на экране остаётся прежний язык, пока новый не загрузится (`useI18n().pending`
 * — для индикатора). При быстром переключении применяется только последний запрос. Вложенный
 * провайдер заменяет локаль для своего поддерева целиком.
 *
 * @example Провайдер грузит локаль сам
 * ```tsx
 * const [lang, setLang] = useState('ru');
 *
 * <I18nProvider lang={lang} load={loadLocale}>
 *   <LangSwitch value={lang} onChange={setLang} />
 *   <CreditForm />
 * </I18nProvider>
 * ```
 *
 * @example Готовая локаль — SSR и тесты
 * ```tsx
 * import { ru } from '@reformer/ui-kit/locale/ru';
 *
 * <I18nProvider locale={ru}><CreditForm /></I18nProvider>
 * ```
 */
export function I18nProvider(props: I18nProviderProps): ReactElement | null {
  return 'locale' in props
    ? createElement(StaticProvider, props)
    : createElement(LoadingProvider, props);
}

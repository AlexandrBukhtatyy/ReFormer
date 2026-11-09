/**
 * React-контекст локализации — один на все пакеты `@reformer/*`.
 *
 * cdk, ui-kit и рендереры импортируют его из `@reformer/core/i18n` и выносят ядро во внешние
 * зависимости своих сборок, поэтому объект контекста существует в единственном экземпляре. Вторая
 * копия (подпуть, попавший в чужой бандл) разорвала бы связь провайдера с компонентами молча —
 * за этим следит `scripts/check-i18n-singleton.mjs` по маркеру {@link I18N_CONTEXT_MARKER}.
 *
 * @module platforms/react/i18n/context
 */

import { createContext } from 'react';
import { DEFAULT_LOCALE } from '../../../i18n/locale';
import { createI18n, type I18nHandle } from '../../../i18n/translator';

/** Имя контекста и одновременно маркер, по которому страж ищет его копии в сборках. */
export const I18N_CONTEXT_MARKER = 'ReformerI18nContext';

/** Что видит компонент: ручка активной локали и состояние её загрузки. */
export interface I18nContextValue extends I18nHandle {
  /** Идёт загрузка другого языка; на экране пока прежний. Без загрузчика всегда `false`. */
  readonly pending: boolean;
  /** Ошибка последней загрузки языка. */
  readonly error: unknown;
  /**
   * Повторить загрузку языка, которая упала (`error` задан). Без загрузчика и без ошибки ничего
   * не делает.
   */
  readonly retry: () => void;
}

const noRetry = (): void => {};

/** Значение контекста для локали: ручка плюс состояние загрузки. */
export function contextValue(
  handle: I18nHandle,
  pending: boolean,
  error: unknown,
  retry: () => void = noRetry
): I18nContextValue {
  return { ...handle, pending, error, retry };
}

/**
 * Значение «провайдера нет»: английский с пустым словарём. Каждый пакет при этом говорит своей
 * встроенной английской таблицей.
 */
const DEFAULT_VALUE = contextValue(createI18n(DEFAULT_LOCALE), false, undefined);

export const I18nContext = createContext<I18nContextValue>(DEFAULT_VALUE);
I18nContext.displayName = I18N_CONTEXT_MARKER;

/**
 * Активная локаль как подписка — для читателей, которым язык нужен не всегда.
 *
 * Значение {@link I18nContext} меняется при смене языка, и React перерисовывает каждого его
 * потребителя. Поле формы читает язык только ради описателей `msg()` в своих пропсах, а таких полей
 * обычно меньше, чем полей вообще. Источник стабилен на время жизни провайдера: потребитель
 * подписывается сам (`useLocalized`) и перерисовывается, только когда изменился ЕГО результат.
 */
export interface I18nSource {
  /** Ручка активной локали. */
  readonly get: () => I18nHandle;
  /** Подписка на смену локали; возвращает отписку. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** Источник поверх меняющейся ручки: провайдер кладёт новую через `set`, подписчики узнают. */
export interface MutableI18nSource extends I18nSource {
  readonly set: (handle: I18nHandle) => void;
}

/** Источник локали провайдера. */
export function createI18nSource(initial: I18nHandle): MutableI18nSource {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (handle) => {
      if (handle === current) return;
      current = handle;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Источник «провайдера нет»: встроенный английский, смен не бывает. */
const DEFAULT_SOURCE: I18nSource = { get: () => DEFAULT_VALUE, subscribe: () => () => {} };

/** Контекст источника локали — живёт рядом с {@link I18nContext} и так же единственен в сборке. */
export const I18nSourceContext = createContext<I18nSource>(DEFAULT_SOURCE);
I18nSourceContext.displayName = `${I18N_CONTEXT_MARKER}Source`;

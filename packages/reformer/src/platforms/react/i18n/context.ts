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
}

/** Значение контекста для локали: ручка плюс состояние загрузки. */
export function contextValue(
  handle: I18nHandle,
  pending: boolean,
  error: unknown
): I18nContextValue {
  return { ...handle, pending, error };
}

/**
 * Значение «провайдера нет»: английский с пустым словарём. Каждый пакет при этом говорит своей
 * встроенной английской таблицей.
 */
const DEFAULT_VALUE = contextValue(createI18n(DEFAULT_LOCALE), false, undefined);

export const I18nContext = createContext<I18nContextValue>(DEFAULT_VALUE);
I18nContext.displayName = I18N_CONTEXT_MARKER;

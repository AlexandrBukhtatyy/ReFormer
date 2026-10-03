/**
 * Переводчик строк кита.
 *
 * Подписи, которые кит рисует сам (плейсхолдеры, кнопки, статусы, aria-подписи), берутся отсюда:
 * ключ ищется в локали `I18nProvider`, а при промахе — во встроенной английской таблице. Без
 * провайдера кит говорит по-английски. Приоритет в компоненте: явный проп → локаль → английский.
 *
 * @module i18n/messages
 */

import { useMessages } from '@reformer/core/i18n';
import { kitEn } from './message-default';

export type { KitMessageKey } from './message-default';

/**
 * Переводчик строк кита: `(ключ, значения?) => строка`. Идентичность функции меняется вместе с
 * локалью.
 *
 * @example
 * ```tsx
 * const t = useKitMessages();
 * <span>{placeholder ?? t('kit.select.placeholder')}</span>
 * <span>{t('kit.select.selected', { count: selected.length })}</span>
 * ```
 */
export function useKitMessages() {
  return useMessages(kitEn);
}

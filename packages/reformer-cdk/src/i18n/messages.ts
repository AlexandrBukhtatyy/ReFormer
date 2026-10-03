/**
 * Встроенный словарь cdk и переводчик пакета.
 *
 * Строки, которые cdk произносит сам (статусы для скринридера, подписи кнопок без видимого
 * текста), берутся отсюда: ключ ищется в локали `I18nProvider`, а при промахе — во встроенной
 * английской таблице. Без провайдера cdk говорит по-английски.
 *
 * @module i18n/messages
 */

import { useMessages } from '@reformer/core/i18n';
import en from './en.json';

/** Ключ словаря cdk. */
export type CdkMessageKey = keyof typeof en;

/**
 * Переводчик строк cdk: `(ключ, значения?) => строка`. Идентичность функции меняется вместе с
 * локалью.
 *
 * @example
 * ```tsx
 * const t = useCdkMessages();
 * <button aria-label={t('cdk.fileUpload.removeFile', { name: file.name })} />
 * ```
 */
export function useCdkMessages() {
  return useMessages(en);
}

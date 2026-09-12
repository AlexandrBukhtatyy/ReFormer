/**
 * Словарь плагина: он везёт свои строки сам.
 *
 * Строки, которые рисует плагин, разрешаются в пространстве имён ВНЁСШЕГО плагина, а не
 * словарём Host: `editor.label` двух разных плагинов — два разных сообщения. Поэтому словарь
 * лежит здесь (`locales/{ru,en}.json`), а не в `host/services/i18n/locales`.
 *
 * Обратное — тоже правило, и оно проходит не по владельцу строки, а по тому, КТО рисует:
 * тексты диагностик (`errors.<code>`) остаются в словаре Host, потому что одна и та же
 * ошибка обязана выглядеть одинаково в редакторе, в панели проблем и в логе. Их плагин
 * не переводит сам — он просит перевод (см. `MonacoHost.useDiagnosticMessage`).
 *
 * ## Куда словарь регистрируется
 *
 * В `ctx.i18n` — поле контекста, вид сервиса локализации в пространстве имён плагина.
 * Раньше приёмник ИСКАЛСЯ структурно, потому что поля в контексте не было и словарь
 * подставляла композиция параметром; теперь поле есть, и искать нечего.
 *
 * @module plugins/editor-monaco/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';
import type { MessageSink } from './host';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const MONACO_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });

/**
 * Отдаёт словарь приёмнику — по одной локали.
 *
 * Повторный вызов для той же локали словарь ДОПОЛНЯЕТ, а не заменяет, поэтому повторная
 * активация плагина ничего не ломает.
 */
export function contributeMessages(sink: MessageSink): void {
  for (const [locale, messages] of Object.entries(MONACO_MESSAGES)) {
    sink.contribute(locale, messages);
  }
}

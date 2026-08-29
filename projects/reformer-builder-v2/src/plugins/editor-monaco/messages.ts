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
 * По контракту (`docs/plugin-and-shell.md`, «PluginContext») у контекста есть поле `i18n` —
 * вид сервиса локализации в пространстве имён плагина. На момент написания этого модуля
 * поля в собранном контексте ещё нет (`host/plugin/context.ts` честно перечисляет `workspace`
 * и `i18n` как соседние работы Э4). Поэтому приёмник ИЩЕТСЯ: появится штатный `ctx.i18n` —
 * словарь уедет туда сам, не появится — его подставит композиция параметром.
 *
 * Проверка структурная, а не по типу: тип `PluginContext` сегодня поля не объявляет, и
 * дожидаться его, отказавшись от словаря, значило бы показывать маркеры вместо интерфейса.
 *
 * @module plugins/editor-monaco/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';
import type { MessageSink } from './host';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const MONACO_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });

function isMessageSink(value: unknown): value is MessageSink {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<MessageSink>).contribute === 'function'
  );
}

/**
 * Приёмник словаря: сначала штатный `ctx.i18n`, затем подставленный композицией.
 *
 * `null` — регистрировать некуда. Это не отказ активации: без словаря интерфейс покажет
 * маркеры промахов, и они попадутся разработчику раньше, чем пользователю, — то же правило
 * видимости промаха, что и в самом сервисе локализации.
 */
export function resolveMessageSink(ctx: object, fallback?: MessageSink): MessageSink | null {
  const provided = (ctx as { readonly i18n?: unknown }).i18n;
  if (isMessageSink(provided)) return provided;
  return fallback ?? null;
}

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

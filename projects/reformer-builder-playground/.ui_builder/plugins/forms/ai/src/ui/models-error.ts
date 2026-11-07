/**
 * Текст ошибки кнопки «Загрузить список моделей».
 *
 * ## Почему сырого текста мало
 *
 * Локальный сервер, не пустивший страницу по origin, причину не называет. Ollama без адреса
 * страницы в `OLLAMA_ORIGINS` отвечает 403 без CORS-заголовков, и браузер отдаёт странице не статус,
 * а безликий `TypeError` — «Failed to fetch», «Load failed», у каждого браузера свой текст. Тот же
 * `TypeError` получается, когда сервер не запущен или браузер не пустил страницу в локальную сеть.
 * Человек видит «403» во вкладке Network и рабочую Ollama в терминале — и не видит, что исправлять
 * надо настройку сервера. Особенно на опубликованном билдере: с `localhost` Ollama пускает по
 * умолчанию, с GitHub Pages — нет.
 *
 * Поэтому у локального канала к сырому тексту добавлена подсказка с адресом страницы — ровно тем
 * значением, которое нужно разрешить. Облачным каналам она не нужна: их ответ (`401 Unauthorized`)
 * говорит сам за себя.
 *
 * @module plugins/forms/ai/ui/models-error
 */

import { PROVIDER_ORIGIN, type ProviderKind } from '../session/config';
import type { Translate } from '../host';

/** Статус отказа в начале сообщения `listModels` («403 Forbidden»). */
const FORBIDDEN = /^403\b/;

/**
 * Текст для пользователя по ошибке запроса списка моделей.
 *
 * @param cause - что бросил запрос
 * @param kind - вид канала
 * @param pageOrigin - origin страницы билдера, `window.location.origin`
 * @param t - перевод плагина
 */
export function modelsErrorText(
  cause: unknown,
  kind: ProviderKind,
  pageOrigin: string,
  t: Translate
): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  if (PROVIDER_ORIGIN[kind] !== 'loopback') return raw;
  // `TypeError` бросает сам `fetch`, когда ответа не получить: CORS, сервер не запущен, браузер
  // не пустил в локальную сеть. Статус 403 доходит, только если сервер ответил с CORS-заголовками.
  const unreachable = cause instanceof TypeError || FORBIDDEN.test(raw);
  return unreachable ? t('settings.localUnreachable', { origin: pageOrigin, error: raw }) : raw;
}

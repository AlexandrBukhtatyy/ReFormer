/**
 * Медиатип → язык Monaco, и приоритет, с которым редактор берётся за ресурс.
 *
 * ## Почему по медиатипу, а не по расширению
 *
 * Расширение уже разобрала платформа: `ResourceRef.mediaType` — это ответ таблицы расширений
 * ИЛИ то, что сказал источник (`Content-Type` знает больше, чем имя файла). Вторая таблица
 * расширений в плагине разошлась бы с первой на первом же новом типе.
 *
 * ## Почему `canOpen` не читает содержимое
 *
 * Проба существует для тех, кто разбирает файл: редактор схемы формы обязан убедиться,
 * что перед ним схема. Текстовый редактор кода берётся за всё, что читается ТЕКСТОМ, —
 * этот вопрос медиатип закрывает целиком, а чтение ради ответа «да» стоило бы разбора
 * содержимого на каждое открытие.
 *
 * ## Приоритет
 *
 * {@link MONACO_EDITOR_PRIORITY} больше приоритета временного редактора на `textarea`
 * (`plugins/files`, приоритет 1) — и этого достаточно: при равном приоритете победил бы
 * тот, кто раньше в реестре, то есть порядок активации плагинов стал бы значимым.
 * Меньше — у любого, кто знает про содержимое больше: структурный редактор схемы формы
 * обязан выигрывать у текстового на том же файле.
 *
 * @module plugins/editor-monaco/runtime/language
 */

/** Язык для всего, чему не нашлось разметки: подсветки нет, редактор работает. */
export const PLAIN_TEXT_LANGUAGE = 'plaintext';

/**
 * Приоритет вклада редактора.
 *
 * Десять, а не два: между текстовым редактором и Monaco могут появиться промежуточные
 * (просмотрщик логов, редактор `.env`), и оставлять им зазор дешевле, чем потом
 * переномеровывать всех.
 */
export const MONACO_EDITOR_PRIORITY = 10;

/**
 * Медиатип → идентификатор языка Monaco.
 *
 * Список закрыт и совпадает с тем, что реально внесено в `monaco-setup.ts`: язык,
 * которого нет в сборке, Monaco молча покажет без подсветки, и таблица врала бы.
 */
export const LANGUAGE_BY_MEDIA_TYPE: Readonly<Record<string, string | undefined>> = {
  'application/json': 'json',
  'text/typescript': 'typescript',
  'text/typescript-jsx': 'typescript',
  'text/javascript': 'javascript',
  'application/javascript': 'javascript',
  'text/jsx': 'javascript',
  'text/markdown': 'markdown',
  'text/css': 'css',
  'text/html': 'html',
  'application/xml': 'xml',
  'application/yaml': 'yaml',
};

/** Структурный суффикс (RFC 6839) → язык: `application/schema+json` подсвечивается как JSON. */
const LANGUAGE_BY_SUFFIX: Readonly<Record<string, string | undefined>> = {
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
};

/** Приводит к `type/subtype`: нижний регистр, без параметров (`; charset=utf-8`). */
function essence(mediaType: string): string {
  return mediaType.split(';', 1)[0].trim().toLowerCase();
}

/**
 * Язык для медиатипа. Неизвестный — {@link PLAIN_TEXT_LANGUAGE}, а не отказ: файл без
 * подсветки открыть можно, а «редактора нет» на `LICENSE` человек не поймёт.
 */
export function languageFor(mediaType: string): string {
  const type = essence(mediaType);
  const exact = LANGUAGE_BY_MEDIA_TYPE[type];
  if (exact !== undefined) return exact;

  const plus = type.lastIndexOf('+');
  if (plus !== -1) {
    const bySuffix = LANGUAGE_BY_SUFFIX[type.slice(plus + 1)];
    if (bySuffix !== undefined) return bySuffix;
  }
  return PLAIN_TEXT_LANGUAGE;
}

/**
 * Адрес модели Monaco для ресурса.
 *
 * Модель адресуется URI, и брать под него `ResourceId` как есть нельзя: он выглядит
 * как `fs:src/form.json`, а `Uri.parse` разберёт это схемой `fs` с непонятным путём —
 * и два источника с одинаковым путём получат один адрес. Поэтому адрес собирается явно:
 * схема `inmemory`, источник в авторитете пути, дальше сам путь.
 *
 * Расширение сохраняется намеренно: по нему языковая служба JSON сопоставляет схемы
 * (`fileMatch`), и потеря хвоста молча выключила бы подсказки.
 */
export function modelPathFor(ref: { readonly sourceId: string; readonly path: string }): string {
  const source = encodeURIComponent(ref.sourceId);
  const path = ref.path.split('/').map(encodeURIComponent).join('/');
  return `inmemory://document/${source}/${path}`;
}

/**
 * Маркер файла, записанного `form_build`: первая строка `// @reformer-form-build <хэш тела> …`.
 *
 * Из него выводится, чей файл: нетронутый вывод сборки перезаписывается, правленный руками остаётся
 * за человеком. Отдельный реестр разошёлся бы с текстом и не пережил бы `git clone`.
 *
 * В JSON комментариев нет: документ схемы (`form.schema.json`, renderer-json) носит маркер в
 * `meta.description` — единственном свободном текстовом поле, которое мета-схема документа
 * допускает (корень закрыт `additionalProperties: false`), а `id` занят реестрами форм. Хэш у JSON
 * считается по данным без маркера с упорядоченными ключами: переформатирование и порядок ключей,
 * в котором документ сохранит ui-builder, правкой не считаются, а правка в ui-builder — считается.
 *
 * Отличие от `@reformer-generated` в `@reformer/builder-toolkit`: там хэш посимвольный, а этот
 * считается после нормализации. Файлы формы лежат в проекте потребителя, и его `prettier` с
 * `eslint --fix` меняют пробелы, кавычки, висячие запятые и скобки. От посимвольного хэша такой файл
 * выглядел бы правленным и перестал бы собираться. Префикс другой, чтобы билдер не читал чужой хэш.
 *
 * @module reformer-mcp/core/generate/generated-marker
 */

const MARKER_PREFIX = '// @reformer-form-build';
/**
 * Пояснение маркера — первое, что видит агент, открыв файл. Прежнее «собран из form.intent.json;
 * правка руками отсоединит файл» в профиле guided звало мимо сервера: малая модель на правке готовой
 * формы читала файлы затравки и переписывала `model.ts` и `form.schema.ts` руками, ни разу не вызвав
 * `form_start` (батчи 20261114T215823Z-1be3 и …225122Z-f433, ReFormer-f2fs.15). Хэш считается по телу,
 * поэтому смена пояснения не делает старые файлы правлеными.
 */
const MARKER_NOTE =
  'собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит';

/** Чей файл: нетронутый вывод сборки, правленный руками или написанный человеком. */
export type GeneratedOrigin = 'generated' | 'edited' | 'handwritten';

function digest(text: string): string {
  // То, что меняют форматтеры, в хэш не входит. Правка только кавычек или скобок правкой не считается.
  const normalized = text.replace(/[\s,;()'"`]/g, '');
  let first = 0x811c9dc5;
  let second = 0x9dc5811c;
  for (let index = 0; index < normalized.length; index += 1) {
    first = Math.imul(first ^ normalized.charCodeAt(index), 0x01000193) >>> 0;
    second =
      Math.imul(second ^ normalized.charCodeAt(normalized.length - 1 - index), 0x01000193) >>> 0;
  }
  return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
}

function bodyOf(text: string): string {
  return text.startsWith(MARKER_PREFIX) ? text.slice(text.indexOf('\n') + 1) : text;
}

const isJsonPath = (path: string | undefined): boolean => path?.endsWith('.json') === true;

/** Маркер JSON-документа: тот же текст без `// `. */
const JSON_MARKER_PREFIX = MARKER_PREFIX.slice(3);

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON с упорядоченными ключами: хэш не зависит от порядка, в котором документ сохранили. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    isObject(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1)))
      : item
  );
}

/**
 * Тело документа для хэша: без `meta.description` (его место занимает маркер) и без опустевшего
 * `meta`. Одно и то же для записи маркера и для проверки.
 */
function jsonBody(document: JsonObject): JsonObject {
  const { meta, ...body } = document;
  if (!isObject(meta)) return document;
  const { description: _description, ...rest } = meta;
  return Object.keys(rest).length > 0 ? { ...body, meta: rest } : body;
}

function parseObject(text: string): JsonObject | null {
  try {
    const value: unknown = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Приписать маркер к тексту файла. Путь `.json` — маркер в `meta.description` документа; файл,
 * который не разбирается как объект JSON, остаётся без маркера.
 */
export function withMarker(text: string, path?: string): string {
  if (!isJsonPath(path)) return `${MARKER_PREFIX} ${digest(text)} ${MARKER_NOTE}\n${text}`;
  const document = parseObject(text);
  if (document === null) return text;
  const body = jsonBody(document);
  const meta = isObject(body.meta) ? body.meta : {};
  const stamp = `${JSON_MARKER_PREFIX} ${digest(canonical(body))} ${MARKER_NOTE}`;
  const { meta: _meta, ...rest } = body;
  // `meta` — после `format`, как в документах билдера: маркер виден сразу, а не в конце файла.
  const { format, ...tail } = rest;
  const marked = {
    ...(format === undefined ? {} : { format }),
    meta: { ...meta, description: stamp },
    ...tail,
  };
  return `${JSON.stringify(marked, null, 2)}\n`;
}

/** Откуда файл: см. {@link GeneratedOrigin}. Путь `.json` — маркер из `meta.description`. */
export function originOf(text: string, path?: string): GeneratedOrigin {
  if (isJsonPath(path)) {
    const document = parseObject(text);
    const meta = document?.meta;
    const mark = isObject(meta) ? meta.description : undefined;
    if (typeof mark !== 'string' || !mark.startsWith(JSON_MARKER_PREFIX)) return 'handwritten';
    const stamped = mark.slice(JSON_MARKER_PREFIX.length).trim().split(/\s/)[0];
    return stamped === digest(canonical(jsonBody(document as JsonObject))) ? 'generated' : 'edited';
  }
  if (!text.startsWith(MARKER_PREFIX)) return 'handwritten';
  const stamped = text.slice(MARKER_PREFIX.length).trim().split(/\s/)[0];
  return stamped === digest(bodyOf(text)) ? 'generated' : 'edited';
}

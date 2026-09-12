/**
 * Ресурс — ССЫЛКА на нечто в источнике, а не его содержимое.
 *
 * В v1 дескриптор файла нёс на себе чтение и запись, был привязан к живому источнику и
 * поэтому растёкся по стору, панелям, корпусу знаний и кодогену: любой, кто держал ссылку,
 * держал и канал ввода-вывода. Здесь ресурс — описание, которое можно положить в стор,
 * сериализовать и сравнить; чтение и запись живут в Workspace, который появится в Э2.
 *
 * Модуль владеет двумя вещами, которые нельзя отдавать адаптерам источников:
 *
 * - **нормализацией путей** — иначе два адаптера разойдутся в трактовке `..` и это вскроется
 *   на третьем. Адаптеру остаётся смысл пути (что он адресует), а не его форма;
 * - **таблицей расширений** — она решает ровно один вопрос: текст или байты (и подсветку).
 *   Вопрос «что это за документ» здесь не решается вовсе: `.json` бывает и схемой формы,
 *   и конфигом пакета, и как транспорт он однозначен в обоих случаях. Кто откроет файл —
 *   решает редактор по успеху разбора.
 *
 * @module shell/platform/primitives/resource
 */

/**
 * Непрозрачный идентификатор ресурса. Формат — `<sourceId>:<path>`.
 *
 * Сравнивать только целиком: у файловой системы внутри путь, у HTTP-источника — то,
 * что вернул сервер, и потребитель не должен их различать. Разбирать идентификатор
 * позволено только {@link parseResourceId} — и то потому, что путевая арифметика
 * (резолвер импортов, дерево, листинг) без этого невозможна.
 */
export type ResourceId = string;

/** Ссылка на ресурс: то, что можно хранить и передавать, не удерживая источник. */
export interface ResourceRef {
  readonly id: ResourceId;
  readonly sourceId: string;
  /** Путь внутри источника: разделитель `/`, без ведущего слэша, нормализован. */
  readonly path: string;
  /** Последний сегмент пути. Дублирует `path` намеренно — списки рисуют именно его. */
  readonly name: string;
  readonly kind: 'file' | 'directory';
  /** `application/json`, `text/typescript`, `text/markdown`, `image/png`… */
  readonly mediaType: string;
}

/**
 * Свойства материализованного ресурса.
 *
 * Отдельно от {@link ResourceRef} по времени жизни: ссылка стабильна, а это — нет.
 * Смешать их означало бы, что каждая перепроверка размера меняет объект, на который
 * подписан UI.
 */
export interface ResourceStat {
  readonly kind: 'file' | 'directory';
  /**
   * Непрозрачный маркер версии: ETag, mtime, хеш — что дал источник.
   * Сравнивается ТОЛЬКО на равенство: «новее» вычислить нельзя, а конфликт — можно.
   */
  readonly revision?: string;
  readonly size?: number;
  readonly mediaType?: string;
}

/** Разделитель источника и пути в {@link ResourceId}. */
const RESOURCE_ID_SEPARATOR = ':';

/**
 * Собирает идентификатор из источника и пути, попутно нормализуя путь.
 *
 * Нормализация здесь, а не у вызывающего: иначе `fs:./a` и `fs:a` окажутся разными ключами
 * одного и того же ресурса, и кэш Workspace материализует его дважды.
 *
 * @throws если `sourceId` пуст или содержит `:` (разбор идёт по первому двоеточию,
 *   и такой идентификатор нельзя было бы разобрать обратно), либо если путь выходит за корень.
 */
export function makeResourceId(sourceId: string, path: string): ResourceId {
  if (sourceId === '') throw new Error('идентификатор источника не может быть пустым');
  if (sourceId.includes(RESOURCE_ID_SEPARATOR)) {
    throw new Error(`идентификатор источника не может содержать ':': ${sourceId}`);
  }
  return `${sourceId}${RESOURCE_ID_SEPARATOR}${normalizePath(path)}`;
}

/**
 * Разбирает идентификатор на источник и путь.
 *
 * Делит по ПЕРВОМУ двоеточию: `:` — легальный символ имени файла, а в `sourceId` он запрещён
 * ({@link makeResourceId}), поэтому неоднозначности нет.
 *
 * Путь нормализуется и на разборе — идентификатор мог прийти извне (из хранилища, из ссылки,
 * из ответа источника), и `fs:../../etc/hosts` обязан быть отвергнут здесь, а не в адаптере,
 * где проверку легко забыть.
 *
 * @throws если строка не похожа на идентификатор ресурса или путь выходит за корень.
 */
export function parseResourceId(id: ResourceId): {
  readonly sourceId: string;
  readonly path: string;
} {
  const at = id.indexOf(RESOURCE_ID_SEPARATOR);
  if (at <= 0) throw new Error(`не идентификатор ресурса: ${id}`);
  return { sourceId: id.slice(0, at), path: normalizePath(id.slice(at + 1)) };
}

/**
 * Приводит путь к канонической форме: разделитель `/`, без ведущего и хвостового слэша,
 * без пустых сегментов и `.`, с разрешёнными `..`.
 *
 * Корень источника — пустая строка: `''`, `'.'`, `'/'` дают один и тот же путь.
 *
 * @throws если `..` уводит выше корня источника. Это не педантизм: путь приходит из ответа
 *   источника, из импорта внутри схемы и из ассистента, и молчаливое схлопывание такого
 *   пути к корню превратило бы побег в обычное чтение.
 */
export function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) throw new Error(`путь выходит за корень источника: ${path}`);
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

/**
 * Склеивает сегменты и нормализует результат.
 *
 * Это же и «резолв» для резолвера импортов: `joinPath(dirname(schema), './validation')`
 * даёт путь соседа, а побег за корень отсекается нормализацией.
 */
export function joinPath(...segments: readonly string[]): string {
  return normalizePath(segments.join('/'));
}

/** Родительский каталог. Для ресурса верхнего уровня — корень источника, пустая строка. */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const at = normalized.lastIndexOf('/');
  return at === -1 ? '' : normalized.slice(0, at);
}

/** Последний сегмент пути. Для корня — пустая строка. */
export function basename(path: string): string {
  const normalized = normalizePath(path);
  const at = normalized.lastIndexOf('/');
  return at === -1 ? normalized : normalized.slice(at + 1);
}

/**
 * Расширение вместе с точкой (`.json`) или пустая строка.
 *
 * Ведущая точка — часть имени скрытого файла, а не расширение: у `.gitignore` расширения нет.
 * Из `schema.d.ts` берётся только `.ts` — составные расширения таблица не различает, и это
 * достаточно: `.d.ts` и `.ts` читаются одинаково.
 */
export function extname(path: string): string {
  const name = basename(path);
  const at = name.lastIndexOf('.');
  return at <= 0 ? '' : name.slice(at);
}

/**
 * Путь `to`, записанный относительно РЕСУРСА `from` — то есть относительно каталога,
 * в котором `from` лежит.
 *
 * База — именно ресурс, а не каталог, потому что единственный потребитель — резолвер
 * импортов, а импорт написан внутри файла: `../shared/rules` в `src/forms/credit/schema.json`
 * означает `src/forms/shared/rules`.
 *
 * Результат всегда начинается с `./` или `..` — без префикса `shared/rules` читался бы
 * как имя пакета, а не как сосед.
 */
export function relativePath(from: string, to: string): string {
  const fromDir = dirname(from);
  const target = normalizePath(to);
  const fromSegments = fromDir === '' ? [] : fromDir.split('/');
  const toSegments = target === '' ? [] : target.split('/');

  let common = 0;
  while (
    common < fromSegments.length &&
    common < toSegments.length &&
    fromSegments[common] === toSegments[common]
  ) {
    common += 1;
  }

  const ups = fromSegments.length - common;
  const down = toSegments.slice(common);
  if (ups === 0) return down.length === 0 ? '.' : `./${down.join('/')}`;
  return [...Array.from({ length: ups }, () => '..'), ...down].join('/');
}

/**
 * Расширение → медиатип. Таблица отвечает на один вопрос: текст или байты (и какая подсветка).
 *
 * Она сознательно не полна и не должна расти «на всякий случай»: неизвестное расширение —
 * это {@link DEFAULT_MEDIA_TYPE}, и источник всё равно может переопределить ответ.
 */
export const MEDIA_TYPE_BY_EXTENSION: Readonly<Record<string, string | undefined>> = {
  // Текст: то, из чего состоит форма.
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.json': 'application/json',
  '.map': 'application/json',
  '.ts': 'text/typescript',
  '.mts': 'text/typescript',
  '.cts': 'text/typescript',
  '.tsx': 'text/typescript-jsx',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.cjs': 'text/javascript',
  '.jsx': 'text/jsx',
  '.css': 'text/css',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.toml': 'application/toml',
  '.csv': 'text/csv',
  // Байты: всё, что в предпросмотре только показывается.
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.wasm': 'application/wasm',
};

/**
 * Ответ для неизвестного расширения.
 *
 * Текст, а не `application/octet-stream`: файлы без узнаваемого расширения — это `LICENSE`,
 * `.editorconfig`, `.prettierrc` и прочие конфиги, то есть текст, а бинарные форматы как раз
 * всегда носят расширение из таблицы. Обратный выбор запретил бы `readText` там, где он нужен
 * чаще всего.
 */
export const DEFAULT_MEDIA_TYPE = 'text/plain';

/** `type/subtype` без параметров: `text/plain`, `image/svg+xml`. */
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

/**
 * Приводит медиатип к нижнему регистру и отбрасывает параметры (`; charset=utf-8`).
 *
 * `null` — «это не медиатип»: пустая подсказка, `Content-Type: binary` и прочий мусор.
 * Различать «источник промолчал» и «источник соврал» не нужно — оба случая означают
 * «спрашивай расширение».
 */
function normalizeMediaType(value: string | undefined): string | null {
  if (value === undefined) return null;
  const essence = value.split(';', 1)[0].trim().toLowerCase();
  return MEDIA_TYPE_PATTERN.test(essence) ? essence : null;
}

/**
 * Медиатип ресурса: основа — расширение, подсказка источника имеет приоритет.
 *
 * Приоритет именно такой, потому что источник знает больше: `Content-Type` HTTP-ответа —
 * это факт о содержимом, а расширение — догадка по имени. Нераспознаваемая подсказка
 * игнорируется, и ответ падает обратно на таблицу.
 *
 * @param path путь ресурса; для {@link ResourceRef} — его `path`.
 * @param hint то, что сказал источник (заголовок `Content-Type` или его аналог).
 */
export function mediaTypeFor(path: string, hint?: string): string {
  const fromSource = normalizeMediaType(hint);
  if (fromSource !== null) return fromSource;
  return MEDIA_TYPE_BY_EXTENSION[extname(path).toLowerCase()] ?? DEFAULT_MEDIA_TYPE;
}

/** Медиатипы поверх текста, которые не начинаются с `text/`. */
const TEXTUAL_TYPES: ReadonlySet<string> = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/ecmascript',
  'application/yaml',
  'application/toml',
  'application/sql',
  'application/graphql',
]);

/** Суффиксы структурного синтаксиса (RFC 6839): `image/svg+xml` — текст, что бы ни было слева. */
const TEXTUAL_SUFFIXES: readonly string[] = ['json', 'xml', 'yaml'];

/**
 * Можно ли читать такой ресурс текстом.
 *
 * Единственный вопрос, на который отвечает медиатип в контуре чтения: `readText` бинарного
 * ресурса обязан быть отказом, а не набором мусорных символов — тихая порча данных хуже отказа.
 */
export function isTextMediaType(mediaType: string): boolean {
  const normalized = normalizeMediaType(mediaType);
  if (normalized === null) return false;
  if (normalized.startsWith('text/')) return true;

  const plus = normalized.lastIndexOf('+');
  if (plus !== -1 && TEXTUAL_SUFFIXES.includes(normalized.slice(plus + 1))) return true;

  return TEXTUAL_TYPES.has(normalized);
}

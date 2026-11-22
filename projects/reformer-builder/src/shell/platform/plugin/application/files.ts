/**
 * Плагины ПРИЛОЖЕНИЯ как слой файлов для загрузчика.
 *
 * Третий слой, рядом с каталогом проекта и установленными из npm. Отличается от обоих тем,
 * КТО его выбрал: набор едет вместе с приложением — его кладёт рядом со сборкой тот, кто
 * приложение разворачивает (лаунчер, сборка для поставки, статический хостинг). Отсюда
 * и доверие: это уровень запуска, тот же, что у встроенных плагинов и конфига запуска.
 *
 * Загрузчик умеет читать плагины из чего угодно, что отвечает на четыре вопроса
 * ({@link PluginFilesSource}). Здесь на них отвечает HTTP — с одной оговоркой: «дай список
 * каталога» по HTTP не спросить. Поэтому список файлов приезжает ИНДЕКСОМ, одним файлом рядом
 * с плагинами, а чтение файла — обычный запрос по его адресу.
 *
 * ## Индекса нет — слоя нет
 *
 * Приложение без своих плагинов законно: билдер под `vite dev` и чистая оболочка другого
 * приложения. Отсутствие индекса поэтому не отказ и не предупреждение. Dev-сервер и лаунчер
 * отвечают на неизвестный путь страницей приложения — такой ответ читается так же, как 404.
 *
 * ## Живой каталог называет ревизии
 *
 * Обычно слой не меняется, пока приложение работает: его положили рядом со сборкой. Но каталог
 * бывает и живым — каталог разрабатываемых плагинов, который сервер отдаёт с диска (флаг
 * `--plugins` лаунчера, плагин dev-сервера приложения). Такой сервер дописывает к индексу
 * ревизию каждого плагина; по ним наблюдатель (`./live`) узнаёт, что плагин пересобрали.
 * Нет ревизий — слой неизменный, и наблюдать нечего.
 *
 * ## Исполнение не спрашивает проект
 *
 * У установленных из npm право исполнять код принадлежит открытому проекту (`../installed/files`):
 * их ставил человек, и read-only проект вправе их не запускать. Плагины приложения — часть
 * самого приложения: они работают и без открытого проекта, как встроенные.
 *
 * @module shell/platform/plugin/application/files
 */

import type { Entry } from '@/shell/platform/source/types';
import { SourceError } from '@/shell/platform/source/errors';
import type { PluginFilesSource } from '../loader';

/** Имя слоя в сообщениях об отказе. */
export const APPLICATION_SOURCE_ID = 'application';

/** Корень слоя: каталог, в который смотрит загрузчик, и он же каталог рядом с приложением. */
export const APPLICATION_ROOT_DIR = 'plugins';

/** Файл индекса внутри каталога плагинов приложения. */
export const APPLICATION_INDEX_FILE = 'index.json';

/** Версия формата индекса. Чужую версию приложение не читает: молча угадывать формат нельзя. */
export const APPLICATION_INDEX_VERSION = 1;

/**
 * Индекс каталога плагинов приложения: пути всех его файлов от корня каталога.
 *
 * Плоский список, а не дерево и не «плагин → файлы»: раскладку (плагин верхнего уровня, каталог
 * домена) разбирает загрузчик, и индекс, знающий её, был бы вторым местом, где она описана.
 */
export interface ApplicationPluginIndex {
  readonly version: typeof APPLICATION_INDEX_VERSION;
  readonly files: readonly string[];
  /**
   * Каталог плагина от корня слоя → ревизия его файлов. Только у живого каталога.
   *
   * Ревизия — непрозрачный маркер, сравнимый лишь на равенство, как ревизия источника.
   */
  readonly revisions?: Readonly<Record<string, string>>;
}

/** Слой приложения как источник файлов — и то, что он знает о своих версиях. */
export interface ApplicationFilesSource extends PluginFilesSource {
  /** Ревизии плагинов живого каталога; `undefined` — слой неизменный. */
  readonly revisions?: ReadonlyMap<string, string>;
}

/** Путь индекса: относительный, с разделителем `/`, без выхода за корень. */
function isIndexPath(value: unknown): value is string {
  if (typeof value !== 'string' || value === '' || value.includes('\\')) return false;
  return value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

/** Ревизии индекса; `undefined` — их нет либо записаны они не так, и каталог считается неизменным. */
function parseRevisions(value: unknown): Readonly<Record<string, string>> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  const valid = entries.every(
    ([dir, revision]) => isIndexPath(dir) && typeof revision === 'string' && revision !== ''
  );
  return valid ? Object.fromEntries(entries) : undefined;
}

/** Разбирает индекс; `null` — это не индекс известной версии. */
export function parseApplicationPluginIndex(value: unknown): ApplicationPluginIndex | null {
  if (typeof value !== 'object' || value === null) return null;
  const { version, files, revisions } = value as {
    version?: unknown;
    files?: unknown;
    revisions?: unknown;
  };
  if (version !== APPLICATION_INDEX_VERSION || !Array.isArray(files)) return null;
  if (!files.every(isIndexPath)) return null;
  const parsed = parseRevisions(revisions);
  return {
    version: APPLICATION_INDEX_VERSION,
    files,
    ...(parsed === undefined ? {} : { revisions: parsed }),
  };
}

export interface ApplicationFilesDeps {
  /** Адрес каталога плагинов приложения. Хвостовой слэш не обязателен. */
  readonly baseUrl: string;
  readonly index: ApplicationPluginIndex;
  /** Параметр ради тестов. */
  readonly fetch?: typeof fetch;
}

/** Путь внутри слоя → путь от корня каталога плагинов; `undefined` — путь не этого слоя. */
function relative(path: string): string | undefined {
  const parts = path.split('/').filter((part) => part !== '');
  if (parts[0] !== APPLICATION_ROOT_DIR) return undefined;
  return parts.slice(1).join('/');
}

const withSlash = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

export function createApplicationFiles(deps: ApplicationFilesDeps): ApplicationFilesSource {
  const fetchFn = deps.fetch ?? fetch;
  const baseUrl = withSlash(deps.baseUrl);
  const files = new Set(deps.index.files);
  const revisions =
    deps.index.revisions === undefined ? undefined : new Map(Object.entries(deps.index.revisions));

  return {
    id: APPLICATION_SOURCE_ID,
    capabilities: { executesCode: true },
    ...(revisions === undefined ? {} : { revisions }),

    list(dir: string): Promise<readonly Entry[]> {
      const inside = relative(dir);
      if (inside === undefined) {
        // «Каталога нет» — не то же, что «он пуст»: загрузчик различает их.
        return Promise.reject(
          new SourceError('not-found', `слой приложения не знает каталога «${dir}»`, { path: dir })
        );
      }
      const prefix = inside === '' ? '' : `${inside}/`;
      const names = new Map<string, Entry['kind']>();
      for (const file of files) {
        if (!file.startsWith(prefix)) continue;
        const tail = file.slice(prefix.length);
        const slash = tail.indexOf('/');
        names.set(slash === -1 ? tail : tail.slice(0, slash), slash === -1 ? 'file' : 'directory');
      }
      if (names.size === 0 && inside !== '') {
        return Promise.reject(new SourceError('not-found', `каталога «${dir}» нет`, { path: dir }));
      }
      const root = `${APPLICATION_ROOT_DIR}/${prefix}`;
      return Promise.resolve([...names].map(([name, kind]) => ({ name, path: root + name, kind })));
    },

    async read(path: string): Promise<{ readonly text: string }> {
      const inside = relative(path);
      // Файла нет в индексе — запроса нет: загрузчик пробует манифест в каждом каталоге,
      // и ходить в сеть за заведомо отсутствующим значило бы платить запросом за вопрос.
      if (inside === undefined || !files.has(inside)) {
        throw new SourceError('not-found', `в слое приложения нет «${path}»`, { path });
      }
      const url = baseUrl + inside.split('/').map(encodeURIComponent).join('/');
      let response: Response;
      try {
        response = await fetchFn(url, { cache: 'no-cache' });
      } catch (error) {
        throw new SourceError('network', `файл «${path}» не получен: сеть недоступна`, {
          path,
          cause: error,
        });
      }
      if (!response.ok) {
        throw new SourceError(
          response.status === 404 ? 'not-found' : 'network',
          `файл «${path}» не получен: ответ ${response.status}`,
          { path }
        );
      }
      return { text: await response.text() };
    },
  };
}

export interface LoadApplicationFilesDeps {
  /** Адрес каталога плагинов приложения. */
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
}

/**
 * Читает индекс и отдаёт слой; `null` — у приложения нет своих плагинов.
 *
 * Не бросает: слой необязателен, и отказ сети при его чтении не должен стоить запуска.
 * Битый индекс — другое дело: файл положили намеренно, и молчать о нём значило бы оставить
 * приложение без плагинов без объяснения. О нём сказано в консоль — словарей и уведомлений
 * в этот момент ещё нет.
 */
export async function loadApplicationFiles(
  deps: LoadApplicationFilesDeps
): Promise<ApplicationFilesSource | null> {
  const fetchFn = deps.fetch ?? fetch;
  const url = withSlash(deps.baseUrl) + APPLICATION_INDEX_FILE;
  let payload: unknown;
  try {
    const response = await fetchFn(url, { cache: 'no-cache' });
    if (!response.ok) return null;
    // Страница приложения вместо индекса: сервер отвечает ею на неизвестный путь.
    if (!(response.headers.get('content-type') ?? '').includes('json')) return null;
    payload = await response.json();
  } catch {
    return null;
  }
  const index = parseApplicationPluginIndex(payload);
  if (index === null) {
    console.warn(`[plugins] индекс плагинов приложения «${url}» не разобран — слой пропущен`);
    return null;
  }
  return createApplicationFiles({
    baseUrl: deps.baseUrl,
    index,
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
  });
}

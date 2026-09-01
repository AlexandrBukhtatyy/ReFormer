/**
 * Раскладка хранилища рабочей области — чистые функции над путями и ключами.
 *
 * ```text
 * OPFS                              IndexedDB
 * └── ws/{workspaceId}/             ├── workspaces  дескриптор источника, настройки
 *     ├── files/<путь>              ├── opened      вкладки, закрепление, состояние вида
 *     └── base/<путь>               ├── stats       revision и размер по пути
 *                                   └── history     снимки отмены, журнал операций
 * ```
 *
 * **Путь зеркалит структуру проекта, а не кодирует её в имя.** В v1 рабочая копия жила
 * в `workdirs/<encodeURIComponent(tabId)>/` — плоский каталог на вкладку. Это и есть дефект,
 * который здесь чинится: форма, импортирующая файл из соседнего каталога, никогда не собиралась,
 * потому что соседа в плоском каталоге просто нет, а `../shared/rules` из закодированного имени
 * не резолвится ничем. Здесь `src/forms/credit/schema.json` лежит в
 * `ws/{id}/files/src/forms/credit/schema.json`, и арифметика сегментов резолвера импортов
 * работает над хранилищем без единой правки.
 *
 * **Почему BASE — отдельное зеркало, а не поле рядом с содержимым.** Слои устроены одинаково
 * и адресуются одним и тем же путём ресурса, поэтому переход между ними — чистая функция
 * ({@link counterpartPath}), а вытеснение парой ({@link counterpartLayer}) не требует индекса.
 * Почему BASE вообще хранится содержимым — см. `opfs.ts`.
 *
 * Модуль намеренно не делает ввода-вывода: всё, что здесь есть, проверяется тестами в `node`,
 * где ни OPFS, ни IndexedDB нет.
 *
 * @module shell/platform/workspace/storage/layout
 */

import { normalizePath, type ResourceId } from '@/shell/platform/primitives/resource';
import { StorageError } from './errors';

/** Корень всех рабочих областей внутри OPFS. */
export const WORKSPACE_ROOT_DIR = 'ws';

/**
 * Слой хранения.
 *
 * - `files` — материализованное содержимое, то, что видит редактор и компилятор;
 * - `base` — содержимое, каким его отдал источник, основание трёхстороннего слияния.
 */
export type StorageLayer = 'files' | 'base';

/** Оба слоя в порядке, в котором их обходят при удалении и вытеснении. */
export const STORAGE_LAYERS: readonly StorageLayer[] = ['files', 'base'];

/**
 * Проверяет, что идентификатор рабочей области — один сегмент пути.
 *
 * Не кодируем, а отвергаем: кодирование сделало бы {@link parseStoragePath} неоднозначным
 * (`ws%2Fx` и `ws/x` схлопнулись бы), а идентификатор мы порождаем сами — значит, требование
 * к нему можно предъявить, а не обходить.
 *
 * @throws {StorageError} `bad-workspace-id`
 */
export function assertWorkspaceId(workspaceId: string): string {
  const bad =
    workspaceId === '' ||
    workspaceId === '.' ||
    workspaceId === '..' ||
    workspaceId.includes('/') ||
    workspaceId.includes('\\') ||
    workspaceId.includes(String.fromCharCode(0));
  if (bad) {
    throw new StorageError(
      'bad-workspace-id',
      `идентификатор рабочей области обязан быть одним сегментом пути: ${JSON.stringify(workspaceId)}`
    );
  }
  return workspaceId;
}

/** Корень рабочей области: `ws/{id}`. */
export function workspaceRoot(workspaceId: string): string {
  return `${WORKSPACE_ROOT_DIR}/${assertWorkspaceId(workspaceId)}`;
}

/** Корень слоя: `ws/{id}/files` или `ws/{id}/base`. */
export function layerRoot(workspaceId: string, layer: StorageLayer): string {
  return `${workspaceRoot(workspaceId)}/${layer}`;
}

/**
 * Путь ресурса внутри хранилища: `ws/{id}/{layer}/{path}`.
 *
 * Путь ресурса нормализуется ОТДЕЛЬНО и до склейки — это не стилистика, а граница безопасности.
 * `joinPath('ws/x/files', '../../../etc/hosts')` дал бы `etc/hosts`: побег из рабочей области,
 * который нормализация склеенного пути пропускает, потому что за корень OPFS он не выходит.
 * `normalizePath('../../../etc/hosts')` бросает — и путь, пришедший из ответа источника,
 * из импорта внутри схемы или от ассистента, отсекается здесь, а не «где-нибудь ниже».
 *
 * @param path путь ресурса внутри источника; пустой путь адресует сам корень слоя.
 */
export function storagePath(workspaceId: string, layer: StorageLayer, path: string): string {
  const root = layerRoot(workspaceId, layer);
  const relative = normalizePath(path);
  return relative === '' ? root : `${root}/${relative}`;
}

/** Второй слой той же пары: `files` ↔ `base`. */
export function counterpartLayer(layer: StorageLayer): StorageLayer {
  return layer === 'files' ? 'base' : 'files';
}

/**
 * Тот же ресурс в соседнем слое.
 *
 * Нужен вытеснению: BASE живёт, пока ресурс материализован, поэтому выбрасываются они парой —
 * выброшенный в одиночку BASE означал бы потерю возможности слияния.
 *
 * @returns `null`, если это не путь внутри рабочей области.
 */
export function counterpartPath(path: string): string | null {
  const parsed = parseStoragePath(path);
  if (parsed === null) return null;
  return storagePath(parsed.workspaceId, counterpartLayer(parsed.layer), parsed.path);
}

/** Разобранный путь хранилища. */
export interface ParsedStoragePath {
  readonly workspaceId: string;
  readonly layer: StorageLayer;
  /** Путь ресурса внутри источника — то, чем его адресует Workspace. */
  readonly path: string;
}

/**
 * Разбирает путь хранилища обратно на рабочую область, слой и путь ресурса.
 *
 * Возвращает `null`, а не бросает: разбор применяется к тому, что нашлось в OPFS при уборке,
 * и чужой каталог там — обычное дело, а не ошибка вызывающего.
 */
export function parseStoragePath(path: string): ParsedStoragePath | null {
  const segments = normalizePath(path)
    .split('/')
    .filter((s) => s !== '');
  if (segments.length < 3) return null;
  if (segments[0] !== WORKSPACE_ROOT_DIR) return null;
  const layer = segments[2];
  if (layer !== 'files' && layer !== 'base') return null;
  return { workspaceId: segments[1], layer, path: segments.slice(3).join('/') };
}

/** Лежит ли путь внутри рабочей области (в любом её слое). */
export function isInsideWorkspace(path: string, workspaceId: string): boolean {
  const root = workspaceRoot(workspaceId);
  const normalized = normalizePath(path);
  return normalized === root || normalized.startsWith(`${root}/`);
}

/*
 * Ключи IndexedDB.
 *
 * Составные ключи, а не склейка в строку: разделитель в склейке пришлось бы запрещать в путях,
 * а `:` и `/` в них законны. Массив сравнивается IndexedDB посегментно, и порядок ключей
 * `[workspaceId, resourceId, seq]` сам даёт журналу нужную группировку.
 */

/** Ключ записи об открытом ресурсе. */
export type OpenedKey = [workspaceId: string, resourceId: ResourceId];

/** Ключ записи свойств ресурса. */
export type StatKey = [workspaceId: string, path: string];

/** Ключ записи журнала. */
export type HistoryKey = [workspaceId: string, resourceId: ResourceId, seq: number];

/** Ключ вкладки. Идентификатор ресурса непрозрачен и в ключ идёт как есть. */
export function openedKey(workspaceId: string, resourceId: ResourceId): OpenedKey {
  return [assertWorkspaceId(workspaceId), resourceId];
}

/** Ключ свойств. Путь нормализуется: иначе `a//b` и `a/b` стали бы двумя записями об одном файле. */
export function statKey(workspaceId: string, path: string): StatKey {
  return [assertWorkspaceId(workspaceId), normalizePath(path)];
}

/** Ключ записи журнала. `seq` монотонен в пределах рабочей области. */
export function historyKey(workspaceId: string, resourceId: ResourceId, seq: number): HistoryKey {
  return [assertWorkspaceId(workspaceId), resourceId, seq];
}

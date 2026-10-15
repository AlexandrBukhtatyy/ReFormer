/**
 * Перенос старой раскладки OPFS внутрь пространства имён.
 *
 * До пространства имён (`namespace.ts`) билдер держал три каталога в корне источника: `ws/`
 * (рабочие копии), `build/` (кэш сборки), `plugins/` (установленные плагины). Теперь они живут
 * под `reformer-builder/`, и то, что успело накопиться в корне, переезжает — один раз, при
 * первом обращении к корню.
 *
 * ## Имена старой раскладки — литералы, а не константы живых модулей
 *
 * Старая раскладка — исторический факт: если `WORKSPACE_ROOT_DIR` когда-нибудь переименуют,
 * перенос обязан по-прежнему искать `ws`. Ссылка на живую константу сломала бы перенос ровно
 * в тот момент, когда он нужен.
 *
 * ## Чужое не трогается
 *
 * Корень источника во встроенном режиме общий с приложением, а имена `ws`, `build`, `plugins`
 * общие. Поэтому каждый каталог узнаётся по признаку НАШЕЙ раскладки и без признака остаётся
 * на месте: рабочая область — по слою `files` или `base` внутри, установленные — по записи
 * `installed.json`, кэш сборки — по тому, что в каталогах областей нет ничего, кроме версий.
 * Кэш не переносится, а удаляется: терять в нём нечего (см. шапку `build-cache.ts`).
 *
 * ## Копирование, а не перемещение, и «существующее не перезаписывать»
 *
 * Переместить каталог в OPFS нечем: `move()` есть только у файлов и только в Chromium. Поэтому
 * копия файл за файлом, а файл, который в новом месте уже лежит непустым, не перезаписывается:
 * оборванная копия (закрытая вкладка, вторая вкладка, успевшая раньше) доделывается, а не
 * переписывается, и более свежая запись нового хранилища не затирается старой. Пустой файл
 * считается не скопированным — `getFileHandle({ create })` заводит пустышку ДО записи, и обрыв
 * между ними оставил бы её сходить за готовую копию.
 *
 * ## Не бросает
 *
 * Отказ переноса — не отказ запуска: старое остаётся в корне до следующей попытки, а билдер
 * работает с тем, что уже внутри. Поэтому любая ошибка — `console.warn`, а не исключение,
 * и отказ одной части (рабочих копий) не отменяет остальных (плагинов, кэша).
 *
 * @module shell/platform/workspace/storage/legacy-layout
 */

import type { OpfsDirectoryHandle, OpfsFileHandle } from './opfs';

/** Старые имена в корне источника. Литералы — см. шапку. */
const LEGACY_WORKSPACES_DIR = 'ws';
const LEGACY_BUILD_DIR = 'build';
const LEGACY_PLUGINS_DIR = 'plugins';

/** Признаки нашей раскладки внутри старых каталогов. */
const LEGACY_LAYERS: readonly string[] = ['files', 'base'];
const LEGACY_INSTALLED_STATE = 'installed.json';
const LEGACY_BUILD_VERSION = /^v\d+$/;

type OpfsEntry = OpfsFileHandle | OpfsDirectoryHandle;

/**
 * Переносит старую раскладку из `origin` (корень источника) в `target` (корень билдера).
 *
 * Идемпотентно: повторный вызов на уже перенесённом ничего не делает.
 */
export async function adoptLegacyLayout(
  origin: OpfsDirectoryHandle,
  target: OpfsDirectoryHandle
): Promise<void> {
  await step('рабочие копии', () => adoptWorkspaces(origin, target));
  await step('установленные плагины', () => adoptPlugins(origin, target));
  await step('кэш сборки', () => dropBuildCache(origin));
}

async function step(what: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    console.warn(
      `[storage] перенос старой раскладки OPFS (${what}) не прошёл — старое оставлено на месте`,
      error
    );
  }
}

/** `ws/{id}/{files,base}` → `target/ws/{id}/…`; каталоги без слоёв — чужие, остаются. */
async function adoptWorkspaces(
  origin: OpfsDirectoryHandle,
  target: OpfsDirectoryHandle
): Promise<void> {
  const legacy = await directoryOf(origin, LEGACY_WORKSPACES_DIR);
  if (legacy === null) return;

  const entries = await entriesOf(legacy);
  const ours: OpfsDirectoryHandle[] = [];
  for (const entry of entries) {
    if (entry.kind === 'directory' && (await hasAnyDirectory(entry, LEGACY_LAYERS))) {
      ours.push(entry);
    }
  }

  if (ours.length > 0) {
    const destination = await target.getDirectoryHandle(LEGACY_WORKSPACES_DIR, { create: true });
    for (const workspace of ours) {
      await copyTree(
        workspace,
        await destination.getDirectoryHandle(workspace.name, { create: true })
      );
      await legacy.removeEntry(workspace.name, { recursive: true });
    }
  }
  // Осталось чужое — каталог не наш целиком, и его запись в корне трогать нельзя.
  if (ours.length === entries.length) await removeQuietly(origin, LEGACY_WORKSPACES_DIR);
}

/** `plugins/` с записью `installed.json` → `target/plugins/`; без записи — чужой. */
async function adoptPlugins(
  origin: OpfsDirectoryHandle,
  target: OpfsDirectoryHandle
): Promise<void> {
  const legacy = await directoryOf(origin, LEGACY_PLUGINS_DIR);
  if (legacy === null) return;
  if ((await fileOf(legacy, LEGACY_INSTALLED_STATE)) === null) return;

  await copyTree(legacy, await target.getDirectoryHandle(LEGACY_PLUGINS_DIR, { create: true }));
  await removeQuietly(origin, LEGACY_PLUGINS_DIR);
}

/** `build/{id}/v1/…` — удаляется целиком; каталог с чем-то, кроме версий, — чужой. */
async function dropBuildCache(origin: OpfsDirectoryHandle): Promise<void> {
  const legacy = await directoryOf(origin, LEGACY_BUILD_DIR);
  if (legacy === null) return;

  for (const entry of await entriesOf(legacy)) {
    if (entry.kind !== 'directory' || !(await holdsOnlyVersions(entry))) {
      console.warn(
        `[storage] каталог «${LEGACY_BUILD_DIR}» в корне источника не похож на кэш сборки — оставлен`
      );
      return;
    }
  }
  await removeQuietly(origin, LEGACY_BUILD_DIR);
}

async function holdsOnlyVersions(dir: OpfsDirectoryHandle): Promise<boolean> {
  for (const entry of await entriesOf(dir)) {
    if (entry.kind !== 'directory' || !LEGACY_BUILD_VERSION.test(entry.name)) return false;
  }
  return true;
}

/** Дерево `src` внутрь `dst`: каталоги доделываются, непустые файлы не перезаписываются. */
async function copyTree(src: OpfsDirectoryHandle, dst: OpfsDirectoryHandle): Promise<void> {
  for (const entry of await entriesOf(src)) {
    if (entry.kind === 'directory') {
      await copyTree(entry, await dst.getDirectoryHandle(entry.name, { create: true }));
    } else {
      await copyFile(entry, dst);
    }
  }
}

async function copyFile(src: OpfsFileHandle, dst: OpfsDirectoryHandle): Promise<void> {
  const file = await src.getFile();
  const existing = await fileOf(dst, src.name);
  if (existing !== null && ((await existing.getFile()).size > 0 || file.size === 0)) return;

  const handle = await dst.getFileHandle(src.name, { create: true });
  if (handle.createWritable === undefined) {
    // Пустышку, которую только что завели, не оставляем: на повторе она сошла бы за копию.
    await removeQuietly(dst, src.name);
    throw new Error('`createWritable` недоступен: копировать нечем');
  }
  const writable = await handle.createWritable();
  await writable.write(new Uint8Array(await file.arrayBuffer()));
  await writable.close();
}

/** Записи каталога — списком до любых правок: обход изменяемого каталога на ходу ненадёжен. */
async function entriesOf(dir: OpfsDirectoryHandle): Promise<readonly OpfsEntry[]> {
  const entries: OpfsEntry[] = [];
  for await (const entry of dir.values()) entries.push(entry);
  return entries;
}

async function directoryOf(
  parent: OpfsDirectoryHandle,
  name: string
): Promise<OpfsDirectoryHandle | null> {
  try {
    return await parent.getDirectoryHandle(name);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function fileOf(parent: OpfsDirectoryHandle, name: string): Promise<OpfsFileHandle | null> {
  try {
    return await parent.getFileHandle(name);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function hasAnyDirectory(
  dir: OpfsDirectoryHandle,
  names: readonly string[]
): Promise<boolean> {
  for (const name of names) {
    if ((await directoryOf(dir, name)) !== null) return true;
  }
  return false;
}

/** Удаляет запись; «уже нет» (вторая вкладка успела раньше) — не отказ. */
async function removeQuietly(parent: OpfsDirectoryHandle, name: string): Promise<void> {
  try {
    await parent.removeEntry(name, { recursive: true });
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

/** «Файла/каталога нет» — от любого движка приходит как `NotFoundError`; «не тот вид» — рядом. */
function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
  );
}

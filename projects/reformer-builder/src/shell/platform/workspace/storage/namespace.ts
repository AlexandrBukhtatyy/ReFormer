/**
 * Пространство имён билдера на источнике.
 *
 * ## Зачем
 *
 * Источник у билдера бывает чужой: встроенный билдер открыт с адреса приложения и делит с ним
 * OPFS, IndexedDB и хранилище сессии. «Очистить кэш» там обязана снести своё и не тронуть чужое,
 * а список «своего» протухает ровно так, как описано в шапке `purge.ts`: каждый новый кэш — ещё
 * одно имя, о котором очистка не узнает. Поэтому граница проходит не по списку, а по
 * СОГЛАШЕНИЮ: всё, что билдер кладёт на источник, лежит под одним именем.
 *
 * - OPFS — один корневой каталог `reformer-builder/`; рабочие копии (`ws/`), кэш сборки
 *   (`build/`) и установленные плагины (`plugins/`) — внутри него;
 * - IndexedDB, Cache Storage, `*Storage` — имена с префиксом `reformer-builder.`.
 *
 * Для OPFS соглашение держит не дисциплина, а единственный провайдер корня
 * ({@link builderDirectory}): хранилища резолвят корень через него и ниже пространства имён
 * попасть не могут. Имена баз и ключей каждый модуль пишет сам (`idb.ts`, `source/fs-handles.ts`,
 * `client/mode.ts`) — новое хранилище, включая будущий IndexedDB-бэкенд `plugin/storage.ts`,
 * обязано взять префикс {@link STORAGE_NAME_PREFIX}: иначе его не увидит очистка по области
 * видимости, и во встроенном билдере оно переживёт «Очистить кэш».
 *
 * ## Старая раскладка
 *
 * До пространства имён каталоги `ws/`, `build/`, `plugins/` лежали в корне источника. Провайдер
 * переносит их внутрь (`legacy-layout.ts`) — один раз на страницу, до того как первое хранилище
 * получит корень, и под тем же промисом, который все они ждут: гонки с самим собой нет.
 *
 * @module shell/platform/workspace/storage/namespace
 */

import { StorageError } from './errors';
import { adoptLegacyLayout } from './legacy-layout';
import type { OpfsDirectoryHandle, OpfsDirectoryProvider } from './opfs';
import type { PurgeScope } from './purge';

/** Имя пространства имён. Одно на билдер, независимо от проекта и профиля состава. */
export const STORAGE_NAMESPACE = 'reformer-builder';

/** Префикс имён баз IndexedDB, кэшей Cache Storage и ключей `*Storage`. */
export const STORAGE_NAME_PREFIX = `${STORAGE_NAMESPACE}.`;

/** Корневой каталог билдера в OPFS. Единственная запись корня источника, которая наша. */
export const OPFS_ROOT_DIR = STORAGE_NAMESPACE;

/**
 * Область видимости очистки: «запись наша».
 *
 * Правило одно на все области: имя пространства имён целиком (каталог OPFS, а также база
 * прежних версий билдера, звавшаяся просто `reformer-builder`) либо с его префиксом. Сам
 * корень OPFS сносится, как и остальные записи, — на перезагрузке провайдер заведёт новый.
 */
export const builderStorageScope: PurgeScope = (_area, name) =>
  name === STORAGE_NAMESPACE || name.startsWith(STORAGE_NAME_PREFIX);

/**
 * Есть ли OPFS в этом окружении.
 *
 * Вызывающий обязан деградировать, а не падать: в приватном режиме части движков и в старых
 * сборках `navigator.storage.getDirectory` нет вовсе, и это нормальный режим работы, в котором
 * рабочая область живёт только в памяти сессии.
 */
export function opfsSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
    );
  } catch {
    // Обращение к `navigator.storage` в отдельных окружениях само бросает.
    return false;
  }
}

/**
 * Провайдер корня билдера поверх корня источника.
 *
 * Корень резолвится лениво и один раз: все хранилища ждут один промис, и перенос старой
 * раскладки внутри него случается до первого ответа. Неудача мемо сбрасывает — тот же приём,
 * что у корня в `build-cache.ts`: один отказ (например, до выдачи разрешения) не должен делать
 * хранилище нечитаемым навсегда.
 *
 * Фабрика — чтобы тесты подставляли корень в памяти, а Worker — свой `getDirectory`.
 */
export function createBuilderDirectoryProvider(
  origin: OpfsDirectoryProvider
): OpfsDirectoryProvider {
  let rootPromise: Promise<OpfsDirectoryHandle> | undefined;
  return () => {
    if (rootPromise !== undefined) return rootPromise;
    rootPromise = resolveRoot(origin).catch((error: unknown) => {
      rootPromise = undefined;
      throw error;
    });
    return rootPromise;
  };
}

async function resolveRoot(origin: OpfsDirectoryProvider): Promise<OpfsDirectoryHandle> {
  const root = await origin();
  const own = await root.getDirectoryHandle(OPFS_ROOT_DIR, { create: true });
  await adoptLegacyLayout(root, own);
  return own;
}

/**
 * Настоящий корень источника.
 *
 * Единственное приведение типа: глобальный `FileSystemDirectoryHandle` не объявляет `values()`
 * при нашем наборе lib (см. шапку `opfs.ts`).
 */
async function originDirectory(): Promise<OpfsDirectoryHandle> {
  if (!opfsSupported()) {
    throw new StorageError('opfs-unavailable', 'OPFS недоступен в этом окружении');
  }
  const root = await navigator.storage.getDirectory();
  return root as unknown as OpfsDirectoryHandle;
}

/** Корень билдера в настоящем OPFS — умолчание всех хранилищ. */
export const builderDirectory: OpfsDirectoryProvider =
  createBuilderDirectoryProvider(originDirectory);

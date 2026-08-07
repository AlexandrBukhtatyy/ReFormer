/**
 * Реестр китов — «между какими дизайн-системами пользователь может выбирать».
 *
 * Сущность, отдельная от дескриптора (план §3.4): дескриптор поставляет КИТ (блок `kit` в
 * catalog-JSON), реестр — БИЛДЕР и клиентский конфиг. Разделение вынужденное: `@reformer/ui-kit@11`
 * не экспортирует `./catalog` вовсе, поэтому «где взять каталог» обязано быть свойством записи
 * реестра, а не пакета. Для таких китов каталог генерируется скриптом `scripts/gen-kit-catalog.mjs`
 * из `./meta` + `package.json#exports` и лежит в `./generated/`.
 *
 * `loadNamespace` — обязательно `import()`, а не статический импорт: иначе Vite сложит ВСЕ киты в
 * главный чанк, и переключатель версий оплачивался бы весом всех вариантов сразу.
 *
 * @module reformer-builder/kits/registry
 */

import type { CatalogJson } from '../catalog/types';
import type { KitNamespace } from './types';
import builtinCatalog from '@reformer/ui-kit/catalog';
import kit11Catalog from './generated/reformer-ui-kit-11.catalog.json';
import hexaCatalog from '@reformer/kit-hexa-ui/catalog';

/** Запись реестра: чем кит представлен в переключателе и как его загрузить. */
export interface KitEntry {
  /** Стабильный id (он же ключ в localStorage). */
  id: string;
  /** Подпись в переключателе. */
  label: string;
  /** Версия пакета — показывается рядом с подписью. */
  version: string;
  /** Каталог компонентов кита (вшит в бандл: это данные, а не код). */
  catalog: CatalogJson;
  /** Ленивая загрузка namespace: отдельный чанк на кит. */
  loadNamespace: () => Promise<KitNamespace>;
}

/** Кит по умолчанию — тот, что линкуется в workspace. */
export const DEFAULT_KIT_ID = 'reformer-ui-kit';

const BUILTIN_KITS: KitEntry[] = [
  {
    id: DEFAULT_KIT_ID,
    label: 'ReFormer UI Kit',
    // Версия из workspace недостоверна (package.json в этом репозитории не бампается —
    // `@semantic-release/git` не подключён, версия живёт в git-теге), поэтому честнее сказать так.
    version: 'workspace',
    catalog: builtinCatalog as unknown as CatalogJson,
    loadNamespace: async () =>
      (await import('./adapters/reformer-ui-kit')).REFORMER_UI_KIT_NAMESPACE,
  },
  {
    id: 'reformer-ui-kit-11',
    label: 'ReFormer UI Kit',
    version: '11.0.0',
    catalog: kit11Catalog as unknown as CatalogJson,
    loadNamespace: async () =>
      (await import('./adapters/reformer-ui-kit-11')).REFORMER_UI_KIT_11_NAMESPACE,
  },
  {
    // Сторонняя дизайн-система: живёт отдельным пакетом со своими зависимостями, адаптерами полей,
    // обёрткой поля и провайдером темы. Билдер про HexaUI ничего не знает — только грузит namespace.
    id: 'hexa-ui',
    label: 'Kaspersky HexaUI',
    version: '6.387.4',
    catalog: hexaCatalog as unknown as CatalogJson,
    loadNamespace: async () => (await import('@reformer/kit-hexa-ui')).HEXA_UI_NAMESPACE,
  },
];

/** Все доступные киты. */
export function listKits(): KitEntry[] {
  return BUILTIN_KITS;
}

/** Запись реестра по id; `undefined` — такого кита нет (например, id из старого localStorage). */
export function getKit(id: string): KitEntry | undefined {
  return BUILTIN_KITS.find((k) => k.id === id);
}

/** Запись реестра по id с откатом на кит по умолчанию. */
export function getKitOrDefault(id: string | null): KitEntry {
  return (id ? getKit(id) : undefined) ?? getKit(DEFAULT_KIT_ID)!;
}

/**
 * Подстановка пакета кита в компилирующем превью.
 *
 * Код формы берёт компоненты по спецификатору кита (`descriptor.codegen.importSpecifier`):
 * `schema/registry.ts` печатает кодоген, остальной код модуля пишет человек. Пакет встроенного
 * кита оболочка отдаёт коду формы своим реестром модулей. Кита, внесённого плагином, в этом реестре
 * нет и быть не может — его компоненты живут в пространстве имён, которое плагин отдал службе
 * китов. Без подстановки такая форма падала бы на первом же импорте с «модуль недоступен».
 *
 * Поэтому для кита плагина спецификатор подставляется его пространством имён — тем же каналом,
 * которым фикстура подменяет `../api` (`LinkerOptions.overrides`: подстановка идёт ПЕРВОЙ, для
 * путей и имён пакетов одинаково).
 *
 * ## Подпути кита — то же пространство имён
 *
 * Запись каталога с `subpath` и адаптер с `subpath` импортируются не из главного входа, а с
 * подпутя: кодоген печатает `import { X } from '<спецификатор>/<подпуть>'`. Линковщик сверяет
 * подстановку с тем, что НАПИСАНО в импорте, точным совпадением, поэтому корня мало — каждый
 * объявленный подпуть подставляется поимённо. Значение у всех одно: пространство имён кита
 * плоское, символ в нём либо есть, либо нет, из какого входа пакета он ни пришёл бы
 * (`KitNamespace`). Подпуть, которого дескриптор не объявил, не подставляется: такой импорт
 * кодоген не печатает, а написанный рукой честно упрётся в «модуль недоступен».
 *
 * @module plugins/reformer/render/compiling/kit-imports
 */

import type { KitDescriptor, KitNamespace, KitOrigin } from '@reformer/builder-plugin-api';

/** Что нужно знать о ките, чтобы подставить его пакет. */
export interface KitImportSource {
  readonly origin: KitOrigin | null;
  readonly descriptor: KitDescriptor | null;
  readonly namespace: KitNamespace | null;
}

const NO_OVERRIDES: ReadonlyMap<string, unknown> = new Map();

/**
 * Подстановки по пространству имён и набору спецификаторов. Та же пара — та же карта: карта
 * уходит в зависимости эффекта компиляции, и новая на каждую перерисовку перекомпилировала бы
 * сайдкары без повода.
 */
const cache = new WeakMap<KitNamespace, Map<string, ReadonlyMap<string, unknown>>>();

/**
 * Спецификаторы, под которыми код формы импортирует кит: главный вход и каждый подпуть, который
 * объявил дескриптор, — у записей каталога (`subpaths`) и у адаптеров (`adapters`).
 *
 * Главный вход — первым, подпути — по алфавиту и без повторов: по этому списку строится ключ
 * кэша, и порядок обхода каталога на него влиять не должен.
 */
export function kitImportSpecifiers(descriptor: KitDescriptor): readonly string[] {
  const specifier = descriptor.codegen.importSpecifier;
  const subpaths = new Set<string>(descriptor.subpaths.values());
  for (const adapter of Object.values(descriptor.adapters)) {
    if (adapter?.subpath) subpaths.add(adapter.subpath);
  }
  return [specifier, ...[...subpaths].sort().map((subpath) => `${specifier}/${subpath}`)];
}

/**
 * Подстановки пакета активного кита: `спецификатор → namespace` — для главного входа и для каждого
 * объявленного подпутя ({@link kitImportSpecifiers}).
 *
 * Пусто, если кит встроенный (его пакет и подпути отдаёт реестр модулей оболочки) или
 * пространство имён ещё не доехало: подставить нечего, и форма честно покажет «модуль недоступен»
 * до его приезда — а приезд пересоберёт её сам.
 */
export function kitImportOverrides(kit: KitImportSource): ReadonlyMap<string, unknown> {
  if (kit.origin?.kind !== 'plugin' || kit.descriptor === null || kit.namespace === null) {
    return NO_OVERRIDES;
  }
  const namespace = kit.namespace;
  const specifiers = kitImportSpecifiers(kit.descriptor);
  // Перевод строки в спецификаторе импорта невозможен — разделитель с именем не спутать.
  const key = specifiers.join('\n');
  let byKey = cache.get(namespace);
  if (byKey === undefined) {
    byKey = new Map();
    cache.set(namespace, byKey);
  }
  let overrides = byKey.get(key);
  if (overrides === undefined) {
    overrides = new Map(specifiers.map((specifier) => [specifier, namespace]));
    byKey.set(key, overrides);
  }
  return overrides;
}

/**
 * Подстановки кита и фикстуры в одну карту. Фикстура побеждает: её пишет человек про эту форму,
 * и если он подменил пакет кита, значит, хотел именно этого. `undefined` — подставлять нечего.
 */
export function mergeOverrides(
  kit: ReadonlyMap<string, unknown>,
  fixture: Readonly<Record<string, unknown>> | undefined
): ReadonlyMap<string, unknown> | undefined {
  const own = fixture === undefined ? [] : Object.entries(fixture);
  if (kit.size === 0 && own.length === 0) return undefined;
  const merged = new Map(kit);
  for (const [specifier, value] of own) merged.set(specifier, value);
  return merged;
}

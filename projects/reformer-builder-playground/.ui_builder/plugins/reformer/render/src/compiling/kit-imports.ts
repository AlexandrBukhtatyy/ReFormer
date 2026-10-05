/**
 * Подстановка пакета кита в компилирующем превью.
 *
 * Код формы берёт компоненты по спецификатору кита (`descriptor.codegen.importSpecifier`):
 * `registry.ts` печатает кодоген, остальные сайдкары пишет человек. Пакет встроенного кита
 * оболочка отдаёт коду формы своим реестром модулей. Кита, внесённого плагином, в этом реестре
 * нет и быть не может — его компоненты живут в пространстве имён, которое плагин отдал службе
 * китов. Без подстановки такая форма падала бы на первом же импорте с «модуль недоступен».
 *
 * Поэтому для кита плагина спецификатор подставляется его пространством имён — тем же каналом,
 * которым фикстура подменяет `./api` (`LinkerOptions.overrides`: подстановка идёт ПЕРВОЙ, для
 * путей и имён пакетов одинаково). Подпути кита (`<пакет>/<подпуть>`) сюда не входят: компилирующая
 * поверхность пока знает только корень пакета.
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
 * Подстановки по пространству имён и спецификатору. Та же пара — та же карта: карта уходит
 * в зависимости эффекта компиляции, и новая на каждую перерисовку перекомпилировала бы сайдкары
 * без повода.
 */
const cache = new WeakMap<KitNamespace, Map<string, ReadonlyMap<string, unknown>>>();

/**
 * Подстановки пакета активного кита: `спецификатор → namespace`.
 *
 * Пусто, если кит встроенный (его пакет отдаёт реестр модулей оболочки) или пространство имён ещё
 * не доехало: подставить нечего, и форма честно покажет «модуль недоступен» до его приезда —
 * а приезд пересоберёт её сам.
 */
export function kitImportOverrides(kit: KitImportSource): ReadonlyMap<string, unknown> {
  if (kit.origin?.kind !== 'plugin' || kit.descriptor === null || kit.namespace === null) {
    return NO_OVERRIDES;
  }
  const specifier = kit.descriptor.codegen.importSpecifier;
  let bySpecifier = cache.get(kit.namespace);
  if (bySpecifier === undefined) {
    bySpecifier = new Map();
    cache.set(kit.namespace, bySpecifier);
  }
  let overrides = bySpecifier.get(specifier);
  if (overrides === undefined) {
    overrides = new Map([[specifier, kit.namespace]]);
    bySpecifier.set(specifier, overrides);
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

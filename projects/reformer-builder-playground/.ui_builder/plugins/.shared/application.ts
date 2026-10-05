/**
 * Состав приложения с плагинами домена — для интеграционных тестов.
 *
 * Плагин проекта оболочка поднимает после открытия проекта, из его каталога, — этот путь
 * проверяет e2e. Тесту состава, меню или раскладки клавиш он не нужен: здесь плагины домена
 * встают в состав тем же способом, что встроенные, и проверяется то, что они вносят в оболочку.
 *
 * Модуль импортирует исходники билдера через алиас `@` — он есть только у интеграционных
 * пакетов (`./vitest.integration`). Сами плагины им не пользуются.
 *
 * @module plugins/.shared/application
 */

import type {
  CapabilityDeclaration,
  Plugin,
  PluginPermission,
} from '@reformer/builder-plugin-api/internal';
import type { ApplicationComposition, ComposedPlugin } from '@/shell/boot/composition';

/** Плагин домена для состава: манифест его исходников и способ его создать. */
export interface DomainPlugin {
  /** Из манифеста берётся объявленное: идентификатор, обещанные возможности, права. */
  readonly manifest: {
    readonly id: string;
    readonly provides?: readonly CapabilityDeclaration[];
    readonly permissions?: readonly string[];
  };
  readonly create: () => Plugin;
}

/** Состав `base`, дополненный плагинами домена. Исходный состав не меняется. */
export function withDomainPlugins(
  base: ApplicationComposition,
  plugins: readonly DomainPlugin[]
): ApplicationComposition {
  return Object.freeze({
    profile: base.profile,
    modules: base.modules,
    capabilities: Object.freeze([
      ...base.capabilities,
      ...plugins.flatMap((entry) =>
        (entry.manifest.provides ?? []).map((declared) => ({ ...declared, by: entry.manifest.id }))
      ),
    ]),
    load: async (): Promise<readonly ComposedPlugin[]> =>
      Object.freeze([
        ...(await base.load()),
        ...plugins.map(
          (entry): ComposedPlugin => ({
            plugin: entry.create(),
            provides: entry.manifest.provides,
            permissions: entry.manifest.permissions as readonly PluginPermission[] | undefined,
          })
        ),
      ]),
  });
}

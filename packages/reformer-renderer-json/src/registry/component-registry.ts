/**
 * Реализация реестра компонентов
 *
 * @module reformer/renderer-json/registry/component-registry
 */

import type { ComponentRegistry, ComponentMetadata, RegistryBuilder } from './types';
import type { LocaleService } from '../locale/locale-service';
import { LOCALE_SERVICE } from './constants';

export class ComponentRegistryImpl implements ComponentRegistry {
  private own = new Map<string, ComponentMetadata>();
  private parent: ComponentRegistryImpl | null = null;

  get(name: string): ComponentMetadata | undefined {
    return this.own.get(name) ?? this.parent?.get(name);
  }

  getDataSource<T = unknown>(name: string): T | undefined {
    const meta = this.get(name);
    if (!meta || meta.type !== 'dataSource') return undefined;
    return meta.component as T;
  }

  getLocale(): LocaleService | undefined {
    const meta = this.get(LOCALE_SERVICE);
    if (!meta || meta.type !== 'locale') return undefined;
    return meta.component as LocaleService;
  }

  has(name: string): boolean {
    return this.own.has(name) || (this.parent?.has(name) ?? false);
  }

  names(): string[] {
    const parentNames = this.parent?.names() ?? [];
    const ownNames = Array.from(this.own.keys());
    return [...new Set([...parentNames, ...ownNames])];
  }

  _set(name: string, metadata: ComponentMetadata): void {
    if (this.own.has(name)) {
      console.warn(`[ComponentRegistry] Overwriting entry: ${name}`);
    }
    this.own.set(name, metadata);
  }

  static withParent(parent: ComponentRegistry, child: ComponentRegistry): ComponentRegistry {
    const merged = new ComponentRegistryImpl();
    // Копируем записи реестра. Свой impl → берём напрямую `own`; кастомная реализация
    // публичного `ComponentRegistry` (без `own`) → публичный fallback через names()/get(),
    // чтобы не падать `Cannot read properties of undefined (reading 'forEach')`.
    const copyEntries = (reg: ComponentRegistry): void => {
      if (reg instanceof ComponentRegistryImpl) {
        reg.own.forEach((meta, name) => merged.own.set(name, meta));
      } else {
        for (const name of reg.names()) {
          const meta = reg.get(name);
          if (meta) merged.own.set(name, meta);
        }
      }
    };
    // parent как живая цепочка (только для своего impl); иначе вкладываем его записи в own.
    if (parent instanceof ComponentRegistryImpl) merged.parent = parent;
    else copyEntries(parent);
    copyEntries(child); // child перекрывает parent
    return merged;
  }
}

/**
 * Создаёт реестр компонентов через builder-callback.
 *
 * Реестр обязателен для работы {@link JsonFormRenderer} — иначе компоненты,
 * упомянутые в JSON-схеме, не отрезолвятся.
 *
 * @param fn - Builder-callback. Получает {@link RegistryBuilder} с методами `component`, `dataSource`.
 * @returns Готовый {@link ComponentRegistry}, который кладётся в `JsonRendererProvider`.
 *
 * @example
 * ```typescript
 * import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
 * import { Input, Select, FormField } from '@reformer/ui-kit';
 *
 * const registry = defineRegistry((reg) => {
 *   reg.component('Input', Input);
 *   reg.component('Select', Select);
 *   reg.component(FIELD_WRAPPER, FormField);
 *   reg.dataSource('LOAN_TYPES', [
 *     { value: 'consumer', label: 'Потребительский' },
 *     { value: 'mortgage', label: 'Ипотека' },
 *   ]);
 * });
 * ```
 *
 * @see [docs/llms/03-registry.md](../../docs/llms/03-registry.md)
 */
export function defineRegistry(fn: (reg: RegistryBuilder) => void): ComponentRegistry {
  const registry = new ComponentRegistryImpl();

  const builder: RegistryBuilder = {
    component(name, component, description?) {
      registry._set(name, { component, type: 'component', description });
    },
    dataSource(name, value, description?) {
      registry._set(name, { component: value, type: 'dataSource', description });
    },
    fn(name, func, description?) {
      if (typeof func !== 'function') {
        throw new Error(
          `reg.fn("${name}") expects a function, got ${typeof func}. Use reg.dataSource(...) for non-function values.`
        );
      }
      registry._set(name, { component: func, type: 'fn', description });
    },
    locale(service, description?) {
      const svc = typeof service === 'function' ? { resolve: service } : service;
      registry._set(LOCALE_SERVICE, { component: svc, type: 'locale', description });
    },
  };

  fn(builder);
  return registry;
}

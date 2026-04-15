/**
 * Реализация реестра компонентов
 *
 * @module reformer/renderer-json/registry/component-registry
 */

import type { ComponentRegistry, ComponentMetadata } from './types';

/**
 * Реализация ComponentRegistry
 */
class ComponentRegistryImpl implements ComponentRegistry {
  private components = new Map<string, ComponentMetadata>();

  register<P>(name: string, metadata: ComponentMetadata<P>): this {
    if (this.components.has(name)) {
      console.warn(`[ComponentRegistry] Overwriting entry: ${name}`);
    }
    this.components.set(name, metadata as ComponentMetadata);
    return this;
  }

  registerSource<T>(name: string, value: T, description?: string): this {
    return this.register(name, {
      component: value,
      type: 'source',
      description,
    });
  }

  get(name: string): ComponentMetadata | undefined {
    return this.components.get(name);
  }

  getSource<T = unknown>(name: string): T | undefined {
    const meta = this.components.get(name);
    if (!meta || meta.type !== 'source') return undefined;
    return meta.component as T;
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  names(): string[] {
    return Array.from(this.components.keys());
  }

  extend(): ComponentRegistry {
    const extended = new ComponentRegistryImpl();
    this.components.forEach((meta, name) => {
      extended.components.set(name, meta);
    });
    return extended;
  }
}

/**
 * Создаёт новый пустой реестр компонентов
 *
 * @example
 * ```typescript
 * const registry = createComponentRegistry()
 *   .register('Input', { component: Input, type: 'field' })
 *   .register('Box', { component: Box, type: 'container' });
 * ```
 */
export function createComponentRegistry(): ComponentRegistry {
  return new ComponentRegistryImpl();
}

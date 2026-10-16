/**
 * Реализация реестра компонентов
 *
 * @module reformer/renderer-json/registry/component-registry
 */

import type { FormModel, FormSchemaNode, ResolvedSchema } from '@reformer/core';
import type { ComponentRegistry, ComponentMetadata, RegistryBuilder } from './types';
import type { LocaleService } from '../locale/locale-service';
import type { JsonFormSchema } from '../types/json-schema';
import { convertJsonSchema } from '../converter/json-to-render-schema';
import { SchemaErrorBoundary } from '../components/schema-error-boundary';
import { FIELD_WRAPPER, LOCALE_SERVICE } from './constants';
import { renamedComponentOf, warnRenamedComponent } from './renamed-components';

export class ComponentRegistryImpl implements ComponentRegistry {
  private own = new Map<string, ComponentMetadata>();
  private parent: ComponentRegistryImpl | null = null;

  get(name: string): ComponentMetadata | undefined {
    const exact = this.lookup(name);
    if (exact !== undefined) return exact;
    const renamedTo = this.renamedEntryNameOf(name);
    if (renamedTo === undefined) return undefined;
    warnRenamedComponent(name, renamedTo);
    return this.lookup(renamedTo);
  }

  /** Запись ровно под этим именем — своя либо из цепочки parent, без псевдонимов. */
  private lookup(name: string): ComponentMetadata | undefined {
    return this.own.get(name) ?? this.parent?.lookup(name);
  }

  /**
   * Имя записи-компонента, на которую указывает прежнее имя переименованного компонента:
   * документ старше релиза, а запись в реестре лежит уже под новым именем.
   */
  private renamedEntryNameOf(name: string): string | undefined {
    const renamedTo = renamedComponentOf(name);
    if (renamedTo === undefined) return undefined;
    return this.lookup(renamedTo)?.type === 'component' ? renamedTo : undefined;
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
    return this.lookup(name) !== undefined || this.renamedEntryNameOf(name) !== undefined;
  }

  names(): string[] {
    const parentNames = this.parent?.names() ?? [];
    const ownNames = Array.from(this.own.keys());
    return [...new Set([...parentNames, ...ownNames])];
  }

  /**
   * Дерево узлов из документа формата 2 — точка подключения реестра к единой сборке `createForm`.
   * Вместе с деревом отдаёт обёртку поля из записи `FIELD_WRAPPER` и границу ошибок схемы.
   */
  resolveSchema(document: unknown, model: FormModel<never>): ResolvedSchema {
    const fieldWrapper = this.get(FIELD_WRAPPER)?.component;
    return {
      tree: convertJsonSchema(document as JsonFormSchema, this, model) as FormSchemaNode,
      ...(fieldWrapper !== undefined ? { fieldWrapper } : {}),
      errorBoundary: SchemaErrorBoundary,
    };
  }

  _set(name: string, metadata: ComponentMetadata): void {
    if (this.own.has(name)) {
      console.warn(`[ComponentRegistry] Overwriting entry: ${name}`);
    }
    this.own.set(name, metadata);
  }

  static withParent(parent: ComponentRegistry, child: ComponentRegistry): ComponentRegistry {
    const merged = new ComponentRegistryImpl();
    // Копируем ВСЕГДА через публичные names()/get(): у своего impl они обходят и `own`,
    // и parent-цепочку.
    //
    // Раньше для `ComponentRegistryImpl` здесь читался напрямую `reg.own` — и составной
    // child терял собственный parent. Во вложенных провайдерах это не проявлялось (там
    // составным всегда оказывается `parent`), но программная композиция делает обратное:
    //   inner = withParent(ядро, расширения)   → parent=ядро, own=расширения
    //   outer = withParent(хост, inner)        → own=расширения, ЯДРО ПОТЕРЯНО
    // Отказ — `Component "..." not found in registry` из синхронного конвертера, в проде.
    const copyEntries = (reg: ComponentRegistry): void => {
      for (const name of reg.names()) {
        const meta = reg.get(name);
        if (meta) merged.own.set(name, meta);
      }
    };
    // parent как живая цепочка (только для своего impl); иначе вкладываем его записи в own.
    if (parent instanceof ComponentRegistryImpl) merged.parent = parent;
    else copyEntries(parent);
    copyEntries(child); // child перекрывает parent (last-wins)
    return merged;
  }
}

/**
 * Композиция реестров слева направо: каждый следующий перекрывает предыдущие
 * (last-wins, как `Object.assign`).
 *
 * Нужна там, где реестр собирается из нескольких источников по порядку ВЛАДЕНИЯ (форма →
 * микрофронт → общее ядро): результат передаётся сборке формы одним реестром
 * (`createForm({ model, schema, registry })`), без React-контекста.
 *
 * @param registries - Реестры от наименее приоритетного к наиболее приоритетному.
 * @returns Объединённый {@link ComponentRegistry}; пустой, если аргументов нет.
 *
 * @example Общее ядро + расширения микрофронта + специфика формы
 * ```typescript
 * const registry = composeRegistries(coreRegistry, mfeRegistry, formRegistry);
 * // formRegistry перекрывает mfeRegistry, тот — coreRegistry
 * ```
 */
export function composeRegistries(...registries: readonly ComponentRegistry[]): ComponentRegistry {
  if (registries.length === 0) return new ComponentRegistryImpl();
  return registries.reduce((acc, next) => ComponentRegistryImpl.withParent(acc, next));
}

/**
 * Создаёт реестр компонентов через builder-callback.
 *
 * Реестр обязателен для сборки формы из документа — иначе компоненты, упомянутые в JSON-схеме,
 * не отрезолвятся.
 *
 * @param fn - Builder-callback. Получает {@link RegistryBuilder} с методами `component`, `dataSource`.
 * @returns Готовый {@link ComponentRegistry}, который передаётся сборке:
 *   `createForm({ model, schema: document, registry })`.
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

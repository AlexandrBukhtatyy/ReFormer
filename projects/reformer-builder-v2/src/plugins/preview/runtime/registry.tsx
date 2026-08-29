/**
 * Реестр компонентов рантайм-поверхности: имя из схемы → чем его рисовать.
 *
 * Строится ДАННЫМИ из каталога активного кита — тем же источником, из которого палитра берёт
 * свои пункты. Это не удобство, а условие непротиворечивости: разойдись они, и превью ругалось бы
 * на компонент, который человек только что поставил из палитры.
 *
 * Три источника имён, и все три обязательны:
 *
 * 1. **Каталог** — то, что предлагает палитра. Живой компонент или подписанный стаб, решает
 *    политика ({@link '../runtime/policy'}).
 * 2. **Инфраструктура** (`FormField`, `AsyncBoundary`, `List`) — имена ВНЕ палитры, но нужные
 *    рендереру. `FIELD_WRAPPER` реестра — это тот же `FormField`.
 * 3. **Неизвестные имена схемы** — `$component(...)`, которых каталог не знает. Без них рендерер
 *    молча нарисовал бы пустоту там, где человек ждёт компонент.
 *
 * @module plugins/preview/runtime/registry
 */

import type { ComponentType } from 'react';
import {
  defineRegistry,
  FIELD_WRAPPER,
  type ComponentRegistry,
  type JsonFormSchema,
  type RegistryBuilder,
} from '@reformer/renderer-json';
import type { CatalogEntry } from '@/lib/catalog/types';
import { INFRA_NAMES } from '@/lib/kits/legacy-reformer-ui-kit';
import type { KitDescriptor, KitNamespace } from '@/lib/kits/types';
import { collectOperatorNames } from '@/lib/form-model/query';
import { classifyEntry, isRegistrable, resolveInfra } from './policy';
import { classifyDataSources, mockOptions } from './mock';
import { isolateComponent, makeLimitedComponent, makeUnknownComponent } from './stubs';

export interface PreviewRegistryInput {
  readonly schema: JsonFormSchema;
  readonly catalog: readonly CatalogEntry[];
  readonly descriptor: KitDescriptor;
  /** Namespace активного кита; пустой объект — кит недоступен, всё уедет в стабы. */
  readonly namespace: KitNamespace;
  /** Значения `$dataSource`: мок автора либо синтез. */
  readonly dataSources: Record<string, unknown>;
}

/** Имя → компонент по каталогу и инфраструктуре кита. Каждый изолирован своей границей ошибок. */
export function buildComponents(
  input: PreviewRegistryInput
): Readonly<Record<string, ComponentType<Record<string, unknown>>>> {
  const { catalog, descriptor, namespace } = input;
  const map: Record<string, ComponentType<Record<string, unknown>>> = {};

  const infra = resolveInfra(descriptor, namespace);
  for (const name of INFRA_NAMES) {
    const component = infra[name];
    // Кит, не поставивший инфраструктурный компонент, не должен ронять сборку реестра:
    // показываем стаб с причиной.
    map[name] = isolateComponent(
      component ?? makeLimitedComponent(name, `нет в ${descriptor.package}`),
      name
    ) as ComponentType<Record<string, unknown>>;
  }

  for (const entry of catalog) {
    if (!isRegistrable(entry)) continue;
    const decision = classifyEntry(entry, namespace, descriptor);
    map[entry.name] = isolateComponent(
      decision.policy === 'live'
        ? decision.component
        : makeLimitedComponent(entry.name, decision.reason),
      entry.name
    ) as ComponentType<Record<string, unknown>>;
  }

  return map;
}

/**
 * Имена `$component(...)` схемы, которых нет ни в каталоге, ни в инфраструктуре.
 *
 * Считается по ТОМУ ЖЕ множеству, что заполняет реестр, — иначе «неизвестным» оказалось бы имя,
 * которое реестр на самом деле знает, и человек чинил бы несуществующую проблему.
 */
export function unknownComponentNames(
  schema: JsonFormSchema,
  known: ReadonlySet<string>
): readonly string[] {
  return collectOperatorNames(schema).components.filter((name) => !known.has(name));
}

/** Значения `$dataSource`/`$fn`/`$locale` схемы. */
function registerSources(
  builder: RegistryBuilder,
  schema: JsonFormSchema,
  dataSources: Record<string, unknown>
): void {
  const classes = classifyDataSources(schema);

  for (const name of classes.functionLike) {
    // `itemLabel` массива ждёт ФУНКЦИЮ, а не список: массив здесь дал бы «is not a function»
    // на первом же элементе.
    builder.dataSource(name, (_: unknown, index = 0) => `#${index + 1}`);
  }
  for (const name of classes.optionLike) {
    builder.dataSource(name, dataSources[name] ?? mockOptions(name));
  }
  for (const name of classes.scalarLike) {
    builder.dataSource(name, dataSources[name] ?? 'значение');
  }

  const { fns, locales } = collectOperatorNames(schema);
  for (const name of fns) builder.fn(name, () => '');
  // Голый резолвер: ключ локализации отдаётся сам собой. Своего словаря у превью нет,
  // и придумывать переводы за форму оно не вправе.
  if (locales.length > 0) builder.locale((key: string) => key);
}

/** Собирает реестр компонентов и источников для рантайм-поверхности. */
export function buildPreviewRegistry(input: PreviewRegistryInput): ComponentRegistry {
  const components = buildComponents(input);
  const known = new Set(Object.keys(components));
  const unknown = unknownComponentNames(input.schema, known);

  return defineRegistry((builder) => {
    for (const [name, component] of Object.entries(components)) builder.component(name, component);
    // Враппер поля адресуется рендерером служебным именем, а не каталожным.
    builder.component(FIELD_WRAPPER, components.FormField);
    for (const name of unknown) builder.component(name, makeUnknownComponent(name));
    registerSources(builder, input.schema, input.dataSources);
  });
}

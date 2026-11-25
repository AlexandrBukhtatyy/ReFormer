/**
 * Области схемы: строка массива и подформа получают хранилище правил своей области.
 *
 * @module renderer-vue/scope
 */

import { defineComponent, inject, onBeforeUnmount, onMounted, provide, type PropType } from 'vue';
import { unknownSchemaSelectors } from '@reformer/core';
import type { CompiledSchema } from '@reformer/core';
import { effect } from '@reformer/core/signals';
import { OVERRIDE_MAPS, SCHEMA_CONTROLLER } from './context';

/**
 * Исполнить эффекты области (`renderEffect` поведения формы), пока компонент смонтирован. Каждый
 * эффект перезапускается при смене прочитанных в нём сигналов и может вернуть очистку.
 */
export function useScopeEffects(
  registry: ReadonlyArray<() => void | (() => void)> | undefined
): void {
  if (!registry) return;
  let disposes: Array<() => void> = [];
  onMounted(() => {
    disposes = registry.map((run) =>
      effect(() => {
        const cleanup = run();
        return typeof cleanup === 'function' ? cleanup : undefined;
      })
    );
  });
  onBeforeUnmount(() => {
    for (const dispose of disposes) dispose();
    disposes = [];
  });
}

/** Области, для которых сверка селекторов уже выполнена, — предупреждение одно на область. */
const checkedScopes = new WeakSet<object>();

/**
 * Граница области схемы. Поддерево строки массива или подформы получает хранилище СВОЕЙ области:
 * селекторы внутри него адресуются из поведения, подключённого к той же под-модели, и не
 * пересекаются ни с корнем, ни с соседними строками. Схема границы читается при создании: у
 * другой строки — другой `key`.
 */
export const ScopeBoundary = defineComponent({
  name: 'ReformerScope',
  props: {
    /** Скомпилированная схема области: её модель — ключ области. */
    schema: { type: Object as PropType<CompiledSchema>, required: true },
  },
  setup(props, { slots }) {
    const context = inject(SCHEMA_CONTROLLER, null);
    const schema = props.schema;
    const model = schema.model;
    const maps =
      context && model !== undefined ? context.controller.scopeOf(model).__overrideMaps : null;

    if (maps) {
      provide(OVERRIDE_MAPS, maps);
      useScopeEffects(maps.effectRegistry);
      onMounted(() => {
        if (process.env.NODE_ENV === 'production' || checkedScopes.has(maps)) return;
        checkedScopes.add(maps);
        const unknown = unknownSchemaSelectors(maps, schema);
        if (unknown.length > 0) {
          console.warn(
            '[RenderSchema] поведение области обращается к узлам, которых нет в её поддереве: ' +
              `${unknown.map((selector) => `"${selector}"`).join(', ')}. Правило ничего не сделает.`
          );
        }
      });
    }

    return () => slots.default?.();
  },
});

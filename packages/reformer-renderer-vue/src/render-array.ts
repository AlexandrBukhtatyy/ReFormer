/**
 * Массив под-форм: строки в своих областях схемы, оформление — у компонента массива.
 *
 * @module renderer-vue/render-array
 */

import { defineComponent, h, inject, type Component, type PropType } from 'vue';
import { getNodeForSignal } from '@reformer/core';
import type { CompiledArrayNode, FormArray, FormSchemaNode } from '@reformer/core';
import { resolveLocalized } from '@reformer/core/i18n';
import {
  formIndexOf,
  mergeNodeProps,
  stableKey,
  withComponentEvents,
  type ComponentEvents,
} from '@reformer/core/render';
import { useSignalValue } from './bridge/signals';
import { DEFAULT_I18N, FORM_BUNDLE, I18N } from './context';
import { RenderNode } from './render-node';
import { ScopeBoundary } from './scope';
import type { ArrayItemSlot } from './types';

/** Фасад массива модели: длина, строки и мутации. */
interface ArrayControl {
  readonly __path: string;
  readonly length: number;
  at(index: number): unknown;
  push(item?: unknown): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
}

/**
 * Строки массива для рендер-функции: подписка на структуру массива (добавление, удаление,
 * перестановка) и поддерево каждой строки в её области. Элемент `null` строкой не рисуется;
 * `index` остальных — индекс модели.
 */
function useArrayItems(
  node: CompiledArrayNode,
  fieldWrapper: () => Component | undefined
): () => ArrayItemSlot[] {
  const control = node.control as ArrayControl;
  // Ревизия, а не длина: перестановка длину не меняет, а список перерисовать надо.
  let counter = 0;
  const revision = useSignalValue(() => {
    void control.length;
    counter += 1;
    return counter;
  });

  return () => {
    void revision.value;
    const items: ArrayItemSlot[] = [];
    for (let index = 0; index < control.length; index++) {
      const model = control.at(index);
      if (model == null) continue;
      const key = stableKey(model);
      const children =
        typeof model === 'object'
          ? h(
              ScopeBoundary,
              { key, schema: node.row(model) },
              {
                default: () =>
                  h(RenderNode, { node: node.row(model).root, fieldWrapper: fieldWrapper() }),
              }
            )
          : h(RenderNode, {
              key,
              node: (node.source as unknown as { item(value: unknown): FormSchemaNode }).item(
                model
              ),
              fieldWrapper: fieldWrapper(),
            });
      items.push({ key, index, model, children });
    }
    return items;
  };
}

const arrayProps = {
  node: { type: Object as PropType<CompiledArrayNode>, required: true as const },
  fieldWrapper: { type: null as unknown as PropType<Component | undefined>, default: undefined },
};

/** Массивы, о которых уже предупредили: узел без компонента. */
const warnedArrays = new WeakSet<object>();

/**
 * Узел-массив без `component`: только строки — без секции и кнопок. Добавить, удалить и
 * переставить — задача компонента массива, рендерер разметку не поставляет.
 */
export const ArrayFallback = defineComponent({
  name: 'ReformerArrayItems',
  props: arrayProps,
  setup(props) {
    const node = props.node;
    const items = useArrayItems(node, () => props.fieldWrapper);
    if (!warnedArrays.has(node.control)) {
      warnedArrays.add(node.control);
      const path = node.control.__path;
      console.warn(
        `[RenderSchema] Array node${path ? ` "${path}"` : ''} has no \`component\` — items are ` +
          'rendered without add/remove/reorder UI. Set an array component on the node.'
      );
    }
    return () => items().map((item) => item.children);
  },
});

/**
 * Массив, который рисует зарегистрированный компонент. Компонент получает обычные пропсы —
 * `items` и колбэки `onAdd` / `onRemove` / `onMove` плюс `componentProps` узла — и не знает ни
 * про сигналы, ни про узлы схемы.
 */
export const ArrayComponent = defineComponent({
  name: 'ReformerArray',
  props: {
    ...arrayProps,
    /** `schema.node(selector).patchProps()` — главнее `componentProps` узла. */
    propsOverride: {
      type: null as unknown as PropType<Record<string, unknown> | null>,
      default: null,
    },
    /** `onComponentEvent` узла — добавляются к кнопкам массива. */
    events: { type: null as unknown as PropType<ComponentEvents | undefined>, default: undefined },
  },
  setup(props) {
    const node = props.node;
    const control = node.control as ArrayControl;
    const bundle = inject(FORM_BUNDLE, null);
    const i18n = inject(I18N, DEFAULT_I18N);
    const nodeOf: (handle: object) => unknown = bundle?.render?.nodeOf ?? getNodeForSignal;
    const items = useArrayItems(node, () => props.fieldWrapper);

    // Мутации — через ноду массива формы, когда она есть: запись через форму делает массив
    // `dirty`. Индексы `items` — индексы модели, нода считает по строкам формы, поэтому индекс
    // переводится. Без формы или для элемента `null` — прямо в массив модели.
    const formArray = (): FormArray<object> | undefined =>
      nodeOf(node.handle) as FormArray<object> | undefined;
    const onAdd = (): void => {
      const array = formArray();
      if (array) array.push();
      else control.push();
    };
    const onRemove = (index: number): void => {
      const array = formArray();
      const row = array ? formIndexOf(control, index) : undefined;
      if (array && row !== undefined) array.removeAt(row);
      else control.removeAt(index);
    };
    const onMove = (from: number, to: number): void => {
      const array = formArray();
      const fromRow = array ? formIndexOf(control, from) : undefined;
      const toRow = array ? formIndexOf(control, to) : undefined;
      if (array && fromRow !== undefined && toRow !== undefined) array.move(fromRow, toRow);
      else control.move(from, to);
    };

    return () => {
      const own = resolveLocalized(
        mergeNodeProps(node.props, undefined, props.propsOverride),
        i18n
      );
      return h(
        node.component as Component,
        withComponentEvents({ items: items(), onAdd, onRemove, onMove, ...own }, props.events)
      );
    };
  },
});

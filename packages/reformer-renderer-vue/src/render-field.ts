/**
 * Поле схемы: контрол из реестра, привязанный к ноде формы, и обёртка поля вокруг него.
 *
 * @module renderer-vue/render-field
 */

import { defineComponent, h, inject, type Component, type PropType, type VNode } from 'vue';
import type { CompiledFieldNode, FormControl } from '@reformer/core';
import { resolveLocalized } from '@reformer/core/i18n';
import {
  bindControlledFieldProps,
  fieldTestId,
  getFieldAdapter,
  mergeNodeProps,
  needsControl,
  splitFieldProps,
  withComponentEvents,
  type ComponentEvents,
  type FieldAdapter,
} from '@reformer/core/render';
import { useSignalValue } from './bridge/signals';
import { DEFAULT_I18N, I18N, RENDER_SETTINGS } from './context';

/** Ref узла из хранилища области: его рендерер вешает на компонент. */
export interface NodeRef {
  current: unknown;
}

/**
 * Диалект контрола Vue по умолчанию — `v-model`: значение пропом `modelValue`, изменение событием
 * `update:modelValue`. Действует для компонента без статики `reformerAdapter`.
 */
export const MODEL_VALUE_ADAPTER: FieldAdapter = {
  valueProp: 'modelValue',
  changeProp: 'onUpdate:modelValue',
};

/** Компонент с детьми: тегу дети уходят как есть, компоненту — слотом по умолчанию. */
export function withChildren(
  type: unknown,
  props: Record<string, unknown> | null,
  children: () => unknown
): VNode {
  return typeof type === 'string'
    ? h(type, props, children() as never)
    : h(type as Component, props, { default: children });
}

/**
 * Поле: значение и `disabled` из сигналов ноды, пропсы — схема, поверх реактивные пропсы ноды,
 * поверх переопределение поведения. Нода и узел читаются при создании: у другой ноды — другой `key`.
 */
export const RenderField = defineComponent({
  name: 'ReformerField',
  props: {
    node: { type: Object as PropType<CompiledFieldNode>, required: true },
    fieldNode: { type: Object as PropType<FormControl<unknown>>, required: true },
    /** Обёртка поля из настроек рендерера либо проп узла-родителя. */
    fieldWrapper: { type: null as unknown as PropType<Component | undefined>, default: undefined },
    /** `schema.node(selector).patchProps()` — главнее схемы и реактивных пропсов ноды. */
    propsOverride: {
      type: null as unknown as PropType<Record<string, unknown> | null>,
      default: null,
    },
    /** `onComponentEvent` узла — добавляются к привязке значения. */
    events: { type: null as unknown as PropType<ComponentEvents | undefined>, default: undefined },
    /** Ref по селектору узла. */
    nodeRef: { type: null as unknown as PropType<NodeRef | undefined>, default: undefined },
    /** Ref по пути поля — у узла без селектора; ищется по живому пути. */
    pathRefs: {
      type: null as unknown as PropType<ReadonlyMap<string, NodeRef> | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    const node = props.node;
    const fieldNode = props.fieldNode;
    const settings = inject(RENDER_SETTINGS, undefined);
    const i18n = inject(I18N, DEFAULT_I18N);

    const state = useSignalValue(() => ({
      value: fieldNode.value.value,
      disabled: fieldNode.disabled.value,
      componentProps: fieldNode.componentProps.value,
      // Путь поля строки массива меняется с индексом строки: из него выводятся testId и ref.
      path: fieldNode.path.value,
    }));

    const onChange = (value: unknown): void => fieldNode.setValue(value as never);
    const onBlur = (): void => fieldNode.markAsTouched();

    return () => {
      const component = node.component as Component | undefined;
      if (!component) {
        console.warn('[RenderSchema] Model field has no component — nothing to render.');
        return null;
      }
      const { value, disabled, componentProps, path } = state.value;
      const adapter =
        settings?.resolveFieldAdapter?.(component) ??
        getFieldAdapter(component) ??
        MODEL_VALUE_ADAPTER;

      const own = splitFieldProps(
        resolveLocalized(mergeNodeProps(node.props, componentProps, props.propsOverride), i18n)
      );
      const testId = fieldTestId(own.testId, path);

      // Подпись, описание и `required` рисует обёртка поля — контролу они не уходят. Контрол с
      // inline-подписью получает `label` и `required`: для этого привязке нужен сам компонент.
      const inputProps = bindControlledFieldProps(
        adapter,
        { value, onChange, onBlur },
        own.rest,
        component
      );
      if (testId && inputProps['data-testid'] === undefined) {
        inputProps['data-testid'] = `input-${testId}`;
      }

      const target = props.nodeRef ?? (path ? props.pathRefs?.get(path) : undefined);
      const input = h(component, {
        ...withComponentEvents(inputProps, props.events),
        disabled,
        ...(needsControl(adapter, component) ? { control: fieldNode } : {}),
        ...(target
          ? {
              ref: (instance: unknown) => {
                target.current = instance;
              },
            }
          : {}),
      });

      const wrapper = own.fieldWrapper ?? props.fieldWrapper;
      return wrapper
        ? h(
            wrapper as Component,
            { control: fieldNode, class: own.className, testId },
            { default: () => input }
          )
        : withChildren(own.wrapper ?? 'div', { class: own.className }, () => [input]);
    };
  },
});

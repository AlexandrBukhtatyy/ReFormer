/**
 * `FieldArray` ui-kit на Vuetify: строки массива под-форм с кнопками «Добавить», «Удалить» и
 * перестановкой.
 *
 * Строки и их ключи отдаёт рендерер (`items`), компонент оформляет их и зовёт `onAdd` /
 * `onRemove` / `onMove`. Роли — как у массива ui-kit: `array-add`, `array-item-{i}`,
 * `array-item-{i}-remove`, `array-item-{i}-move-up`, `array-item-{i}-move-down`.
 */
import { defineComponent, h, type Component, type PropType, type VNodeChild } from 'vue';
import type { ArrayItemSlot } from '@reformer/renderer-vue';
import { VBtn } from 'vuetify/components/VBtn';

/** Кнопка строки или массива. */
const button = (
  testId: string,
  label: string,
  onClick: () => void,
  extra: Record<string, unknown> = {}
): VNodeChild =>
  h(
    VBtn as Component,
    {
      type: 'button',
      variant: 'outlined',
      size: 'small',
      'data-testid': testId,
      onClick,
      ...extra,
    },
    { default: () => label }
  );

export const FieldArray = defineComponent({
  name: 'KitFieldArray',
  props: {
    items: { type: Array as PropType<readonly ArrayItemSlot[]>, default: () => [] },
    onAdd: { type: Function as PropType<() => void>, required: true },
    onRemove: { type: Function as PropType<(index: number) => void>, required: true },
    onMove: { type: Function as PropType<(from: number, to: number) => void>, default: undefined },
    title: { type: String, default: undefined },
    /** Подпись строки: «{itemLabel} #{номер}»; функция получает модель строки и индекс. */
    itemLabel: {
      type: [String, Function] as PropType<string | ((model: unknown, index: number) => string)>,
      default: undefined,
    },
    addButtonLabel: { type: String, default: 'Добавить' },
    removeButtonLabel: { type: String, default: 'Удалить' },
    emptyMessage: { type: String, default: undefined },
    emptyMessageHint: { type: String, default: undefined },
    reorderable: { type: Boolean, default: false },
    showRemoveOnSingle: { type: Boolean, default: false },
    minItems: { type: Number, default: undefined },
    maxItems: { type: Number, default: undefined },
    className: { type: String, default: undefined },
    cardClassName: { type: String, default: undefined },
  },
  setup(props) {
    const labelOf = (item: ArrayItemSlot): string =>
      typeof props.itemLabel === 'function'
        ? props.itemLabel(item.model, item.index)
        : `${props.itemLabel ?? props.title ?? 'Элемент'} #${item.index + 1}`;

    return () => {
      const length = props.items.length;
      const atMax = props.maxItems != null && length >= props.maxItems;
      const showRemove =
        props.minItems != null ? length > props.minItems : props.showRemoveOnSingle || length > 1;
      const showLabel = Boolean(props.title || props.itemLabel);

      // `data-slot` — как у ui-kit: по корню секции массив находят, когда их на шаге несколько.
      return h(
        'section',
        { class: ['kit-array', 'kit-stack', props.className], 'data-slot': 'field-array' },
        [
          props.title ? h('h3', { class: 'kit-section__title' }, props.title) : null,
          props.items.map((item, position) =>
            h(
              'div',
              {
                key: item.key,
                class: ['kit-array__row', 'kit-stack', props.cardClassName],
                'data-testid': `array-item-${item.index}`,
              },
              [
                showLabel || showRemove || props.reorderable
                  ? h('div', { class: 'kit-array__head' }, [
                      h('span', { class: 'kit-array__label' }, showLabel ? labelOf(item) : ''),
                      h('div', { class: 'kit-actions' }, [
                        props.reorderable && props.onMove
                          ? [
                              button(
                                `array-item-${item.index}-move-up`,
                                '↑',
                                () => props.onMove?.(item.index, item.index - 1),
                                { disabled: position === 0, 'aria-label': 'Выше' }
                              ),
                              button(
                                `array-item-${item.index}-move-down`,
                                '↓',
                                () => props.onMove?.(item.index, item.index + 1),
                                { disabled: position === length - 1, 'aria-label': 'Ниже' }
                              ),
                            ]
                          : null,
                        showRemove
                          ? button(`array-item-${item.index}-remove`, props.removeButtonLabel, () =>
                              props.onRemove(item.index)
                            )
                          : null,
                      ]),
                    ])
                  : null,
                item.children,
              ]
            )
          ),
          length === 0 && props.emptyMessage
            ? h('p', { class: 'kit-array__empty' }, [
                props.emptyMessage,
                props.emptyMessageHint ? h('small', ` ${props.emptyMessageHint}`) : null,
              ])
            : null,
          atMax
            ? null
            : button('array-add', props.addButtonLabel, () => props.onAdd(), {
                class: 'kit-array__add',
              }),
        ]
      );
    };
  },
});

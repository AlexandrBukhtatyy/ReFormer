/**
 * `RadioGroup` ui-kit на Vuetify: группа радиокнопок по `options`. Каждая кнопка — нативный
 * `<input type="radio">` внутри `VRadio` с ролью `input-{id}-{значение}`; общее имя группы раздаёт
 * сама `VRadioGroup`.
 */
import { defineComponent, h, withDirectives, type Component, type PropType } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { VRadio } from 'vuetify/components/VRadio';
import { VRadioGroup } from 'vuetify/components/VRadioGroup';
import {
  errorMessages,
  errorSlot,
  fieldEmits,
  fieldIdOf,
  fieldProps,
  labelText,
  selfSufficient,
  vFieldTestIds,
  vRadioGroupTestIds,
  withoutTestId,
  type Option,
} from './field';

export const RadioGroup = selfSufficient(
  defineComponent({
    name: 'KitRadioGroup',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      name: { type: String, default: undefined },
      options: { type: Array as PropType<readonly Option[]>, default: () => [] },
      orientation: {
        type: String as PropType<'horizontal' | 'vertical'>,
        default: 'vertical',
      },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      // Событие `blur` не всплывает: уход фокуса из группы ловится на её корне.
      const onFocusout = (event: FocusEvent): void => {
        const group = event.currentTarget as HTMLElement;
        if (!group.contains(event.relatedTarget as Node | null)) emit('blur');
      };
      return () => {
        const id = fieldIdOf(attrs);
        return withDirectives(
          h(
            VRadioGroup as Component,
            {
              ...withoutTestId(attrs),
              'data-testid': id && `field-${id}`,
              modelValue: props.modelValue,
              label: labelText(props.label, props.required),
              name: props.name,
              inline: props.orientation === 'horizontal',
              disabled: props.disabled,
              errorMessages: errorMessages(error.value),
              'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value),
              onFocusout,
            },
            {
              default: () =>
                props.options.map((option) =>
                  withDirectives(
                    h(VRadio as Component, {
                      key: String(option.value),
                      label: option.label,
                      value: option.value,
                      disabled: option.disabled,
                    }),
                    [[vFieldTestIds, id && `${id}-${String(option.value)}`]]
                  )
                ),
              message: errorSlot(id),
            }
          ),
          [[vRadioGroupTestIds, id]]
        );
      };
    },
  })
);

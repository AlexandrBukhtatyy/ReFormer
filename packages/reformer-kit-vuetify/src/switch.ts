/** `Switch` ui-kit на Vuetify: переключатель с подписью; значение формы — `boolean`. */
import { defineComponent, h, withDirectives, type Component } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { VSwitch } from 'vuetify/components/VSwitch';
import {
  errorMessages,
  errorSlot,
  fieldEmits,
  fieldIdOf,
  fieldProps,
  labelText,
  selfSufficient,
  vFieldTestIds,
  withoutTestId,
} from './field';

export const Switch = selfSufficient(
  defineComponent({
    name: 'KitSwitch',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      modelValue: { type: Boolean, default: false },
      /** Размер переключателя ui-kit; у поля кита он один. */
      size: { type: String, default: undefined },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () => {
        const id = fieldIdOf(attrs);
        return withDirectives(
          h(
            VSwitch as Component,
            {
              ...withoutTestId(attrs),
              'data-testid': id && `field-${id}`,
              modelValue: props.modelValue === true,
              label: labelText(props.label, props.required),
              disabled: props.disabled,
              color: 'primary',
              inset: true,
              errorMessages: errorMessages(error.value),
              'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value === true),
              onBlur: () => emit('blur'),
            },
            { message: errorSlot(id) }
          ),
          [[vFieldTestIds, id]]
        );
      };
    },
  })
);

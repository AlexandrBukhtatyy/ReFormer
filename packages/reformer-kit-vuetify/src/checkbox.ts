/** `Checkbox` ui-kit на Vuetify: флажок с подписью; значение формы — `boolean`. */
import { defineComponent, h, withDirectives, type Component } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { VCheckbox } from 'vuetify/components/VCheckbox';
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

export const Checkbox = selfSufficient(
  defineComponent({
    name: 'KitCheckbox',
    inheritAttrs: false,
    props: { ...fieldProps, modelValue: { type: Boolean, default: false } },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () => {
        const id = fieldIdOf(attrs);
        return withDirectives(
          h(
            VCheckbox as Component,
            {
              ...withoutTestId(attrs),
              'data-testid': id && `field-${id}`,
              modelValue: props.modelValue === true,
              label: labelText(props.label, props.required),
              disabled: props.disabled,
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

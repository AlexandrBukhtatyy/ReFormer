/** `Input` ui-kit на Vuetify: однострочное текстовое поле; `type` — тип нативного элемента. */
import { defineComponent } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { fieldEmits, fieldIdOf, fieldProps, selfSufficient } from './field';
import { textField, textProps } from './text-field';

export const Input = selfSufficient(
  defineComponent({
    name: 'KitInput',
    inheritAttrs: false,
    props: { ...fieldProps, ...textProps, type: { type: String, default: 'text' } },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        textField({
          id: fieldIdOf(attrs),
          props,
          type: props.type,
          error: error.value,
          attrs,
          emit,
        });
    },
  })
);

/** `Textarea` ui-kit на Vuetify: многострочное поле. */
import { defineComponent, type Component } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { VTextarea } from 'vuetify/components/VTextarea';
import { fieldEmits, fieldIdOf, fieldProps, selfSufficient } from './field';
import { textField, textProps } from './text-field';

export const Textarea = selfSufficient(
  defineComponent({
    name: 'KitTextarea',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      ...textProps,
      rows: { type: Number, default: 3 },
      maxLength: { type: Number, default: undefined },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        textField({
          id: fieldIdOf(attrs),
          props,
          error: error.value,
          attrs: { maxlength: props.maxLength, ...attrs },
          emit,
          component: VTextarea as Component,
          extra: { rows: props.rows, counter: props.maxLength },
        });
    },
  })
);

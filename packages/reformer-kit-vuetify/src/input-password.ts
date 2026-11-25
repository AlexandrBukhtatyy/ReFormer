/** `InputPassword` ui-kit на Vuetify: поле пароля. */
import { defineComponent } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { fieldEmits, fieldIdOf, fieldProps, selfSufficient } from './field';
import { textField, textProps } from './text-field';

export const InputPassword = selfSufficient(
  defineComponent({
    name: 'KitInputPassword',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      ...textProps,
      autoComplete: { type: String, default: 'current-password' },
      /** Кнопка «показать пароль» ui-kit; поле кита всегда скрывает ввод. */
      showToggle: { type: Boolean, default: false },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        textField({
          id: fieldIdOf(attrs),
          props,
          type: 'password',
          error: error.value,
          attrs: { autocomplete: props.autoComplete, ...attrs },
          emit,
        });
    },
  })
);

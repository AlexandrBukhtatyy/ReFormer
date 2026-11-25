/**
 * `InputMask` ui-kit на Vuetify: поле с маской (`9` — цифра, остальное — литералы). Маску
 * применяет `applyMask` к тексту в самом элементе на фазе перехвата — до того, как событие ввода
 * дойдёт до поля Vuetify и уйдёт в форму.
 */
import { defineComponent, h } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { fieldEmits, fieldIdOf, fieldProps, selfSufficient } from './field';
import { applyMask } from './mask';
import { textField, textProps } from './text-field';

export const InputMask = selfSufficient(
  defineComponent({
    name: 'KitInputMask',
    inheritAttrs: false,
    props: { ...fieldProps, ...textProps, mask: { type: String, required: true } },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      const onInputCapture = (event: Event): void => {
        const input = event.target as HTMLInputElement;
        const masked = applyMask(input.value, props.mask);
        if (masked !== input.value) input.value = masked;
      };
      return () =>
        h('div', { onInputCapture }, [
          textField({
            id: fieldIdOf(attrs),
            props,
            error: error.value,
            attrs: { inputmode: 'tel', ...attrs },
            emit,
          }),
        ]);
    },
  })
);

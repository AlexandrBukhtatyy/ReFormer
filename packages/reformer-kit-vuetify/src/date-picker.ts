/**
 * `DatePicker` ui-kit на Vuetify: нативный `type="date"` в поле Vuetify. Значение остаётся строкой
 * `YYYY-MM-DD` — как у поля даты в модели формы.
 */
import { defineComponent } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { fieldEmits, fieldIdOf, fieldProps, selfSufficient } from './field';
import { textField, textProps } from './text-field';

export const DatePicker = selfSufficient(
  defineComponent({
    name: 'KitDatePicker',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      ...textProps,
      /** Формат показа даты ui-kit; нативное поле показывает дату по локали браузера. */
      dateFormat: { type: String, default: undefined },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        textField({
          id: fieldIdOf(attrs),
          props,
          type: 'date',
          error: error.value,
          attrs,
          emit,
        });
    },
  })
);

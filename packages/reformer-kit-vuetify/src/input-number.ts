/**
 * `InputNumber` ui-kit на Vuetify: нативный `type="number"` в поле Vuetify. Значение формы — число
 * либо `null`.
 *
 * Поле держит набранный текст, пока он означает то же число, что в форме: иначе «1.50» посреди ввода
 * схлопнулось бы в «1.5». Значение, записанное в форму извне, вытесняет текст.
 */
import { defineComponent, shallowRef, type PropType } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { fieldEmits, fieldIdOf, fieldProps, selfSufficient, type FieldEmit } from './field';
import { textField, textProps } from './text-field';

/** Текст числового поля → число формы: пустое и нечисловое — `null`. */
function parseNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export const InputNumber = selfSufficient(
  defineComponent({
    name: 'KitInputNumber',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      ...textProps,
      modelValue: { type: Number as PropType<number | null>, default: null },
      min: { type: Number, default: undefined },
      max: { type: Number, default: undefined },
      step: { type: Number, default: undefined },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      const typed = shallowRef('');
      const onEvent: FieldEmit = (event, ...args) => {
        if (event === 'blur') return emit('blur');
        typed.value = String(args[0] ?? '');
        emit('update:modelValue', parseNumber(typed.value));
      };
      return () => {
        const value = props.modelValue ?? null;
        const text = parseNumber(typed.value) === value ? typed.value : String(value ?? '');
        return textField({
          id: fieldIdOf(attrs),
          props: { ...props, modelValue: text },
          type: 'number',
          error: error.value,
          attrs: { min: props.min, max: props.max, step: props.step, ...attrs },
          emit: onEvent,
        });
      };
    },
  })
);

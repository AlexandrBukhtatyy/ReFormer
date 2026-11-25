/**
 * `Select` ui-kit на Vuetify: список по `options`. Пустое значение — «не выбрано»: пустой пункт
 * стоит первым и несёт подсказку, как у нативного `<select>`.
 *
 * Нативного `<select>` у `VSelect` нет: в поле ввода — подпись выбранного пункта, пункты — панель,
 * которой нет в DOM, пока она закрыта. Для тестов и автоматизации кит ставит значение в
 * `data-value` на `input-{id}` и `option-{id}-{значение}` на пункты открытой панели.
 */
import { defineComponent, h, withDirectives, type Component, type PropType } from 'vue';
import { useFieldError } from '@reformer/renderer-vue';
import { VSelect } from 'vuetify/components/VSelect';
import {
  errorMessages,
  errorSlot,
  fieldEmits,
  fieldIdOf,
  fieldProps,
  labelText,
  selfSufficient,
  vFieldTestIds,
  vFieldValue,
  withoutTestId,
  type Option,
} from './field';

/** Пункт панели с testid `option-{id}-{значение}`. */
const item = (id: string | undefined, value: unknown, title: string, disabled?: boolean) => ({
  value,
  title,
  props: {
    disabled,
    'data-testid': id === undefined ? undefined : `option-${id}-${String(value ?? '')}`,
  },
});

export const Select = selfSufficient(
  defineComponent({
    name: 'KitSelect',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      placeholder: { type: String, default: 'Выберите…' },
      options: { type: Array as PropType<readonly Option[]>, default: () => [] },
      /** Крестик очистки ui-kit: пустой пункт списка делает то же. */
      clearable: { type: Boolean, default: false },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () => {
        const id = fieldIdOf(attrs);
        const value = props.modelValue ?? '';
        return withDirectives(
          h(
            VSelect as Component,
            {
              ...withoutTestId(attrs),
              'data-testid': id && `field-${id}`,
              modelValue: value,
              items: [
                item(id, '', props.placeholder),
                ...props.options.map((option) =>
                  item(id, option.value, option.label, option.disabled)
                ),
              ],
              label: labelText(props.label, props.required),
              disabled: props.disabled,
              errorMessages: errorMessages(error.value),
              'onUpdate:modelValue': (selected: unknown) =>
                emit('update:modelValue', selected ?? ''),
              onBlur: () => emit('blur'),
            },
            { message: errorSlot(id) }
          ),
          [
            [vFieldTestIds, id],
            [vFieldValue, String(value)],
          ]
        );
      };
    },
  })
);

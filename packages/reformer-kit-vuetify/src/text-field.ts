/**
 * Текстовое поле Vuetify, привязанное к полю формы: основа `Input`, `InputPassword`, `InputMask`,
 * `InputNumber`, `Textarea` и `DatePicker`.
 */
import { h, withDirectives, type Component, type VNode } from 'vue';
import { VTextField } from 'vuetify/components/VTextField';
import {
  errorMessages,
  errorSlot,
  labelText,
  vFieldTestIds,
  withoutTestId,
  type FieldEmit,
} from './field';

/** Пропсы текстовых полей кита. */
export const textProps = {
  placeholder: { type: String, default: undefined },
  /** Только чтение — его ставит и схема, и поведение формы. */
  readOnly: { type: Boolean, default: false },
};

export interface TextFieldOptions {
  /** Идентификатор поля в testid. */
  id: string | undefined;
  props: {
    modelValue: unknown;
    label?: string;
    required?: boolean;
    placeholder?: string;
    disabled: boolean;
    readOnly?: boolean;
  };
  /** Тип нативного элемента: `text`, `email`, `password`, `number`, `date`. */
  type?: string;
  error: string | undefined;
  attrs: Record<string, unknown>;
  emit: FieldEmit;
  /** Компонент поля: однострочное по умолчанию. */
  component?: Component;
  /** Пропсы компонента поверх общих: `rows`, `counter`, иконки. */
  extra?: Record<string, unknown>;
}

/**
 * Поле Vuetify: значение строкой, подпись с пометкой обязательного, ошибка — текстом показанного
 * замечания. Корень поля — `field-{id}`, нативный элемент — `input-{id}`.
 */
export function textField({
  id,
  props,
  type,
  error,
  attrs,
  emit,
  component = VTextField as Component,
  extra,
}: TextFieldOptions): VNode {
  return withDirectives(
    h(
      component,
      {
        ...withoutTestId(attrs),
        'data-testid': id && `field-${id}`,
        modelValue: props.modelValue == null ? '' : String(props.modelValue),
        label: labelText(props.label, props.required === true),
        placeholder: props.placeholder,
        type,
        disabled: props.disabled,
        readonly: props.readOnly === true,
        errorMessages: errorMessages(error),
        'onUpdate:modelValue': (value: unknown) =>
          emit('update:modelValue', value == null ? '' : String(value)),
        onBlur: () => emit('blur'),
        ...extra,
      },
      { message: errorSlot(id) }
    ),
    [[vFieldTestIds, id]]
  );
}

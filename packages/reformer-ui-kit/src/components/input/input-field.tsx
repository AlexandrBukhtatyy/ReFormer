import { forwardRef } from 'react';
import type { FieldHandle } from '@/fields/field-handle';
import { InputBaseField } from './variants/base/input-base.field';
import { InputNumberField } from './variants/number/input-number.field';
import { InputSuggestField } from './variants/suggest/input-suggest.field';

/**
 * Field-версия Input — диспетчер: `type: 'number'` → буфер (InputNumberField); задан
 * `suggestions` → текст с подсказками (InputSuggestField); иначе строковый (InputBaseField).
 * Экспортируется как алиас `InputField`. У числового поля `suggestions` игнорируется.
 *
 * `forwardRef`: все пути форвардят ref и отдают baseline {@link FieldHandle} — строковые через
 * HOC, числовой через собственный `useImperativeHandle` в {@link InputNumberField}.
 */
export const InputField = forwardRef<FieldHandle, Record<string, unknown>>(function InputField(
  { suggestions, minChars, openOnFocus, filter, ...props },
  ref
) {
  if (props.type === 'number') return <InputNumberField ref={ref} {...props} />;
  if (suggestions != null) {
    const suggestProps = { suggestions, minChars, openOnFocus, filter };
    return <InputSuggestField ref={ref} {...props} {...suggestProps} />;
  }
  // Настройки подсказок без самих подсказок в native input не уходят (иначе — DOM-атрибуты).
  return <InputBaseField ref={ref} {...props} />;
});
InputField.displayName = 'InputField';

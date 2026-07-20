import { forwardRef } from 'react';
import type { FieldHandle } from '@/fields/field-handle';
import { InputBaseField } from './variants/base/input-base.field';
import { InputNumberField } from './variants/number/input-number.field';

/**
 * Field-версия Input — диспетчер по `type`: `number` → буфер (InputNumberField),
 * иначе строковый (InputBaseField). Экспортируется как алиас `InputField`.
 *
 * `forwardRef`: оба пути форвардят ref и отдают baseline {@link FieldHandle} — строковый через
 * {@link InputBaseField} (HOC), числовой через собственный `useImperativeHandle` в
 * {@link InputNumberField}.
 */
export const InputField = forwardRef<FieldHandle, Record<string, unknown>>(
  function InputField(props, ref) {
    if (props.type === 'number') return <InputNumberField ref={ref} {...props} />;
    return <InputBaseField ref={ref} {...props} />;
  }
);
InputField.displayName = 'InputField';

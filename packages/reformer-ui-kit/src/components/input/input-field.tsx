import { InputBaseField } from './variants/base/input-base.field';
import { InputNumberField } from './variants/number/input-number.field';

/**
 * Field-версия Input — диспетчер по `type`: `number` → буфер (InputNumberField),
 * иначе строковый (InputBaseField). Экспортируется как алиас `InputField`.
 */
export function InputField(props: Record<string, unknown>) {
  if (props.type === 'number') return <InputNumberField {...props} />;
  return <InputBaseField {...(props as Record<string, unknown>)} />;
}

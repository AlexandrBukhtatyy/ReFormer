import { withFormControl, type FieldAdapter } from '@/fields/with-form-control';
import { InputPassword } from './input-password-base';

/**
 * InputPassword уже value-based (`value: string|null`, `onChange(string|null)`, `onBlur`) — адаптер
 * почти identity: маппинга DOM-события нет (примитив сам делает `e.target.value || null`), HOC нужен
 * лишь чтобы отбросить `control` (renderer-путь).
 */
const inputPasswordAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => v ?? null, // InputPassword сам эмитит null при пустом вводе
  toValue: (v) => v ?? null, // InputPassword принимает string|null (внутри приводит к '' для input)
};

/** Поле пароля: value-based InputPassword + identity-адаптер. */
export const InputPasswordBaseField = withFormControl(InputPassword, inputPasswordAdapter);

import { withFormControl, type FieldAdapter } from '@/fields/with-form-control';
import { InputMask } from './input-mask-base';

/**
 * InputMask уже value-based (`value: string|null`, `onChange(string|null)`, `onBlur`) — адаптер
 * почти identity: DOM-события нет (InputMask сам приводит `e.target.value || null`), HOC нужен
 * лишь чтобы отбросить `control` (renderer-путь). Локальный адаптер, т.к. пресета «value→value»
 * в общем `adapters.ts` нет (там event-shapes shadcn-контролов).
 */
const inputMaskAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => v ?? null, // InputMask эмитит string|null напрямую
  toValue: (v) => v ?? null, // InputMask принимает string|null (внутри → '' для native input)
};

export const InputMaskBaseField = withFormControl(InputMask, inputMaskAdapter);

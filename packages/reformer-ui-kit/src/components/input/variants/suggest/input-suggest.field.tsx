import { withFormControl } from '@/fields/with-form-control';
import { textValueAdapter } from '@/fields/adapters';
import { InputSuggest } from './input-suggest';

/** Строковое поле с подсказками: InputSuggest + textValueAdapter (пустой текст → null). */
export const InputSuggestField = withFormControl(InputSuggest, textValueAdapter);

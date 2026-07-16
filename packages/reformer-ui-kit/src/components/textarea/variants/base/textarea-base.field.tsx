import { withFormControl } from '@/fields/with-form-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { Textarea } from './textarea-base';

/** Многострочное строковое поле: pure Textarea + nativeInputAdapter (e.target.value || null). */
export const TextareaBaseField = withFormControl(Textarea, nativeInputAdapter);

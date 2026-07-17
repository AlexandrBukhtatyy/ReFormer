import { withFormControl } from '@/fields/with-form-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { Input } from './input-base';

/** Строковое поле: pure Input + nativeInputAdapter (e.target.value || null). */
export const InputBaseField = withFormControl(Input, nativeInputAdapter);

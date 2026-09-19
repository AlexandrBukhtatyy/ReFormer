import { withFormControl } from '@/fields/with-form-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { withFieldTooltip, INSIDE_TEXTAREA } from '@/fields/field-tooltip';
import { Textarea } from './textarea-base';

/** Многострочное строковое поле: pure Textarea + nativeInputAdapter (e.target.value || null). */
export const TextareaBaseField = withFormControl(
  withFieldTooltip(Textarea, INSIDE_TEXTAREA),
  nativeInputAdapter
);

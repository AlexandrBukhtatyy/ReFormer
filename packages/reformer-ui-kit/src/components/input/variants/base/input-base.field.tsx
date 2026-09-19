import { withFormControl } from '@/fields/with-form-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { withFieldTooltip, INSIDE_INPUT } from '@/fields/field-tooltip';
import { Input } from './input-base';

/**
 * Pure Input + проп `tooltip`: иконка-подсказка (i) поверх правого края поля. Примитив остаётся
 * дословным портом shadcn — декорация живёт здесь. Переиспользуется числовым вариантом.
 */
export const InputWithTooltip = withFieldTooltip(Input, INSIDE_INPUT);

/** Строковое поле: pure Input + nativeInputAdapter (e.target.value || null). */
export const InputBaseField = withFormControl(InputWithTooltip, nativeInputAdapter);

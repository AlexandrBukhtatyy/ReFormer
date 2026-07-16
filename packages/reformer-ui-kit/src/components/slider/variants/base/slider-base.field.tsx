import { withFormControl } from '@/fields/with-form-control';
import { sliderAdapter } from '@/fields/adapters';
import { Slider } from './slider-base';

/**
 * Value-based контракт field-версии Slider. Значение — `number | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `min`/`max`/`step`/`className` в
 * `componentProps`. Служит типом для стража props-схемы: base — Radix `value: number[]` /
 * `onValueChange`, а field-контракт скалярный (`sliderAdapter`, одно-thumb режим).
 */
export interface SliderFieldProps {
  value?: number | null;
  onChange?: (value: number | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * Field-версия Slider: pure shadcn Slider + `sliderAdapter`. Скалярный контракт формы
 * (`value: number | null`) сводится к Radix-массиву: `toValue: v => [v ?? 0]` (одно-thumb),
 * `fromEmit: arr => arr[0] ?? null`. НЕ inline-раскладка — верхнюю подпись рисует FormField
 * (маркер `reformerLayout` не ставится). Экспортируется как алиас `SliderField`.
 */
export const SliderBaseField = withFormControl(Slider, sliderAdapter);

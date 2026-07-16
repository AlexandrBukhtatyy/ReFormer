// base — pure shadcn Slider (Radix, role=slider на Thumb).
export { Slider } from './variants/base/slider-base';

// field-версия + алиас SliderField (дефолтный для форм; НЕ inline-label).
export { SliderBaseField } from './variants/base/slider-base.field';
export { SliderBaseField as SliderField } from './variants/base/slider-base.field';
export type { SliderFieldProps } from './variants/base/slider-base.field';

// props-схема.
export { sliderBasePropsSchema } from './variants/base/slider-base.props';

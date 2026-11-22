// base — pure shadcn Radix RadioGroup (Root role=radiogroup) + RadioGroupItem (button role=radio).
export { RadioGroup, RadioGroupItem } from './variants/base/radio-group-base';

// options — группа из массива options (per-option data-testid) + проп tooltip. Компонент для формы
// (registry RadioGroup).
export { RadioGroupOptions } from './variants/base/radio-group-options';
export type { RadioOption, RadioGroupOptionsProps } from './variants/base/radio-group-options';

// props-схема.
export { radioGroupBasePropsSchema } from './variants/base/radio-group-base.props';

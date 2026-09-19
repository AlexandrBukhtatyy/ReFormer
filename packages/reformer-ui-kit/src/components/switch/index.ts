// base — pure shadcn Switch (Radix, role=switch).
export { Switch } from './variants/base/switch-base';

// with-label — переключатель + подпись справа (inline-label). Компонент для формы (registry Switch).
export { SwitchWithLabel } from './variants/base/switch-with-label';
export type { SwitchWithLabelProps, SwitchFormProps } from './variants/base/switch-with-label';

// props-схема.
export { switchBasePropsSchema } from './variants/base/switch-base.props';

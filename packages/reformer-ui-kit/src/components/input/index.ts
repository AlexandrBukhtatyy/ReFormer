// base — shadcn Input (native) + проп tooltip. Компонент для формы (registry Input).
export { Input } from './variants/base/input-base';

// number — числовое поле с сырым буфером ввода (value: number | null; registry InputNumber).
export { InputNumber, type InputNumberProps } from './variants/number/input-number';

// suggest — свободный ввод + подсказки (headless-ядро: @reformer/cdk/autocomplete; registry InputSuggest).
export { InputSuggest, type InputSuggestProps } from './variants/suggest/input-suggest';

// props-схемы.
export { inputBasePropsSchema } from './variants/base/input-base.props';
export { inputNumberPropsSchema } from './variants/number/input-number.props';
export { inputSuggestPropsSchema } from './variants/suggest/input-suggest.props';

// base — pure shadcn Input (native).
export { Input } from './variants/base/input-base';
export { InputBaseField } from './variants/base/input-base.field';
export { InputNumberField } from './variants/number/input-number.field';

// suggest — свободный ввод + подсказки (headless-ядро: @reformer/cdk/autocomplete).
export { InputSuggest, type InputSuggestProps } from './variants/suggest/input-suggest';
export { InputSuggestField } from './variants/suggest/input-suggest.field';

// field-версия + алиас InputField (диспетчер по type).
export { InputField } from './input-field';

// props-схема.
export { inputBasePropsSchema } from './variants/base/input-base.props';

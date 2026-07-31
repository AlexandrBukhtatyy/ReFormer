// ReFormer-специфичные carry-компоненты (не shadcn):
// - FormArraySection — UI-обёртка поверх headless-compound `@reformer/cdk/form-array` (React/TS,
//   контракт control + itemComponent);
// - FormArray — editable-секция для renderer-json (`$component(FormArray)`, контракт array + item
//   через useModelArrayItems). Двойник display-компонента `List`.
export { FormArraySection } from './variants/base/form-array-section';
export type { FormArraySectionProps } from './variants/base/form-array-section';
export { FormArray } from './variants/base/form-array';
export type { FormArrayProps } from './variants/base/form-array';

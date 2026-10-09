// ReFormer-специфичные carry-компоненты (не shadcn):
// - FieldArraySection — UI-обёртка поверх headless-compound `@reformer/cdk/field-array` (React/TS,
//   контракт control + itemComponent);
// - FieldArray — editable-секция для renderer-json (`$component(FieldArray)`, контракт
//   items + onAdd/onRemove/onMove). Двойник display-компонента `List`.
export { FieldArraySection } from './variants/base/field-array-section';
export type { FieldArraySectionProps } from './variants/base/field-array-section';
export { FieldArray } from './variants/base/field-array';
export type { FieldArrayProps } from './variants/base/field-array';

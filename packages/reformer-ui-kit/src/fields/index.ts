/**
 * Публичный слой создания собственных form-полей (`@reformer/ui-kit/fields`).
 *
 * Даёт консюмеру ровно то, чем ui-kit строит свои `*Field`-компоненты: HOC
 * {@link withFormControl}, набор адаптеров event-shape и хелпер императивного handle.
 * Без него тип {@link FieldHandle} из корневого barrel было бы можно объявить,
 * но нечем построить и некуда передать.
 *
 * @example Своё поле из стороннего примитива
 * ```tsx
 * import { withFormControl, nativeInputAdapter } from '@reformer/ui-kit/fields';
 *
 * export const MyInputField = withFormControl(MyInput, nativeInputAdapter);
 * ```
 *
 * @example Композит со своим императивным handle
 * ```tsx
 * import { withFormControl, type FieldHandle } from '@reformer/ui-kit/fields';
 *
 * export interface MySelectHandle extends FieldHandle {
 *   open(): void;
 * }
 * // MySelect сам реализует useImperativeHandle → passthrough, HOC свой handle не вешает
 * export const MySelectField = withFormControl(MySelect, myAdapter, { exposesHandle: true });
 * ```
 *
 * Схемы пропсов (`PropsSchema`, `mergeFieldPropsSchema`) сюда НЕ входят — они
 * публикуются отдельной точкой `@reformer/ui-kit/meta`.
 */

// HOC + его контракты.
export { withFormControl } from './with-form-control';
export type { FieldAdapter, WithFormControlOptions } from './with-form-control';

// Императивный handle поля.
export { makeElementFieldHandle } from './field-handle';
export type { FieldHandle } from './field-handle';

// Пресеты event-shape под семейства shadcn-контролов.
export {
  nativeInputAdapter,
  checkedAdapter,
  pressedAdapter,
  valueChangeAdapter,
  sliderAdapter,
  dateAdapter,
} from './adapters';

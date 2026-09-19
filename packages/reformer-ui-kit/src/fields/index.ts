/**
 * Публичный слой form-интеграции кита (`@reformer/ui-kit/fields`).
 *
 * Отдельных «field-версий» компонентов нет: в `component` поля кладётся сам компонент, а связь с
 * формой выполняет обёртка поля — `FormField.Control` из `@reformer/cdk` или рендерер. Диалект
 * контрола (`checked`/`onCheckedChange`, `onValueChange`, DOM-событие, …) компонент объявляет
 * статикой через {@link defineFieldControl}; готовые пресеты адаптеров — здесь же.
 *
 * @example Свой контрол из стороннего примитива
 * ```tsx
 * import { defineFieldControl, checkedAdapter } from '@reformer/ui-kit/fields';
 *
 * export const MyCheckbox = defineFieldControl(ThirdPartyCheckbox, { adapter: checkedAdapter });
 * // модель формы: { value: model.$.agree, component: MyCheckbox }
 * ```
 *
 * Императивный handle (`FieldHandle`) строит обёртка поля: из DOM-узла контрола либо берёт handle
 * самого композита, если тот его реализует (`useImperativeHandle`).
 *
 * Схемы пропсов (`PropsSchema`, `mergeFieldPropsSchema`) сюда НЕ входят — они
 * публикуются отдельной точкой `@reformer/ui-kit/meta`.
 */

// Контракт контрола с формой: статики адаптера и раскладки.
export { defineFieldControl } from './field-control';
export type { FieldControlLayout, FieldControlStatics } from './field-control';
export type { FieldAdapter } from '@reformer/core';

// Подсказка-иконка (i) у контрола — проп `tooltip`: декоратор для примитивов и хук для композитов.
export {
  withFieldTooltip,
  useFieldTooltip,
  mergeIds,
  INSIDE_INPUT,
  INSIDE_TEXTAREA,
  INSIDE_NATIVE_SELECT,
  INSIDE_BUTTON,
  OUTSIDE_CENTER,
  OUTSIDE_START,
  OUTSIDE_START_GROUP,
  OUTSIDE_FILL,
  OUTSIDE_FILL_START,
} from './field-tooltip';
export type {
  FieldTooltipProps,
  FieldTooltipPlacement,
  UseFieldTooltipOptions,
  UseFieldTooltipResult,
} from './field-tooltip';

// Императивный handle поля (контракт — в @reformer/core).
export { makeElementFieldHandle } from './field-handle';
export type { FieldHandle } from './field-handle';

// Пресеты event-shape под семейства shadcn-контролов.
export {
  nativeInputAdapter,
  textValueAdapter,
  checkedAdapter,
  pressedAdapter,
  valueChangeAdapter,
  multiValueAdapter,
  sliderAdapter,
  dateAdapter,
  datePickerAdapter,
} from './adapters';
export type { KitFieldAdapter } from './adapters';

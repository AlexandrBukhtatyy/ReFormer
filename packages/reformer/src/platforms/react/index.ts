/**
 * Модуль `platforms/react` — биндинги ядра к React.
 *
 * Единственное место в пакете, где есть runtime-зависимость от `react` и
 * `use-sync-external-store`: слои `model` и `form` от React свободны (в `form/types/` остаются
 * только type-only `ComponentType`/`ElementType` — они стираются при компиляции). Хуки читают
 * сигналы нод формы через `useSyncExternalStore` и отдают плоские снапшоты
 * ({@link FieldControlState}/{@link ArrayControlState}) в рендер.
 *
 * Barrel заведён как точка для будущего сабпата `@reformer/core/react`; сейчас его состав
 * реэкспортируется зонтиком `@reformer/core` — ровно теми же именами, что и до выноса.
 *
 * @group Platforms
 * @module platforms/react
 */

export { useFormControl } from './hooks/useFormControl';
export { useFormControlValue } from './hooks/useFormControlValue';
export { useArrayLength } from './hooks/useArrayLength';
export { useFormValidation } from './hooks/use-form-validation';
export type { UseFormValidationArgs, UseFormValidationResult } from './hooks/use-form-validation';
export { useFormBundle } from './hooks/use-form-bundle';
export type { FormBundleLike } from './hooks/use-form-bundle';
export type { FieldControlState, ArrayControlState } from './hooks/types';

// Связка поля с контролом: адаптер диалекта (статика `reformerAdapter`) и императивный handle.
// Общие для `FormField.Control` (@reformer/cdk) и рендерера (@reformer/renderer-react).
export {
  getFieldAdapter,
  bindFieldProps,
  FIELD_WRAPPER_ONLY_PROPS,
} from './field-binding/field-adapter';
export type { FieldAdapter, FieldAdapterCarrier, FieldSeam } from './field-binding/field-adapter';
export { makeElementFieldHandle, useFieldHandleRef } from './field-binding/field-handle';
export type { FieldHandle } from './field-binding/field-handle';

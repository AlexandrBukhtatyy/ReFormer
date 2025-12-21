import { useCallback, useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { effect } from '@preact/signals-core';
import type { FieldNode } from '../core/nodes/field-node';
import type { FormValue } from '../core/types';

/**
 * React-хук для подписки только на значение поля.
 *
 * Оптимизированная версия {@link useFormControl}, которая подписывается
 * только на сигнал `value`. Компонент не будет ре-рендериться при изменении
 * `errors`, `touched`, `valid` и других свойств состояния.
 *
 * ## Когда использовать
 *
 * - **Условный рендеринг** на основе значения другого поля
 * - **Вычисляемые значения** зависящие от значения поля
 * - **Read-only отображение** значения без интерактивности
 * - **Оптимизация производительности** когда не нужны другие свойства состояния
 *
 * ## Когда НЕ использовать
 *
 * Если компоненту нужны `errors`, `touched`, `disabled` или другие свойства -
 * используйте {@link useFormControl}. Множественные подписки на один контрол
 * через разные хуки менее эффективны, чем одна подписка через `useFormControl`.
 *
 * @typeParam T - Тип значения поля
 * @param control - FieldNode для подписки на значение
 * @returns Текущее значение поля
 *
 * @example Условный рендеринг секции
 * ```tsx
 * import { useFormControlValue } from '@reformer/core';
 *
 * interface FormFields {
 *   hasShipping: FieldNode<boolean>;
 *   shippingAddress: GroupNode<AddressFields>;
 * }
 *
 * function ShippingSection({ form }: { form: FormFields }) {
 *   // Подписка только на значение checkbox
 *   const hasShipping = useFormControlValue(form.hasShipping);
 *
 *   if (!hasShipping) {
 *     return null;
 *   }
 *
 *   return (
 *     <div className="shipping-section">
 *       <h3>Shipping Address</h3>
 *       <AddressForm control={form.shippingAddress} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Динамические опции на основе другого поля
 * ```tsx
 * interface FormFields {
 *   country: FieldNode<string>;
 *   city: FieldNode<string>;
 * }
 *
 * function CitySelect({ form }: { form: FormFields }) {
 *   const country = useFormControlValue(form.country);
 *   const { value, disabled } = useFormControl(form.city);
 *
 *   // Получаем города для выбранной страны
 *   const cities = useMemo(() => getCitiesForCountry(country), [country]);
 *
 *   // Сбрасываем город при смене страны
 *   useEffect(() => {
 *     form.city.setValue('');
 *   }, [country, form.city]);
 *
 *   return (
 *     <select
 *       value={value}
 *       disabled={disabled || !country}
 *       onChange={e => form.city.setValue(e.target.value)}
 *     >
 *       <option value="">Select city...</option>
 *       {cities.map(city => (
 *         <option key={city.id} value={city.id}>{city.name}</option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 *
 * @example Отображение суммы в реальном времени
 * ```tsx
 * interface OrderItem {
 *   quantity: FieldNode<number>;
 *   price: FieldNode<number>;
 * }
 *
 * function OrderTotal({ items }: { items: ArrayNode<OrderItem> }) {
 *   // Для каждого элемента получаем только значения
 *   const quantities = items.map(item => useFormControlValue(item.controls.quantity));
 *   const prices = items.map(item => useFormControlValue(item.controls.price));
 *
 *   const total = quantities.reduce((sum, qty, i) => sum + qty * prices[i], 0);
 *
 *   return (
 *     <div className="order-total">
 *       <strong>Total: ${total.toFixed(2)}</strong>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Preview значения
 * ```tsx
 * interface MarkdownEditorProps {
 *   control: FieldNode<string>;
 * }
 *
 * function MarkdownPreview({ control }: MarkdownEditorProps) {
 *   // Подписка только на значение для preview
 *   const markdown = useFormControlValue(control);
 *
 *   const html = useMemo(() => marked(markdown), [markdown]);
 *
 *   return (
 *     <div
 *       className="markdown-preview"
 *       dangerouslySetInnerHTML={{ __html: html }}
 *     />
 *   );
 * }
 *
 * // Основной редактор использует useFormControl для полного состояния
 * function MarkdownEditor({ control }: MarkdownEditorProps) {
 *   const { value, shouldShowError, errors } = useFormControl(control);
 *
 *   return (
 *     <div className="editor-container">
 *       <textarea
 *         value={value}
 *         onChange={e => control.setValue(e.target.value)}
 *       />
 *       {shouldShowError && <span className="error">{errors[0]?.message}</span>}
 *
 *       {/* Preview обновляется только при изменении value *}
 *       <MarkdownPreview control={control} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Счётчик символов
 * ```tsx
 * function CharacterCounter({ control, max }: { control: FieldNode<string>; max: number }) {
 *   const value = useFormControlValue(control);
 *   const remaining = max - value.length;
 *
 *   return (
 *     <span className={remaining < 20 ? 'warning' : ''}>
 *       {remaining} characters remaining
 *     </span>
 *   );
 * }
 * ```
 *
 * @see {@link useFormControl} - для полного состояния поля
 * @see {@link FieldNode} - тип контрола поля
 *
 * @group React Hooks
 */
export function useFormControlValue<T extends FormValue>(control: FieldNode<T>): T {
  const cacheRef = useRef<{ value: T }>({ value: control.value.value });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;

      const dispose = effect(() => {
        void control.value.value;

        if (isFirstRun) {
          isFirstRun = false;
          return;
        }

        onStoreChange();
      });

      return dispose;
    },
    [control]
  );

  const getSnapshot = useCallback((): T => {
    const currentValue = control.value.value;

    if (cacheRef.current.value === currentValue) {
      return cacheRef.current.value;
    }

    cacheRef.current.value = currentValue;
    return currentValue;
  }, [control]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

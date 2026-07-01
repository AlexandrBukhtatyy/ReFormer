import { forwardRef, type ForwardedRef, type ReactElement } from 'react';
import type { FormFields } from '@reformer/core';
import { Slot } from '../form-wizard/Slot';
import { useFormArrayContext } from './FormArrayContext';
import type { FormArrayAddButtonProps } from './types';

function FormArrayAddButtonInner<T extends object>(
  { children, initialValue, asChild = false, ...props }: FormArrayAddButtonProps<T>,
  ref: ForwardedRef<HTMLButtonElement>
) {
  const { add } = useFormArrayContext();

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : 'button'}
      onClick={() => add(initialValue)}
      {...props}
    >
      {children}
    </Comp>
  );
}

const FormArrayAddButtonForwarded = forwardRef(FormArrayAddButtonInner) as <
  T extends object = FormFields,
>(
  props: FormArrayAddButtonProps<T> & { ref?: React.Ref<HTMLButtonElement> }
) => ReactElement | null;

(FormArrayAddButtonForwarded as { displayName?: string }).displayName = 'FormArray.AddButton';

/**
 * `FormArray.AddButton` — кнопка добавления нового элемента в массив.
 *
 * Рендерит `<button type="button">` (или произвольный элемент через `asChild`),
 * по клику вызывает `add(initialValue)` из контекста {@link FormArrayContext},
 * то есть `ArrayNode.push`. Должна находиться внутри `FormArray.Root` (или
 * эквивалентного провайдера), иначе `useFormArrayContext` бросит исключение.
 *
 * Generic `T` — тип элемента массива. По умолчанию `FormFields` (широкий).
 * Передавайте его явно, если нужна type-safe проверка `initialValue`:
 * `<FormArray.AddButton<PropertyItem> initialValue={...}>`.
 *
 * @typeParam T - Тип одного элемента массива.
 *
 * @example Внутри compound-разметки FormArray
 * ```tsx
 * <FormArray.Root control={form.properties}>
 *   <FormArray.List>
 *     {({ control }) => <PropertyForm control={control} />}
 *   </FormArray.List>
 *
 *   <FormArray.AddButton className="btn-primary">
 *     + Добавить объект
 *   </FormArray.AddButton>
 * </FormArray.Root>
 * ```
 *
 * @example С типизированным initialValue
 * ```tsx
 * <FormArray.AddButton<Property> initialValue={{ type: 'apartment', estimatedValue: 0 }}>
 *   + Квартира
 * </FormArray.AddButton>
 * ```
 *
 * @example Своя кнопка через asChild (props мержатся в дочерний элемент)
 * ```tsx
 * <FormArray.AddButton asChild initialValue={{ name: '' }}>
 *   <MyButton variant="primary">+ Добавить</MyButton>
 * </FormArray.AddButton>
 * ```
 */
export const FormArrayAddButton = FormArrayAddButtonForwarded;

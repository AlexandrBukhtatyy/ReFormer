import { forwardRef, type ForwardedRef, type ReactElement } from 'react';
import type { FormFields } from '@reformer/core';
import { Slot } from '../form-wizard/Slot';
import { useFormArrayContext } from './FormArrayContext';
import type { FormArrayAddButtonProps } from './types';

/**
 * FormArray.AddButton - Button to add new items to the array.
 *
 * Generic `T` — тип элемента массива. Передавайте его явно, если нужна
 * type-safe проверка `initialValue`:
 * `<FormArray.AddButton<PropertyItem> initialValue={...}>`.
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.AddButton className="btn-primary">
 *   + Add Item
 * </FormArray.AddButton>
 * ```
 *
 * @example With initial value (typed)
 * ```tsx
 * <FormArray.AddButton<TodoItem> initialValue={{ status: 'draft', title: '' }}>
 *   Add Draft
 * </FormArray.AddButton>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormArray.AddButton asChild initialValue={{ name: '' }}>
 *   <MyButton variant="primary">+ Add Item</MyButton>
 * </FormArray.AddButton>
 * ```
 */
function FormArrayAddButtonInner<T extends FormFields>(
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
  T extends FormFields = FormFields,
>(
  props: FormArrayAddButtonProps<T> & { ref?: React.Ref<HTMLButtonElement> }
) => ReactElement | null;

(FormArrayAddButtonForwarded as { displayName?: string }).displayName = 'FormArray.AddButton';

export const FormArrayAddButton = FormArrayAddButtonForwarded;

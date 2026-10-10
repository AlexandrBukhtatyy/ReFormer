import { forwardRef, type ForwardedRef, type ReactElement } from 'react';
import { useFormControl } from '@reformer/core/react';
import { Slot } from '../form-wizard/Slot';
import { useFieldArrayContext } from './FieldArrayContext';
import type { FieldArrayAddButtonProps } from './types';

function FieldArrayAddButtonInner<T extends object>(
  { children, initialValue, asChild = false, disabled, ...props }: FieldArrayAddButtonProps<T>,
  ref: ForwardedRef<HTMLButtonElement>
) {
  const { add, control } = useFieldArrayContext<T>();
  // Отражаем disabled-состояние массива: после disable() ноды массива (в т.ч. каскадом от группы)
  // массив структурно неизменяем, поэтому кнопка добавления должна быть отключена.
  const { disabled: arrayDisabled } = useFormControl(control);
  const isDisabled = disabled || arrayDisabled;

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : 'button'}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        add(initialValue);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

const FieldArrayAddButtonForwarded = forwardRef(FieldArrayAddButtonInner) as <
  T extends object = Record<string, unknown>,
>(
  props: FieldArrayAddButtonProps<T> & { ref?: React.Ref<HTMLButtonElement> }
) => ReactElement | null;

(FieldArrayAddButtonForwarded as { displayName?: string }).displayName = 'FieldArray.AddButton';

/**
 * `FieldArray.AddButton` — кнопка добавления нового элемента в массив.
 *
 * Рендерит `<button type="button">` (или произвольный элемент через `asChild`),
 * по клику вызывает `add(initialValue)` из контекста {@link FieldArrayContext},
 * то есть `FormArray.push`. Должна находиться внутри `FieldArray.Root` (или
 * эквивалентного провайдера), иначе `useFieldArrayContext` бросит исключение.
 *
 * Без `initialValue` новый элемент берётся из шаблона массива модели —
 * `arrayOf(blank)` из `@reformer/core`, объявленного рядом с остальными начальными
 * значениями. Проп `initialValue` — запасной путь для массива без шаблона.
 *
 * Generic `T` — тип элемента массива. По умолчанию `Record<string, unknown>` (широкий).
 * Передавайте его явно, если нужна type-safe проверка `initialValue`:
 * `<FieldArray.AddButton<PropertyItem> initialValue={...}>`.
 *
 * @typeParam T - Тип одного элемента массива.
 *
 * @example Внутри compound-разметки FieldArray
 * ```tsx
 * <FieldArray.Root control={form.properties}>
 *   <FieldArray.List>
 *     {({ control }) => <PropertyForm control={control} />}
 *   </FieldArray.List>
 *
 *   <FieldArray.AddButton className="btn-primary">
 *     + Добавить объект
 *   </FieldArray.AddButton>
 * </FieldArray.Root>
 * ```
 *
 * @example Шаблон нового элемента — в модели
 * ```tsx
 * // model.ts
 * const model = createModel<Form>({ properties: arrayOf(blankProperty) });
 *
 * // разметка: значение нового элемента кнопке не нужно
 * <FieldArray.AddButton>+ Добавить объект</FieldArray.AddButton>
 * ```
 *
 * @example Запасной путь — типизированный initialValue для массива без шаблона
 * ```tsx
 * <FieldArray.AddButton<Property> initialValue={{ type: 'apartment', estimatedValue: 0 }}>
 *   + Квартира
 * </FieldArray.AddButton>
 * ```
 *
 * @example Своя кнопка через asChild (props мержатся в дочерний элемент)
 * ```tsx
 * <FieldArray.AddButton asChild>
 *   <MyButton variant="primary">+ Добавить</MyButton>
 * </FieldArray.AddButton>
 * ```
 */
export const FieldArrayAddButton = FieldArrayAddButtonForwarded;

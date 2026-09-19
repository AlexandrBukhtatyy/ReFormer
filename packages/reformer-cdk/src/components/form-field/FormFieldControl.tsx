import { Children, forwardRef, isValidElement } from 'react';
import type React from 'react';
import {
  bindFieldProps,
  getFieldAdapter,
  useFieldHandleRef,
  type FieldHandle,
  type FieldSeam,
  type FormValue,
} from '@reformer/core';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import type { FormFieldControlProps } from './types';

/**
 * FormField.Control - Renders the interactive form control.
 *
 * **Auto-render mode** (default): renders `control.component` with all necessary
 * props pre-wired: `value`, `onChange`, `onBlur`, `disabled`, `aria-*` attributes,
 * and all `componentProps` from the field config.
 *
 * The control's own dialect (`checked`/`onCheckedChange`, `value`/`onValueChange`, DOM event,
 * …) is taken from its `reformerAdapter` static (see `getFieldAdapter` in `@reformer/core`) —
 * a component is bound as is, no per-control "field" wrapper is needed. The forwarded ref gets
 * the control's own imperative handle, or a baseline `FieldHandle` built from its DOM node.
 *
 * **Custom children mode** (`asChild` or `children`): merges accessible props
 * into the provided child element via Slot, letting you use any custom component. Field
 * bindings are added only where the child does not already carry them — so a control that was
 * bound upstream (renderer passes a ready control to the field wrapper) is not bound twice.
 *
 * @example Auto-render (renders control.component)
 * ```tsx
 * <FormField.Root control={control.email}>
 *   <FormField.Label />
 *   <FormField.Control />
 * </FormField.Root>
 * ```
 *
 * @example Custom input with asChild (merges aria-* into your element)
 * ```tsx
 * <FormField.Control asChild>
 *   <MyInput type="email" className="custom-input" />
 * </FormField.Control>
 * ```
 *
 * @example Custom children (same as asChild)
 * ```tsx
 * <FormField.Control>
 *   <MyInput type="email" />
 * </FormField.Control>
 * ```
 */
export const FormFieldControl = forwardRef<FieldHandle | HTMLElement, FormFieldControlProps>(
  ({ asChild = false, children, ...props }, ref) => {
    const {
      control,
      value,
      disabled,
      shouldShowError,
      errors,
      required,
      ids,
      hasDescription,
      hasHint,
      componentProps,
    } = useFormFieldContext();
    // Хук — безусловно (правила хуков); ref контролу вешается только в авто-рендере и только
    // когда потребитель его запросил.
    const handleRef = useFieldHandleRef(ref);

    // Порядок id — как визуально: ряд подписи (hint) → описание → ошибка.
    const ariaDescribedBy =
      [
        hasHint ? ids.hintId : null,
        hasDescription ? ids.descriptionId : null,
        shouldShowError && errors.length > 0 ? ids.errorId : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    const accessibleProps = {
      id: ids.controlId,
      'aria-labelledby': ids.labelId,
      'aria-invalid': shouldShowError ? (true as const) : undefined,
      'aria-describedby': ariaDescribedBy,
      'aria-errormessage': shouldShowError && errors.length > 0 ? ids.errorId : undefined,
      'aria-required': required ? (true as const) : undefined,
    };

    const seam: FieldSeam = {
      value,
      onChange: (v: unknown) => control.setValue(v as FormValue),
      onBlur: () => control.markAsTouched(),
    };

    if (children || asChild) {
      // asChild/children: подключаем поле к Slot так же, как в авто-рендере — в диалекте
      // дочернего контрола (его `reformerAdapter`, иначе value-based seam). Без этого кастомный
      // input получает корректный ARIA, но остаётся отсоединённым от FieldNode.
      //
      // Привязки, которые у ребёнка УЖЕ есть, не добавляем: рендерер отдаёт обёртке поля готовый,
      // привязанный контрол, и Slot склеил бы два onChange — второй получил бы сырой эмит
      // контрола (DOM-событие) и записал бы его в поле поверх правильного значения.
      const child = Children.count(children) === 1 ? Children.only(children) : null;
      const childProps = isValidElement(child) ? (child.props as Record<string, unknown>) : {};
      const adapter = isValidElement(child) ? getFieldAdapter(child.type) : undefined;
      const fieldBindings: Record<string, unknown> = { disabled };
      for (const [key, bound] of Object.entries(bindFieldProps(adapter, seam))) {
        if (childProps[key] === undefined) fieldBindings[key] = bound;
      }
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          {...(accessibleProps as Record<string, unknown>)}
          {...(props as Record<string, unknown>)}
          {...fieldBindings}
        >
          {children}
        </Slot>
      );
    }

    const Component = control.component as React.ComponentType<Record<string, unknown>>;
    // `testId` — мета-проп поля: его потребляет FormField для генерации `data-testid`
    // (field/label/input/error). В DOM-контрол его пробрасывать нельзя (React-варнинг
    // «unknown prop testId»), поэтому исключаем из spread componentProps.
    const { testId: _testId, ...domComponentProps } = (componentProps ?? {}) as Record<
      string,
      unknown
    >;
    void _testId;
    const bound = bindFieldProps(getFieldAdapter(Component), seam, {
      ...domComponentProps,
      ...(accessibleProps as Record<string, unknown>),
      ...(props as Record<string, unknown>),
    });
    return <Component {...(ref ? { ref: handleRef } : {})} {...bound} disabled={disabled} />;
  }
);

FormFieldControl.displayName = 'FormField.Control';

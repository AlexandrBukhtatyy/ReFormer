import * as React from 'react';
import { useFormControl, type FieldNode, type GroupNode } from 'reformer';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form?: GroupNode<any>;
  className?: string;
  testId?: string;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, form, className, testId }) => {
  const { value, errors, pending, disabled, invalid, shouldShowError, componentProps } =
    useFormControl(control);

  const Component = control.component;
  const isCheckbox = control.component === Checkbox;
  // Конвертируем null/undefined в безопасные значения
  const safeValue = value ?? (isCheckbox ? false : '');

  // Используем переданный testId или componentProps.testId или 'unknown'
  const fieldTestId =
    testId ?? (componentProps as { testId?: string })?.testId ?? 'unknown';

  return (
    <div className={className} data-testid={`field-${fieldTestId}`}>
      {componentProps.label && !isCheckbox && (
        <label className="block mb-1 text-sm font-medium" data-testid={`label-${fieldTestId}`}>
          {componentProps.label}
        </label>
      )}

      <Component
        {...componentProps}
        value={safeValue}
        onChange={(e: unknown) => {
          // Для чекбоксов e - это boolean напрямую
          // Для обычных input e - это event с target.value
          const newValue = isCheckbox
            ? e
            : ((e as { target?: { value?: unknown } })?.target?.value ?? e);
          control.setValue(newValue);
          // Ре-валидация при вводе, если уже есть ошибки (чтобы ошибки исчезали)
          if (errors.length > 0) {
            form ? form.validate() : control.validate();
          }
        }}
        onBlur={() => {
          control.markAsTouched();
          // Запускаем валидацию при blur (для updateOn: 'blur' и 'submit')
          if (control.getUpdateOn() === 'blur' || control.getUpdateOn() === 'submit') {
            form ? form.validate() : control.validate();
          }
        }}
        disabled={disabled}
        aria-invalid={invalid}
        data-testid={`input-${fieldTestId}`}
      />

      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block" data-testid={`error-${fieldTestId}`}>
          {errors[0]?.message}
        </span>
      )}

      {pending && <span className="text-gray-500 text-sm mt-1 block">Проверка...</span>}
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
// Компонент ререндерится только если изменился control, className или testId
export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  // Возвращаем true, если пропсы НЕ изменились (пропустить ререндер)
  return (
    prevProps.control === nextProps.control &&
    prevProps.form === nextProps.form &&
    prevProps.className === nextProps.className &&
    prevProps.testId === nextProps.testId
  );
});

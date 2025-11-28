import * as React from 'react';
import { useFormControl, type FieldNode } from 'reformer';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  control: FieldNode<any>;
  className?: string;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className }) => {
  const { value, errors, pending, disabled, shouldShowError, componentProps } =
    useFormControl(control);

  const Component = control.component;
  const isCheckbox = Component === Checkbox;

  // Конвертируем null/undefined в безопасные значения
  const safeValue = value ?? (isCheckbox ? false : '');

  return (
    <div className={className}>
      {/* Отображаем label (кроме чекбоксов, у которых встроенный label) */}
      {componentProps.label && !isCheckbox && (
        <label className="block mb-1 text-sm font-medium">{componentProps.label}</label>
      )}

      {/* Рендерим сам компонент */}
      <Component
        {...componentProps}
        value={safeValue}
        onChange={(e: unknown) => {
          // Для чекбоксов e — это boolean напрямую
          // Для обычных input e — это event с target.value
          const newValue = isCheckbox
            ? e
            : ((e as { target?: { value?: unknown } })?.target?.value ?? e);
          control.setValue(newValue);
        }}
        onBlur={() => {
          control.markAsTouched();
        }}
        disabled={disabled}
        aria-invalid={shouldShowError}
      />

      {/* Показываем ошибку валидации */}
      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block">{errors[0]?.message}</span>
      )}

      {/* Показываем состояние ожидания при асинхронной валидации */}
      {pending && <span className="text-gray-500 text-sm mt-1 block">Проверка...</span>}
    </div>
  );
};

export const FormField = FormFieldComponent;

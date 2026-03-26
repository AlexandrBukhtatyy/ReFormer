import * as React from 'react';
import { useFormControl, type FieldNode } from '@reformer/core';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  className?: string;
  testId?: string;
  /** Дочерний элемент (input) - для использования с RenderSchema fieldWrapper */
  children?: React.ReactNode;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className, testId, children }) => {
  const { value, errors, pending, disabled, shouldShowError, componentProps } =
    useFormControl(control);

  // Используем переданный testId или componentProps.testId или 'unknown'
  const fieldTestId = testId ?? (componentProps as { testId?: string })?.testId ?? 'unknown';

  // Если children переданы (используется как fieldWrapper), рендерим их
  // Иначе рендерим control.component напрямую (для обратной совместимости)
  const isCheckbox = control.component === Checkbox;

  const renderInput = () => {
    if (children) {
      return children;
    }

    // Обратная совместимость: рендерим control.component напрямую
    const Component = control.component;
    const safeValue = value ?? (isCheckbox ? false : '');

    return (
      <Component
        {...componentProps}
        value={safeValue}
        onChange={(e: unknown) => {
          const newValue = isCheckbox
            ? e
            : ((e as { target?: { value?: unknown } })?.target?.value ?? e);
          control.setValue(newValue);
        }}
        onBlur={() => control.markAsTouched()}
        disabled={disabled}
        aria-invalid={shouldShowError}
        data-testid={`input-${fieldTestId}`}
      />
    );
  };

  return (
    <div className={className} data-testid={`field-${fieldTestId}`}>
      {componentProps.label && !isCheckbox && (
        <label className="block mb-1 text-sm font-medium" data-testid={`label-${fieldTestId}`}>
          {componentProps.label}
        </label>
      )}

      {renderInput()}

      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block" data-testid={`error-${fieldTestId}`}>
          {errors[0]?.message}
        </span>
      )}

      {pending && <span className="text-gray-500 text-sm mt-1 block">Проверка...</span>}
    </div>
  );
};

// Мемоизируем компонент
export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  return (
    prevProps.control === nextProps.control &&
    prevProps.className === nextProps.className &&
    prevProps.testId === nextProps.testId &&
    prevProps.children === nextProps.children
  );
});

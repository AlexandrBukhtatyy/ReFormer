import * as React from 'react';
import { useFormControl, type FieldNode } from 'reformer';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  className?: string;
  testId?: string;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className, testId }) => {
  const { value, errors, pending, disabled, shouldShowError, componentProps } =
    useFormControl(control);

  const Component = control.component;
  const isCheckbox = control.component === Checkbox;
  const safeValue = value ?? (isCheckbox ? false : '');

  const fieldTestId = testId ?? (componentProps as { testId?: string })?.testId ?? 'unknown';

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
        data-testid={`input-${fieldTestId}`}
      />

      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block" data-testid={`error-${fieldTestId}`}>
          {errors[0]?.message}
        </span>
      )}

      {pending && <span className="text-gray-500 text-sm mt-1 block">Validating...</span>}
    </div>
  );
};

export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  return (
    prevProps.control === nextProps.control &&
    prevProps.className === nextProps.className &&
    prevProps.testId === nextProps.testId
  );
});

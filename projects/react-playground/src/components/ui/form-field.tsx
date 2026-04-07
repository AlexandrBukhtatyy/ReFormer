import * as React from 'react';
import { type FieldNode } from '@reformer/core';
import { useFormField } from '@reformer/cdk/form-field';
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
  const { labelProps, controlProps, errorProps, state } = useFormField(control);

  const fieldTestId = testId ?? (state.componentProps as { testId?: string })?.testId ?? 'unknown';
  const isCheckbox = control.component === Checkbox;
  const safeValue = state.value ?? (isCheckbox ? false : '');

  const renderInput = () => {
    if (children) {
      // fieldWrapper mode: children — уже отрендеренный input из RenderSchema
      return children;
    }

    const Component = control.component as React.ComponentType<Record<string, unknown>>;

    return (
      <Component
        {...(state.componentProps as Record<string, unknown>)}
        id={controlProps.id}
        aria-labelledby={controlProps['aria-labelledby']}
        aria-invalid={controlProps['aria-invalid']}
        aria-errormessage={controlProps['aria-errormessage']}
        value={safeValue}
        onChange={controlProps.onChange}
        onBlur={controlProps.onBlur}
        disabled={state.isDisabled}
        data-testid={`input-${fieldTestId}`}
      />
    );
  };

  return (
    <div className={className} data-testid={`field-${fieldTestId}`}>
      {state.label && !isCheckbox && (
        <label
          {...labelProps}
          className="block mb-1 text-sm font-medium"
          data-testid={`label-${fieldTestId}`}
        >
          {state.label}
        </label>
      )}

      {renderInput()}

      {state.shouldShowError && (
        <span
          {...errorProps}
          className="text-red-500 text-sm mt-1 block"
          data-testid={`error-${fieldTestId}`}
        >
          {state.error}
        </span>
      )}

      {state.isPending && <span className="text-gray-500 text-sm mt-1 block">Проверка...</span>}
    </div>
  );
};

export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  return (
    prevProps.control === nextProps.control &&
    prevProps.className === nextProps.className &&
    prevProps.testId === nextProps.testId &&
    prevProps.children === nextProps.children
  );
});

import * as React from 'react';
import { type FieldNode } from '@reformer/core';
import { FormField as CdkFormField, useFormFieldContext } from '@reformer/cdk/form-field';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  className?: string;
  testId?: string;
  /** Дочерний элемент (input) - для использования с RenderSchema fieldWrapper */
  children?: React.ReactNode;
}

interface FormFieldInnerProps {
  className?: string;
  testIdProp?: string;
  isCheckbox: boolean;
  customChildren?: React.ReactNode;
}

/**
 * Inner component reads context provided by CdkFormField.Root.
 * Needed to access componentProps for testId fallback and pending state.
 */
function FormFieldInner({
  className,
  testIdProp,
  isCheckbox,
  customChildren,
}: FormFieldInnerProps) {
  const { componentProps, pending } = useFormFieldContext();
  const testId = testIdProp ?? (componentProps as { testId?: string })?.testId ?? 'unknown';

  return (
    <div className={className} data-testid={`field-${testId}`}>
      {!isCheckbox && (
        <CdkFormField.Label
          className="block mb-1 text-sm font-medium"
          data-testid={`label-${testId}`}
        />
      )}

      {customChildren ? (
        <CdkFormField.Control asChild>{customChildren}</CdkFormField.Control>
      ) : (
        <CdkFormField.Control data-testid={`input-${testId}`} />
      )}

      <CdkFormField.Error
        className="text-destructive text-sm mt-1 block"
        data-testid={`error-${testId}`}
      />

      {pending && <span className="text-gray-500 text-sm mt-1 block">Проверка...</span>}
    </div>
  );
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className, testId, children }) => {
  const isCheckbox = control.component === Checkbox;

  return (
    <CdkFormField.Root control={control}>
      <FormFieldInner
        className={className}
        testIdProp={testId}
        isCheckbox={isCheckbox}
        customChildren={children}
      />
    </CdkFormField.Root>
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

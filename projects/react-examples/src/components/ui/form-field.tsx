import * as React from 'react';
import { useFormControl, type FieldNode } from 'reformer';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  className?: string;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className }) => {
  const { value, errors, pending, disabled, invalid, shouldShowError } = useFormControl(control);

  const Component = control.component;
  const isCheckbox = control.component === Checkbox;
  // Конвертируем null/undefined в безопасные значения
  const safeValue = value.value ?? (isCheckbox ? false : '');

  return (
    <div className={className}>
      {control.componentProps.value.label && !isCheckbox && (
        <label className="block mb-1 text-sm font-medium">
          {control.componentProps.value.label}
        </label>
      )}

      <Component
        value={safeValue}
        onChange={(e: unknown) => {
          // Для чекбоксов e - это boolean напрямую
          // Для обычных input e - это event с target.value
          const newValue = isCheckbox
            ? e
            : ((e as { target?: { value?: unknown } })?.target?.value ?? e);
          control.setValue(newValue);
        }}
        onBlur={() => {
          control.markAsTouched();
          // Запускаем валидацию при blur (для updateOn: 'blur' и 'submit')
          if (control.getUpdateOn() === 'blur' || control.getUpdateOn() === 'submit') {
            control.validate();
          }
        }}
        disabled={disabled.value}
        aria-invalid={invalid.value}
        {...control.componentProps.value}
      />

      {shouldShowError.value && (
        <span className="text-red-500 text-sm mt-1 block">{errors.value[0]?.message}</span>
      )}

      {pending.value && <span className="text-gray-500 text-sm mt-1 block">Проверка...</span>}
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
// Компонент ререндерится только если изменился control или className
export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  // Возвращаем true, если пропсы НЕ изменились (пропустить ререндер)
  return prevProps.control === nextProps.control && prevProps.className === nextProps.className;
});

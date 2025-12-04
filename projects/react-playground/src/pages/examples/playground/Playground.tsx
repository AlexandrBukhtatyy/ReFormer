import * as React from 'react';
import { useMemo } from 'react';
import { createForm, useFormControl, type FieldNode } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

// ============================================================================
// Шаг 1: Компоненты для полей
// ============================================================================

interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, onBlur, placeholder, disabled }, ref) => (
    <input
      ref={ref}
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="border rounded px-3 py-2 w-full"
    />
  )
);
Input.displayName = 'Input';

interface TextareaProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ value, onChange, onBlur, placeholder, disabled }, ref) => (
    <textarea
      ref={ref}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      rows={4}
      className="border rounded px-3 py-2 w-full"
    />
  )
);
Textarea.displayName = 'Textarea';

// ============================================================================
// Универсальный компонент FormField
// ============================================================================

interface FormFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  className?: string;
}

const FormField: React.FC<FormFieldProps> = ({ control, className }) => {
  const { value, errors, disabled, shouldShowError, componentProps } = useFormControl(control);

  const Component = control.component;

  return (
    <div className={className}>
      {componentProps.label && (
        <label className="block mb-1 text-sm font-medium">{componentProps.label}</label>
      )}

      <Component
        {...componentProps}
        value={value ?? ''}
        onChange={(e: unknown) => {
          const newValue = (e as { target?: { value?: unknown } })?.target?.value ?? e;
          control.setValue(newValue);
        }}
        onBlur={() => control.markAsTouched()}
        disabled={disabled}
      />

      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block">{errors[0]?.message}</span>
      )}
    </div>
  );
};

// ============================================================================
// Шаг 2: Интерфейс формы
// ============================================================================

type ContactFormType = {
  name: string;
  email: string;
  message: string;
};

// ============================================================================
// Шаг 3: Описание формы (структура + валидация)
// ============================================================================

const createContactForm = () =>
  createForm<ContactFormType>({
    form: {
      name: { value: '', component: Input, componentProps: { label: 'Имя' } },
      email: { value: '', component: Input, componentProps: { label: 'Email' } },
      message: { value: '', component: Textarea, componentProps: { label: 'Сообщение' } },
    },
    validation: (path) => {
      required(path.name);
      minLength(path.name, 2);
      required(path.email);
      email(path.email);
      required(path.message);
      minLength(path.message, 10);
    },
  });

// ============================================================================
// Шаг 4: Компонент формы
// ============================================================================

function ContactForm() {
  const form = useMemo(() => createContactForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      console.log('Отправка:', form.value.value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <FormField control={form.name} />
      <FormField control={form.email} />
      <FormField control={form.message} />

      <button
        type="submit"
        disabled={form.invalid.value}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Отправить
      </button>
    </form>
  );
}

// ============================================================================
// Страница Playground
// ============================================================================

export default function Playground() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Playground</h1>
      <ContactForm />
    </div>
  );
}

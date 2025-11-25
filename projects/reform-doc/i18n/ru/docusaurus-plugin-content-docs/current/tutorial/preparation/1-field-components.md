---
sidebar_position: 2
---

# Компоненты полей

Создание базовых компонентов для полей формы.

## Обзор

ReFormer использует ваши собственные компоненты для отображения полей формы. Это даёт вам полный контроль над стилями и поведением. В этом разделе мы создадим базовые компоненты для формы заявки на кредит.

## Требования к компонентам

Чтобы компонент работал с `FormField`, он должен принимать эти пропсы:

| Пропс | Тип | Описание |
|-------|-----|----------|
| `value` | `T` | Текущее значение поля |
| `onChange` | `(value: T) => void` | Обработчик изменения значения |
| `onBlur` | `() => void` | Обработчик потери фокуса (запускает валидацию) |
| `disabled` | `boolean` | Заблокировано ли поле |

Дополнительные пропсы, такие как `placeholder`, `label`, `options`, передаются через `componentProps`.

## Компонент Input

Текстовый ввод, который обрабатывает как текст, так и числа:

```tsx title="src/components/ui/Input.tsx"
import * as React from 'react';

export interface InputProps {
  value?: string | number | null;
  onChange?: (value: string | number | null) => void;
  onBlur?: () => void;
  type?: 'text' | 'email' | 'number' | 'tel' | 'url' | 'password';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, onBlur, type = 'text', placeholder, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;

      if (type === 'number') {
        // Конвертируем в число или null для пустого значения
        onChange?.(newValue === '' ? null : Number(newValue));
      } else {
        onChange?.(newValue || null);
      }
    };

    // Конвертируем значение в строку для отображения
    const displayValue = value ?? '';

    return (
      <input
        ref={ref}
        type={type}
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    );
  }
);

Input.displayName = 'Input';
```

### Использование в схеме формы

```tsx
import { Input } from './components/ui/Input';

const form = createForm<{ email: string }>({
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'Введите email'
    }
  }
});
```

## Компонент Select

Выпадающий список с опциями:

```tsx title="src/components/ui/Select.tsx"
import * as React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ value, onChange, onBlur, options = [], placeholder, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value;
      onChange?.(newValue || null);
    };

    return (
      <select
        ref={ref}
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        className={className}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';
```

### Использование в схеме формы

```tsx
import { Select } from './components/ui/Select';

const form = createForm<{ loanType: string }>({
  loanType: {
    value: '',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский кредит' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' }
      ]
    }
  }
});
```

## Компонент Checkbox

Чекбокс для булевых значений:

```tsx title="src/components/ui/Checkbox.tsx"
import * as React from 'react';

export interface CheckboxProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ value, onChange, onBlur, label, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.checked);
    };

    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          checked={value || false}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          className={className}
        />
        {label && <label>{label}</label>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
```

### Использование в схеме формы

```tsx
import { Checkbox } from './components/ui/Checkbox';

const form = createForm<{ agreeToTerms: boolean }>({
  agreeToTerms: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Я согласен с условиями'
    }
  }
});
```

## Компонент Textarea

Многострочный текстовый ввод:

```tsx title="src/components/ui/Textarea.tsx"
import * as React from 'react';

export interface TextareaProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ value, onChange, onBlur, placeholder, disabled, rows = 3, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event.target.value || null);
    };

    return (
      <textarea
        ref={ref}
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
```

## Компонент RadioGroup

Группа радиокнопок:

```tsx title="src/components/ui/RadioGroup.tsx"
import * as React from 'react';

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: RadioOption[];
  disabled?: boolean;
  className?: string;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onChange, onBlur, options, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.value);
    };

    return (
      <div ref={ref} className={className}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={handleChange}
              onBlur={onBlur}
              disabled={disabled}
            />
            <label>{option.label}</label>
          </div>
        ))}
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';
```

### Использование в схеме формы

```tsx
import { RadioGroup } from './components/ui/RadioGroup';

const form = createForm<{ gender: string }>({
  gender: {
    value: '',
    component: RadioGroup,
    componentProps: {
      label: 'Пол',
      options: [
        { value: 'male', label: 'Мужской' },
        { value: 'female', label: 'Женский' }
      ]
    }
  }
});
```

## Ключевые паттерны

### 1. Контролируемые компоненты

Все компоненты должны быть контролируемыми — они получают `value` и вызывают `onChange` для его обновления. Никогда не храните локальное состояние для значения поля.

### 2. Обработка null

Пустые значения должны быть представлены как `null`, а не как пустые строки. Это помогает при валидации и обработке данных:

```tsx
// Правильно
onChange?.(newValue || null);

// Избегайте
onChange?.(newValue);
```

### 3. Forward Refs

Используйте `React.forwardRef`, чтобы родительские компоненты могли получить доступ к DOM-элементу:

```tsx
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...} />;
});
```

### 4. Display Name

Устанавливайте `displayName` для удобства отладки:

```tsx
Input.displayName = 'Input';
```

## Использование UI-библиотек

Вы можете использовать существующие UI-библиотеки, такие как Radix UI, shadcn/ui или Material UI. Просто убедитесь, что ваши компоненты-обёртки следуют описанному выше интерфейсу.

Пример с Radix UI Select:

```tsx
import * as SelectPrimitive from '@radix-ui/react-select';

export const Select = ({ value, onChange, onBlur, options, ...props }) => {
  return (
    <SelectPrimitive.Root
      value={value || ''}
      onValueChange={onChange}
      onOpenChange={(open) => !open && onBlur?.()}
    >
      {/* ... реализация Radix UI */}
    </SelectPrimitive.Root>
  );
};
```

## Следующий шаг

Теперь, когда у вас есть компоненты полей и `FormField`, вы готовы определить схему формы для заявки на кредит.

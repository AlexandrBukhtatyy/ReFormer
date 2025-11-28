---
sidebar_position: 2
---

# Компоненты полей

Создание базовых компонентов для полей формы.

## Обзор

Компоненты полей в ReFormer:

- Оборачивают нативные элементы или компоненты UI-библиотек
- Следуют стандартному интерфейсу (value, onChange, onBlur, disabled)
- Могут быть свободно стилизованы и настроены

Этот паттерн необходим для:

- Единообразного внешнего вида и поведения во всех формах
- Полного контроля над стилями и доступностью
- Лёгкой интеграции с любой UI-библиотекой

## Как работают компоненты полей

Паттерн компонента поля состоит из трёх частей:

1. **Интерфейс пропсов** — определяет обязательные пропсы: `value`, `onChange`, `onBlur`, `disabled`
2. **Компонент** — контролируемый компонент с обработкой null
3. **forwardRef + displayName** — для доступа к DOM и отладки

```tsx
import * as React from 'react';

// 1. Интерфейс пропсов
interface InputProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// 2. Компонент
const InputComponent = React.forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, onBlur, disabled, placeholder, className }, ref) => {
    return (
      <input
        ref={ref}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value || null)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    );
  }
);

// 3. displayName
InputComponent.displayName = 'Input';

export const Input = InputComponent;
```

### Справочник по пропсам

| Пропс | Тип | Описание |
|-------|-----|----------|
| `value` | `T` | Текущее значение поля |
| `onChange` | `(value: T) => void` | Обработчик изменения значения |
| `onBlur` | `() => void` | Обработчик потери фокуса (запускает валидацию) |
| `disabled` | `boolean` | Заблокировано ли поле |

Дополнительные пропсы, такие как `placeholder`, `label`, `options`, передаются через `componentProps` в схеме.

### Использование в схеме формы

Компонент поля подключается к форме через схему:

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

## Реализация компонентов

Все компоненты ниже используют нативные HTML-элементы для наглядности. Вы можете заменить их на компоненты из предпочитаемой UI-библиотеки.

### Input

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

### Textarea

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

### Select

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

### Checkbox

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

### RadioGroup

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

## Использование UI-библиотек

Вы можете использовать существующие UI-библиотеки, такие как Radix UI, shadcn/ui или Material UI. Просто убедитесь, что ваши компоненты-обёртки следуют описанному выше интерфейсу.

Пример адаптации Radix UI Select:

```tsx
import * as SelectPrimitive from '@radix-ui/react-select';

interface SelectProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, onBlur, options, placeholder, disabled }: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value || ''}
      onValueChange={(val) => onChange?.(val || null)}
      onOpenChange={(open) => !open && onBlur?.()}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger>
        <SelectPrimitive.Value placeholder={placeholder} />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
```

Проект reform-tutorial использует компоненты shadcn/ui, построенные на примитивах Radix UI.

## Лучшие практики

### 1. Контролируемые компоненты

Все компоненты должны быть контролируемыми — они получают `value` и вызывают `onChange` для его обновления. Никогда не храните локальное состояние для значения поля:

```tsx
// Правильно — контролируемый
const Input = ({ value, onChange }) => (
  <input value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />
);

// Неправильно — неконтролируемый с локальным состоянием
const Input = ({ defaultValue }) => {
  const [value, setValue] = useState(defaultValue);
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
};
```

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
  return <input ref={ref} {...props} />;
});
```

### 4. Display Name

Устанавливайте `displayName` для удобства отладки в React DevTools:

```tsx
Input.displayName = 'Input';
```

### 5. Доступность

Поддерживайте `aria-invalid` для состояний валидации:

```tsx
<input
  aria-invalid={hasError}
  className={cn(baseStyles, hasError && errorStyles)}
  {...props}
/>
```

## Следующий шаг

Теперь, когда у вас есть компоненты полей, давайте создадим компонент `FormField`, который связывает их с состоянием формы.

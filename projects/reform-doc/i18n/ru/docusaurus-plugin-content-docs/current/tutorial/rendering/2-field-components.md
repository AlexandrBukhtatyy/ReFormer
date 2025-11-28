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
import { Input } from './components/ui/input';

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

Все компоненты находятся в `reform-tutorial/src/components/ui/`.

### Input

Текстовый ввод с корректной обработкой текста и чисел:

```tsx title="reform-tutorial/src/components/ui/input.tsx"
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | number | null;
  onChange?: (value: string | number | null) => void;
  onBlur?: () => void;
  type?: 'text' | 'email' | 'number' | 'tel' | 'url' | 'password';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, value, onChange, onBlur, type = 'text', ...props }, ref) => {
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;

      if (type === 'number') {
        if (newValue === '') {
          onChange?.(null);
        } else {
          const numValue = Number(newValue);
          if (!isNaN(numValue)) {
            onChange?.(numValue);
          }
        }
      } else {
        onChange?.(newValue || null);
      }
    };

    const inputValue = React.useMemo(() => {
      if (value === null || value === undefined) return '';
      if (type === 'number' && typeof value === 'number') {
        if (isNaN(value)) return '';
        return value.toString();
      }
      return String(value);
    }, [value, type]);

    return (
      <input
        ref={ref}
        type={type}
        value={inputValue}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive',
          className
        )}
        onChange={handleInputChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
```

### InputPassword

Поле пароля с переключателем видимости:

```tsx title="reform-tutorial/src/components/ui/input-password.tsx"
import * as React from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputPasswordProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  showToggle?: boolean;
}

const InputPassword = React.forwardRef<HTMLInputElement, InputPasswordProps>(
  ({ className, value, onChange, onBlur, showToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.value || null);
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          value={value || ''}
          className={cn(
            'h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
            showToggle && 'pr-10',
            className
          )}
          onChange={handleInputChange}
          onBlur={onBlur}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        )}
      </div>
    );
  }
);

InputPassword.displayName = 'InputPassword';

export { InputPassword };
```

### InputMask

Поле ввода с маской:

```tsx title="reform-tutorial/src/components/ui/input-mask.tsx"
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputMaskProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  mask?: string; // например: '999-999-999 99'
}

const InputMask = React.forwardRef<HTMLInputElement, InputMaskProps>(
  ({ className, value, onChange, onBlur, mask, placeholder, ...props }, ref) => {
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.value || null);
    };

    return (
      <input
        ref={ref}
        type="text"
        value={value || ''}
        placeholder={placeholder || mask}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
          className
        )}
        onChange={handleInputChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

InputMask.displayName = 'InputMask';

export { InputMask };
```

### InputSearch

Поле поиска с автодополнением из ресурса:

```tsx title="reform-tutorial/src/components/ui/input-search.tsx"
import * as React from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceConfig, ResourceItem } from 'reformer';

export interface InputSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'resource'> {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  resource?: ResourceConfig<string>;
  debounce?: number;
}

const InputSearch = React.forwardRef<HTMLInputElement, InputSearchProps>(
  ({ className, value, onChange, onBlur, resource, debounce = 300, ...props }, ref) => {
    const [suggestions, setSuggestions] = React.useState<ResourceItem<string>[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [showSuggestions, setShowSuggestions] = React.useState(false);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onChange?.(newValue || null);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (resource && newValue.trim()) {
        timeoutRef.current = setTimeout(async () => {
          setLoading(true);
          try {
            const response = await resource.load({ search: newValue });
            setSuggestions(response.items);
            setShowSuggestions(true);
          } catch {
            setSuggestions([]);
          } finally {
            setLoading(false);
          }
        }, debounce);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const handleSuggestionClick = (suggestion: ResourceItem<string>) => {
      onChange?.(suggestion.label || '');
      setShowSuggestions(false);
    };

    return (
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
        <input
          ref={ref}
          type="text"
          value={value || ''}
          className={cn('pl-10 pr-10 h-9 w-full rounded-md border', className)}
          onChange={handleInputChange}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
            onBlur?.();
          }}
          {...props}
        />
        {value && !loading && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => onChange?.(null)}
          >
            <XIcon className="size-4" />
          </button>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-md max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id || index}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSuggestionClick(suggestion);
                }}
              >
                {suggestion.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

InputSearch.displayName = 'InputSearch';

export { InputSearch };
```

### InputFiles

Поле загрузки файлов с валидацией:

```tsx title="reform-tutorial/src/components/ui/input-files.tsx"
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputFilesProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  onChange?: (value: File | File[] | null) => void;
  onBlur?: () => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  uploader?: { upload: (file: File) => Promise<unknown> };
}

const InputFiles = React.forwardRef<HTMLInputElement, InputFilesProps>(
  ({ className, onChange, onBlur, multiple = false, accept, maxSize, uploader, ...props }, ref) => {
    const [error, setError] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      setError(null);

      if (!files || files.length === 0) {
        onChange?.(null);
        return;
      }

      const fileArray = Array.from(files);

      // Валидация размера файлов
      if (maxSize) {
        const oversizedFiles = fileArray.filter((file) => file.size > maxSize);
        if (oversizedFiles.length > 0) {
          setError(`Размер файла превышает ${(maxSize / (1024 * 1024)).toFixed(2)} МБ`);
          onChange?.(null);
          return;
        }
      }

      const result = multiple ? fileArray : fileArray[0];

      if (uploader) {
        setUploading(true);
        try {
          if (Array.isArray(result)) {
            await Promise.all(result.map((file) => uploader.upload(file)));
          } else {
            await uploader.upload(result);
          }
          onChange?.(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки');
          onChange?.(null);
        } finally {
          setUploading(false);
        }
      } else {
        onChange?.(result);
      }
    };

    return (
      <div className="space-y-2">
        <input
          ref={ref}
          type="file"
          multiple={multiple}
          accept={accept}
          disabled={uploading}
          className={cn('h-9 w-full rounded-md border px-3 py-1 text-sm', className)}
          onChange={handleFileChange}
          onBlur={onBlur}
          {...props}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {uploading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
      </div>
    );
  }
);

InputFiles.displayName = 'InputFiles';

export { InputFiles };
```

### Textarea

Многострочное поле ввода:

```tsx title="reform-tutorial/src/components/ui/textarea.tsx"
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  rows?: number;
  maxLength?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, onChange, onBlur, rows = 3, maxLength, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event.target.value || null);
    };

    return (
      <textarea
        ref={ref}
        value={value || ''}
        rows={rows}
        maxLength={maxLength}
        className={cn(
          'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-y',
          className
        )}
        onChange={handleChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
```

### Select

Выпадающий список с загрузкой данных из ресурса и возможностью очистки:

```tsx title="reform-tutorial/src/components/ui/select.tsx"
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceConfig } from 'reformer';

export interface SelectProps<T> {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  resource?: ResourceConfig<T>;
  options?: Array<{ value: string | number; label: string; group?: string }>;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps<unknown>>(
  ({ value, onChange, onBlur, resource, options: directOptions, placeholder, disabled, clearable = false }, ref) => {
    const [resourceOptions, setResourceOptions] = React.useState<Array<{ id: string | number; label: string; value: string }>>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
      if (resource) {
        setLoading(true);
        resource.load({})
          .then((response) => {
            setResourceOptions(response.items.map((item: any) => ({
              id: item.id,
              label: item.label,
              value: String(item.value),
            })));
          })
          .finally(() => setLoading(false));
      }
    }, [resource]);

    const options = directOptions
      ? directOptions.map((opt) => ({ id: opt.value, label: opt.label, value: String(opt.value) }))
      : resourceOptions;

    return (
      <div className="relative w-full">
        <SelectPrimitive.Root
          value={value || ''}
          onValueChange={(val) => onChange?.(val)}
          onOpenChange={(open) => !open && onBlur?.()}
          disabled={disabled || loading}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            className={cn(
              'h-9 w-full rounded-md border px-3 py-2 text-sm flex items-center justify-between',
              clearable && value && 'pr-8'
            )}
          >
            <SelectPrimitive.Value placeholder={loading ? 'Загрузка...' : placeholder} />
            <ChevronDownIcon className="size-4 opacity-50" />
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content className="z-50 min-w-[8rem] rounded-md border bg-white shadow-md">
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.id}
                    value={option.value}
                    className="flex items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm cursor-default hover:bg-accent"
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2">
                      <CheckIcon className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {clearable && value && !disabled && (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={(e) => { e.stopPropagation(); onChange?.(null); }}
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
```

### Checkbox

Чекбокс для булевых значений:

```tsx title="reform-tutorial/src/components/ui/checkbox.tsx"
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value?: boolean;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, value, onChange, onBlur, label, disabled, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.checked);
    };

    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          checked={value || false}
          disabled={disabled}
          className={cn(
            'h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          onChange={handleChange}
          onBlur={onBlur}
          {...props}
        />
        {label && <label className="text-sm font-medium">{label}</label>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
```

### RadioGroup

Группа радиокнопок:

```tsx title="reform-tutorial/src/components/ui/radio-group.tsx"
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: RadioOption[];
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onChange, onBlur, options, disabled, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.value);
    };

    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              className={cn(
                'h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-primary',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
              onChange={handleChange}
              onBlur={onBlur}
            />
            <label className="text-sm font-medium">{option.label}</label>
          </div>
        ))}
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup };
```

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

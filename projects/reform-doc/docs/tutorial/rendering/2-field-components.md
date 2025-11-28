---
sidebar_position: 2
---

# Field Components

Creating basic components for form fields.

## Overview

Field components in ReFormer:

- Wrap native elements or UI library components
- Follow a standard interface (value, onChange, onBlur, disabled)
- Can be styled and customized freely

This pattern is essential for:

- Consistent look and behavior across all forms
- Full control over styling and accessibility
- Easy integration with any UI library

## How Field Components Work

The field component pattern consists of three parts:

1. **Props interface** — defines required props: `value`, `onChange`, `onBlur`, `disabled`
2. **Component** — controlled component with null handling
3. **forwardRef + displayName** — for DOM access and debugging

```tsx
import * as React from 'react';

// 1. Props interface
interface InputProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// 2. Component
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

### Props Reference

| Prop | Type | Description |
|------|------|-------------|
| `value` | `T` | Current field value |
| `onChange` | `(value: T) => void` | Handler for value changes |
| `onBlur` | `() => void` | Handler for blur event (triggers validation) |
| `disabled` | `boolean` | Whether the field is disabled |

Additional props like `placeholder`, `label`, `options` are passed through `componentProps` in the schema.

### Usage in Form Schema

A field component is connected to the form through the schema:

```tsx
import { Input } from './components/ui/input';

const form = createForm<{ email: string }>({
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'Enter your email'
    }
  }
});
```

## Tutorial Implementations

All components are located in `reform-tutorial/src/components/ui/`.

### Input

A text input that handles text and number types with proper validation:

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

Password input with visibility toggle:

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
            aria-label={showPassword ? 'Hide password' : 'Show password'}
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

Input with mask placeholder:

```tsx title="reform-tutorial/src/components/ui/input-mask.tsx"
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputMaskProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  mask?: string; // e.g. '999-999-999 99'
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

Search input with autocomplete from resource:

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

File input with validation and upload support:

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

      // Validate file sizes
      if (maxSize) {
        const oversizedFiles = fileArray.filter((file) => file.size > maxSize);
        if (oversizedFiles.length > 0) {
          setError(`File size exceeds ${(maxSize / (1024 * 1024)).toFixed(2)} MB`);
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
          setError(err instanceof Error ? err.message : 'Upload failed');
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
        {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
      </div>
    );
  }
);

InputFiles.displayName = 'InputFiles';

export { InputFiles };
```

### Textarea

Multi-line text input:

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

Dropdown select with resource loading and clearable option:

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
            <SelectPrimitive.Value placeholder={loading ? 'Loading...' : placeholder} />
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

Checkbox for boolean values:

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

Group of radio buttons:

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

## Best Practices

### 1. Controlled Components

All components should be controlled — they receive `value` and call `onChange` to update it. Never store local state for the field value:

```tsx
// Good - controlled
const Input = ({ value, onChange }) => (
  <input value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />
);

// Bad - uncontrolled with local state
const Input = ({ defaultValue }) => {
  const [value, setValue] = useState(defaultValue);
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
};
```

### 2. Null Handling

Empty values should be represented as `null`, not empty strings. This helps with validation and data processing:

```tsx
// Good
onChange?.(newValue || null);

// Avoid
onChange?.(newValue);
```

### 3. Forward Refs

Use `React.forwardRef` to allow parent components to access the underlying DOM element:

```tsx
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});
```

### 4. Display Name

Set `displayName` for easier debugging in React DevTools:

```tsx
Input.displayName = 'Input';
```

### 5. Accessibility

Support `aria-invalid` for validation states:

```tsx
<input
  aria-invalid={hasError}
  className={cn(baseStyles, hasError && errorStyles)}
  {...props}
/>
```

## Next Step

Now that you have your field components, let's create the `FormField` component that connects them to the form state.

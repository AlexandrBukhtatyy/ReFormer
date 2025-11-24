---
sidebar_position: 3
sidebar_label: Custom Fields
---

# Custom Fields

Create reusable, type-safe custom field components for your forms.

## Basic Custom Field

Start with a simple reusable field component:

```tsx title="components/TextField.tsx"
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';

interface TextFieldProps {
  field: FieldNode<string>;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url';
}

export function TextField({
  field,
  label,
  placeholder,
  type = 'text'
}: TextFieldProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const showError = control.touched && control.invalid;

  return (
    <div className="text-field">
      <label className="text-field__label">{label}</label>
      <input
        type={type}
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
        placeholder={placeholder}
        className={`text-field__input ${showError ? 'text-field__input--error' : ''}`}
      />
      {showError && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
      {control.pending && (
        <span className="text-field__loader">Validating...</span>
      )}
    </div>
  );
}
```

## Generic Type-Safe Field Component

Create generic components that work with any value type:

```tsx title="components/FormField.tsx"
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';
import { ReactNode } from 'react';

interface FormFieldProps<T> {
  field: FieldNode<T>;
  label?: string;
  hint?: string;
  children: (control: ReturnType<typeof useFormControl<T>>) => ReactNode;
  showErrors?: boolean;
}

export function FormField<T>({
  field,
  label,
  hint,
  children,
  showErrors = true,
}: FormFieldProps<T>) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const hasError = control.touched && control.invalid;

  return (
    <div className="form-field">
      {label && (
        <label className="form-field__label">{label}</label>
      )}
      {hint && (
        <span className="form-field__hint">{hint}</span>
      )}
      <div className="form-field__control">
        {children(control)}
      </div>
      {showErrors && hasError && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
      {control.pending && (
        <span className="form-field__pending">Validating...</span>
      )}
    </div>
  );
}

// Usage
<FormField field={form.controls.age} label="Age">
  {(control) => (
    <input
      type="number"
      value={control.value}
      onChange={(e) => control.setValue(Number(e.target.value))}
      disabled={control.disabled}
    />
  )}
</FormField>
```

## Material-UI Integration

Integrate with Material-UI components:

```tsx title="components/MuiTextField.tsx"
import { TextField as MuiTextField } from '@mui/material';
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';

interface MuiTextFieldProps {
  field: FieldNode<string>;
  label: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}

export function TextField({
  field,
  label,
  multiline = false,
  rows,
  placeholder,
}: MuiTextFieldProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const errorMessage = control.touched && control.errors
    ? getFirstErrorMessage(control.errors)
    : undefined;

  return (
    <MuiTextField
      label={label}
      value={control.value ?? ''}
      onChange={(e) => control.setValue(e.target.value)}
      onBlur={() => control.markAsTouched()}
      disabled={control.disabled}
      error={control.touched && control.invalid}
      helperText={errorMessage}
      placeholder={placeholder}
      multiline={multiline}
      rows={rows}
      fullWidth
    />
  );
}

function getFirstErrorMessage(errors: Record<string, any>): string {
  const errorMessages: Record<string, (params: any) => string> = {
    required: () => 'This field is required',
    email: () => 'Invalid email address',
    minLength: (p) => `Minimum ${p.required} characters`,
    maxLength: (p) => `Maximum ${p.required} characters`,
  };

  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessages[key];
  return getMessage ? getMessage(params) : 'Invalid value';
}
```

### Material-UI Select

```tsx title="components/MuiSelect.tsx"
import { FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material';
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';

interface Option {
  value: string;
  label: string;
}

interface MuiSelectProps {
  field: FieldNode<string>;
  label: string;
  options: Option[];
}

export function MuiSelect({ field, label, options }: MuiSelectProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const errorMessage = control.touched && control.errors
    ? getFirstErrorMessage(control.errors)
    : undefined;

  return (
    <FormControl fullWidth error={control.touched && control.invalid}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
        label={label}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {errorMessage && <FormHelperText>{errorMessage}</FormHelperText>}
    </FormControl>
  );
}
```

## Chakra UI Integration

```tsx title="components/ChakraTextField.tsx"
import {
  FormControl,
  FormLabel,
  Input,
  FormErrorMessage,
  FormHelperText,
} from '@chakra-ui/react';
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';

interface ChakraTextFieldProps {
  field: FieldNode<string>;
  label: string;
  hint?: string;
  placeholder?: string;
}

export function ChakraTextField({
  field,
  label,
  hint,
  placeholder,
}: ChakraTextFieldProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const errorMessage = control.touched && control.errors
    ? getFirstErrorMessage(control.errors)
    : undefined;

  return (
    <FormControl isInvalid={control.touched && control.invalid}>
      <FormLabel>{label}</FormLabel>
      <Input
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
        placeholder={placeholder}
      />
      {hint && !errorMessage && <FormHelperText>{hint}</FormHelperText>}
      {errorMessage && <FormErrorMessage>{errorMessage}</FormErrorMessage>}
    </FormControl>
  );
}
```

## Date Picker Field

Using react-datepicker:

```tsx title="components/DatePickerField.tsx"
import DatePicker from 'react-datepicker';
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';
import 'react-datepicker/dist/react-datepicker.css';

interface DatePickerFieldProps {
  field: FieldNode<Date | null>;
  label: string;
  minDate?: Date;
  maxDate?: Date;
  dateFormat?: string;
}

export function DatePickerField({
  field,
  label,
  minDate,
  maxDate,
  dateFormat = 'yyyy-MM-dd',
}: DatePickerFieldProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const showError = control.touched && control.invalid;

  return (
    <div className="date-picker-field">
      <label className="date-picker-field__label">{label}</label>
      <DatePicker
        selected={control.value}
        onChange={(date) => control.setValue(date)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
        minDate={minDate}
        maxDate={maxDate}
        dateFormat={dateFormat}
        className={`date-picker-field__input ${showError ? 'error' : ''}`}
      />
      {showError && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
    </div>
  );
}
```

## File Upload Field

File upload with preview:

```tsx title="components/FileUploadField.tsx"
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';
import { useState } from 'react';

interface FileUploadFieldProps {
  field: FieldNode<File | null>;
  label: string;
  accept?: string;
  maxSizeMB?: number;
}

export function FileUploadField({
  field,
  label,
  accept = 'image/*',
  maxSizeMB = 5,
}: FileUploadFieldProps) {
  const control = useFormControl(field);
  const [preview, setPreview] = useState<string | null>(null);

  if (!control.visible) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    if (file) {
      // Check file size
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > maxSizeMB) {
        alert(`File size must be less than ${maxSizeMB}MB`);
        return;
      }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    } else {
      setPreview(null);
    }

    control.setValue(file);
  };

  const handleRemove = () => {
    control.setValue(null);
    setPreview(null);
  };

  const showError = control.touched && control.invalid;

  return (
    <div className="file-upload-field">
      <label className="file-upload-field__label">{label}</label>

      {!control.value && (
        <div className="file-upload-field__input-wrapper">
          <input
            type="file"
            onChange={handleFileChange}
            onBlur={() => control.markAsTouched()}
            disabled={control.disabled}
            accept={accept}
            className="file-upload-field__input"
          />
        </div>
      )}

      {control.value && (
        <div className="file-upload-field__preview">
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="file-upload-field__preview-image"
            />
          )}
          <div className="file-upload-field__file-info">
            <span className="file-upload-field__file-name">
              {control.value.name}
            </span>
            <span className="file-upload-field__file-size">
              {(control.value.size / 1024).toFixed(2)} KB
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={control.disabled}
            className="file-upload-field__remove-btn"
          >
            Remove
          </button>
        </div>
      )}

      {showError && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
    </div>
  );
}
```

## Auto-Complete Field

Auto-complete with API search:

```tsx title="components/AutoCompleteField.tsx"
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';
import { useState, useEffect, useRef } from 'react';

interface Option {
  value: string;
  label: string;
}

interface AutoCompleteFieldProps {
  field: FieldNode<string>;
  label: string;
  fetchOptions: (query: string) => Promise<Option[]>;
  minChars?: number;
  debounceMs?: number;
}

export function AutoCompleteField({
  field,
  label,
  fetchOptions,
  minChars = 2,
  debounceMs = 300,
}: AutoCompleteFieldProps) {
  const control = useFormControl(field);
  const [options, setOptions] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  if (!control.visible) return null;

  useEffect(() => {
    const query = control.value;

    if (!query || query.length < minChars) {
      setOptions([]);
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce API call
    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetchOptions(query);
        setOptions(results);
        setIsOpen(true);
      } catch (error) {
        console.error('Failed to fetch options:', error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [control.value, fetchOptions, minChars, debounceMs]);

  const handleSelect = (option: Option) => {
    control.setValue(option.value);
    setIsOpen(false);
  };

  const showError = control.touched && control.invalid;

  return (
    <div className="autocomplete-field">
      <label className="autocomplete-field__label">{label}</label>
      <div className="autocomplete-field__wrapper">
        <input
          type="text"
          value={control.value ?? ''}
          onChange={(e) => control.setValue(e.target.value)}
          onBlur={() => {
            control.markAsTouched();
            // Delay closing to allow click on option
            setTimeout(() => setIsOpen(false), 200);
          }}
          onFocus={() => {
            if (options.length > 0) setIsOpen(true);
          }}
          disabled={control.disabled}
          className={`autocomplete-field__input ${showError ? 'error' : ''}`}
        />
        {isLoading && (
          <span className="autocomplete-field__loader">Loading...</span>
        )}
        {isOpen && options.length > 0 && (
          <ul className="autocomplete-field__options">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => handleSelect(option)}
                className="autocomplete-field__option"
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {showError && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
    </div>
  );
}

// Usage
<AutoCompleteField
  field={form.controls.city}
  label="City"
  fetchOptions={async (query) => {
    const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
    return response.json();
  }}
  minChars={3}
  debounceMs={500}
/>
```

## Rich Text Editor Field

Using react-quill:

```tsx title="components/RichTextEditorField.tsx"
import ReactQuill from 'react-quill';
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorFieldProps {
  field: FieldNode<string>;
  label: string;
  placeholder?: string;
}

export function RichTextEditorField({
  field,
  label,
  placeholder,
}: RichTextEditorFieldProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  const showError = control.touched && control.invalid;

  return (
    <div className="rich-text-field">
      <label className="rich-text-field__label">{label}</label>
      <ReactQuill
        value={control.value ?? ''}
        onChange={(value) => control.setValue(value)}
        onBlur={() => control.markAsTouched()}
        readOnly={control.disabled}
        placeholder={placeholder}
        modules={modules}
        theme="snow"
        className={showError ? 'error' : ''}
      />
      {showError && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
    </div>
  );
}
```

## Composite Fields

Phone number with country code:

```tsx title="components/PhoneField.tsx"
import { GroupNode } from 'reformer';
import { useFormControl } from 'reformer';

interface PhoneValue {
  countryCode: string;
  number: string;
}

interface PhoneFieldProps {
  field: GroupNode<PhoneValue>;
  label: string;
}

const countryCodes = [
  { code: '+1', label: 'US/Canada' },
  { code: '+44', label: 'UK' },
  { code: '+7', label: 'Russia' },
  { code: '+49', label: 'Germany' },
  // ... more countries
];

export function PhoneField({ field, label }: PhoneFieldProps) {
  const countryCode = useFormControl(field.controls.countryCode);
  const number = useFormControl(field.controls.number);

  if (!field.visible.value) return null;

  const showError = field.touched.value && field.invalid.value;

  return (
    <div className="phone-field">
      <label className="phone-field__label">{label}</label>
      <div className="phone-field__inputs">
        <select
          value={countryCode.value}
          onChange={(e) => countryCode.setValue(e.target.value)}
          disabled={countryCode.disabled}
          className="phone-field__country-code"
        >
          {countryCodes.map((country) => (
            <option key={country.code} value={country.code}>
              {country.code} {country.label}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={number.value}
          onChange={(e) => number.setValue(e.target.value)}
          onBlur={() => field.markAsTouched()}
          disabled={number.disabled}
          placeholder="1234567890"
          className="phone-field__number"
        />
      </div>
      {showError && field.errors.value && (
        <ErrorMessage errors={field.errors.value} />
      )}
    </div>
  );
}

// Form definition
const form = new GroupNode({
  form: {
    phone: {
      countryCode: { value: '+1' },
      number: { value: '' },
    },
  },
  validation: (path) => {
    required(path.phone.number);
    pattern(path.phone.number, /^\d{10}$/, 'Must be 10 digits');
  },
});

// Usage
<PhoneField field={form.controls.phone} label="Phone Number" />
```

## Error Message Component

Reusable error message handler:

```tsx title="components/ErrorMessage.tsx"
interface ErrorMessageProps {
  errors: Record<string, any>;
}

const errorMessages: Record<string, (params: any) => string> = {
  required: () => 'This field is required',
  email: () => 'Invalid email address',
  minLength: (p) => `Minimum ${p.required} characters required`,
  maxLength: (p) => `Maximum ${p.required} characters allowed`,
  min: (p) => `Minimum value is ${p.min}`,
  max: (p) => `Maximum value is ${p.max}`,
  pattern: (p) => p.message || 'Invalid format',

  // Custom error messages
  passwordTooWeak: () => 'Password is too weak',
  usernameTaken: () => 'This username is already taken',
  passwordMismatch: () => 'Passwords do not match',
  invalidPhone: () => 'Invalid phone number',
  fileTooLarge: (p) => `File size must be less than ${p.maxSize}MB`,
  invalidFileType: (p) => `Allowed types: ${p.allowed.join(', ')}`,
};

export function ErrorMessage({ errors }: ErrorMessageProps) {
  if (!errors || Object.keys(errors).length === 0) return null;

  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessages[key];
  const message = getMessage ? getMessage(params) : 'Invalid value';

  return <span className="error-message">{message}</span>;
}
```

## Best Practices

### 1. Always Handle Visibility

```tsx
// ✅ Good - checks visibility
export function TextField({ field, label }: Props) {
  const control = useFormControl(field);
  if (!control.visible) return null;
  // ...
}

// ❌ Bad - ignores visibility
export function TextField({ field, label }: Props) {
  const control = useFormControl(field);
  // Renders even when field.visible is false
}
```

### 2. Handle Null/Undefined Values

```tsx
// ✅ Good - handles null
<input
  value={control.value ?? ''}
  onChange={(e) => control.setValue(e.target.value)}
/>

// ❌ Bad - can crash with null
<input
  value={control.value}
  onChange={(e) => control.setValue(e.target.value)}
/>
```

### 3. Mark as Touched on Blur

```tsx
// ✅ Good - marks touched on blur
<input
  value={control.value}
  onChange={(e) => control.setValue(e.target.value)}
  onBlur={() => control.markAsTouched()}
/>

// ❌ Bad - errors never show
<input
  value={control.value}
  onChange={(e) => control.setValue(e.target.value)}
/>
```

### 4. Show Errors Only When Touched

```tsx
// ✅ Good - shows error when touched
const showError = control.touched && control.invalid;

// ❌ Bad - shows error immediately
const showError = control.invalid;
```

### 5. Use TypeScript Generics

```tsx
// ✅ Good - type-safe
interface FormFieldProps<T> {
  field: FieldNode<T>;
  children: (control: ReturnType<typeof useFormControl<T>>) => ReactNode;
}

export function FormField<T>({ field, children }: FormFieldProps<T>) {
  const control = useFormControl(field);
  return <>{children(control)}</>;
}

// ❌ Bad - loses type safety
interface FormFieldProps {
  field: FieldNode<any>;
  children: (control: any) => ReactNode;
}
```

## Next Steps

- [Hooks](/docs/react/hooks) — React integration hooks
- [Components](/docs/react/components) — Basic form components
- [Custom Behaviors](/docs/behaviors/custom) — Add reactive logic to custom fields
- [Custom Validators](/docs/validation/custom) — Validate custom field types

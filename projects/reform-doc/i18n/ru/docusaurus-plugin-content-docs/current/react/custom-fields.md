---
sidebar_position: 3
sidebar_label: Кастомные Поля
---

# Кастомные Поля

Создавайте переиспользуемые, типобезопасные кастомные компоненты полей для ваших форм.

## Базовое Кастомное Поле

Начните с простого переиспользуемого компонента поля:

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
        <span className="text-field__loader">Проверка...</span>
      )}
    </div>
  );
}
```

## Универсальный Типобезопасный Компонент Поля

Создавайте универсальные компоненты, работающие с любым типом значения:

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
        <span className="form-field__pending">Проверка...</span>
      )}
    </div>
  );
}

// Использование
<FormField field={form.controls.age} label="Возраст">
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

## Интеграция с Material-UI

Интегрируйте с компонентами Material-UI:

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
    required: () => 'Это поле обязательно',
    email: () => 'Неверный адрес электронной почты',
    minLength: (p) => `Минимум ${p.required} символов`,
    maxLength: (p) => `Максимум ${p.required} символов`,
  };

  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessages[key];
  return getMessage ? getMessage(params) : 'Неверное значение';
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

## Интеграция с Chakra UI

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

## Поле Выбора Даты

Используя react-datepicker:

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

## Поле Загрузки Файлов

Загрузка файла с предпросмотром:

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
      // Проверка размера файла
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > maxSizeMB) {
        alert(`Размер файла должен быть меньше ${maxSizeMB}МБ`);
        return;
      }

      // Создание предпросмотра для изображений
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
              alt="Предпросмотр"
              className="file-upload-field__preview-image"
            />
          )}
          <div className="file-upload-field__file-info">
            <span className="file-upload-field__file-name">
              {control.value.name}
            </span>
            <span className="file-upload-field__file-size">
              {(control.value.size / 1024).toFixed(2)} КБ
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={control.disabled}
            className="file-upload-field__remove-btn"
          >
            Удалить
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

## Поле Автодополнения

Автодополнение с поиском через API:

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

    // Очистка предыдущего таймаута
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Отложенный вызов API
    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetchOptions(query);
        setOptions(results);
        setIsOpen(true);
      } catch (error) {
        console.error('Ошибка загрузки опций:', error);
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
            // Задержка закрытия для возможности клика по опции
            setTimeout(() => setIsOpen(false), 200);
          }}
          onFocus={() => {
            if (options.length > 0) setIsOpen(true);
          }}
          disabled={control.disabled}
          className={`autocomplete-field__input ${showError ? 'error' : ''}`}
        />
        {isLoading && (
          <span className="autocomplete-field__loader">Загрузка...</span>
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

// Использование
<AutoCompleteField
  field={form.controls.city}
  label="Город"
  fetchOptions={async (query) => {
    const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
    return response.json();
  }}
  minChars={3}
  debounceMs={500}
/>
```

## Поле Текстового Редактора

Используя react-quill:

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

## Составные Поля

Номер телефона с кодом страны:

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
  { code: '+1', label: 'США/Канада' },
  { code: '+44', label: 'Великобритания' },
  { code: '+7', label: 'Россия' },
  { code: '+49', label: 'Германия' },
  // ... другие страны
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

// Определение формы
const form = new GroupNode({
  form: {
    phone: {
      countryCode: { value: '+7' },
      number: { value: '' },
    },
  },
  validation: (path) => {
    required(path.phone.number);
    pattern(path.phone.number, /^\d{10}$/, 'Должно быть 10 цифр');
  },
});

// Использование
<PhoneField field={form.controls.phone} label="Номер телефона" />
```

## Компонент Сообщения об Ошибке

Переиспользуемый обработчик сообщений об ошибках:

```tsx title="components/ErrorMessage.tsx"
interface ErrorMessageProps {
  errors: Record<string, any>;
}

const errorMessages: Record<string, (params: any) => string> = {
  required: () => 'Это поле обязательно',
  email: () => 'Неверный адрес электронной почты',
  minLength: (p) => `Требуется минимум ${p.required} символов`,
  maxLength: (p) => `Разрешено максимум ${p.required} символов`,
  min: (p) => `Минимальное значение: ${p.min}`,
  max: (p) => `Максимальное значение: ${p.max}`,
  pattern: (p) => p.message || 'Неверный формат',

  // Кастомные сообщения об ошибках
  passwordTooWeak: () => 'Пароль слишком слабый',
  usernameTaken: () => 'Это имя пользователя уже занято',
  passwordMismatch: () => 'Пароли не совпадают',
  invalidPhone: () => 'Неверный номер телефона',
  fileTooLarge: (p) => `Размер файла должен быть меньше ${p.maxSize}МБ`,
  invalidFileType: (p) => `Разрешенные типы: ${p.allowed.join(', ')}`,
};

export function ErrorMessage({ errors }: ErrorMessageProps) {
  if (!errors || Object.keys(errors).length === 0) return null;

  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessages[key];
  const message = getMessage ? getMessage(params) : 'Неверное значение';

  return <span className="error-message">{message}</span>;
}
```

## Лучшие Практики

### 1. Всегда Обрабатывайте Видимость

```tsx
// ✅ Хорошо - проверяет видимость
export function TextField({ field, label }: Props) {
  const control = useFormControl(field);
  if (!control.visible) return null;
  // ...
}

// ❌ Плохо - игнорирует видимость
export function TextField({ field, label }: Props) {
  const control = useFormControl(field);
  // Рендерится даже когда field.visible равен false
}
```

### 2. Обрабатывайте Null/Undefined Значения

```tsx
// ✅ Хорошо - обрабатывает null
<input
  value={control.value ?? ''}
  onChange={(e) => control.setValue(e.target.value)}
/>

// ❌ Плохо - может упасть с null
<input
  value={control.value}
  onChange={(e) => control.setValue(e.target.value)}
/>
```

### 3. Отмечайте как Touched при Blur

```tsx
// ✅ Хорошо - отмечает touched при blur
<input
  value={control.value}
  onChange={(e) => control.setValue(e.target.value)}
  onBlur={() => control.markAsTouched()}
/>

// ❌ Плохо - ошибки никогда не покажутся
<input
  value={control.value}
  onChange={(e) => control.setValue(e.target.value)}
/>
```

### 4. Показывайте Ошибки Только После Взаимодействия

```tsx
// ✅ Хорошо - показывает ошибку после взаимодействия
const showError = control.touched && control.invalid;

// ❌ Плохо - показывает ошибку сразу
const showError = control.invalid;
```

### 5. Используйте TypeScript Generics

```tsx
// ✅ Хорошо - типобезопасно
interface FormFieldProps<T> {
  field: FieldNode<T>;
  children: (control: ReturnType<typeof useFormControl<T>>) => ReactNode;
}

export function FormField<T>({ field, children }: FormFieldProps<T>) {
  const control = useFormControl(field);
  return <>{children(control)}</>;
}

// ❌ Плохо - теряет типобезопасность
interface FormFieldProps {
  field: FieldNode<any>;
  children: (control: any) => ReactNode;
}
```

## Следующие Шаги

- [Хуки](/docs/react/hooks) — Хуки интеграции с React
- [Компоненты](/docs/react/components) — Базовые компоненты форм
- [Кастомные Поведения](/docs/behaviors/custom) — Добавление реактивной логики к кастомным полям
- [Кастомные Валидаторы](/docs/validation/custom) — Валидация кастомных типов полей

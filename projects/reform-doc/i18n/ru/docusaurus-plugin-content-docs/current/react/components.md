---
sidebar_position: 2
---

# React компоненты

Примеры компонентов для распространённых паттернов форм.

## Text Input

```tsx
import { FieldNode } from 'reformer';
import { useFormControl } from 'reformer';

interface InputProps {
  field: FieldNode<string>;
  label: string;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
}

export function Input({ field, label, type = 'text', placeholder }: InputProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  const showError = control.touched && control.invalid;

  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        value={control.value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
        placeholder={placeholder}
        className={showError ? 'input-error' : ''}
      />
      {showError && <ErrorMessage errors={control.errors} />}
    </div>
  );
}
```

## Select

```tsx
interface SelectProps {
  field: FieldNode<string>;
  label: string;
  options: { value: string; label: string }[];
}

export function Select({ field, label, options }: SelectProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  return (
    <div className="form-group">
      <label>{label}</label>
      <select
        value={control.value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
      >
        <option value="">Выберите...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

## Checkbox

```tsx
interface CheckboxProps {
  field: FieldNode<boolean>;
  label: string;
}

export function Checkbox({ field, label }: CheckboxProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  return (
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={control.value}
        onChange={(e) => control.setValue(e.target.checked)}
        disabled={control.disabled}
      />
      <span>{label}</span>
    </label>
  );
}
```

## Radio Group

```tsx
interface RadioGroupProps {
  field: FieldNode<string>;
  label: string;
  options: { value: string; label: string }[];
}

export function RadioGroup({ field, label, options }: RadioGroupProps) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  return (
    <fieldset>
      <legend>{label}</legend>
      {options.map((opt) => (
        <label key={opt.value} className="radio-label">
          <input
            type="radio"
            name={field.id}
            value={opt.value}
            checked={control.value === opt.value}
            onChange={() => control.setValue(opt.value)}
            disabled={control.disabled}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
```

## Error Message

```tsx
interface ErrorMessageProps {
  errors: Record<string, any> | null;
}

const errorMessages: Record<string, (params: any) => string> = {
  required: () => 'Это поле обязательно',
  email: () => 'Некорректный email адрес',
  minLength: (p) => `Минимум ${p.required} символов`,
  maxLength: (p) => `Максимум ${p.required} символов`,
  min: (p) => `Минимальное значение ${p.min}`,
  max: (p) => `Максимальное значение ${p.max}`,
  pattern: () => 'Некорректный формат',
};

export function ErrorMessage({ errors }: ErrorMessageProps) {
  if (!errors) return null;

  const firstError = Object.entries(errors)[0];
  if (!firstError) return null;

  const [key, params] = firstError;
  const getMessage = errorMessages[key];
  const message = getMessage ? getMessage(params) : 'Некорректное значение';

  return <span className="error-text">{message}</span>;
}
```

## Form Array

```tsx
interface FormArrayProps<T> {
  array: ArrayNode<T>;
  renderItem: (item: any, index: number) => React.ReactNode;
  addLabel?: string;
  emptyValue: T;
}

export function FormArray<T>({
  array,
  renderItem,
  addLabel = 'Добавить',
  emptyValue,
}: FormArrayProps<T>) {
  const control = useFormControl(array);

  return (
    <div className="form-array">
      {control.controls.map((item, index) => (
        <div key={item.id} className="form-array-item">
          {renderItem(item, index)}
          <button
            type="button"
            onClick={() => array.removeAt(index)}
            className="remove-btn"
          >
            Удалить
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => array.push(emptyValue)}
        className="add-btn"
      >
        {addLabel}
      </button>
    </div>
  );
}
```

## Пример использования

```tsx
import { GroupNode, FieldNode, ArrayNode } from 'reformer';
import { required, email } from 'reformer/validators';

const form = new GroupNode({
  schema: {
    name: new FieldNode({ value: '' }),
    email: new FieldNode({ value: '' }),
    role: new FieldNode({ value: '' }),
    notifications: new FieldNode({ value: false }),
    phones: new ArrayNode({
      schema: () => new FieldNode({ value: '' }),
      value: [''],
    }),
  },
  validationSchema: (path, { validate }) => [
    validate(path.name, required()),
    validate(path.email, required(), email()),
  ],
});

function UserForm() {
  return (
    <form>
      <Input field={form.controls.name} label="Имя" />
      <Input field={form.controls.email} label="Email" type="email" />
      <Select
        field={form.controls.role}
        label="Роль"
        options={[
          { value: 'admin', label: 'Администратор' },
          { value: 'user', label: 'Пользователь' },
        ]}
      />
      <Checkbox
        field={form.controls.notifications}
        label="Получать уведомления"
      />
      <FormArray
        array={form.controls.phones}
        emptyValue=""
        addLabel="Добавить телефон"
        renderItem={(phone) => (
          <Input field={phone} label="Телефон" />
        )}
      />
    </form>
  );
}
```

## Следующие шаги

- [Примеры](https://stackblitz.com/github/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-examples) — интерактивный playground
- [API Reference](/docs/api) — полная документация API

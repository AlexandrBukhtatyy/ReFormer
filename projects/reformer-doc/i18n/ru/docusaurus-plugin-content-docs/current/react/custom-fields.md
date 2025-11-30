---
sidebar_position: 3
sidebar_label: Кастомные поля
---

# Кастомные поля

Базовое руководство по созданию кастомных компонентов полей форм с ReFormer.

## Базовое кастомное поле

Минимальный переиспользуемый компонент поля:

```tsx
import { FieldNode, useFormControl } from 'reformer';

interface TextFieldProps {
  field: FieldNode<string>;
  label: string;
  type?: 'text' | 'email' | 'password';
}

export function TextField({ field, label, type = 'text' }: TextFieldProps) {
  const { value, disabled, errors, shouldShowError, pending } = useFormControl(field);

  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => field.markAsTouched()}
        disabled={disabled}
      />
      {shouldShowError && errors.length > 0 && (
        <span className="error">{errors[0].message}</span>
      )}
      {pending && <span className="loading">Проверка...</span>}
    </div>
  );
}
```

## Ключевые принципы

### 1. Получайте состояние из useFormControl

```tsx
const { value, disabled, errors, shouldShowError, pending } = useFormControl(field);
```

| Свойство          | Описание                                    |
| ----------------- | ------------------------------------------- |
| `value`           | Текущее значение поля                       |
| `disabled`        | Поле отключено                              |
| `errors`          | Массив ошибок валидации                     |
| `shouldShowError` | Показывать ошибку (поле touched и invalid)  |
| `pending`         | Асинхронная валидация выполняется           |

### 2. Вызывайте методы на FieldNode

```tsx
// Обновить значение
field.setValue(newValue);

// Отметить как touched (вызывать на blur)
field.markAsTouched();
```

### 3. Обрабатывайте null значения

```tsx
// Всегда указывайте fallback для null/undefined
<input value={value ?? ''} />
```

### 4. Отмечайте как touched на blur

```tsx
<input
  onBlur={() => field.markAsTouched()}
/>
```

Это включает отображение ошибок после взаимодействия пользователя.

## Использование

```tsx
function MyForm() {
  const form = useMemo(() => createMyForm(), []);

  return (
    <form>
      <TextField field={form.controls.name} label="Имя" />
      <TextField field={form.controls.email} label="Email" type="email" />
    </form>
  );
}
```

## Следующие шаги

- [Хуки](/docs/react/hooks) — подробности useFormControl и useFormControlValue

---
sidebar_position: 1
sidebar_label: Хуки
---

# Хуки

ReFormer предоставляет React хуки для бесшовной интеграции с React 18+.

## useFormControl

Подписка на все изменения состояния поля. Компонент перерисовывается только когда данные контрола реально изменились.

```typescript
import { useFormControl } from 'reformer';

function TextField({ field }: { field: FieldNode<string> }) {
  const { value, disabled, errors, shouldShowError } = useFormControl(field);

  return (
    <div>
      <input
        value={value}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => field.markAsTouched()}
        disabled={disabled}
      />
      {shouldShowError && errors.length > 0 && (
        <span className="error">{errors[0].message}</span>
      )}
    </div>
  );
}
```

### Возвращаемое значение для FieldNode

| Свойство          | Тип                      | Описание                              |
| ----------------- | ------------------------ | ------------------------------------- |
| `value`           | `T`                      | Текущее значение                      |
| `valid`           | `boolean`                | Валидно                               |
| `invalid`         | `boolean`                | Есть ошибки                           |
| `errors`          | `ValidationError[]`      | Массив ошибок валидации               |
| `touched`         | `boolean`                | Пользователь взаимодействовал с полем |
| `disabled`        | `boolean`                | Отключено                             |
| `pending`         | `boolean`                | Асинхронная валидация выполняется     |
| `shouldShowError` | `boolean`                | Показывать ошибку (touched + invalid) |
| `componentProps`  | `Record<string, any>`    | Пользовательские пропсы для компонента |

### Возвращаемое значение для ArrayNode

| Свойство   | Тип                 | Описание                          |
| ---------- | ------------------- | --------------------------------- |
| `value`    | `T[]`               | Текущее значение массива          |
| `length`   | `number`            | Количество элементов в массиве    |
| `valid`    | `boolean`           | Валидно                           |
| `invalid`  | `boolean`           | Есть ошибки                       |
| `errors`   | `ValidationError[]` | Массив ошибок валидации           |
| `touched`  | `boolean`           | Пользователь взаимодействовал     |
| `dirty`    | `boolean`           | Значение изменено от начального   |
| `pending`  | `boolean`           | Асинхронная валидация выполняется |

### Пример: Полный компонент поля

```tsx
function FormField({ field, label }: { field: FieldNode<string>; label: string }) {
  const { value, disabled, errors, shouldShowError, pending } = useFormControl(field);

  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => field.markAsTouched()}
        disabled={disabled}
      />
      {shouldShowError && errors.length > 0 && (
        <span className="error-message">{errors[0].message}</span>
      )}
      {pending && <span className="loading">Проверка...</span>}
    </div>
  );
}
```

---

## useFormControlValue

Подписка только на значение поля, без отслеживания errors, valid, touched и т.д. Используйте когда нужно только значение для условного рендеринга — это обеспечивает лучшую производительность, избегая лишних перерисовок.

```typescript
import { useFormControlValue } from 'reformer';

function ConditionalField({
  showWhenField,
  field
}: {
  showWhenField: FieldNode<string>;
  field: FieldNode<string>;
}) {
  // Перерисовывается только при изменении showWhenField.value
  const showWhenValue = useFormControlValue(showWhenField);

  if (showWhenValue !== 'show') {
    return null;
  }

  return <TextField field={field} />;
}
```

### Возвращаемое значение

| Тип | Описание         |
| --- | ---------------- |
| `T` | Текущее значение |

### Когда использовать

Используйте `useFormControlValue` вместо `useFormControl` когда:

- Вам нужно только значение для условного рендеринга
- Вы хотите минимизировать перерисовки
- Вам не нужно состояние валидации или другие свойства

```tsx
// ❌ Неэффективно - перерисовывается при любом изменении состояния
function BadExample({ field }: { field: FieldNode<string> }) {
  const { value } = useFormControl(field);
  return <span>Выбрано: {value}</span>;
}

// ✅ Эффективно - перерисовывается только при изменении значения
function GoodExample({ field }: { field: FieldNode<string> }) {
  const value = useFormControlValue(field);
  return <span>Выбрано: {value}</span>;
}
```

---

## Примеры использования

### С GroupNode

Доступ к контролам из GroupNode:

```tsx
function UserForm() {
  const form = useMemo(() => createUserForm(), []);

  return (
    <form>
      <FormField field={form.controls.firstName} label="Имя" />
      <FormField field={form.controls.lastName} label="Фамилия" />
      <FormField field={form.controls.email} label="Email" />
    </form>
  );
}
```

### С ArrayNode

Рендеринг динамических массивов:

```tsx
function PhoneList({ array }: { array: ArrayNode<PhoneSchema> }) {
  const { length } = useFormControl(array);

  return (
    <div>
      {array.map((phone, index) => (
        <div key={phone.id}>
          <FormField field={phone.controls.type} label="Тип" />
          <FormField field={phone.controls.number} label="Номер" />
          <button onClick={() => array.removeAt(index)}>Удалить</button>
        </div>
      ))}
      {length === 0 && <span>Телефоны не добавлены</span>}
      <button onClick={() => array.push({ type: 'mobile', number: '' })}>
        Добавить телефон
      </button>
    </div>
  );
}
```

### Отправка формы

Обработка отправки формы:

```tsx
function ContactForm() {
  const form = useMemo(() => createContactForm(), []);
  const { invalid } = useFormControl(form.controls.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();

    if (form.valid) {
      console.log(form.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField field={form.controls.name} label="Имя" />
      <FormField field={form.controls.email} label="Email" />
      <button type="submit" disabled={invalid}>Отправить</button>
    </form>
  );
}
```

---

## Производительность

Оба хука используют `useSyncExternalStore` для оптимальной интеграции с React 18+:

```tsx
function Form() {
  // Этот компонент НЕ перерисовывается при изменении полей
  return (
    <form>
      <NameField />  {/* Перерисовывается только при изменении name */}
      <EmailField /> {/* Перерисовывается только при изменении email */}
    </form>
  );
}
```

## Следующие шаги

- [Кастомные поля](/docs/react/custom-fields) — Создание пользовательских компонентов форм
- [Примеры](https://stackblitz.com/~/github.com/AButsai/ReFormer/tree/main/projects/react-playground) — Интерактивный playground
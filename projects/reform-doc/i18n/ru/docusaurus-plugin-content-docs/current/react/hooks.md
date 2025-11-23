---
sidebar_position: 1
sidebar_label: Хуки
---

# Хуки

ReFormer предоставляет React hooks для бесшовной интеграции.

## useFormControl

Подписка на изменения состояния поля.

```typescript
import { useFormControl } from 'reformer';

function TextField({ field }: { field: FieldNode<string> }) {
  const control = useFormControl(field);

  return (
    <input
      value={control.value}
      onChange={(e) => control.setValue(e.target.value)}
      onBlur={() => control.markAsTouched()}
      disabled={control.disabled}
    />
  );
}
```

### Возвращаемый объект

`useFormControl` возвращает поле со всеми реактивными свойствами:

| Свойство      | Тип              | Описание                          |
| ------------- | ---------------- | --------------------------------- |
| `value`       | `T`              | Текущее значение                  |
| `setValue(v)` | `function`       | Обновить значение                 |
| `valid`       | `boolean`        | Валидно                           |
| `invalid`     | `boolean`        | Есть ошибки                       |
| `errors`      | `object \| null` | Объект ошибок                     |
| `touched`     | `boolean`        | Пользователь взаимодействовал     |
| `dirty`       | `boolean`        | Значение изменено                 |
| `disabled`    | `boolean`        | Отключено                         |
| `visible`     | `boolean`        | Видимо                            |
| `pending`     | `boolean`        | Асинхронная валидация выполняется |

### Пример: Полное поле

```tsx
function FormField({ field, label }: { field: FieldNode<string>; label: string }) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        value={control.value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
        className={control.invalid && control.touched ? 'error' : ''}
      />
      {control.touched && control.errors?.required && (
        <span className="error-message">Это поле обязательно</span>
      )}
      {control.touched && control.errors?.minLength && (
        <span className="error-message">Минимум {control.errors.minLength.required} символов</span>
      )}
      {control.pending && <span className="loading">Проверка...</span>}
    </div>
  );
}
```

## Использование с GroupNode

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

## Использование с ArrayNode

Рендеринг динамических массивов:

```tsx
function PhoneList({ array }: { array: ArrayNode<PhoneSchema> }) {
  const control = useFormControl(array);

  return (
    <div>
      {control.controls.map((phone, index) => (
        <div key={phone.id}>
          <FormField field={phone.controls.type} label="Тип" />
          <FormField field={phone.controls.number} label="Номер" />
          <button onClick={() => array.removeAt(index)}>Удалить</button>
        </div>
      ))}
      <button onClick={() => array.push({ type: 'mobile', number: '' })}>Добавить телефон</button>
    </div>
  );
}
```

## Отправка формы

Обработка отправки формы:

```tsx
function ContactForm() {
  const form = useMemo(() => createContactForm(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Показать все ошибки валидации
    form.markAllAsTouched();

    if (form.valid) {
      // Отправить данные
      console.log(form.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField field={form.controls.name} label="Имя" />
      <FormField field={form.controls.email} label="Email" />

      <button type="submit" disabled={form.invalid}>
        Отправить
      </button>
    </form>
  );
}
```

## Производительность

`useFormControl` перерисовывает компонент только при изменении подписанного поля:

```tsx
function Form() {
  // Этот компонент НЕ перерисовывается при изменении полей
  return (
    <form>
      <NameField /> {/* Перерисовывается только при изменении name */}
      <EmailField /> {/* Перерисовывается только при изменении email */}
    </form>
  );
}
```

## Следующие шаги

- [Компоненты](/docs/react/components) — переиспользуемые компоненты форм
- [Примеры](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-examples?file=projects/react-examples/src/App.tsx) — интерактивный playground

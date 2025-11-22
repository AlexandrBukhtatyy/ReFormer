---
sidebar_position: 2
---

# Быстрый старт

Создайте простую контактную форму за 5 минут.

## 1. Определите форму

```typescript title="src/forms/contact-form.ts"
import { GroupNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

export const createContactForm = () =>
  new GroupNode({
    form: {
      name: { value: '' },
      email: { value: '' },
      message: { value: '' },
    },
    validation: (path) => {
      required(path.name);
      minLength(path.name, 2);
      required(path.email);
      email(path.email);
      required(path.message);
      minLength(path.message, 10);
    },
  });

export type ContactForm = ReturnType<typeof createContactForm>;
```

## 2. Создайте React-компонент

```tsx title="src/components/ContactForm.tsx"
import { useFormControl } from 'reformer';
import { createContactForm, ContactForm } from '../forms/contact-form';

const form = createContactForm();

export function ContactForm() {
  const name = useFormControl(form.controls.name);
  const email = useFormControl(form.controls.email);
  const message = useFormControl(form.controls.message);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.valid) {
      console.log('Отправка:', form.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
          placeholder="Имя"
        />
        {name.touched && name.errors?.required && (
          <span>Имя обязательно</span>
        )}
      </div>

      <div>
        <input
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
          placeholder="Email"
        />
        {email.touched && email.errors?.email && (
          <span>Некорректный email</span>
        )}
      </div>

      <div>
        <textarea
          value={message.value}
          onChange={(e) => message.setValue(e.target.value)}
          placeholder="Сообщение"
        />
        {message.touched && message.errors?.minLength && (
          <span>Сообщение должно быть не менее 10 символов</span>
        )}
      </div>

      <button type="submit" disabled={!form.valid}>
        Отправить
      </button>
    </form>
  );
}
```

## 3. Использованные концепции

| Концепция | Описание |
|-----------|----------|
| `GroupNode` | Контейнер для полей формы |
| `form` | Схема формы, определяющая структуру полей |
| `validation` | Декларативные правила валидации |
| `useFormControl` | React-хук для привязки поля |
| `markAllAsTouched()` | Показать все ошибки валидации |

## Следующие шаги

- [Основные концепции](/docs/core-concepts/nodes) — узнайте больше о Nodes
- [Валидация](/docs/validation/overview) — все встроенные валидаторы
- [Behaviors](/docs/behaviors/overview) — вычисляемые поля и условная логика

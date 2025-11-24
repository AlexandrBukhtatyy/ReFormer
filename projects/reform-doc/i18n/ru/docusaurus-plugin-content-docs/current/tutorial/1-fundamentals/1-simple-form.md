---
sidebar_position: 1
---

# Простейшая форма

В этом уроке вы создадите свою первую форму с ReFormer. Мы построим простую форму регистрации с двумя полями: имя и email.

## Что вы узнаете

- Как создать структуру формы с помощью `GroupNode` и `FieldNode`
- Как получать доступ и изменять значения формы
- Как подключить форму к React-компонентам с помощью `useFormControl`

## Создание формы

Начнем с определения структуры формы. Используем `GroupNode` для создания контейнера полей:

```typescript title="src/components/RegistrationForm/form.ts"
import { GroupNode } from 'reformer';

// Определяем интерфейс данных формы
interface RegistrationFormData {
  name: string;
  email: string;
}

// Создаем структуру формы
export const registrationForm = new GroupNode<RegistrationFormData>({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
});
```

### Разбор кода

- **`GroupNode`** — контейнер, который содержит поля формы и управляет их состоянием
- **Конфигурация полей** — простые объекты с `{ value: ... }`, которые ReFormer автоматически преобразует в узлы полей
- **`form`** — определяет структуру данных вашей формы
- **Обобщенный тип** `<RegistrationFormData>` — обеспечивает типобезопасность всей формы

## Доступ к значениям формы

ReFormer предоставляет реактивный доступ к значениям формы через свойство `value`:

```typescript
// Получить значение всей формы
console.log(registrationForm.value);
// Вывод: { name: '', email: '' }

// Получить значение отдельного поля
console.log(registrationForm.controls.name.value);
// Вывод: ''

// Обновить значение поля
registrationForm.controls.name.setValue('Иван');

console.log(registrationForm.value);
// Вывод: { name: 'Иван', email: '' }
```

Свойство `value` — это **реактивный сигнал**, который автоматически обновляется при изменении любого поля.

## Интеграция с React

Теперь подключим форму к React-компоненту с помощью хука `useFormControl`:

```tsx title="src/components/RegistrationForm/index.tsx"
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
  // Подключаем поля к React
  const name = useFormControl(registrationForm.controls.name);
  const email = useFormControl(registrationForm.controls.email);

  return (
    <form>
      <div>
        <label htmlFor="name">Имя</label>
        <input
          id="name"
          type="text"
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
        />
      </div>

      <button type="submit">Зарегистрироваться</button>
    </form>
  );
}
```

### Как это работает

1. **`useFormControl(node)`** — подписывает компонент на изменения поля
2. При вызове `setValue()` состояние формы обновляется
3. React автоматически перерисовывает компонент с новыми значениями

## Попробуйте

Введите что-нибудь в поле имени. Значение обновится мгновенно и реактивно распространится по всей форме.

```typescript
// Значение формы всегда синхронизировано
console.log(registrationForm.value);
// Вывод: { name: 'Иван', email: '' }
```

## Ключевые концепции

- **`GroupNode`** — контейнер для полей формы
- **Конфигурация полей** — простые объекты `{ value: ... }`, которые становятся реактивными полями
- **`value`** — реактивное свойство, содержащее данные поля/формы
- **`setValue()`** — метод для обновления значения поля
- **`controls`** — типизированный доступ к дочерним полям
- **`useFormControl()`** — React-хук для привязки поля

## Что дальше?

В следующем уроке мы добавим **валидацию**, чтобы убедиться в корректности данных перед отправкой.

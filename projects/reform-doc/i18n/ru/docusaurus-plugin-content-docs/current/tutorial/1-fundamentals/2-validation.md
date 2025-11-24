---
sidebar_position: 2
---

# Валидация

В этом уроке вы узнаете, как валидировать данные формы, чтобы убедиться в корректности информации от пользователей.

## Что вы узнаете

- Как добавить правила валидации к полям
- Как использовать встроенные валидаторы
- Как отображать ошибки валидации
- Как проверять состояние валидности формы

## Добавление валидации

Давайте добавим валидацию к нашей форме регистрации. Сделаем оба поля обязательными и проверим формат email:

```typescript title="src/components/RegistrationForm/form.ts"
import { GroupNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

interface RegistrationFormData {
  name: string;
  email: string;
}

export const registrationForm = new GroupNode<RegistrationFormData>({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
  validation: (path) => {
    required(path.name);
    minLength(path.name, 2);

    required(path.email);
    email(path.email);
  },
});
```

### Понимание валидации

- **`validation`** — функция, определяющая правила валидации для формы
- **`path`** — предоставляет типизированный доступ к путям полей
- **Валидаторы** — функции вроде `required()`, `email()`, которые проверяют значения полей
- **Несколько валидаторов на поле** — можно применить несколько валидаторов к одному полю

## Встроенные валидаторы

ReFormer предоставляет стандартные валидаторы из коробки:

- **`required()`** — поле должно иметь значение
- **`email()`** — должен быть корректный email-адрес
- **`minLength(n)`** — минимальная длина
- **`maxLength(n)`** — максимальная длина
- **`pattern(regex)`** — должно соответствовать регулярному выражению
- **`min(n)`** / **`max(n)`** — валидация числового диапазона

## Отображение ошибок

Теперь обновим наш компонент, чтобы показывать ошибки валидации:

```tsx title="src/components/RegistrationForm/index.tsx"
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
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
          onBlur={() => name.markAsTouched()}
        />
        {name.touched && name.errors?.required && (
          <span className="error">Имя обязательно</span>
        )}
        {name.touched && name.errors?.minLength && (
          <span className="error">Имя должно быть не менее 2 символов</span>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
          onBlur={() => email.markAsTouched()}
        />
        {email.touched && email.errors?.required && (
          <span className="error">Email обязателен</span>
        )}
        {email.touched && email.errors?.email && (
          <span className="error">Некорректный формат email</span>
        )}
      </div>

      <button type="submit" disabled={!registrationForm.valid}>
        Зарегистрироваться
      </button>
    </form>
  );
}
```

### Ключевые свойства

- **`touched`** — указывает, взаимодействовал ли пользователь с полем
- **`errors`** — объект, содержащий ошибки валидации (или `null`, если валидно)
- **`valid`** — `true`, если поле/форма проходит всю валидацию
- **`markAsTouched()`** — помечает поле как тронутое пользователем

## Состояния валидации

Поля имеют несколько состояний, связанных с валидацией:

```typescript
const field = registrationForm.controls.name;

// Изначально
console.log(field.touched);  // false
console.log(field.valid);    // false
console.log(field.errors);   // { required: true }

// После взаимодействия пользователя
field.markAsTouched();
console.log(field.touched);  // true

// После ввода корректного значения
field.setValue('Иван');
console.log(field.valid);    // true
console.log(field.errors);   // null
```

## Валидация на уровне формы

Форма автоматически агрегирует валидацию всех полей:

```typescript
console.log(registrationForm.valid);
// false - форма невалидна, пока все поля не станут валидными

console.log(registrationForm.errors);
// { name: { required: true }, email: { required: true } }
```

## Валидация при изменении vs при потере фокуса

ReFormer валидирует **при каждом изменении** по умолчанию, но ошибки обычно показываются только после того, как поле `touched`:

- **Валидация запускается немедленно** — `valid` и `errors` всегда отражают текущее состояние
- **Показывайте ошибки условно** — используйте `touched`, чтобы не показывать ошибки слишком рано

```tsx
{/* Показываем ошибку только после взаимодействия пользователя с полем */}
{name.touched && name.errors?.required && (
  <span className="error">Имя обязательно</span>
)}
```

## Попробуйте

1. Оставьте поле имени пустым и кликните вне его → увидите ошибку обязательности
2. Введите "а" в поле имени → увидите ошибку minLength
3. Введите "abc" → ошибка исчезнет
4. Введите некорректный email вроде "test@" → увидите ошибку формата email
5. Обратите внимание, что кнопка отправки заблокирована, пока форма не станет валидной

## Ключевые концепции

- **`validation`** — функция, определяющая правила валидации
- **Валидаторы** — функции вроде `required(path)`, `email(path)`, `minLength(path, n)`
- **Встроенные валидаторы** — `required`, `email`, `minLength` и др.
- **`touched`** — отслеживает взаимодействие пользователя с полем
- **`errors`** — объект с ошибками валидации или `null`
- **`valid`** — булево значение, указывающее состояние валидации
- **`markAsTouched()`** — помечает поле как тронутое

## Что дальше?

В следующем уроке мы обработаем **отправку формы** и научимся валидировать всю форму перед отправкой данных.

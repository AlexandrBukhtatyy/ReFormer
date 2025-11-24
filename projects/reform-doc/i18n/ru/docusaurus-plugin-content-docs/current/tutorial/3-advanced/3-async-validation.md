---
sidebar_position: 3
---

# Асинхронная валидация

В этом уроке вы узнаете, как валидировать поля с помощью серверных данных, например, проверять доступность имени пользователя или валидировать email-адреса.

## Что вы узнаете

- Как создавать асинхронные валидаторы
- Как обрабатывать состояния загрузки во время валидации
- Как применять debouncing к асинхронной валидации
- Как отображать ошибки асинхронной валидации

## Зачем использовать асинхронную валидацию?

Некоторые валидации требуют связи с сервером:
- Проверить, занято ли имя пользователя
- Проверить существование email-адреса
- Валидировать промокод по базе данных
- Проверить, зарегистрирован ли номер телефона

## Создание асинхронного валидатора

Создадим форму регистрации, которая проверяет доступность имени пользователя:

```typescript title="src/components/RegistrationForm/form.ts"
import { GroupNode } from 'reformer';
import { required, minLength } from 'reformer/validators';

interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
}

// Функция асинхронного валидатора
async function checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
  const response = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
  return response.json();
}

// Создаем асинхронный валидатор
function usernameAvailable() {
  return async (value: string) => {
    if (!value) return null; // Пропустить если пусто (обрабатывается required)

    try {
      const result = await checkUsernameAvailability(value);
      return result.available ? null : { usernameTaken: true };
    } catch (error) {
      return { serverError: true };
    }
  };
}

export const registrationForm = new GroupNode<RegistrationFormData>({
  form: {
    username: { value: '' },
    email: { value: '' },
    password: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    required(path.username);
    minLength(path.username, 3);
    required(path.email);
    required(path.password);
    minLength(path.password, 8);

    // Асинхронная валидация
    validateAsync(path.username, usernameAvailable(), {
      debounce: 500, // Ждать 500мс после того как пользователь перестал печатать
    });
  },
});
```

### Понимание асинхронной валидации

- **`validateAsync(path, validator, options)`** — применяет асинхронную валидацию
- **`validator`** — асинхронная функция, возвращающая ошибки или null
- **`debounce`** — задержка в мс перед запуском валидации (избегает лишних API-вызовов)
- **Вернуть null** — валидация пройдена
- **Вернуть объект ошибок** — валидация не пройдена с ошибками

## Обработка состояния загрузки

Поля имеют свойство `validating` для индикации выполнения асинхронной валидации:

```typescript
const username = registrationForm.controls.username;

console.log(username.validating); // true - валидация в процессе
console.log(username.validating); // false - валидация завершена
```

## React-компонент

```tsx title="src/components/RegistrationForm/index.tsx"
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
  const username = useFormControl(registrationForm.controls.username);
  const email = useFormControl(registrationForm.controls.email);
  const password = useFormControl(registrationForm.controls.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    registrationForm.markAllAsTouched();

    // Ждем завершения асинхронной валидации
    await registrationForm.validateAsync();

    if (!registrationForm.valid) {
      return;
    }

    console.log('Данные регистрации:', registrationForm.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">Имя пользователя</label>
        <input
          id="username"
          value={username.value}
          onChange={(e) => username.setValue(e.target.value)}
          onBlur={() => username.markAsTouched()}
        />
        {username.validating && (
          <span className="info">Проверка доступности...</span>
        )}
        {username.touched && username.errors?.required && (
          <span className="error">Имя пользователя обязательно</span>
        )}
        {username.touched && username.errors?.minLength && (
          <span className="error">Имя должно быть не менее 3 символов</span>
        )}
        {username.touched && username.errors?.usernameTaken && (
          <span className="error">Имя пользователя уже занято</span>
        )}
        {username.touched && username.errors?.serverError && (
          <span className="error">Ошибка сервера, попробуйте снова</span>
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
      </div>

      <div>
        <label htmlFor="password">Пароль</label>
        <input
          id="password"
          type="password"
          value={password.value}
          onChange={(e) => password.setValue(e.target.value)}
          onBlur={() => password.markAsTouched()}
        />
        {password.touched && password.errors?.minLength && (
          <span className="error">Пароль должен быть не менее 8 символов</span>
        )}
      </div>

      <button type="submit" disabled={!registrationForm.valid || username.validating}>
        Зарегистрироваться
      </button>
    </form>
  );
}
```

### Ключевые моменты

- **`field.validating`** — true пока выполняется асинхронная валидация
- **`form.validateAsync()`** — вручную запустить асинхронную валидацию
- **Debouncing** — предотвращает спам API-запросов во время ввода
- **Блокировка отправки** — пока выполняется асинхронная валидация

## Множественные асинхронные валидаторы

Можно иметь несколько асинхронных валидаторов:

```typescript
validateAsync(path.email, emailExists(), { debounce: 500 }),
validateAsync(path.domain, domainAvailable(), { debounce: 1000 }),
```

## Процесс асинхронной валидации

1. **Пользователь печатает** → значение поля изменяется
2. **Таймер debounce запускается** → ожидание пока пользователь перестанет печатать
3. **Таймер истекает** → асинхронный валидатор запускается
4. **`validating = true`** → показать индикатор загрузки
5. **API-вызов завершается** → возвращается результат валидации
6. **`validating = false`** → показать ошибки или успех
7. **Валидность формы обновляется** → включить/выключить кнопку отправки

## Обработка ошибок

Всегда обрабатывайте ошибки в асинхронных валидаторах:

```typescript
async function myAsyncValidator() {
  return async (value: string) => {
    try {
      const result = await apiCall(value);
      return result.valid ? null : { customError: true };
    } catch (error) {
      console.error('Ошибка валидации:', error);
      return { serverError: true }; // Вернуть ошибку, не бросать
    }
  };
}
```

## Попробуйте

1. Введите имя пользователя → увидите сообщение "Проверка доступности..."
2. Печатайте медленно → валидация ждет, пока вы закончите
3. Попробуйте "admin" (если ваш API его распознает) → увидите ошибку "уже занято"
4. Кнопка отправки остается заблокированной во время валидации

## Ключевые концепции

- **`validateAsync(path, validator, options)`** — асинхронная валидация
- **`debounce`** — задержка перед запуском валидации
- **`field.validating`** — указывает на выполнение валидации
- **`form.validateAsync()`** — вручную запустить валидацию
- **Обработка ошибок** — всегда ловите и возвращайте ошибки
- **Индикаторы загрузки** — показывать во время валидации
- **Блокировка отправки** — предотвращать отправку во время валидации

## Что дальше?

Отлично! Вы освоили продвинутые возможности. В финальном разделе мы объединим все вместе в **Практическом примере** — полной форме заявки на кредит, демонстрирующей все изученные концепции.

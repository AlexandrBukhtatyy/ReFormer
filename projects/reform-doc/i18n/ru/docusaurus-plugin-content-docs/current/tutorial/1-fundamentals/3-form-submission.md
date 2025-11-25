---
sidebar_position: 3
---

# Отправка формы

В этом уроке вы узнаете, как обрабатывать отправку формы, валидировать всю форму и управлять процессом отправки.

## Что вы узнаете

- Как обрабатывать события отправки формы
- Как валидировать все поля перед отправкой
- Как управлять состояниями загрузки и ошибок
- Как сбросить форму после успешной отправки

## Базовая отправка формы

Давайте добавим отправку формы в нашу форму регистрации:

```tsx title="src/components/RegistrationForm/index.tsx"
import { useState } from 'react';
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const name = useFormControl(registrationForm.controls.name);
  const email = useFormControl(registrationForm.controls.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Помечаем все поля как тронутые, чтобы показать ошибки валидации
    registrationForm.markAsTouched();

    // Проверяем, валидна ли форма
    if (!registrationForm.valid) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Получаем данные формы
      const formData = registrationForm.value;

      // Отправляем на API
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Ошибка регистрации');
      }

      // Успех!
      alert('Регистрация успешна!');

      // Сбрасываем форму
      registrationForm.reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Произошла ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Имя</label>
        <input
          id="name"
          type="text"
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
          onBlur={() => name.markAsTouched()}
          disabled={isSubmitting}
        />
        {name.touched && name.errors?.required && <span className="error">Имя обязательно</span>}
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
          disabled={isSubmitting}
        />
        {email.touched && email.errors?.required && <span className="error">Email обязателен</span>}
        {email.touched && email.errors?.email && (
          <span className="error">Некорректный формат email</span>
        )}
      </div>

      {submitError && <div className="error">{submitError}</div>}

      <button type="submit" disabled={!registrationForm.valid || isSubmitting}>
        {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>
    </form>
  );
}
```

## Ключевые методы для отправки

### markAsTouched()

Показывает ошибки валидации для всех полей:

```typescript
// Перед отправкой помечаем все поля как тронутые
registrationForm.markAsTouched();

// Теперь все ошибки валидации будут видны
// даже для полей, с которыми пользователь не взаимодействовал
```

### Проверка валидности

Всегда проверяйте валидность формы перед отправкой:

```typescript
if (!registrationForm.valid) {
  // Форма содержит ошибки валидации
  return;
}

// Безопасно отправлять
const data = registrationForm.value;
```

### Получение данных формы

Свойство `value` содержит полные данные формы:

```typescript
const formData = registrationForm.value;
// { name: 'Иван', email: 'ivan@example.com' }

// Отправляем на API
await api.register(formData);
```

### Сброс формы

После успешной отправки сбросьте форму в исходное состояние:

```typescript
registrationForm.reset();

// Все поля возвращаются к начальным значениям
// Все ошибки валидации очищаются
// Все поля помечаются как нетронутые
```

## Управление состояниями отправки

Используйте состояние React для управления процессом отправки:

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const [submitError, setSubmitError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    setIsSubmitting(true);
    setSubmitError(null);

    // Выполняем отправку...
  } catch (error) {
    setSubmitError(error.message);
  } finally {
    setIsSubmitting(false);
  }
};
```

## Блокировка во время отправки

Блокируйте поля ввода и кнопки во время отправки, чтобы предотвратить повторную отправку:

```tsx
<input
  value={name.value}
  onChange={(e) => name.setValue(e.target.value)}
  disabled={isSubmitting}
/>

<button type="submit" disabled={!registrationForm.valid || isSubmitting}>
  {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
</button>
```

## Полный процесс отправки

Вот полный процесс отправки формы:

1. **Пользователь нажимает отправить** → вызывается `handleSubmit`
2. **Помечаем все поля как тронутые** → показываем все ошибки валидации
3. **Проверяем валидность** → возвращаемся, если невалидна
4. **Устанавливаем состояние отправки** → блокируем форму
5. **Получаем данные формы** → `registrationForm.value`
6. **Отправляем на API** → ожидаем ответ
7. **Обрабатываем успех** → сбрасываем форму, показываем сообщение
8. **Обрабатываем ошибку** → показываем сообщение об ошибке
9. **Очищаем состояние отправки** → разблокируем форму

## Попробуйте

1. Нажмите отправить с пустыми полями → увидите все ошибки валидации
2. Заполните только поле имени → кнопка отправки останется заблокированной
3. Заполните оба поля корректными данными → кнопка отправки станет активной
4. Нажмите отправить → форма отправит данные и сбросится

## Ключевые концепции

- **`markAsTouched()`** — показывает ошибки валидации для всех полей
- **`valid`** — проверяйте перед отправкой
- **`value`** — содержит полные данные формы
- **`reset()`** — сбрасывает форму в исходное состояние
- **`isSubmitting`** — отслеживает состояние отправки
- **Блокировка во время отправки** — предотвращает повторную отправку

## Что дальше?

Отличная работа! Вы завершили основы. В следующем разделе мы изучим **Структуры данных** и научимся работать с вложенными группами и динамическими массивами.

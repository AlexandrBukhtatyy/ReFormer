---
sidebar_position: 1
---

# Вложенные группы

В этом уроке вы узнаете, как организовать сложные формы в секции с помощью вложенных структур `GroupNode`.

## Что вы узнаете

- Как создавать вложенные структуры форм
- Как организовать формы в логические секции
- Как получать доступ к значениям вложенных полей
- Как валидировать вложенные данные

## Зачем использовать вложенные группы?

Реальные формы часто имеют логические секции. Вместо одной плоской структуры можно организовать связанные поля в группы:

```typescript
// Плоская структура (сложнее поддерживать)
{
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  zipCode: string;
}

// Вложенная структура (лучшая организация)
{
  personalInfo: {
    firstName: string;
    lastName: string;
  };
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
}
```

## Создание вложенных групп

Создадим форму профиля пользователя с вложенными секциями:

```typescript title="src/components/ProfileForm/form.ts"
import { GroupNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

interface ProfileFormData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
  };
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
}

export const profileForm = new GroupNode<ProfileFormData>({
  form: {
    personalInfo: {
      firstName: { value: '' },
      lastName: { value: '' },
      email: { value: '' },
    },
    address: {
      street: { value: '' },
      city: { value: '' },
      zipCode: { value: '' },
    },
  },
  validation: (path) => {
    // Валидация полей личной информации
    required(path.personalInfo.firstName);
    minLength(path.personalInfo.firstName, 2);
    required(path.personalInfo.lastName);
    minLength(path.personalInfo.lastName, 2);
    required(path.personalInfo.email);
    email(path.personalInfo.email);

    // Валидация полей адреса
    required(path.address.street);
    required(path.address.city);
    required(path.address.zipCode);
    minLength(path.address.zipCode, 5);
  },
});
```

### Понимание вложенной структуры

- **Вложенные объекты становятся группами** — `personalInfo` и `address` автоматически преобразуются в узлы групп
- **Простая конфигурация** — просто вкладывайте объекты с конфигурациями полей, без явного `new GroupNode`
- **Типобезопасные пути** — `path.personalInfo.firstName` обеспечивает полную типобезопасность
- **Валидация на всех уровнях** — можно валидировать любое поле независимо от вложенности

## Доступ к вложенным значениям

Можно получить доступ к вложенным значениям на любом уровне:

```typescript
// Получить значение всей формы
console.log(profileForm.value);
// {
//   personalInfo: { firstName: '', lastName: '', email: '' },
//   address: { street: '', city: '', zipCode: '' }
// }

// Получить значение секции
console.log(profileForm.controls.personalInfo.value);
// { firstName: '', lastName: '', email: '' }

// Получить значение конкретного поля
console.log(profileForm.controls.personalInfo.controls.firstName.value);
// ''

// Обновить вложенное поле
profileForm.controls.personalInfo.controls.firstName.setValue('Иван');

console.log(profileForm.value);
// {
//   personalInfo: { firstName: 'Иван', lastName: '', email: '' },
//   address: { street: '', city: '', zipCode: '' }
// }
```

## React-компонент

Создадим компонент, который рендерит вложенную форму по секциям:

```tsx title="src/components/ProfileForm/index.tsx"
import { useFormControl } from 'reformer';
import { profileForm } from './form';

export function ProfileForm() {
  // Поля личной информации
  const firstName = useFormControl(profileForm.controls.personalInfo.controls.firstName);
  const lastName = useFormControl(profileForm.controls.personalInfo.controls.lastName);
  const email = useFormControl(profileForm.controls.personalInfo.controls.email);

  // Поля адреса
  const street = useFormControl(profileForm.controls.address.controls.street);
  const city = useFormControl(profileForm.controls.address.controls.city);
  const zipCode = useFormControl(profileForm.controls.address.controls.zipCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileForm.markAllAsTouched();

    if (!profileForm.valid) {
      return;
    }

    console.log('Данные формы:', profileForm.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Секция личной информации */}
      <section>
        <h2>Личная информация</h2>

        <div>
          <label htmlFor="firstName">Имя</label>
          <input
            id="firstName"
            value={firstName.value}
            onChange={(e) => firstName.setValue(e.target.value)}
            onBlur={() => firstName.markAsTouched()}
          />
          {firstName.touched && firstName.errors?.required && (
            <span className="error">Имя обязательно</span>
          )}
        </div>

        <div>
          <label htmlFor="lastName">Фамилия</label>
          <input
            id="lastName"
            value={lastName.value}
            onChange={(e) => lastName.setValue(e.target.value)}
            onBlur={() => lastName.markAsTouched()}
          />
          {lastName.touched && lastName.errors?.required && (
            <span className="error">Фамилия обязательна</span>
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
          {email.touched && email.errors?.email && (
            <span className="error">Некорректный email</span>
          )}
        </div>
      </section>

      {/* Секция адреса */}
      <section>
        <h2>Адрес</h2>

        <div>
          <label htmlFor="street">Улица</label>
          <input
            id="street"
            value={street.value}
            onChange={(e) => street.setValue(e.target.value)}
            onBlur={() => street.markAsTouched()}
          />
          {street.touched && street.errors?.required && (
            <span className="error">Улица обязательна</span>
          )}
        </div>

        <div>
          <label htmlFor="city">Город</label>
          <input
            id="city"
            value={city.value}
            onChange={(e) => city.setValue(e.target.value)}
            onBlur={() => city.markAsTouched()}
          />
          {city.touched && city.errors?.required && (
            <span className="error">Город обязателен</span>
          )}
        </div>

        <div>
          <label htmlFor="zipCode">Индекс</label>
          <input
            id="zipCode"
            value={zipCode.value}
            onChange={(e) => zipCode.setValue(e.target.value)}
            onBlur={() => zipCode.markAsTouched()}
          />
          {zipCode.touched && zipCode.errors?.minLength && (
            <span className="error">Индекс должен быть не менее 5 символов</span>
          )}
        </div>
      </section>

      <button type="submit" disabled={!profileForm.valid}>
        Сохранить профиль
      </button>
    </form>
  );
}
```

## Валидация на уровне секции

Можно проверять состояние валидации на уровне секции:

```typescript
// Проверить, валидна ли вся секция
console.log(profileForm.controls.personalInfo.valid);
// false

// Проверить ошибки секции
console.log(profileForm.controls.personalInfo.errors);
// { firstName: { required: true }, lastName: { required: true }, ... }

// Пометить всю секцию как тронутую
profileForm.controls.personalInfo.markAllAsTouched();
```

## Преимущества вложенных групп

1. **Лучшая организация** — логическая группировка связанных полей
2. **Проще поддержка** — изменения в одной секции не влияют на другие
3. **Переиспользуемые секции** — можно выделить секции в отдельные формы
4. **Операции на уровне секций** — валидация, сброс или проверка валидности целых секций
5. **Ясная структура данных** — отражает модель предметной области

## Попробуйте

1. Заполните поля личной информации → увидите, как обновляются значения секции
2. Оставьте поля адреса пустыми → обратите внимание на валидацию секции
3. Отправьте форму → увидите полную вложенную структуру данных

## Ключевые концепции

- **Вложенные объекты** — группы могут содержать другие группы через простые вложенные объекты
- **Типобезопасный доступ** — `path.section.field` обеспечивает полную типобезопасность
- **Операции с секциями** — валидация/сброс/проверка целых секций
- **Организованная структура** — отражает реальные модели данных
- **Независимые секции** — каждая секция управляет своим состоянием

## Что дальше?

В следующем уроке мы изучим **Динамические массивы** — как работать со списками элементов, которые пользователи могут добавлять или удалять.

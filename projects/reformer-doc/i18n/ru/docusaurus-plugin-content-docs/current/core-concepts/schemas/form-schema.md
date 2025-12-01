---
sidebar_position: 2
---

# Схема формы

Схема формы определяет структуру данных формы и конфигурацию полей.

## Тип FormSchema

`FormSchema<T>` автоматически отображает ваш TypeScript-интерфейс на конфигурацию полей:

```typescript
import { FormSchema, GroupNode } from 'reformer';

interface User {
  name: string;
  email: string;
  age: number;
}

const schema: FormSchema<User> = {
  name: { value: '' },
  email: { value: '' },
  age: { value: 0 },
};

const form = new GroupNode<User>({ form: schema });
```

## Правила отображения типов

`FormSchema<T>` использует следующие правила для определения типов полей:

| Тип TypeScript | Тип схемы | Пример |
|----------------|-----------|--------|
| `string`, `number`, `boolean` | `FieldConfig<T>` | `name: { value: '' }` |
| `Date`, `File`, `Blob` | `FieldConfig<T>` | `date: { value: null }` |
| Вложенный объект | `FormSchema<T>` | `address: { city: {...} }` |
| Массив объектов | `[FormSchema<T>]` | `items: [{ name: {...} }]` |
| Массив примитивов | `FieldConfig<T[]>` | `tags: { value: [] }` |

### Примитивы

```typescript
interface BasicForm {
  name: string;
  age: number;
  active: boolean;
}

const schema: FormSchema<BasicForm> = {
  name: { value: '' },        // FieldConfig<string>
  age: { value: 0 },          // FieldConfig<number>
  active: { value: false },   // FieldConfig<boolean>
};
```

### Вложенные объекты

Объекты становятся вложенными `FormSchema`:

```typescript
interface WithAddress {
  name: string;
  address: {
    street: string;
    city: string;
  };
}

const schema: FormSchema<WithAddress> = {
  name: { value: '' },
  address: {                   // FormSchema<Address>
    street: { value: '' },
    city: { value: '' },
  },
};
```

### Массивы

Массивы объектов используют синтаксис кортежа `[{...}]`:

```typescript
interface WithItems {
  title: string;
  items: Array<{
    name: string;
    price: number;
  }>;
}

const schema: FormSchema<WithItems> = {
  title: { value: '' },
  items: [{                    // [FormSchema<Item>]
    name: { value: '' },
    price: { value: 0 },
  }],
};
```

## FieldConfig

Каждое поле использует `FieldConfig<T>`:

```typescript
interface FieldConfig<T> {
  value: T | null;              // Начальное значение (обязательно)
  disabled?: boolean;           // Состояние «отключено»
  updateOn?: 'change' | 'blur' | 'submit';  // Когда обновлять
  debounce?: number;            // Задержка для асинхронной валидации (мс)
}
```

### Опции полей

```typescript
const schema: FormSchema<User> = {
  // Базовое поле
  name: { value: '' },

  // Отключено по умолчанию
  email: { value: '', disabled: true },

  // Обновление при blur (не при каждом нажатии клавиши)
  password: { value: '', updateOn: 'blur' },

  // Задержка асинхронной валидации
  username: { value: '', debounce: 300 },
};
```

## Опциональные поля

Обрабатывайте опциональные поля с помощью `null`:

```typescript
interface Profile {
  name: string;
  bio?: string;
  avatar?: File;
}

const schema: FormSchema<Profile> = {
  name: { value: '' },
  bio: { value: '' },        // Пустая строка для опциональной строки
  avatar: { value: null },   // null для опционального File
};
```

## Комплексный пример

```typescript
interface Order {
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    product: string;
    quantity: number;
    price: number;
  }>;
  shipping: {
    address: string;
    city: string;
    notes?: string;
  };
  express: boolean;
}

const orderSchema: FormSchema<Order> = {
  customer: {
    name: { value: '' },
    email: { value: '' },
    phone: { value: '' },
  },
  items: [{
    product: { value: '' },
    quantity: { value: 1 },
    price: { value: 0 },
  }],
  shipping: {
    address: { value: '' },
    city: { value: '' },
    notes: { value: '' },
  },
  express: { value: false },
};

const form = new GroupNode<Order>({ form: orderSchema });
```

## Вывод типов

TypeScript автоматически выводит типы:

```typescript
const form = new GroupNode({
  form: {
    name: { value: '' },
    age: { value: 0 },
  },
});

// TypeScript знает:
form.value.name;              // string
form.value.age;               // number
form.controls.name;           // FieldNode<string>
form.controls.age;            // FieldNode<number>
```

## Следующие шаги

- [Схема валидации](./validation-schema) — Добавление правил валидации
- [Схема поведений](./behavior-schema) — Добавление реактивной логики
- [Композиция](./composition) — Переиспользование схем форм

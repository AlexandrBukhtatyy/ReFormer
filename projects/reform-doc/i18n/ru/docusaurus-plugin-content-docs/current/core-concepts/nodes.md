---
sidebar_position: 1
---

# Nodes (Узлы)

Nodes — это строительные блоки форм ReFormer. Существует три типа:

| Node | Назначение | Пример |
|------|------------|--------|
| `FieldNode` | Одиночное значение (строка, число и т.д.) | Текстовый input, checkbox |
| `GroupNode` | Объект с именованными полями | Секция формы, адрес |
| `ArrayNode` | Динамический список элементов | Телефоны, адреса |

## FieldNode

Простейший узел — хранит одно значение.

```typescript
import { FieldNode } from 'reformer';

const name = new FieldNode({ value: '' });
const age = new FieldNode({ value: 0 });
const active = new FieldNode({ value: false });

// Получение/установка значения
name.value; // ''
name.setValue('John');
name.value; // 'John'
```

### Свойства FieldNode

| Свойство | Тип | Описание |
|----------|-----|----------|
| `value` | `T` | Текущее значение |
| `valid` | `boolean` | Нет ошибок валидации |
| `invalid` | `boolean` | Есть ошибки валидации |
| `touched` | `boolean` | Пользователь взаимодействовал |
| `dirty` | `boolean` | Значение изменено |
| `errors` | `Record<string, any>` | Ошибки валидации |
| `disabled` | `boolean` | Поле отключено |
| `visible` | `boolean` | Поле видимо |

### Методы FieldNode

| Метод | Описание |
|-------|----------|
| `setValue(value)` | Установить новое значение |
| `reset()` | Сбросить к начальному значению |
| `markAsTouched()` | Пометить как touched |
| `markAsDirty()` | Пометить как dirty |
| `disable()` / `enable()` | Переключить disabled |
| `show()` / `hide()` | Переключить видимость |

## GroupNode

Группирует несколько полей в объект.

```typescript
import { GroupNode } from 'reformer';

const form = new GroupNode({
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
    address: {
      street: { value: '' },
      city: { value: '' },
    },
  },
});

// Доступ к контролам
form.controls.firstName.setValue('John');
form.controls.address.controls.city.setValue('NYC');

// Получить полное значение
form.value;
// { firstName: 'John', lastName: '', address: { street: '', city: 'NYC' } }
```

### Свойства GroupNode

Наследует все свойства FieldNode плюс:

| Свойство | Тип | Описание |
|----------|-----|----------|
| `controls` | `{ [key]: Node }` | Дочерние узлы |

### Методы GroupNode

| Метод | Описание |
|-------|----------|
| `markAllAsTouched()` | Пометить все дочерние как touched |
| `resetAll()` | Сбросить все дочерние |

## ArrayNode

Динамический список элементов.

```typescript
import { GroupNode } from 'reformer';

const form = new GroupNode({
  form: {
    phones: [
      { type: { value: 'home' }, number: { value: '123-456' } },
    ],
  },
});

// Доступ к элементам
form.controls.phones.controls[0].controls.number.value; // '123-456'

// Добавить элемент
form.controls.phones.push({ type: 'work', number: '' });

// Удалить элемент
form.controls.phones.removeAt(0);

// Получить все значения
form.controls.phones.value; // [{ type: 'work', number: '' }]
```

### Методы ArrayNode

| Метод | Описание |
|-------|----------|
| `push(value)` | Добавить элемент в конец |
| `insert(index, value)` | Вставить в позицию |
| `removeAt(index)` | Удалить элемент по индексу |
| `move(from, to)` | Переместить элемент |
| `clear()` | Удалить все элементы |

## Вывод типов

ReFormer автоматически выводит типы:

```typescript
const form = new GroupNode({
  form: {
    name: { value: '' },
    age: { value: 0 },
  },
});

// TypeScript знает типы
form.value.name; // string
form.value.age; // number
form.controls.name; // FieldNode<string>
```

## Следующие шаги

- [Реактивное состояние](/docs/core-concepts/reactive-state) — как работает реактивность
- [Валидация](/docs/validation/overview) — добавление правил валидации

---
sidebar_position: 2
---

# Реактивное состояние

ReFormer использует [Preact Signals](https://preactjs.com/guide/v10/signals/) для точечной реактивности.

## Как это работает

Каждое свойство узла — это Signal:

```typescript
import { FieldNode } from '@reformer/core';
import { effect } from '@preact/signals-react';

const name = new FieldNode({ value: '' });

// Подписка на изменения
effect(() => {
  console.log('Имя изменилось:', name.value);
});

name.setValue('John'); // выводит: "Имя изменилось: John"
name.setValue('Jane'); // выводит: "Имя изменилось: Jane"
```

## Реактивные свойства

Все эти свойства реактивны:

```typescript
const field = new FieldNode({ value: '' });

// Значение
field.value; // реактивно

// Состояние валидации
field.valid; // реактивно
field.invalid; // реактивно
field.errors; // реактивно

// Состояние взаимодействия
field.touched; // реактивно
field.dirty; // реактивно

// Состояние UI
field.disabled; // реактивно
field.visible; // реактивно
```

## Вычисляемые значения

GroupNode и ArrayNode вычисляют своё значение из дочерних:

```typescript
const form = new GroupNode({
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
  },
});

// form.value вычисляется из дочерних
effect(() => {
  console.log('Значение формы:', form.value);
});

form.controls.firstName.setValue('John');
// выводит: { firstName: 'John', lastName: '' }

form.controls.lastName.setValue('Doe');
// выводит: { firstName: 'John', lastName: 'Doe' }
```

## Интеграция с React

Хук `useFormControl` подписывается на все изменения поля:

```tsx
import { useFormControl } from '@reformer/core';

function Input({ field }: { field: FieldNode<string> }) {
  const control = useFormControl(field);

  // Компонент перерисовывается при изменении любого свойства
  return (
    <div>
      <input
        value={control.value}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={control.disabled}
      />
      {control.touched && control.errors?.required && <span>Обязательное поле</span>}
    </div>
  );
}
```

## Производительность

Signals обеспечивают точечные обновления — перерисовываются только компоненты, использующие изменённые значения:

```tsx
function Form() {
  // Этот компонент НЕ перерисовывается при изменении полей
  return (
    <form>
      <NameField />
      <EmailField />
      <SubmitButton />
    </form>
  );
}

function NameField() {
  const name = useFormControl(form.controls.name);
  // Перерисовывается только при изменении name
  return <input value={name.value} />;
}

function EmailField() {
  const email = useFormControl(form.controls.email);
  // Перерисовывается только при изменении email
  return <input value={email.value} />;
}
```

## Следующие шаги

- [Nodes](/docs/core-concepts/nodes) — типы узлов
- [Валидация](/docs/validation/overview) — добавление правил валидации

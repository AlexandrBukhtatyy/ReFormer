---
sidebar_position: 3
---

# Валидация и сохранение

Проверка валидности формы и отправка данных.

## Проверка валидности формы

### Способ 1: Свойство `form.valid`

Реактивное свойство, автоматически обновляется при изменении полей:

```typescript
// Запустить валидацию
await form.validate();

// Проверить результат
if (form.valid.value) {
  await saveApplication(form.getValue());
} else {
  form.markAsTouched(); // Показать ошибки
}
```

### Способ 2: Функция `validateForm(form, schema)`

Валидация по конкретной схеме. Используется для multi-step форм:

```typescript
import { validateForm } from '@reformer/core';

// Валидация только полей текущего шага
const isValid = await validateForm(form, loanValidation);

if (isValid) {
  goToNextStep();
} else {
  form.markAsTouched();
}
```

## Сохранение формы

```typescript
const handleSubmit = async () => {
  await form.validate();

  if (!form.valid.value) {
    form.markAsTouched();
    return;
  }

  const values = form.getValue();
  await saveApplication(values);
};
```

## Ключевые методы

| Метод                        | Назначение              |
| ---------------------------- | ----------------------- |
| `validate()`                 | Запуск валидации        |
| `valid.value`                | Проверка валидности     |
| `validateForm(form, schema)` | Валидация по схеме      |
| `markAsTouched()`            | Показать ошибки         |
| `getValue()`                 | Получить значения формы |

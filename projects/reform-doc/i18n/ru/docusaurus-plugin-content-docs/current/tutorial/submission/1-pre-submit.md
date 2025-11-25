---
sidebar_position: 1
---

# Валидация перед отправкой

Валидация формы перед отправкой.

:::info В разработке
Этот раздел находится в разработке.
:::

## Обзор

- `form.validate()`
- `form.markAsTouched()`
- Проверка `form.valid.value`
- Прокрутка к первой ошибке

## Реализация

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    // Отправка формы
  }
};
```

## Примеры

```typescript
// Скоро
```

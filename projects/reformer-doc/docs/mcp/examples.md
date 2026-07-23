---
sidebar_position: 5
---

# Примеры использования

Сценарии работы с AI при подключённом @reformer/mcp.

## Сценарий 1: Создание формы

**Запрос к AI:**

```
Создай форму регистрации с полями:
- Email
- Пароль (минимум 8 символов)
- Подтверждение пароля
- Чекбокс согласия с условиями
```

**Что получите:**

AI использует документацию ReFormer и создаст:

1. TypeScript интерфейс:

```typescript
interface RegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}
```

2. Схему формы с компонентами

3. Валидацию — отдельный слой (`@reformer/core/validation`), не часть layout-схемы:

```typescript
import { validate, cross, defineValidationSchema } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import type { ValidationError } from '@reformer/core';

// Совпадение паролей читает второе поле → это cross-field (снапшот модели), а не value-only правило.
const passwordsMatch = (f: RegistrationForm): ValidationError | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwords-mismatch', message: 'Пароли не совпадают' }
    : null;

const validationSchema = defineValidationSchema<RegistrationForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch);
  // Inline-правило — обычная функция (value) => ValidationError | null.
  validate(model.$.agreeToTerms, [
    (value) => (value ? null : { code: 'terms-required', message: 'Необходимо согласие' }),
  ]);
});
```

Схема — обычная функция над моделью; правила не живут в layout. Приложение прогоняет её по требованию
(например, на submit) внешним раннером — `await validateModel(model, validationSchema)`. Он возвращает
`boolean` и сам разносит ошибки по нодам формы, поэтому UI подсветит поля.

4. React-компонент с хуками

---

## Сценарий 2: Добавление валидации

**Запрос к AI:**

```
Добавь к форме заказа валидацию:
- Поле phone: обязательное, формат +7 (XXX) XXX-XX-XX
- Поле deliveryDate: не раньше завтрашнего дня
- Если deliveryType === "express", то поле deliveryTime обязательное
```

**Что получите:**

```typescript
import { validate, validateWhen, defineValidationSchema } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';
import type { ValidationError } from '@reformer/core';

// Inline-правило: дата доставки не раньше завтра. Возвращает ValidationError | null.
const notBeforeTomorrow = (value: string): ValidationError | null => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return new Date(value) >= tomorrow
    ? null
    : { code: 'deliveryTooSoon', message: 'Выберите дату не раньше завтра' };
};

const validationSchema = defineValidationSchema<OrderForm>(({ model }) => {
  validate(model.$.phone, [
    required(),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат: +7 (XXX) XXX-XX-XX' }),
  ]);
  validate(model.$.deliveryDate, [required(), notBeforeTomorrow]);
  // Условная ветка: правило для deliveryTime активно только для экспресс-доставки,
  // иначе гасится (ошибка снимается автоматически).
  validateWhen(
    () => model.deliveryType === 'express',
    () =>
      validate(model.$.deliveryTime, [required({ message: 'Укажите время для экспресс-доставки' })])
  );
});
```

---

## Сценарий 3: Вычисляемые поля

**Запрос к AI:**

```
В форме заказа добавь:
- Автоматический расчёт суммы (quantity * price) для каждого товара
- Общий итог по всем товарам
- Скидку 10% если общий итог больше 10000
```

**Что получите:**

```typescript
import { computeFrom } from '@reformer/core/behaviors';

const behavior: BehaviorSchemaFn<OrderForm> = (b) => ({
  items: b.array({
    subtotal: b.field(
      computeFrom(['quantity', 'price'], (quantity, price) => (quantity ?? 0) * (price ?? 0))
    ),
  }),
  total: b.field(
    computeFrom(
      ['items'],
      (items) => items?.reduce((sum, item) => sum + (item.subtotal ?? 0), 0) ?? 0
    )
  ),
  discount: b.field(computeFrom(['total'], (total) => (total > 10000 ? total * 0.1 : 0))),
  finalTotal: b.field(computeFrom(['total', 'discount'], (total, discount) => total - discount)),
});
```

---

## Сценарий 4: Отладка проблемы

**Запрос к AI:**

```
Моя форма не показывает ошибки валидации. Что не так?

const MyForm = () => {
  const model = createModel<UserForm>({ email: '', password: '' });
  const form = createForm<UserForm>({ model, schema: buildSchema(model) });

  const email = useFormControl(form.email);

  // validationSchema объявлена, но её никто не запускает
  return (
    <input
      value={email.value}
      onChange={(e) => form.email.setValue(e.target.value)}
    />
  );
};
```

**Что получите:**

AI найдёт проблемы:

- Модель и форма пересоздаются на каждый рендер — нет `useMemo` (ноды и их состояние теряются)
- Схема-валидация нигде не запускается: по новому контракту её прогоняет приложение через
  `validateModel(model, schema)`; `createForm`/`form.submit()` правила больше не хранят и не вызывают
- Нет вызова `markAsTouched` при blur — поле «не тронуто», поэтому ошибка скрыта (`shouldShowError` = false)
- Ошибки нигде не отображаются (`errors` — массив `ValidationError`, показываем `errors[0].message`)

И предложит исправление:

```typescript
import { useMemo } from 'react';
import { createModel, createForm, useFormControl } from '@reformer/core';
import { validateModel } from '@reformer/core/validation';

const MyForm = () => {
  // ✅ модель и форма создаются один раз
  const { model, form } = useMemo(() => {
    const m = createModel<UserForm>({ email: '', password: '' });
    return { model: m, form: createForm<UserForm>({ model: m, schema: buildSchema(m) }) };
  }, []);

  const email = useFormControl(form.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    // ✅ раннер сам разнесёт ошибки по нодам — UI подсветит поля
    await validateModel(model, validationSchema);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={email.value}
        onChange={(e) => form.email.setValue(e.target.value)}
        onBlur={() => form.email.markAsTouched()}
        aria-invalid={email.shouldShowError}
      />
      {email.shouldShowError && email.errors[0] && (
        <span className="error">{email.errors[0].message}</span>
      )}
      <button type="submit">Отправить</button>
    </form>
  );
};
```

---

## Сценарий 5: Вопросы по API

**Запросы к AI:**

```
Какие валидаторы есть в ReFormer из коробки?
```

```
Как работает поведение watchField?
```

```
Как сделать асинхронную валидацию?
```

AI ответит на основе актуальной документации ReFormer.

---

## Советы по работе с AI

### Будьте конкретны

❌ Плохо:

```
Сделай форму
```

✅ Хорошо:

```
Создай форму заказа с полями: ФИО, телефон, email, адрес доставки.
Телефон в формате +7. Email обязательный. Адрес минимум 10 символов.
```

### Предоставляйте контекст

При отладке всегда прикладывайте код:

```
Ошибка "Cannot read property 'value' of undefined" в строке 15.

[ваш код]
```

### Используйте итерации

Начните с базовой формы, затем добавляйте функциональность:

1. "Создай базовую форму регистрации"
2. "Добавь валидацию email"
3. "Добавь проверку совпадения паролей"
4. "Добавь условное поле для компании"

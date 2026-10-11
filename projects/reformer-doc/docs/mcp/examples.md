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

2. Схему формы — дерево узлов `{ model: model.$.email, component, componentProps }`

3. Правила валидации — отдельный слой (`@reformer/core/validation`), не часть схемы разметки:

```typescript
import { validate, defineValidation } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import type { ValidationIssue } from '@reformer/core';

// Совпадение паролей читает второе поле → это правило над несколькими полями (снимок модели).
const passwordsMatch = (f: RegistrationForm): ValidationIssue | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwords-mismatch' }
    : null;

export const registrationRules = defineValidation<RegistrationForm>(({ model, cross }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch);
  // Inline-правило — обычная функция (value) => ValidationIssue | null.
  validate(model.$.agreeToTerms, [(value) => (value ? null : { code: 'terms-required' })]);
});
```

Правила несут только коды замечаний; тексты по кодам — в словаре формы:

```typescript
import { defineIssueMessages } from '@reformer/core/i18n';

export const registrationMessages = defineIssueMessages({
  'passwords-mismatch': 'Пароли не совпадают',
  'terms-required': 'Нужно принять условия',
});
```

4. React-компонент: одна сборка `createForm({ initial, schema, validation: registrationRules })` в
   `useFormBundle`, поля — `<FormField control={form.email} />` под
   `<ValidationMessagesProvider messages={registrationMessages}>`, отправка —
   `bundle.submit(handler)`: при замечаниях обработчик не вызывается, а поля подсвечиваются.

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
import { validate, validateWhen, defineValidation } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';
import type { ValidationIssue } from '@reformer/core';

// Inline-правило: дата доставки не раньше завтра. Возвращает ValidationIssue | null.
const notBeforeTomorrow = (value: string): ValidationIssue | null => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return new Date(value) >= tomorrow ? null : { code: 'deliveryTooSoon' };
};

const orderRules = defineValidation<OrderForm>(({ model }) => {
  validate(model.$.phone, [
    required(),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' }),
  ]);
  validate(model.$.deliveryDate, [required(), notBeforeTomorrow]);
  // Условная ветка: правило для deliveryTime активно только для экспресс-доставки,
  // иначе гасится (ошибка снимается автоматически).
  validateWhen(
    () => model.deliveryType === 'express',
    () => validate(model.$.deliveryTime, [required({ code: 'deliveryTime.required' })])
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
import { applyEach, compute, defineFormBehavior } from '@reformer/core/behaviors';

type OrderItem = { quantity: number | null; price: number | null; subtotal: number };
type OrderForm = { items: OrderItem[]; total: number; discount: number; finalTotal: number };

// Поведение строки: сумма по позиции
const itemBehavior = defineFormBehavior<OrderItem>(({ model: row }) => {
  compute(row.$.subtotal, () => (row.quantity ?? 0) * (row.price ?? 0));
});

export const orderBehavior = defineFormBehavior<OrderForm>(({ model }) => {
  applyEach(model.$.items, itemBehavior); // к каждой строке, включая добавленные позже
  compute(model.$.total, () => model.items.map((item) => item.subtotal).reduce((a, b) => a + b, 0));
  compute(model.$.discount, () => (model.total > 10000 ? model.total * 0.1 : 0));
  compute(model.$.finalTotal, () => model.total - model.discount);
});
```

---

## Сценарий 4: Отладка проблемы

**Запрос к AI:**

```
Моя форма не показывает ошибки валидации. Что не так?

const MyForm = () => {
  const { form } = createForm<UserForm>({ initial: { email: '', password: '' }, schema: buildSchema });

  const email = useFormControl(form.email);

  // userRules объявлены, но в сборку не переданы и нигде не проверяются
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

- Сборка пересоздаётся на каждый рендер — нет `useFormBundle` (ноды и их состояние теряются)
- Правила не переданы в сборку (`validation`), а отправки через `bundle.submit` нет — проверять
  нечего и некому
- Нет вызова `markAsTouched` при blur — поле «не тронуто», поэтому ошибка скрыта (`shouldShowIssues` = false)
- Замечания нигде не отображаются: `issues` — массив `{ code, params? }`, текст по коду даёт
  `useIssueMessage()` (или `FormField` с `ValidationMessagesProvider`)

И предложит исправление:

```typescript
import { createForm } from '@reformer/core';
import { useFormBundle, useFormControl, useIssueMessage } from '@reformer/core/react';

const MyForm = () => {
  // ✅ сборка создаётся один раз, правила переданы в неё
  const bundle = useFormBundle(() =>
    createForm<UserForm>({
      initial: { email: '', password: '' },
      schema: buildSchema,
      validation: userRules,
    })
  );
  const { form } = bundle;

  const email = useFormControl(form.email);
  const message = useIssueMessage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ✅ один прогон правил; при замечаниях обработчик не вызывается, поля помечаются тронутыми
    await bundle.submit((values) => api.save(values));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={email.value}
        onChange={(e) => form.email.setValue(e.target.value)}
        onBlur={() => form.email.markAsTouched()}
        aria-invalid={email.shouldShowError}
      />
      {email.shouldShowIssues && email.issues[0] && (
        <span className="error">{message(email.issues[0])}</span>
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

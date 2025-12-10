---
sidebar_position: 5
---

# Примеры использования

Пошаговые сценарии работы с @reformer/mcp.

## Сценарий 1: Создание формы с нуля

**Задача:** Создать форму регистрации пользователя.

**Запрос к AI:**

```
Создай форму регистрации с полями:
- Email
- Пароль (минимум 8 символов)
- Подтверждение пароля
- Чекбокс согласия с условиями
```

**Что происходит:**

1. AI вызывает `get_recommended_structure` для определения структуры
2. Генерирует TypeScript интерфейс:

```typescript
interface RegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}
```

3. Создаёт схему формы с компонентами
4. Добавляет валидацию:

```typescript
import { required, email, minLength, validate } from '@reformer/core/validators';

const validation: ValidationSchemaFn<RegistrationForm> = (v) => ({
  email: v.field(required(), email()),
  password: v.field(required(), minLength(8)),
  confirmPassword: v.field(
    required(),
    validate((value, form) =>
      value === form.password.value || 'Пароли не совпадают'
    )
  ),
  agreeToTerms: v.field(
    validate((value) => value === true || 'Необходимо согласие')
  ),
});
```

5. Проверяет код через `check_code`

---

## Сценарий 2: Добавление валидации

**Задача:** Добавить валидацию к существующей форме.

**Запрос к AI:**

```
Добавь к форме заказа валидацию:
- Поле phone: обязательное, формат +7 (XXX) XXX-XX-XX
- Поле deliveryDate: не раньше завтрашнего дня
- Если deliveryType === "express", то поле deliveryTime обязательное
```

**Что происходит:**

1. AI анализирует текущий код
2. Использует `generate_validation` для получения правил
3. Генерирует валидацию:

```typescript
import { required, pattern, validate, when } from '@reformer/core/validators';

const validation: ValidationSchemaFn<OrderForm> = (v) => ({
  phone: v.field(
    required(),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Формат: +7 (XXX) XXX-XX-XX'
    })
  ),
  deliveryDate: v.field(
    required(),
    validate((value) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return new Date(value) >= tomorrow || 'Выберите дату не раньше завтра';
    })
  ),
  deliveryTime: v.field(
    when(
      (form) => form.deliveryType.value === 'express',
      required({ message: 'Укажите время для экспресс-доставки' })
    )
  ),
});
```

---

## Сценарий 3: Настройка вычисляемых полей

**Задача:** Добавить автоматический расчёт в форму заказа.

**Запрос к AI:**

```
В форме заказа добавь:
- Автоматический расчёт суммы (quantity * price) для каждого товара
- Общий итог по всем товарам
- Скидку 10% если общий итог больше 10000
```

**Что происходит:**

1. AI использует `generate_behavior` для получения паттернов
2. Генерирует поведения:

```typescript
import { computeFrom } from '@reformer/core/behaviors';

const behavior: BehaviorSchemaFn<OrderForm> = (b) => ({
  items: b.array({
    // Сумма для каждого товара
    subtotal: b.field(
      computeFrom(
        ['quantity', 'price'],
        (quantity, price) => (quantity ?? 0) * (price ?? 0)
      )
    ),
  }),
  // Общий итог
  total: b.field(
    computeFrom(
      ['items'],
      (items) => items?.reduce((sum, item) => sum + (item.subtotal ?? 0), 0) ?? 0
    )
  ),
  // Скидка
  discount: b.field(
    computeFrom(
      ['total'],
      (total) => total > 10000 ? total * 0.1 : 0
    )
  ),
  // Итого со скидкой
  finalTotal: b.field(
    computeFrom(
      ['total', 'discount'],
      (total, discount) => total - discount
    )
  ),
});
```

---

## Сценарий 4: Отладка проблемы

**Задача:** Понять почему не работает валидация.

**Запрос к AI:**

```
Моя форма не показывает ошибки валидации. Что не так?

const MyForm = () => {
  const form = createForm<UserForm>({
    form: formSchema,
    validation: validationSchema,
  });

  const email = useFormControl(form.email);

  return (
    <input
      value={email.value}
      onChange={(e) => email.setValue(e.target.value)}
    />
  );
};
```

**Что происходит:**

1. AI использует `check_code` для анализа
2. Находит проблемы:
   - Нет `useMemo` для `createForm`
   - Нет вызова `markAsTouched` при blur
   - Нет отображения ошибок

3. Предлагает исправление:

```typescript
const MyForm = () => {
  const form = useMemo(() => createForm<UserForm>({
    form: formSchema,
    validation: validationSchema,
  }), []);

  const email = useFormControl(form.email);

  return (
    <div>
      <input
        value={email.value}
        onChange={(e) => email.setValue(e.target.value)}
        onBlur={() => email.markAsTouched()}
      />
      {email.touched && email.errors.length > 0 && (
        <span className="error">{email.errors[0]}</span>
      )}
    </div>
  );
};
```

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

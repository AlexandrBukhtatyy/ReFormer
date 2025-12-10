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

## Сценарий 5: Создание формы по спецификации

**Задача:** Создать сложную пошаговую форму на основе документа с требованиями.

**Запрос к AI:**

```
Создай форму на основе спецификации spec/insurance-application-form.md

Используй MCP сервер reformer для:
1. Получения структуры проекта (get_recommended_structure)
2. Генерации типов (generate_types)
3. Генерации схемы (generate_schema)
4. Генерации валидации (generate_validation)
5. Генерации поведений (generate_behavior)
6. Проверки кода (check_code)
7. Проверки компиляции кода (npm run build)

Форма должна:
- Быть пошаговой (6 шагов)
- Иметь отдельные файлы валидации для каждого шага
- Использовать useStepForm для навигации
- Поддерживать вычисляемые поля (endDate, age, experience)
- Иметь условную видимость полей
- Компилироваться без ошибок
```

**Что происходит:**

1. AI читает спецификацию и анализирует требования
2. Вызывает `get_recommended_structure` для определения структуры файлов:

```
forms/
└── insurance-application/
    ├── types.ts
    ├── schema.ts
    ├── validation/
    │   ├── index.ts
    │   ├── step1-personal.ts
    │   ├── step2-contact.ts
    │   ├── step3-vehicle.ts
    │   ├── step4-insurance.ts
    │   ├── step5-payment.ts
    │   └── step6-documents.ts
    ├── behaviors.ts
    └── InsuranceApplicationForm.tsx
```

3. Генерирует типы через `generate_types`:

```typescript
interface InsuranceApplicationForm {
  // Step 1: Personal
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  age: number; // computed

  // Step 2: Contact
  phone: string;
  email: string;
  address: string;

  // Step 3: Vehicle
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  vin: string;

  // Step 4: Insurance
  insuranceType: 'osago' | 'kasko' | 'full';
  startDate: string;
  endDate: string; // computed
  period: 3 | 6 | 12;

  // Step 5: Payment
  paymentMethod: 'card' | 'bank' | 'cash';
  cardNumber?: string;

  // Step 6: Documents
  passportScan: File | null;
  vehicleRegistration: File | null;
  driverLicense: File | null;
}
```

4. Создаёт пошаговую схему через `generate_schema`:

```typescript
import { FormSchemaFn } from '@reformer/core';

export const formSchema: FormSchemaFn<InsuranceApplicationForm> = (f) => ({
  // Step 1
  lastName: f.control(''),
  firstName: f.control(''),
  middleName: f.control(''),
  birthDate: f.control(''),
  age: f.control(0),

  // ... остальные поля
});
```

5. Генерирует валидацию для каждого шага через `generate_validation`:

```typescript
// validation/step1-personal.ts
export const step1Validation: ValidationSchemaFn<InsuranceApplicationForm> = (v) => ({
  lastName: v.field(required(), minLength(2)),
  firstName: v.field(required(), minLength(2)),
  birthDate: v.field(
    required(),
    validate((value) => {
      const age = calculateAge(value);
      return age >= 18 || 'Минимальный возраст 18 лет';
    })
  ),
});
```

6. Генерирует поведения (вычисляемые поля, условия) через `generate_behavior`:

```typescript
import { computeFrom, showWhen } from '@reformer/core/behaviors';

export const behaviorSchema: BehaviorSchemaFn<InsuranceApplicationForm> = (b) => ({
  // Вычисляемый возраст
  age: b.field(
    computeFrom(['birthDate'], (birthDate) => calculateAge(birthDate))
  ),

  // Дата окончания = дата начала + период
  endDate: b.field(
    computeFrom(['startDate', 'period'], (startDate, period) => {
      if (!startDate) return '';
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + period);
      return date.toISOString().split('T')[0];
    })
  ),

  // Номер карты виден только при оплате картой
  cardNumber: b.field(
    showWhen((form) => form.paymentMethod.value === 'card')
  ),
});
```

7. Создаёт компонент с `useStepForm`:

```tsx
import { useStepForm } from '@reformer/react';

export const InsuranceApplicationForm = () => {
  const form = useMemo(() => createForm<InsuranceApplicationForm>({
    form: formSchema,
    validation: mergeValidation(
      step1Validation,
      step2Validation,
      // ...
    ),
    behavior: behaviorSchema,
  }), []);

  const { currentStep, next, prev, canGoNext, canGoPrev } = useStepForm(form, {
    steps: [
      { fields: ['lastName', 'firstName', 'middleName', 'birthDate'] },
      { fields: ['phone', 'email', 'address'] },
      { fields: ['vehicleMake', 'vehicleModel', 'vehicleYear', 'licensePlate', 'vin'] },
      { fields: ['insuranceType', 'startDate', 'period'] },
      { fields: ['paymentMethod', 'cardNumber'] },
      { fields: ['passportScan', 'vehicleRegistration', 'driverLicense'] },
    ],
  });

  return (
    <form>
      <StepIndicator current={currentStep} total={6} />

      {currentStep === 0 && <Step1Personal form={form} />}
      {currentStep === 1 && <Step2Contact form={form} />}
      {/* ... */}

      <div className="navigation">
        <button onClick={prev} disabled={!canGoPrev}>Назад</button>
        <button onClick={next} disabled={!canGoNext}>
          {currentStep === 5 ? 'Отправить' : 'Далее'}
        </button>
      </div>
    </form>
  );
};
```

8. Проверяет код через `check_code` и исправляет ошибки
9. Запускает `npm run build` для проверки компиляции

**Результат:**

- Полностью типизированная пошаговая форма
- Раздельная валидация по шагам
- Автоматические вычисления (возраст, дата окончания)
- Условная видимость полей
- Навигация между шагами с валидацией

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

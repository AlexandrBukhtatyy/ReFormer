---
sidebar_position: 8
---

# Объединение и регистрация валидации

Сборка всех валидаторов и интеграция с формой.

## Обзор

Мы создали валидаторы для каждого шага плюс валидацию между шагами. Теперь давайте:

1. Создадим основной файл валидации, который объединяет всё
2. Зарегистрируем валидацию с формой
3. Протестируем что вся валидация работает вместе
4. Проверим полную структуру файлов

## Создание основного файла валидации

Создайте основной файл валидации, который импортирует и применяет все валидаторы шагов:

```bash
touch src/schemas/validators/credit-application.validators.ts
```

### Реализация

```typescript title="src/schemas/validators/credit-application.validators.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

// Импортируйте валидаторы шагов
import { step1LoanValidation } from './steps/step-1-loan-info.validators';
import { step2PersonalValidation } from './steps/step-2-personal-info.validators';
import { step3ContactValidation } from './steps/step-3-contact-info.validators';
import { step4EmploymentValidation } from './steps/step-4-employment.validators';
import { step5AdditionalValidation } from './steps/step-5-additional-info.validators';
import { crossStepValidation } from './cross-step.validators';

/**
 * Полная схема валидации для формы кредитного заявления
 *
 * Организована по шагам формы для поддерживаемости:
 * - Шаг 1: Информация о кредите
 * - Шаг 2: Личная информация
 * - Шаг 3: Контактная информация
 * - Шаг 4: Занятость
 * - Шаг 5: Дополнительная информация
 * - Между шагами: Валидация, охватывающая несколько шагов
 */
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Шаг 1: Информация о кредите
  // ==========================================
  step1LoanValidation(path);

  // ==========================================
  // Шаг 2: Личная информация
  // ==========================================
  step2PersonalValidation(path);

  // ==========================================
  // Шаг 3: Контактная информация
  // ==========================================
  step3ContactValidation(path);

  // ==========================================
  // Шаг 4: Занятость
  // ==========================================
  step4EmploymentValidation(path);

  // ==========================================
  // Шаг 5: Дополнительная информация
  // ==========================================
  step5AdditionalValidation(path);

  // ==========================================
  // Валидация между шагами
  // ==========================================
  crossStepValidation(path);
};
```

## Регистрация с формой

Обновите функцию создания формы для включения валидации:

```typescript title="src/schemas/create-form.ts"
import { createForm } from 'reformer';
import { creditApplicationSchema } from './credit-application.schema';
import { creditApplicationBehaviors } from '../behaviors/credit-application.behaviors';
import { creditApplicationValidation } from '../validators/credit-application.validators';
import type { CreditApplicationForm } from '@/types';

export function createCreditApplicationForm() {
  return createForm<CreditApplicationForm>({
    schema: creditApplicationSchema,
    behaviors: creditApplicationBehaviors,
    validation: creditApplicationValidation,  // ← Зарегистрируйте валидацию здесь
  });
}
```

Вот и всё! Валидация теперь активна при создании формы.

## Структура файлов

Ваш проект должен иметь теперь эту структуру:

```
src/
├── schemas/
│   ├── validators/
│   │   ├── steps/
│   │   │   ├── step-1-loan-info.validators.ts
│   │   │   ├── step-2-personal-info.validators.ts
│   │   │   ├── step-3-contact-info.validators.ts
│   │   │   ├── step-4-employment.validators.ts
│   │   │   └── step-5-additional-info.validators.ts
│   │   ├── cross-step.validators.ts
│   │   └── credit-application.validators.ts  ← Основной файл
│   ├── behaviors/
│   │   ├── steps/
│   │   │   ├── step-1-loan-info.behaviors.ts
│   │   │   ├── step-2-personal-info.behaviors.ts
│   │   │   ├── step-3-contact-info.behaviors.ts
│   │   │   ├── step-4-employment.behaviors.ts
│   │   │   └── step-5-additional-info.behaviors.ts
│   │   ├── cross-step.behaviors.ts
│   │   └── credit-application.behaviors.ts
│   ├── credit-application.schema.ts
│   └── create-form.ts  ← Валидация зарегистрирована здесь
│
├── components/
│   ├── forms/
│   │   └── createCreditApplicationForm.ts
│   ├── steps/
│   ├── nested-forms/
│   └── CreditApplicationForm.tsx
│
└── types/
    └── credit-application.ts
```

## Тестирование всей валидации

Создайте полный контрольный список тестирования:

### Шаг 1: Информация о кредите
- [ ] Обязательные поля (loanType, loanAmount, loanTerm, loanPurpose)
- [ ] Числовые диапазоны (сумма 50k-10M, срок 6-360 месяцев)
- [ ] Длина строки (цель 10-500 символов)
- [ ] Условные поля ипотеки (propertyValue, initialPayment)
- [ ] Условные поля автокредита (марка, модель, год, цена)

### Шаг 2: Личная информация
- [ ] Требуемые имена с паттерном кириллицы
- [ ] Дата рождения не в будущем
- [ ] Валидация возраста 18-70
- [ ] Серия паспорта (4 цифры) и номер (6 цифр)
- [ ] Валидация даты выдачи паспорта
- [ ] ИНН (10 или 12 цифр) и СНИЛС (11 цифр)

### Шаг 3: Контактная информация
- [ ] Требуемые главный телефон и email
- [ ] Опциональный дополнительный телефон и email (валидируются если указаны)
- [ ] Требуемые поля адреса регистрации
- [ ] Условный адрес проживания (когда sameAsRegistration = false)
- [ ] Формат почтового кода (6 цифр)

### Шаг 4: Занятость
- [ ] Требуемый статус занятости
- [ ] Требуемый ежемесячный доход (min 10 000)
- [ ] Условные поля компании (при работе)
- [ ] Стаж работы >= 3 месяцев (при работе)
- [ ] Условные поля бизнеса (при самозанятости)
- [ ] Опыт бизнеса >= 6 месяцев (при самозанятости)

### Шаг 5: Дополнительная информация
- [ ] Массив имущества (min 1 когда hasProperty, max 10)
- [ ] Валидация элемента имущества (тип, описание, стоимость)
- [ ] Массив существующих кредитов (min 1 когда hasExistingLoans, max 20)
- [ ] Валидация элемента кредита (банк, сумма, платёж)
- [ ] Массив созаёмщиков (min 1 когда hasCoBorrower, max 5)
- [ ] Валидация элемента созаёмщика (имя, email, телефон, доход)

### Между шагами
- [ ] Первоначальный платёж >= 20% стоимости имущества
- [ ] Ежемесячный платёж <= 50% дохода домохозяйства
- [ ] Сумма кредита <= цена автомобиля
- [ ] Остаток кредита <= оригинальный кредит
- [ ] Валидация возраста на вычисляемом поле
- [ ] Асинхронная проверка ИНН (показывает загрузку, валидирует)
- [ ] Асинхронная проверка СНИЛС
- [ ] Асинхронная проверка уникальности email

## Отладка валидации

Если валидация не работает как ожидается:

### 1. Проверьте консоль на ошибки

```typescript
// Добавьте debug логирование в валидаторы
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  console.log('Регистрирую валидацию Шага 1');

  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  console.log('Добавил валидатор required для loanAmount');
};
```

### 2. Проверьте пути полей

Неправильные пути полей вызывают молчащий отказ валидации:

```typescript
// ❌ Неправильно - опечатка в имени поля
required(path.loanAmmount, { message: '...' });

// ✅ Правильно
required(path.loanAmount, { message: '...' });
```

### 3. Проверьте регистрацию формы

Убедитесь что валидация передана в `createForm`:

```typescript
// ❌ Забыли добавить валидацию
createForm({
  schema: creditApplicationSchema,
  behaviors: creditApplicationBehaviors,
});

// ✅ Валидация зарегистрирована
createForm({
  schema: creditApplicationSchema,
  behaviors: creditApplicationBehaviors,
  validation: creditApplicationValidation,
});
```

### 4. Проверьте интеграцию компонента

Убедитесь что вы используете форму с валидацией:

```tsx
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []); // ← Использует валидацию

  return (
    <FormField control={form.loanAmount} />
  );
}
```

### 5. Проверьте статус поля

Отлаживайте состояние валидации поля:

```tsx
function DebugField({ control }: { control: FieldNode<any> }) {
  const errors = control.errors.value;
  const isValid = control.isValid.value;
  const isValidating = control.isValidating.value;

  console.log('Ошибки поля:', errors);
  console.log('Валидно:', isValid);
  console.log('Валидируется:', isValidating);

  return <FormField control={control} />;
}
```

## Порядок выполнения валидации

Понимание когда запускается валидация:

### 1. При изменении поля
```typescript
form.field('loanAmount').setValue(100000);
// → Срабатывают все валидаторы для loanAmount
// → Срабатывают валидаторы которые зависят от loanAmount
```

### 2. При изменении зависимости
```typescript
form.field('loanType').setValue('mortgage');
// → Переиспускаются условные валидаторы:
//    - requiredWhen для propertyValue
//    - requiredWhen для initialPayment
//    - Валидатор между шагами первоначального платежа
```

### 3. При отправке формы
```typescript
form.submit().then((data) => {
  console.log('Валидные данные:', data);
}).catch((errors) => {
  console.log('Ошибки валидации:', errors);
});
```

### 4. Ручная валидация
```typescript
// Валидируйте одно поле
await form.field('loanAmount').validate();

// Валидируйте всю форму
await form.validate();

// Валидируйте определённый шаг
await form.group('step1').validate();
```

## Соображения производительности

Валидация оптимизирована в ReFormer, но учитывайте это:

### 1. Избегайте дорогостоящих синхронных валидаторов

```typescript
// ❌ Плохо - дорогостоящая операция при каждом изменении
createValidator(path.field, [], (value) => {
  return expensiveCalculation(value);  // Запускается при каждом нажатии клавиши!
});

// ✅ Лучше - держите синхронные валидаторы быстрыми
createValidator(path.field, [], (value) => {
  return quickCheck(value);
});
```

### 2. Используйте debouncing для асинхронных валидаторов

```typescript
// ❌ Плохо - API вызов при каждом нажатии клавиши
createAsyncValidator(path.inn, async (inn) => {
  return await fetch(`/api/validate/inn?value=${inn}`);
});

// ✅ Хорошо - debounced API вызовы
createAsyncValidator(
  path.inn,
  async (inn) => {
    return await fetch(`/api/validate/inn?value=${inn}`);
  },
  { debounce: 500 }  // ← Debounce
);
```

### 3. Минимизируйте зависимости

```typescript
// ❌ Плохо - ненужные зависимости
createValidator(
  path.field,
  [path.a, path.b, path.c, path.d, path.e],  // Слишком много!
  (value, deps) => { /* ... */ }
);

// ✅ Хорошо - только необходимые зависимости
createValidator(
  path.field,
  [path.dependency],  // Только что нужно
  (value, [dep]) => { /* ... */ }
);
```

### 4. Не создавайте циклические зависимости

```typescript
// ❌ Плохо - циклическая зависимость
createValidator(path.a, [path.b], (a, [b]) => { /* ... */ });
createValidator(path.b, [path.a], (b, [a]) => { /* ... */ });  // Бесконечный цикл!

// ✅ Хорошо - одностороннее зависимости
createValidator(path.a, [], (a) => { /* ... */ });
createValidator(path.b, [path.a], (b, [a]) => { /* ... */ });
```

## Доступ к состоянию валидации

### В компонентах

```tsx
import { useField } from 'reformer/react';

function FormField({ control }) {
  const field = useField(control);

  return (
    <div>
      <input
        value={field.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
      />

      {/* Показать ошибки */}
      {field.errors.length > 0 && (
        <div className="error">
          {field.errors.map((error) => (
            <div key={error.type}>{error.message}</div>
          ))}
        </div>
      )}

      {/* Показать загрузку для асинхронной валидации */}
      {field.isValidating && <span>Валидируется...</span>}
    </div>
  );
}
```

### В логике формы

```typescript
const form = createCreditApplicationForm();

// Проверьте если форма валидна
const isValid = form.isValid.value;

// Получите все ошибки
const errors = form.errors.value;

// Проверьте определённое поле
const loanAmountErrors = form.field('loanAmount').errors.value;

// Подпишитесь на изменения валидации
form.isValid.subscribe((valid) => {
  console.log('Форма валидна:', valid);
});
```

## Резюме

Мы успешно реализовали полную валидацию для формы кредитного заявления:

### Шаг 1: Информация о кредите
- ✅ Требуемые поля и числовые диапазоны
- ✅ Валидация длины строки
- ✅ Условные поля ипотеки/автокредита

### Шаг 2: Личная информация
- ✅ Валидация имён с паттерном кириллицы
- ✅ Валидация даты рождения и возраста
- ✅ Валидация формата паспорта
- ✅ Паттерны ИНН и СНИЛС

### Шаг 3: Контактная информация
- ✅ Валидация формата email и телефона
- ✅ Требуемые поля адреса
- ✅ Условный адрес проживания

### Шаг 4: Занятость
- ✅ Требуемые доход и статус
- ✅ Условные поля занятости
- ✅ Условные поля самозанятости
- ✅ Минимумы стажа/опыта

### Шаг 5: Дополнительная информация
- ✅ Валидация длины массива
- ✅ Валидация элементов массива
- ✅ Валидация вложенных объектов в массивах

### Между шагами
- ✅ Валидация первоначального платежа >= 20%
- ✅ Ежемесячный платёж <= 50% дохода
- ✅ Сумма кредита <= цена автомобиля
- ✅ Остаток кредита <= оригинальная сумма
- ✅ Валидация возраста
- ✅ Асинхронная проверка ИНН
- ✅ Асинхронная проверка СНИЛС
- ✅ Асинхронная проверка уникальности email

## Ключевые достижения

1. **Декларативная валидация** - Ясные, поддерживаемые определения валидации
2. **Организованная структура** - Легко найти и изменить валидаторы
3. **Типобезопасность** - Полная поддержка TypeScript
4. **Условная логика** - Динамическая валидация на основе состояния формы
5. **Между полями** - Сложные бизнес-правила между несколькими полями
6. **Асинхронная поддержка** - Серверная валидация с debouncing
7. **Работает с Behaviors** - Идеальная синхронизация

## Валидация vs Behaviors

Наша форма теперь имеет обе:

| Функция | Behaviors | Валидация |
|---------|-----------|------------|
| Назначение | Автоматизировать взаимодействия | Обеспечить качество данных |
| Когда запускается | При изменении полей | При изменении полей + отправка |
| Примеры | - Показ/скрытие полей<br/>- Вычисление значений<br/>- Копирование данных | - Обязательные поля<br/>- Проверка формата<br/>- Бизнес-правила |
| Обратная связь пользователю | Визуальные изменения | Сообщения об ошибках |

Они работают вместе:
- Behaviors **скрывают** поля → Валидация **пропускает** их
- Behaviors **вычисляют** значения → Валидация **проверяет** их
- Behaviors **включают/отключают** → Валидация уважает состояние

## Что дальше?

Форма теперь имеет продвинутую валидацию, но нам ещё нужно обработать поток данных и отправку. В следующих разделах мы покроем:

### Поток данных (следующий раздел)
- Загрузка начальных данных формы
- Сохранение прогресса формы (автосохранение)
- Сброс состояния формы
- Клонирование и дублирование форм

### Отправка (следующий раздел)
- Обработка отправки формы
- Коммуникация с сервером
- Обработка успеха и ошибки
- Оптимистичные обновления
- Логика повторных попыток

Валидация которую мы создали будет бесшовно интегрирована с этими функциями!

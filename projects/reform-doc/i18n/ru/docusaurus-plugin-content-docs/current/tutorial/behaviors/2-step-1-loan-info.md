---
sidebar_position: 2
---

# Шаг 1: Behaviors для информации о кредите

Реализация интерактивности для параметров кредита: расчёт процентной ставки, ежемесячного платежа и условных полей.

## Обзор

Для первого шага нашей формы кредитной заявки нам нужно добавить следующие behaviors:

1. **Вычисляемое поле: Процентная ставка** - Автоматический расчёт на основе типа кредита, города и наличия имущества
2. **Вычисляемое поле: Ежемесячный платёж** - Расчёт по формуле аннуитета
3. **Условная видимость: Поля ипотеки** - Показываются только для ипотечных кредитов
4. **Условная видимость: Поля автокредита** - Показываются только для автокредитов
5. **Watch: Сброс полей** - Очистка полей при смене типа кредита

## Создание файла Behavior

Сначала создадим структуру каталогов и файл behavior для Шага 1:

```bash
mkdir -p src/behaviors/steps
touch src/behaviors/steps/step-1-loan-info.behaviors.ts
```

## Реализация Behaviors

### 1. Настройка файла

Начнём с импорта необходимых функций и типов:

```typescript title="src/behaviors/steps/step-1-loan-info.behaviors.ts"
import { computeFrom, showWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, Address } from '@/types';

export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Behaviors будут здесь
};
```

### 2. Расчёт процентной ставки

Процентная ставка зависит от нескольких факторов:
- Базовая ставка варьируется в зависимости от типа кредита
- Скидка 0.5% для крупных городов (Москва, Санкт-Петербург)
- Скидка 1.0% если заявитель владеет имуществом

```typescript title="src/behaviors/steps/step-1-loan-info.behaviors.ts"
export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ==========================================
  // Вычисляемое поле: Процентная ставка
  // ==========================================
  computeFrom(
    // Исходные поля для отслеживания
    [path.loanType, path.registrationAddress, path.hasProperty],
    // Целевое поле для обновления
    path.interestRate,
    // Функция вычисления
    (values) => {
      // Базовые ставки по типу кредита
      const baseRates: Record<string, number> = {
        mortgage: 8.5,
        car: 12.0,
        consumer: 15.0,
        business: 18.0,
        refinancing: 14.0,
      };

      let rate = baseRates[values.loanType as string] || 15.0;

      // Скидка для крупных городов
      const address = values.registrationAddress as Address;
      const city = address?.city || '';
      if (['Москва', 'Санкт-Петербург'].includes(city)) {
        rate -= 0.5;
      }

      // Скидка за наличие имущества в залог
      if (values.hasProperty) {
        rate -= 1.0;
      }

      // Минимальная ставка 5%
      return Math.max(rate, 5.0);
    }
  );

  // ... ещё behaviors
};
```

**Как это работает:**
- `computeFrom` отслеживает исходные поля (`loanType`, `registrationAddress`, `hasProperty`)
- Когда любое из них изменяется, запускается функция вычисления
- Результат автоматически устанавливается в `interestRate`
- Не нужны ручные подписки или очистка

### 3. Расчёт ежемесячного платежа

Рассчитываем ежемесячный платёж по формуле аннуитета:

```
P = A × (r × (1+r)^n) / ((1+r)^n - 1)

Где:
- P = ежемесячный платёж
- A = сумма кредита
- r = месячная процентная ставка (годовая ставка / 12 / 100)
- n = количество месяцев
```

```typescript title="src/behaviors/steps/step-1-loan-info.behaviors.ts"
export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // Вычисляемое поле: Ежемесячный платёж (формула аннуитета)
  // ==========================================
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const termMonths = values.loanTerm as number;
      const annualRate = values.interestRate as number;

      // Обработка отсутствующих или некорректных значений
      if (!amount || !termMonths || !annualRate) return 0;
      if (amount <= 0 || termMonths <= 0 || annualRate <= 0) return 0;

      // Преобразуем годовую ставку в месячную
      const monthlyRate = annualRate / 100 / 12;

      // Формула аннуитета: P = A * (r * (1+r)^n) / ((1+r)^n - 1)
      const factor = Math.pow(1 + monthlyRate, termMonths);
      const payment = amount * (monthlyRate * factor) / (factor - 1);

      // Округляем до целого числа
      return Math.round(payment);
    }
  );

  // ... ещё behaviors
};
```

**Зависимости:**
- Ежемесячный платёж зависит от `interestRate`
- `interestRate` - это вычисляемое поле, которое обновляется автоматически
- Это создаёт **цепочку зависимостей**: `loanType` → `interestRate` → `monthlyPayment`

:::tip Цепочки вычисляемых полей
ReFormer автоматически обрабатывает зависимости вычисляемых полей. Когда изменяется `loanType`:
1. Сначала пересчитывается `interestRate`
2. Затем пересчитывается `monthlyPayment` (используя новую ставку)

Вам не нужно беспокоиться о порядке выполнения!
:::

### 4. Условная видимость: Поля ипотеки

Показываем поля для ипотеки только когда `loanType === 'mortgage'`:

```typescript title="src/behaviors/steps/step-1-loan-info.behaviors.ts"
export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // Условная видимость: Поля ипотеки
  // ==========================================
  showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');
  showWhen(path.initialPayment, path.loanType, (value) => value === 'mortgage');

  // ... ещё behaviors
};
```

**Как это работает:**
- `showWhen` отслеживает поле `loanType`
- Когда `loanType === 'mortgage'`, поля показываются
- Когда `loanType` меняется на другое значение, поля скрываются
- Скрытые поля не валидируются и не включаются в отправку формы

### 5. Условная видимость: Поля автокредита

Аналогично, показываем поля для автокредита только для автокредитов:

```typescript title="src/behaviors/steps/step-1-loan-info.behaviors.ts"
export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // Условная видимость: Поля автокредита
  // ==========================================
  showWhen(path.carBrand, path.loanType, (value) => value === 'car');
  showWhen(path.carModel, path.loanType, (value) => value === 'car');
  showWhen(path.carYear, path.loanType, (value) => value === 'car');
  showWhen(path.carPrice, path.loanType, (value) => value === 'car');

  // ... ещё behaviors
};
```

### 6. Watch: Сброс полей при смене типа кредита

Когда пользователь меняет тип кредита, мы должны очистить поля от предыдущего типа, чтобы избежать путаницы:

```typescript title="src/behaviors/steps/step-1-loan-info.behaviors.ts"
export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // Watch: Сброс полей при смене типа кредита
  // ==========================================
  watch(path.loanType, (value, { form }) => {
    // Очищаем поля ипотеки если не ипотека
    if (value !== 'mortgage') {
      form.field(path.propertyValue).setValue(null, { emitEvent: false });
      form.field(path.initialPayment).setValue(null, { emitEvent: false });
    }

    // Очищаем поля автокредита если не автокредит
    if (value !== 'car') {
      form.field(path.carBrand).setValue('', { emitEvent: false });
      form.field(path.carModel).setValue('', { emitEvent: false });
      form.field(path.carYear).setValue(null, { emitEvent: false });
      form.field(path.carPrice).setValue(null, { emitEvent: false });
    }
  });
};
```

**Зачем `emitEvent: false`?**
- Предотвращает запуск дополнительных behaviors и валидации
- Избегает лишних ре-рендеров
- Значения полей очищаются программно, а не пользователем

:::caution Watch vs ComputeFrom
Используйте `watch` для **побочных эффектов** (очистка полей, логирование, аналитика).
Используйте `computeFrom` для **получения значений** из других полей.

Не используйте `watch` для установки значений полей, которые должны быть производными - используйте `computeFrom`!
:::

## Полный код

Вот полный файл behavior для Шага 1:

```typescript title="src/behaviors/steps/step-1-loan-info.behaviors.ts"
import { computeFrom, showWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, Address } from '@/types';

export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Вычисляемое поле: Процентная ставка
  // ==========================================
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty],
    path.interestRate,
    (values) => {
      const baseRates: Record<string, number> = {
        mortgage: 8.5,
        car: 12.0,
        consumer: 15.0,
        business: 18.0,
        refinancing: 14.0,
      };

      let rate = baseRates[values.loanType as string] || 15.0;

      const address = values.registrationAddress as Address;
      const city = address?.city || '';
      if (['Москва', 'Санкт-Петербург'].includes(city)) {
        rate -= 0.5;
      }

      if (values.hasProperty) {
        rate -= 1.0;
      }

      return Math.max(rate, 5.0);
    }
  );

  // ==========================================
  // Вычисляемое поле: Ежемесячный платёж
  // ==========================================
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const termMonths = values.loanTerm as number;
      const annualRate = values.interestRate as number;

      if (!amount || !termMonths || !annualRate) return 0;
      if (amount <= 0 || termMonths <= 0 || annualRate <= 0) return 0;

      const monthlyRate = annualRate / 100 / 12;
      const factor = Math.pow(1 + monthlyRate, termMonths);
      const payment = amount * (monthlyRate * factor) / (factor - 1);

      return Math.round(payment);
    }
  );

  // ==========================================
  // Условная видимость: Поля ипотеки
  // ==========================================
  showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');
  showWhen(path.initialPayment, path.loanType, (value) => value === 'mortgage');

  // ==========================================
  // Условная видимость: Поля автокредита
  // ==========================================
  showWhen(path.carBrand, path.loanType, (value) => value === 'car');
  showWhen(path.carModel, path.loanType, (value) => value === 'car');
  showWhen(path.carYear, path.loanType, (value) => value === 'car');
  showWhen(path.carPrice, path.loanType, (value) => value === 'car');

  // ==========================================
  // Watch: Сброс полей
  // ==========================================
  watch(path.loanType, (value, { form }) => {
    if (value !== 'mortgage') {
      form.field(path.propertyValue).setValue(null, { emitEvent: false });
      form.field(path.initialPayment).setValue(null, { emitEvent: false });
    }

    if (value !== 'car') {
      form.field(path.carBrand).setValue('', { emitEvent: false });
      form.field(path.carModel).setValue('', { emitEvent: false });
      form.field(path.carYear).setValue(null, { emitEvent: false });
      form.field(path.carPrice).setValue(null, { emitEvent: false });
    }
  });
};
```

## Тестирование Behaviors

Для тестирования этих behaviors нужно временно зарегистрировать их в форме. Мы рассмотрим правильную регистрацию в следующем разделе, но пока можете протестировать, добавив их напрямую:

```typescript title="src/schemas/create-form.ts"
import { createForm } from 'reformer';
import { creditApplicationSchema } from './credit-application.schema';
import { step1LoanBehaviors } from '../behaviors/steps/step-1-loan-info.behaviors';

export function createCreditApplicationForm() {
  return createForm({
    schema: creditApplicationSchema,
    behaviors: step1LoanBehaviors, // Временно для тестирования
  });
}
```

### Сценарии тестирования

1. **Расчёт процентной ставки:**
   - Выберите "Потребительский кредит" → Ставка должна быть 15%
   - Выберите "Ипотека" → Ставка должна быть 8.5%
   - Измените город на "Москва" → Ставка должна уменьшиться на 0.5%
   - Отметьте "У меня есть имущество" → Ставка должна уменьшиться на 1.0%

2. **Ежемесячный платёж:**
   - Введите сумму кредита: 1,000,000
   - Введите срок: 120 месяцев (10 лет)
   - Проверьте, что ежемесячный платёж рассчитывается автоматически
   - Измените сумму или срок → Платёж должен пересчитаться

3. **Условные поля:**
   - Выберите "Ипотека" → Появляются поля стоимости недвижимости и первоначального взноса
   - Выберите "Автокредит" → Появляются поля автомобиля, поля ипотеки исчезают
   - Выберите "Потребительский кредит" → Все условные поля исчезают

4. **Сброс полей:**
   - Выберите "Ипотека", заполните стоимость недвижимости
   - Измените на "Автокредит"
   - Вернитесь к "Ипотека"
   - Проверьте, что стоимость недвижимости была очищена

## Результат

Теперь Шаг 1 формы имеет:
- ✅ Автоматический расчёт процентной ставки со скидками
- ✅ Автоматический расчёт ежемесячного платежа
- ✅ Условные поля ипотеки (видны только для ипотеки)
- ✅ Условные поля автокредита (видны только для автокредитов)
- ✅ Автоматическая очистка полей при переключении типов кредита

Форма становится умнее и удобнее для пользователя!

## Ключевые выводы

- `computeFrom` автоматически обрабатывает цепочки вычисляемых полей
- `showWhen` обеспечивает чистую условную видимость
- `watch` предназначен для побочных эффектов, а не для производных значений
- Используйте `{ emitEvent: false }` при программной очистке полей
- Behaviors устраняют необходимость в ручном управлении подписками

## Следующий шаг

Теперь давайте добавим behaviors для Шага 2: Личные данные, где мы вычислим полное имя и возраст из полей личных данных.

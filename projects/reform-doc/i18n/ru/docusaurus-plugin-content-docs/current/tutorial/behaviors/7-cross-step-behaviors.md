---
sidebar_position: 7
---

# Кросс-шаговые Behaviors

Координирование behaviors между несколькими шагами формы.

## Обзор

Некоторые behaviors нуждаются в данных из нескольких шагов. Эти кросс-шаговые behaviors обрабатывают:

1. **Соотношение платёж/доход** - Использует Шаг 1 (платёж) и Шаг 4/5 (доход)
2. **Умная ревалидация** - Запускает валидацию при изменении зависимостей
3. **Контроль доступа по возрасту** - Использует Шаг 2 (возраст) для контроля Шага 1 (поля кредита)
4. **Отслеживание аналитики** - Мониторит поведение пользователя по всей форме

## Почему разделять кросс-шаговые behaviors?

Преимущества разделения:
- **Ясность** - Легко видеть какие behaviors охватывают несколько шагов
- **Поддерживаемость** - Изменения в behaviors шагов не влияют на кросс-шаговую логику
- **Документация** - Кросс-шаговые зависимости явные

## Реализация

```typescript title="src/behaviors/cross-step.behaviors.ts"
import { computeFrom, disableWhen, revalidateWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const crossStepBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Соотношение платёж/доход
  //    Шаг 1: monthlyPayment
  //    Шаг 4: totalIncome
  //    Шаг 5: coBorrowersIncome
  // ==========================================
  computeFrom(
    [path.monthlyPayment, path.totalIncome, path.coBorrowersIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const payment = values.monthlyPayment as number;
      const mainIncome = values.totalIncome as number;
      const coIncome = values.coBorrowersIncome as number;

      const totalHouseholdIncome = (mainIncome || 0) + (coIncome || 0);
      if (!totalHouseholdIncome || !payment) return 0;

      return Math.round((payment / totalHouseholdIncome) * 100);
    }
  );

  // Отключить paymentToIncomeRatio (только для чтения)
  disableWhen(path.paymentToIncomeRatio, path.paymentToIncomeRatio, () => true);

  // ==========================================
  // 2. Ревалидировать платёж при изменении дохода
  //    Валидация проверяет платёж <= 50% дохода
  // ==========================================
  revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);

  // ==========================================
  // 3. Контроль доступа по возрасту
  //    Шаг 2: age
  //    Шаг 1: поля кредита
  // ==========================================
  disableWhen(path.loanAmount, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanTerm, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanPurpose, path.age, (age) => (age as number) < 18);

  // ==========================================
  // 4. Отслеживание аналитики
  // ==========================================
  watch(path.loanAmount, (value) => {
    console.log('Сумма кредита изменена:', value);
    // window.analytics?.track('loan_amount_changed', { amount: value });
  });

  watch(path.interestRate, (value) => {
    console.log('Процентная ставка рассчитана:', value);
    // window.analytics?.track('interest_rate_computed', { rate: value });
  });

  watch(path.employmentStatus, (value) => {
    console.log('Статус занятости изменён:', value);
    // window.analytics?.track('employment_status_changed', { status: value });
  });
};
```

## Разбор каждого behavior

### 1. Соотношение платёж/доход

Это критическая метрика для одобрения кредита:
- **Входные данные**: Ежемесячный платёж, доход заявителя, доход созаёмщиков
- **Выходные данные**: Процент (например, 35% означает что платёж составляет 35% дохода)
- **Использование**: Банки обычно требуют соотношение < 50%

**Цепочка зависимостей:**
```
loanAmount, loanTerm, interestRate
    ↓
monthlyPayment (Шаг 1)
    ↓
paymentToIncomeRatio ← totalIncome (Шаг 4)
                      ← coBorrowersIncome (Шаг 5)
```

### 2. Умная ревалидация

Когда доход изменяется, нам нужно ревалидировать платёж:

```typescript
// Правило валидации (реализуется в разделе Валидация)
createValidator(
  path.monthlyPayment,
  [path.totalIncome, path.coBorrowersIncome],
  (payment, [income, coIncome]) => {
    const total = (income || 0) + (coIncome || 0);
    if (payment > total * 0.5) {
      return { message: 'Платёж превышает 50% дохода' };
    }
    return null;
  }
);

// Behavior: Запустить ревалидацию когда доход изменяется
revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);
```

**Зачем нужно:**
- Пользователь заполняет информацию о кредите первым (Шаг 1)
- Затем заполняет доход (Шаг 4)
- Валидация платежа должна запуститься снова с новыми данными дохода
- Без `revalidateWhen`, валидация запускается только когда платёж изменяется

### 3. Контроль доступа по возрасту

Предотвращает подачу заявки несовершеннолетними:

```typescript
disableWhen(path.loanAmount, path.age, (age) => (age as number) < 18);
```

**Поток:**
1. Пользователь вводит дату рождения (Шаг 2)
2. Возраст вычисляется автоматически
3. Если возраст < 18, поля кредита на Шаге 1 становятся отключены
4. Пользователь не может продолжить с приложением

Это демонстрирует **обратные зависимости** - данные Шага 2 влияют на UI Шага 1.

### 4. Отслеживание аналитики

Мониторьте поведение пользователя для получения информации:

```typescript
watch(path.loanAmount, (value) => {
  // Отслеживаем изменения суммы кредита
  window.analytics?.track('loan_amount_changed', { amount: value });
});
```

**Сценарии использования:**
- Отслеживайте какие типы кредитов самые популярные
- Мониторьте распределение процентных ставок
- Анализируйте точки отказа в форме
- A/B тестирование разных потоков формы

:::tip Аналитика в продакшене
В продакшене, интегрируйте со своей платформой аналитики:
```typescript
import { analytics } from '@/services/analytics';

watch(path.loanAmount, (value) => {
  analytics.track('LoanAmountChanged', {
    amount: value,
    timestamp: Date.now(),
    sessionId: getSessionId(),
  });
});
```
:::

## Полный код

```typescript title="src/behaviors/cross-step.behaviors.ts"
import { computeFrom, disableWhen, revalidateWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const crossStepBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Соотношение платёж/доход
  computeFrom(
    [path.monthlyPayment, path.totalIncome, path.coBorrowersIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const payment = values.monthlyPayment as number;
      const mainIncome = values.totalIncome as number;
      const coIncome = values.coBorrowersIncome as number;

      const totalHouseholdIncome = (mainIncome || 0) + (coIncome || 0);
      if (!totalHouseholdIncome || !payment) return 0;

      return Math.round((payment / totalHouseholdIncome) * 100);
    }
  );

  disableWhen(path.paymentToIncomeRatio, path.paymentToIncomeRatio, () => true);

  // Умная ревалидация
  revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);

  // Контроль доступа по возрасту
  disableWhen(path.loanAmount, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanTerm, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanPurpose, path.age, (age) => (age as number) < 18);

  // Отслеживание аналитики
  watch(path.loanAmount, (value) => {
    console.log('Сумма кредита изменена:', value);
  });

  watch(path.interestRate, (value) => {
    console.log('Процентная ставка рассчитана:', value);
  });

  watch(path.employmentStatus, (value) => {
    console.log('Статус занятости изменён:', value);
  });
};
```

## Отображение кросс-шаговых данных

Показываем соотношение платёж/доход в виджете резюме:

```tsx title="src/components/LoanSummary.tsx"
import { useFormControl } from 'reformer';

function LoanSummary({ control }: Props) {
  const { value: monthlyPayment } = useFormControl(control.monthlyPayment);
  const { value: paymentToIncomeRatio } = useFormControl(control.paymentToIncomeRatio);

  const isAcceptable = paymentToIncomeRatio <= 50;

  return (
    <div className="p-4 bg-gray-50 rounded">
      <h3 className="font-semibold mb-2">Резюме кредита</h3>

      <div className="flex justify-between mb-2">
        <span>Ежемесячный платёж:</span>
        <span className="font-bold">{monthlyPayment.toLocaleString()} ₽</span>
      </div>

      <div className="flex justify-between">
        <span>Платёж к доходу:</span>
        <span className={`font-bold ${isAcceptable ? 'text-green-600' : 'text-red-600'}`}>
          {paymentToIncomeRatio}%
        </span>
      </div>

      {!isAcceptable && (
        <p className="text-sm text-red-600 mt-2">
          Платёж превышает 50% семейного дохода. Рассмотрите:
          - Сокращение суммы кредита
          - Продление срока кредита
          - Добавление созаёмщиков
        </p>
      )}
    </div>
  );
}
```

## Результат

Кросс-шаговые behaviors теперь предоставляют:
- ✅ Расчет соотношения платёж/доход
- ✅ Умная ревалидация при изменении дохода
- ✅ Контроль доступа по возрасту (предотвращает подачу заявок несовершеннолетними)
- ✅ Отслеживание аналитики для получения информации

## Ключевые выводы

- **Разделяйте кросс-шаговые behaviors** для ясности
- **`revalidateWhen`** гарантирует что валидация остаётся актуальной
- **Обратные зависимости** возможны (Шаг 2 → Шаг 1)
- **Аналитика** через `watch` для мониторинга
- **Отображайте кросс-шаговые данные** в резюме/виджетах

## Следующий шаг

Теперь давайте объединим все behaviors и зарегистрируем их с формой в финальном разделе.

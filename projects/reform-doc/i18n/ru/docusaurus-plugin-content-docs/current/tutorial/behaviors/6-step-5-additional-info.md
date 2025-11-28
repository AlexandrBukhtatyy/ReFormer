---
sidebar_position: 6
---

# Шаг 5: Behaviors для дополнительной информации

Управление условными массивами и расчётом доходов созаёмщиков.

## Обзор

Шаг 5 обрабатывает опциональные массивы которые появляются на основе чекбоксов:

1. **Условная видимость** - Показать массивы только когда соответствующие чекбоксы отмечены
2. **Вычисляемое: Доход созаёмщиков** - Сумма доходов всех созаёмщиков

## Реализация

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/additional-info.ts"
import { showWhen, computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, CoBorrower } from '@/types';

export const additionalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Показать массив имущества когда hasProperty === true
  // ==========================================
  showWhen(path.properties, path.hasProperty, (value) => value === true);

  // ==========================================
  // Показать массив существующих кредитов когда hasExistingLoans === true
  // ==========================================
  showWhen(path.existingLoans, path.hasExistingLoans, (value) => value === true);

  // ==========================================
  // Показать массив созаёмщиков когда hasCoBorrower === true
  // ==========================================
  showWhen(path.coBorrowers, path.hasCoBorrower, (value) => value === true);

  // ==========================================
  // Вычисляемое: Общий доход созаёмщиков
  // ==========================================
  computeFrom([path.coBorrowers], path.coBorrowersIncome, (values) => {
    const coBorrowers = (values.coBorrowers as CoBorrower[]) || [];
    return coBorrowers.reduce((sum, cb) => sum + (cb.monthlyIncome || 0), 0);
  });

  // Отключить coBorrowersIncome (только для чтения)
  disableWhen(path.coBorrowersIncome, path.coBorrowersIncome, () => true);
};
```

## Ключевые моменты

**Условные массивы:**

- Массивы скрыты до тех пор пока пользователь не согласится через чекбокс
- Чище UX - пользователь не видит неактуальные секции
- Валидация запускается только на видимых массивах

**Вычисление массивов:**

- Отслеживайте весь массив: `computeFrom([path.coBorrowers], ...)`
- Когда массив изменяется (элементы добавлены/удалены/изменены), сумма пересчитывается
- Используйте `reduce` для суммирования значений из элементов массива

**Сценарий использования:**

- Пользователь отмечает "У меня есть созаёмщики"
- Появляется секция массива с кнопкой "Добавить созаёмщика"
- Пользователь добавляет созаёмщиков
- Общий доход созаёмщиков обновляется автоматически
- Это значение будет использовано в кросс-шаговых behaviors для соотношения платёж/доход

## Результат

Шаг 5 теперь имеет:

- ✅ Условная видимость массивов (имущество, кредиты, созаёмщики)
- ✅ Расчет дохода созаёмщиков
- ✅ Чистый UX с прогрессивным раскрытием информации

## Следующий шаг

Теперь давайте реализуем кросс-шаговые behaviors которые координируют данные между несколькими шагами.

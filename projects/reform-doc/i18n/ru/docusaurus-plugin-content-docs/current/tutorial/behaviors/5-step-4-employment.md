---
sidebar_position: 5
---

# Шаг 4: Behaviors для занятости

Управление полями, специфичными для занятости и расчётом доходов.

## Обзор

Шаг 4 обрабатывает разные статусы занятости с их специфичными полями:

1. **Условная видимость** - Показать поля компании для работающих, поля бизнеса для ИП
2. **Отслеживание и сброс** - Очистить поля при изменении статуса занятости
3. **Вычисляемое: Общий доход** - Сумма основного дохода и дополнительного дохода
4. **Отключение вычисляемого** - Сделать общий доход только для чтения

## Реализация

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/employment.ts"
import { showWhen, watch, computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const employmentBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Показать поля компании для работающих
  // ==========================================
  showWhen(path.companyName, path.employmentStatus, (s) => s === 'employed');
  showWhen(path.companyInn, path.employmentStatus, (s) => s === 'employed');
  showWhen(path.companyPhone, path.employmentStatus, (s) => s === 'employed');
  showWhen(path.companyAddress, path.employmentStatus, (s) => s === 'employed');
  showWhen(path.position, path.employmentStatus, (s) => s === 'employed');
  showWhen(path.workExperienceTotal, path.employmentStatus, (s) => s === 'employed');
  showWhen(path.workExperienceCurrent, path.employmentStatus, (s) => s === 'employed');

  // ==========================================
  // Показать поля бизнеса для ИП
  // ==========================================
  showWhen(path.businessType, path.employmentStatus, (s) => s === 'selfEmployed');
  showWhen(path.businessInn, path.employmentStatus, (s) => s === 'selfEmployed');
  showWhen(path.businessActivity, path.employmentStatus, (s) => s === 'selfEmployed');

  // ==========================================
  // Отслеживание: Очистить поля при изменении статуса
  // ==========================================
  watch(path.employmentStatus, (value, { form }) => {
    // Очистить поля компании если не работающий
    if (value !== 'employed') {
      form.field(path.companyName).setValue('', { emitEvent: false });
      form.field(path.companyInn).setValue('', { emitEvent: false });
      form.field(path.companyPhone).setValue('', { emitEvent: false });
      form.field(path.companyAddress).setValue('', { emitEvent: false });
      form.field(path.position).setValue('', { emitEvent: false });
      form.field(path.workExperienceTotal).setValue(null, { emitEvent: false });
      form.field(path.workExperienceCurrent).setValue(null, { emitEvent: false });
    }

    // Очистить поля бизнеса если не ИП
    if (value !== 'selfEmployed') {
      form.field(path.businessType).setValue('', { emitEvent: false });
      form.field(path.businessInn).setValue('', { emitEvent: false });
      form.field(path.businessActivity).setValue('', { emitEvent: false });
    }
  });

  // ==========================================
  // Вычисляемое: Общий доход
  // ==========================================
  computeFrom([path.monthlyIncome, path.additionalIncome], path.totalIncome, (values) => {
    const main = (values.monthlyIncome as number) || 0;
    const additional = (values.additionalIncome as number) || 0;
    return main + additional;
  });

  // Отключить totalIncome (только для чтения)
  disableWhen(path.totalIncome, path.totalIncome, () => true);
};
```

## Ключевые моменты

**Несколько условных полей:**

- Группируйте связанные поля по условию (работающий vs ИП)
- Используйте `showWhen` для каждого поля отдельно
- Поля скрываются/показываются вместе при изменении статуса

**Паттерн сброса полей:**

- Очищайте значения при переключении типов занятости
- Предотвращайте устаревшие данные (например, название компании для ИП)
- Используйте `{ emitEvent: false }` чтобы избежать запуска валидаций

**Общий доход:**

- Простая сумма двух источников дохода
- Обрабатывает отсутствующие значения (`|| 0`)
- Обновляется автоматически когда изменяется любой из доходов

## Результат

Шаг 4 теперь имеет:

- ✅ Поля специфичные для занятости (компания/бизнес)
- ✅ Автоматический сброс полей при изменении статуса
- ✅ Расчет общего дохода
- ✅ Чистый условный UI

## Следующий шаг

Давайте добавим behaviors для Шага 5: Дополнительная информация, обработка массивов и созаёмщиков.

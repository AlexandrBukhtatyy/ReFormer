---
sidebar_position: 8
---

# Объединение и регистрация Behaviors

Сборка всех behaviors и интеграция с формой.

## Обзор

Мы создали behaviors для каждого шага плюс кросс-шаговые behaviors. Теперь давайте:

1. Создадим главный файл behavior который объединяет всё
2. Зарегистрируем behaviors с формой
3. Протестируем что все behaviors работают вместе
4. Посмотрим полную структуру файлов

## Создание главного файла Behavior

Создадим главный файл behavior который импортирует и применяет все behaviors шагов:

```bash
touch reformer-tutorial/src/forms/credit-application/schemas/behaviors/credit-application.behaviors.ts
```

### Реализация

```typescript title="reformer-tutorial/src/forms/credit-application/schemas/behaviors/credit-application.behaviors.ts"
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

// Импортируем behaviors шагов
import { loanBehaviorSchema } from './steps/step-1-loan-info.behaviors';
import { personalBehaviorSchema } from './steps/step-2-personal-info.behaviors';
import { contactBehaviorSchema } from './steps/step-3-contact-info.behaviors';
import { employmentBehaviorSchema } from './steps/step-4-employment.behaviors';
import { additionalBehaviorSchema } from './steps/step-5-additional-info.behaviors';
import { crossStepBehaviorsSchema } from './cross-step.behaviors';

/**
 * Полная схема behaviors для формы Кредитной заявки
 *
 * Организована по шагам формы для удобства поддержки:
 * - Шаг 1: Информация о кредите
 * - Шаг 2: Личные данные
 * - Шаг 3: Контактная информация
 * - Шаг 4: Занятость
 * - Шаг 5: Дополнительная информация
 * - Кросс-шаговые: Behaviors охватывающие несколько шагов
 */
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Шаг 1: Информация о кредите
  // ==========================================
  loanBehaviorSchema(path);

  // ==========================================
  // Шаг 2: Личные данные
  // ==========================================
  personalBehaviorSchema(path);

  // ==========================================
  // Шаг 3: Контактная информация
  // ==========================================
  contactBehaviorSchema(path);

  // ==========================================
  // Шаг 4: Занятость
  // ==========================================
  employmentBehaviorSchema(path);

  // ==========================================
  // Шаг 5: Дополнительная информация
  // ==========================================
  additionalBehaviorSchema(path);

  // ==========================================
  // Кросс-шаговые Behaviors
  // ==========================================
  crossStepBehaviorsSchema(path);
};
```

## Регистрация с формой

Обновляем функцию создания формы чтобы включить behaviors:

```typescript title="src/schemas/create-form.ts"
import { createForm } from 'reformer';
import { creditApplicationSchema } from './credit-application.schema';
import { creditApplicationBehaviors } from '../behaviors/credit-application.behaviors';
import type { CreditApplicationForm } from '@/types';

export function createCreditApplicationForm() {
  return createForm<CreditApplicationForm>({
    schema: creditApplicationSchema,
    behaviors: creditApplicationBehaviors, // ← Регистрируем behaviors здесь
    // валидация будет добавлена в следующем разделе
  });
}
```

Вот и всё! Behaviors теперь активны при создании формы.

## Тестирование всех Behaviors

Создадим полный чек-лист тестирования:

### Шаг 1: Информация о кредите

- [ ] Процентная ставка обновляется при изменении типа кредита
- [ ] Процентная ставка получает скидку для крупных городов
- [ ] Процентная ставка получает скидку для владельцев имущества
- [ ] Ежемесячный платёж рассчитывается автоматически
- [ ] Поля ипотеки показываются только для ипотеки
- [ ] Поля авто показываются только для автокредитов
- [ ] Поля очищаются при переключении типов кредитов

### Шаг 2: Личные данные

- [ ] Полное имя генерируется из имени, фамилии, отчества
- [ ] Возраст рассчитывается из даты рождения
- [ ] Оба вычисляемых поля отключены

### Шаг 3: Контактная информация

- [ ] Адрес проживания скрывается когда отмечено "совпадает с регистрацией"
- [ ] Адрес регистрации копируется в адрес проживания
- [ ] Адрес проживания отключается когда совпадает с регистрацией
- [ ] Ручные изменения адреса проживания работают когда снят флажок

### Шаг 4: Занятость

- [ ] Поля компании показываются только для работающих
- [ ] Поля бизнеса показываются только для ИП
- [ ] Поля очищаются при переключении статуса занятости
- [ ] Общий доход рассчитывается из основного + дополнительного

### Шаг 5: Дополнительная информация

- [ ] Массив имущества показывается только когда отмечен чекбокс
- [ ] Массив существующих кредитов показывается только когда отмечен чекбокс
- [ ] Массив созаёмщиков показывается только когда отмечен чекбокс
- [ ] Доход созаёмщиков суммирует доходы всех созаёмщиков

### Кросс-шаговые

- [ ] Соотношение платёж/доход рассчитывается правильно
- [ ] Поля кредита отключаются когда возраст < 18
- [ ] Ежемесячный платёж ревалидируется при изменении дохода
- [ ] Логи аналитики показываются в консоли

## Отладка Behaviors

Если behaviors не работают как ожидается:

### 1. Проверяем консоль на ошибки

```typescript
// Добавляем логирование отладки к behaviors
export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  console.log('Регистрируем behaviors Шага 1');

  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      console.log('Вычисляем ежемесячный платёж:', values);
      // ... вычисление
    }
  );
};
```

### 2. Проверяем пути к полям

Неправильные пути к полям приводят к молчаливому отказу behaviors:

```typescript
// ❌ Неправильно - опечатка в имени поля
computeFrom([path.loanAmmount], ...);

// ✅ Правильно
computeFrom([path.loanAmount], ...);
```

### 3. Проверяем регистрацию формы

Убедитесь что behaviors переданы в `createForm`:

```typescript
// ❌ Забыли добавить behaviors
createForm({
  schema: creditApplicationSchema,
});

// ✅ Behaviors зарегистрированы
createForm({
  schema: creditApplicationSchema,
  behaviors: creditApplicationBehaviors,
});
```

### 4. Проверяем интеграцию компонента

Убедитесь что вы используете форму с behaviors:

```tsx
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []); // ← Использует behaviors

  return <FormField control={form.monthlyPayment} />;
}
```

## Соображения о производительности

Behaviors оптимизированы ReFormer, но имейте в виду:

### 1. Избегайте дорогостоящих вычислений

```typescript
// ❌ Плохо - сложное вычисление при каждом изменении
computeFrom([path.data], path.result, (values) => {
  return expensiveCalculation(values.data); // Запускается при каждом изменении
});

// ✅ Лучше - debounce или memoize дорогостоящие операции
computeFrom([path.data], path.result, (values) => {
  return memoizedExpensiveCalculation(values.data);
});
```

### 2. Минимизируйте побочные эффекты Watch

```typescript
// ❌ Плохо - тяжёлый побочный эффект при каждом изменении
watch(path.field, (value) => {
  makeAPICall(value); // Запускается на каждый щелчок!
});

// ✅ Лучше - debounce API вызовов
watch(
  path.field,
  debounce((value) => {
    makeAPICall(value);
  }, 500)
);
```

### 3. Не создавайте циклические зависимости

```typescript
// ❌ Плохо - циклическая зависимость
computeFrom([path.a], path.b, ...);
computeFrom([path.b], path.a, ...); // Бесконечный цикл!

// ✅ Хорошо - одностороннее зависимости
computeFrom([path.a, path.b], path.c, ...);
```

## Резюме

Мы успешно реализовали все behaviors для формы Кредитной заявки:

### Шаг 1: Информация о кредите

- ✅ Расчет процентной ставки (базовая + скидки)
- ✅ Расчет ежемесячного платежа (формула аннуитета)
- ✅ Условные поля ипотеки/авто
- ✅ Автоматический сброс полей

### Шаг 2: Личные данные

- ✅ Генерирование полного имени (формат ФИО)
- ✅ Расчет возраста из даты рождения

### Шаг 3: Контактная информация

- ✅ Копирование адреса (регистрация → проживание)
- ✅ Условная видимость/доступ

### Шаг 4: Занятость

- ✅ Поля специфичные для занятости
- ✅ Расчет общего дохода
- ✅ Сброс полей при изменении статуса

### Шаг 5: Дополнительная информация

- ✅ Условные массивы (имущество, кредиты, созаёмщики)
- ✅ Расчет дохода созаёмщиков

### Кросс-шаговые

- ✅ Соотношение платёж/доход
- ✅ Умная ревалидация
- ✅ Контроль доступа по возрасту
- ✅ Отслеживание аналитики

## Ключевые достижения

1. **Декларативная логика** - Нет ручных подписок, чистый код
2. **Организованная структура** - Легко найти и изменить behaviors
3. **Типобезопасность** - Полная поддержка TypeScript
4. **Поддерживаемость** - Изменения локализованы в специфичных файлах
5. **Тестируемость** - Каждый behavior может быть протестирован независимо

## Что дальше?

Форма теперь имеет сложную интерактивность, но ей ещё нужна валидация чтобы гарантировать качество данных. В следующем разделе (**Валидация**) мы добавим:

- Встроенные валидаторы (required, min, max, email и т.д.)
- Условную валидацию (правила которые зависят от других полей)
- Кросс-полевую валидацию (платёж <= 50% дохода)
- Асинхронную валидацию (проверки на стороне сервера)
- Валидацию массивов (имущество, кредиты, созаёмщики)

Behaviors которые мы создали будут работать бесперебойно с правилами валидации!

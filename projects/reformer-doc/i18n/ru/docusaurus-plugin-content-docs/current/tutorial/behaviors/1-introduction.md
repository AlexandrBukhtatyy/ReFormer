---
sidebar_position: 1
---

# Введение в Behaviors

Добавляем интерактивность и автоматизацию в форму кредитной заявки.

## Что такое Behaviors?

Behaviors автоматизируют типовые взаимодействия в форме без ручных подписок и императивного кода. Они предоставляют декларативный способ для:

- **Вычисления значений** - Автоматический расчёт полей на основе других полей
- **Управления видимостью** - Показ/скрытие полей по условиям
- **Управления доступом** - Динамическое включение/отключение полей
- **Синхронизации данных** - Копирование значений между полями
- **Реакции на изменения** - Выполнение побочных эффектов при изменении полей

## Зачем использовать Behaviors?

Вместо императивного кода с подписками:

```tsx
// ❌ Императивный подход - ручные подписки
function CreditApplicationForm() {
  const form = useMemo(() => createForm(...), []);

  useEffect(() => {
    // Вручную подписываемся на изменения loanType
    const subscription = form.field('loanType').value.subscribe((value) => {
      // Показываем/скрываем поля ипотеки
      if (value === 'mortgage') {
        form.field('propertyValue').setVisible(true);
        form.field('initialPayment').setVisible(true);
      } else {
        form.field('propertyValue').setVisible(false);
        form.field('initialPayment').setVisible(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // Ещё подписки...
  // Это быстро становится неуправляемым!
}
```

Используйте декларативные behaviors:

```tsx
// ✅ Декларативный подход - behaviors
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Показываем поля ипотеки только когда loanType === 'mortgage'
  enableWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');
  enableWhen(path.initialPayment, path.loanType, (value) => value === 'mortgage');
};
```

Преимущества:

- **Меньше кода** - Нет ручных подписок и очистки
- **Декларативность** - Легче понять намерение
- **Поддерживаемость** - Изменения локализованы
- **Типобезопасность** - Полная поддержка TypeScript
- **Тестируемость** - Легко тестировать изолированно

## Типы Behaviors

ReFormer предоставляет несколько встроенных функций для behaviors:

### Вычисляемые поля

Автоматически рассчитывают значения полей на основе других:

```typescript
import { computeFrom } from '@reformer/core/behaviors';

// Вычисляем общий доход
computeFrom([path.monthlyIncome, path.additionalIncome], path.totalIncome, (values) => {
  const main = (values.monthlyIncome as number) || 0;
  const additional = (values.additionalIncome as number) || 0;
  return main + additional;
});
```

### Условная видимость

Показывают или скрывают поля по условиям:

```typescript
import { enableWhen, disableWhen } from '@reformer/core/behaviors';

// Показываем поля ипотеки только для ипотечных кредитов
enableWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');

// Скрываем адрес проживания когда совпадает с регистрацией
disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);
```

### Условный доступ

Включают или отключают поля по условиям:

```typescript
import { enableWhen, disableWhen } from '@reformer/core/behaviors';

// Отключаем адрес проживания когда совпадает с регистрацией
disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);

// Отключаем вычисляемые поля (всегда только для чтения)
disableWhen(path.totalIncome, path.totalIncome, () => true);
```

### Синхронизация данных

Копируют или синхронизируют значения между полями:

```typescript
import { copyTo, syncWith } from '@reformer/core/behaviors';

// Копируем адрес регистрации в адрес проживания
copyTo(
  path.registrationAddress,
  path.residenceAddress,
  path.sameAsRegistration,
  (shouldCopy) => shouldCopy === true
);
```

### Реакции и побочные эффекты

Реагируют на изменения полей с пользовательской логикой:

```typescript
import { watch } from '@reformer/core/behaviors';

// Очищаем поля ипотеки при смене типа кредита
watch(path.loanType, (value, { form }) => {
  if (value !== 'mortgage') {
    form.field(path.propertyValue).setValue(null);
    form.field(path.initialPayment).setValue(null);
  }
});
```

### Ревалидация

Запускают валидацию при изменении связанных полей:

```typescript
import { revalidateWhen } from '@reformer/core/behaviors';

// Ревалидируем ежемесячный платёж при изменении дохода
revalidateWhen(path.monthlyPayment, [path.totalIncome]);
```

## Организация Behaviors по шагам

Для нашей формы кредитной заявки мы организуем behaviors по шагам формы - как мы делали в разделе Rendering:

```typescript
// src/schemas/behaviors/credit-application.behaviors.ts
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Шаг 1: Информация о кредите
  loanBehaviorSchema(path);

  // Шаг 2: Личные данные
  personalBehaviorSchema(path);

  // Шаг 3: Контактная информация
  contactBehaviorSchema(path);

  // Шаг 4: Занятость
  employmentBehaviorSchema(path);

  // Шаг 5: Дополнительная информация
  additionalBehaviorSchema(path);

  // Кросс-шаговые behaviors
  crossStepBehaviorsSchema(path);
};
```

Эта организация обеспечивает:

- **Ясность** - Легко найти behaviors для конкретного шага
- **Поддерживаемость** - Изменения в одном шаге не влияют на другие
- **Масштабируемость** - Легко добавлять новые behaviors
- **Переиспользуемость** - Behaviors шагов можно использовать в других формах

## Начинаем

Давайте начнём с добавления behaviors к Шагу 1: Информация о кредите. Этот шаг демонстрирует наиболее распространённые паттерны behaviors, которые вы будете использовать во всей форме.

В следующем разделе мы:

1. Создадим файл behaviors для Шага 1
2. Реализуем вычисляемые поля для процентной ставки и ежемесячного платежа
3. Добавим условную видимость для полей ипотеки/авто
4. Реализуем автоматический сброс полей
5. Протестируем behaviors в действии

Готовы? Начинаем!

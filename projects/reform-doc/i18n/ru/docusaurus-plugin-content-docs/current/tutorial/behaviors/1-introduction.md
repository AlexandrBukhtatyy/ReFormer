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
  showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');
  showWhen(path.initialPayment, path.loanType, (value) => value === 'mortgage');
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
import { computeFrom } from 'reformer/behaviors';

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
import { showWhen, hideWhen } from 'reformer/behaviors';

// Показываем поля ипотеки только для ипотечных кредитов
showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');

// Скрываем адрес проживания когда совпадает с регистрацией
hideWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);
```

### Условный доступ

Включают или отключают поля по условиям:

```typescript
import { enableWhen, disableWhen } from 'reformer/behaviors';

// Отключаем адрес проживания когда совпадает с регистрацией
disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);

// Отключаем вычисляемые поля (всегда только для чтения)
disableWhen(path.totalIncome, path.totalIncome, () => true);
```

### Синхронизация данных

Копируют или синхронизируют значения между полями:

```typescript
import { copyTo, syncWith } from 'reformer/behaviors';

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
import { watch } from 'reformer/behaviors';

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
import { revalidateWhen } from 'reformer/behaviors';

// Ревалидируем ежемесячный платёж при изменении дохода
revalidateWhen(path.monthlyPayment, [path.totalIncome]);
```

## Организация Behaviors по шагам

Для нашей формы кредитной заявки мы организуем behaviors по шагам формы - как мы делали в разделе Rendering:

```typescript
// src/schemas/behaviors/credit-application.behaviors.ts
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Шаг 1: Информация о кредите
  step1LoanBehaviors(path);

  // Шаг 2: Личные данные
  step2PersonalBehaviors(path);

  // Шаг 3: Контактная информация
  step3ContactBehaviors(path);

  // Шаг 4: Занятость
  step4EmploymentBehaviors(path);

  // Шаг 5: Дополнительная информация
  step5AdditionalBehaviors(path);

  // Кросс-шаговые behaviors
  crossStepBehaviors(path);
};
```

Эта организация обеспечивает:

- **Ясность** - Легко найти behaviors для конкретного шага
- **Поддерживаемость** - Изменения в одном шаге не влияют на другие
- **Масштабируемость** - Легко добавлять новые behaviors
- **Переиспользуемость** - Behaviors шагов можно использовать в других формах

## Структура файлов

Мы создадим следующую структуру:

```
src/
├── schemas/
│   ├── behaviors/
│   │   ├── steps/
│   │   │   ├── step-1-loan-info.behaviors.ts
│   │   │   ├── step-2-personal-info.behaviors.ts
│   │   │   ├── step-3-contact-info.behaviors.ts
│   │   │   ├── step-4-employment.behaviors.ts
│   │   │   └── step-5-additional-info.behaviors.ts
│   │   ├── cross-step.behaviors.ts
│   │   └── credit-application.behaviors.ts  (главный файл)
│   └── create-form.ts  (behaviors регистрируются здесь)
└── ...
```

## Что мы реализуем

К концу этого раздела наша форма кредитной заявки будет иметь:

### Шаг 1: Информация о кредите

- ✅ Автоматический расчёт процентной ставки (на основе типа кредита, города, имущества)
- ✅ Автоматический расчёт ежемесячного платежа (формула аннуитета)
- ✅ Условные поля ипотеки/авто (показываются только когда актуально)
- ✅ Автоматический сброс полей (при смене типа кредита)

### Шаг 2: Личные данные

- ✅ Автогенерация полного имени (из имени, фамилии, отчества)
- ✅ Автоматический расчёт возраста (из даты рождения)
- ✅ Только для чтения вычисляемые поля

### Шаг 3: Контактная информация

- ✅ Условный адрес проживания (скрыт когда совпадает с регистрацией)
- ✅ Автоматическое копирование адреса (регистрация → проживание)
- ✅ Отключённые поля когда не нужны

### Шаг 4: Занятость

- ✅ Условные поля занятости (показываются на основе статуса)
- ✅ Автоматический расчёт общего дохода (основной + дополнительный)
- ✅ Автоматический сброс полей (при смене статуса)

### Шаг 5: Дополнительная информация

- ✅ Условные массивы (имущество, кредиты, созаёмщики)
- ✅ Автоматический расчёт дохода созаёмщиков (сумма всех)

### Кросс-шаговые

- ✅ Соотношение платёж/доход (использует данные из нескольких шагов)
- ✅ Умная ревалидация (запускается при изменении зависимостей)
- ✅ Контроль доступа по возрасту (отключает поля если возраст < 18)
- ✅ Отслеживание аналитики (мониторит поведение пользователя)

## Начинаем

Давайте начнём с добавления behaviors к Шагу 1: Информация о кредите. Этот шаг демонстрирует наиболее распространённые паттерны behaviors, которые вы будете использовать во всей форме.

В следующем разделе мы:

1. Создадим файл behaviors для Шага 1
2. Реализуем вычисляемые поля для процентной ставки и ежемесячного платежа
3. Добавим условную видимость для полей ипотеки/авто
4. Реализуем автоматический сброс полей
5. Протестируем behaviors в действии

Готовы? Начинаем!

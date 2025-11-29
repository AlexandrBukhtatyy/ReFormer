---
sidebar_position: 3
---

# Шаг 2: Behaviors для личных данных

Автогенерация полного имени и расчет возраста из личных данных.

## Обзор

Для Шага 2 (Личные данные) нам нужны behaviors, которые работают с полями из группы `personalData`:

1. **Вычисляемое: Полное имя** - Генерирование из имени, фамилии и отчества (формат ФИО)
2. **Вычисляемое: Возраст** - Расчет из даты рождения
3. **Отключение: Вычисляемые поля** - Сделать их только для чтения

Эти вычисляемые поля будут отображаться в других частях формы и использоваться в логике валидации/отправки.

## Создание файла Behavior

Создадим файл behavior для Шага 2:

```bash
touch reform-tutorial/src/forms/credit-application/schemas/behaviors/personal-info.ts
```

## Реализация Behaviors

### 1. Вычисление полного имени

В русских формах полное имя (ФИО) обычно форматируется как: **Фамилия Имя Отчество**.

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/personal-info.ts"
import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

export const personalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Вычисляемое поле: Полное имя (ФИО)
  // Подписываемся только на поля, от которых зависит ФИО
  // ==========================================
  computeFrom<any, string>(
    [path.personalData.lastName, path.personalData.firstName, path.personalData.middleName],
    path.fullName,
    (values: { lastName: string; firstName: string; middleName: string }) => {
      // Формат: Фамилия Имя Отчество
      // Фильтруем пустые значения
      const parts = [values.lastName, values.firstName, values.middleName].filter(Boolean);
      return parts.join(' ');
    }
  );

  // ... ещё behaviors
};
```

**Как это работает:**

- Мы подписываемся только на конкретные поля (`lastName`, `firstName`, `middleName`)
- Когда любое из этих полей изменяется, полное имя пересчитывается
- Объект `values` содержит текущие значения всех отслеживаемых полей
- Пустые значения фильтруются (например, если отчество опционально)
- Результат - это чистое, правильно отформатированное полное имя

:::tip Точечная подписка vs группа
Рекомендуется подписываться на конкретные поля для оптимизации:

```typescript
// ✅ Подписываемся только на нужные поля (рекомендуется)
computeFrom([path.personalData.firstName, path.personalData.lastName, ...], ...)

// ⚠️ Подписка на группу - менее оптимально
computeFrom([path.personalData], ...)
```

Точечная подписка обеспечивает пересчёт только при изменении релевантных полей.
:::

### 2. Расчет возраста

Рассчитываем возраст заявителя из его даты рождения:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/personal-info.ts"
export const personalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // 2. Вычисляемое поле: Возраст
  // Подписываемся только на дату рождения
  // ==========================================
  computeFrom<any, number | null>(
    [path.personalData.birthDate],
    path.age,
    (values: { birthDate: string }) => {
      const birthDate = values.birthDate;
      if (!birthDate) return null;

      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age;
    }
  );

  // ... ещё behaviors
};
```

**Обработанные граничные случаи:**

- Возвращает `null` если дата рождения не установлена
- Правильно обрабатывает дни рождения, которые ещё не наступили в этом году
- Учитывает различия в месяцах и днях

:::info Логика расчета возраста
Расчет возраста проверяет:

1. Разницу в годах (например, 2025 - 1990 = 35)
2. Если день рождения ещё не наступил в этом году, вычитаем 1
   - Проверка месяца: Текущий месяц < месяц рождения → день рождения ещё не наступил
   - Проверка дня: Одинаковый месяц, но текущий день < день рождения → день рождения ещё не наступил

:::

### 3. Сделать вычисляемые поля только для чтения

Поскольку `fullName` и `age` вычисляются автоматически, они должны быть только для чтения (отключены):

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/personal-info.ts"
export const personalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // 3. Отключить вычисляемые поля (только для чтения)
  // ==========================================
  disableWhen(path.fullName, () => true);
  disableWhen(path.age, () => true);
};
```

**Сигнатура `disableWhen(target, condition)`:**

- Первый аргумент: поле для отключения
- Второй аргумент: функция условия (возвращает `true` → поле отключено)

Условие `() => true` означает, что поле всегда будет отключено, независимо от состояния формы.

:::tip Альтернатива: отключение на уровне схемы
Вы также можете отключить поля в схеме:

```typescript
fullName: {
  value: '',
  component: Input,
  componentProps: {
    label: 'Full Name',
    disabled: true, // ← Всегда отключено
  },
},
```

Однако использование `disableWhen` держит все behaviors централизованными и облегчает их поиск и изменение.
:::

## Полный код

Вот полный файл behavior для Шага 2:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/personal-info.ts"
import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

export const personalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Вычисляемое поле: Полное имя (ФИО)
  // Подписываемся только на поля, от которых зависит ФИО
  // ==========================================
  computeFrom<any, string>(
    [path.personalData.lastName, path.personalData.firstName, path.personalData.middleName],
    path.fullName,
    (values: { lastName: string; firstName: string; middleName: string }) => {
      const parts = [values.lastName, values.firstName, values.middleName].filter(Boolean);
      return parts.join(' ');
    }
  );

  // ==========================================
  // 2. Вычисляемое поле: Возраст
  // Подписываемся только на дату рождения
  // ==========================================
  computeFrom<any, number | null>(
    [path.personalData.birthDate],
    path.age,
    (values: { birthDate: string }) => {
      const birthDate = values.birthDate;
      if (!birthDate) return null;

      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age;
    }
  );

  // ==========================================
  // 3. Отключить вычисляемые поля (только для чтения)
  // ==========================================
  disableWhen(path.fullName, () => true);
  disableWhen(path.age, () => true);
};
```

## Тестирование Behaviors

Добавьте behaviors Шага 2 в вашу форму. В файле `credit-application.behaviors.ts` импортируйте и вызовите схему:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/credit-application.behaviors.ts"
import { loanBehaviorSchema } from './loan-info';
import { personalBehaviorSchema } from './personal-info';
import type { BehaviorSchemaFn } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  loanBehaviorSchema(path);
  personalBehaviorSchema(path); // ← Добавляем Шаг 2
};
```

Затем используйте в создании формы:

```typescript title="reform-tutorial/src/forms/credit-application/createCreditApplicationForm.ts"
import { createForm } from 'reformer';
import { creditApplicationSchema } from './schemas/credit-application';
import { creditApplicationBehaviors } from './schemas/behaviors/credit-application.behaviors';
import type { CreditApplicationForm } from './types/credit-application.types';

export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>({
    form: creditApplicationSchema,
    behavior: creditApplicationBehaviors,
  });
};
```

### Сценарии тестирования

1. **Генерация полного имени:**
   - Введите имя: "Иван"
   - Введите фамилию: "Петров"
   - Введите отчество: "Сергеевич"
   - Проверьте, что поле `fullName` показывает: "Петров Иван Сергеевич"
   - Оставьте отчество пустым → Полное имя должно быть "Петров Иван"

2. **Расчет возраста:**
   - Введите дату рождения: "1990-05-15"
   - Проверьте, что поле `age` рассчитывается правильно
   - Попробуйте разные даты (до/после дня рождения в этом году)
   - Проверьте, что возраст обновляется при изменении даты рождения

3. **Поля только для чтения:**
   - Попробуйте нажать на поле `fullName` → Должно быть отключено
   - Попробуйте нажать на поле `age` → Должно быть отключено
   - Поля должны иметь визуальное состояние отключено/только для чтения

## Отображение вычисляемых полей

Эти вычисляемые поля могут быть отображены в любой части вашей формы. Например, вы можете показать их в резюме:

```tsx title="reform-tutorial/src/forms/credit-application/components/ApplicantSummary.tsx"
import { useFormControl } from 'reformer';

function ApplicantSummary({ control }: Props) {
  const { value: fullName } = useFormControl(control.fullName);
  const { value: age } = useFormControl(control.age);

  return (
    <div className="p-4 bg-gray-50 rounded">
      <h3 className="font-semibold mb-2">Информация о заявителе</h3>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-gray-600">Полное имя:</span>
          <span className="ml-2 font-medium">{fullName || '—'}</span>
        </div>
        <div>
          <span className="text-gray-600">Возраст:</span>
          <span className="ml-2 font-medium">{age ? `${age} лет` : '—'}</span>
        </div>
      </div>
    </div>
  );
}
```

Или как поля только для чтения в форме:

```tsx title="reform-tutorial/src/forms/credit-application/steps/PersonalInfoForm.tsx"
<FormField control={control.personalData.firstName} />
<FormField control={control.personalData.lastName} />
<FormField control={control.personalData.middleName} />
<FormField control={control.personalData.birthDate} />

{/* Вычисляемые поля показаны как только для чтения */}
<div className="grid grid-cols-2 gap-4 mt-4">
  <FormField control={control.fullName} />
  <FormField control={control.age} />
</div>
```

## Результат

Теперь Шаг 2 формы имеет:

- ✅ Автогенерированное полное имя в формате ФИО
- ✅ Автоматический расчет возраста с правильной обработкой дня рождения
- ✅ Отображение вычисляемых полей только для чтения

Эти вычисленные значения будут полезны для:

- **Отображения** - Показ информации о заявителе в резюме
- **Валидации** - Правила валидации на основе возраста (например, должен быть 18+)
- **Кросс-шаговых behaviors** - Контроль доступа на основе возраста
- **Отправки** - Включение полного имени в payload API

## Ключевые выводы

- Подписывайтесь на конкретные поля для оптимизации: `computeFrom([path.personalData.firstName, ...], ...)`
- Обрабатывайте граничные случаи в расчетах дат (дни рождения, которые ещё не наступили)
- Используйте `disableWhen(target, () => true)` для всегда отключённых полей
- Вычисляемые поля могут быть отображены в любой части формы
- Централизуйте behaviors для удобства поддержки

## Следующий шаг

Теперь давайте добавим behaviors для Шага 3: Контактная информация, где мы реализуем копирование адреса и условную видимость для адреса проживания.

---
sidebar_position: 3
---

# Шаг 2: Behaviors для личных данных

Автогенерация полного имени и расчет возраста из личных данных.

## Обзор

Для Шага 2 (Личные данные) нам нужны более простые behaviors, которые получают значения из группы `personalData`:

1. **Вычисляемое: Полное имя** - Генерирование из имени, фамилии и отчества (формат ФИО)
2. **Вычисляемое: Возраст** - Расчет из даты рождения
3. **Отключение: Вычисляемые поля** - Сделать их только для чтения

Эти вычисляемые поля будут отображаться в других частях формы и использоваться в логике валидации/отправки.

## Создание файла Behavior

Создадим файл behavior для Шага 2:

```bash
touch src/schemas/behaviors/steps/step-2-personal-info.behaviors.ts
```

## Реализация Behaviors

### 1. Вычисление полного имени

В русских формах полное имя (ФИО) обычно форматируется как: **Фамилия Имя Отчество**.

```typescript title="src/schemas/behaviors/steps/step-2-personal-info.behaviors.ts"
import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, PersonalData } from '@/types';

export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Вычисляемое: Полное имя (ФИО)
  // ==========================================
  computeFrom(
    [path.personalData],
    path.fullName,
    (values) => {
      const pd = values.personalData as PersonalData;
      if (!pd) return '';

      // Формат: Фамилия Имя Отчество
      // Фильтруем пустые значения
      const parts = [pd.lastName, pd.firstName, pd.middleName].filter(Boolean);

      return parts.join(' ');
    }
  );

  // ... ещё behaviors
};
```

**Как это работает:**
- Мы отслеживаем всю группу `personalData` (а не отдельные поля)
- Когда любое поле в `personalData` изменяется, полное имя обновляется
- Пустые значения фильтруются (например, если отчество опционально)
- Результат - это чистое, правильно отформатированное полное имя

:::tip Отслеживание групп
Вы можете отслеживать целые группы вместо отдельных полей:
```typescript
// ✅ Отслеживаем всю группу
computeFrom([path.personalData], ...)

// ❌ Отслеживаем отдельные поля (более подробный код)
computeFrom([path.personalData.firstName, path.personalData.lastName, ...], ...)
```
Оба варианта работают, но отслеживание групп проще, когда нужны все поля.
:::

### 2. Расчет возраста

Рассчитываем возраст заявителя из его даты рождения:

```typescript title="src/schemas/behaviors/steps/step-2-personal-info.behaviors.ts"
export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // Вычисляемое: Возраст
  // ==========================================
  computeFrom(
    [path.personalData],
    path.age,
    (values) => {
      const birthDate = (values.personalData as PersonalData)?.birthDate;
      if (!birthDate) return null;

      const today = new Date();
      const birth = new Date(birthDate);

      // Рассчитываем разницу в годах
      let age = today.getFullYear() - birth.getFullYear();

      // Корректируем если день рождения не наступил в этом году
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

```typescript title="src/schemas/behaviors/steps/step-2-personal-info.behaviors.ts"
export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущие behaviors

  // ==========================================
  // Отключить вычисляемые поля (всегда только для чтения)
  // ==========================================
  disableWhen(path.fullName, path.fullName, () => true);
  disableWhen(path.age, path.age, () => true);
};
```

**Зачем `disableWhen(path.fullName, path.fullName, () => true)`?**
- Первый аргумент: поле для отключения
- Второй аргумент: поле для отслеживания (отслеживаем само себя)
- Третий аргумент: условие (всегда `true` означает всегда отключено)

Этот паттерн гарантирует, что поле всегда будет отключено, независимо от состояния формы.

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

```typescript title="src/schemas/behaviors/steps/step-2-personal-info.behaviors.ts"
import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, PersonalData } from '@/types';

export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Вычисляемое: Полное имя (ФИО)
  // ==========================================
  computeFrom(
    [path.personalData],
    path.fullName,
    (values) => {
      const pd = values.personalData as PersonalData;
      if (!pd) return '';

      const parts = [pd.lastName, pd.firstName, pd.middleName].filter(Boolean);
      return parts.join(' ');
    }
  );

  // ==========================================
  // Вычисляемое: Возраст
  // ==========================================
  computeFrom(
    [path.personalData],
    path.age,
    (values) => {
      const birthDate = (values.personalData as PersonalData)?.birthDate;
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
  // Отключить вычисляемые поля
  // ==========================================
  disableWhen(path.fullName, path.fullName, () => true);
  disableWhen(path.age, path.age, () => true);
};
```

## Тестирование Behaviors

Добавьте behaviors Шага 2 в вашу форму временно:

```typescript title="src/schemas/create-form.ts"
import { step1LoanBehaviors } from '../behaviors/steps/step-1-loan-info.behaviors';
import { step2PersonalBehaviors } from '../behaviors/steps/step-2-personal-info.behaviors';

export function createCreditApplicationForm() {
  return createForm({
    schema: creditApplicationSchema,
    behaviors: (path) => {
      step1LoanBehaviors(path);
      step2PersonalBehaviors(path); // ← Добавляем Шаг 2
    },
  });
}
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

```tsx title="src/components/ApplicantSummary.tsx"
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

```tsx title="src/steps/PersonalInfoStep.tsx"
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

- Отслеживайте целые группы, когда нужны все поля: `computeFrom([path.personalData], ...)`
- Обрабатывайте граничные случаи в расчетах дат (дни рождения, которые ещё не наступили)
- Используйте `disableWhen(..., ..., () => true)` для всегда отключённых полей
- Вычисляемые поля могут быть отображены в любой части формы
- Централизуйте behaviors для удобства поддержки

## Следующий шаг

Теперь давайте добавим behaviors для Шага 3: Контактная информация, где мы реализуем копирование адреса и условную видимость для адреса проживания.

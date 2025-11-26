---
sidebar_position: 4
---

# Шаг 3: Behaviors для контактной информации

Управление синхронизацией адреса и условной видимостью.

## Обзор

Для Шага 3 (Контактная информация) мы реализуем:

1. **Условная видимость** - Скрыть адрес проживания когда совпадает с регистрацией
2. **Условный доступ** - Отключить адрес проживания когда совпадает с регистрацией
3. **Синхронизация данных** - Копировать адрес регистрации в адрес проживания

Это демонстрирует типичный паттерн: предоставить пользователю опцию использовать одинаковое значение для нескольких полей.

## Создание файла Behavior

```bash
touch src/behaviors/steps/step-3-contact-info.behaviors.ts
```

## Реализация Behaviors

```typescript title="src/behaviors/steps/step-3-contact-info.behaviors.ts"
import { hideWhen, disableWhen, copyTo } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const step3ContactBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Скрыть адрес проживания когда совпадает с регистрацией
  // ==========================================
  hideWhen(
    path.residenceAddress,
    path.sameAsRegistration,
    (value) => value === true
  );

  // ==========================================
  // 2. Отключить адрес проживания когда совпадает с регистрацией
  // ==========================================
  disableWhen(
    path.residenceAddress,
    path.sameAsRegistration,
    (value) => value === true
  );

  // ==========================================
  // 3. Копировать адрес регистрации в адрес проживания
  // ==========================================
  copyTo(
    path.registrationAddress,      // Источник
    path.residenceAddress,          // Назначение
    path.sameAsRegistration,        // Поле условия
    (shouldCopy) => shouldCopy === true  // Когда копировать
  );
};
```

### Разбор каждого behavior

**1. hideWhen:**
- Скрывает поля `residenceAddress` из пользовательского интерфейса
- Поля не валидируются когда скрыты
- Поля не включаются в отправку формы

**2. disableWhen:**
- Делает поля `residenceAddress` только для чтения
- Предотвращает редактирование пользователем
- Работает вместе с `hideWhen` (хотя скрытые поля уже недоступны)

**3. copyTo:**
- Отслеживает `registrationAddress` на изменения
- Когда `sameAsRegistration` - `true`, копирует значение в `residenceAddress`
- Запускается каждый раз когда `registrationAddress` изменяется при выполнении условия

:::tip hideWhen vs disableWhen
Вы можете задаться вопросом, почему мы используем оба `hideWhen` и `disableWhen` для одного условия:

- `hideWhen` - Удаляет поля из UI полностью (чище UX)
- `disableWhen` - Предотвращает редактирование если поля показаны

Хотя это может быть избыточным здесь, в некоторых случаях вы можете захотеть отключённые но видимые поля. Использование обоих - это защитное программирование.
:::

## Как работает copyTo

Behavior `copyTo` создаёт умную синхронизацию:

```typescript
copyTo(
  sourceField,      // Откуда копировать
  targetField,      // Куда копировать
  conditionField,   // Поле которое определяет должно ли происходить копирование
  conditionFn       // Функция которая вычисляет условие
);
```

**Поток выполнения:**
1. Пользователь заполняет адрес регистрации (город, улица, дом и т.д.)
2. Пользователь отмечает чекбокс "Совпадает с регистрацией"
3. `copyTo` сразу же копирует `registrationAddress` → `residenceAddress`
4. Если пользователь изменит `registrationAddress`, `residenceAddress` обновится автоматически
5. Если пользователь снимет флажок "Совпадает с регистрацией", копирование остановится (но значение останется)

:::caution copyTo vs syncWith
- **`copyTo`** - Одностороннее копирование (источник → назначение)
- **`syncWith`** - Двусторонняя синхронизация (источник ↔ назначение)

Для адресов `copyTo` правильный выбор, потому что мы не хотим, чтобы изменения в `residenceAddress` влияли на `registrationAddress`.
:::

## Полный код

```typescript title="src/behaviors/steps/step-3-contact-info.behaviors.ts"
import { hideWhen, disableWhen, copyTo } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const step3ContactBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  hideWhen(
    path.residenceAddress,
    path.sameAsRegistration,
    (value) => value === true
  );

  disableWhen(
    path.residenceAddress,
    path.sameAsRegistration,
    (value) => value === true
  );

  copyTo(
    path.registrationAddress,
    path.residenceAddress,
    path.sameAsRegistration,
    (shouldCopy) => shouldCopy === true
  );
};
```

## Тестирование

### Сценарии тестирования

1. **Копирование адреса:**
   - Заполните адрес регистрации (все поля)
   - Отметьте чекбокс "Совпадает с регистрацией"
   - Проверьте, что адрес проживания заполнен автоматически
   - Измените адрес регистрации
   - Проверьте, что адрес проживания обновляется автоматически

2. **Условная видимость:**
   - Когда "Совпадает с регистрацией" отмечено → Адрес проживания должен быть скрыт
   - Снимите флажок → Адрес проживания должен появиться
   - Отметьте снова → Адрес должен скрыться снова (с скопированными значениями)

3. **Ручное переопределение:**
   - Отметьте "Совпадает с регистрацией" (адрес скопирован)
   - Снимите флажок
   - Измените адрес проживания вручную
   - Отметьте "Совпадает с регистрацией" снова
   - Проверьте, что ручные изменения перезаписаны адресом регистрации

## Интеграция с UI

В компоненте шага контактной информации:

```tsx title="src/steps/ContactInfoStep.tsx"
function ContactInfoStep({ control }: Props) {
  return (
    <div className="space-y-6">
      {/* Адрес регистрации */}
      <div>
        <h3 className="font-semibold mb-4">Адрес регистрации</h3>
        <AddressForm
          control={control.registrationAddress}
          testIdPrefix="registration"
        />
      </div>

      {/* Чекбокс "Совпадает с регистрацией" */}
      <FormField control={control.sameAsRegistration} />

      {/* Адрес проживания - будет скрыт/отключен автоматически */}
      <div>
        <h3 className="font-semibold mb-4">Адрес проживания</h3>
        <AddressForm
          control={control.residenceAddress}
          testIdPrefix="residence"
        />
      </div>
    </div>
  );
}
```

Behaviors обрабатывают всё остальное автоматически!

## Результат

Шаг 3 теперь имеет:
- ✅ Умное копирование адреса (регистрация → проживание)
- ✅ Условная видимость (скрыт когда совпадает)
- ✅ Контроль условного доступа (отключен когда совпадает)
- ✅ Чистый UX (не нужно ручное дублирование)

## Ключевые выводы

- `hideWhen` для условной видимости
- `disableWhen` для условного контроля доступа
- `copyTo` для односторонней синхронизации данных
- Объединяйте несколько behaviors для надёжного UX
- Behaviors устраняют необходимость ручной логики обработки чекбокса

## Следующий шаг

Давайте добавим behaviors для Шага 4: Занятость, где мы будем обрабатывать различные типы занятости с условными полями и расчётом доходов.

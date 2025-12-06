# Проблемы и замечания при реализации формы

Этот документ содержит проблемы, возникшие при реализации многошаговой формы заявки на кредит с использованием `@reformer/core` и `reformer-mcp`. Цель - собрать обратную связь для улучшения библиотеки и документации.

---

## 🔴 Критические проблемы (ИСПРАВЛЕНЫ 2024-12-06)

### 1. ✅ LLMs.txt вводит в заблуждение относительно API createForm

**Статус:** ИСПРАВЛЕНО в llms.txt секция 8

**Проблема:** В документации LLMs.txt (раздел 8) показан упрощенный формат FormSchema:
```typescript
// Из LLMs.txt:
const formSchema: FormSchema<MyForm> = {
  name: '',
  email: '',
  address: {
    street: '',
    city: '',
  },
};
```

**Фактический формат из исходников (`deep-schema.d.ts`):**
```typescript
// Реальный тип FormSchema:
export type FormSchema<T> = {
  [K in keyof T]: NonNullable<T[K]> extends string | number | boolean
    ? FieldConfig<T[K]>  // Требует { value, component }!
    : ...
};

export interface FieldConfig<T> {
  value: T | null;           // Обязательно!
  component: ComponentType;  // Обязательно!
  componentProps?: any;
  validators?: ValidatorFn[];
  // ...
}
```

**Что пришлось сделать:** Полностью переделать схему с `{ value, component, componentProps }` вместо простых значений.

**Рекомендация:**
1. Обновить LLMs.txt с правильным форматом FormSchema
2. Показать что каждое поле должно иметь `value` и `component`
3. Добавить пример с импортом компонентов

---

### 2. ✅ Несуществующий хук useForm в LLMs.txt

**Статус:** ИСПРАВЛЕНО - добавлена секция 15 "NON-EXISTENT API"

**Проблема:** В LLMs.txt нет упоминания хука `useForm`, но при работе с MCP может быть сгенерирован код с его использованием.

**Фактический API:**
```typescript
import { createForm } from '@reformer/core';

const form = createForm<MyForm>({
  form: myFormSchema,
  validation: myValidation,
  behavior: myBehavior,
});
```

**Рекомендация:** Явно указать в LLMs.txt что основная функция - `createForm`, а не хук.

---

### 3. ✅ Тип FieldSchema не экспортируется из @reformer/core

**Статус:** ИСПРАВЛЕНО - добавлено в секцию 15 "NON-EXISTENT API"

**Проблема:** Документация упоминает использование типов схем, но реальные типы:
- `FormSchema<T>` - экспортируется
- `FieldConfig<T>` - экспортируется
- `FieldSchema` - НЕ существует

**Рекомендация:** Обновить документацию с правильными названиями типов.

---

## 🟡 Средние проблемы

### 4. Формат массивных полей в FormSchema

**Проблема:** Для массивов формат: `[FormSchema<ItemType>]` (массив с одним элементом-шаблоном).

**Пример:**
```typescript
// Правильно:
properties: [propertyItemSchema],

// Неправильно:
properties: [] as Property[],
```

**Рекомендация:** Добавить явные примеры с массивами в LLMs.txt.

---

### 5. Вложенные группы (GroupNode)

**Проблема:** Вложенные объекты определяются как вложенные `FormSchema<T>`:
```typescript
registrationAddress: addressSchema, // FormSchema<Address>
```

**Работает корректно**, но недокументировано.

---

### 6. Типизация control в компонентах

**Проблема:** `GroupNodeWithControls<T>` корректно типизирует вложенные поля:
- `control.loanType` → `FieldNode<LoanType>`
- `control.personalData` → `GroupNodeWithControls<PersonalData>`
- `control.properties` → `ArrayNode<Property>`

**Работает как ожидается.**

---

## 🟢 Мелкие замечания

### 7. Импорты behavior функций

**Из исходников библиотеки доступны:**
- `enableWhen`, `disableWhen` - условное включение/выключение
- `watchField` - отслеживание изменений
- `copyFrom` - копирование значений
- `resetWhen` - условный сброс
- `revalidateWhen` - перевалидация
- `transformValue` - трансформация значений
- `transformers` - готовые трансформеры (toUpperCase, trim, etc.)

**Рекомендация:** Добавить полный список доступных behavior функций в LLMs.txt.

---

### 8. ✅ computeFrom - СУЩЕСТВУЕТ

**Статус:** ВЕРИФИЦИРОВАНО - функция существует и работает

**Уточнение:** `computeFrom` СУЩЕСТВУЕТ и экспортируется из `@reformer/core/behaviors`. Первоначальное заключение было ошибочным.

**Примечание:** Функция работает для полей на одном уровне вложенности. Для cross-level вычислений используйте `watchField`.

```typescript
import { computeFrom } from '@reformer/core/behaviors';

// Работает для полей на одном уровне
computeFrom(
  [path.price, path.quantity],
  path.total,
  ({ price, quantity }) => (price || 0) * (quantity || 0)
);
```

---

## 📋 Проверенная функциональность

### Экспортируется из @reformer/core:
- [x] `createForm` - создание формы
- [x] `FormSchema<T>` - тип схемы
- [x] `FieldConfig<T>` - конфигурация поля
- [x] `GroupNodeWithControls<T>` - тип для группы с controls
- [x] `FieldNode<T>` - тип для поля
- [x] `ArrayNode<T>` - тип для массива
- [x] `useFormControl` - хук для подключения к полю
- [x] `useFormControlValue` - хук для значения поля
- [x] `BehaviorSchemaFn<T>` - тип для behavior схемы

### Behaviors (из @reformer/core/behaviors):
- [x] `enableWhen` / `disableWhen`
- [x] `watchField`
- [x] `copyFrom`
- [x] `resetWhen`
- [x] `revalidateWhen`
- [x] `transformValue`
- [x] `transformers` (готовые функции)

### Validators (из @reformer/core/validators):
- [x] `required` - обязательное поле
- [x] `min` / `max` - числовые ограничения
- [x] `minLength` / `maxLength` - ограничения длины строки
- [x] `email` - валидация email
- [x] `date` - валидация даты с опциями (minAge, maxAge, noFuture, noPast)
- [x] `applyWhen` - условная валидация
- [x] `validateTree` - кросс-валидация между полями
- [x] `notEmpty` - проверка что массив не пуст
- [x] `validateItems` - валидация элементов массива

---

## 💡 Предложения по улучшению LLMs.txt

1. **Исправить раздел 8 (FormSchema):**
   - Показать реальный формат с `{ value, component, componentProps }`
   - Добавить пример с импортом UI компонентов
   - Показать формат для массивов `[itemSchema]`

2. **Добавить раздел "Создание формы":**
   ```typescript
   import { createForm } from '@reformer/core';

   const form = createForm<MyForm>({
     form: schema,
     validation: validationFn,
     behavior: behaviorFn,
   });
   ```

3. **Добавить список всех behavior функций:**
   - enableWhen, disableWhen
   - watchField (вместо computeFrom для вычислений)
   - copyFrom
   - resetWhen
   - revalidateWhen
   - transformValue, transformers

4. **Убрать несуществующие упоминания:**
   - `useForm` хук
   - `FieldSchema` тип
   - `computeFrom` (если не существует)

5. **Добавить правильный формат ValidationSchemaFn и BehaviorSchemaFn:**
   ```typescript
   // ValidationSchemaFn и BehaviorSchemaFn принимают path и вызывают функции напрямую:
   const myValidation: ValidationSchemaFn<MyForm> = (path) => {
     required(path.email, { message: 'Email required' });
     email(path.email, { message: 'Invalid email' });

     // Условная валидация:
     applyWhen(path.type, (value) => value === 'business', (p) => {
       required(p.companyName, { message: 'Company name required' });
     });
   };

   const myBehavior: BehaviorSchemaFn<MyForm> = (path) => {
     enableWhen(path.companyName, (form) => form.type === 'business');

     watchField(path.amount, (value, ctx) => {
       ctx.setFieldValue('tax', value * 0.2);
     });
   };
   ```

6. **Добавить примеры кросс-валидации:**
   ```typescript
   validateTree((ctx) => {
     const form = ctx.form.getValue();
     if (form.password !== form.confirmPassword) {
       return { code: 'mismatch', message: 'Passwords must match' };
     }
     return null;
   }, { targetField: 'confirmPassword' });
   ```

7. **Добавить примеры валидации массивов:**
   ```typescript
   applyWhen(path.hasItems, (value) => value === true, (p) => {
     notEmpty(p.items, { message: 'Add at least one item' });
     validateItems(p.items, itemValidationSchema);
   });
   ```

---

## ✅ Выполненные улучшения (2024-12-06)

### Обновления llms.txt

| Секция | Изменение |
|--------|-----------|
| 1 | Расширен Quick Reference - полный список validators и behaviors |
| 2 | Расширены API Signatures - validators и behaviors с опциями |
| 8 | Полностью переписан FormSchema формат с `{ value, component }` |
| 15 | НОВАЯ секция "NON-EXISTENT API" (useForm, FieldSchema, when) |

### Обновления reformer-mcp

| Файл | Изменение |
|------|-----------|
| get-pattern.ts | Исправлено `when` → `applyWhen` в паттернах conditional-fields, multi-step |
| get-pattern.ts | Добавлены паттерны: `form-schema`, `array-validation` |
| explain-error.ts | Добавлены ошибки: FormSchema (value/component missing), non-existent API (when, useForm, FieldSchema) |
| get-function-signature.ts | Добавлены сигнатуры: pattern, url, phone, number, date, notEmpty, validateItems, resetWhen, revalidateWhen, transformValue |

### Верифицированный API

```
✅ computeFrom - СУЩЕСТВУЕТ в @reformer/core/behaviors
✅ createForm - основной API (не useForm)
✅ applyWhen - заменяет when() в validators
✅ FieldConfig<T> - правильный тип (не FieldSchema)
```
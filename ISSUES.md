# Проблемы, выявленные при создании формы заявки на кредит

Этот документ содержит список проблем и неудобств, с которыми столкнулся при создании формы с использованием @reformer/core и reformer-mcp. Эта информация предназначена для улучшения библиотеки и LLMs.txt.

---

## 1. Документация и LLMs.txt

### 1.1 Недостаточно примеров для сложных сценариев

**Проблема:** В LLMs.txt не хватает примеров для следующих сценариев:
- Многошаговые формы с валидацией по шагам
- Работа с массивами вложенных объектов (ArrayNode с GroupNode внутри)
- Каскадные вычисляемые поля (когда одно вычисляемое поле зависит от другого)

**Рекомендация:** Добавить в LLMs.txt секцию с примерами для multi-step форм и сложных зависимостей.

### 1.2 Неясность с типами для watchField

**Проблема:** При использовании `watchField` для вычисления зависимых полей приходится явно приводить типы через `as` для получения значений других полей через `ctx.getFieldValue()`.

**Пример проблемы:**
```typescript
watchField(path.loanAmount, (loanAmount, ctx) => {
  const loanTerm = ctx.getFieldValue(path.loanTerm.toString()) as number; // Требуется as
  // ...
});
```

**Рекомендация:** Улучшить типизацию `BehaviorContext.getFieldValue()` для автоматического вывода типов.

---

## 2. Поведение (Behaviors)

### 2.1 Невозможность использования computeFrom для полей на разных уровнях вложенности

**Проблема:** `computeFrom` работает только для полей на одном уровне вложенности. Для вычисления `fullName` из `personalData.lastName`, `personalData.firstName` и `personalData.middleName` в поле на верхнем уровне (`fullName`) пришлось использовать `watchField`.

**Рекомендация:** Расширить `computeFrom` для поддержки полей на разных уровнях вложенности, либо явно документировать это ограничение.

### 2.2 Необходимость использовать path.toString() для setFieldValue

**Проблема:** При вызове `ctx.setFieldValue()` в `watchField` требуется конвертировать path в строку через `.toString()`.

**Пример:**
```typescript
ctx.setFieldValue(path.fullName.toString(), fullName);
```

**Рекомендация:** Разрешить передачу `FieldPath` напрямую в `setFieldValue`.

### 2.3 Отсутствие batch-режима для множественных обновлений

**Проблема:** При вычислении нескольких зависимых полей в одном `watchField` каждый `setFieldValue` может вызывать ререндер.

**Рекомендация:** Добавить `ctx.batch()` для группировки обновлений:
```typescript
watchField(path.source, (value, ctx) => {
  ctx.batch(() => {
    ctx.setFieldValue(path.field1, value1);
    ctx.setFieldValue(path.field2, value2);
  });
});
```

---

## 3. Валидация

### 3.1 Валидация массивов требует дублирования кода

**Проблема:** При использовании `validateItems` для валидации элементов массива приходится создавать отдельную функцию валидации для каждого типа элемента.

**Рекомендация:** Документировать паттерн переиспользования валидаторов для вложенных структур.

### 3.2 Кросс-валидация между элементами массива

**Проблема:** Нет очевидного способа валидировать один элемент массива относительно других (например, проверить уникальность значений).

**Рекомендация:** Добавить пример кросс-валидации между элементами массива в документацию.

---

## 4. Условные поля

### 4.1 enableWhen не работает с глубоко вложенными путями для групп

**Проблема:** При использовании `enableWhen` для вложенного объекта (`path.residenceAddress`) поведение отключения/включения всех вложенных полей не всегда очевидно.

**Рекомендация:** Документировать поведение `enableWhen` для GroupNode и ArrayNode.

### 4.2 resetOnDisable не всегда работает как ожидается

**Проблема:** При `resetOnDisable: true` для условных полей не всегда понятно, к каким значениям они сбрасываются (к начальным из схемы или к undefined).

**Рекомендация:** Уточнить в документации поведение `resetOnDisable` и добавить возможность указывать значение для сброса.

---

## 5. Типизация

### 5.1 Сложность типизации FormSchema для вложенных объектов

**Проблема:** При создании вложенных схем (personalDataSchema, addressSchema) TypeScript не всегда корректно выводит типы, требуя явного указания `FormSchema<Type>`.

**Рекомендация:** Улучшить type inference для вложенных схем.

### 5.2 Типы для массивов в схеме

**Проблема:** Синтаксис `[itemSchema]` для массивов не очевиден и требует изучения документации.

**Рекомендация:** Добавить более явный синтаксис или алиас типа, например `arrayOf(itemSchema)`.

---

## 6. UI компоненты

### 6.1 FormField не поддерживает все типы полей

**Проблема:** Универсальный компонент FormField требует специальной обработки для разных типов полей (checkbox, radio, select).

**Рекомендация:** Добавить в LLMs.txt примеры создания универсальных FormField компонентов для разных UI-библиотек.

### 6.2 Отсутствие встроенного компонента для отображения ошибок формы

**Проблема:** Нет стандартного способа получить и отобразить все ошибки формы сразу (например, для summary в конце формы).

**Рекомендация:** Добавить хук `useFormErrors(form)` для получения всех ошибок формы.

---

## 7. StepNavigation

### 7.1 validateForm не экспортируется из основного модуля

**Проблема:** Функция `validateForm` экспортируется из `@reformer/core/validators`, а не из основного модуля.

**Рекомендация:** Экспортировать `validateForm` из `@reformer/core` для удобства импорта.

---

## 8. Общие рекомендации для LLMs.txt

1. **Добавить секцию "Common Patterns"** с примерами:
   - Multi-step форма
   - Форма с динамическими массивами
   - Форма с вычисляемыми полями
   - Форма с условной валидацией

2. **Добавить секцию "Troubleshooting"** с частыми ошибками и их решениями

3. **Расширить примеры типизации** для сложных форм с вложенными объектами и массивами

4. **Документировать интеграцию** с популярными UI-библиотеками (shadcn/ui, Radix, MUI)

---

## 9. Предложения для reformer-mcp

### 9.1 Генерация кода для multi-step форм

**Предложение:** Добавить команду для генерации структуры multi-step формы с автоматическим разделением валидации по шагам.

### 9.2 Генерация под-форм

**Предложение:** Автоматически генерировать под-формы для вложенных объектов, когда они используются в нескольких местах (например, Address, PersonalData).

### 9.3 Предупреждения о потенциальных проблемах

**Предложение:** Добавить анализ схемы и предупреждения о:
- Циклических зависимостях в behaviors
- Несогласованности между типами и схемой
- Отсутствующих валидаторах для обязательных полей

---

## 10. Критическая ошибка в документации useFormControlValue

### 10.1 Неверный пример возвращаемого значения в LLMs.txt

**Проблема:** В LLMs.txt (секция "Type-Safe useFormControl") показан пример с деструктуризацией `{ value }`, но `useFormControlValue` возвращает значение напрямую (`T`), а не объект `{ value: T }`.

**В документации (НЕПРАВИЛЬНО):**
```typescript
const { value } = useFormControl(form.field as FieldNode<ExpectedType>);
```

**Фактическая сигнатура:**
```typescript
// useFormControlValue возвращает T напрямую
export declare function useFormControlValue<T extends FormValue>(control: FieldNode<T>): T;
```

**Правильное использование:**
```typescript
// useFormControlValue - только значение
const loanType = useFormControlValue(control.loanType); // Возвращает string напрямую

// useFormControl - полное состояние поля
const { value, errors, disabled, touched } = useFormControl(control.loanType); // Возвращает объект
```

**Последствия:** LLM генерирует код с деструктуризацией `const { value: loanType } = useFormControlValue(...)`, который компилируется без ошибок TypeScript (т.к. деструктуризация примитива возвращает undefined), но приводит к тому, что условный рендеринг не работает - значение всегда undefined.

**Рекомендация:**
1. Исправить примеры в LLMs.txt
2. Явно указать разницу между `useFormControl` и `useFormControlValue`
3. Добавить в секцию "COMMON MISTAKES":
```typescript
// ❌ WRONG - useFormControlValue returns T, not { value: T }
const { value: loanType } = useFormControlValue(control.loanType);

// ✅ CORRECT
const loanType = useFormControlValue(control.loanType);
```

---

## 11. Отсутствие getFieldValue в BehaviorContext

### 11.1 LLMs.txt документирует несуществующий метод

**Проблема:** В LLMs.txt (секция "BehaviorContext interface") документирован метод `getFieldValue`, но его нет в реальном интерфейсе `FormContext`/`BehaviorContext`.

**В документации (НЕПРАВИЛЬНО):**
```typescript
interface BehaviorContext<TForm> {
  form: GroupNodeWithControls<TForm>;
  setFieldValue: (path: string, value: any) => void;
  getFieldValue: (path: string) => unknown;  // ← НЕ СУЩЕСТВУЕТ!
}
```

**Реальный интерфейс (из form-context.d.ts):**
```typescript
export interface FormContext<TForm> {
  readonly form: GroupNodeWithControls<TForm>;
  setFieldValue(path: string, value: unknown): void;
  // getFieldValue - ОТСУТСТВУЕТ!
}
```

**Правильные способы чтения значений полей:**
```typescript
// Чтение значения поля через ctx.form
const loanType = ctx.form.loanType.value.value;

// Для вложенных полей (если watchField на вложенном пути)
// ctx.form типизирован как тип родительской группы, не корневой формы!
watchField(path.personalData.lastName, (lastName, ctx) => {
  // ctx.form здесь - это PersonalData, не CreditApplicationForm!
  const firstName = ctx.form.firstName.value.value;  // ✅ CORRECT
  const middleName = ctx.form.middleName.value.value;  // ✅ CORRECT

  // Для записи в корневое поле используем setFieldValue с полным путём
  ctx.setFieldValue('fullName', [lastName, firstName, middleName].filter(Boolean).join(' '));
});
```

**Последствия:** LLM генерирует код с `ctx.getFieldValue(path.field.toString())`, который не компилируется TypeScript.

**Рекомендация:**
1. Убрать `getFieldValue` из документации LLMs.txt
2. Документировать правильный способ чтения значений: `ctx.form.field.value.value`
3. Добавить предупреждение о типизации ctx.form для вложенных путей

---

## 12. ДОПОЛНИТЕЛЬНЫЕ РЕКОМЕНДАЦИИ (добавлены при анализе)

### 12.1 Проблема двойного `.value.value` для чтения значений

**Проблема:** Синтаксис `ctx.form.field.value.value` неочевиден и приводит к ошибкам. Первый `.value` - это сигнал, второй `.value` - его значение.

**Рекомендация:**
1. Добавить вспомогательный метод `getValue()` на FieldNode:
```typescript
// Вместо:
const amount = ctx.form.amount.value.value;

// Можно было бы:
const amount = ctx.form.amount.getValue();
```

2. Или документировать этот паттерн более явно в LLMs.txt с объяснением архитектуры сигналов

### 12.2 Отсутствие типизированного getFieldValue для корневой формы

**Проблема:** При использовании `watchField` на вложенном пути, `ctx.form` типизирован как тип вложенной группы, а не корневой формы. Это делает невозможным безопасный доступ к полям корневой формы через `ctx.form`.

**Рекомендация:** Добавить в `BehaviorContext` типизированную ссылку на корневую форму:
```typescript
interface BehaviorContext<TForm, TRoot = TForm> {
  form: GroupNodeWithControls<TForm>;
  root: GroupNodeWithControls<TRoot>;  // Доступ к корневой форме
  setFieldValue: (path: string, value: any) => void;
}
```

### 12.3 Улучшение DX для типа FieldPath

**Проблема:** При вызове `ctx.setFieldValue()` требуется конвертировать path в строку через `.toString()`. Это избыточный шаг.

**Рекомендация:** Расширить сигнатуру `setFieldValue` для приёма `FieldPath`:
```typescript
setFieldValue(path: string | FieldPath<TForm, unknown>, value: unknown): void;
```

### 12.4 Документирование различий между хуками

**Проблема:** В LLMs.txt недостаточно чётко объяснена разница между `useFormControl` и `useFormControlValue`.

**Текущее поведение:**
- `useFormControl(control)` → возвращает объект `{ value, errors, disabled, ... }`
- `useFormControlValue(control)` → возвращает значение напрямую (`T`)

**Рекомендация:** Добавить сравнительную таблицу в LLMs.txt:

| Хук | Возврат | Подписки | Использование |
|-----|---------|----------|---------------|
| `useFormControl` | `{ value, errors, ... }` | Все сигналы | Полное состояние поля |
| `useFormControlValue` | `T` напрямую | Только value | Условный рендеринг |

### 12.5 Добавить секцию с паттернами работы с массивами

**Проблема:** Работа с массивами в ReFormer требует понимания, что каждый элемент массива - это под-форма (GroupNode). Это недостаточно документировано.

**Рекомендация:** Добавить в LLMs.txt секцию "ARRAY PATTERNS":
```typescript
// Доступ к элементам массива
form.items.map((item, index) => {
  // item - это GroupNode (под-форма)
  item.name.setValue('New value');
  item.price.value.value; // Читаем значение
});

// Методы массива
form.items.push({ name: '', price: 0 }); // Добавить элемент
form.items.removeAt(index);              // Удалить по индексу
form.items.clear();                       // Очистить массив
form.items.move(fromIndex, toIndex);     // Переместить элемент
```

### 12.6 Валидация: явное указание типа для validateTree

**Проблема:** TypeScript не выводит тип формы для `validateTree`, что приводит к implicit any.

**Рекомендация:** Добавить фабричную функцию с явным типом:
```typescript
// Текущий проблемный код
validateTree((ctx) => { ... }); // ctx has implicit any

// Предлагаемое решение - добавить typedValidateTree
const typedValidateTree = <TForm>() => validateTree<TForm>;

// Использование
typedValidateTree<MyForm>()((ctx) => {
  // ctx.form теперь типизирован
});
```

### 12.7 Добавить линтер-подсказки для частых ошибок

**Рекомендация:** Создать ESLint плагин для ReFormer с правилами:
- Предупреждение при деструктуризации `useFormControlValue`
- Проверка использования `{ message: ... }` в валидаторах
- Проверка отсутствия `getFieldValue` вызовов

---

## 13. ПРИОРИТЕТЫ ИСПРАВЛЕНИЙ

### Критические (влияют на работоспособность)
1. **[10.1]** Исправить документацию `useFormControlValue` - LLM генерирует нерабочий код
2. **[11.1]** Убрать несуществующий `getFieldValue` из LLMs.txt

### Высокий приоритет (частые ошибки)
3. **[1.2]** Улучшить типизацию `BehaviorContext.getFieldValue()` / документировать `.value.value`
4. **[2.1]** Документировать ограничение `computeFrom` для разных уровней вложенности
5. **[2.2]** Добавить перегрузку `setFieldValue` для `FieldPath`
6. **[3.2]** Добавить примеры кросс-валидации массивов
7. **[12.4]** Добавить сравнительную таблицу хуков

### Средний приоритет (улучшение DX)
8. **[1.1]** Добавить примеры для multi-step форм
9. **[4.1]** Документировать поведение `enableWhen` для GroupNode/ArrayNode
10. **[4.2]** Уточнить поведение `resetOnDisable`
11. **[6.1]** Добавить примеры FormField для разных UI-библиотек
12. **[7.1]** Экспортировать `validateForm` из основного модуля
13. **[12.5]** Добавить секцию ARRAY PATTERNS

### Низкий приоритет (nice-to-have)
14. **[2.3]** Добавить `ctx.batch()` для группировки обновлений
15. **[5.1]** Улучшить type inference для вложенных схем
16. **[5.2]** Добавить `arrayOf()` алиас для более явного синтаксиса
17. **[6.2]** Добавить хук `useFormErrors()`
18. **[12.6]** Добавить фабричную функцию для типизированного validateTree
19. **[12.7]** Создать ESLint плагин

---

## 14. ПЛАН РАБОТ

### Фаза 1: Исправление критических ошибок в документации (LLMs.txt)

**Цель:** Устранить ошибки, которые приводят к генерации нерабочего кода.

#### Задача 1.1: Исправить BehaviorContext interface
**Файл:** `packages/reformer/llms.txt`
**Изменения:**
```typescript
// БЫЛО (строки 88-94):
interface BehaviorContext<TForm> {
  form: GroupNodeWithControls<TForm>;
  setFieldValue: (path: string, value: any) => void;
  getFieldValue: (path: string) => unknown;  // ← УДАЛИТЬ!
}

// ДОЛЖНО БЫТЬ:
interface BehaviorContext<TForm> {
  form: GroupNodeWithControls<TForm>;
  setFieldValue: (path: string, value: any) => void;
  // Для чтения значений используйте: ctx.form.fieldName.value.value
}
```

#### Задача 1.2: Добавить раздел различий хуков
**Файл:** `packages/reformer/llms.txt`
**Добавить после секции QUICK REFERENCE:**
```markdown
### React Hooks Comparison

| Hook | Return Type | Subscribes To | Use Case |
|------|-------------|---------------|----------|
| `useFormControl(field)` | `{ value, errors, disabled, ... }` | All signals | Full field state |
| `useFormControlValue(field)` | `T` (value directly) | Only value | Conditional rendering |

⚠️ **CRITICAL**: Do NOT destructure useFormControlValue!
```

#### Задача 1.3: Обновить секцию COMMON MISTAKES
**Файл:** `packages/reformer/llms.txt`
**Добавить:**
```typescript
### useFormControlValue

// ❌ WRONG - useFormControlValue returns T directly, NOT { value: T }
const { value: loanType } = useFormControlValue(control.loanType);
// Result: loanType is undefined!

// ✅ CORRECT
const loanType = useFormControlValue(control.loanType);
// Result: loanType is the actual value

### Reading Field Values in BehaviorContext

// ❌ WRONG - getFieldValue does NOT exist!
watchField(path.amount, (amount, ctx) => {
  const rate = ctx.getFieldValue('rate'); // ERROR!
});

// ✅ CORRECT - use ctx.form.fieldName.value.value
watchField(path.amount, (amount, ctx) => {
  const rate = ctx.form.rate.value.value;
  ctx.setFieldValue('total', amount * rate);
});
```

---

### Фаза 2: Расширение документации для сложных сценариев

#### Задача 2.1: Добавить секцию READING FIELD VALUES
**Файл:** `packages/reformer/llms.txt`
**Содержание:**
```typescript
## READING FIELD VALUES

### Why .value.value?
ReFormer uses @preact/signals-core for reactivity:
- `field.value` → Signal<T> (reactive container)
- `field.value.value` → T (actual value)

### In Behavior Context
watchField(path.firstName, (firstName, ctx) => {
  // ctx.form is typed as the PARENT GROUP, not root form!
  // For nested paths: ctx.form = PersonalData, not MyForm

  const lastName = ctx.form.lastName.value.value;  // Read sibling field
  ctx.setFieldValue('fullName', `${firstName} ${lastName}`);
});

### In Components
const { value } = useFormControl(control.email);  // Object destructuring OK
const email = useFormControlValue(control.email); // Direct value
```

#### Задача 2.2: Добавить секцию ARRAY OPERATIONS
**Файл:** `packages/reformer/llms.txt`
**Содержание:**
```typescript
## ARRAY OPERATIONS

### Array Structure
Each array item is a sub-form (GroupNode) with its own fields.

### Rendering Arrays
{form.items.map((item, index) => (
  <div key={item.id || index}>
    <FormField control={item.name} />     {/* item is GroupNode */}
    <FormField control={item.price} />
    <button onClick={() => form.items.removeAt(index)}>Remove</button>
  </div>
))}

### Array Methods
form.items.push({ name: '', price: 0 });  // Add item
form.items.removeAt(index);               // Remove by index
form.items.clear();                        // Remove all
form.items.move(from, to);                 // Reorder

### Array Validation (Cross-Item)
validateTree((ctx: { form: MyForm }) => {
  const items = ctx.form.items;
  const names = items.map(item => item.name.value.value);
  const hasDuplicates = names.length !== new Set(names).size;

  if (hasDuplicates) {
    return { code: 'duplicate', message: 'Item names must be unique' };
  }
  return null;
}, { targetField: 'items' });
```

#### Задача 2.3: Расширить секцию computeFrom vs watchField
**Файл:** `packages/reformer/llms.txt`
**Содержание:**
```typescript
## COMPUTE FROM vs WATCH FIELD

### computeFrom - Same Nesting Level Only
// ✅ Works: all fields at same level
computeFrom(
  [path.price, path.quantity],
  path.total,
  ({ price, quantity }) => price * quantity
);

// ❌ Fails: different nesting levels
computeFrom(
  [path.nested.price, path.nested.quantity],
  path.rootTotal,  // Different level!
  ...
);

### watchField - Any Level
// ✅ Works for cross-level computation
watchField(path.nested.price, (price, ctx) => {
  const quantity = ctx.form.quantity.value.value; // Sibling in nested
  ctx.setFieldValue('rootTotal', price * quantity); // Full path to root
});

### Rule of Thumb
- Same parent? → Use computeFrom (simpler, automatic cleanup)
- Different parents? → Use watchField (more flexible)
```

---

### Фаза 3: Улучшения в коде библиотеки

#### Задача 3.1: Добавить метод getValue() на FieldNode
**Файл:** `packages/reformer/src/core/nodes/field-node.ts`
**Изменения:**
```typescript
class FieldNode<T> {
  // Существующий код...

  /**
   * Получить текущее значение поля (shorthand для .value.value)
   */
  getValue(): T {
    return this.value.value;
  }
}
```

#### Задача 3.2: Расширить setFieldValue для приёма FieldPath
**Файл:** `packages/reformer/src/core/types/form-context.ts`
**Изменения:**
```typescript
import type { FieldPath } from './field-path';

interface FormContext<TForm> {
  readonly form: GroupNodeWithControls<TForm>;
  setFieldValue(path: string | FieldPath<TForm, unknown>, value: unknown): void;
}
```

**Файл:** `packages/reformer/src/core/behavior/behavior-context.ts`
**Изменения:**
```typescript
setFieldValue(path: string | FieldPath<TForm, unknown>, value: unknown): void {
  const pathStr = typeof path === 'string' ? path : path.toString();
  // Существующая логика...
}
```

#### Задача 3.3: Экспортировать validateForm из основного модуля
**Файл:** `packages/reformer/src/index.ts`
**Добавить:**
```typescript
export { validateForm } from './core/validation/validate-form';
```

---

### Фаза 4: Тестирование и валидация

#### Задача 4.1: Создать тестовые сценарии для LLM
**Файл:** `packages/reformer/tests/llm-scenarios.test.ts`
**Тесты:**
- [ ] useFormControlValue без деструктуризации работает
- [ ] ctx.form.field.value.value возвращает значение
- [ ] watchField для cross-level вычислений
- [ ] validateItems для массивов

#### Задача 4.2: E2E тест генерации формы через MCP
- [ ] Сгенерировать multi-step форму
- [ ] Проверить компиляцию TypeScript
- [ ] Проверить работу валидации
- [ ] Проверить работу behaviors

---

### Фаза 5: Улучшения для reformer-mcp

#### Задача 5.1: Добавить проверки в MCP tools
**Файл:** `packages/reformer-mcp/src/tools/`
**Добавить валидации:**
- Предупреждение о несуществующих API
- Проверка паттернов использования хуков
- Валидация structure схемы

#### Задача 5.2: Шаблоны для частых сценариев
- [ ] Multi-step form template
- [ ] Array with sub-forms template
- [ ] Conditional fields template

---

## ОЦЕНКА ТРУДОЗАТРАТ

| Фаза | Задачи | Оценка |
|------|--------|--------|
| Фаза 1 | 3 задачи | 2-3 часа |
| Фаза 2 | 3 задачи | 3-4 часа |
| Фаза 3 | 3 задачи | 4-6 часов |
| Фаза 4 | 2 задачи | 2-3 часа |
| Фаза 5 | 2 задачи | 4-6 часов |
| **Итого** | **13 задач** | **15-22 часа** |

---

## МЕТРИКИ УСПЕХА

1. **Уменьшение ошибок компиляции** - сгенерированный код компилируется без ошибок в 95%+ случаев
2. **Уменьшение runtime ошибок** - undefined/null ошибки при условном рендеринге снижены на 90%
3. **Улучшение DX** - время на исправление сгенерированного кода сокращено в 2 раза

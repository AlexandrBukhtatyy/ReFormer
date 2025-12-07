# Проблемы, обнаруженные при использовании @reformer/core

## 1. validateForm не работает с Proxy (GroupNodeWithControls)

**Критичность:** Высокая

**Файл:** `src/core/validation/validate-form.ts`

**Проблема:**
Функция `validateForm(form, schema)` использует `instanceof GroupNode` для проверки типа узла. Но `createForm()` возвращает `GroupNodeWithControls<T>`, который является Proxy над GroupNode. Proxy не проходит проверку `instanceof`.

**Код с проблемой:**
```typescript
function collectAllFieldNodes(node) {
    if (node instanceof FieldNode) {
        return [node];
    }
    if (node instanceof GroupNode) {  // <-- Proxy не проходит эту проверку!
        return Array.from(node.getAllFields()).flatMap(collectAllFieldNodes);
    }
    if (node instanceof ArrayNode) {
        return node.map((item) => collectAllFieldNodes(item)).flat();
    }
    return [];
}
```

**Результат:**
- `validateForm(form, stepValidation)` возвращает пустой массив полей
- Валидация по шагам (multi-step forms) не работает
- Ошибки не появляются на полях

**Решение:**
Использовать duck-typing вместо `instanceof`:

```typescript
function collectAllFieldNodes(node: FormNode<unknown>): FieldNode<unknown>[] {
    // Duck-typing для поддержки Proxy
    // FieldNode имеет validate(), но не имеет getAllFields() и map()
    if ('validate' in node && !('getAllFields' in node) && !('map' in node)) {
        return [node as FieldNode<unknown>];
    }
    // GroupNode и его Proxy имеют getAllFields()
    if (typeof (node as GroupNode<unknown>).getAllFields === 'function') {
        return Array.from((node as GroupNode<unknown>).getAllFields())
            .flatMap(collectAllFieldNodes);
    }
    // ArrayNode имеет map() и length
    if (typeof (node as ArrayNode<unknown>).map === 'function' && 'length' in node) {
        return (node as ArrayNode<unknown>)
            .map((item) => collectAllFieldNodes(item))
            .flat();
    }
    return [];
}
```

**Альтернативное решение:**
Добавить в Proxy handler для `Symbol.hasInstance`, чтобы `instanceof` работал корректно.

---

## 2. useForm не экспортируется из @reformer/core

**Критичность:** Средняя (документация)

**Проблема:**
В LLMs.txt упоминается `useForm`, но такой функции нет в экспортах библиотеки. Нужно использовать `createForm`.

**Решение:**
Обновить LLMs.txt, убрав упоминания `useForm` или добавить алиас.

---

## 3. FormProvider не существует

**Критичность:** Низкая (документация)

**Проблема:**
При генерации кода ожидался `FormProvider` для оборачивания формы (по аналогии с React Hook Form). В @reformer/core такого компонента нет - форма передаётся напрямую через props.

**Решение:**
Документировать паттерн использования формы без провайдера.

---

## 4. applyWhen требует 3 аргумента, а не 2

**Критичность:** Средняя (документация)

**Проблема:**
В первоначально сгенерированном коде использовался вызов:
```typescript
applyWhen(
  (form) => form.loanType === 'mortgage',
  () => {
    required(path.propertyValue);
  }
);
```

Но правильная сигнатура:
```typescript
applyWhen(
  path.loanType,  // <-- поле для отслеживания
  (loanType) => loanType === 'mortgage',  // <-- условие
  (p) => {
    required(p.propertyValue);  // <-- валидаторы
  }
);
```

**Решение:**
Улучшить документацию в LLMs.txt с примерами правильного использования `applyWhen`.

---

## 5. UI компоненты не экспортируются из @reformer/core

**Критичность:** Низкая (ожидаемое поведение)

**Проблема:**
Компоненты `Input`, `Select`, `Checkbox`, `FormField` и т.д. не являются частью @reformer/core. Библиотека предоставляет только логику форм, UI компоненты должны быть реализованы отдельно.

**Решение:**
Документировать, что UI компоненты должны быть созданы пользователем или использованы из UI библиотеки (shadcn, Material UI и т.д.).

---

## 6. FormInstance тип не существует

**Критичность:** Низкая

**Проблема:**
При генерации кода использовался тип `FormInstance<T>`, которого нет в библиотеке.

**Правильный тип:**
```typescript
import { type GroupNodeWithControls } from '@reformer/core';

interface StepProps {
  form: GroupNodeWithControls<MyFormType>;
}
```

---

## 7. useArrayField не существует

**Критичность:** Средняя

**Проблема:**
Для работы с массивами ожидался хук `useArrayField`, но его нет.

**Правильный паттерн:**
Используйте методы ArrayNode напрямую:
```typescript
// form.items - это ArrayNode
form.items.push();           // добавить элемент
form.items.removeAt(index);  // удалить элемент
form.items.map((item, i) => ...);  // итерация
```

---

## 8. Неправильный доступ к вложенным полям в watchField callback

**Критичность:** Высокая

**Проблема:**
При использовании `watchField` для вложенных полей (например `path.personalData.lastName`), в callback функции для доступа к другим полям той же группы нужно использовать полный путь через `ctx.form`.

**Неправильный код:**
```typescript
watchField(
  path.personalData.lastName,
  (lastName, ctx) => {
    // ОШИБКА: firstName не существует на верхнем уровне формы!
    const firstName = ctx.form.firstName.value.value ?? '';
    const middleName = ctx.form.middleName.value.value ?? '';
    // ...
  }
);
```

**Правильный код:**
```typescript
watchField(
  path.personalData.lastName,
  (lastName, ctx) => {
    // ПРАВИЛЬНО: используем полный путь через personalData
    const firstName = ctx.form.personalData.firstName.value.value ?? '';
    const middleName = ctx.form.personalData.middleName.value.value ?? '';
    // ...
  }
);
```

**Также:**
Для установки значения вычисляемого поля лучше использовать прямой доступ `ctx.form.fieldName.setValue()` вместо `ctx.setFieldValue('fieldName', value)`:

```typescript
// Рекомендуется:
ctx.form.fullName.setValue(fullName);

// Менее надёжно (требует строковый путь):
ctx.setFieldValue('fullName', fullName);
```

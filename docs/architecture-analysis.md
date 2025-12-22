# Архитектурный анализ packages/reformer/src/core

**Дата:** 2025-12-22
**Анализируемая версия:** develop (commit e89f6df)

## Общая статистика
- **Всего файлов:** 50 TypeScript файлов
- **Всего строк:** ~7200 строк кода
- **Выявлено проблем:** 40+ критических и умеренных

---

## КРИТИЧЕСКИЕ ПРОБЛЕМЫ (P0 - исправить немедленно)

### 1. Race Condition в FieldNode.validateImmediate()
**Файл:** `nodes/field-node.ts:303-388`

```typescript
// Проблема: Promise.all() не отменяется при новой валидации
const asyncResults = await Promise.all(
  this.asyncValidators.map(async (validator) => {
    return await validator(this._value.value); // Старое значение!
  })
);
```

**Сценарий:**
1. validate() #1 запускается с value='old'
2. validate() #2 запускается с value='new'
3. Валидатор #1 завершается позже #2
4. Результаты могут смешаться

**Решение:** Использовать AbortController для отмены pending валидаций.

---

### 2. Утечка памяти в debounce таймере
**Файл:** `nodes/field-node.ts:75-78, 249-290`

```typescript
private validateDebounceTimer?: ReturnType<typeof setTimeout>;
private validateDebounceResolve?: (value: boolean) => void;
```

**Проблема:** Если компонент unmount во время debounce, Promise resolve остаётся висячим в памяти.

**Решение:** Добавить cleanup в dispose() и reject висячие промисы.

---

### 3. Логическая ошибка в ValidationApplicator.clearErrors
**Файл:** `validation/validation-applicator.ts:188-190`

```typescript
// НЕПРАВИЛЬНО:
!control.errors.value.some((e) => e.code !== 'contextual')

// ПРАВИЛЬНО должно быть:
!control.errors.value.some((e) => e.code === 'contextual')
```

**Результат:** Contextual errors НИКОГДА не очищаются!

---

### 4. Race Condition в sync-fields behavior
**Файл:** `behavior/behaviors/sync-fields.ts:39-82`

```typescript
let isUpdating = false;
withDebounce(() => {
  isUpdating = true;
  targetNode.setValue(...); // Может выбросить ошибку!
  isUpdating = false; // Никогда не выполнится при ошибке
});
```

**Решение:** Обернуть в try-finally.

---

### 5. Утечка памяти в applyWhen
**Файл:** `behavior/compose-behavior.ts:173-200`

```typescript
// Behaviors регистрируются при condition=true
// Но НЕ деактивируются при condition=false
if (!hasRegistered && condition(value)) {
  callback(fieldPath);
  hasRegistered = true;
}
// TODO: деактивация при condition=false отсутствует
```

---

## ВЫСОКИЕ ПРОБЛЕМЫ (P1)

### 6. Type Casting Hell (22+ `as any`)
**Файлы:** Все nodes и validation файлы

| Файл | Количество `as any` |
|------|---------------------|
| group-node.ts | 8+ |
| field-node.ts | 4+ |
| array-node.ts | 4+ |
| validation-applicator.ts | 6+ |

**Проблема:** Скрывает реальные типовые ошибки, затрудняет рефакторинг.

---

### 7. Double Dereference (.value.value)
**Файлы:** `array-node.ts:102`, `group-node.ts:195`, `field-node.ts:515`

```typescript
// Антипаттерн - непонятный API
this.value = computed(() =>
  this.items.value.map((item) => item.value.value as T)
);
```

---

### 8. Дублирование ключей в watch()
**Файлы:** `field-node.ts:520-521`, `group-node.ts:713-714`

```typescript
const key = `watch-${Date.now()}-${Math.random()}`;
// Date.now() имеет разрешение в миллисекундах
// Два быстрых вызова могут создать ОДИНАКОВЫЕ ключи!
```

**Решение:** Использовать UUID или atomic counter.

---

### 9. ArrayNode.setErrors игнорируется
**Файл:** `nodes/array-node.ts:287-294`

```typescript
setErrors(_errors: ValidationError[]): void {
  // ArrayNode level errors - можно реализовать позже
  // Пока просто игнорируем  ← ОПАСНО!
}
```

---

### 10. Конструктор GroupNode возвращает Proxy
**Файл:** `nodes/group-node.ts:167-261`

```typescript
constructor(schemaOrConfig) {
  // ...
  return proxy as FormProxy<T>; // Нарушает LSP!
}
```

**Проблема:** `new GroupNode()` возвращает Proxy, не GroupNode. Невозможно наследование.

---

## СРЕДНИЕ ПРОБЛЕМЫ (P2)

### 11. Нарушение SRP в ValidationRegistry
**Файл:** `validation/validation-registry.ts` (372 строки, 14 public методов)

Делает слишком много:
- Stack management
- State storage
- Validator registration (5 типов)
- Condition management
- Lifecycle management
- Validator application

---

### 12. Нарушение SRP в ValidationApplicator
**Файл:** `validation/validation-applicator.ts` (265 строк)

Делает слишком много:
- Группировка валидаторов
- Создание 3 типов контекстов
- Выполнение sync/async валидаторов
- Обработка ошибок

---

### 13. Дублирование ValidationContext классов
**Файл:** `validation/validation-context.ts:19-140`

3 класса с почти идентичным кодом:
- ValidationContextImpl
- TreeValidationContextImpl
- ArrayValidationContextImpl

**Решение:** Извлечь BaseValidationContext.

---

### 14. Дублирование в Behaviors
**Файлы:** Все 8 behaviors используют одинаковый паттерн

```typescript
// Повторяется в каждом behavior:
const handler: BehaviorHandlerFn<any> = (form, _context, withDebounce) => {
  const targetNode = form.getFieldByPath(target.__path);
  return effect(() => { ... });
};
getCurrentBehaviorRegistry().register(handler as any, { debounce });
```

---

### 15. Неправильное использование batch()
**Файл:** `nodes/group-node.ts:348-359`

```typescript
patchValue(value: Partial<T>): void {
  batch(() => {
    for (const [key, fieldValue] of Object.entries(value)) {
      field.setValue(fieldValue); // Валидация всё равно запустится!
    }
  });
}
```

**Проблема:** batch() не отключает валидацию, она запустится N раз.

---

### 16. Отсутствие тестов для ValidationApplicator
**Файл:** `tests/core/validation/validation-applicator.test.ts`

```typescript
it('should be implemented', () => {
  expect(true).toBe(true); // PLACEHOLDER!
});
```

---

## АРХИТЕКТУРНЫЕ РЕКОМЕНДАЦИИ

### Краткосрочные (1-2 недели)

1. **Исправить критические баги:**
   - Race condition в validateImmediate() → AbortController
   - Утечка debounce → cleanup в dispose()
   - Логическая ошибка clearErrors → исправить условие
   - sync-fields → try-finally

2. **Исправить генерацию ключей:**
   ```typescript
   private watchCounter = 0;
   const key = `watch-${++this.watchCounter}`;
   ```

3. **Реализовать ArrayNode.setErrors**

---

### Среднесрочные (3-4 недели)

4. **Извлечь StateManager:**
   ```typescript
   class NodeStateManager {
     touched: Signal<boolean>;
     dirty: Signal<boolean>;
     // Общая логика для всех nodes
   }
   ```

5. **Извлечь ValidationManager:**
   ```typescript
   class ValidationManager {
     private abortController?: AbortController;
     async validate(): Promise<boolean> { ... }
   }
   ```

6. **Создать BaseBehavior:**
   ```typescript
   abstract class BaseBehavior<T> {
     abstract createHandler(): BehaviorHandlerFn<T>;
     register(options?: BehaviorOptions) { ... }
   }
   ```

7. **Разделить ValidationRegistry:**
   - RegistrationContext → управление validators
   - ValidationRegistry → регистрация
   - ValidatorApplier → применение

---

### Долгосрочные (1-2 месяца)

8. **Убрать Proxy из конструктора:**
   ```typescript
   // Вместо:
   const form = new GroupNode(config); // Returns Proxy

   // Использовать:
   const form = createForm(config); // Factory function
   ```

9. **Типобезопасная навигация по полям:**
   ```typescript
   // Вместо строк:
   form.getFieldByPath('address.city')

   // Использовать типизированные пути:
   form.getField(path => path.address.city)
   ```

10. **Composition over Inheritance:**
    ```typescript
    // Вместо иерархии FormNode → FieldNode/GroupNode/ArrayNode
    // Использовать композицию:
    class FormNode {
      state: NodeState;
      validation: ValidationManager;
      behaviors: BehaviorManager;
    }
    ```

---

## ФАЙЛЫ ДЛЯ ИСПРАВЛЕНИЯ (по приоритету)

| Приоритет | Файл | Проблемы |
|-----------|------|----------|
| P0 | `nodes/field-node.ts:303-388` | Race condition в async валидации |
| P0 | `nodes/field-node.ts:75-290` | Утечка памяти в debounce |
| P0 | `validation/validation-applicator.ts:188-190` | Логическая ошибка clearErrors |
| P0 | `behavior/behaviors/sync-fields.ts:39-82` | Race condition, нет error handling |
| P0 | `behavior/compose-behavior.ts:173-200` | Утечка памяти в applyWhen |
| P1 | `nodes/field-node.ts:520-521` | Дублирование ключей в watch |
| P1 | `nodes/array-node.ts:287-294` | Игнорирование setErrors |
| P1 | `nodes/group-node.ts:167-261` | Proxy в конструкторе |
| P2 | `validation/validation-registry.ts` | Нарушение SRP (372 строки) |
| P2 | `validation/validation-applicator.ts` | Нарушение SRP (265 строк) |
| P2 | `validation/validation-context.ts` | Дублирование кода |

---

## МЕТРИКИ КАЧЕСТВА

| Метрика | Текущее | Целевое |
|---------|---------|---------|
| `as any` assertions | 22+ | < 5 |
| eslint-disable | 15+ | 0 |
| Дублирование кода | ~30% | < 10% |
| Покрытие тестами ValidationApplicator | 0% | > 80% |
| Макс. размер класса (строк) | 795 (GroupNode) | < 300 |
| Макс. методов в классе | 14 (ValidationRegistry) | < 7 |

---

## ДЕТАЛЬНЫЙ АНАЛИЗ ПО МОДУЛЯМ

### Nodes (nodes/)

**Иерархия:**
```
FormNode (абстрактный базовый класс)
├── FieldNode (поле формы) - 590 строк
├── GroupNode (группа полей) - 795 строк
└── ArrayNode (массив форм) - 627 строк
```

**Паттерны:**
- Template Method - управление состоянием через protected hooks
- Factory Method - NodeFactory для создания нодов
- Proxy Pattern - GroupNode строит Proxy для доступа к полям
- Observer - SubscriptionManager для управления подписками

**Проблемы:**
- 6+ hook функций на каждый класс (onMarkAsTouched, onMarkAsUntouched, onMarkAsDirty, etc.)
- Дублирование computed signal creation во всех нодах
- Duck typing вместо instanceof из-за circular dependency

---

### Validation (validation/)

**Структура:**
```
validation/
├── core/                    # API функции
│   ├── validate.ts          # Синхронная валидация
│   ├── validate-async.ts    # Асинхронная валидация
│   ├── validate-tree.ts     # Cross-field валидация
│   └── apply-when.ts        # Условная валидация
├── validation-registry.ts   # Реестр (372 строки)
├── validation-applicator.ts # Применение (265 строк)
└── validation-context.ts    # 3 контекста (140 строк)
```

**Поток данных:**
1. GroupNode.applyValidationSchema() → registry.beginRegistration()
2. schema(path) выполняется → валидаторы регистрируются
3. registry.endRegistration() → хранит validators
4. GroupNode.validate() → applyContextualValidators()
5. ValidationApplicator.apply() → выполняет sync/async валидацию

---

### Behaviors (behavior/)

**Структура:**
```
behavior/
├── behavior-registry.ts     # Реестр (236 строк)
├── behavior-context.ts      # Контекст (53 строки)
├── compose-behavior.ts      # Композиция (200 строк)
└── behaviors/               # 8 behaviors
    ├── compute-from.ts
    ├── copy-from.ts
    ├── enable-when.ts
    ├── reset-when.ts
    ├── revalidate-when.ts
    ├── sync-fields.ts
    ├── transform-value.ts
    └── watch-field.ts
```

**Поток:**
1. GroupNode создает BehaviorRegistry
2. applyBehaviorSchema() → registry.beginRegistration()
3. Behaviors регистрируют handlers через getCurrentBehaviorRegistry()
4. endRegistration() → создает effect подписки
5. cleanup отписывает effects при уничтожении формы

**Неконсистентность API:**

| Behavior | Использует context | Использует form | Паттерн |
|----------|-------------------|-----------------|---------|
| copyFrom | ✓ | ctx.form | watchField wrapper |
| computeFrom | ✗ | form напрямую | effect напрямую |
| enableWhen | ✗ | form напрямую | effect напрямую |
| syncFields | ✗ | form напрямую | 2 effects |

---

## ЗАКЛЮЧЕНИЕ

Кодовая база имеет хорошую функциональную основу, но нуждается в серьёзной рефакторизации:

1. **Критические баги** - 5 проблем, которые могут привести к утечкам памяти и race conditions
2. **Type safety** - 22+ `as any` assertions скрывают реальные проблемы
3. **Code duplication** - ~30% дублирования между nodes и behaviors
4. **SRP violations** - классы слишком большие и делают слишком много

Рекомендуется начать с исправления P0 проблем, затем провести поэтапный рефакторинг для улучшения архитектуры.
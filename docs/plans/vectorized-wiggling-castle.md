# План рефакторинга Core модуля ReFormer

## Цель

Агрессивный рефакторинг `packages/reformer/src/core/` с сохранением:

- **Контрактов**: FieldPath, FormContext, FormProxy, публичный API узлов
- **Сигналов**: value, errors, valid, invalid, pending, touched, dirty, status

## Ключевые проблемы

| Проблема                               | Файлы                                            | Влияние                 |
| -------------------------------------- | ------------------------------------------------ | ----------------------- |
| GroupNode слишком большой (729 строк)  | `nodes/group-node.ts`                            | Сложность поддержки     |
| Дублирование в Registry                | `behavior-registry.ts`, `validation-registry.ts` | ~100 строк дублирования |
| queueMicrotask повторяется в behaviors | `behaviors/*.ts`                                 | Boilerplate             |
| Статусы разбросаны по узлам            | `field-node.ts`, `group-node.ts`                 | Сложно отлаживать       |
| Eager initialization Proxy             | `group-node.ts:236`                              | Производительность      |
| Неконсистентная обработка ошибок       | Разные подходы                                   | Отладка                 |

---

## Фаза 1: Quick Wins

### 1.1 Утилита `safeEffectCallback`

**Файл:** `core/utils/safe-effect.ts` (новый)

```typescript
export function safeEffectCallback<T>(
  callback: (value: T) => void | Promise<void>
): (value: T) => void {
  return (value: T) => {
    queueMicrotask(() => callback(value));
  };
}
```

**Изменить:** все behaviors в `core/behavior/behaviors/`:

- `watch-field.ts`
- `compute-from.ts`
- `copy-from.ts`
- `enable-when.ts`
- `reset-when.ts`
- `sync-fields.ts`

### 1.2 Lazy Proxy Initialization

**Файл:** `core/nodes/group-node.ts`

```typescript
// Было:
constructor(...) {
  this._proxyInstance = this.buildProxy(); // Всегда создаётся
}

// Станет:
private _proxyInstance?: FormProxy<T>;

getProxy(): FormProxy<T> {
  if (!this._proxyInstance) {
    this._proxyInstance = this.buildProxy();
  }
  return this._proxyInstance;
}
```

### 1.3 Унификация Error Handling

**Файл:** `core/utils/error-handler.ts` (существует)

Заменить все `console.warn` на `FormErrorHandler`:

- `array-node.ts:147-149`
- `validation-registry.ts:341-343`

---

## Фаза 2: AbstractRegistry

### 2.1 Базовый класс для реестров

**Файл:** `core/utils/abstract-registry.ts` (новый)

```typescript
export abstract class AbstractRegistry<TRegistration> {
  private static stacks = new Map<Function, RegistryStack<unknown>>();

  protected abstract onBeginRegistration(): void;
  protected abstract onEndRegistration(): { cleanup?: () => void };

  static getCurrent<T extends AbstractRegistry<unknown>>(
    this: new (...args: any[]) => T
  ): T | null {
    const stack = AbstractRegistry.stacks.get(this);
    return stack?.getCurrent() as T | null;
  }

  beginRegistration(): void {
    const stack = this.getOrCreateStack();
    stack.push(this);
    this.onBeginRegistration();
  }

  endRegistration<T>(...args: unknown[]): unknown {
    const stack = this.getOrCreateStack();
    stack.verify(this, this.constructor.name);
    return this.onEndRegistration();
  }

  private getOrCreateStack(): RegistryStack<this> {
    const ctor = this.constructor;
    if (!AbstractRegistry.stacks.has(ctor)) {
      AbstractRegistry.stacks.set(ctor, new RegistryStack());
    }
    return AbstractRegistry.stacks.get(ctor) as RegistryStack<this>;
  }
}
```

### 2.2 Рефакторинг BehaviorRegistry

**Файл:** `core/behavior/behavior-registry.ts`

```typescript
export class BehaviorRegistry extends AbstractRegistry<RegisteredBehavior> {
  private registrations: RegisteredBehavior[] = [];

  protected onBeginRegistration(): void {
    this.registrations = [];
  }

  protected onEndRegistration<T extends FormFields>(
    form: GroupNode<T>
  ): { count: number; cleanup: () => void } {
    // Существующая логика createEffect
  }

  register<T extends FormFields>(handler: BehaviorHandlerFn<T>, options?: BehaviorOptions): void {
    this.registrations.push({ handler, debounce: options?.debounce });
  }
}
```

### 2.3 Рефакторинг ValidationRegistry

**Файл:** `core/validation/validation-registry.ts`

Аналогично BehaviorRegistry, но с сохранением RegistrationContext для condition stack.

---

## Фаза 3: Декомпозиция GroupNode

### 3.1 BehaviorApplicator

**Файл:** `core/behavior/behavior-applicator.ts` (новый)

Извлечь из GroupNode:

- `applyBehaviorSchema()`
- Взаимодействие с BehaviorRegistry

```typescript
export class BehaviorApplicator<T extends FormFields> {
  constructor(
    private form: GroupNode<T>,
    private registry: BehaviorRegistry
  ) {}

  apply(schemaFn: BehaviorSchemaFn<T>): () => void {
    this.registry.beginRegistration();
    try {
      const path = createBehaviorFieldPath<T>();
      schemaFn(path);
      return this.registry.endRegistration(this.form.getProxy()).cleanup;
    } catch (error) {
      FormErrorHandler.handle(error, 'BehaviorApplicator');
      throw error;
    }
  }
}
```

### 3.2 FormSubmitter

**Файл:** `core/utils/form-submitter.ts` (новый)

Извлечь из GroupNode:

- `submit()`
- `_submitting` signal
- Touch all + validate logic

```typescript
export class FormSubmitter<T extends FormFields> {
  private readonly _submitting = signal(false);
  readonly submitting: ReadonlySignal<boolean> = computed(() => this._submitting.value);

  constructor(private form: GroupNode<T>) {}

  async submit<R>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> {
    this.form.markAsTouched();

    const isValid = await this.form.validate();
    if (!isValid) return null;

    this._submitting.value = true;
    try {
      return await onSubmit(this.form.getValue());
    } finally {
      this._submitting.value = false;
    }
  }
}
```

### 3.3 Обновлённый GroupNode

После извлечения GroupNode уменьшится на ~150-200 строк:

- BehaviorApplicator: ~30 строк
- FormSubmitter: ~20 строк
- Lazy Proxy: ~5 строк
- Error handling унификация: ~10 строк

---

## Фаза 4: FormStatusMachine

### 4.1 State Machine для статусов

**Файл:** `core/utils/status-machine.ts` (новый)

```typescript
type FieldStatus = 'valid' | 'invalid' | 'pending' | 'disabled';

export class FormStatusMachine {
  private readonly _status: Signal<FieldStatus>;

  readonly status: ReadonlySignal<FieldStatus>;
  readonly valid: ReadonlySignal<boolean>;
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>;
  readonly disabled: ReadonlySignal<boolean>;

  constructor(initial: FieldStatus = 'valid') {
    this._status = signal(initial);
    this.status = computed(() => this._status.value);
    this.valid = computed(() => this._status.value === 'valid');
    this.invalid = computed(() => this._status.value === 'invalid');
    this.pending = computed(() => this._status.value === 'pending');
    this.disabled = computed(() => this._status.value === 'disabled');
  }

  // Transition methods с валидацией переходов
  startValidation(): void {
    if (this._status.value !== 'disabled') {
      this._status.value = 'pending';
    }
  }

  completeValidation(hasErrors: boolean): void {
    if (this._status.value === 'pending') {
      this._status.value = hasErrors ? 'invalid' : 'valid';
    }
  }

  disable(): void {
    this._status.value = 'disabled';
  }

  enable(hasErrors: boolean = false): void {
    this._status.value = hasErrors ? 'invalid' : 'valid';
  }
}
```

### 4.2 Интеграция в FieldNode

**Файл:** `core/nodes/field-node.ts`

```typescript
export class FieldNode<T> extends FormNode<T> {
  private readonly statusMachine = new FormStatusMachine();

  // Делегирование сигналов
  readonly status = this.statusMachine.status;
  readonly valid = this.statusMachine.valid;
  readonly invalid = this.statusMachine.invalid;
  readonly pending = this.statusMachine.pending;
  readonly disabled = this.statusMachine.disabled;

  async validate(): Promise<boolean> {
    this.statusMachine.startValidation();
    // ... validation logic
    this.statusMachine.completeValidation(errors.length > 0);
  }
}
```

---

## Фаза 5: Оптимизация Производительности

### 5.1 Оптимизация aggregate-signals

**Файл:** `core/utils/aggregate-signals.ts`

```typescript
export function createAggregateSignals<T>(options: AggregateSignalsOptions<T>): AggregateSignals {
  const { getChildren, ownErrors } = options;

  // Кэширование children для избежания повторных вызовов
  const children = computed(() => getChildren());

  // Кэширование состояний для fine-grained reactivity
  const childStates = computed(() =>
    children.value.map((c) => ({
      valid: c.valid.value,
      pending: c.pending.value,
      touched: c.touched.value,
      dirty: c.dirty.value,
      errors: c.errors.value,
    }))
  );

  // Теперь computed зависят от childStates, а не от каждого ребёнка напрямую
  const valid = computed(() => {
    if (ownErrors.value.length > 0) return false;
    return childStates.value.every((s) => s.valid);
  });

  // ... остальные signals
}
```

### 5.2 FormObserver для отладки

**Файл:** `core/utils/form-observer.ts` (новый)

```typescript
export interface FormChangeEvent {
  type: 'value' | 'status' | 'errors' | 'touched' | 'dirty';
  path: string;
  timestamp: number;
  oldValue?: unknown;
  newValue: unknown;
}

export class FormObserver<T extends FormFields> {
  private listeners = new Set<(event: FormChangeEvent) => void>();

  constructor(private form: GroupNode<T>) {}

  subscribe(callback: (event: FormChangeEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Включается только в DEV mode
  enableTracing(): () => void {
    // Подписка на все сигналы формы
  }
}
```

---

## Файлы для изменения

### Новые файлы

- `core/utils/safe-effect.ts`
- `core/utils/abstract-registry.ts`
- `core/utils/status-machine.ts`
- `core/utils/form-submitter.ts`
- `core/utils/form-observer.ts`
- `core/behavior/behavior-applicator.ts`

### Изменяемые файлы

- `core/nodes/group-node.ts` - декомпозиция, lazy proxy
- `core/nodes/field-node.ts` - интеграция StatusMachine
- `core/nodes/array-node.ts` - error handling
- `core/behavior/behavior-registry.ts` - extends AbstractRegistry
- `core/validation/validation-registry.ts` - extends AbstractRegistry
- `core/behavior/behaviors/*.ts` - safeEffectCallback
- `core/utils/aggregate-signals.ts` - оптимизация

---

## Порядок выполнения

1. **Фаза 1** - Quick Wins (независимые изменения)
   - safeEffectCallback
   - Lazy Proxy
   - Error Handling

2. **Фаза 2** - AbstractRegistry
   - Создать базовый класс
   - Отрефакторить BehaviorRegistry
   - Отрефакторить ValidationRegistry

3. **Фаза 3** - Декомпозиция GroupNode
   - BehaviorApplicator
   - FormSubmitter
   - Обновить GroupNode

4. **Фаза 4** - FormStatusMachine
   - Создать StatusMachine
   - Интегрировать в FieldNode
   - Интегрировать в GroupNode/ArrayNode

5. **Фаза 5** - Производительность + Отладка
   - Оптимизация aggregate-signals
   - FormObserver

---

## Верификация

### Unit Tests

```bash
npm run test:core
```

### Integration Tests

```bash
npm run test:integration
```

### Playground проверка

```bash
cd projects/react-playground
npm run dev
# Проверить все примеры в /examples
```

### Типы

```bash
npm run typecheck
```

---

## Breaking Changes

Публичный API сохраняется полностью. Internal API изменения:

- `BehaviorRegistry` и `ValidationRegistry` наследуют от `AbstractRegistry`
- `GroupNode._proxyInstance` создаётся лениво
- Новые utility классы доступны для расширения

---

## Ожидаемый результат

| Метрика                 | До                 | После          |
| ----------------------- | ------------------ | -------------- |
| GroupNode строк         | ~729               | ~500-550       |
| Дублирование Registry   | ~100 строк         | 0              |
| Boilerplate в behaviors | 6 файлов × 5 строк | 1 утилита      |
| Статус-логика           | Разбросана         | Централизована |
